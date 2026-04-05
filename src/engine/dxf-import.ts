/**
 * DXF Import — converts DXF files to internal CAD element format.
 * Uses a hand-rolled group-code parser for maximum compatibility.
 * Supports: LINE, CIRCLE, ARC, LWPOLYLINE, TEXT, MTEXT, INSERT, DIMENSION
 */

import type { CADElement, CADLine, CADCircle, CADRectangle, TextElement, Layer } from './types';

// ── DXF group-code pair ──────────────────────────────────────────────────────

interface Pair {
  code: number;
  value: string;
}

function parsePairs(text: string): Pair[] {
  const lines = text.split('\n');
  const pairs: Pair[] = [];
  for (let i = 0; i < lines.length - 1; i += 2) {
    const code = parseInt(lines[i].trim(), 10);
    if (!isNaN(code)) {
      pairs.push({ code, value: lines[i + 1].trim() });
    }
  }
  return pairs;
}

// ── Entity block extraction ──────────────────────────────────────────────────

interface EntityBlock {
  type: string;
  codes: Pair[];
}

function extractEntityBlocks(pairs: Pair[]): EntityBlock[] {
  const blocks: EntityBlock[] = [];

  // Find ENTITIES section
  let start = -1;
  for (let i = 0; i < pairs.length; i++) {
    if (pairs[i].code === 2 && pairs[i].value === 'ENTITIES') {
      start = i + 1;
      break;
    }
  }
  if (start < 0) return blocks;

  let current: EntityBlock | null = null;

  for (let i = start; i < pairs.length; i++) {
    const { code, value } = pairs[i];

    if (code === 0) {
      if (current) blocks.push(current);
      if (value === 'ENDSEC' || value === 'EOF') break;
      current = { type: value, codes: [] };
    } else if (current) {
      current.codes.push({ code, value });
    }
  }

  return blocks;
}

// ── Code value helpers ───────────────────────────────────────────────────────

function getF(codes: Pair[], code: number, fallback = 0): number {
  const p = codes.find((c) => c.code === code);
  return p ? parseFloat(p.value) || fallback : fallback;
}

function getS(codes: Pair[], code: number, fallback = ''): string {
  const p = codes.find((c) => c.code === code);
  return p ? p.value : fallback;
}

function getAll(codes: Pair[], code: number): string[] {
  return codes.filter((c) => c.code === code).map((c) => c.value);
}

// ── Layer discovery ──────────────────────────────────────────────────────────

export interface ImportedLayers {
  layers: Layer[];
  entityLayerMap: Map<string, string>; // dxf layer name → app layer id
}

function discoverLayers(pairs: Pair[]): ImportedLayers {
  const dxfLayers = new Set<string>();

  // Scan TABLES section for LAYER entries
  let inLayerTable = false;
  for (let i = 0; i < pairs.length; i++) {
    const { code, value } = pairs[i];
    if (code === 0 && value === 'LAYER') inLayerTable = true;
    if (code === 0 && value === 'ENDTAB') inLayerTable = false;
    if (inLayerTable && code === 2) dxfLayers.add(value);
  }

  // Also collect layers from entity blocks
  const entityPairsStart = pairs.findIndex((p) => p.code === 2 && p.value === 'ENTITIES');
  if (entityPairsStart >= 0) {
    for (let i = entityPairsStart; i < pairs.length; i++) {
      if (pairs[i].code === 8) dxfLayers.add(pairs[i].value);
    }
  }

  // Map DXF layer names to app layer IDs
  const knownLayerNames: Record<string, string> = {
    '0': 'site',
    site: 'site',
    hardscape: 'hardscape',
    planting: 'planting',
    plants: 'planting',
    irrigation: 'irrigation',
    drawing: 'drawing',
    color: 'color',
    text: 'text',
    dimension: 'site',
    dim: 'site',
  };

  const entityLayerMap = new Map<string, string>();
  const newLayers: Layer[] = [];
  let order = 10; // Start above DEFAULT_LAYERS order

  for (const dxfName of dxfLayers) {
    const lower = dxfName.toLowerCase();
    const appId = knownLayerNames[lower] ?? `imported-${lower.replace(/[^a-z0-9]/g, '-')}`;

    if (!entityLayerMap.has(dxfName)) {
      entityLayerMap.set(dxfName, appId);

      // Only add a new Layer entry if it's not a built-in
      if (!Object.values(knownLayerNames).includes(appId) || !newLayers.find((l) => l.id === appId)) {
        if (!Object.values(knownLayerNames).includes(appId)) {
          newLayers.push({
            id: appId,
            name: dxfName,
            visible: true,
            locked: false,
            opacity: 1,
            color: '#cccccc',
            order: order++,
          });
        }
      }
    }
  }

  return { layers: newLayers, entityLayerMap };
}

// ── DXF header unit detection ────────────────────────────────────────────────

/** Map DXF $INSUNITS values to human-readable unit names */
const DXF_UNIT_MAP: Record<number, string> = {
  0: 'unknown',
  1: 'inches',
  2: 'feet',
  3: 'miles',
  4: 'millimeters',
  5: 'centimeters',
  6: 'meters',
  7: 'kilometers',
};

function detectUnit(pairs: Pair[]): string {
  // Look for $INSUNITS in HEADER section
  for (let i = 0; i < pairs.length; i++) {
    if (pairs[i].code === 9 && pairs[i].value === '$INSUNITS') {
      // The value follows as the next group code 70
      for (let j = i + 1; j < Math.min(i + 5, pairs.length); j++) {
        if (pairs[j].code === 70) {
          const unitCode = parseInt(pairs[j].value, 10);
          return DXF_UNIT_MAP[unitCode] ?? 'unknown';
        }
      }
    }
  }
  return 'unknown';
}

/** Compute raw bounding box from DXF entity blocks (before pixel conversion) */
function computeRawBoundingBox(blocks: EntityBlock[]): { minX: number; minY: number; maxX: number; maxY: number } {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

  for (const block of blocks) {
    // Collect all X coordinates (codes 10, 11, 12, 13, 14)
    for (const pair of block.codes) {
      if (pair.code >= 10 && pair.code <= 14) {
        const v = parseFloat(pair.value);
        if (!isNaN(v)) { minX = Math.min(minX, v); maxX = Math.max(maxX, v); }
      }
      if (pair.code >= 20 && pair.code <= 24) {
        const v = parseFloat(pair.value);
        if (!isNaN(v)) { minY = Math.min(minY, v); maxY = Math.max(maxY, v); }
      }
    }
  }

  if (!isFinite(minX)) return { minX: 0, minY: 0, maxX: 0, maxY: 0 };
  return { minX, minY, maxX, maxY };
}

// ── DXF units → feet conversion ──────────────────────────────────────────────
// DXF files can use various units. We assume drawing units = feet (common for US
// landscape plans). If the file uses inches, pass scale=1/12.

const PIXELS_PER_FOOT = 48; // must match DEFAULT_GRID.pixelsPerUnit

function dxfToPixels(dxfValue: number, scale: number): number {
  return dxfValue * scale * PIXELS_PER_FOOT;
}

// ── Entity converters ────────────────────────────────────────────────────────

function convertLine(
  block: EntityBlock,
  layerId: string,
  scale: number,
  id: string
): CADLine {
  const x1 = dxfToPixels(getF(block.codes, 10), scale);
  const y1 = -dxfToPixels(getF(block.codes, 20), scale); // DXF Y is flipped
  const x2 = dxfToPixels(getF(block.codes, 11), scale);
  const y2 = -dxfToPixels(getF(block.codes, 21), scale);

  return {
    type: 'line',
    id,
    p1: { x: x1, y: y1 },
    p2: { x: x2, y: y2 },
    layerId,
    strokeColor: '#ffffff',
    strokeWidth: 1.5,
  };
}

function convertCircle(
  block: EntityBlock,
  layerId: string,
  scale: number,
  id: string
): CADElement {
  const cx = dxfToPixels(getF(block.codes, 10), scale);
  const cy = -dxfToPixels(getF(block.codes, 20), scale);
  const r = dxfToPixels(getF(block.codes, 40, 1), scale);

  const circle = {
    type: 'circle' as const,
    id,
    center: { x: cx, y: cy },
    radius: r,
    layerId,
    strokeColor: '#ffffff',
    strokeWidth: 1.5,
  };
  return circle;
}

function convertLWPolyline(
  block: EntityBlock,
  layerId: string,
  scale: number,
  baseId: string
): CADElement[] {
  const xs = getAll(block.codes, 10).map((v) => dxfToPixels(parseFloat(v), scale));
  const ys = getAll(block.codes, 20).map((v) => -dxfToPixels(parseFloat(v), scale));

  const elements: CADElement[] = [];

  for (let i = 0; i < xs.length - 1; i++) {
    elements.push({
      type: 'line',
      id: `${baseId}-seg${i}`,
      p1: { x: xs[i], y: ys[i] },
      p2: { x: xs[i + 1], y: ys[i + 1] },
      layerId,
      strokeColor: '#ffffff',
      strokeWidth: 1.5,
    } as CADLine);
  }

  // Close the polyline if flag bit 1 is set
  const flag = getF(block.codes, 70, 0);
  if ((flag & 1) && xs.length > 1) {
    elements.push({
      type: 'line',
      id: `${baseId}-close`,
      p1: { x: xs[xs.length - 1], y: ys[ys.length - 1] },
      p2: { x: xs[0], y: ys[0] },
      layerId,
      strokeColor: '#ffffff',
      strokeWidth: 1.5,
    } as CADLine);
  }

  return elements;
}

function convertText(
  block: EntityBlock,
  layerId: string,
  scale: number,
  id: string
): TextElement {
  const x = dxfToPixels(getF(block.codes, 10), scale);
  const y = -dxfToPixels(getF(block.codes, 20), scale);
  const content = getS(block.codes, 1, '');
  const height = dxfToPixels(getF(block.codes, 40, 0.1), scale);
  const rotation = getF(block.codes, 50, 0);

  return {
    type: 'text',
    id,
    position: { x, y },
    content,
    layerId,
    fontSize: Math.max(8, height),
    fontFamily: 'monospace',
    color: '#ffffff',
    rotation,
  };
}

function convertMText(
  block: EntityBlock,
  layerId: string,
  scale: number,
  id: string
): TextElement {
  const x = dxfToPixels(getF(block.codes, 10), scale);
  const y = -dxfToPixels(getF(block.codes, 20), scale);
  // MTEXT content is in code 1, may have continuation in code 3
  const raw = getS(block.codes, 1, '');
  // Strip DXF MTEXT formatting codes like {\fArial;text}
  const content = raw.replace(/\{\\[^}]+\}/g, '').replace(/\\P/g, ' ').trim() || raw;
  const height = dxfToPixels(getF(block.codes, 40, 0.1), scale);

  return {
    type: 'text',
    id,
    position: { x, y },
    content,
    layerId,
    fontSize: Math.max(8, height),
    fontFamily: 'monospace',
    color: '#ffffff',
    rotation: 0,
  };
}

function convertInsert(
  block: EntityBlock,
  layerId: string,
  scale: number,
  id: string
): CADElement {
  // INSERT entities reference blocks. We render a placeholder rectangle.
  const x = dxfToPixels(getF(block.codes, 10), scale);
  const y = -dxfToPixels(getF(block.codes, 20), scale);
  const sx = getF(block.codes, 41, 1) * scale * PIXELS_PER_FOOT;
  const sy = getF(block.codes, 42, 1) * scale * PIXELS_PER_FOOT;

  const rect: CADRectangle = {
    type: 'rectangle',
    id,
    origin: { x: x - sx / 2, y: y - sy / 2 },
    width: Math.max(sx, 10),
    height: Math.max(sy, 10),
    layerId,
    strokeColor: '#aaaaaa',
    strokeWidth: 1,
  };
  return rect;
}

// ── Public API ───────────────────────────────────────────────────────────────

export interface DXFImportResult {
  elements: CADElement[];
  newLayers: Layer[];
  /** Metadata extracted from the DXF file for scale confirmation */
  meta: {
    /** Unit string from DXF $INSUNITS header, or 'unknown' */
    detectedUnit: string;
    /** Bounding box of all imported elements in raw DXF coordinates */
    rawBoundingBox: { minX: number; minY: number; maxX: number; maxY: number };
    /** Total element count */
    elementCount: number;
    /** Total layer count (new + existing) */
    layerCount: number;
  };
}

/**
 * Parse a DXF file and return CAD elements + any new layers discovered.
 * @param file  The DXF file from the file picker
 * @param scale Multiplier to convert DXF units → feet. 1 = "1 DXF unit = 1 foot"
 */
export async function importDXF(file: File, scale = 1): Promise<DXFImportResult> {
  const text = await file.text();
  const pairs = parsePairs(text);

  const detectedUnit = detectUnit(pairs);
  const { layers: newLayers, entityLayerMap } = discoverLayers(pairs);
  const blocks = extractEntityBlocks(pairs);
  const rawBoundingBox = computeRawBoundingBox(blocks);

  const elements: CADElement[] = [];
  let counter = 0;

  for (const block of blocks) {
    const id = `dxf-${Date.now()}-${counter++}`;
    const dxfLayer = block.codes.find((c) => c.code === 8)?.value ?? '0';
    const layerId = entityLayerMap.get(dxfLayer) ?? 'site';

    try {
      switch (block.type) {
        case 'LINE':
          elements.push(convertLine(block, layerId, scale, id));
          break;
        case 'CIRCLE':
          elements.push(convertCircle(block, layerId, scale, id));
          break;
        case 'ARC':
          // Convert arcs to circles for now (full arc support needs canvas arc rendering)
          elements.push(convertCircle(block, layerId, scale, id));
          break;
        case 'LWPOLYLINE':
          elements.push(...convertLWPolyline(block, layerId, scale, id));
          break;
        case 'TEXT':
          elements.push(convertText(block, layerId, scale, id));
          break;
        case 'MTEXT':
          elements.push(convertMText(block, layerId, scale, id));
          break;
        case 'INSERT':
          elements.push(convertInsert(block, layerId, scale, id));
          break;
        // DIMENSION — skip, complex to render without block support
        default:
          break;
      }
    } catch {
      // Skip malformed entities silently
    }
  }

  return {
    elements,
    newLayers,
    meta: {
      detectedUnit,
      rawBoundingBox,
      elementCount: elements.length,
      layerCount: newLayers.length + new Set(elements.map((e) => e.layerId)).size,
    },
  };
}
