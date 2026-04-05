/**
 * annotation-linker.ts — Auto-link Apple Pencil freehand strokes to nearby
 * deviation markers on the canvas.
 *
 * After a freehand stroke is completed (on any layer while deviations are
 * visible), this checks proximity to deviation markers and creates a link.
 */

import type { FreehandStroke, CADElement, Point } from './types';

// ── Types ────────────────────────────────────────────────────────────────────

export interface LinkedAnnotation {
  strokeId: string;      // ID of the FreehandStroke element
  deviationId: string;   // ID of the deviation it's linked to
  distance: number;      // Distance from stroke center to deviation position (pixels)
}

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Calculate the center point of a freehand stroke (average of all points). */
function strokeCenter(stroke: FreehandStroke): Point {
  if (stroke.points.length === 0) return { x: 0, y: 0 };

  let sumX = 0;
  let sumY = 0;
  for (const p of stroke.points) {
    sumX += p.x;
    sumY += p.y;
  }
  return {
    x: sumX / stroke.points.length,
    y: sumY / stroke.points.length,
  };
}

/** Euclidean distance between two points. */
function dist(a: Point, b: Point): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.sqrt(dx * dx + dy * dy);
}

/** Get the position of a CADElement (works for elements with position, center, origin, or p1). */
function elementPosition(el: CADElement): Point | null {
  switch (el.type) {
    case 'text':
    case 'plant':
    case 'interior-symbol':
      return el.position;
    case 'circle':
      return el.center;
    case 'rectangle':
      return el.origin;
    case 'line':
    case 'dimension':
      // Midpoint of the line/dimension
      return { x: (el.p1.x + el.p2.x) / 2, y: (el.p1.y + el.p2.y) / 2 };
    case 'freehand':
      return strokeCenter(el);
    default:
      return null;
  }
}

// ── Main function ────────────────────────────────────────────────────────────

const DEFAULT_MAX_DISTANCE = 100; // pixels

/**
 * After a freehand stroke is completed, check if it's near a deviation marker
 * and link them.
 *
 * Deviation elements are identified by being on the 'deviations' layer with
 * IDs starting with 'deviation-'.
 *
 * @param stroke - The newly completed freehand stroke
 * @param allElements - All elements on the canvas (used to find deviations)
 * @param maxDistance - Maximum distance in pixels to consider a link (default 100)
 * @returns A LinkedAnnotation if a nearby deviation was found, or null
 */
export function linkAnnotationToDeviation(
  stroke: FreehandStroke,
  allElements: CADElement[],
  maxDistance: number = DEFAULT_MAX_DISTANCE,
): LinkedAnnotation | null {
  const center = strokeCenter(stroke);

  // Filter to deviation elements only
  const deviationElements = allElements.filter(
    (el) => el.layerId === 'deviations' && el.id.startsWith('deviation-'),
  );

  if (deviationElements.length === 0) return null;

  // Find the nearest deviation
  let nearest: CADElement | null = null;
  let nearestDist = Infinity;

  for (const dev of deviationElements) {
    const pos = elementPosition(dev);
    if (!pos) continue;

    const d = dist(center, pos);
    if (d < nearestDist) {
      nearestDist = d;
      nearest = dev;
    }
  }

  if (!nearest || nearestDist > maxDistance) return null;

  return {
    strokeId: stroke.id,
    deviationId: nearest.id,
    distance: nearestDist,
  };
}
