/**
 * Plant Schedule — group plant placements by species, count them, and join
 * with the plant database to produce a print-ready schedule for landscape
 * design deliverables.
 *
 * The schedule is the standard "PLANT LIST" appendix on a landscape plan:
 * a table that gives the contractor a shopping list (qty + size + species)
 * and gives the client the WUCOLS water-use rationale.
 */

import type { CADElement, PlantPlacement } from './types';
import type { Plant } from '../data/plants';

export interface ScheduleRow {
  plantId: string;
  commonName: string;
  botanicalName: string;
  type: Plant['type'];
  waterUse: Plant['waterUse'];
  sunExposure: Plant['sunExposure'];
  zones: string;
  matureWidth: number;
  matureHeight: number;
  symbol: string;
  color: string;
  /** How many of this plant are placed in the drawing. */
  count: number;
  /** Average per-placement scale (1.0 = mature, 0.5 = half mature, etc.) */
  avgScale: number;
  /** Total ground coverage in square feet, summed across placements. */
  totalCoverageSqFt: number;
}

export interface PlantScheduleSummary {
  rows: ScheduleRow[];
  totalPlacements: number;
  totalSpecies: number;
  /** Counts grouped by water-use category for the WUCOLS summary. */
  byWaterUse: Record<Plant['waterUse'], number>;
  /** Counts grouped by plant type. */
  byType: Record<Plant['type'], number>;
}

/* ------------------------------------------------------------------ */
/*  Generator                                                          */
/* ------------------------------------------------------------------ */

/**
 * Build a plant schedule from the current drawing.
 * Placements without a matching plant in the database are silently skipped
 * (these would be stale references after a database edit).
 */
export function generatePlantSchedule(
  elements: CADElement[],
  plantDatabase: Plant[],
): PlantScheduleSummary {
  const placements: PlantPlacement[] = elements.filter(
    (el): el is PlantPlacement => el.type === 'plant',
  );

  const plantById = new Map<string, Plant>();
  for (const p of plantDatabase) plantById.set(p.id, p);

  // Group by plantId
  const groups = new Map<string, PlantPlacement[]>();
  for (const placement of placements) {
    const arr = groups.get(placement.plantId);
    if (arr) arr.push(placement);
    else groups.set(placement.plantId, [placement]);
  }

  const rows: ScheduleRow[] = [];
  const byWaterUse: Record<Plant['waterUse'], number> = { low: 0, moderate: 0, high: 0 };
  const byType: Record<Plant['type'], number> = {
    tree: 0, shrub: 0, perennial: 0, groundcover: 0, grass: 0, succulent: 0, vine: 0,
  };
  let totalPlacements = 0;

  for (const [plantId, group] of groups.entries()) {
    const plant = plantById.get(plantId);
    if (!plant) continue; // Skip stale references

    const count = group.length;
    const avgScale = group.reduce((s, p) => s + p.scale, 0) / count;

    // Per-placement coverage: π × (mature width × scale / 2)²
    const totalCoverageSqFt = group.reduce((s, p) => {
      const r = (plant.matureWidth * p.scale) / 2;
      return s + Math.PI * r * r;
    }, 0);

    rows.push({
      plantId,
      commonName: plant.commonName,
      botanicalName: plant.botanicalName,
      type: plant.type,
      waterUse: plant.waterUse,
      sunExposure: plant.sunExposure,
      zones: plant.zones,
      matureWidth: plant.matureWidth,
      matureHeight: plant.matureHeight,
      symbol: plant.symbol,
      color: plant.color,
      count,
      avgScale,
      totalCoverageSqFt,
    });

    totalPlacements += count;
    byWaterUse[plant.waterUse] += count;
    byType[plant.type] += count;
  }

  // Sort: trees first (most visually dominant), then by count desc, then alpha
  const TYPE_ORDER: Record<Plant['type'], number> = {
    tree: 0, shrub: 1, perennial: 2, vine: 3, grass: 4, succulent: 5, groundcover: 6,
  };
  rows.sort((a, b) => {
    const t = TYPE_ORDER[a.type] - TYPE_ORDER[b.type];
    if (t !== 0) return t;
    const c = b.count - a.count;
    if (c !== 0) return c;
    return a.commonName.localeCompare(b.commonName);
  });

  return {
    rows,
    totalPlacements,
    totalSpecies: rows.length,
    byWaterUse,
    byType,
  };
}

/* ------------------------------------------------------------------ */
/*  CSV export                                                          */
/* ------------------------------------------------------------------ */

/** Escape a CSV cell — wrap in quotes if it contains comma, quote, or newline. */
function csvCell(value: string | number): string {
  const s = String(value);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

/** Render the schedule as a CSV string. */
export function scheduleToCSV(summary: PlantScheduleSummary): string {
  const header = [
    'Qty', 'Symbol', 'Common Name', 'Botanical Name', 'Type',
    'Water Use', 'Sun Exposure', 'USDA Zones',
    'Mature Width (ft)', 'Mature Height (ft)',
    'Avg Scale', 'Total Coverage (sq ft)',
  ].join(',');

  const lines = summary.rows.map((r) =>
    [
      r.count,
      csvCell(r.symbol),
      csvCell(r.commonName),
      csvCell(r.botanicalName),
      csvCell(r.type),
      csvCell(r.waterUse),
      csvCell(r.sunExposure),
      csvCell(r.zones),
      r.matureWidth,
      r.matureHeight,
      r.avgScale.toFixed(2),
      r.totalCoverageSqFt.toFixed(1),
    ].join(','),
  );

  // Add a summary footer
  const footer = [
    '',
    `# Total placements: ${summary.totalPlacements}`,
    `# Total species: ${summary.totalSpecies}`,
    `# Low water-use: ${summary.byWaterUse.low}`,
    `# Moderate water-use: ${summary.byWaterUse.moderate}`,
    `# High water-use: ${summary.byWaterUse.high}`,
  ];

  return [header, ...lines, ...footer].join('\n');
}

/** Trigger a browser download of the schedule as a CSV file. */
export function downloadScheduleCSV(
  summary: PlantScheduleSummary,
  filename = 'plant-schedule.csv',
): void {
  const csv = scheduleToCSV(summary);
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/* ------------------------------------------------------------------ */
/*  PDF export                                                          */
/* ------------------------------------------------------------------ */

/**
 * Render the schedule as a standalone PDF (Letter, portrait).
 * jsPDF is loaded on demand — same lazy chunk used by the main PDF export.
 */
export async function exportScheduleToPDF(
  summary: PlantScheduleSummary,
  options: { projectName?: string; date?: string; filename?: string } = {},
): Promise<void> {
  const { jsPDF } = await import('jspdf');
  const projectName = options.projectName ?? 'Untitled Project';
  const date = options.date ?? new Date().toLocaleDateString();
  const filename = options.filename ?? 'plant-schedule.pdf';

  const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'letter' });
  const PAGE_W = 215.9; // letter width mm
  const PAGE_H = 279.4; // letter height mm
  const M = 15;
  const CONTENT_W = PAGE_W - M * 2;

  // ── Header ─────────────────────────────────────────────────────────
  pdf.setFillColor(15, 15, 35); // cad-surface
  pdf.rect(0, 0, PAGE_W, 28, 'F');

  pdf.setTextColor(255, 255, 255);
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(14);
  pdf.text('PLANT SCHEDULE', M, 12);

  pdf.setFontSize(9);
  pdf.setFont('helvetica', 'normal');
  pdf.text(projectName, M, 19);
  pdf.text(date, PAGE_W - M, 19, { align: 'right' });

  // Coral accent line
  pdf.setDrawColor(233, 69, 96);
  pdf.setLineWidth(0.6);
  pdf.line(M, 29, PAGE_W - M, 29);

  let y = 40;

  // ── Table ─────────────────────────────────────────────────────────
  // Columns: Qty | Common Name | Botanical | Type | Water | Mature W×H | Zones
  const cols = [
    { label: 'Qty',         w: 12 },
    { label: 'Common',      w: 38 },
    { label: 'Botanical',   w: 50 },
    { label: 'Type',        w: 22 },
    { label: 'Water',       w: 18 },
    { label: 'W × H (ft)',  w: 22 },
    { label: 'Zones',       w: CONTENT_W - (12 + 38 + 50 + 22 + 18 + 22) },
  ];

  // Header row
  pdf.setFillColor(26, 26, 46); // cad-bg
  pdf.rect(M, y, CONTENT_W, 7, 'F');
  pdf.setTextColor(255, 255, 255);
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(8);
  let cx = M + 2;
  for (const col of cols) {
    pdf.text(col.label, cx, y + 5);
    cx += col.w;
  }
  y += 7;

  // Data rows
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(8);

  for (let i = 0; i < summary.rows.length; i++) {
    const row = summary.rows[i];

    // Page break
    if (y + 7 > PAGE_H - 25) {
      pdf.addPage();
      y = M;
      // Repeat header
      pdf.setFillColor(26, 26, 46);
      pdf.rect(M, y, CONTENT_W, 7, 'F');
      pdf.setTextColor(255, 255, 255);
      pdf.setFont('helvetica', 'bold');
      cx = M + 2;
      for (const col of cols) {
        pdf.text(col.label, cx, y + 5);
        cx += col.w;
      }
      y += 7;
      pdf.setFont('helvetica', 'normal');
    }

    // Alternating row background
    if (i % 2 === 0) {
      pdf.setFillColor(248, 250, 252);
      pdf.rect(M, y, CONTENT_W, 7, 'F');
    }

    pdf.setTextColor(20, 20, 20);
    cx = M + 2;
    const cells = [
      String(row.count),
      row.commonName,
      row.botanicalName,
      row.type,
      row.waterUse,
      `${row.matureWidth} × ${row.matureHeight}`,
      row.zones,
    ];
    for (let j = 0; j < cols.length; j++) {
      const text = cells[j];
      // Truncate if it would overflow the column
      const maxLen = Math.floor(cols[j].w * 1.6);
      const display = text.length > maxLen ? text.slice(0, maxLen - 1) + '…' : text;
      // Italicize botanical name
      if (j === 2) pdf.setFont('helvetica', 'italic');
      pdf.text(display, cx, y + 5);
      if (j === 2) pdf.setFont('helvetica', 'normal');
      cx += cols[j].w;
    }

    y += 7;
  }

  // ── WUCOLS summary footer ────────────────────────────────────────
  y += 6;
  if (y + 30 > PAGE_H - 15) {
    pdf.addPage();
    y = M + 10;
  }

  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(10);
  pdf.setTextColor(20, 20, 20);
  pdf.text('SUMMARY', M, y);
  y += 5;

  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(9);
  pdf.setTextColor(75, 85, 99);
  pdf.text(`Total placements: ${summary.totalPlacements}`, M, y); y += 5;
  pdf.text(`Distinct species: ${summary.totalSpecies}`, M, y); y += 5;
  pdf.text(
    `WUCOLS water-use distribution — Low: ${summary.byWaterUse.low}, ` +
    `Moderate: ${summary.byWaterUse.moderate}, High: ${summary.byWaterUse.high}`,
    M, y,
  );
  y += 5;
  const lowPct = summary.totalPlacements > 0
    ? Math.round((summary.byWaterUse.low / summary.totalPlacements) * 100)
    : 0;
  if (lowPct >= 75) {
    pdf.setTextColor(34, 197, 94); // green
    pdf.text(`✓ ${lowPct}% low-water plants — qualifies as water-wise design (WUCOLS).`, M, y);
  } else if (lowPct >= 50) {
    pdf.setTextColor(234, 179, 8); // yellow
    pdf.text(`◐ ${lowPct}% low-water plants — moderate water-wise composition.`, M, y);
  } else {
    pdf.setTextColor(239, 68, 68); // red
    pdf.text(`⚠ ${lowPct}% low-water plants — consider increasing low-water selections.`, M, y);
  }

  // Footer signature
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(7);
  pdf.setTextColor(107, 114, 128);
  pdf.text(`Generated ${date} by Netrun CAD`, M, PAGE_H - 10);
  pdf.text('cad.netrunsystems.com', PAGE_W - M, PAGE_H - 10, { align: 'right' });

  pdf.save(filename);
}
