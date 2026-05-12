/**
 * Built-in landscape block catalog. Each block is a named bundle of CAD
 * elements with positions in *block-local* coordinates (origin = 0,0 = the
 * block's insertion point). Renderer applies the instance transform
 * (translate, rotate, scale) at draw time, so the elements here only need
 * to describe the shape relative to the insertion point.
 *
 * Elements are tagged with synthetic ids that aren't globally unique —
 * they only need to be unique within the block. The render path doesn't
 * use them; selection treats the whole instance as one element.
 *
 * Adding a new block: append a BlockDefinition to BLOCK_CATALOG and the
 * library panel picks it up automatically.
 */

import type { CADElement } from '../engine/types';

const PIXELS_PER_FOOT = 48; // matches DEFAULT_GRID.pixelsPerUnit
const ft = (n: number) => n * PIXELS_PER_FOOT;

export interface BlockDefinition {
  id: string;
  name: string;
  category: 'furniture' | 'structural' | 'hardscape' | 'lighting';
  description?: string;
  /** Geometry in block-local coordinates. */
  elements: CADElement[];
  /** Approximate footprint in canvas pixels. Used by the panel preview. */
  bbox: { width: number; height: number };
}

/* ------------------------------------------------------------------ */
/*  Block builders — all geometry centered around (0,0)                */
/* ------------------------------------------------------------------ */

function rect(id: string, x: number, y: number, w: number, h: number, color: string, strokeWidth = 1.5): CADElement {
  return { type: 'rectangle', id, origin: { x, y }, width: w, height: h, layerId: 'block', strokeColor: color, strokeWidth };
}
function circle(id: string, cx: number, cy: number, r: number, color: string, strokeWidth = 1, fillColor?: string): CADElement {
  return { type: 'circle', id, center: { x: cx, y: cy }, radius: r, layerId: 'block', strokeColor: color, strokeWidth, fillColor };
}
function line(id: string, x1: number, y1: number, x2: number, y2: number, color: string, strokeWidth = 1): CADElement {
  return { type: 'line', id, p1: { x: x1, y: y1 }, p2: { x: x2, y: y2 }, layerId: 'block', strokeColor: color, strokeWidth };
}
function polygon(id: string, pts: Array<[number, number]>, color: string, strokeWidth = 1.5): CADElement {
  return {
    type: 'polyline', id,
    points: pts.map(([x, y]) => ({ x, y })),
    closed: true,
    layerId: 'block', strokeColor: color, strokeWidth,
  };
}

function bench(): BlockDefinition {
  // 6 ft long × 1.5 ft deep bench seat with four small leg circles
  const hw = ft(3);   // half-width
  const hd = ft(0.75); // half-depth
  return {
    id: 'bench',
    name: 'Bench',
    category: 'furniture',
    description: '6′ × 1.5′ wood bench',
    elements: [
      rect('bench-seat', -hw, -hd, hw * 2, hd * 2, '#8b6f47', 2),
      circle('bench-leg-1', -hw + 8, -hd + 8, 3, '#5a4a32', 1, '#5a4a32'),
      circle('bench-leg-2',  hw - 8, -hd + 8, 3, '#5a4a32', 1, '#5a4a32'),
      circle('bench-leg-3', -hw + 8,  hd - 8, 3, '#5a4a32', 1, '#5a4a32'),
      circle('bench-leg-4',  hw - 8,  hd - 8, 3, '#5a4a32', 1, '#5a4a32'),
    ],
    bbox: { width: hw * 2, height: hd * 2 },
  };
}

function roundTable(): BlockDefinition {
  // 4 ft diameter table with four chairs at compass positions
  const r = ft(2);   // table radius
  const cd = ft(1);  // chair distance from edge → chair center distance from origin
  const cr = ft(0.75); // chair radius
  return {
    id: 'round-table',
    name: 'Round Table + Chairs',
    category: 'furniture',
    description: '4′ table with 4 chairs',
    elements: [
      circle('table', 0, 0, r, '#7a5a3a', 2),
      circle('chair-n', 0, -(r + cd), cr, '#5a4a32', 1.5),
      circle('chair-s', 0,  (r + cd), cr, '#5a4a32', 1.5),
      circle('chair-e',  (r + cd), 0, cr, '#5a4a32', 1.5),
      circle('chair-w', -(r + cd), 0, cr, '#5a4a32', 1.5),
    ],
    bbox: { width: 2 * (r + cd + cr), height: 2 * (r + cd + cr) },
  };
}

function planterSquare(): BlockDefinition {
  // 3 ft × 3 ft outer planter with 2 ft × 2 ft inner pot opening
  const oh = ft(1.5);
  const ih = ft(1);
  return {
    id: 'planter-square',
    name: 'Square Planter',
    category: 'furniture',
    description: '3′ × 3′ square planter',
    elements: [
      rect('planter-outer', -oh, -oh, oh * 2, oh * 2, '#6b5a47', 2),
      rect('planter-inner', -ih, -ih, ih * 2, ih * 2, '#3a2e1f', 1),
    ],
    bbox: { width: oh * 2, height: oh * 2 },
  };
}

function gazebo(): BlockDefinition {
  // 8 ft octagonal gazebo footprint with center post
  const r = ft(4);
  const pts: Array<[number, number]> = [];
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 - Math.PI / 8;
    pts.push([Math.cos(a) * r, Math.sin(a) * r]);
  }
  return {
    id: 'gazebo',
    name: 'Gazebo',
    category: 'structural',
    description: '8′ octagonal gazebo',
    elements: [
      polygon('gazebo-roof', pts, '#5a4a32', 2.5),
      circle('gazebo-post', 0, 0, ft(0.5), '#3a2e1f', 1.5, '#3a2e1f'),
    ],
    bbox: { width: r * 2, height: r * 2 },
  };
}

function pergola(): BlockDefinition {
  // 10 ft × 8 ft pergola with 4 corner posts and slat cross-hatching
  const hw = ft(5);
  const hd = ft(4);
  const slats: CADElement[] = [];
  // 5 cross-slats running across the depth direction
  for (let i = 1; i <= 5; i++) {
    const x = -hw + (i * (hw * 2)) / 6;
    slats.push(line(`pergola-slat-${i}`, x, -hd, x, hd, '#7a6347', 1.5));
  }
  return {
    id: 'pergola',
    name: 'Pergola',
    category: 'structural',
    description: '10′ × 8′ pergola',
    elements: [
      rect('pergola-frame', -hw, -hd, hw * 2, hd * 2, '#5a4a32', 2),
      circle('pergola-post-1', -hw, -hd, ft(0.4), '#3a2e1f', 1.5, '#3a2e1f'),
      circle('pergola-post-2',  hw, -hd, ft(0.4), '#3a2e1f', 1.5, '#3a2e1f'),
      circle('pergola-post-3', -hw,  hd, ft(0.4), '#3a2e1f', 1.5, '#3a2e1f'),
      circle('pergola-post-4',  hw,  hd, ft(0.4), '#3a2e1f', 1.5, '#3a2e1f'),
      ...slats,
    ],
    bbox: { width: hw * 2, height: hd * 2 },
  };
}

function steppingStone(): BlockDefinition {
  // Irregular flagstone footprint
  const r = ft(0.9);
  const pts: Array<[number, number]> = [
    [-r * 0.9, -r * 0.7],
    [ r * 0.6, -r * 0.95],
    [ r * 0.95,  r * 0.2],
    [ r * 0.7,  r * 0.95],
    [-r * 0.4,  r * 0.85],
    [-r * 0.95,  r * 0.1],
  ];
  return {
    id: 'stepping-stone',
    name: 'Stepping Stone',
    category: 'hardscape',
    description: '~1.5′ irregular flagstone',
    elements: [
      polygon('stone', pts, '#7c7a78', 1.5),
    ],
    bbox: { width: r * 2, height: r * 2 },
  };
}

function gate(): BlockDefinition {
  // 4 ft wide gate panel with diagonal X bracing
  const hw = ft(2);
  const hd = ft(0.25);
  return {
    id: 'gate',
    name: 'Gate',
    category: 'structural',
    description: '4′ wood gate panel',
    elements: [
      rect('gate-frame', -hw, -hd, hw * 2, hd * 2, '#8b6f47', 2),
      line('gate-brace-1', -hw, -hd,  hw,  hd, '#5a4a32', 1),
      line('gate-brace-2', -hw,  hd,  hw, -hd, '#5a4a32', 1),
    ],
    bbox: { width: hw * 2, height: hd * 2 },
  };
}

function pathLight(): BlockDefinition {
  // Small path light: outer circle + inner cross
  const r = ft(0.5);
  return {
    id: 'path-light',
    name: 'Path Light',
    category: 'lighting',
    description: 'Low-voltage path uplight',
    elements: [
      circle('light-base', 0, 0, r, '#ffeb3b', 1.5),
      line('light-cross-h', -r * 0.5, 0, r * 0.5, 0, '#7c6f00', 1),
      line('light-cross-v', 0, -r * 0.5, 0, r * 0.5, '#7c6f00', 1),
    ],
    bbox: { width: r * 2, height: r * 2 },
  };
}

/* ------------------------------------------------------------------ */
/*  Catalog                                                             */
/* ------------------------------------------------------------------ */

export const BLOCK_CATALOG: BlockDefinition[] = [
  bench(),
  roundTable(),
  planterSquare(),
  gazebo(),
  pergola(),
  steppingStone(),
  gate(),
  pathLight(),
];

/** Lookup helper used by render + schedule code. */
export function getBlock(blockId: string): BlockDefinition | undefined {
  const builtIn = BLOCK_CATALOG.find((b) => b.id === blockId);
  if (builtIn) return builtIn;
  // Search custom blocks via the registered resolver (set by
  // custom-blocks.ts at module load). Indirect through a registry to
  // avoid a circular import: custom-blocks imports BlockDefinition
  // from this module, so we can't statically import it back.
  return customBlockResolver?.(blockId);
}

/** Custom-blocks module registers itself here on load so getBlock can
 *  consult both catalogs without a circular import. */
let customBlockResolver: ((blockId: string) => BlockDefinition | undefined) | null = null;
export function registerCustomBlockResolver(resolver: (blockId: string) => BlockDefinition | undefined): void {
  customBlockResolver = resolver;
}
