/**
 * Catmull-Rom spline math.
 *
 * A Catmull-Rom curve passes THROUGH every control point (unlike pure
 * Bezier where the middle points only influence the curve). For each
 * segment between p1 and p2, the curve shape is also influenced by the
 * neighboring p0 and p3.
 *
 * The conversion to cubic Bezier control points means the renderer can
 * just call ctx.bezierCurveTo per segment — no per-pixel sampling needed
 * for the canvas case. Sampling is still useful for hit-testing and DXF
 * export (DXF SPLINE entities are involved; we approximate via polyline).
 */

import type { Point } from './types';

const DEFAULT_TENSION = 0.5;

/**
 * Convert a single Catmull-Rom segment (p1 → p2 with p0 and p3 as
 * neighbors) into the four control points of an equivalent cubic Bezier.
 * Returns [b0, b1, b2, b3] suitable for ctx.bezierCurveTo(b1, b2, b3)
 * after a moveTo(b0).
 */
export function catmullRomToBezier(
  p0: Point, p1: Point, p2: Point, p3: Point,
  tension = DEFAULT_TENSION,
): [Point, Point, Point, Point] {
  const k = (1 - tension) / 6;
  return [
    p1,
    { x: p1.x + (p2.x - p0.x) * k, y: p1.y + (p2.y - p0.y) * k },
    { x: p2.x - (p3.x - p1.x) * k, y: p2.y - (p3.y - p1.y) * k },
    p2,
  ];
}

/**
 * Generate Bezier segments for a full Catmull-Rom spline.
 * For an open spline of N control points, produces N-1 segments;
 * for a closed spline, produces N segments wrapping around.
 *
 * Endpoints (open spline): the missing neighbors are reflected through
 * the endpoint — p[-1] = 2·p0 - p1, and p[N] = 2·p[N-1] - p[N-2].
 * This gives a natural-looking open curve.
 */
export function splineToBezierSegments(
  controlPoints: Point[],
  closed = false,
  tension = DEFAULT_TENSION,
): Array<[Point, Point, Point, Point]> {
  const n = controlPoints.length;
  if (n < 2) return [];
  if (n === 2) {
    // Degenerate case — straight line. One segment with control points
    // colinear so the cubic collapses to a line.
    const a = controlPoints[0];
    const b = controlPoints[1];
    return [[
      a,
      { x: a.x + (b.x - a.x) / 3, y: a.y + (b.y - a.y) / 3 },
      { x: a.x + (b.x - a.x) * 2 / 3, y: a.y + (b.y - a.y) * 2 / 3 },
      b,
    ]];
  }
  const segments: Array<[Point, Point, Point, Point]> = [];
  const segCount = closed ? n : n - 1;
  for (let i = 0; i < segCount; i++) {
    const p1 = controlPoints[i];
    const p2 = controlPoints[(i + 1) % n];
    const p0 = closed
      ? controlPoints[(i - 1 + n) % n]
      : i > 0
        ? controlPoints[i - 1]
        : { x: 2 * p1.x - p2.x, y: 2 * p1.y - p2.y };
    const p3 = closed
      ? controlPoints[(i + 2) % n]
      : i + 2 < n
        ? controlPoints[i + 2]
        : { x: 2 * p2.x - p1.x, y: 2 * p2.y - p1.y };
    segments.push(catmullRomToBezier(p0, p1, p2, p3, tension));
  }
  return segments;
}

/** Sample a single Bezier segment at parameter t ∈ [0,1]. */
function bezierAt(b0: Point, b1: Point, b2: Point, b3: Point, t: number): Point {
  const u = 1 - t;
  const uu = u * u;
  const uuu = uu * u;
  const tt = t * t;
  const ttt = tt * t;
  return {
    x: uuu * b0.x + 3 * uu * t * b1.x + 3 * u * tt * b2.x + ttt * b3.x,
    y: uuu * b0.y + 3 * uu * t * b1.y + 3 * u * tt * b2.y + ttt * b3.y,
  };
}

/**
 * Sample the spline as a series of points. Used for hit-testing and
 * DXF export. `samplesPerSegment` controls smoothness — 16 is a good
 * compromise between detail and file size.
 */
export function sampleSpline(
  controlPoints: Point[],
  closed = false,
  tension = DEFAULT_TENSION,
  samplesPerSegment = 16,
): Point[] {
  const segments = splineToBezierSegments(controlPoints, closed, tension);
  if (segments.length === 0) return controlPoints.slice();
  const out: Point[] = [segments[0][0]];
  for (const [b0, b1, b2, b3] of segments) {
    for (let i = 1; i <= samplesPerSegment; i++) {
      const t = i / samplesPerSegment;
      out.push(bezierAt(b0, b1, b2, b3, t));
    }
  }
  return out;
}
