import type { CADElement, Connector, FlowchartShape, Point, ConnectorAnchor } from './types';
import { autoAnchor, shapeAnchorPoint } from './diagram-shapes';

const PROJECT = 20;

interface Box { x: number; y: number; width: number; height: number }

function findShape(elements: CADElement[], id: string): FlowchartShape | null {
  for (const el of elements) {
    if (el.type === 'flowchart-shape' && el.id === id) return el;
  }
  return null;
}

function shapeBox(shape: FlowchartShape): Box {
  return { x: shape.origin.x, y: shape.origin.y, width: shape.width, height: shape.height };
}

function projectFromAnchor(p: Point, anchor: ConnectorAnchor, dist = PROJECT): Point {
  switch (anchor) {
    case 'top': return { x: p.x, y: p.y - dist };
    case 'right': return { x: p.x + dist, y: p.y };
    case 'bottom': return { x: p.x, y: p.y + dist };
    case 'left': return { x: p.x - dist, y: p.y };
    default: return p;
  }
}

function isHorizontal(anchor: ConnectorAnchor): boolean {
  return anchor === 'left' || anchor === 'right';
}

function routeOrthogonal(
  fromAnchorPt: Point,
  toAnchorPt: Point,
  fromAnchor: ConnectorAnchor,
  toAnchor: ConnectorAnchor
): Point[] {
  const fromExit = projectFromAnchor(fromAnchorPt, fromAnchor);
  const toExit = projectFromAnchor(toAnchorPt, toAnchor);

  const fromH = isHorizontal(fromAnchor);
  const toH = isHorizontal(toAnchor);

  const path: Point[] = [fromAnchorPt, fromExit];

  if (fromH === toH) {
    if (fromH) {
      const midX = (fromExit.x + toExit.x) / 2;
      path.push({ x: midX, y: fromExit.y });
      path.push({ x: midX, y: toExit.y });
    } else {
      const midY = (fromExit.y + toExit.y) / 2;
      path.push({ x: fromExit.x, y: midY });
      path.push({ x: toExit.x, y: midY });
    }
  } else {
    if (fromH) {
      path.push({ x: toExit.x, y: fromExit.y });
    } else {
      path.push({ x: fromExit.x, y: toExit.y });
    }
  }

  path.push(toExit);
  path.push(toAnchorPt);
  return dedupePath(path);
}

function dedupePath(points: Point[]): Point[] {
  const out: Point[] = [];
  for (const p of points) {
    const last = out[out.length - 1];
    if (!last || Math.abs(last.x - p.x) > 0.01 || Math.abs(last.y - p.y) > 0.01) {
      out.push(p);
    }
  }
  return out;
}

function routeStraight(from: Point, to: Point): Point[] {
  return [from, to];
}

/** Compute (and cache) a connector's path based on the current positions of its endpoint shapes. */
export function routeConnector(connector: Connector, elements: CADElement[]): Connector {
  const fromShape = findShape(elements, connector.fromShapeId);
  const toShape = findShape(elements, connector.toShapeId);
  if (!fromShape || !toShape) {
    return { ...connector, cachedPath: undefined };
  }

  const fromBox = shapeBox(fromShape);
  const toBox = shapeBox(toShape);

  let fromAnchor = connector.fromAnchor ?? 'auto';
  let toAnchor = connector.toAnchor ?? 'auto';
  if (fromAnchor === 'auto' || toAnchor === 'auto') {
    const auto = autoAnchor(fromBox, toBox);
    if (fromAnchor === 'auto') fromAnchor = auto.from;
    if (toAnchor === 'auto') toAnchor = auto.to;
  }

  const fromAnchorPt = shapeAnchorPoint(fromBox, fromAnchor, fromShape.shape);
  const toAnchorPt = shapeAnchorPoint(toBox, toAnchor, toShape.shape);

  let path: Point[];
  switch (connector.routing) {
    case 'orthogonal':
      path = routeOrthogonal(fromAnchorPt, toAnchorPt, fromAnchor, toAnchor);
      break;
    case 'straight':
    default:
      path = routeStraight(fromAnchorPt, toAnchorPt);
      break;
  }
  return { ...connector, cachedPath: path };
}

/** Re-route every connector that has either endpoint among the moved shape ids. */
export function reRouteConnectors(elements: CADElement[], movedShapeIds: Set<string>): CADElement[] {
  return elements.map((el) => {
    if (el.type !== 'connector') return el;
    if (movedShapeIds.has(el.fromShapeId) || movedShapeIds.has(el.toShapeId)) {
      return routeConnector(el, elements);
    }
    return el;
  });
}
