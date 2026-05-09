import type { FlowchartShapeKind, Point, ConnectorAnchor } from './types';

interface ShapeBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Anchor point for a connector to attach to a shape boundary. */
export function shapeAnchorPoint(box: ShapeBox, anchor: ConnectorAnchor, shape: FlowchartShapeKind): Point {
  const cx = box.x + box.width / 2;
  const cy = box.y + box.height / 2;

  if (anchor === 'auto' || anchor === undefined) {
    return { x: cx, y: cy };
  }

  switch (anchor) {
    case 'top':
      return { x: cx, y: box.y };
    case 'right':
      return { x: box.x + box.width, y: cy };
    case 'bottom':
      return { x: cx, y: box.y + box.height };
    case 'left':
      return { x: box.x, y: cy };
  }

  // Shape-specific anchor adjustments could go here (diamond uses different points,
  // ellipse intersects at the boundary). For MVP we treat all shapes as bounding-box.
  void shape;
  return { x: cx, y: cy };
}

/** Choose the best anchor side on `from` facing `to` (and vice versa). */
export function autoAnchor(fromBox: ShapeBox, toBox: ShapeBox): { from: ConnectorAnchor; to: ConnectorAnchor } {
  const fromCx = fromBox.x + fromBox.width / 2;
  const fromCy = fromBox.y + fromBox.height / 2;
  const toCx = toBox.x + toBox.width / 2;
  const toCy = toBox.y + toBox.height / 2;
  const dx = toCx - fromCx;
  const dy = toCy - fromCy;

  let from: ConnectorAnchor;
  let to: ConnectorAnchor;
  if (Math.abs(dx) >= Math.abs(dy)) {
    from = dx >= 0 ? 'right' : 'left';
    to = dx >= 0 ? 'left' : 'right';
  } else {
    from = dy >= 0 ? 'bottom' : 'top';
    to = dy >= 0 ? 'top' : 'bottom';
  }
  return { from, to };
}

/** Test whether a point falls inside the visible body of a flowchart shape (not just bounding box). */
export function pointInShape(p: Point, box: ShapeBox, shape: FlowchartShapeKind): boolean {
  if (p.x < box.x || p.x > box.x + box.width || p.y < box.y || p.y > box.y + box.height) {
    return false;
  }
  switch (shape) {
    case 'rectangle':
    case 'rounded':
      return true;
    case 'ellipse': {
      const rx = box.width / 2;
      const ry = box.height / 2;
      const dx = (p.x - (box.x + rx)) / rx;
      const dy = (p.y - (box.y + ry)) / ry;
      return dx * dx + dy * dy <= 1;
    }
    case 'diamond': {
      const cx = box.x + box.width / 2;
      const cy = box.y + box.height / 2;
      const rx = box.width / 2;
      const ry = box.height / 2;
      return Math.abs(p.x - cx) / rx + Math.abs(p.y - cy) / ry <= 1;
    }
    case 'parallelogram': {
      const skew = box.width * 0.2;
      const t = (p.y - box.y) / box.height;
      const leftEdge = box.x + skew * (1 - t);
      const rightEdge = box.x + box.width - skew * t;
      return p.x >= leftEdge && p.x <= rightEdge;
    }
    case 'hexagon': {
      const inset = box.width * 0.15;
      const t = Math.min(p.y - box.y, box.y + box.height - p.y);
      const halfWidth = (box.width - inset * 2) + (inset * 2 * Math.min(t, box.height / 2)) / (box.height / 2);
      const cx = box.x + box.width / 2;
      return Math.abs(p.x - cx) <= halfWidth / 2;
    }
    case 'cylinder':
      return true;
  }
}

/** Default styles for a freshly-placed flowchart shape. */
export const DEFAULT_SHAPE_FILL = '#dbeafe';
export const DEFAULT_SHAPE_STROKE = '#1e3a8a';
export const DEFAULT_SHAPE_TEXT = '#0f172a';
export const DEFAULT_CONNECTOR_STROKE = '#334155';
export const DEFAULT_CONTAINER_FILL = '#f3f4f6';
export const DEFAULT_CONTAINER_STROKE = '#6b7280';
