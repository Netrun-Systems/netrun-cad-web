/**
 * IFC Import — parses Industry Foundation Classes files in the browser
 * using web-ifc and converts BIM elements to internal CAD format.
 *
 * Projects 3D IFC coordinates to a 2D plan view (X, Y; Z ignored).
 */

import * as WebIFC from 'web-ifc';
import type { CADElement, CADLine, CADCircle, Layer } from './types';

// ── Constants ────────────────────────────────────────────────────────────────

const PIXELS_PER_FOOT = 48; // must match DEFAULT_GRID.pixelsPerUnit

/** Metres-to-feet conversion (IFC default unit is metres) */
const M_TO_FT = 3.28084;

// ── IFC Layer Mapping ────────────────────────────────────────────────────────

const IFC_LAYER_MAP: Record<string, { layerId: string; name: string; color: string }> = {
  IFCWALL:              { layerId: 'ifc-wall',     name: 'IFC Walls',           color: '#9ca3af' },
  IFCWALLSTANDARDCASE:  { layerId: 'ifc-wall',     name: 'IFC Walls',           color: '#9ca3af' },
  IFCDOOR:              { layerId: 'ifc-door',     name: 'IFC Doors',           color: '#a0826d' },
  IFCWINDOW:            { layerId: 'ifc-window',   name: 'IFC Windows',         color: '#60a5fa' },
  IFCFLOWSEGMENT:       { layerId: 'ifc-pipe',     name: 'IFC Pipes/Segments',  color: '#3b82f6' },
  IFCFLOWFITTING:       { layerId: 'ifc-fitting',  name: 'IFC Fittings',        color: '#06b6d4' },
  IFCFLOWTERMINAL:      { layerId: 'ifc-terminal', name: 'IFC Terminals',       color: '#ef4444' },
  IFCSLAB:              { layerId: 'ifc-slab',     name: 'IFC Slabs',           color: '#d4d4d4' },
  IFCCOLUMN:            { layerId: 'ifc-column',   name: 'IFC Columns',         color: '#737373' },
};

/** Map web-ifc type constants to their string name for lookup */
const IFC_TYPE_ENTRIES: Array<{ typeCode: number; typeName: string }> = [
  { typeCode: WebIFC.IFCWALL,             typeName: 'IFCWALL' },
  { typeCode: WebIFC.IFCWALLSTANDARDCASE, typeName: 'IFCWALLSTANDARDCASE' },
  { typeCode: WebIFC.IFCDOOR,             typeName: 'IFCDOOR' },
  { typeCode: WebIFC.IFCWINDOW,           typeName: 'IFCWINDOW' },
  { typeCode: WebIFC.IFCFLOWSEGMENT,      typeName: 'IFCFLOWSEGMENT' },
  { typeCode: WebIFC.IFCFLOWFITTING,       typeName: 'IFCFLOWFITTING' },
  { typeCode: WebIFC.IFCFLOWTERMINAL,      typeName: 'IFCFLOWTERMINAL' },
  { typeCode: WebIFC.IFCSLAB,             typeName: 'IFCSLAB' },
  { typeCode: WebIFC.IFCCOLUMN,           typeName: 'IFCCOLUMN' },
];

// ── Element shape classification ─────────────────────────────────────────────

/** Types rendered as circles (point-like objects: doors, windows, fittings, terminals) */
const CIRCLE_TYPES = new Set([
  'IFCDOOR', 'IFCWINDOW', 'IFCFLOWFITTING', 'IFCFLOWTERMINAL',
]);

/** Types rendered as lines (linear objects: walls, pipes, slabs, columns) */
const LINE_TYPES = new Set([
  'IFCWALL', 'IFCWALLSTANDARDCASE', 'IFCFLOWSEGMENT', 'IFCSLAB', 'IFCCOLUMN',
]);

// ── Result interface ─────────────────────────────────────────────────────────

export interface IFCImportResult {
  elements: CADElement[];
  layers: Layer[];
  metadata: {
    schema: string;
    projectName: string;
    elementCount: number;
    entityTypes: Record<string, number>;
    bounds: { minX: number; minY: number; maxX: number; maxY: number };
  };
}

// ── Coordinate helpers ───────────────────────────────────────────────────────

/**
 * Extract 2D placement from an IFC element line object.
 * Attempts ObjectPlacement → RelativePlacement → Location → Coordinates,
 * falling back to flat mesh centroid if that path is unavailable.
 */
function extractPlacement(
  ifcApi: WebIFC.IfcAPI,
  modelID: number,
  expressID: number,
): { x: number; y: number } | null {
  try {
    const line = ifcApi.GetLine(modelID, expressID, true);

    // Path 1: Walk the ObjectPlacement tree
    if (line?.ObjectPlacement?.value != null) {
      const placement = ifcApi.GetLine(modelID, line.ObjectPlacement.value, true);
      if (placement?.RelativePlacement?.value != null) {
        const axis2 = ifcApi.GetLine(modelID, placement.RelativePlacement.value, true);
        if (axis2?.Location?.value != null) {
          const pt = ifcApi.GetLine(modelID, axis2.Location.value, true);
          if (pt?.Coordinates) {
            const coords = pt.Coordinates;
            // Coordinates is an array of { value: number } or plain numbers
            const xVal = typeof coords[0] === 'object' ? coords[0].value : coords[0];
            const yVal = typeof coords[1] === 'object' ? coords[1].value : coords[1];
            if (typeof xVal === 'number' && typeof yVal === 'number') {
              return { x: xVal, y: yVal };
            }
          }
        }
      }
    }

    // Path 2: Try flattened properties that web-ifc sometimes provides
    if (line?.ObjectPlacement?.RelativePlacement?.Location?.Coordinates) {
      const coords = line.ObjectPlacement.RelativePlacement.Location.Coordinates;
      const xVal = typeof coords[0] === 'object' ? coords[0].value : coords[0];
      const yVal = typeof coords[1] === 'object' ? coords[1].value : coords[1];
      if (typeof xVal === 'number' && typeof yVal === 'number') {
        return { x: xVal, y: yVal };
      }
    }

    return null;
  } catch {
    return null;
  }
}

/**
 * Extract placement from flat mesh geometry transformation matrix.
 * The flatTransformation is a 4x4 column-major matrix; elements [12] and [13]
 * are the X and Y translation components.
 */
function extractPlacementFromMesh(
  ifcApi: WebIFC.IfcAPI,
  modelID: number,
  expressID: number,
): { x: number; y: number } | null {
  try {
    const mesh = ifcApi.GetFlatMesh(modelID, expressID);
    if (mesh.geometries.size() > 0) {
      const geom = mesh.geometries.get(0);
      const t = geom.flatTransformation;
      // Column-major 4x4: [12] = tx, [13] = ty
      if (t && t.length >= 14) {
        return { x: t[12], y: t[13] };
      }
    }
    mesh.delete();
  } catch {
    // GetFlatMesh may fail for elements without geometry
  }
  return null;
}

/**
 * Convert IFC metres to pixel coordinates.
 * IFC Y axis points up in plan view, canvas Y points down → negate Y.
 */
function toPixels(metres: number): number {
  return metres * M_TO_FT * PIXELS_PER_FOOT;
}

// ── Schema detection ─────────────────────────────────────────────────────────

function detectSchema(ifcApi: WebIFC.IfcAPI, modelID: number): string {
  try {
    // Try to read IFCPROJECT to get the schema version from the header
    const header = ifcApi.GetHeaderLine(modelID, WebIFC.FILE_SCHEMA);
    if (header && header.arguments && header.arguments[0]) {
      const schemas = header.arguments[0];
      if (Array.isArray(schemas) && schemas.length > 0) {
        const first = schemas[0];
        return typeof first === 'object' && first.value ? String(first.value) : String(first);
      }
    }
  } catch {
    // Header not available
  }
  return 'UNKNOWN';
}

function detectProjectName(ifcApi: WebIFC.IfcAPI, modelID: number): string {
  try {
    const projectIds = ifcApi.GetLineIDsWithType(modelID, WebIFC.IFCPROJECT);
    if (projectIds.size() > 0) {
      const project = ifcApi.GetLine(modelID, projectIds.get(0), true);
      if (project?.Name?.value) return String(project.Name.value);
      if (project?.LongName?.value) return String(project.LongName.value);
    }
  } catch {
    // Project entity not found
  }
  return 'Untitled IFC Project';
}

// ── Main import function ─────────────────────────────────────────────────────

export async function importIFC(file: File): Promise<IFCImportResult> {
  const ifcApi = new WebIFC.IfcAPI();

  // Set WASM path relative to app base
  const wasmPath = `${import.meta.env.BASE_URL}wasm/`;
  ifcApi.SetWasmPath(wasmPath);

  await ifcApi.Init();

  const buffer = new Uint8Array(await file.arrayBuffer());
  const modelID = ifcApi.OpenModel(buffer);

  // Detect metadata
  const schema = detectSchema(ifcApi, modelID);
  const projectName = detectProjectName(ifcApi, modelID);

  const elements: CADElement[] = [];
  const entityTypes: Record<string, number> = {};
  const createdLayerIds = new Set<string>();
  const layers: Layer[] = [];
  let counter = 0;

  // Bounds tracking
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  const updateBounds = (px: number, py: number) => {
    if (px < minX) minX = px;
    if (px > maxX) maxX = px;
    if (py < minY) minY = py;
    if (py > maxY) maxY = py;
  };

  for (const entry of IFC_TYPE_ENTRIES) {
    const { typeCode, typeName } = entry;
    const layerDef = IFC_LAYER_MAP[typeName];
    if (!layerDef) continue;

    let ids: WebIFC.Vector<number>;
    try {
      ids = ifcApi.GetLineIDsWithType(modelID, typeCode, true);
    } catch {
      continue;
    }

    const count = ids.size();
    if (count === 0) continue;

    entityTypes[typeName] = (entityTypes[typeName] ?? 0) + count;

    // Create layer if not yet added
    if (!createdLayerIds.has(layerDef.layerId)) {
      createdLayerIds.add(layerDef.layerId);
      layers.push({
        id: layerDef.layerId,
        name: layerDef.name,
        visible: true,
        locked: false,
        opacity: 1,
        color: layerDef.color,
        order: 20 + layers.length,
      });
    }

    for (let i = 0; i < count; i++) {
      const expressID = ids.get(i);

      // Try placement extraction — property tree first, then mesh fallback
      let pos = extractPlacement(ifcApi, modelID, expressID);
      if (!pos) {
        pos = extractPlacementFromMesh(ifcApi, modelID, expressID);
      }
      if (!pos) continue; // Skip elements without extractable placement

      const px = toPixels(pos.x);
      const py = -toPixels(pos.y); // Negate Y for canvas coordinates

      const id = `ifc-${Date.now()}-${counter++}`;

      if (CIRCLE_TYPES.has(typeName)) {
        // Point-like elements → circles
        const radius = typeName === 'IFCDOOR' || typeName === 'IFCWINDOW' ? 18 : 10;
        const circle: CADCircle = {
          type: 'circle',
          id,
          center: { x: px, y: py },
          radius,
          layerId: layerDef.layerId,
          strokeColor: layerDef.color,
          strokeWidth: 1.5,
        };
        elements.push(circle);
        updateBounds(px - radius, py - radius);
        updateBounds(px + radius, py + radius);
      } else if (LINE_TYPES.has(typeName)) {
        // Linear elements → try to extract end points, fallback to short line segment
        let endPos: { x: number; y: number } | null = null;

        // For walls: attempt to read the axis geometry for a proper line
        try {
          const line = ifcApi.GetLine(modelID, expressID, true);
          if (line?.Representation?.value != null) {
            const rep = ifcApi.GetLine(modelID, line.Representation.value, true);
            if (rep?.Representations) {
              for (const repItem of rep.Representations) {
                const subRep = ifcApi.GetLine(modelID, repItem.value ?? repItem, true);
                if (subRep?.Items) {
                  for (const item of subRep.Items) {
                    const geomItem = ifcApi.GetLine(modelID, item.value ?? item, true);
                    // ExtrudedAreaSolid has a Depth we can use for length
                    if (geomItem?.Depth?.value) {
                      const depth = geomItem.Depth.value;
                      // Use the local extrusion direction (default: along X if not specified)
                      endPos = { x: pos.x + depth, y: pos.y };
                      break;
                    }
                  }
                  if (endPos) break;
                }
              }
            }
          }
        } catch {
          // Fall through to default segment
        }

        if (endPos) {
          const ex = toPixels(endPos.x);
          const ey = -toPixels(endPos.y);
          const cadLine: CADLine = {
            type: 'line',
            id,
            p1: { x: px, y: py },
            p2: { x: ex, y: ey },
            layerId: layerDef.layerId,
            strokeColor: layerDef.color,
            strokeWidth: typeName.includes('WALL') ? 2.5 : 1.5,
          };
          elements.push(cadLine);
          updateBounds(px, py);
          updateBounds(ex, ey);
        } else {
          // Fallback: render as a short default-length line segment
          const defaultLen = typeName.includes('WALL') ? PIXELS_PER_FOOT * 4 : PIXELS_PER_FOOT * 2;
          const cadLine: CADLine = {
            type: 'line',
            id,
            p1: { x: px, y: py },
            p2: { x: px + defaultLen, y: py },
            layerId: layerDef.layerId,
            strokeColor: layerDef.color,
            strokeWidth: typeName.includes('WALL') ? 2.5 : 1.5,
          };
          elements.push(cadLine);
          updateBounds(px, py);
          updateBounds(px + defaultLen, py);
        }
      }
    }
  }

  // Close model and clean up
  ifcApi.CloseModel(modelID);

  const bounds = isFinite(minX)
    ? { minX, minY, maxX, maxY }
    : { minX: 0, minY: 0, maxX: 0, maxY: 0 };

  return {
    elements,
    layers,
    metadata: {
      schema,
      projectName,
      elementCount: elements.length,
      entityTypes,
      bounds,
    },
  };
}
