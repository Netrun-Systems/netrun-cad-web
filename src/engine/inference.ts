/**
 * Smart inference engine for CAD drawing assistance.
 * Provides axis-aligned inference lines, snap indicators, and dynamic measurements.
 */
import type { Point, CADElement, CADLine, CADRectangle, CADCircle, GridSettings } from './types';
import { distance, midpoint, formatMeasurement } from './geometry';

// ── Inference line types ──────────────────────────────────────────────────

export type InferenceAxis = 'red' | 'green' | 'blue' | 'cyan';

export interface InferenceLine {
  /** Axis color category */
  axis: InferenceAxis;
  /** Start point of the infinite line (viewport edge) */
  from: Point;
  /** End point of the infinite line (viewport edge) */
  to: Point;
  /** Label to display at cursor */
  label: string;
  /** The snapped point on this inference line (closest to cursor) */
  snapPoint: Point;
}

// ── Snap indicator types ──────────────────────────────────────────────────

export type SnapType = 'endpoint' | 'midpoint' | 'intersection' | 'center';

export interface SnapIndicator {
  point: Point;
  type: SnapType;
  label: string;
}

// ── Angle tolerance (degrees) ─────────────────────────────────────────────

const ANGLE_TOLERANCE_DEG = 2;
const ANGLE_TOLERANCE_RAD = (ANGLE_TOLERANCE_DEG * Math.PI) / 180;

/** Normalize angle to [0, 2PI) */
function normalizeAngle(a: number): number {
  let r = a % (Math.PI * 2);
  if (r < 0) r += Math.PI * 2;
  return r;
}

/** Check if angle is within tolerance of a target */
function nearAngle(angleDeg: number, targetDeg: number, toleranceDeg: number): boolean {
  let diff = ((angleDeg - targetDeg) % 360 + 540) % 360 - 180;
  return Math.abs(diff) <= toleranceDeg;
}

// ── Inference line computation ────────────────────────────────────────────

/**
 * Compute inference lines for the current drawing operation.
 * @param startPoint The first click point (anchor)
 * @param cursorPoint Current cursor position
 * @param viewportWidth Canvas width in world coords
 * @param viewportHeight Canvas height in world coords
 * @param elements Existing elements (for alignment inference)
 * @param snapDistance Distance threshold for alignment snap
 */
export function computeInferenceLines(
  startPoint: Point,
  cursorPoint: Point,
  viewportWidth: number,
  viewportHeight: number,
  elements: CADElement[],
  snapDistance: number
): InferenceLine[] {
  const lines: InferenceLine[] = [];
  const dx = cursorPoint.x - startPoint.x;
  const dy = cursorPoint.y - startPoint.y;
  const angleDeg = (Math.atan2(dy, dx) * 180) / Math.PI;
  const len = Math.sqrt(dx * dx + dy * dy);

  if (len < 1) return lines;

  // The extent for drawing inference lines (large enough to cross viewport)
  const extent = Math.max(viewportWidth, viewportHeight) * 2;

  // ── Horizontal (Red axis) ────────────────────────────────────────────
  if (nearAngle(angleDeg, 0, ANGLE_TOLERANCE_DEG) || nearAngle(angleDeg, 180, ANGLE_TOLERANCE_DEG)) {
    const snapPt: Point = { x: cursorPoint.x, y: startPoint.y };
    lines.push({
      axis: 'red',
      from: { x: startPoint.x - extent, y: startPoint.y },
      to: { x: startPoint.x + extent, y: startPoint.y },
      label: 'On Red Axis',
      snapPoint: snapPt,
    });
  }

  // ── Vertical (Green axis) ────────────────────────────────────────────
  if (nearAngle(angleDeg, 90, ANGLE_TOLERANCE_DEG) || nearAngle(angleDeg, -90, ANGLE_TOLERANCE_DEG) ||
      nearAngle(angleDeg, 270, ANGLE_TOLERANCE_DEG)) {
    const snapPt: Point = { x: startPoint.x, y: cursorPoint.y };
    lines.push({
      axis: 'green',
      from: { x: startPoint.x, y: startPoint.y - extent },
      to: { x: startPoint.x, y: startPoint.y + extent },
      label: 'On Green Axis',
      snapPoint: snapPt,
    });
  }

  // ── 45-degree angles (Blue axis) ─────────────────────────────────────
  const blueAngles = [45, 135, 225, 315, -45, -135];
  for (const target of blueAngles) {
    if (nearAngle(angleDeg, target, ANGLE_TOLERANCE_DEG)) {
      const rad = (target * Math.PI) / 180;
      const cos = Math.cos(rad);
      const sin = Math.sin(rad);
      // Project cursor onto 45deg line from start
      const projLen = dx * cos + dy * sin;
      const snapPt: Point = {
        x: startPoint.x + cos * projLen,
        y: startPoint.y + sin * projLen,
      };
      lines.push({
        axis: 'blue',
        from: { x: startPoint.x - cos * extent, y: startPoint.y - sin * extent },
        to: { x: startPoint.x + cos * extent, y: startPoint.y + sin * extent },
        label: `${Math.abs(target)}°`,
        snapPoint: snapPt,
      });
      break; // Only one blue inference at a time
    }
  }

  // ── Alignment to existing endpoints (Cyan axis) ──────────────────────
  const endpoints = collectEndpoints(elements);
  for (const ep of endpoints) {
    // Check if cursor is aligned horizontally with this endpoint
    if (Math.abs(cursorPoint.y - ep.y) < snapDistance && ep !== startPoint) {
      const snapPt: Point = { x: cursorPoint.x, y: ep.y };
      lines.push({
        axis: 'cyan',
        from: { x: ep.x, y: ep.y },
        to: { x: cursorPoint.x, y: ep.y },
        label: 'Aligned',
        snapPoint: snapPt,
      });
    }
    // Check vertical alignment
    if (Math.abs(cursorPoint.x - ep.x) < snapDistance && ep !== startPoint) {
      const snapPt: Point = { x: ep.x, y: cursorPoint.y };
      lines.push({
        axis: 'cyan',
        from: { x: ep.x, y: ep.y },
        to: { x: ep.x, y: cursorPoint.y },
        label: 'Aligned',
        snapPoint: snapPt,
      });
    }
  }

  return lines;
}

// ── Snap indicator computation ────────────────────────────────────────────

/**
 * Find the nearest snap point within threshold.
 * Checks endpoints, midpoints, and circle centers of visible elements.
 */
export function findSnapIndicator(
  cursorPoint: Point,
  elements: CADElement[],
  snapDistance: number
): SnapIndicator | null {
  let best: SnapIndicator | null = null;
  let bestDist = snapDistance;

  for (const el of elements) {
    if (el.id === '__preview__') continue;

    switch (el.type) {
      case 'line': {
        // Endpoints
        const d1 = distance(cursorPoint, el.p1);
        if (d1 < bestDist) {
          bestDist = d1;
          best = { point: el.p1, type: 'endpoint', label: 'Endpoint' };
        }
        const d2 = distance(cursorPoint, el.p2);
        if (d2 < bestDist) {
          bestDist = d2;
          best = { point: el.p2, type: 'endpoint', label: 'Endpoint' };
        }
        // Midpoint
        const mid = midpoint(el.p1, el.p2);
        const dm = distance(cursorPoint, mid);
        if (dm < bestDist) {
          bestDist = dm;
          best = { point: mid, type: 'midpoint', label: 'Midpoint' };
        }
        break;
      }
      case 'rectangle': {
        // Four corners
        const corners: Point[] = [
          el.origin,
          { x: el.origin.x + el.width, y: el.origin.y },
          { x: el.origin.x + el.width, y: el.origin.y + el.height },
          { x: el.origin.x, y: el.origin.y + el.height },
        ];
        for (const c of corners) {
          const dc = distance(cursorPoint, c);
          if (dc < bestDist) {
            bestDist = dc;
            best = { point: c, type: 'endpoint', label: 'Endpoint' };
          }
        }
        // Midpoints of edges
        for (let i = 0; i < corners.length; i++) {
          const mid = midpoint(corners[i], corners[(i + 1) % corners.length]);
          const dm = distance(cursorPoint, mid);
          if (dm < bestDist) {
            bestDist = dm;
            best = { point: mid, type: 'midpoint', label: 'Midpoint' };
          }
        }
        break;
      }
      case 'circle': {
        // Center
        const dc = distance(cursorPoint, el.center);
        if (dc < bestDist) {
          bestDist = dc;
          best = { point: el.center, type: 'center', label: 'Center' };
        }
        // Quadrant points (N/S/E/W)
        const quads: Point[] = [
          { x: el.center.x + el.radius, y: el.center.y },
          { x: el.center.x - el.radius, y: el.center.y },
          { x: el.center.x, y: el.center.y + el.radius },
          { x: el.center.x, y: el.center.y - el.radius },
        ];
        for (const q of quads) {
          const dq = distance(cursorPoint, q);
          if (dq < bestDist) {
            bestDist = dq;
            best = { point: q, type: 'endpoint', label: 'Quadrant' };
          }
        }
        break;
      }
    }
  }

  return best;
}

// ── Helper: collect all element endpoints ─────────────────────────────────

function collectEndpoints(elements: CADElement[]): Point[] {
  const pts: Point[] = [];
  for (const el of elements) {
    if (el.id === '__preview__') continue;
    switch (el.type) {
      case 'line':
        pts.push(el.p1, el.p2);
        break;
      case 'rectangle':
        pts.push(el.origin);
        pts.push({ x: el.origin.x + el.width, y: el.origin.y });
        pts.push({ x: el.origin.x + el.width, y: el.origin.y + el.height });
        pts.push({ x: el.origin.x, y: el.origin.y + el.height });
        break;
      case 'circle':
        pts.push(el.center);
        break;
    }
  }
  return pts;
}

// ── Render inference lines onto canvas ────────────────────────────────────

const AXIS_COLORS: Record<InferenceAxis, string> = {
  red: '#ff4444',
  green: '#44ff44',
  blue: '#4488ff',
  cyan: '#00cccc',
};

export function renderInferenceLines(
  ctx: CanvasRenderingContext2D,
  lines: InferenceLine[],
  cursorPoint: Point,
  zoom: number
) {
  for (const line of lines) {
    ctx.save();
    ctx.strokeStyle = AXIS_COLORS[line.axis];
    ctx.lineWidth = 1 / zoom;
    ctx.setLineDash([6 / zoom, 4 / zoom]);
    ctx.globalAlpha = 0.6;
    ctx.beginPath();
    ctx.moveTo(line.from.x, line.from.y);
    ctx.lineTo(line.to.x, line.to.y);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();
  }

  // Draw label tooltip at cursor for the first inference line
  if (lines.length > 0) {
    const label = lines[0].label;
    const fontSize = 11 / zoom;
    ctx.save();
    ctx.font = `${fontSize}px monospace`;
    const textWidth = ctx.measureText(label).width;
    const padX = 4 / zoom;
    const padY = 2 / zoom;
    const offsetX = 18 / zoom;
    const offsetY = -18 / zoom;
    const tx = cursorPoint.x + offsetX;
    const ty = cursorPoint.y + offsetY;

    // Background
    ctx.fillStyle = 'rgba(0, 0, 0, 0.75)';
    ctx.fillRect(tx - padX, ty - fontSize - padY, textWidth + padX * 2, fontSize + padY * 2);

    // Text
    ctx.fillStyle = AXIS_COLORS[lines[0].axis];
    ctx.textBaseline = 'bottom';
    ctx.fillText(label, tx, ty);
    ctx.restore();
  }
}

// ── Render snap indicators ────────────────────────────────────────────────

export function renderSnapIndicator(
  ctx: CanvasRenderingContext2D,
  snap: SnapIndicator,
  zoom: number
) {
  const size = 4 / zoom;
  const { point, type, label } = snap;

  ctx.save();
  ctx.strokeStyle = '#44ff44';
  ctx.fillStyle = '#44ff44';
  ctx.lineWidth = 1.5 / zoom;

  switch (type) {
    case 'endpoint': {
      // Green square
      ctx.strokeRect(point.x - size, point.y - size, size * 2, size * 2);
      break;
    }
    case 'midpoint': {
      // Green triangle
      ctx.beginPath();
      ctx.moveTo(point.x, point.y - size);
      ctx.lineTo(point.x + size, point.y + size);
      ctx.lineTo(point.x - size, point.y + size);
      ctx.closePath();
      ctx.stroke();
      break;
    }
    case 'intersection': {
      // Green X
      ctx.beginPath();
      ctx.moveTo(point.x - size, point.y - size);
      ctx.lineTo(point.x + size, point.y + size);
      ctx.moveTo(point.x + size, point.y - size);
      ctx.lineTo(point.x - size, point.y + size);
      ctx.stroke();
      break;
    }
    case 'center': {
      // Circle with crosshair
      ctx.beginPath();
      ctx.arc(point.x, point.y, size, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(point.x - size * 1.5, point.y);
      ctx.lineTo(point.x + size * 1.5, point.y);
      ctx.moveTo(point.x, point.y - size * 1.5);
      ctx.lineTo(point.x, point.y + size * 1.5);
      ctx.stroke();
      break;
    }
  }

  // Label text
  const fontSize = 9 / zoom;
  ctx.font = `${fontSize}px monospace`;
  ctx.fillStyle = '#44ff44';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.fillText(label, point.x, point.y + size + 2 / zoom);
  ctx.restore();
}

// ── Render dynamic length display at cursor ───────────────────────────────

export function renderCursorMeasurement(
  ctx: CanvasRenderingContext2D,
  startPoint: Point,
  cursorPoint: Point,
  toolType: 'line' | 'rectangle' | 'circle',
  grid: GridSettings,
  zoom: number
) {
  const fontSize = 12 / zoom;
  const offsetX = 15 / zoom;
  const offsetY = 15 / zoom;

  let label: string;

  switch (toolType) {
    case 'line': {
      const dist = distance(startPoint, cursorPoint);
      label = formatMeasurement(dist, grid);
      break;
    }
    case 'rectangle': {
      const w = Math.abs(cursorPoint.x - startPoint.x);
      const h = Math.abs(cursorPoint.y - startPoint.y);
      label = `${formatMeasurement(w, grid)} x ${formatMeasurement(h, grid)}`;
      break;
    }
    case 'circle': {
      const r = distance(startPoint, cursorPoint);
      label = `r: ${formatMeasurement(r, grid)}`;
      break;
    }
    default:
      return;
  }

  const tx = cursorPoint.x + offsetX;
  const ty = cursorPoint.y + offsetY;

  ctx.save();
  ctx.font = `${fontSize}px monospace`;
  const textWidth = ctx.measureText(label).width;
  const padX = 4 / zoom;
  const padY = 2 / zoom;

  // Semi-transparent dark background
  ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
  ctx.fillRect(tx - padX, ty - padY, textWidth + padX * 2, fontSize + padY * 2);

  // White text
  ctx.fillStyle = '#ffffff';
  ctx.textBaseline = 'top';
  ctx.textAlign = 'left';
  ctx.fillText(label, tx, ty);
  ctx.restore();
}
