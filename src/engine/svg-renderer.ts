import getStroke from 'perfect-freehand';
import type {
  CADElement,
  CADLine,
  CADRectangle,
  CADCircle,
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
} from './types';
import { distance, midpoint, angle } from './geometry';
import { PLANT_DATABASE } from '../data/plants';
import { INTERIOR_SYMBOLS } from '../data/interior-symbols';
import { iconToSvgMarkup } from './diagram-icons';

interface SVGOptions {
  width: number;
  height: number;
  background?: string;
  pixelsPerUnit?: number;
}

const escape = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const fmt = (n: number) => (Math.abs(n) < 0.01 ? '0' : n.toFixed(2).replace(/\.?0+$/, ''));

function dashAttr(dashPattern?: number[]): string {
  return dashPattern && dashPattern.length > 0 ? ` stroke-dasharray="${dashPattern.join(' ')}"` : '';
}

function lineSVG(el: CADLine): string {
  const meta = el.metadata;
  const opacity = meta?.opacity !== undefined ? ` opacity="${meta.opacity}"` : '';
  const dash = dashAttr(meta?.dashPattern);
  const main = `<line x1="${fmt(el.p1.x)}" y1="${fmt(el.p1.y)}" x2="${fmt(el.p2.x)}" y2="${fmt(el.p2.y)}" stroke="${el.strokeColor}" stroke-width="${el.strokeWidth}" stroke-linecap="round"${dash}${opacity}/>`;

  if (meta?.isNeighbor) return main;

  const dist = distance(el.p1, el.p2);
  if (dist <= 20) return main;

  const mid = midpoint(el.p1, el.p2);
  const ang = angle(el.p1, el.p2);
  let textAngle = ang;
  if (textAngle > Math.PI / 2 || textAngle < -Math.PI / 2) textAngle += Math.PI;
  const deg = (textAngle * 180) / Math.PI;
  const label = `<text x="0" y="-4" fill="#88ccff" font-family="monospace" font-size="11" text-anchor="middle">${fmt(dist)}px</text>`;
  return `${main}<g transform="translate(${fmt(mid.x)},${fmt(mid.y)}) rotate(${fmt(deg)})">${label}</g>`;
}

function rectSVG(el: CADRectangle): string {
  const fill = el.fillColor ? ` fill="${el.fillColor}"` : ' fill="none"';
  return `<rect x="${fmt(el.origin.x)}" y="${fmt(el.origin.y)}" width="${fmt(el.width)}" height="${fmt(el.height)}" stroke="${el.strokeColor}" stroke-width="${el.strokeWidth}"${fill}/>`;
}

function circleSVG(el: CADCircle): string {
  const fill = el.fillColor ? ` fill="${el.fillColor}"` : ' fill="none"';
  return `<circle cx="${fmt(el.center.x)}" cy="${fmt(el.center.y)}" r="${fmt(el.radius)}" stroke="${el.strokeColor}" stroke-width="${el.strokeWidth}"${fill}/>`;
}

function dimensionSVG(el: CADDimension): string {
  const dist = distance(el.p1, el.p2);
  const ang = angle(el.p1, el.p2);
  const perpAngle = ang + Math.PI / 2;
  const ox = Math.cos(perpAngle) * el.offset;
  const oy = Math.sin(perpAngle) * el.offset;
  const dp1 = { x: el.p1.x + ox, y: el.p1.y + oy };
  const dp2 = { x: el.p2.x + ox, y: el.p2.y + oy };
  const mid = midpoint(dp1, dp2);
  const label = el.label || `${fmt(dist)}px`;
  return [
    `<line x1="${fmt(el.p1.x)}" y1="${fmt(el.p1.y)}" x2="${fmt(dp1.x)}" y2="${fmt(dp1.y)}" stroke="#ff9800" stroke-width="1" stroke-dasharray="4 4"/>`,
    `<line x1="${fmt(el.p2.x)}" y1="${fmt(el.p2.y)}" x2="${fmt(dp2.x)}" y2="${fmt(dp2.y)}" stroke="#ff9800" stroke-width="1" stroke-dasharray="4 4"/>`,
    `<line x1="${fmt(dp1.x)}" y1="${fmt(dp1.y)}" x2="${fmt(dp2.x)}" y2="${fmt(dp2.y)}" stroke="#ff9800" stroke-width="1"/>`,
    `<text x="${fmt(mid.x)}" y="${fmt(mid.y - 4)}" fill="#ff9800" font-family="monospace" font-size="12" text-anchor="middle">${escape(label)}</text>`,
  ].join('');
}

function freehandSVG(el: FreehandStroke): string {
  if (el.points.length === 0) return '';
  const strokePoints = el.points.map((p) => [p.x, p.y, p.pressure]);
  const isWatercolor = el.brush === 'watercolor';
  const isMarker = el.brush === 'marker';
  const outline = getStroke(strokePoints, {
    size: el.size,
    thinning: isMarker ? 0.1 : 0.5,
    smoothing: 0.5,
    streamline: 0.5,
    simulatePressure: false,
  });
  if (outline.length < 2) return '';
  const opacity = isWatercolor ? el.opacity * 0.4 : el.opacity;
  const d = `M ${outline.map(([x, y]) => `${fmt(x)} ${fmt(y)}`).join(' L ')} Z`;
  let svg = `<path d="${d}" fill="${el.color}" fill-rule="nonzero" opacity="${opacity}"/>`;
  if (isWatercolor) {
    for (let i = 0; i < 3; i++) {
      const offset = (i - 1) * 2;
      const dShifted = `M ${outline.map(([x, y]) => `${fmt(x + offset)} ${fmt(y + offset)}`).join(' L ')} Z`;
      svg += `<path d="${dShifted}" fill="${el.color}" fill-rule="nonzero" opacity="${opacity * 0.2}"/>`;
    }
  }
  return svg;
}

function textSVG(el: TextElement): string {
  const transform = `translate(${fmt(el.position.x)},${fmt(el.position.y)})${el.rotation ? ` rotate(${fmt(el.rotation)})` : ''}`;
  return `<g transform="${transform}"><text x="0" y="${fmt(el.fontSize)}" fill="${el.color}" font-family="${escape(el.fontFamily)}" font-size="${el.fontSize}">${escape(el.content)}</text></g>`;
}

function plantSVG(el: PlantPlacement, pixelsPerUnit: number): string {
  const plant = PLANT_DATABASE.find((p) => p.id === el.plantId);
  if (!plant) return '';
  const radiusPx = (plant.matureWidth / 2) * pixelsPerUnit * el.scale;
  const label = el.label || plant.commonName;
  return [
    `<circle cx="${fmt(el.position.x)}" cy="${fmt(el.position.y)}" r="${fmt(radiusPx)}" fill="${plant.color}" fill-opacity="0.6" stroke="${plant.color}" stroke-width="1.5" stroke-dasharray="3 3"/>`,
    `<text x="${fmt(el.position.x)}" y="${fmt(el.position.y + 4)}" fill="#ffffff" font-family="sans-serif" font-size="10" text-anchor="middle">${escape(label)}</text>`,
  ].join('');
}

function interiorSymbolSVG(el: InteriorSymbolPlacement): string {
  const def = INTERIOR_SYMBOLS[el.symbolKey];
  if (!def) return '';
  const w = el.width;
  const d = el.depth;
  const transform = `translate(${fmt(el.position.x)},${fmt(el.position.y)})${el.rotation ? ` rotate(${fmt(el.rotation)})` : ''}`;
  const color = el.color ?? '#8B7355';
  const rect = `<rect x="${fmt(-w / 2)}" y="${fmt(-d / 2)}" width="${fmt(w)}" height="${fmt(d)}" fill="none" stroke="${color}" stroke-width="0.08"/>`;
  const label = `<text x="0" y="${fmt(d / 2 + 0.2)}" fill="${color}" font-family="sans-serif" font-size="0.6" text-anchor="middle" opacity="0.6">${escape(def.label)}</text>`;
  return `<g transform="${transform}">${rect}${label}</g>`;
}

function flowchartShapeSVG(el: FlowchartShape): string {
  const { origin, width: w, height: h, shape, fillColor, strokeColor, strokeWidth, rotation } = el;
  const cx = origin.x + w / 2;
  const cy = origin.y + h / 2;
  const transform = rotation ? ` transform="rotate(${fmt(rotation)} ${fmt(cx)} ${fmt(cy)})"` : '';
  let body = '';
  switch (shape) {
    case 'rectangle':
      body = `<rect x="${fmt(origin.x)}" y="${fmt(origin.y)}" width="${fmt(w)}" height="${fmt(h)}" fill="${fillColor}" stroke="${strokeColor}" stroke-width="${strokeWidth}"/>`;
      break;
    case 'rounded': {
      const r = Math.min(w, h) * 0.15;
      body = `<rect x="${fmt(origin.x)}" y="${fmt(origin.y)}" width="${fmt(w)}" height="${fmt(h)}" rx="${fmt(r)}" ry="${fmt(r)}" fill="${fillColor}" stroke="${strokeColor}" stroke-width="${strokeWidth}"/>`;
      break;
    }
    case 'ellipse':
      body = `<ellipse cx="${fmt(cx)}" cy="${fmt(cy)}" rx="${fmt(w / 2)}" ry="${fmt(h / 2)}" fill="${fillColor}" stroke="${strokeColor}" stroke-width="${strokeWidth}"/>`;
      break;
    case 'diamond': {
      const pts = `${fmt(cx)},${fmt(origin.y)} ${fmt(origin.x + w)},${fmt(cy)} ${fmt(cx)},${fmt(origin.y + h)} ${fmt(origin.x)},${fmt(cy)}`;
      body = `<polygon points="${pts}" fill="${fillColor}" stroke="${strokeColor}" stroke-width="${strokeWidth}"/>`;
      break;
    }
    case 'parallelogram': {
      const skew = w * 0.2;
      const pts = `${fmt(origin.x + skew)},${fmt(origin.y)} ${fmt(origin.x + w)},${fmt(origin.y)} ${fmt(origin.x + w - skew)},${fmt(origin.y + h)} ${fmt(origin.x)},${fmt(origin.y + h)}`;
      body = `<polygon points="${pts}" fill="${fillColor}" stroke="${strokeColor}" stroke-width="${strokeWidth}"/>`;
      break;
    }
    case 'cylinder': {
      const ry = h * 0.12;
      const top = `<ellipse cx="${fmt(cx)}" cy="${fmt(origin.y + ry)}" rx="${fmt(w / 2)}" ry="${fmt(ry)}" fill="${fillColor}" stroke="${strokeColor}" stroke-width="${strokeWidth}"/>`;
      const sides = `<path d="M ${fmt(origin.x)} ${fmt(origin.y + ry)} L ${fmt(origin.x)} ${fmt(origin.y + h - ry)} A ${fmt(w / 2)} ${fmt(ry)} 0 0 0 ${fmt(origin.x + w)} ${fmt(origin.y + h - ry)} L ${fmt(origin.x + w)} ${fmt(origin.y + ry)}" fill="${fillColor}" stroke="${strokeColor}" stroke-width="${strokeWidth}"/>`;
      body = sides + top;
      break;
    }
    case 'hexagon': {
      const inset = w * 0.15;
      const pts = `${fmt(origin.x + inset)},${fmt(origin.y)} ${fmt(origin.x + w - inset)},${fmt(origin.y)} ${fmt(origin.x + w)},${fmt(cy)} ${fmt(origin.x + w - inset)},${fmt(origin.y + h)} ${fmt(origin.x + inset)},${fmt(origin.y + h)} ${fmt(origin.x)},${fmt(cy)}`;
      body = `<polygon points="${pts}" fill="${fillColor}" stroke="${strokeColor}" stroke-width="${strokeWidth}"/>`;
      break;
    }
  }

  // Icon overlay
  if (el.iconRef) {
    const w = el.width;
    const h = el.height;
    const iconSize = el.iconSize ?? (el.text ? Math.min(28, Math.min(w, h) * 0.35) : Math.min(w, h) * 0.5);
    if (el.text) {
      const ix = el.origin.x + 8;
      const iy = el.origin.y + 8;
      body += `<circle cx="${fmt(ix + iconSize / 2)}" cy="${fmt(iy + iconSize / 2)}" r="${fmt(iconSize * 0.65)}" fill="${el.iconColor ?? el.strokeColor}" fill-opacity="0.12"/>`;
      body += iconToSvgMarkup(el.iconRef, ix, iy, iconSize, el.iconColor);
    } else {
      const ix = cx - iconSize / 2;
      const iy = cy - iconSize / 2;
      body += iconToSvgMarkup(el.iconRef, ix, iy, iconSize, el.iconColor);
    }
  }

  if (el.text) {
    const fontSize = el.fontSize ?? 14;
    const family = el.fontFamily ?? 'sans-serif';
    const tcolor = el.textColor ?? '#111827';
    const textOffset = el.iconRef ? 8 : 0;
    body += `<text x="${fmt(cx)}" y="${fmt(cy + textOffset)}" fill="${tcolor}" font-family="${escape(family)}" font-size="${fontSize}" text-anchor="middle" dominant-baseline="middle">${escape(el.text)}</text>`;
  }
  return transform ? `<g${transform}>${body}</g>` : body;
}

function connectorSVG(el: Connector): string {
  const path = el.cachedPath;
  if (!path || path.length < 2) return '';
  const d = `M ${path.map((p) => `${fmt(p.x)} ${fmt(p.y)}`).join(' L ')}`;
  const markerEnd = el.endCap === 'arrow' ? ' marker-end="url(#arrow-end)"' : el.endCap === 'dot' ? ' marker-end="url(#dot-end)"' : '';
  const markerStart = el.startCap === 'arrow' ? ' marker-start="url(#arrow-start)"' : el.startCap === 'dot' ? ' marker-start="url(#dot-start)"' : '';
  let svg = `<path d="${d}" fill="none" stroke="${el.strokeColor}" stroke-width="${el.strokeWidth}" stroke-linecap="round" stroke-linejoin="round"${markerStart}${markerEnd}/>`;
  if (el.label) {
    const last = path[path.length - 1];
    const first = path[0];
    const lcx = (first.x + last.x) / 2;
    const lcy = (first.y + last.y) / 2;
    svg += `<text x="${fmt(lcx)}" y="${fmt(lcy - 4)}" fill="${el.strokeColor}" font-family="sans-serif" font-size="12" text-anchor="middle">${escape(el.label)}</text>`;
  }
  return svg;
}

function containerSVG(el: DiagramContainer): string {
  const fill = el.fillColor ? el.fillColor : 'none';
  const titleHeight = el.title ? 24 : 0;
  let svg = `<rect x="${fmt(el.origin.x)}" y="${fmt(el.origin.y)}" width="${fmt(el.width)}" height="${fmt(el.height)}" fill="${fill}" stroke="${el.strokeColor}" stroke-width="${el.strokeWidth}"/>`;
  if (el.title) {
    svg += `<rect x="${fmt(el.origin.x)}" y="${fmt(el.origin.y)}" width="${fmt(el.width)}" height="${titleHeight}" fill="${el.strokeColor}" fill-opacity="0.1" stroke="${el.strokeColor}" stroke-width="${el.strokeWidth}"/>`;
    svg += `<text x="${fmt(el.origin.x + 8)}" y="${fmt(el.origin.y + titleHeight - 8)}" fill="${el.strokeColor}" font-family="sans-serif" font-size="13" font-weight="bold">${escape(el.title)}</text>`;
  }
  const lanes = el.laneCount ?? 0;
  if (lanes > 1 && el.containerType !== 'group') {
    const isHorizontal = el.containerType === 'swimlane-h';
    const usable = isHorizontal ? el.height - titleHeight : el.width;
    const step = usable / lanes;
    for (let i = 1; i < lanes; i++) {
      if (isHorizontal) {
        const y = el.origin.y + titleHeight + step * i;
        svg += `<line x1="${fmt(el.origin.x)}" y1="${fmt(y)}" x2="${fmt(el.origin.x + el.width)}" y2="${fmt(y)}" stroke="${el.strokeColor}" stroke-width="${el.strokeWidth * 0.6}" stroke-dasharray="6 4"/>`;
      } else {
        const x = el.origin.x + step * i;
        svg += `<line x1="${fmt(x)}" y1="${fmt(el.origin.y + titleHeight)}" x2="${fmt(x)}" y2="${fmt(el.origin.y + el.height)}" stroke="${el.strokeColor}" stroke-width="${el.strokeWidth * 0.6}" stroke-dasharray="6 4"/>`;
      }
    }
    if (el.laneLabels) {
      for (let i = 0; i < Math.min(lanes, el.laneLabels.length); i++) {
        const label = el.laneLabels[i];
        if (!label) continue;
        if (isHorizontal) {
          const ly = el.origin.y + titleHeight + step * (i + 0.5);
          svg += `<text x="${fmt(el.origin.x + 8)}" y="${fmt(ly)}" fill="${el.strokeColor}" font-family="sans-serif" font-size="11" dominant-baseline="middle">${escape(label)}</text>`;
        } else {
          const lx = el.origin.x + step * (i + 0.5);
          svg += `<text x="${fmt(lx)}" y="${fmt(el.origin.y + titleHeight + 14)}" fill="${el.strokeColor}" font-family="sans-serif" font-size="11" text-anchor="middle">${escape(label)}</text>`;
        }
      }
    }
  }
  return svg;
}

function elementSVG(el: CADElement, pixelsPerUnit: number): string {
  switch (el.type) {
    case 'line': return lineSVG(el);
    case 'rectangle': return rectSVG(el);
    case 'circle': return circleSVG(el);
    case 'dimension': return dimensionSVG(el);
    case 'freehand': return freehandSVG(el);
    case 'text': return textSVG(el);
    case 'plant': return plantSVG(el, pixelsPerUnit);
    case 'interior-symbol': return interiorSymbolSVG(el);
    case 'flowchart-shape': return flowchartShapeSVG(el);
    case 'connector': return connectorSVG(el);
    case 'container': return containerSVG(el);
  }
}

const ARROW_DEFS = `
<defs>
  <marker id="arrow-end" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
    <path d="M 0 0 L 10 5 L 0 10 z" fill="context-stroke"/>
  </marker>
  <marker id="arrow-start" viewBox="0 0 10 10" refX="1" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
    <path d="M 10 0 L 0 5 L 10 10 z" fill="context-stroke"/>
  </marker>
  <marker id="dot-end" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="5" markerHeight="5">
    <circle cx="5" cy="5" r="4" fill="context-stroke"/>
  </marker>
  <marker id="dot-start" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="5" markerHeight="5">
    <circle cx="5" cy="5" r="4" fill="context-stroke"/>
  </marker>
</defs>`;

/** Render a list of CADElements to a complete SVG document string. */
export function renderAllSVG(
  elements: CADElement[],
  layers: Layer[],
  view: ViewState,
  options: SVGOptions
): string {
  const { width, height, background, pixelsPerUnit = 48 } = options;
  const layerMap = new Map(layers.map((l) => [l.id, l]));
  const sorted = [...elements].sort((a, b) => {
    const la = layerMap.get(a.layerId)?.order ?? 0;
    const lb = layerMap.get(b.layerId)?.order ?? 0;
    return la - lb;
  });

  const layerGroups = new Map<string, string[]>();
  for (const el of sorted) {
    const layer = layerMap.get(el.layerId);
    if (!layer || !layer.visible) continue;
    const meta = (el as { metadata?: { opacity?: number } }).metadata;
    const elOpacity = meta?.opacity;
    let body = elementSVG(el, pixelsPerUnit);
    if (!body) continue;
    if (elOpacity !== undefined && elOpacity !== 1) {
      body = `<g opacity="${elOpacity}">${body}</g>`;
    }
    if (!layerGroups.has(el.layerId)) layerGroups.set(el.layerId, []);
    layerGroups.get(el.layerId)!.push(body);
  }

  const layerSvg: string[] = [];
  for (const layer of layers) {
    const group = layerGroups.get(layer.id);
    if (!group || group.length === 0) continue;
    const opacity = layer.opacity !== 1 ? ` opacity="${layer.opacity}"` : '';
    layerSvg.push(`<g class="layer-${layer.id}" data-layer="${escape(layer.name)}"${opacity}>${group.join('')}</g>`);
  }

  const bg = background
    ? `<rect width="${width}" height="${height}" fill="${background}"/>`
    : '';
  const transform = `translate(${fmt(view.offsetX)},${fmt(view.offsetY)}) scale(${fmt(view.zoom)})`;

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">${ARROW_DEFS}
${bg}<g transform="${transform}">${layerSvg.join('\n')}</g>
</svg>`;
}
