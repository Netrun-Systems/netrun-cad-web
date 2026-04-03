/**
 * PDF Export — renders the current drawing to a print-ready scaled PDF.
 * Uses jsPDF with a high-resolution canvas render for raster output.
 * Supports standard landscape plan scales and ARCH/Letter page sizes.
 */

import { jsPDF } from 'jspdf';
import type { CADElement, Layer, GridSettings } from './types';
import { renderAll } from '../components/Canvas/renderer';

// ── Scale definitions ─────────────────────────────────────────────────────────

export interface ScaleOption {
  label: string;
  ratio: number; // paper inches per drawing foot  (e.g. 0.25 = 1/4"=1')
}

export const SCALE_OPTIONS: ScaleOption[] = [
  { label: '1/4" = 1\' (1:48) — Residential Detail', ratio: 0.25 },
  { label: '1/8" = 1\' (1:96) — Residential Overview', ratio: 0.125 },
  { label: '1/16" = 1\' (1:192) — Large Sites', ratio: 1 / 16 },
  { label: '1" = 10\' (1:120) — Site Plans', ratio: 0.1 },
];

export interface PageSizeOption {
  label: string;
  widthIn: number;  // inches
  heightIn: number; // inches
  orientation: 'landscape' | 'portrait';
}

export const PAGE_SIZES: PageSizeOption[] = [
  { label: 'ARCH D (24×36")', widthIn: 36, heightIn: 24, orientation: 'landscape' },
  { label: 'ARCH E (36×48")', widthIn: 48, heightIn: 36, orientation: 'landscape' },
  { label: 'Tabloid (11×17")', widthIn: 17, heightIn: 11, orientation: 'landscape' },
  { label: 'Letter (8.5×11")', widthIn: 11, heightIn: 8.5, orientation: 'landscape' },
];

export interface TitleBlockInfo {
  projectName: string;
  drawnBy: string;
  sheetNumber: string;
  date: string;
  scale: string;
}

export interface PDFExportOptions {
  scaleOption: ScaleOption;
  pageSize: PageSizeOption;
  titleBlock: TitleBlockInfo;
  includeGrid: boolean;
}

// ── PDF generation ────────────────────────────────────────────────────────────

const DPI = 150; // DPI for raster render (good balance of quality vs file size)
const TITLE_BLOCK_HEIGHT_IN = 1.25; // inches reserved for title block at bottom

/**
 * Export the current drawing as a print-ready PDF.
 * Renders all visible layers using the canvas renderer, then embeds as image.
 */
export async function exportToPDF(
  elements: CADElement[],
  layers: Layer[],
  grid: GridSettings,
  options: PDFExportOptions,
  filename = 'landscape-plan.pdf'
): Promise<void> {
  const { scaleOption, pageSize, titleBlock } = options;
  const { widthIn, heightIn } = pageSize;

  // Drawing area (inches) — leave room for title block
  const drawAreaWidthIn = widthIn - 0.5;  // 0.25" margin each side
  const drawAreaHeightIn = heightIn - TITLE_BLOCK_HEIGHT_IN - 0.5; // margin + title block

  // --- Build an off-screen canvas at DPI resolution ---
  const canvasWidthPx = Math.round(drawAreaWidthIn * DPI);
  const canvasHeightPx = Math.round(drawAreaHeightIn * DPI);

  const offscreen = document.createElement('canvas');
  offscreen.width = canvasWidthPx;
  offscreen.height = canvasHeightPx;

  const ctx = offscreen.getContext('2d');
  if (!ctx) throw new Error('Could not get canvas 2D context');

  // --- Compute view transform to fit drawing onto page ---
  // 1 foot = pixelsPerUnit pixels in drawing space
  // 1 foot = scaleOption.ratio inches on paper
  // 1 inch on paper = DPI pixels in the PDF canvas

  const pxPerFoot = grid.pixelsPerUnit; // drawing pixels per foot
  const paperPxPerFoot = scaleOption.ratio * DPI; // PDF canvas pixels per foot
  const zoom = paperPxPerFoot / pxPerFoot;

  // Find bounding box of all visible elements to center the drawing
  const bbox = computeBoundingBox(elements, layers);
  const drawingCenterX = (bbox.minX + bbox.maxX) / 2;
  const drawingCenterY = (bbox.minY + bbox.maxY) / 2;

  const offsetX = canvasWidthPx / 2 - drawingCenterX * zoom;
  const offsetY = canvasHeightPx / 2 - drawingCenterY * zoom;

  const view = { offsetX, offsetY, zoom };

  // White background for print
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvasWidthPx, canvasHeightPx);

  // Override renderAll to use white background
  const originalFill = ctx.fillStyle;
  renderAllForPDF(ctx, elements, layers, view, grid, canvasWidthPx, canvasHeightPx);
  ctx.fillStyle = originalFill;

  // --- Create jsPDF document ---
  const pdf = new jsPDF({
    orientation: pageSize.orientation,
    unit: 'in',
    format: [widthIn, heightIn],
  });

  // Embed the canvas as JPEG image (faster and smaller than PNG for complex drawings)
  const imgData = offscreen.toDataURL('image/jpeg', 0.95);
  pdf.addImage(imgData, 'JPEG', 0.25, 0.25, drawAreaWidthIn, drawAreaHeightIn);

  // --- Title Block ---
  renderTitleBlock(pdf, titleBlock, widthIn, heightIn, TITLE_BLOCK_HEIGHT_IN);

  pdf.save(filename);
}

// ── Title block renderer ──────────────────────────────────────────────────────

function renderTitleBlock(
  pdf: jsPDF,
  info: TitleBlockInfo,
  pageWidthIn: number,
  pageHeightIn: number,
  blockHeightIn: number
): void {
  const y = pageHeightIn - blockHeightIn; // top of title block
  const x = 0.25;
  const w = pageWidthIn - 0.5;

  // Border around title block
  pdf.setDrawColor(40, 40, 40);
  pdf.setLineWidth(0.02);
  pdf.rect(x, y, w, blockHeightIn - 0.1);

  // Vertical dividers — split into cells
  const cellW = w / 5;
  for (let i = 1; i < 5; i++) {
    pdf.line(x + cellW * i, y, x + cellW * i, pageHeightIn - 0.1);
  }

  // Labels (small grey)
  pdf.setFontSize(6);
  pdf.setTextColor(120, 120, 120);
  const labelY = y + 0.18;
  pdf.text('PROJECT', x + 0.05, labelY);
  pdf.text('SCALE', x + cellW + 0.05, labelY);
  pdf.text('DATE', x + cellW * 2 + 0.05, labelY);
  pdf.text('DRAWN BY', x + cellW * 3 + 0.05, labelY);
  pdf.text('SHEET', x + cellW * 4 + 0.05, labelY);

  // Values (larger, black)
  pdf.setFontSize(9);
  pdf.setTextColor(20, 20, 20);
  const valueY = y + 0.55;
  pdf.text(info.projectName || 'Untitled Project', x + 0.05, valueY);
  pdf.text(info.scale || '1/4"=1\'', x + cellW + 0.05, valueY);
  pdf.text(info.date || new Date().toLocaleDateString(), x + cellW * 2 + 0.05, valueY);
  pdf.text(info.drawnBy || '', x + cellW * 3 + 0.05, valueY);
  pdf.text(info.sheetNumber || '1 of 1', x + cellW * 4 + 0.05, valueY);

  // Netrun watermark
  pdf.setFontSize(5);
  pdf.setTextColor(180, 180, 180);
  pdf.text('Generated by Survai Construction', x + w - 1.2, pageHeightIn - 0.12);
}

// ── Bounding box ──────────────────────────────────────────────────────────────

interface BBox {
  minX: number; minY: number; maxX: number; maxY: number;
}

function computeBoundingBox(elements: CADElement[], layers: Layer[]): BBox {
  const layerMap = new Map(layers.map((l) => [l.id, l]));
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

  const expand = (x: number, y: number) => {
    if (x < minX) minX = x;
    if (y < minY) minY = y;
    if (x > maxX) maxX = x;
    if (y > maxY) maxY = y;
  };

  for (const el of elements) {
    const layer = layerMap.get(el.layerId);
    if (!layer?.visible) continue;

    switch (el.type) {
      case 'line':
        expand(el.p1.x, el.p1.y);
        expand(el.p2.x, el.p2.y);
        break;
      case 'rectangle':
        expand(el.origin.x, el.origin.y);
        expand(el.origin.x + el.width, el.origin.y + el.height);
        break;
      case 'circle':
        expand(el.center.x - el.radius, el.center.y - el.radius);
        expand(el.center.x + el.radius, el.center.y + el.radius);
        break;
      case 'dimension':
        expand(el.p1.x, el.p1.y);
        expand(el.p2.x, el.p2.y);
        break;
      case 'freehand':
        for (const p of el.points) expand(p.x, p.y);
        break;
      case 'text':
        expand(el.position.x, el.position.y);
        break;
      case 'plant':
        expand(el.position.x, el.position.y);
        break;
    }
  }

  if (!isFinite(minX)) {
    // No elements — center on origin
    return { minX: -100, minY: -100, maxX: 100, maxY: 100 };
  }

  // Add 5% padding
  const padX = (maxX - minX) * 0.05 + 48;
  const padY = (maxY - minY) * 0.05 + 48;
  return { minX: minX - padX, minY: minY - padY, maxX: maxX + padX, maxY: maxY + padY };
}

// ── Print-mode renderer (white background) ────────────────────────────────────

function renderAllForPDF(
  ctx: CanvasRenderingContext2D,
  elements: CADElement[],
  layers: Layer[],
  view: { offsetX: number; offsetY: number; zoom: number },
  grid: GridSettings,
  width: number,
  height: number
): void {
  // White background
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, width, height);

  // Apply transform (no DPR needed — offscreen canvas is already at final resolution)
  ctx.save();
  ctx.translate(view.offsetX, view.offsetY);
  ctx.scale(view.zoom, view.zoom);

  const layerMap = new Map(layers.map((l) => [l.id, l]));
  const sorted = [...elements].sort((a, b) => {
    const la = layerMap.get(a.layerId)?.order ?? 0;
    const lb = layerMap.get(b.layerId)?.order ?? 0;
    return la - lb;
  });

  // Use the main renderer — it draws on whichever ctx we pass
  // We need to call renderAll but it sets its own transform; use a local variant instead
  for (const el of sorted) {
    const layer = layerMap.get(el.layerId);
    if (!layer?.visible) continue;

    ctx.save();
    ctx.globalAlpha = layer.opacity;
    renderElementForPDF(ctx, el, grid);
    ctx.restore();
  }

  ctx.restore();
}

import getStroke from 'perfect-freehand';
import type { CADLine, CADRectangle, CADCircle, CADDimension, FreehandStroke, TextElement, PlantPlacement } from './types';
import { distance as geoDistance, midpoint, angle, formatMeasurement } from './geometry';
import { PLANT_DATABASE } from '../data/plants';

function renderElementForPDF(ctx: CanvasRenderingContext2D, el: CADElement, grid: GridSettings): void {
  // For print, use dark strokes on white background
  const printColor = (c: string) => {
    // Keep colorful elements (plants, color mode) but convert white/near-white to dark
    if (c === '#ffffff' || c === '#fff') return '#1a1a1a';
    return c;
  };

  switch (el.type) {
    case 'line': {
      const line = el as CADLine;
      ctx.strokeStyle = printColor(line.strokeColor);
      ctx.lineWidth = line.strokeWidth;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(line.p1.x, line.p1.y);
      ctx.lineTo(line.p2.x, line.p2.y);
      ctx.stroke();

      const dist = geoDistance(line.p1, line.p2);
      if (dist > 20) {
        const mid = midpoint(line.p1, line.p2);
        const ang = angle(line.p1, line.p2);
        ctx.save();
        ctx.translate(mid.x, mid.y);
        let textAngle = ang;
        if (textAngle > Math.PI / 2 || textAngle < -Math.PI / 2) textAngle += Math.PI;
        ctx.rotate(textAngle);
        ctx.fillStyle = '#555555';
        ctx.font = '11px monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'bottom';
        ctx.fillText(formatMeasurement(dist, grid), 0, -4);
        ctx.restore();
      }
      break;
    }

    case 'rectangle': {
      const rect = el as CADRectangle;
      if (rect.fillColor) {
        ctx.fillStyle = rect.fillColor;
        ctx.fillRect(rect.origin.x, rect.origin.y, rect.width, rect.height);
      }
      ctx.strokeStyle = printColor(rect.strokeColor);
      ctx.lineWidth = rect.strokeWidth;
      ctx.strokeRect(rect.origin.x, rect.origin.y, rect.width, rect.height);
      break;
    }

    case 'circle': {
      const circ = el as CADCircle;
      ctx.beginPath();
      ctx.arc(circ.center.x, circ.center.y, circ.radius, 0, Math.PI * 2);
      if (circ.fillColor) {
        ctx.fillStyle = circ.fillColor;
        ctx.fill();
      }
      ctx.strokeStyle = printColor(circ.strokeColor);
      ctx.lineWidth = circ.strokeWidth;
      ctx.stroke();
      break;
    }

    case 'dimension': {
      const dim = el as CADDimension;
      const dist = geoDistance(dim.p1, dim.p2);
      const ang = angle(dim.p1, dim.p2);
      const perpAngle = ang + Math.PI / 2;
      const ox = Math.cos(perpAngle) * dim.offset;
      const oy = Math.sin(perpAngle) * dim.offset;
      const dp1 = { x: dim.p1.x + ox, y: dim.p1.y + oy };
      const dp2 = { x: dim.p2.x + ox, y: dim.p2.y + oy };

      ctx.save();
      ctx.strokeStyle = '#cc7700';
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(dim.p1.x, dim.p1.y);
      ctx.lineTo(dp1.x, dp1.y);
      ctx.moveTo(dim.p2.x, dim.p2.y);
      ctx.lineTo(dp2.x, dp2.y);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.beginPath();
      ctx.moveTo(dp1.x, dp1.y);
      ctx.lineTo(dp2.x, dp2.y);
      ctx.stroke();
      const mid = midpoint(dp1, dp2);
      const label = dim.label || formatMeasurement(dist, grid);
      ctx.fillStyle = '#cc7700';
      ctx.font = '12px monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'bottom';
      ctx.fillText(label, mid.x, mid.y - 4);
      ctx.restore();
      break;
    }

    case 'freehand': {
      const stroke = el as FreehandStroke;
      const strokePoints = stroke.points.map((p) => [p.x, p.y, p.pressure]);
      const isWatercolor = stroke.brush === 'watercolor';
      const outlinePoints = getStroke(strokePoints, {
        size: stroke.size,
        thinning: isWatercolor ? 0.1 : 0.5,
        smoothing: 0.5,
        streamline: 0.5,
        simulatePressure: false,
      });
      if (outlinePoints.length < 2) break;
      const opacity = isWatercolor ? stroke.opacity * 0.4 : stroke.opacity;
      ctx.save();
      ctx.globalAlpha = opacity;
      ctx.fillStyle = stroke.color;
      ctx.beginPath();
      ctx.moveTo(outlinePoints[0][0], outlinePoints[0][1]);
      for (let i = 1; i < outlinePoints.length; i++) {
        ctx.lineTo(outlinePoints[i][0], outlinePoints[i][1]);
      }
      ctx.closePath();
      ctx.fill();
      ctx.restore();
      break;
    }

    case 'text': {
      const text = el as TextElement;
      ctx.save();
      ctx.translate(text.position.x, text.position.y);
      ctx.rotate((text.rotation * Math.PI) / 180);
      ctx.fillStyle = printColor(text.color);
      ctx.font = `${text.fontSize}px ${text.fontFamily}`;
      ctx.textBaseline = 'top';
      ctx.fillText(text.content, 0, 0);
      ctx.restore();
      break;
    }

    case 'plant': {
      const plant_el = el as PlantPlacement;
      const plant = PLANT_DATABASE.find((p) => p.id === plant_el.plantId);
      if (!plant) break;
      const radiusPx = (plant.matureWidth / 2) * grid.pixelsPerUnit * plant_el.scale;
      ctx.save();
      ctx.globalAlpha = 0.5;
      ctx.fillStyle = plant.color;
      ctx.beginPath();
      ctx.arc(plant_el.position.x, plant_el.position.y, radiusPx, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 0.85;
      ctx.strokeStyle = plant.color;
      ctx.lineWidth = 1.5;
      ctx.setLineDash([3, 3]);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.globalAlpha = 1;
      ctx.fillStyle = '#1a1a1a';
      ctx.font = '10px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(plant_el.label || plant.commonName, plant_el.position.x, plant_el.position.y);
      ctx.restore();
      break;
    }
  }
}
