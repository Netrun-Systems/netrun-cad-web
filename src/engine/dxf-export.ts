/**
 * DXF Export — converts internal drawing state to DXF R2013 format.
 * Generates a valid DXF text file compatible with LibreCAD, AutoCAD, etc.
 * All entities are exported to their respective layers.
 */

import type { CADElement, DrawingState, Point } from './types';
import { getBlock } from '../data/blocks';

// ── Constants ────────────────────────────────────────────────────────────────

const PIXELS_PER_FOOT = 48; // must match DEFAULT_GRID.pixelsPerUnit

function pxToFt(px: number): number {
  return px / PIXELS_PER_FOOT;
}

// ── Ramer-Douglas-Peucker stroke simplification ─────────────────────────────
//
// Apple Pencil at 240 Hz writes ~480 points per 2-second stroke. Exporting
// each point as a LWPOLYLINE vertex inflates DXF size 10x+ without any
// visible quality gain. RDP with a small tolerance (~1.5 canvas px ≈ 0.4 in
// at the default scale, well below pen thickness) preserves the stroke shape
// while cutting vertex count by an order of magnitude.

/** Perpendicular distance from point p to the line through a-b. */
function perpDistance(p: [number, number], a: [number, number], b: [number, number]): number {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return Math.hypot(p[0] - a[0], p[1] - a[1]);
  // Cross-product magnitude / segment length
  return Math.abs(dy * p[0] - dx * p[1] + b[0] * a[1] - b[1] * a[0]) / Math.sqrt(lenSq);
}

/**
 * Iterative Ramer-Douglas-Peucker. Returns the simplified point list
 * preserving start + end and any point whose perpendicular distance from
 * the running approximation exceeds `tolerance`.
 */
function simplifyRDP(
  points: Array<[number, number]>,
  tolerance: number,
): Array<[number, number]> {
  if (points.length < 3) return points.slice();

  // Iterative implementation to avoid blowing the stack on long strokes.
  const keep = new Uint8Array(points.length);
  keep[0] = 1;
  keep[points.length - 1] = 1;

  const stack: Array<[number, number]> = [[0, points.length - 1]];
  while (stack.length > 0) {
    const [start, end] = stack.pop()!;
    let maxDist = 0;
    let maxIdx = -1;
    const a = points[start];
    const b = points[end];
    for (let i = start + 1; i < end; i++) {
      const d = perpDistance(points[i], a, b);
      if (d > maxDist) {
        maxDist = d;
        maxIdx = i;
      }
    }
    if (maxIdx !== -1 && maxDist > tolerance) {
      keep[maxIdx] = 1;
      stack.push([start, maxIdx]);
      stack.push([maxIdx, end]);
    }
  }

  const out: Array<[number, number]> = [];
  for (let i = 0; i < points.length; i++) {
    if (keep[i]) out.push(points[i]);
  }
  return out;
}

/** Default RDP tolerance for freehand strokes, in canvas pixels. */
const FREEHAND_DXF_TOLERANCE_PX = 1.5;

// ── Block instance resolution ───────────────────────────────────────────────
//
// DXF has BLOCK + INSERT entities for true block instancing, but they're
// involved (a separate BLOCKS section, attribute definitions, etc.). For v1
// we instead resolve each instance to its child elements with the instance
// transform pre-baked into their geometry — every consumer already handles
// the underlying primitive types, so the export is robust at the cost of
// inlining the geometry per instance.

function transformPoint(p: Point, cx: number, cy: number, cosR: number, sinR: number, scale: number, instX: number, instY: number): Point {
  // Scale + rotate around (cx, cy), then translate to instance position.
  const sx = (p.x - cx) * scale;
  const sy = (p.y - cy) * scale;
  return {
    x: instX + sx * cosR - sy * sinR,
    y: instY + sx * sinR + sy * cosR,
  };
}

function resolveBlockInstance(inst: import('./types').CADBlockInstance): CADElement[] {
  const def = getBlock(inst.blockId);
  if (!def) return [];
  const cosR = Math.cos(inst.rotation);
  const sinR = Math.sin(inst.rotation);
  const tx = (p: Point) => transformPoint(p, 0, 0, cosR, sinR, inst.scale, inst.position.x, inst.position.y);
  const out: CADElement[] = [];
  for (const child of def.elements) {
    switch (child.type) {
      case 'line':
        out.push({ ...child, id: `${inst.id}-${child.id}`, p1: tx(child.p1), p2: tx(child.p2), layerId: inst.layerId });
        break;
      case 'circle': {
        const newCenter = tx(child.center);
        out.push({ ...child, id: `${inst.id}-${child.id}`, center: newCenter, radius: child.radius * inst.scale, layerId: inst.layerId });
        break;
      }
      case 'rectangle': {
        // Rotated rectangles can't stay axis-aligned — convert to a closed
        // 4-vertex polyline so any rotation is preserved in DXF.
        const c0 = tx({ x: child.origin.x, y: child.origin.y });
        const c1 = tx({ x: child.origin.x + child.width, y: child.origin.y });
        const c2 = tx({ x: child.origin.x + child.width, y: child.origin.y + child.height });
        const c3 = tx({ x: child.origin.x, y: child.origin.y + child.height });
        out.push({
          type: 'polyline',
          id: `${inst.id}-${child.id}`,
          points: [c0, c1, c2, c3],
          closed: true,
          layerId: inst.layerId,
          strokeColor: child.strokeColor,
          strokeWidth: child.strokeWidth,
        });
        break;
      }
      case 'polyline':
        out.push({
          ...child,
          id: `${inst.id}-${child.id}`,
          points: child.points.map((p) => tx(p)),
          layerId: inst.layerId,
        });
        break;
      // Other element types in blocks aren't supported yet (text/plant in a
      // block would need their own resolution); silently skip.
    }
  }
  return out;
}

// In DXF, Y axis is flipped relative to canvas (canvas Y grows down, DXF Y grows up)
function canvasYToDXF(y: number): number {
  return -pxToFt(y);
}

function canvasXToDXF(x: number): number {
  return pxToFt(x);
}

// ── Handle counter ───────────────────────────────────────────────────────────

let handleCounter = 0x100;
function nextHandle(): string {
  return (handleCounter++).toString(16).toUpperCase();
}

// ── DXF section builders ─────────────────────────────────────────────────────

function dxfHeader(): string {
  return `  0
SECTION
  2
HEADER
  9
$ACADVER
  1
AC1027
  9
$DWGCODEPAGE
  3
ANSI_1252
  9
$INSUNITS
 70
2
  0
ENDSEC
`;
}

function dxfClasses(): string {
  return `  0
SECTION
  2
CLASSES
  0
ENDSEC
`;
}

function dxfTables(layerNames: string[]): string {
  const layerDefs = layerNames
    .map(
      (name) => `  0
LAYER
  5
${nextHandle()}
100
AcDbSymbolTableRecord
100
AcDbLayerTableRecord
  2
${name}
 70
0
 62
7
  6
Continuous`
    )
    .join('\n');

  return `  0
SECTION
  2
TABLES
  0
TABLE
  2
LTYPE
  5
${nextHandle()}
100
AcDbSymbolTable
 70
1
  0
LTYPE
  5
${nextHandle()}
100
AcDbSymbolTableRecord
100
AcDbLinetypeTableRecord
  2
Continuous
 70
0
  3
Solid line
 72
65
 73
0
 40
0.0
  0
ENDTAB
  0
TABLE
  2
LAYER
  5
${nextHandle()}
100
AcDbSymbolTable
 70
${layerNames.length}
${layerDefs}
  0
ENDTAB
  0
TABLE
  2
STYLE
  5
${nextHandle()}
100
AcDbSymbolTable
 70
1
  0
STYLE
  5
${nextHandle()}
100
AcDbSymbolTableRecord
100
AcDbTextStyleTableRecord
  2
Standard
 70
0
 40
0.0
 41
1.0
 42
0.2
 50
0.0
 71
0
  3
txt
  0
ENDTAB
  0
ENDSEC
`;
}

function dxfBlocks(): string {
  return `  0
SECTION
  2
BLOCKS
  0
BLOCK
  5
${nextHandle()}
100
AcDbEntity
  8
0
100
AcDbBlockBegin
  2
*Model_Space
 70
0
 10
0.0
 20
0.0
 30
0.0
  3
*Model_Space
  1

  0
ENDBLK
  5
${nextHandle()}
100
AcDbEntity
  8
0
100
AcDbBlockEnd
  0
ENDSEC
`;
}

// ── Entity serializers ────────────────────────────────────────────────────────

function entityLine(
  x1: number, y1: number, x2: number, y2: number,
  layer: string
): string {
  return `  0
LINE
  5
${nextHandle()}
100
AcDbEntity
  8
${layer}
100
AcDbLine
 10
${x1.toFixed(4)}
 20
${y1.toFixed(4)}
 30
0.0
 11
${x2.toFixed(4)}
 21
${y2.toFixed(4)}
 31
0.0`;
}

function entityCircle(
  cx: number, cy: number, r: number, layer: string
): string {
  return `  0
CIRCLE
  5
${nextHandle()}
100
AcDbEntity
  8
${layer}
100
AcDbCircle
 10
${cx.toFixed(4)}
 20
${cy.toFixed(4)}
 30
0.0
 40
${r.toFixed(4)}`;
}

function entityArc(
  cx: number, cy: number, r: number,
  startAngleDeg: number, endAngleDeg: number,
  layer: string,
): string {
  return `  0
ARC
  5
${nextHandle()}
100
AcDbEntity
  8
${layer}
100
AcDbCircle
 10
${cx.toFixed(4)}
 20
${cy.toFixed(4)}
 30
0.0
 40
${r.toFixed(4)}
100
AcDbArc
 50
${startAngleDeg.toFixed(4)}
 51
${endAngleDeg.toFixed(4)}`;
}

function entityLWPolyline(
  points: Array<[number, number]>,
  closed: boolean,
  layer: string
): string {
  const flag = closed ? 1 : 0;
  const ptLines = points.map(([x, y]) => ` 10\n${x.toFixed(4)}\n 20\n${y.toFixed(4)}`).join('\n');
  return `  0
LWPOLYLINE
  5
${nextHandle()}
100
AcDbEntity
  8
${layer}
100
AcDbPolyline
 90
${points.length}
 70
${flag}
 43
0.0
${ptLines}`;
}

function entityText(
  x: number, y: number, content: string, height: number,
  rotation: number, layer: string
): string {
  return `  0
TEXT
  5
${nextHandle()}
100
AcDbEntity
  8
${layer}
100
AcDbText
 10
${x.toFixed(4)}
 20
${y.toFixed(4)}
 30
0.0
 40
${height.toFixed(4)}
  1
${content}
 50
${rotation.toFixed(2)}
 72
0
 11
${x.toFixed(4)}
 21
${y.toFixed(4)}
 31
0.0
100
AcDbText`;
}

// ── Element → DXF entity ──────────────────────────────────────────────────────

function elementToEntities(el: CADElement, layerName: string): string[] {
  const entities: string[] = [];

  switch (el.type) {
    case 'line': {
      entities.push(entityLine(
        canvasXToDXF(el.p1.x), canvasYToDXF(el.p1.y),
        canvasXToDXF(el.p2.x), canvasYToDXF(el.p2.y),
        layerName
      ));
      break;
    }

    case 'rectangle': {
      const x = canvasXToDXF(el.origin.x);
      const y = canvasYToDXF(el.origin.y);
      const w = pxToFt(el.width);
      const h = pxToFt(el.height);
      // Export rectangle as closed LWPOLYLINE
      entities.push(entityLWPolyline([
        [x,     y],
        [x + w, y],
        [x + w, y - h],
        [x,     y - h],
      ], true, layerName));
      break;
    }

    case 'circle': {
      entities.push(entityCircle(
        canvasXToDXF(el.center.x),
        canvasYToDXF(el.center.y),
        pxToFt(el.radius),
        layerName
      ));
      break;
    }

    case 'dimension': {
      // Export as two lines + text
      const x1 = canvasXToDXF(el.p1.x);
      const y1 = canvasYToDXF(el.p1.y);
      const x2 = canvasXToDXF(el.p2.x);
      const y2 = canvasYToDXF(el.p2.y);
      const offFt = pxToFt(el.offset);
      const angle = Math.atan2(y2 - y1, x2 - x1) + Math.PI / 2;
      const ox = Math.cos(angle) * offFt;
      const oy = Math.sin(angle) * offFt;
      entities.push(entityLine(x1, y1, x1 + ox, y1 + oy, layerName));
      entities.push(entityLine(x2, y2, x2 + ox, y2 + oy, layerName));
      entities.push(entityLine(x1 + ox, y1 + oy, x2 + ox, y2 + oy, layerName));
      if (el.label) {
        const mx = (x1 + x2) / 2 + ox;
        const my = (y1 + y2) / 2 + oy;
        entities.push(entityText(mx, my, el.label, 0.2, 0, layerName));
      }
      break;
    }

    case 'freehand': {
      if (el.points.length < 2) break;
      // Simplify the stroke before LWPOLYLINE conversion. Apple Pencil at
      // 240 Hz produces dense point streams; RDP cuts vertex count 10x+
      // without visible quality loss because the tolerance (1.5 canvas px)
      // is well below stroke thickness.
      const canvasPts: Array<[number, number]> = el.points.map((p) => [p.x, p.y]);
      const simplified = simplifyRDP(canvasPts, FREEHAND_DXF_TOLERANCE_PX);
      const pts: Array<[number, number]> = simplified.map(([x, y]) => [
        canvasXToDXF(x),
        canvasYToDXF(y),
      ]);
      entities.push(entityLWPolyline(pts, false, layerName));
      break;
    }

    case 'polyline': {
      if (el.points.length < 2) break;
      const pts: Array<[number, number]> = el.points.map((p) => [
        canvasXToDXF(p.x),
        canvasYToDXF(p.y),
      ]);
      entities.push(entityLWPolyline(pts, !!el.closed, layerName));
      break;
    }

    case 'arc': {
      // DXF angles are degrees CCW from +X. Canvas Y points down, but the
      // DXF Y axis points up — canvasYToDXF flips Y, which also reflects
      // angles across the X axis. To preserve the visual orientation,
      // negate the start/end angles.
      const startDeg = (-el.startAngle * 180) / Math.PI;
      const endDegRaw = (-el.endAngle * 180) / Math.PI;
      // DXF ARC sweeps CCW from start to end. We negated, so swap to
      // restore the original sweep direction (canvas was CW visually).
      const start = endDegRaw;
      const end = startDeg;
      entities.push(entityArc(
        canvasXToDXF(el.center.x),
        canvasYToDXF(el.center.y),
        pxToFt(el.radius),
        ((start % 360) + 360) % 360,
        ((end % 360) + 360) % 360,
        layerName,
      ));
      break;
    }

    case 'ellipse': {
      // DXF ELLIPSE entity is well-defined but more involved (major-axis
      // vector + minor:major ratio). For v1 we approximate with a 64-vertex
      // closed polyline — every consumer (AutoCAD, LibreCAD, plotter
      // drivers) handles polylines fine, and 64 vertices is visually
      // smooth at typical print scales.
      const SEG = 64;
      const pts: Array<[number, number]> = [];
      const rot = el.rotation ?? 0;
      const cosR = Math.cos(rot);
      const sinR = Math.sin(rot);
      for (let i = 0; i < SEG; i++) {
        const a = (i / SEG) * Math.PI * 2;
        const lx = el.rx * Math.cos(a);
        const ly = el.ry * Math.sin(a);
        // Apply rotation, then translate to center
        const wx = el.center.x + lx * cosR - ly * sinR;
        const wy = el.center.y + lx * sinR + ly * cosR;
        pts.push([canvasXToDXF(wx), canvasYToDXF(wy)]);
      }
      entities.push(entityLWPolyline(pts, true, layerName));
      break;
    }

    case 'text': {
      const x = canvasXToDXF(el.position.x);
      const y = canvasYToDXF(el.position.y);
      const heightFt = pxToFt(el.fontSize);
      entities.push(entityText(x, y, el.content, heightFt, el.rotation, layerName));
      break;
    }

    case 'plant': {
      // Export plants as circles with label text
      entities.push(entityCircle(
        canvasXToDXF(el.position.x),
        canvasYToDXF(el.position.y),
        pxToFt(20), // approximate radius in feet
        layerName
      ));
      if (el.label) {
        entities.push(entityText(
          canvasXToDXF(el.position.x),
          canvasYToDXF(el.position.y),
          el.label,
          0.5,
          0,
          layerName
        ));
      }
      break;
    }
  }

  return entities;
}

// ── Download helper ──────────────────────────────────────────────────────────

function downloadText(filename: string, content: string): void {
  const blob = new Blob([content], { type: 'application/dxf' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ── Public API ───────────────────────────────────────────────────────────────

/**
 * Generate DXF string from the current drawing state.
 * Can be used for both download and Drive upload.
 */
export function generateDXFString(state: DrawingState): string {
  handleCounter = 0x100; // reset handle counter

  const layerMap = new Map(state.layers.map((l) => [l.id, l]));
  const visibleLayers = state.layers.filter((l) => l.visible);
  const layerNames = visibleLayers.map((l) => l.name);

  const entityStrings: string[] = [];

  for (const el of state.elements) {
    const layer = layerMap.get(el.layerId);
    if (!layer || !layer.visible) continue;
    if (el.type === 'block') {
      // Resolve the instance to its baked-transform child elements and
      // dispatch each through the same per-element export path.
      for (const child of resolveBlockInstance(el)) {
        entityStrings.push(...elementToEntities(child, layer.name));
      }
      continue;
    }
    const entities = elementToEntities(el, layer.name);
    entityStrings.push(...entities);
  }

  return [
    dxfHeader(),
    dxfClasses(),
    dxfTables(layerNames),
    dxfBlocks(),
    `  0\nSECTION\n  2\nENTITIES`,
    ...entityStrings,
    `  0\nENDSEC`,
    `  0\nSECTION\n  2\nOBJECTS\n  0\nDICTIONARY\n  5\n${nextHandle()}\n100\nAcDbDictionary\n281\n1\n  0\nENDSEC`,
    `  0\nEOF`,
  ].join('\n');
}

/**
 * Export the current drawing state to a DXF R2013 file and trigger download.
 */
export function exportDXF(state: DrawingState, filename = 'landscape-plan.dxf'): void {
  const dxf = generateDXFString(state);
  downloadText(filename, dxf);
}
