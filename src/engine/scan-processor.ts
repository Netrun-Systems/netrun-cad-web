/**
 * Scan processor — converts raw 3D point cloud data (from OBJ/PLY import)
 * into 2D CAD elements suitable for landscape plan drawings.
 *
 * All processing runs synchronously in Web Worker contexts (called from
 * ScanImportWorker.ts) to avoid blocking the main thread.
 */

import type { CADElement, CADLine, Layer } from './types';
import type { OBJVertex } from './obj-import';
import type { PLYVertex } from './ply-import';

// ── Types ─────────────────────────────────────────────────────────────────────

export type Vertex3D = OBJVertex | PLYVertex;

export interface Point2D {
  x: number;
  y: number;
}

export type ScanOutputMode = 'pointCloud' | 'boundary' | 'contours' | 'all';

export interface ScanProcessOptions {
  /** Unit scale: meters to feet = 3.28084, or custom. KIRI exports meters by default. */
  scaleFactor: number;
  /**
   * Which axis to use for plan view (top-down).
   *   'planView' → drop Y (up axis), use X/Z as X/Y in drawing space.
   *   'elevation' → keep X/Y, use for front elevation view.
   */
  projection: 'planView' | 'elevation';
  /** Output type(s) to generate. */
  outputMode: ScanOutputMode;
  /** Elevation interval in feet for contour generation (default 1 ft). */
  contourInterval?: number;
  /** Point cloud dot size in drawing units (default 0.5). */
  pointSize?: number;
  /** Layer id for scan elements (default 'scan'). */
  layerId?: string;
  strokeColor?: string;
}

export interface ScanProcessResult {
  elements: CADElement[];
  newLayers: Layer[];
  stats: {
    inputVertices: number;
    outputElements: number;
    boundaryPoints: number;
    contourLines: number;
  };
  warnings: string[];
}

// ── Scan layer ────────────────────────────────────────────────────────────────

export const SCAN_LAYER: Layer = {
  id: 'scan',
  name: 'Scan',
  visible: true,
  locked: false,
  opacity: 0.8,
  color: '#ff6e40',
  order: -2,
};

// ── Coordinate projection ─────────────────────────────────────────────────────

/**
 * Project a 3D vertex to a 2D plan-view point.
 * KIRI Engine coordinate convention: Y = up (altitude), X/Z = ground plane.
 */
export function projectToPlanView(v: Vertex3D): Point2D {
  return { x: v.x, y: v.z }; // Drop Y (altitude), use X/Z
}

export function projectToElevation(v: Vertex3D): Point2D {
  return { x: v.x, y: -v.y }; // X/Y plane, invert Y for canvas coords
}

/**
 * Scale a 2D point from meters to feet (or by custom factor).
 */
export function scaleToFeet(pt: Point2D, scaleFactor: number): Point2D {
  return { x: pt.x * scaleFactor, y: pt.y * scaleFactor };
}

// ── Convex Hull (Graham scan) ─────────────────────────────────────────────────

function cross(O: Point2D, A: Point2D, B: Point2D): number {
  return (A.x - O.x) * (B.y - O.y) - (A.y - O.y) * (B.x - O.x);
}

/**
 * Compute the convex hull of a set of 2D points.
 * Returns points in counter-clockwise order.
 * Implements the Andrew's monotone chain algorithm — O(n log n).
 */
export function computeConvexHull(points: Point2D[]): Point2D[] {
  if (points.length < 3) return [...points];

  const sorted = [...points].sort((a, b) => a.x - b.x || a.y - b.y);
  const n = sorted.length;
  const hull: Point2D[] = [];

  // Lower hull
  for (let i = 0; i < n; i++) {
    while (hull.length >= 2 && cross(hull[hull.length - 2], hull[hull.length - 1], sorted[i]) <= 0) {
      hull.pop();
    }
    hull.push(sorted[i]);
  }

  // Upper hull
  const t = hull.length + 1;
  for (let i = n - 2; i >= 0; i--) {
    while (hull.length >= t && cross(hull[hull.length - 2], hull[hull.length - 1], sorted[i]) <= 0) {
      hull.pop();
    }
    hull.push(sorted[i]);
  }

  hull.pop(); // Remove the last point (same as first)
  return hull;
}

// ── Contour generation ────────────────────────────────────────────────────────

/**
 * Group vertices by elevation band and create contour line segments.
 * Uses the Y coordinate as elevation in plan view mode.
 *
 * Strategy: for each elevation band, project all vertices in that band to 2D,
 * compute their convex hull, and emit the hull edges as lines.
 * This is a simplified contour approximation suitable for landscape plans.
 */
export function computeElevationContours(
  vertices: Vertex3D[],
  interval: number,
  scaleFactor: number,
  layerId: string,
  strokeColor: string
): CADLine[] {
  if (vertices.length === 0 || interval <= 0) return [];

  // Find elevation range (Y = up axis in KIRI)
  let minY = Infinity;
  let maxY = -Infinity;
  for (const v of vertices) {
    if (v.y < minY) minY = v.y;
    if (v.y > maxY) maxY = v.y;
  }

  const lines: CADLine[] = [];
  let lineId = 1;
  const halfInterval = interval / scaleFactor / 2; // Half-band in raw units

  // Step through elevation bands
  const minBand = Math.floor(minY / (interval / scaleFactor));
  const maxBand = Math.ceil(maxY / (interval / scaleFactor));

  for (let band = minBand; band <= maxBand; band++) {
    const elevation = band * (interval / scaleFactor);
    const bandVertices = vertices.filter(
      (v) => v.y >= elevation - halfInterval && v.y < elevation + halfInterval
    );
    if (bandVertices.length < 3) continue;

    const pts = bandVertices.map((v) => {
      const raw = projectToPlanView(v);
      return scaleToFeet(raw, scaleFactor);
    });

    const hull = computeConvexHull(pts);
    if (hull.length < 2) continue;

    // Emit hull edges as lines
    for (let i = 0; i < hull.length; i++) {
      const p1 = hull[i];
      const p2 = hull[(i + 1) % hull.length];
      lines.push({
        type: 'line',
        id: `contour-${lineId++}`,
        p1,
        p2,
        layerId,
        strokeColor,
        strokeWidth: 0.5,
      });
    }
  }

  return lines;
}

// ── Point cloud rendering ─────────────────────────────────────────────────────

let scanCircleId = 1;

/**
 * Create a simplified point cloud representation as tiny circles.
 * For performance, subsamples large point clouds (> 5000 points).
 */
export function buildPointCloud(
  points: Point2D[],
  pointSize: number,
  layerId: string,
  strokeColor: string
): CADElement[] {
  const MAX_POINTS = 5000;
  const step = points.length > MAX_POINTS ? Math.ceil(points.length / MAX_POINTS) : 1;
  const elements: CADElement[] = [];

  for (let i = 0; i < points.length; i += step) {
    const pt = points[i];
    elements.push({
      type: 'circle',
      id: `scan-pt-${scanCircleId++}`,
      center: pt,
      radius: pointSize / 2,
      layerId,
      strokeColor,
      strokeWidth: 0,
      fillColor: strokeColor,
    });
  }

  return elements;
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Process a 3D vertex array into 2D CAD elements.
 * Called from the Web Worker for large scans, or directly for small ones.
 */
export function processScan(
  vertices: Vertex3D[],
  options: ScanProcessOptions
): ScanProcessResult {
  const {
    scaleFactor,
    projection,
    outputMode,
    contourInterval = 1,
    pointSize = 0.3,
    layerId = 'scan',
    strokeColor = '#ff6e40',
  } = options;

  const warnings: string[] = [];
  const elements: CADElement[] = [];

  if (vertices.length === 0) {
    warnings.push('No vertices to process');
    return {
      elements: [],
      newLayers: [SCAN_LAYER],
      stats: { inputVertices: 0, outputElements: 0, boundaryPoints: 0, contourLines: 0 },
      warnings,
    };
  }

  // Project and scale all vertices to 2D
  const project = projection === 'planView' ? projectToPlanView : projectToElevation;
  const points2D: Point2D[] = vertices.map((v) => scaleToFeet(project(v), scaleFactor));

  let boundaryPoints = 0;
  let contourLines = 0;

  // Point cloud
  if (outputMode === 'pointCloud' || outputMode === 'all') {
    const cloudElements = buildPointCloud(points2D, pointSize, layerId, strokeColor);
    elements.push(...cloudElements);
    if (points2D.length > 5000) {
      warnings.push(`Point cloud subsampled from ${points2D.length} to ${cloudElements.length} for performance`);
    }
  }

  // Boundary (convex hull)
  if (outputMode === 'boundary' || outputMode === 'all') {
    const hull = computeConvexHull(points2D);
    boundaryPoints = hull.length;
    let hullId = 1;
    for (let i = 0; i < hull.length; i++) {
      const p1 = hull[i];
      const p2 = hull[(i + 1) % hull.length];
      elements.push({
        type: 'line',
        id: `scan-hull-${hullId++}`,
        p1,
        p2,
        layerId,
        strokeColor,
        strokeWidth: 1.5,
      });
    }
  }

  // Elevation contours (only meaningful in plan view)
  if ((outputMode === 'contours' || outputMode === 'all') && projection === 'planView') {
    const contours = computeElevationContours(
      vertices,
      contourInterval,
      scaleFactor,
      layerId,
      '#888888'
    );
    contourLines = contours.length;
    elements.push(...contours);
  } else if (outputMode === 'contours' && projection === 'elevation') {
    warnings.push('Contour lines are only available in plan view projection');
  }

  return {
    elements,
    newLayers: [SCAN_LAYER],
    stats: {
      inputVertices: vertices.length,
      outputElements: elements.length,
      boundaryPoints,
      contourLines,
    },
    warnings,
  };
}
