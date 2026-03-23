/**
 * Interior Symbol Library
 *
 * Defines architectural plan-view symbols for interior layout.
 * All dimensions are in feet (1 unit = 1 foot).
 * Symbols are rendered as simple geometric shapes (no images) by interior-renderer.ts.
 *
 * Shape vocabulary:
 *   'toilet'       — oval tank + smaller oval bowl
 *   'sink'         — rectangle with inset oval basin
 *   'bathtub'      — rounded rectangle with faucet mark
 *   'shower'       — square with diagonal lines (shower drain symbol)
 *   'stove'        — rectangle with 4 circle burners
 *   'refrigerator' — rectangle with handle line
 *   'dishwasher'   — rectangle (plain)
 *   'double-sink'  — rectangle with two inset ovals
 *   'island'       — plain rectangle
 *   'sofa'         — rectangle with arm rests (three-part rectangle)
 *   'chair'        — square with back arc
 *   'table'        — rectangle (plain)
 *   'bed'          — rectangle with pillow bumps at head
 *   'desk'         — plain rectangle
 *   'door-arc'     — arc swing (90° quarter circle + door line)
 *   'door-slide'   — parallel lines showing sliding door track
 *   'window'       — double parallel lines with gap
 *   'stairs'       — parallel lines with arrow
 *   'washer'       — circle inside square
 *   'dryer'        — circle inside square
 *   'circle'       — plain circle
 */

export type InteriorSymbolShape =
  | 'toilet'
  | 'sink'
  | 'bathtub'
  | 'shower'
  | 'stove'
  | 'refrigerator'
  | 'dishwasher'
  | 'double-sink'
  | 'island'
  | 'sofa'
  | 'chair'
  | 'table'
  | 'bed'
  | 'desk'
  | 'door-arc'
  | 'door-slide'
  | 'window'
  | 'stairs'
  | 'washer'
  | 'dryer'
  | 'circle';

export interface InteriorSymbolDef {
  /** Display width in feet */
  width: number;
  /** Display depth (height in plan view) in feet */
  depth: number;
  /** Rendering shape type */
  shape: InteriorSymbolShape;
  /** Human-readable display name */
  label: string;
  /** Category for panel grouping */
  category: 'bathroom' | 'kitchen' | 'living' | 'bedroom' | 'architectural' | 'utility';
}

export const INTERIOR_SYMBOLS: Record<string, InteriorSymbolDef> = {
  // ── Bathroom ──────────────────────────────────────────────────────────────
  'toilet': {
    width: 1.5,
    depth: 2.5,
    shape: 'toilet',
    label: 'Toilet',
    category: 'bathroom',
  },
  'sink': {
    width: 2,
    depth: 1.5,
    shape: 'sink',
    label: 'Sink',
    category: 'bathroom',
  },
  'bathtub': {
    width: 2.5,
    depth: 5,
    shape: 'bathtub',
    label: 'Bathtub',
    category: 'bathroom',
  },
  'shower': {
    width: 3,
    depth: 3,
    shape: 'shower',
    label: 'Shower',
    category: 'bathroom',
  },

  // ── Kitchen ───────────────────────────────────────────────────────────────
  'stove': {
    width: 2.5,
    depth: 2,
    shape: 'stove',
    label: 'Stove / Range',
    category: 'kitchen',
  },
  'refrigerator': {
    width: 3,
    depth: 2.5,
    shape: 'refrigerator',
    label: 'Refrigerator',
    category: 'kitchen',
  },
  'dishwasher': {
    width: 2,
    depth: 2,
    shape: 'dishwasher',
    label: 'Dishwasher',
    category: 'kitchen',
  },
  'kitchen-sink': {
    width: 3,
    depth: 2,
    shape: 'double-sink',
    label: 'Kitchen Sink',
    category: 'kitchen',
  },
  'kitchen-island': {
    width: 4,
    depth: 6,
    shape: 'island',
    label: 'Kitchen Island',
    category: 'kitchen',
  },

  // ── Living ────────────────────────────────────────────────────────────────
  'sofa': {
    width: 3,
    depth: 7,
    shape: 'sofa',
    label: 'Sofa',
    category: 'living',
  },
  'chair': {
    width: 2.5,
    depth: 2.5,
    shape: 'chair',
    label: 'Chair',
    category: 'living',
  },
  'dining-table': {
    width: 3.5,
    depth: 6,
    shape: 'table',
    label: 'Dining Table',
    category: 'living',
  },

  // ── Bedroom ───────────────────────────────────────────────────────────────
  'bed-king': {
    width: 6.5,
    depth: 6.8,
    shape: 'bed',
    label: 'Bed (King)',
    category: 'bedroom',
  },
  'bed-queen': {
    width: 5,
    depth: 6.8,
    shape: 'bed',
    label: 'Bed (Queen)',
    category: 'bedroom',
  },
  'bed-twin': {
    width: 3.2,
    depth: 6.3,
    shape: 'bed',
    label: 'Bed (Twin)',
    category: 'bedroom',
  },
  'desk': {
    width: 2,
    depth: 4,
    shape: 'desk',
    label: 'Desk',
    category: 'bedroom',
  },

  // ── Architectural ─────────────────────────────────────────────────────────
  'door-swing': {
    width: 3,
    depth: 3,
    shape: 'door-arc',
    label: 'Door (Swing)',
    category: 'architectural',
  },
  'door-sliding': {
    width: 6,
    depth: 0.5,
    shape: 'door-slide',
    label: 'Door (Sliding)',
    category: 'architectural',
  },
  'window': {
    width: 3,
    depth: 0.5,
    shape: 'window',
    label: 'Window',
    category: 'architectural',
  },
  'stairs-up': {
    width: 3,
    depth: 10,
    shape: 'stairs',
    label: 'Stairs',
    category: 'architectural',
  },

  // ── Utility ───────────────────────────────────────────────────────────────
  'washer': {
    width: 2.5,
    depth: 2.5,
    shape: 'washer',
    label: 'Washer',
    category: 'utility',
  },
  'dryer': {
    width: 2.5,
    depth: 2.5,
    shape: 'dryer',
    label: 'Dryer',
    category: 'utility',
  },
  'water-heater': {
    width: 2,
    depth: 2,
    shape: 'circle',
    label: 'Water Heater',
    category: 'utility',
  },
};

export type SymbolCategory = InteriorSymbolDef['category'];

export const CATEGORY_LABELS: Record<SymbolCategory, string> = {
  bathroom: 'Bathroom',
  kitchen: 'Kitchen',
  living: 'Living',
  bedroom: 'Bedroom',
  architectural: 'Architectural',
  utility: 'Utilities',
};

/** Group symbols by category for panel display */
export function groupByCategory(): Map<SymbolCategory, Array<{ key: string; def: InteriorSymbolDef }>> {
  const groups = new Map<SymbolCategory, Array<{ key: string; def: InteriorSymbolDef }>>();
  for (const [key, def] of Object.entries(INTERIOR_SYMBOLS)) {
    if (!groups.has(def.category)) {
      groups.set(def.category, []);
    }
    groups.get(def.category)!.push({ key, def });
  }
  return groups;
}
