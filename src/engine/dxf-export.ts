/**
 * DXF Export — converts internal drawing state to DXF R2013 format.
 * Generates a valid DXF text file compatible with LibreCAD, AutoCAD, etc.
 * All entities are exported to their respective layers.
 */

import type { CADElement, DrawingState } from './types';

// ── Constants ────────────────────────────────────────────────────────────────

const PIXELS_PER_FOOT = 48; // must match DEFAULT_GRID.pixelsPerUnit

function pxToFt(px: number): number {
  return px / PIXELS_PER_FOOT;
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
      // Export freehand as LWPOLYLINE (centreline approximation)
      const pts: Array<[number, number]> = el.points.map((p) => [
        canvasXToDXF(p.x),
        canvasYToDXF(p.y),
      ]);
      entities.push(entityLWPolyline(pts, false, layerName));
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
 * Export the current drawing state to a DXF R2013 file and trigger download.
 */
export function exportDXF(state: DrawingState, filename = 'landscape-plan.dxf'): void {
  handleCounter = 0x100; // reset handle counter

  const layerMap = new Map(state.layers.map((l) => [l.id, l]));
  const visibleLayers = state.layers.filter((l) => l.visible);
  const layerNames = visibleLayers.map((l) => l.name);

  // Collect entity strings
  const entityStrings: string[] = [];

  for (const el of state.elements) {
    const layer = layerMap.get(el.layerId);
    if (!layer || !layer.visible) continue;
    const entities = elementToEntities(el, layer.name);
    entityStrings.push(...entities);
  }

  const dxf = [
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

  downloadText(filename, dxf);
}
