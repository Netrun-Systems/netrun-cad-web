/**
 * Element selection — hit testing, bounding boxes, and move operations.
 *
 * Supports click-to-select for all element types: line, rectangle, circle,
 * dimension, freehand, text, plant, interior-symbol.
 */

import type { CADElement, Point } from './types';

const HIT_TOLERANCE = 8; // pixels

/** Distance from point to line segment */
function distToSegment(p: Point, a: Point, b: Point): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return Math.hypot(p.x - a.x, p.y - a.y);
  let t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / lenSq;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
}

/** Test if a point hits an element within tolerance (in canvas coords). */
export function hitTest(element: CADElement, point: Point, zoom: number): boolean {
  const tol = HIT_TOLERANCE / zoom;

  switch (element.type) {
    case 'line':
    case 'dimension':
      return distToSegment(point, element.p1, element.p2) < tol;

    case 'rectangle': {
      const { origin, width, height } = element;
      const corners = [
        origin,
        { x: origin.x + width, y: origin.y },
        { x: origin.x + width, y: origin.y + height },
        { x: origin.x, y: origin.y + height },
      ];
      // Check all 4 edges
      for (let i = 0; i < 4; i++) {
        if (distToSegment(point, corners[i], corners[(i + 1) % 4]) < tol) return true;
      }
      // Check if inside fill area
      if (point.x >= origin.x && point.x <= origin.x + width &&
          point.y >= origin.y && point.y <= origin.y + height) return true;
      return false;
    }

    case 'circle': {
      const dist = Math.hypot(point.x - element.center.x, point.y - element.center.y);
      // Hit if near the circumference OR inside the circle
      return Math.abs(dist - element.radius) < tol || dist < element.radius;
    }

    case 'freehand': {
      // Check proximity to any segment in the stroke
      const pts = element.points;
      for (let i = 1; i < pts.length; i++) {
        if (distToSegment(point, pts[i - 1], pts[i]) < tol * 2) return true;
      }
      return false;
    }

    case 'text': {
      // Approximate text bounding box (rough: 8px per char width, fontSize height)
      const w = element.content.length * element.fontSize * 0.6;
      const h = element.fontSize * 1.2;
      return (
        point.x >= element.position.x - 2 &&
        point.x <= element.position.x + w + 2 &&
        point.y >= element.position.y - h - 2 &&
        point.y <= element.position.y + 2
      );
    }

    case 'plant': {
      const sz = 20 * element.scale;
      return (
        point.x >= element.position.x - sz &&
        point.x <= element.position.x + sz &&
        point.y >= element.position.y - sz &&
        point.y <= element.position.y + sz
      );
    }

    case 'interior-symbol': {
      const pxPerFt = 96; // matches CAD scale
      const halfW = (element.width * pxPerFt) / 2;
      const halfD = (element.depth * pxPerFt) / 2;
      return (
        point.x >= element.position.x - halfW &&
        point.x <= element.position.x + halfW &&
        point.y >= element.position.y - halfD &&
        point.y <= element.position.y + halfD
      );
    }

    default:
      return false;
  }
}

/** Find the topmost element at a canvas point. Returns element or null. */
export function findElementAt(
  elements: CADElement[],
  point: Point,
  zoom: number,
): CADElement | null {
  // Iterate in reverse (topmost = last drawn)
  for (let i = elements.length - 1; i >= 0; i--) {
    if (hitTest(elements[i], point, zoom)) return elements[i];
  }
  return null;
}

/** Move an element by a delta. Returns a new element (immutable). */
export function moveElement(element: CADElement, dx: number, dy: number): CADElement {
  switch (element.type) {
    case 'line':
      return { ...element, p1: { x: element.p1.x + dx, y: element.p1.y + dy }, p2: { x: element.p2.x + dx, y: element.p2.y + dy } };
    case 'dimension':
      return { ...element, p1: { x: element.p1.x + dx, y: element.p1.y + dy }, p2: { x: element.p2.x + dx, y: element.p2.y + dy } };
    case 'rectangle':
      return { ...element, origin: { x: element.origin.x + dx, y: element.origin.y + dy } };
    case 'circle':
      return { ...element, center: { x: element.center.x + dx, y: element.center.y + dy } };
    case 'text':
      return { ...element, position: { x: element.position.x + dx, y: element.position.y + dy } };
    case 'plant':
      return { ...element, position: { x: element.position.x + dx, y: element.position.y + dy } };
    case 'interior-symbol':
      return { ...element, position: { x: element.position.x + dx, y: element.position.y + dy } };
    case 'freehand':
      return { ...element, points: element.points.map(p => ({ ...p, x: p.x + dx, y: p.y + dy })) };
    default:
      return element;
  }
}

/** Get the bounding box of an element for highlight rendering. */
export function getBoundingBox(element: CADElement): { x: number; y: number; width: number; height: number } {
  switch (element.type) {
    case 'line':
    case 'dimension': {
      const minX = Math.min(element.p1.x, element.p2.x);
      const minY = Math.min(element.p1.y, element.p2.y);
      return { x: minX, y: minY, width: Math.abs(element.p2.x - element.p1.x), height: Math.abs(element.p2.y - element.p1.y) };
    }
    case 'rectangle':
      return { x: element.origin.x, y: element.origin.y, width: element.width, height: element.height };
    case 'circle':
      return { x: element.center.x - element.radius, y: element.center.y - element.radius, width: element.radius * 2, height: element.radius * 2 };
    case 'text': {
      const w = element.content.length * element.fontSize * 0.6;
      const h = element.fontSize * 1.2;
      return { x: element.position.x, y: element.position.y - h, width: w, height: h };
    }
    case 'plant': {
      const sz = 20 * element.scale;
      return { x: element.position.x - sz, y: element.position.y - sz, width: sz * 2, height: sz * 2 };
    }
    case 'interior-symbol': {
      const pxPerFt = 96;
      const w = element.width * pxPerFt;
      const d = element.depth * pxPerFt;
      return { x: element.position.x - w / 2, y: element.position.y - d / 2, width: w, height: d };
    }
    case 'freehand': {
      const xs = element.points.map(p => p.x);
      const ys = element.points.map(p => p.y);
      const minX = Math.min(...xs);
      const minY = Math.min(...ys);
      return { x: minX, y: minY, width: Math.max(...xs) - minX, height: Math.max(...ys) - minY };
    }
    default:
      return { x: 0, y: 0, width: 0, height: 0 };
  }
}
