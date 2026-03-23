/**
 * Scan-GIS Auto-Alignment
 *
 * When both a KIRI scan and a GIS parcel boundary are present, this module
 * computes the transformation (scale + translation + optional rotation) needed
 * to align the scan coordinate space with the GIS coordinate space.
 *
 * Strategy:
 *   1. Bounding box matching — scale scan bbox to match parcel bbox
 *   2. Centroid alignment — translate scan centroid to parcel centroid
 *   3. Aspect ratio check — high confidence when ratios are within 20%
 *   4. Corner matching — try 4 rotations (0°, 90°, 180°, 270°) to best fit
 *
 * All coordinates are in the same drawing unit (feet) by the time they reach
 * this module. The scan is in meters × scaleFactor from scan-processor.ts.
 */

import type { Point } from './types';

// ── Result type ────────────────────────────────────────────────────────────────

export interface AlignmentResult {
  /** Uniform scale factor to apply to scan coordinates */
  scale: number;
  /** X translation (in drawing feet) to shift the scaled scan */
  offsetX: number;
  /** Y translation (in drawing feet) to shift the scaled scan */
  offsetY: number;
  /** Rotation in degrees applied before scale (0, 90, 180, 270) */
  rotation: number;
  /** 0–1 confidence estimate based on aspect ratio similarity */
  confidence: number;
  /** Human-readable description of the alignment method used */
  method: string;
}

// ── Bounding box helpers ───────────────────────────────────────────────────────

interface BBox {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  width: number;
  height: number;
  cx: number; // centroid X
  cy: number; // centroid Y
}

function computeBBox(points: Point[]): BBox | null {
  if (points.length === 0) return null;
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const p of points) {
    if (p.x < minX) minX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.x > maxX) maxX = p.x;
    if (p.y > maxY) maxY = p.y;
  }
  const width = maxX - minX;
  const height = maxY - minY;
  return { minX, minY, maxX, maxY, width, height, cx: (minX + maxX) / 2, cy: (minY + maxY) / 2 };
}

// ── Rotate a set of points around the origin ──────────────────────────────────

function rotatePoints(points: Point[], angleDeg: number): Point[] {
  if (angleDeg === 0) return points;
  const rad = (angleDeg * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  return points.map((p) => ({
    x: p.x * cos - p.y * sin,
    y: p.x * sin + p.y * cos,
  }));
}

// ── Aspect ratio similarity (0–1, 1 = identical) ─────────────────────────────

function aspectRatioSimilarity(wA: number, hA: number, wB: number, hB: number): number {
  if (wA <= 0 || hA <= 0 || wB <= 0 || hB <= 0) return 0;
  const ratioA = Math.max(wA, hA) / Math.min(wA, hA);
  const ratioB = Math.max(wB, hB) / Math.min(wB, hB);
  const diff = Math.abs(ratioA - ratioB) / Math.max(ratioA, ratioB);
  return Math.max(0, 1 - diff);
}

// ── Try a single rotation and compute scale + offset ─────────────────────────

interface RotationCandidate {
  rotation: number;
  scale: number;
  offsetX: number;
  offsetY: number;
  confidence: number;
}

function tryRotation(
  scanPoints: Point[],
  parcelBBox: BBox,
  angleDeg: number
): RotationCandidate {
  const rotated = rotatePoints(scanPoints, angleDeg);
  const scanBBox = computeBBox(rotated);
  if (!scanBBox || scanBBox.width <= 0 || scanBBox.height <= 0) {
    return { rotation: angleDeg, scale: 1, offsetX: 0, offsetY: 0, confidence: 0 };
  }

  // Scale so the scan bounding box fits the parcel bounding box
  const scaleX = parcelBBox.width / scanBBox.width;
  const scaleY = parcelBBox.height / scanBBox.height;
  // Use the smaller scale to preserve aspect ratio (fit within parcel)
  const scale = Math.min(scaleX, scaleY);

  // After scaling, align centroids
  const scaledCx = scanBBox.cx * scale;
  const scaledCy = scanBBox.cy * scale;
  const offsetX = parcelBBox.cx - scaledCx;
  const offsetY = parcelBBox.cy - scaledCy;

  // Confidence based on aspect ratio similarity after rotation
  const scaledW = scanBBox.width * scale;
  const scaledH = scanBBox.height * scale;
  const confidence = aspectRatioSimilarity(scaledW, scaledH, parcelBBox.width, parcelBBox.height);

  return { rotation: angleDeg, scale, offsetX, offsetY, confidence };
}

// ── Public API ─────────────────────────────────────────────────────────────────

/**
 * Compute the best alignment transformation to overlay a KIRI scan on a GIS parcel boundary.
 *
 * @param scanBoundary - Convex hull points from the KIRI scan (in drawing feet, from scan-processor.ts)
 * @param parcelBoundary - Parcel polygon points from GIS data (in drawing feet, from geojson-import.ts)
 * @returns AlignmentResult with scale, offsetX, offsetY, rotation, confidence, method
 */
export function autoAlignScanToGIS(
  scanBoundary: Point[],
  parcelBoundary: Point[],
): AlignmentResult {
  const parcelBBox = computeBBox(parcelBoundary);
  if (!parcelBBox || parcelBBox.width <= 0 || parcelBBox.height <= 0) {
    return {
      scale: 1,
      offsetX: 0,
      offsetY: 0,
      rotation: 0,
      confidence: 0,
      method: 'no-parcel — identity transform',
    };
  }

  if (scanBoundary.length === 0) {
    return {
      scale: 1,
      offsetX: 0,
      offsetY: 0,
      rotation: 0,
      confidence: 0,
      method: 'no-scan — identity transform',
    };
  }

  // Try all 4 cardinal rotations and pick the best confidence
  const candidates = [0, 90, 180, 270].map((deg) =>
    tryRotation(scanBoundary, parcelBBox, deg)
  );

  // Sort by confidence descending
  candidates.sort((a, b) => b.confidence - a.confidence);
  const best = candidates[0];

  const method =
    best.rotation === 0
      ? 'bbox-match + centroid-align (no rotation)'
      : `bbox-match + centroid-align (rotated ${best.rotation}°)`;

  return {
    scale: best.scale,
    offsetX: best.offsetX,
    offsetY: best.offsetY,
    rotation: best.rotation,
    confidence: best.confidence,
    method,
  };
}

/**
 * Apply an alignment result to a set of points.
 * Applies: rotate → scale → translate (in that order).
 */
export function applyAlignment(points: Point[], alignment: AlignmentResult): Point[] {
  const rotated = rotatePoints(points, alignment.rotation);
  return rotated.map((p) => ({
    x: p.x * alignment.scale + alignment.offsetX,
    y: p.y * alignment.scale + alignment.offsetY,
  }));
}

/**
 * Extract boundary points from a set of line elements on the scan layer.
 * Returns the unique set of endpoints (for alignment purposes).
 */
export function extractScanBoundaryPoints(
  elements: Array<{ type: string; p1?: Point; p2?: Point; layerId: string }>
): Point[] {
  const pts: Point[] = [];
  for (const el of elements) {
    if (el.layerId !== 'scan') continue;
    if (el.type === 'line' && el.p1 && el.p2) {
      pts.push(el.p1, el.p2);
    }
  }
  return pts;
}

/**
 * Extract boundary points from GIS parcel line elements.
 */
export function extractParcelBoundaryPoints(
  elements: Array<{ type: string; p1?: Point; p2?: Point; layerId: string }>
): Point[] {
  const pts: Point[] = [];
  for (const el of elements) {
    if (el.layerId !== 'gis') continue;
    if (el.type === 'line' && el.p1 && el.p2) {
      pts.push(el.p1, el.p2);
    }
  }
  return pts;
}
