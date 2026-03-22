/**
 * Symbol Loader — renders landscape symbols from the SYMBOL_LIBRARY on the canvas.
 * Symbols are imported from netrun-cad DXF files and stored in src/data/symbols.ts.
 * Coordinates are in DXF units (feet); we convert to canvas pixels using grid scale.
 */

import type { GridSettings } from './types';
import { SYMBOL_LIBRARY, type SymbolEntity } from '../data/symbols';

// ── Symbol bounding box (for auto-scale) ─────────────────────────────────────

interface SymbolBBox {
  minX: number; minY: number; maxX: number; maxY: number;
  width: number; height: number;
}

function symbolBBox(entities: SymbolEntity[]): SymbolBBox {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

  const expand = (x: number, y: number) => {
    if (x < minX) minX = x;
    if (y < minY) minY = y;
    if (x > maxX) maxX = x;
    if (y > maxY) maxY = y;
  };

  for (const e of entities) {
    switch (e.t) {
      case 'l':
        expand(e.x1, e.y1);
        expand(e.x2, e.y2);
        break;
      case 'c':
        expand(e.cx - e.r, e.cy - e.r);
        expand(e.cx + e.r, e.cy + e.r);
        break;
      case 'a':
        expand(e.cx - e.r, e.cy - e.r);
        expand(e.cx + e.r, e.cy + e.r);
        break;
      case 'p':
        for (const [x, y] of e.pts) expand(x, y);
        break;
    }
  }

  if (!isFinite(minX)) {
    return { minX: 0, minY: 0, maxX: 1, maxY: 1, width: 1, height: 1 };
  }

  return { minX, minY, maxX, maxY, width: maxX - minX, height: maxY - minY };
}

// ── Draw a single symbol entity ───────────────────────────────────────────────

function drawEntity(
  ctx: CanvasRenderingContext2D,
  entity: SymbolEntity,
  scale: number // pixels per DXF unit
): void {
  ctx.save();
  ctx.strokeStyle = ctx.strokeStyle || '#1a6630';
  ctx.fillStyle = ctx.fillStyle || 'transparent';
  ctx.lineWidth = Math.max(0.5, 1 / scale);

  switch (entity.t) {
    case 'l':
      ctx.beginPath();
      ctx.moveTo(entity.x1 * scale, -entity.y1 * scale);
      ctx.lineTo(entity.x2 * scale, -entity.y2 * scale);
      ctx.stroke();
      break;

    case 'c':
      ctx.beginPath();
      ctx.arc(entity.cx * scale, -entity.cy * scale, entity.r * scale, 0, Math.PI * 2);
      ctx.stroke();
      break;

    case 'a': {
      // DXF arc: counter-clockwise, angles in degrees, Y flipped for canvas
      const startRad = (-entity.ea * Math.PI) / 180;
      const endRad = (-entity.sa * Math.PI) / 180;
      ctx.beginPath();
      ctx.arc(entity.cx * scale, -entity.cy * scale, entity.r * scale, startRad, endRad, false);
      ctx.stroke();
      break;
    }

    case 'p': {
      if (entity.pts.length < 2) break;
      ctx.beginPath();
      ctx.moveTo(entity.pts[0][0] * scale, -entity.pts[0][1] * scale);
      for (let i = 1; i < entity.pts.length; i++) {
        ctx.lineTo(entity.pts[i][0] * scale, -entity.pts[i][1] * scale);
      }
      if (entity.cl) ctx.closePath();
      ctx.stroke();
      break;
    }
  }

  ctx.restore();
}

// ── Public API ────────────────────────────────────────────────────────────────

export interface SymbolRenderOptions {
  /** Symbol key from SYMBOL_LIBRARY (e.g. 'irrigation_spray_full') */
  symbolKey: string;
  /** Canvas center position in drawing pixels */
  cx: number;
  cy: number;
  /** Target radius in drawing pixels (symbol will be scaled to fit) */
  radius: number;
  /** Rotation in degrees */
  rotation?: number;
  /** Stroke color */
  color?: string;
}

/**
 * Render a named symbol centered at (cx, cy) with the given radius.
 * Returns true if the symbol was found and rendered.
 */
export function renderSymbol(
  ctx: CanvasRenderingContext2D,
  opts: SymbolRenderOptions
): boolean {
  const entities = SYMBOL_LIBRARY[opts.symbolKey];
  if (!entities || entities.length === 0) return false;

  const bbox = symbolBBox(entities);
  const maxDim = Math.max(bbox.width, bbox.height);
  if (maxDim === 0) return false;

  // Scale so the symbol fits within radius*2
  const scale = (opts.radius * 2) / maxDim;

  // Center offset: translate so bbox center aligns with (cx, cy)
  const bboxCenterX = (bbox.minX + bbox.maxX) / 2;
  const bboxCenterY = (bbox.minY + bbox.maxY) / 2;

  ctx.save();
  ctx.translate(opts.cx, opts.cy);
  if (opts.rotation) {
    ctx.rotate((opts.rotation * Math.PI) / 180);
  }
  ctx.translate(-bboxCenterX * scale, bboxCenterY * scale); // note: Y flipped

  ctx.strokeStyle = opts.color ?? '#1a6630';

  for (const entity of entities) {
    drawEntity(ctx, entity, scale);
  }

  ctx.restore();
  return true;
}

/**
 * Guess the best symbol key for a plant type.
 * Falls back to null if no good match.
 */
export function plantSymbolKey(plantType: string): string | null {
  const typeMap: Record<string, string> = {
    tree: 'site_boulder_large', // placeholder — no tree symbol in library
    shrub: 'edge_boulder_border',
    perennial: 'fill_flagstone',
    groundcover: 'fill_decomposed_granite',
    grass: 'fill_gravel',
    succulent: 'site_rock_outcrop',
    vine: 'edge_stone',
  };
  return typeMap[plantType] ?? null;
}

/**
 * List all available symbol keys.
 */
export function availableSymbols(): string[] {
  return Object.keys(SYMBOL_LIBRARY);
}

/**
 * Return the bounding dimensions of a symbol in DXF units.
 */
export function symbolDimensions(key: string): { width: number; height: number } | null {
  const entities = SYMBOL_LIBRARY[key];
  if (!entities) return null;
  const bb = symbolBBox(entities);
  return { width: bb.width, height: bb.height };
}
