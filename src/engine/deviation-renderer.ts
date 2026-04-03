// Converts Survai API deviation results into CAD elements for 2D canvas rendering

import type { CADElement, CADLine, CADCircle, TextElement } from './types';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface DeviationReport {
  deviations: DeviationEntry[];
}

export interface DeviationEntry {
  id: string;
  deviation_type: 'MATCH' | 'POSITION_DEVIATION' | 'TYPE_MISMATCH' | 'MISSING_IN_SCAN' | 'EXTRA_IN_SCAN';
  severity: 'OK' | 'WARNING' | 'CRITICAL';
  distance_mm: number;
  planned_position?: [number, number] | null;
  actual_position?: [number, number, number] | null;
  planned_type?: string | null;
  actual_type?: string | null;
  message: string;
}

// ─── Constants ───────────────────────────────────────────────────────────────

const PIXELS_PER_FOOT = 48; // must match DEFAULT_GRID.pixelsPerUnit
const METERS_TO_FEET = 3.28084;
const DEVIATION_LAYER = 'deviations';

const COLORS = {
  critical: '#ef4444',
  warning: '#eab308',
  ok: '#22c55e',
  orange: '#f97316',
} as const;

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Convert meters to canvas pixels */
function metersToPixels(m: number, scaleFactor: number): number {
  return m * METERS_TO_FEET * PIXELS_PER_FOOT * scaleFactor;
}

/** Project a 2D or 3D position (meters) to canvas Point (pixels) */
function toCanvasPoint(
  pos: [number, number] | [number, number, number],
  scaleFactor: number,
): { x: number; y: number } {
  // For 3D positions, project XZ plane (index 0 = X, index 2 = Z)
  // For 2D positions, use X and Y directly
  const x = pos[0];
  const y = pos.length === 3 ? pos[2] : pos[1];
  return {
    x: metersToPixels(x, scaleFactor),
    y: metersToPixels(y, scaleFactor),
  };
}

function severityColor(severity: 'OK' | 'WARNING' | 'CRITICAL'): string {
  switch (severity) {
    case 'CRITICAL': return COLORS.critical;
    case 'WARNING': return COLORS.warning;
    case 'OK': return COLORS.ok;
  }
}

// ─── Main Converter ──────────────────────────────────────────────────────────

/**
 * Convert a DeviationReport from the Survai API into CADElements
 * that can be rendered on the 2D canvas.
 *
 * Positions in the API response are in meters. They are converted
 * to canvas pixels using: meters * 3.28084 * PIXELS_PER_FOOT * scaleFactor
 */
export function deviationsToElements(
  report: DeviationReport,
  options?: { scaleFactor?: number },
): CADElement[] {
  const scale = options?.scaleFactor ?? 1;
  const elements: CADElement[] = [];

  for (const d of report.deviations) {
    switch (d.deviation_type) {

      // ── MATCH: small green circle (low priority, skip if no position) ──
      case 'MATCH': {
        if (!d.actual_position) break;
        const pt = toCanvasPoint(d.actual_position, scale);
        const circle: CADCircle = {
          type: 'circle',
          id: `deviation-${d.id}-match`,
          center: pt,
          radius: 4,
          layerId: DEVIATION_LAYER,
          strokeColor: COLORS.ok,
          strokeWidth: 1,
        };
        elements.push(circle);
        break;
      }

      // ── POSITION_DEVIATION: line from planned→actual + distance label ──
      case 'POSITION_DEVIATION': {
        if (!d.planned_position || !d.actual_position) break;
        const p1 = toCanvasPoint(d.planned_position, scale);
        const p2 = toCanvasPoint(d.actual_position, scale);
        const color = severityColor(d.severity);

        const line: CADLine = {
          type: 'line',
          id: `deviation-${d.id}-line`,
          p1,
          p2,
          layerId: DEVIATION_LAYER,
          strokeColor: color,
          strokeWidth: 2,
        };
        elements.push(line);

        const label: TextElement = {
          type: 'text',
          id: `deviation-${d.id}-label`,
          position: {
            x: (p1.x + p2.x) / 2,
            y: (p1.y + p2.y) / 2 - 10,
          },
          content: `${Math.round(d.distance_mm)} mm`,
          layerId: DEVIATION_LAYER,
          fontSize: 11,
          fontFamily: 'monospace',
          color,
          rotation: 0,
        };
        elements.push(label);
        break;
      }

      // ── TYPE_MISMATCH: circle at position + plan/actual label ──
      case 'TYPE_MISMATCH': {
        const pos = d.actual_position
          ? toCanvasPoint(d.actual_position, scale)
          : d.planned_position
            ? toCanvasPoint(d.planned_position, scale)
            : null;
        if (!pos) break;

        const circle: CADCircle = {
          type: 'circle',
          id: `deviation-${d.id}-circle`,
          center: pos,
          radius: 10,
          layerId: DEVIATION_LAYER,
          strokeColor: COLORS.warning,
          strokeWidth: 2,
        };
        elements.push(circle);

        const label: TextElement = {
          type: 'text',
          id: `deviation-${d.id}-label`,
          position: { x: pos.x + 14, y: pos.y - 6 },
          content: `Plan: ${d.planned_type ?? '?'} / Actual: ${d.actual_type ?? '?'}`,
          layerId: DEVIATION_LAYER,
          fontSize: 10,
          fontFamily: 'monospace',
          color: COLORS.warning,
          rotation: 0,
        };
        elements.push(label);
        break;
      }

      // ── MISSING_IN_SCAN: dashed circle at planned position ──
      case 'MISSING_IN_SCAN': {
        if (!d.planned_position) break;
        const pos = toCanvasPoint(d.planned_position, scale);

        const circle: CADCircle = {
          type: 'circle',
          id: `deviation-${d.id}-circle`,
          center: pos,
          radius: 10,
          layerId: DEVIATION_LAYER,
          strokeColor: COLORS.critical,
          strokeWidth: 2,
          metadata: { dashPattern: [6, 4] },
        };
        elements.push(circle);

        const label: TextElement = {
          type: 'text',
          id: `deviation-${d.id}-label`,
          position: { x: pos.x + 14, y: pos.y - 6 },
          content: `MISSING: ${d.planned_type ?? 'unknown'}`,
          layerId: DEVIATION_LAYER,
          fontSize: 10,
          fontFamily: 'monospace',
          color: COLORS.critical,
          rotation: 0,
        };
        elements.push(label);
        break;
      }

      // ── EXTRA_IN_SCAN: circle at actual position (XZ projected) ──
      case 'EXTRA_IN_SCAN': {
        if (!d.actual_position) break;
        const pos = toCanvasPoint(d.actual_position, scale);

        const circle: CADCircle = {
          type: 'circle',
          id: `deviation-${d.id}-circle`,
          center: pos,
          radius: 10,
          layerId: DEVIATION_LAYER,
          strokeColor: COLORS.orange,
          strokeWidth: 2,
        };
        elements.push(circle);

        const label: TextElement = {
          type: 'text',
          id: `deviation-${d.id}-label`,
          position: { x: pos.x + 14, y: pos.y - 6 },
          content: `EXTRA: ${d.actual_type ?? 'unknown'}`,
          layerId: DEVIATION_LAYER,
          fontSize: 10,
          fontFamily: 'monospace',
          color: COLORS.orange,
          rotation: 0,
        };
        elements.push(label);
        break;
      }
    }
  }

  return elements;
}
