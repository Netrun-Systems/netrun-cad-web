/**
 * PNG Export — renders all visible drawing elements onto an offscreen canvas
 * with a transparent background. Output is a Blob suitable for Drive upload
 * or local download.
 *
 * The exported PNG matches the drawing's bounding box with configurable
 * padding, at the specified DPI (default 150 for print quality).
 */

import type { CADElement, Layer, GridSettings, ViewState } from './types';
import { renderAll } from '../components/Canvas/renderer';
import { getBoundingBox } from './selection';

const DEFAULT_PADDING = 48; // px padding around content
const DEFAULT_DPI_SCALE = 2; // 2x for retina / print quality

/**
 * Compute the bounding box that contains all visible elements.
 */
function computeDrawingBounds(
  elements: CADElement[],
  layers: Layer[],
): { minX: number; minY: number; maxX: number; maxY: number; width: number; height: number } | null {
  const visibleLayerIds = new Set(layers.filter(l => l.visible).map(l => l.id));
  const visible = elements.filter(el => visibleLayerIds.has(el.layerId));

  if (visible.length === 0) return null;

  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

  for (const el of visible) {
    const bb = getBoundingBox(el);
    minX = Math.min(minX, bb.x);
    minY = Math.min(minY, bb.y);
    maxX = Math.max(maxX, bb.x + bb.width);
    maxY = Math.max(maxY, bb.y + bb.height);
  }

  return {
    minX, minY, maxX, maxY,
    width: maxX - minX,
    height: maxY - minY,
  };
}

/**
 * Render all visible elements to a transparent PNG blob.
 *
 * @param elements - All CAD elements
 * @param layers - Layer definitions (visibility/opacity respected)
 * @param grid - Grid settings (grid lines are NOT rendered in export)
 * @param padding - Extra space around the content in pixels
 * @param scale - Resolution multiplier (2 = retina quality)
 * @returns PNG Blob or null if no visible elements
 */
export async function renderToPNGBlob(
  elements: CADElement[],
  layers: Layer[],
  grid: GridSettings,
  padding = DEFAULT_PADDING,
  scale = DEFAULT_DPI_SCALE,
): Promise<Blob | null> {
  const bounds = computeDrawingBounds(elements, layers);
  if (!bounds) return null;

  const canvasW = Math.ceil((bounds.width + padding * 2) * scale);
  const canvasH = Math.ceil((bounds.height + padding * 2) * scale);

  // Cap at reasonable size (16384 is typical browser max)
  const maxDim = 16384;
  const effectiveScale = Math.min(scale, maxDim / Math.max(bounds.width + padding * 2, bounds.height + padding * 2));
  const finalW = Math.ceil((bounds.width + padding * 2) * effectiveScale);
  const finalH = Math.ceil((bounds.height + padding * 2) * effectiveScale);

  // Create offscreen canvas
  const canvas = document.createElement('canvas');
  canvas.width = finalW;
  canvas.height = finalH;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  // Override devicePixelRatio for the render call
  const origDPR = window.devicePixelRatio;
  Object.defineProperty(window, 'devicePixelRatio', { value: 1, writable: true, configurable: true });

  // Set up view transform to center the content with padding
  const exportView: ViewState = {
    offsetX: (-bounds.minX + padding) * effectiveScale,
    offsetY: (-bounds.minY + padding) * effectiveScale,
    zoom: effectiveScale,
  };

  // Render with grid disabled and transparent background
  const exportGrid: GridSettings = { ...grid, enabled: false };

  renderAll(
    ctx,
    elements,
    layers,
    exportView,
    exportGrid,
    finalW,
    finalH,
    true, // skipBackground = true → transparent
  );

  // Restore DPR
  Object.defineProperty(window, 'devicePixelRatio', { value: origDPR, writable: true, configurable: true });

  // Convert to blob
  return new Promise<Blob | null>((resolve) => {
    canvas.toBlob((blob) => resolve(blob), 'image/png');
  });
}

/**
 * Render to PNG and trigger a local download.
 */
export async function downloadPNG(
  elements: CADElement[],
  layers: Layer[],
  grid: GridSettings,
  filename = 'landscape-plan.png',
): Promise<void> {
  const blob = await renderToPNGBlob(elements, layers, grid);
  if (!blob) return;

  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
