/**
 * Element selection — hit testing, bounding boxes, and move operations.
 *
 * Supports click-to-select for all element types: line, rectangle, circle,
 * dimension, freehand, text, plant, interior-symbol.
 */

import type { CADElement, Point } from './types';
import { getBlock } from '../data/blocks';
import { sampleSpline } from './spline';

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

    case 'arc': {
      const dx = point.x - element.center.x;
      const dy = point.y - element.center.y;
      const dist = Math.hypot(dx, dy);
      if (Math.abs(dist - element.radius) >= tol) return false;
      // Check the angle is within the sweep range
      const ang = Math.atan2(dy, dx);
      const norm = (a: number) => {
        const t = a % (Math.PI * 2);
        return t < 0 ? t + Math.PI * 2 : t;
      };
      const start = norm(element.startAngle);
      const end = norm(element.endAngle);
      const a = norm(ang);
      // Sweep from start to end going counter-clockwise (canvas Y is down,
      // so default sweep matches the renderer's anticlockwise=false branch).
      if (start <= end) return a >= start && a <= end;
      return a >= start || a <= end;
    }

    case 'ellipse': {
      const dx = point.x - element.center.x;
      const dy = point.y - element.center.y;
      // Outline test in scaled space: a point is on the perimeter when
      // (dx/rx)^2 + (dy/ry)^2 ≈ 1. Tolerance scaled to roughly canvas pixels.
      const nx = dx / element.rx;
      const ny = dy / element.ry;
      const r2 = nx * nx + ny * ny;
      const t = tol / Math.min(element.rx, element.ry);
      // Hit if on the perimeter OR inside the ellipse
      return Math.abs(Math.sqrt(r2) - 1) < t || r2 < 1;
    }

    case 'freehand': {
      // Check proximity to any segment in the stroke
      const pts = element.points;
      for (let i = 1; i < pts.length; i++) {
        if (distToSegment(point, pts[i - 1], pts[i]) < tol * 2) return true;
      }
      return false;
    }

    case 'polyline': {
      const pts = element.points;
      for (let i = 1; i < pts.length; i++) {
        if (distToSegment(point, pts[i - 1], pts[i]) < tol) return true;
      }
      // Closing edge if marked closed
      if (element.closed && pts.length >= 3) {
        if (distToSegment(point, pts[pts.length - 1], pts[0]) < tol) return true;
      }
      return false;
    }

    case 'spline': {
      // Sample the curve cheaply (8 per segment is enough for hit-test)
      // and treat as a polyline for the distance check.
      const pts = sampleSpline(element.controlPoints, !!element.closed, element.tension, 8);
      for (let i = 1; i < pts.length; i++) {
        if (distToSegment(point, pts[i - 1], pts[i]) < tol) return true;
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

    case 'block': {
      // Treat the block instance as opaque — hit if the cursor is inside
      // the rotated, scaled bbox. Cheap point-in-rotated-rect test:
      // transform the cursor into block-local space and check the half-
      // widths.
      const def = getBlock(element.blockId);
      if (!def) return false;
      const cos = Math.cos(-element.rotation);
      const sin = Math.sin(-element.rotation);
      const dx = (point.x - element.position.x);
      const dy = (point.y - element.position.y);
      const lx = (dx * cos - dy * sin) / element.scale;
      const ly = (dx * sin + dy * cos) / element.scale;
      const hw = def.bbox.width / 2 + tol;
      const hh = def.bbox.height / 2 + tol;
      return Math.abs(lx) <= hw && Math.abs(ly) <= hh;
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

/**
 * Union bounding box of multiple elements. Returns null if `elements`
 * is empty. Used by the multi-resize affordance — when 2+ elements are
 * selected, we draw resize handles around this box and scale every
 * element together about the opposite corner.
 */
export function unionBoundingBox(
  elements: CADElement[],
): { x: number; y: number; width: number; height: number } | null {
  if (elements.length === 0) return null;
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const el of elements) {
    const bb = getBoundingBox(el);
    if (bb.x < minX) minX = bb.x;
    if (bb.y < minY) minY = bb.y;
    if (bb.x + bb.width > maxX) maxX = bb.x + bb.width;
    if (bb.y + bb.height > maxY) maxY = bb.y + bb.height;
  }
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}

/**
 * Marquee selection. AutoCAD-style:
 *   crossing=false (default, "window") — only fully-enclosed elements.
 *   crossing=true                       — also includes elements whose
 *                                          bbox intersects the marquee.
 *
 * AutoCAD distinguishes the two by drag direction: left-to-right drag
 * is window selection (the safer default); right-to-left drag is crossing
 * selection (catches everything the box touches). CADCanvas reads the
 * drag direction at pointer-up time and passes the right flag.
 */
export function findElementsInRect(
  elements: CADElement[],
  rect: { x: number; y: number; width: number; height: number },
  crossing = false,
): CADElement[] {
  const r1x = rect.x;
  const r1y = rect.y;
  const r2x = rect.x + rect.width;
  const r2y = rect.y + rect.height;
  const matched: CADElement[] = [];
  for (const el of elements) {
    const bb = getBoundingBox(el);
    const e1x = bb.x;
    const e1y = bb.y;
    const e2x = bb.x + bb.width;
    const e2y = bb.y + bb.height;
    if (crossing) {
      // Intersection test — true unless the bboxes are entirely separated
      // along either axis.
      if (e2x < r1x || e1x > r2x || e2y < r1y || e1y > r2y) continue;
      matched.push(el);
    } else {
      // Fully-enclosed (window) test
      if (e1x >= r1x && e1y >= r1y && e2x <= r2x && e2y <= r2y) {
        matched.push(el);
      }
    }
  }
  return matched;
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
    case 'arc':
      return { ...element, center: { x: element.center.x + dx, y: element.center.y + dy } };
    case 'ellipse':
      return { ...element, center: { x: element.center.x + dx, y: element.center.y + dy } };
    case 'text':
      return { ...element, position: { x: element.position.x + dx, y: element.position.y + dy } };
    case 'plant':
      return { ...element, position: { x: element.position.x + dx, y: element.position.y + dy } };
    case 'interior-symbol':
      return { ...element, position: { x: element.position.x + dx, y: element.position.y + dy } };
    case 'block':
      return { ...element, position: { x: element.position.x + dx, y: element.position.y + dy } };
    case 'freehand':
      return { ...element, points: element.points.map(p => ({ ...p, x: p.x + dx, y: p.y + dy })) };
    case 'polyline':
      return { ...element, points: element.points.map(p => ({ x: p.x + dx, y: p.y + dy })) };
    case 'spline':
      return { ...element, controlPoints: element.controlPoints.map(p => ({ x: p.x + dx, y: p.y + dy })) };
    default:
      return element;
  }
}

/**
 * Scale a point around an anchor by independent X/Y factors.
 */
function scalePoint(p: Point, anchor: Point, sx: number, sy: number): Point {
  return {
    x: anchor.x + (p.x - anchor.x) * sx,
    y: anchor.y + (p.y - anchor.y) * sy,
  };
}

/** Minimum size in canvas px below which we refuse to shrink an element. */
const MIN_SIZE = 4;

/**
 * Scale an element around `anchor` by `(sx, sy)`. Returns a new element
 * (immutable). Element-type specifics:
 *  - line/dimension/freehand/polyline: scale all points
 *  - rectangle: scale origin + dimensions, flipping if a factor goes negative
 *  - circle: scale center, multiply radius by max(|sx|, |sy|) (uniform)
 *  - text: scale position, multiply fontSize by avg
 *  - plant: scale position, multiply scale field by avg
 *  - interior-symbol: scale position, multiply width by sx, depth by sy
 *
 * Factors clamp such that the resulting bounding box stays at least
 * MIN_SIZE in each axis (prevents zero/negative dimensions during a drag
 * past the anchor).
 */
export function scaleElement(
  element: CADElement,
  anchor: Point,
  sxRaw: number,
  syRaw: number,
): CADElement {
  // Allow flipping (negative sx/sy) but clamp magnitudes so we never end
  // up with degenerate < MIN_SIZE dimensions.
  const sx = Math.abs(sxRaw) < 0.05 ? Math.sign(sxRaw || 1) * 0.05 : sxRaw;
  const sy = Math.abs(syRaw) < 0.05 ? Math.sign(syRaw || 1) * 0.05 : syRaw;
  const avg = (Math.abs(sx) + Math.abs(sy)) / 2;

  switch (element.type) {
    case 'line':
    case 'dimension': {
      const p1 = scalePoint(element.p1, anchor, sx, sy);
      const p2 = scalePoint(element.p2, anchor, sx, sy);
      return { ...element, p1, p2 };
    }
    case 'rectangle': {
      const corner = { x: element.origin.x + element.width, y: element.origin.y + element.height };
      const newOrigin = scalePoint(element.origin, anchor, sx, sy);
      const newCorner = scalePoint(corner, anchor, sx, sy);
      const minX = Math.min(newOrigin.x, newCorner.x);
      const minY = Math.min(newOrigin.y, newCorner.y);
      const w = Math.max(MIN_SIZE, Math.abs(newCorner.x - newOrigin.x));
      const h = Math.max(MIN_SIZE, Math.abs(newCorner.y - newOrigin.y));
      return { ...element, origin: { x: minX, y: minY }, width: w, height: h };
    }
    case 'circle': {
      const newCenter = scalePoint(element.center, anchor, sx, sy);
      const newRadius = Math.max(MIN_SIZE / 2, element.radius * Math.max(Math.abs(sx), Math.abs(sy)));
      return { ...element, center: newCenter, radius: newRadius };
    }
    case 'arc': {
      const newCenter = scalePoint(element.center, anchor, sx, sy);
      const newRadius = Math.max(MIN_SIZE / 2, element.radius * Math.max(Math.abs(sx), Math.abs(sy)));
      return { ...element, center: newCenter, radius: newRadius };
    }
    case 'ellipse': {
      const newCenter = scalePoint(element.center, anchor, sx, sy);
      return {
        ...element,
        center: newCenter,
        rx: Math.max(MIN_SIZE / 2, element.rx * Math.abs(sx)),
        ry: Math.max(MIN_SIZE / 2, element.ry * Math.abs(sy)),
      };
    }
    case 'freehand':
      return { ...element, points: element.points.map((p) => ({ ...p, ...scalePoint(p, anchor, sx, sy) })) };
    case 'polyline':
      return { ...element, points: element.points.map((p) => scalePoint(p, anchor, sx, sy)) };
    case 'spline':
      return { ...element, controlPoints: element.controlPoints.map((p) => scalePoint(p, anchor, sx, sy)) };
    case 'text': {
      const newPos = scalePoint(element.position, anchor, sx, sy);
      const newSize = Math.max(6, element.fontSize * avg);
      return { ...element, position: newPos, fontSize: newSize };
    }
    case 'plant': {
      const newPos = scalePoint(element.position, anchor, sx, sy);
      return { ...element, position: newPos, scale: Math.max(0.1, element.scale * avg) };
    }
    case 'interior-symbol': {
      const newPos = scalePoint(element.position, anchor, sx, sy);
      return {
        ...element,
        position: newPos,
        width: Math.max(0.1, element.width * Math.abs(sx)),
        depth: Math.max(0.1, element.depth * Math.abs(sy)),
      };
    }
    case 'block': {
      // Blocks scale uniformly — average the magnitudes so a non-uniform
      // drag still produces a reasonable size change.
      const newPos = scalePoint(element.position, anchor, sx, sy);
      return { ...element, position: newPos, scale: Math.max(0.05, element.scale * avg) };
    }
    case 'flowchart-shape':
    case 'container': {
      const corner = { x: element.origin.x + element.width, y: element.origin.y + element.height };
      const newOrigin = scalePoint(element.origin, anchor, sx, sy);
      const newCorner = scalePoint(corner, anchor, sx, sy);
      const minX = Math.min(newOrigin.x, newCorner.x);
      const minY = Math.min(newOrigin.y, newCorner.y);
      const w = Math.max(MIN_SIZE, Math.abs(newCorner.x - newOrigin.x));
      const h = Math.max(MIN_SIZE, Math.abs(newCorner.y - newOrigin.y));
      return { ...element, origin: { x: minX, y: minY }, width: w, height: h };
    }
    default:
      return element; // connector — not user-resizable
  }
}

/** A corner-handle identifier for the bounding-box resize affordances. */
export type ResizeHandle = 'tl' | 'tr' | 'bl' | 'br';

/**
 * Hit-test the four corner handles drawn around a selected element's
 * bounding box. Returns the handle name or null.
 *
 * Padding + handle size mirror what CADCanvas's render loop draws:
 *   pad = 4 / zoom, handle = 4 / zoom (so an 8-px square)
 */
export function hitHandle(
  bbox: { x: number; y: number; width: number; height: number },
  point: Point,
  zoom: number,
): ResizeHandle | null {
  const pad = 4 / zoom;
  const hs = 6 / zoom; // generous tap target — handles drawn at 4/zoom
  const corners: Array<[ResizeHandle, number, number]> = [
    ['tl', bbox.x - pad,                bbox.y - pad],
    ['tr', bbox.x + bbox.width + pad,   bbox.y - pad],
    ['bl', bbox.x - pad,                bbox.y + bbox.height + pad],
    ['br', bbox.x + bbox.width + pad,   bbox.y + bbox.height + pad],
  ];
  for (const [name, hx, hy] of corners) {
    if (Math.abs(point.x - hx) <= hs && Math.abs(point.y - hy) <= hs) return name;
  }
  return null;
}

/**
 * Given a handle, return the opposite-corner anchor of the bounding box.
 * That anchor stays fixed during a resize drag.
 */
export function anchorForHandle(
  bbox: { x: number; y: number; width: number; height: number },
  handle: ResizeHandle,
): Point {
  switch (handle) {
    case 'tl': return { x: bbox.x + bbox.width, y: bbox.y + bbox.height };
    case 'tr': return { x: bbox.x,              y: bbox.y + bbox.height };
    case 'bl': return { x: bbox.x + bbox.width, y: bbox.y };
    case 'br': return { x: bbox.x,              y: bbox.y };
  }
}

/** CSS cursor name for the given handle (matches diagonal direction). */
export function cursorForHandle(handle: ResizeHandle): string {
  return handle === 'tl' || handle === 'br' ? 'nwse-resize' : 'nesw-resize';
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
    case 'arc':
      // Use the full circle bbox — tight arc bbox needs per-quadrant analysis,
      // not worth the complexity for a selection-highlight rectangle that's
      // only a touch larger than the arc itself.
      return { x: element.center.x - element.radius, y: element.center.y - element.radius, width: element.radius * 2, height: element.radius * 2 };
    case 'ellipse':
      return { x: element.center.x - element.rx, y: element.center.y - element.ry, width: element.rx * 2, height: element.ry * 2 };
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
    case 'block': {
      const def = getBlock(element.blockId);
      if (!def) return { x: element.position.x, y: element.position.y, width: 0, height: 0 };
      // Approximate axis-aligned bbox from the rotated/scaled block bbox:
      // take the absolute-cosine + absolute-sine projection.
      const w = def.bbox.width * element.scale;
      const h = def.bbox.height * element.scale;
      const cos = Math.abs(Math.cos(element.rotation));
      const sin = Math.abs(Math.sin(element.rotation));
      const aw = w * cos + h * sin;
      const ah = w * sin + h * cos;
      return {
        x: element.position.x - aw / 2,
        y: element.position.y - ah / 2,
        width: aw,
        height: ah,
      };
    }
    case 'freehand': {
      const xs = element.points.map(p => p.x);
      const ys = element.points.map(p => p.y);
      const minX = Math.min(...xs);
      const minY = Math.min(...ys);
      return { x: minX, y: minY, width: Math.max(...xs) - minX, height: Math.max(...ys) - minY };
    }
    case 'polyline': {
      const xs = element.points.map(p => p.x);
      const ys = element.points.map(p => p.y);
      const minX = Math.min(...xs);
      const minY = Math.min(...ys);
      return { x: minX, y: minY, width: Math.max(...xs) - minX, height: Math.max(...ys) - minY };
    }
    case 'spline': {
      // Bounding box of the sampled curve, not just the control points
      // — Catmull-Rom can overshoot control points slightly.
      const pts = sampleSpline(element.controlPoints, !!element.closed, element.tension, 12);
      const xs = pts.map(p => p.x);
      const ys = pts.map(p => p.y);
      const minX = Math.min(...xs);
      const minY = Math.min(...ys);
      return { x: minX, y: minY, width: Math.max(...xs) - minX, height: Math.max(...ys) - minY };
    }
    case 'flowchart-shape':
    case 'container':
      return { x: element.origin.x, y: element.origin.y, width: element.width, height: element.height };
    case 'connector': {
      if (!element.cachedPath || element.cachedPath.length === 0) return { x: 0, y: 0, width: 0, height: 0 };
      const xs = element.cachedPath.map((p) => p.x);
      const ys = element.cachedPath.map((p) => p.y);
      const minX = Math.min(...xs);
      const minY = Math.min(...ys);
      return { x: minX, y: minY, width: Math.max(...xs) - minX, height: Math.max(...ys) - minY };
    }
    default:
      return { x: 0, y: 0, width: 0, height: 0 };
  }
}
