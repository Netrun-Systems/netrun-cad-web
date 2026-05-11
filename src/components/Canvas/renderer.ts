import getStroke from 'perfect-freehand';
import type {
  CADElement,
  CADLine,
  CADRectangle,
  CADCircle,
  CADPolyline,
  CADDimension,
  FreehandStroke,
  TextElement,
  PlantPlacement,
  InteriorSymbolPlacement,
  FlowchartShape,
  Connector,
  DiagramContainer,
  Layer,
  ViewState,
  GridSettings,
} from '../../engine/types';
import { distance, formatMeasurement, midpoint, angle } from '../../engine/geometry';
import { PLANT_DATABASE } from '../../data/plants';
import { INTERIOR_SYMBOLS } from '../../data/interior-symbols';
import { renderInteriorSymbol } from '../../engine/interior-renderer';
import { drawIconCanvas } from '../../engine/diagram-icons';

/** Render the grid onto a canvas context */
export function renderGrid(
  ctx: CanvasRenderingContext2D,
  view: ViewState,
  grid: GridSettings,
  canvasWidth: number,
  canvasHeight: number
) {
  if (!grid.enabled) return;

  const spacing = grid.size * view.zoom;
  if (spacing < 4) return; // Too dense to render

  // Calculate visible grid range
  const startX = Math.floor(-view.offsetX / spacing) * spacing;
  const startY = Math.floor(-view.offsetY / spacing) * spacing;
  const endX = canvasWidth / view.zoom - view.offsetX + spacing;
  const endY = canvasHeight / view.zoom - view.offsetY + spacing;

  ctx.save();
  ctx.strokeStyle = '#2a2a4a';
  ctx.lineWidth = 0.5 / view.zoom;

  ctx.beginPath();
  for (let x = startX; x <= endX; x += grid.size) {
    ctx.moveTo(x, startY);
    ctx.lineTo(x, endY / view.zoom);
  }
  for (let y = startY; y <= endY; y += grid.size) {
    ctx.moveTo(startX, y);
    ctx.lineTo(endX / view.zoom, y);
  }
  ctx.stroke();

  // Major grid lines (every 4 units)
  const majorSpacing = grid.size * 4;
  const majorStartX = Math.floor(-view.offsetX / (majorSpacing * view.zoom)) * majorSpacing;
  const majorStartY = Math.floor(-view.offsetY / (majorSpacing * view.zoom)) * majorSpacing;

  ctx.strokeStyle = '#3a3a5a';
  ctx.lineWidth = 1 / view.zoom;
  ctx.beginPath();
  for (let x = majorStartX; x <= endX; x += majorSpacing) {
    ctx.moveTo(x, startY);
    ctx.lineTo(x, endY / view.zoom);
  }
  for (let y = majorStartY; y <= endY; y += majorSpacing) {
    ctx.moveTo(startX, y);
    ctx.lineTo(endX / view.zoom, y);
  }
  ctx.stroke();
  ctx.restore();
}

/** Convert perfect-freehand outline points to an SVG path string, then draw it */
function drawFreehandPath(
  ctx: CanvasRenderingContext2D,
  outlinePoints: number[][],
  color: string,
  opacity: number
) {
  if (outlinePoints.length < 2) return;

  ctx.save();
  ctx.globalAlpha = opacity;
  ctx.fillStyle = color;
  ctx.beginPath();

  const [firstX, firstY] = outlinePoints[0];
  ctx.moveTo(firstX, firstY);

  for (let i = 1; i < outlinePoints.length; i++) {
    const [x, y] = outlinePoints[i];
    ctx.lineTo(x, y);
  }

  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function renderLine(ctx: CanvasRenderingContext2D, el: CADLine, grid: GridSettings) {
  const meta = el.metadata;

  ctx.save();

  // Apply metadata overrides (neighbor parcels get dashed, low opacity)
  if (meta?.opacity !== undefined) {
    ctx.globalAlpha = meta.opacity;
  }
  if (meta?.dashPattern) {
    ctx.setLineDash(meta.dashPattern);
  }

  ctx.strokeStyle = el.strokeColor;
  ctx.lineWidth = el.strokeWidth;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(el.p1.x, el.p1.y);
  ctx.lineTo(el.p2.x, el.p2.y);
  ctx.stroke();

  ctx.setLineDash([]);
  ctx.restore();

  // Draw dimension label at midpoint (only for non-neighbor lines)
  if (!meta?.isNeighbor) {
    const dist = distance(el.p1, el.p2);
    if (dist > 20) {
      const mid = midpoint(el.p1, el.p2);
      const ang = angle(el.p1, el.p2);
      const label = formatMeasurement(dist, grid);

      ctx.save();
      ctx.translate(mid.x, mid.y);
      let textAngle = ang;
      if (textAngle > Math.PI / 2 || textAngle < -Math.PI / 2) {
        textAngle += Math.PI;
      }
      ctx.rotate(textAngle);
      ctx.fillStyle = '#88ccff';
      ctx.font = '11px monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'bottom';
      ctx.fillText(label, 0, -4);
      ctx.restore();
    }
  }
}

function renderRectangle(ctx: CanvasRenderingContext2D, el: CADRectangle) {
  if (el.fillColor) {
    ctx.fillStyle = el.fillColor;
    ctx.fillRect(el.origin.x, el.origin.y, el.width, el.height);
  }
  ctx.strokeStyle = el.strokeColor;
  ctx.lineWidth = el.strokeWidth;
  ctx.strokeRect(el.origin.x, el.origin.y, el.width, el.height);
}

function renderCircle(ctx: CanvasRenderingContext2D, el: CADCircle) {
  ctx.beginPath();
  ctx.arc(el.center.x, el.center.y, el.radius, 0, Math.PI * 2);
  if (el.fillColor) {
    ctx.fillStyle = el.fillColor;
    ctx.fill();
  }
  ctx.strokeStyle = el.strokeColor;
  ctx.lineWidth = el.strokeWidth;
  ctx.stroke();
}

function renderDimension(ctx: CanvasRenderingContext2D, el: CADDimension, grid: GridSettings) {
  const dist = distance(el.p1, el.p2);
  const ang = angle(el.p1, el.p2);
  const perpAngle = ang + Math.PI / 2;
  const ox = Math.cos(perpAngle) * el.offset;
  const oy = Math.sin(perpAngle) * el.offset;

  const dp1 = { x: el.p1.x + ox, y: el.p1.y + oy };
  const dp2 = { x: el.p2.x + ox, y: el.p2.y + oy };

  ctx.save();
  ctx.strokeStyle = '#ff9800';
  ctx.lineWidth = 1;
  ctx.setLineDash([4, 4]);

  // Extension lines
  ctx.beginPath();
  ctx.moveTo(el.p1.x, el.p1.y);
  ctx.lineTo(dp1.x, dp1.y);
  ctx.moveTo(el.p2.x, el.p2.y);
  ctx.lineTo(dp2.x, dp2.y);
  ctx.stroke();

  // Dimension line
  ctx.setLineDash([]);
  ctx.beginPath();
  ctx.moveTo(dp1.x, dp1.y);
  ctx.lineTo(dp2.x, dp2.y);
  ctx.stroke();

  // Label
  const mid = midpoint(dp1, dp2);
  const label = el.label || formatMeasurement(dist, grid);
  ctx.fillStyle = '#ff9800';
  ctx.font = '12px monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'bottom';
  ctx.fillText(label, mid.x, mid.y - 4);
  ctx.restore();
}

function renderFreehand(ctx: CanvasRenderingContext2D, el: FreehandStroke) {
  const strokePoints = el.points.map((p) => [p.x, p.y, p.pressure]);

  const isWatercolor = el.brush === 'watercolor';
  const isMarker = el.brush === 'marker';

  const outlinePoints = getStroke(strokePoints, {
    size: el.size,
    thinning: isMarker ? 0.1 : 0.5,
    smoothing: 0.5,
    streamline: 0.5,
    simulatePressure: false,
  });

  const opacity = isWatercolor ? el.opacity * 0.4 : el.opacity;
  drawFreehandPath(ctx, outlinePoints, el.color, opacity);

  // Watercolor effect: draw multiple semi-transparent passes offset slightly
  if (isWatercolor && outlinePoints.length > 2) {
    for (let i = 0; i < 3; i++) {
      const offset = (i - 1) * 2;
      const shifted = outlinePoints.map(([x, y]) => [x + offset, y + offset]);
      drawFreehandPath(ctx, shifted, el.color, opacity * 0.2);
    }
  }
}

function renderPolyline(ctx: CanvasRenderingContext2D, el: CADPolyline) {
  if (el.points.length < 2) return;
  ctx.save();
  ctx.strokeStyle = el.strokeColor;
  ctx.lineWidth = el.strokeWidth;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(el.points[0].x, el.points[0].y);
  for (let i = 1; i < el.points.length; i++) {
    ctx.lineTo(el.points[i].x, el.points[i].y);
  }
  if (el.closed && el.points.length >= 3) ctx.closePath();
  ctx.stroke();
  ctx.restore();
}

function renderText(ctx: CanvasRenderingContext2D, el: TextElement) {
  ctx.save();
  ctx.translate(el.position.x, el.position.y);
  ctx.rotate((el.rotation * Math.PI) / 180);
  ctx.fillStyle = el.color;
  ctx.font = `${el.fontSize}px ${el.fontFamily}`;
  ctx.textBaseline = 'top';
  ctx.fillText(el.content, 0, 0);
  ctx.restore();
}

function renderInteriorSymbolEl(ctx: CanvasRenderingContext2D, el: InteriorSymbolPlacement) {
  const def = INTERIOR_SYMBOLS[el.symbolKey];
  if (!def) return;
  ctx.save();
  ctx.translate(el.position.x, el.position.y);
  renderInteriorSymbol(
    ctx,
    def.shape,
    el.width,
    el.depth,
    el.color ?? '#8B7355',
    el.rotation
  );
  // Small label below the symbol
  ctx.save();
  ctx.fillStyle = '#8B7355';
  ctx.font = '0.6px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.globalAlpha = 0.6;
  ctx.fillText(def.label, 0, el.depth / 2 + 0.2);
  ctx.restore();
  ctx.restore();
}

function tracePath(ctx: CanvasRenderingContext2D, points: { x: number; y: number }[], close = false) {
  if (points.length === 0) return;
  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);
  for (let i = 1; i < points.length; i++) ctx.lineTo(points[i].x, points[i].y);
  if (close) ctx.closePath();
}

function renderFlowchartShape(ctx: CanvasRenderingContext2D, el: FlowchartShape) {
  const { origin, width: w, height: h, shape } = el;
  const cx = origin.x + w / 2;
  const cy = origin.y + h / 2;

  ctx.save();
  if (el.rotation) {
    ctx.translate(cx, cy);
    ctx.rotate((el.rotation * Math.PI) / 180);
    ctx.translate(-cx, -cy);
  }

  ctx.fillStyle = el.fillColor;
  ctx.strokeStyle = el.strokeColor;
  ctx.lineWidth = el.strokeWidth;

  switch (shape) {
    case 'rectangle':
      ctx.fillRect(origin.x, origin.y, w, h);
      ctx.strokeRect(origin.x, origin.y, w, h);
      break;
    case 'rounded': {
      const r = Math.min(w, h) * 0.15;
      ctx.beginPath();
      ctx.moveTo(origin.x + r, origin.y);
      ctx.lineTo(origin.x + w - r, origin.y);
      ctx.arcTo(origin.x + w, origin.y, origin.x + w, origin.y + r, r);
      ctx.lineTo(origin.x + w, origin.y + h - r);
      ctx.arcTo(origin.x + w, origin.y + h, origin.x + w - r, origin.y + h, r);
      ctx.lineTo(origin.x + r, origin.y + h);
      ctx.arcTo(origin.x, origin.y + h, origin.x, origin.y + h - r, r);
      ctx.lineTo(origin.x, origin.y + r);
      ctx.arcTo(origin.x, origin.y, origin.x + r, origin.y, r);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      break;
    }
    case 'ellipse':
      ctx.beginPath();
      ctx.ellipse(cx, cy, w / 2, h / 2, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      break;
    case 'diamond':
      tracePath(ctx, [
        { x: cx, y: origin.y },
        { x: origin.x + w, y: cy },
        { x: cx, y: origin.y + h },
        { x: origin.x, y: cy },
      ], true);
      ctx.fill();
      ctx.stroke();
      break;
    case 'parallelogram': {
      const skew = w * 0.2;
      tracePath(ctx, [
        { x: origin.x + skew, y: origin.y },
        { x: origin.x + w, y: origin.y },
        { x: origin.x + w - skew, y: origin.y + h },
        { x: origin.x, y: origin.y + h },
      ], true);
      ctx.fill();
      ctx.stroke();
      break;
    }
    case 'cylinder': {
      const ry = h * 0.12;
      ctx.beginPath();
      ctx.moveTo(origin.x, origin.y + ry);
      ctx.lineTo(origin.x, origin.y + h - ry);
      ctx.ellipse(cx, origin.y + h - ry, w / 2, ry, 0, Math.PI, 0, true);
      ctx.lineTo(origin.x + w, origin.y + ry);
      ctx.ellipse(cx, origin.y + ry, w / 2, ry, 0, 0, Math.PI, true);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      // Top ellipse outline
      ctx.beginPath();
      ctx.ellipse(cx, origin.y + ry, w / 2, ry, 0, 0, Math.PI * 2);
      ctx.stroke();
      break;
    }
    case 'hexagon': {
      const inset = w * 0.15;
      tracePath(ctx, [
        { x: origin.x + inset, y: origin.y },
        { x: origin.x + w - inset, y: origin.y },
        { x: origin.x + w, y: cy },
        { x: origin.x + w - inset, y: origin.y + h },
        { x: origin.x + inset, y: origin.y + h },
        { x: origin.x, y: cy },
      ], true);
      ctx.fill();
      ctx.stroke();
      break;
    }
  }

  // Icon overlay (positioned top-left when text is present, centered when not)
  if (el.iconRef) {
    const iconSize = el.iconSize ?? Math.min(28, Math.min(w, h) * 0.35);
    if (el.text) {
      // Top-left badge with subtle backdrop circle
      const ix = origin.x + iconSize / 2 + 8;
      const iy = origin.y + iconSize / 2 + 8;
      ctx.save();
      ctx.globalAlpha = 0.12;
      ctx.fillStyle = el.iconColor ?? el.strokeColor;
      ctx.beginPath();
      ctx.arc(ix, iy, iconSize * 0.65, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      drawIconCanvas(ctx, el.iconRef, ix, iy, iconSize, el.iconColor);
    } else {
      const iconPxSize = el.iconSize ?? Math.min(w, h) * 0.5;
      drawIconCanvas(ctx, el.iconRef, cx, cy, iconPxSize, el.iconColor);
    }
  }

  if (el.text) {
    const fontSize = el.fontSize ?? 14;
    const family = el.fontFamily ?? 'sans-serif';
    ctx.fillStyle = el.textColor ?? '#111827';
    ctx.font = `${fontSize}px ${family}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const lines = el.text.split('\n');
    const lineHeight = fontSize * 1.25;
    const totalHeight = lineHeight * (lines.length - 1);
    // Shift text down slightly when an icon is present
    const textOffset = el.iconRef ? 8 : 0;
    for (let i = 0; i < lines.length; i++) {
      ctx.fillText(lines[i], cx, cy + textOffset - totalHeight / 2 + i * lineHeight);
    }
  }

  ctx.restore();
}

function drawArrowhead(ctx: CanvasRenderingContext2D, tip: { x: number; y: number }, from: { x: number; y: number }, color: string, size = 10) {
  const ang = Math.atan2(tip.y - from.y, tip.x - from.x);
  const wing = Math.PI / 6;
  ctx.save();
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(tip.x, tip.y);
  ctx.lineTo(tip.x - size * Math.cos(ang - wing), tip.y - size * Math.sin(ang - wing));
  ctx.lineTo(tip.x - size * Math.cos(ang + wing), tip.y - size * Math.sin(ang + wing));
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function drawDot(ctx: CanvasRenderingContext2D, p: { x: number; y: number }, color: string, r = 4) {
  ctx.save();
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function renderConnector(ctx: CanvasRenderingContext2D, el: Connector) {
  const path = el.cachedPath;
  if (!path || path.length < 2) return;

  ctx.save();
  ctx.strokeStyle = el.strokeColor;
  ctx.lineWidth = el.strokeWidth;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(path[0].x, path[0].y);
  for (let i = 1; i < path.length; i++) ctx.lineTo(path[i].x, path[i].y);
  ctx.stroke();

  if (el.endCap === 'arrow') {
    drawArrowhead(ctx, path[path.length - 1], path[path.length - 2], el.strokeColor);
  } else if (el.endCap === 'dot') {
    drawDot(ctx, path[path.length - 1], el.strokeColor);
  }
  if (el.startCap === 'arrow') {
    drawArrowhead(ctx, path[0], path[1], el.strokeColor);
  } else if (el.startCap === 'dot') {
    drawDot(ctx, path[0], el.strokeColor);
  }

  if (el.label) {
    const last = path[path.length - 1];
    const first = path[0];
    const lcx = (first.x + last.x) / 2;
    const lcy = (first.y + last.y) / 2;
    ctx.fillStyle = el.strokeColor;
    ctx.font = '12px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    ctx.fillText(el.label, lcx, lcy - 4);
  }

  ctx.restore();
}

function renderContainer(ctx: CanvasRenderingContext2D, el: DiagramContainer) {
  const { origin, width: w, height: h } = el;
  const titleHeight = el.title ? 24 : 0;

  ctx.save();
  if (el.fillColor) {
    ctx.fillStyle = el.fillColor;
    ctx.fillRect(origin.x, origin.y, w, h);
  }
  ctx.strokeStyle = el.strokeColor;
  ctx.lineWidth = el.strokeWidth;
  ctx.strokeRect(origin.x, origin.y, w, h);

  if (el.title) {
    ctx.save();
    ctx.fillStyle = el.strokeColor;
    ctx.globalAlpha = 0.1;
    ctx.fillRect(origin.x, origin.y, w, titleHeight);
    ctx.restore();
    ctx.strokeRect(origin.x, origin.y, w, titleHeight);
    ctx.fillStyle = el.strokeColor;
    ctx.font = 'bold 13px sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(el.title, origin.x + 8, origin.y + titleHeight / 2);
  }

  const lanes = el.laneCount ?? 0;
  if (lanes > 1 && el.containerType !== 'group') {
    const isHorizontal = el.containerType === 'swimlane-h';
    const usable = isHorizontal ? h - titleHeight : w;
    const step = usable / lanes;
    ctx.save();
    ctx.strokeStyle = el.strokeColor;
    ctx.lineWidth = el.strokeWidth * 0.6;
    ctx.setLineDash([6, 4]);
    for (let i = 1; i < lanes; i++) {
      ctx.beginPath();
      if (isHorizontal) {
        const y = origin.y + titleHeight + step * i;
        ctx.moveTo(origin.x, y);
        ctx.lineTo(origin.x + w, y);
      } else {
        const x = origin.x + step * i;
        ctx.moveTo(x, origin.y + titleHeight);
        ctx.lineTo(x, origin.y + h);
      }
      ctx.stroke();
    }
    ctx.restore();

    if (el.laneLabels) {
      ctx.fillStyle = el.strokeColor;
      ctx.font = '11px sans-serif';
      for (let i = 0; i < Math.min(lanes, el.laneLabels.length); i++) {
        const label = el.laneLabels[i];
        if (!label) continue;
        if (isHorizontal) {
          ctx.textAlign = 'left';
          ctx.textBaseline = 'middle';
          const ly = origin.y + titleHeight + step * (i + 0.5);
          ctx.fillText(label, origin.x + 8, ly);
        } else {
          ctx.textAlign = 'center';
          ctx.textBaseline = 'top';
          const lx = origin.x + step * (i + 0.5);
          ctx.fillText(label, lx, origin.y + titleHeight + 4);
        }
      }
    }
  }

  ctx.restore();
}

function renderPlant(ctx: CanvasRenderingContext2D, el: PlantPlacement, grid: GridSettings) {
  const plant = PLANT_DATABASE.find((p) => p.id === el.plantId);
  if (!plant) return;

  const radiusPx = (plant.matureWidth / 2) * grid.pixelsPerUnit * el.scale;

  ctx.save();
  ctx.globalAlpha = 0.6;
  ctx.fillStyle = plant.color;
  ctx.beginPath();
  ctx.arc(el.position.x, el.position.y, radiusPx, 0, Math.PI * 2);
  ctx.fill();

  // Canopy outline
  ctx.globalAlpha = 0.9;
  ctx.strokeStyle = plant.color;
  ctx.lineWidth = 1.5;
  ctx.setLineDash([3, 3]);
  ctx.stroke();
  ctx.setLineDash([]);

  // Label
  ctx.globalAlpha = 1;
  ctx.fillStyle = '#ffffff';
  ctx.font = '10px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const label = el.label || plant.commonName;
  ctx.fillText(label, el.position.x, el.position.y);
  ctx.restore();
}

/** Main render function: draw all visible elements */
export function renderAll(
  ctx: CanvasRenderingContext2D,
  elements: CADElement[],
  layers: Layer[],
  view: ViewState,
  grid: GridSettings,
  canvasWidth: number,
  canvasHeight: number,
  /** When true, skip the background fill (caller has already rendered a basemap) */
  skipBackground = false
) {
  const dpr = window.devicePixelRatio || 1;

  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, canvasWidth, canvasHeight);

  // Fill background (skip when basemap is rendered underneath)
  if (!skipBackground) {
    ctx.fillStyle = '#12121f';
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);
  }

  // Apply view transform
  ctx.translate(view.offsetX, view.offsetY);
  ctx.scale(view.zoom, view.zoom);

  // Grid
  renderGrid(ctx, view, grid, canvasWidth, canvasHeight);

  // Create layer visibility lookup
  const layerMap = new Map(layers.map((l) => [l.id, l]));

  // Sort elements by layer order
  const sorted = [...elements].sort((a, b) => {
    const la = layerMap.get(a.layerId)?.order ?? 0;
    const lb = layerMap.get(b.layerId)?.order ?? 0;
    return la - lb;
  });

  // Collect neighbor APN label positions for post-pass rendering
  const neighborLabels: Array<{ x: number; y: number; apn: string }> = [];

  // Render each element
  for (const el of sorted) {
    const layer = layerMap.get(el.layerId);
    if (!layer || !layer.visible) continue;

    // Determine effective opacity: element metadata overrides layer opacity
    const meta = (el as { metadata?: { opacity?: number; isNeighbor?: boolean; neighborApn?: string } }).metadata;
    const effectiveOpacity = meta?.opacity !== undefined ? meta.opacity * layer.opacity : layer.opacity;

    ctx.save();
    ctx.globalAlpha = effectiveOpacity;

    switch (el.type) {
      case 'line':
        renderLine(ctx, el, grid);
        // Collect first segment label position for neighbor APN display
        if (meta?.isNeighbor && meta.neighborApn && el.type === 'line') {
          neighborLabels.push({
            x: (el.p1.x + el.p2.x) / 2,
            y: (el.p1.y + el.p2.y) / 2,
            apn: meta.neighborApn,
          });
        }
        break;
      case 'rectangle':
        renderRectangle(ctx, el);
        break;
      case 'circle':
        renderCircle(ctx, el);
        break;
      case 'dimension':
        renderDimension(ctx, el, grid);
        break;
      case 'freehand':
        renderFreehand(ctx, el);
        break;
      case 'polyline':
        renderPolyline(ctx, el);
        break;
      case 'text':
        renderText(ctx, el);
        break;
      case 'plant':
        renderPlant(ctx, el, grid);
        break;
      case 'interior-symbol':
        renderInteriorSymbolEl(ctx, el as InteriorSymbolPlacement);
        break;
      case 'flowchart-shape':
        renderFlowchartShape(ctx, el);
        break;
      case 'connector':
        renderConnector(ctx, el);
        break;
      case 'container':
        renderContainer(ctx, el);
        break;
    }

    ctx.restore();
  }

  // Post-pass: render neighbor APN labels at 30% opacity, tiny text
  for (const lbl of neighborLabels) {
    ctx.save();
    ctx.globalAlpha = 0.3;
    ctx.fillStyle = '#aaaaaa';
    ctx.font = '6px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(lbl.apn, lbl.x, lbl.y);
    ctx.restore();
  }
}
