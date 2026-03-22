import type { Point, GridSettings } from './types';

/** Euclidean distance between two points */
export function distance(a: Point, b: Point): number {
  return Math.sqrt((b.x - a.x) ** 2 + (b.y - a.y) ** 2);
}

/** Snap a point to the nearest grid intersection */
export function snapToGrid(point: Point, grid: GridSettings): Point {
  if (!grid.snap) return point;
  const s = grid.snapSize;
  return {
    x: Math.round(point.x / s) * s,
    y: Math.round(point.y / s) * s,
  };
}

/** Convert pixel distance to real-world units */
export function pixelsToUnits(px: number, grid: GridSettings): number {
  return px / grid.pixelsPerUnit;
}

/** Format a measurement with units */
export function formatMeasurement(px: number, grid: GridSettings): string {
  const value = pixelsToUnits(px, grid);
  if (grid.unit === 'ft') {
    const feet = Math.floor(value);
    const inches = Math.round((value - feet) * 12);
    if (inches === 0) return `${feet}'`;
    if (feet === 0) return `${inches}"`;
    return `${feet}'-${inches}"`;
  }
  return `${value.toFixed(1)} ${grid.unit}`;
}

/** Find the midpoint between two points */
export function midpoint(a: Point, b: Point): Point {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

/** Angle in radians from a to b */
export function angle(a: Point, b: Point): number {
  return Math.atan2(b.y - a.y, b.x - a.x);
}

/** Check if a point is near a line segment (within threshold) */
export function pointNearLine(
  p: Point,
  lineStart: Point,
  lineEnd: Point,
  threshold: number
): boolean {
  const len = distance(lineStart, lineEnd);
  if (len === 0) return distance(p, lineStart) <= threshold;

  let t =
    ((p.x - lineStart.x) * (lineEnd.x - lineStart.x) +
      (p.y - lineStart.y) * (lineEnd.y - lineStart.y)) /
    (len * len);
  t = Math.max(0, Math.min(1, t));

  const proj: Point = {
    x: lineStart.x + t * (lineEnd.x - lineStart.x),
    y: lineStart.y + t * (lineEnd.y - lineStart.y),
  };

  return distance(p, proj) <= threshold;
}

/** Check if point is inside a rectangle */
export function pointInRect(
  p: Point,
  origin: Point,
  width: number,
  height: number
): boolean {
  return (
    p.x >= origin.x &&
    p.x <= origin.x + width &&
    p.y >= origin.y &&
    p.y <= origin.y + height
  );
}

/** Check if point is near a circle's edge */
export function pointNearCircle(
  p: Point,
  center: Point,
  radius: number,
  threshold: number
): boolean {
  const d = distance(p, center);
  return Math.abs(d - radius) <= threshold;
}
