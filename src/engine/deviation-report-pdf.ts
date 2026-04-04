/**
 * Deviation Report PDF — generates a professional punch list PDF
 * summarizing scan-vs-blueprint deviations for construction QA.
 *
 * Uses jsPDF basic drawing methods (no autoTable plugin required).
 */

import { jsPDF } from 'jspdf';
import type { DeviationEntry } from './deviation-renderer';

// ─── Types ──────────────────────────────────────────────────────────────────

export interface DeviationPDFOptions {
  projectName: string;
  date: string;
  scanInfo?: string;
  blueprintInfo?: string;
  toleranceMm?: number;
  deviations: DeviationEntry[];
  summary: {
    total: number;
    matches: number;
    position: number;
    typeMismatch: number;
    missing: number;
    extra: number;
    passRate: number;
  };
}

// ─── Constants ──────────────────────────────────────────────────────────────

const PAGE_W = 210; // A4 width mm
const PAGE_H = 297; // A4 height mm
const MARGIN = 15;
const CONTENT_W = PAGE_W - MARGIN * 2;

const COLORS = {
  headerBg: [17, 24, 39] as [number, number, number],       // gray-900
  headerText: [255, 255, 255] as [number, number, number],
  black: [20, 20, 20] as [number, number, number],
  gray: [107, 114, 128] as [number, number, number],
  lightGray: [229, 231, 235] as [number, number, number],
  green: [34, 197, 94] as [number, number, number],
  yellow: [234, 179, 8] as [number, number, number],
  red: [239, 68, 68] as [number, number, number],
  orange: [249, 115, 22] as [number, number, number],
  cyan: [6, 182, 212] as [number, number, number],
};

// ─── Helpers ────────────────────────────────────────────────────────────────

function severityColorRGB(severity: string): [number, number, number] {
  switch (severity) {
    case 'OK': return COLORS.green;
    case 'WARNING': return COLORS.yellow;
    case 'CRITICAL': return COLORS.red;
    default: return COLORS.gray;
  }
}

function deviationTypeLabel(type: string): string {
  switch (type) {
    case 'MATCH': return 'Match';
    case 'POSITION_DEVIATION': return 'Position';
    case 'TYPE_MISMATCH': return 'Type Mismatch';
    case 'MISSING_IN_SCAN': return 'Missing';
    case 'EXTRA_IN_SCAN': return 'Extra';
    default: return type;
  }
}

// ─── PDF Generation ─────────────────────────────────────────────────────────

export function generateDeviationPDF(options: DeviationPDFOptions): void {
  const { projectName, date, scanInfo, blueprintInfo, deviations, summary, toleranceMm } = options;

  const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

  // ── PAGE 1: Summary ─────────────────────────────────────────────────────

  // Dark header band
  pdf.setFillColor(...COLORS.headerBg);
  pdf.rect(0, 0, PAGE_W, 42, 'F');

  // Header text
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(18);
  pdf.setTextColor(...COLORS.headerText);
  pdf.text('SURVAI CONSTRUCTION', MARGIN, 18);

  pdf.setFontSize(12);
  pdf.setFont('helvetica', 'normal');
  pdf.text('DEVIATION REPORT', MARGIN, 28);

  // Project name + date on right side
  pdf.setFontSize(9);
  pdf.text(projectName, PAGE_W - MARGIN, 18, { align: 'right' });
  pdf.text(date, PAGE_W - MARGIN, 25, { align: 'right' });

  // Cyan accent line
  pdf.setDrawColor(...COLORS.cyan);
  pdf.setLineWidth(1);
  pdf.line(MARGIN, 43, PAGE_W - MARGIN, 43);

  let y = 52;

  // Scan & blueprint info
  pdf.setFontSize(9);
  pdf.setTextColor(...COLORS.gray);
  if (scanInfo) {
    pdf.text(`Scan: ${scanInfo}`, MARGIN, y);
    y += 5;
  }
  if (blueprintInfo) {
    pdf.text(`Blueprint: ${blueprintInfo}`, MARGIN, y);
    y += 5;
  }
  if (toleranceMm) {
    pdf.text(`Tolerance: ${toleranceMm}mm`, MARGIN, y);
    y += 5;
  }
  y += 5;

  // ── Summary box ───────────────────────────────────────────────────────

  pdf.setFontSize(11);
  pdf.setFont('helvetica', 'bold');
  pdf.setTextColor(...COLORS.black);
  pdf.text('SUMMARY', MARGIN, y);
  y += 4;

  // Box background
  const boxH = 52;
  pdf.setFillColor(248, 250, 252);
  pdf.setDrawColor(...COLORS.lightGray);
  pdf.setLineWidth(0.3);
  pdf.roundedRect(MARGIN, y, CONTENT_W, boxH, 2, 2, 'FD');
  y += 6;

  // Pass rate — large number
  const passColor = summary.passRate >= 0.8 ? COLORS.green : summary.passRate >= 0.6 ? COLORS.yellow : COLORS.red;
  pdf.setFontSize(28);
  pdf.setFont('helvetica', 'bold');
  pdf.setTextColor(...passColor);
  pdf.text(`${(summary.passRate * 100).toFixed(1)}%`, MARGIN + 8, y + 12);

  pdf.setFontSize(9);
  pdf.setFont('helvetica', 'normal');
  pdf.setTextColor(...COLORS.gray);
  pdf.text('Pass Rate', MARGIN + 8, y + 18);

  // Stats column (right side)
  const sx = MARGIN + 70;
  const statsData: [string, number, [number, number, number]][] = [
    ['Total Elements', summary.total, COLORS.black],
    ['Matches', summary.matches, COLORS.green],
    ['Position Deviations', summary.position, COLORS.red],
    ['Type Mismatches', summary.typeMismatch, COLORS.yellow],
    ['Missing in Scan', summary.missing, COLORS.red],
    ['Extra in Scan', summary.extra, COLORS.orange],
  ];

  let sy = y + 2;
  for (const [label, count, color] of statsData) {
    pdf.setFontSize(8);
    pdf.setTextColor(...COLORS.gray);
    pdf.text(label, sx, sy);
    pdf.setFont('helvetica', 'bold');
    pdf.setTextColor(...color);
    pdf.text(String(count), sx + 60, sy, { align: 'right' });
    pdf.setFont('helvetica', 'normal');
    sy += 7;
  }

  y += boxH + 10;

  // ── PAGE 2+: Deviation Table ──────────────────────────────────────────

  // Filter out matches for the detail table
  const nonMatchDeviations = deviations.filter((d) => d.deviation_type !== 'MATCH');

  if (nonMatchDeviations.length > 0) {
    pdf.addPage();
    y = MARGIN;

    // Table header
    pdf.setFillColor(...COLORS.headerBg);
    const rowH = 8;
    const colWidths = [10, 28, 22, 18, 92]; // #, Type, Severity, Distance, Description
    pdf.rect(MARGIN, y, CONTENT_W, rowH, 'F');

    pdf.setFontSize(7);
    pdf.setFont('helvetica', 'bold');
    pdf.setTextColor(...COLORS.headerText);

    const headers = ['#', 'Type', 'Severity', 'Dist.', 'Description'];
    let hx = MARGIN + 2;
    for (let i = 0; i < headers.length; i++) {
      pdf.text(headers[i], hx, y + 5.5);
      hx += colWidths[i];
    }
    y += rowH;

    // Table rows
    pdf.setFont('helvetica', 'normal');

    for (let i = 0; i < nonMatchDeviations.length; i++) {
      const d = nonMatchDeviations[i];

      // Page break check
      if (y + rowH > PAGE_H - 30) {
        renderFooter(pdf, toleranceMm ?? 25, date);
        pdf.addPage();
        y = MARGIN;

        // Re-draw table header on new page
        pdf.setFillColor(...COLORS.headerBg);
        pdf.rect(MARGIN, y, CONTENT_W, rowH, 'F');
        pdf.setFontSize(7);
        pdf.setFont('helvetica', 'bold');
        pdf.setTextColor(...COLORS.headerText);
        hx = MARGIN + 2;
        for (let j = 0; j < headers.length; j++) {
          pdf.text(headers[j], hx, y + 5.5);
          hx += colWidths[j];
        }
        y += rowH;
        pdf.setFont('helvetica', 'normal');
      }

      // Alternating row background
      if (i % 2 === 0) {
        pdf.setFillColor(248, 250, 252);
        pdf.rect(MARGIN, y, CONTENT_W, rowH, 'F');
      }

      pdf.setFontSize(7);
      let rx = MARGIN + 2;

      // # column
      pdf.setTextColor(...COLORS.black);
      pdf.text(String(i + 1), rx, y + 5.5);
      rx += colWidths[0];

      // Type column
      pdf.setTextColor(...COLORS.black);
      pdf.text(deviationTypeLabel(d.deviation_type), rx, y + 5.5);
      rx += colWidths[1];

      // Severity column (color-coded)
      const sevColor = severityColorRGB(d.severity);
      pdf.setTextColor(...sevColor);
      pdf.setFont('helvetica', 'bold');
      pdf.text(d.severity, rx, y + 5.5);
      pdf.setFont('helvetica', 'normal');
      rx += colWidths[2];

      // Distance column
      pdf.setTextColor(...COLORS.black);
      pdf.text(d.distance_mm > 0 ? `${d.distance_mm}mm` : '—', rx, y + 5.5);
      rx += colWidths[3];

      // Description column (truncate if needed)
      pdf.setTextColor(...COLORS.gray);
      const desc = d.message.length > 80 ? d.message.substring(0, 77) + '...' : d.message;
      pdf.text(desc, rx, y + 5.5);

      y += rowH;
    }
  }

  // ── Footer on last page ───────────────────────────────────────────────

  renderFooter(pdf, toleranceMm ?? 25, date);

  // Save
  const filename = `deviation-report-${projectName.replace(/\s+/g, '-').toLowerCase()}-${date}.pdf`;
  pdf.save(filename);
}

// ─── Footer ─────────────────────────────────────────────────────────────────

function renderFooter(pdf: jsPDF, toleranceMm: number, date: string): void {
  const footerY = PAGE_H - 20;

  pdf.setDrawColor(...COLORS.lightGray);
  pdf.setLineWidth(0.3);
  pdf.line(MARGIN, footerY, PAGE_W - MARGIN, footerY);

  pdf.setFontSize(6);
  pdf.setFont('helvetica', 'normal');
  pdf.setTextColor(...COLORS.gray);

  pdf.text(`Detections by Survai ML (YOLOv8 + PointNet++)  |  Tolerance: ${toleranceMm}mm`, MARGIN, footerY + 5);
  pdf.text('This report should be verified by field inspection.', MARGIN, footerY + 9);
  pdf.text(`Generated: ${date} ${new Date().toLocaleTimeString()}`, MARGIN, footerY + 13);
  pdf.text('survai.netrunsystems.com', PAGE_W - MARGIN, footerY + 5, { align: 'right' });
  pdf.text('Prepared by Survai Construction', PAGE_W - MARGIN, footerY + 9, { align: 'right' });
}
