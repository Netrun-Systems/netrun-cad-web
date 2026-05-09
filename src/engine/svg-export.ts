import type { CADElement, GridSettings, Layer } from './types';
import { getBoundingBox } from './selection';
import { renderAllSVG } from './svg-renderer';

interface SVGExportOptions {
  filename?: string;
  margin?: number;
  background?: string;
}

function computeBounds(elements: CADElement[]): { x: number; y: number; width: number; height: number } {
  if (elements.length === 0) return { x: 0, y: 0, width: 800, height: 600 };
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const el of elements) {
    const b = getBoundingBox(el);
    if (b.width === 0 && b.height === 0) continue;
    if (b.x < minX) minX = b.x;
    if (b.y < minY) minY = b.y;
    if (b.x + b.width > maxX) maxX = b.x + b.width;
    if (b.y + b.height > maxY) maxY = b.y + b.height;
  }
  if (!isFinite(minX)) return { x: 0, y: 0, width: 800, height: 600 };
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}

/** Export the drawing as an SVG file and trigger a browser download. */
export function exportSVG(
  elements: CADElement[],
  layers: Layer[],
  grid: GridSettings,
  options: SVGExportOptions = {}
): void {
  const { filename = 'drawing.svg', margin = 40, background } = options;
  const bounds = computeBounds(elements);
  const width = Math.max(1, bounds.width + margin * 2);
  const height = Math.max(1, bounds.height + margin * 2);

  const svg = renderAllSVG(elements, layers, { offsetX: margin - bounds.x, offsetY: margin - bounds.y, zoom: 1 }, {
    width,
    height,
    background,
    pixelsPerUnit: grid.pixelsPerUnit,
  });

  const blob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename.endsWith('.svg') ? filename : `${filename}.svg`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
