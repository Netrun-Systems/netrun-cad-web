/**
 * GeoJSON import — parses FeatureCollection, converts lat/lng coordinates to
 * drawing-space feet, and returns CAD elements on the "gis" layer.
 *
 * Coordinate conversion strategy:
 *   The user supplies a reference point (lat/lng → drawing x/y) and a scale
 *   factor (pixels per degree). For most practical use the simpler approach is:
 *   treat 1° lat ≈ 364,000 ft, 1° lng ≈ 364,000 ft × cos(lat). We expose both
 *   the raw pixel-per-degree approach and a feet-per-degree helper so callers
 *   can use either, then convert pixels→feet via grid.pixelsPerUnit.
 */

import type { CADElement, CADLine, Layer } from './types';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface GeoImportOptions {
  /** Reference lat/lng that maps to drawing origin (0, 0) */
  originLat: number;
  originLng: number;
  /** Feet per degree latitude (≈ 364000). Fine to leave as default. */
  feetPerDegreeLat?: number;
  /** Feet per degree longitude = feetPerDegreeLat × cos(lat). Computed automatically if omitted. */
  feetPerDegreeLng?: number;
  /** Target layer id. Defaults to 'gis'. */
  layerId?: string;
  /** Stroke color for imported lines. */
  strokeColor?: string;
  /** Stroke width in drawing units. */
  strokeWidth?: number;
}

export interface GeoImportResult {
  elements: CADElement[];
  newLayers: Layer[];
  featureCount: number;
  warnings: string[];
}

// ── GIS layer definition ──────────────────────────────────────────────────────

export const GIS_LAYER: Layer = {
  id: 'gis',
  name: 'GIS',
  visible: true,
  locked: false,
  opacity: 1,
  color: '#00e5ff',
  order: -1, // render below default layers
};

// ── Coordinate conversion ─────────────────────────────────────────────────────

/**
 * Convert a [lng, lat] GeoJSON coordinate pair to drawing-space feet,
 * relative to the given origin.
 */
function lngLatToFeet(
  lng: number,
  lat: number,
  opts: Required<GeoImportOptions>
): { x: number; y: number } {
  const dLat = lat - opts.originLat;
  const dLng = lng - opts.originLng;
  // Positive x = east, positive y = north. Canvas Y is inverted so negate y.
  return {
    x: dLng * opts.feetPerDegreeLng,
    y: -(dLat * opts.feetPerDegreeLat),
  };
}

function resolveOptions(opts: GeoImportOptions): Required<GeoImportOptions> {
  const feetPerDegreeLat = opts.feetPerDegreeLat ?? 364000;
  const feetPerDegreeLng =
    opts.feetPerDegreeLng ?? feetPerDegreeLat * Math.cos((opts.originLat * Math.PI) / 180);
  return {
    originLat: opts.originLat,
    originLng: opts.originLng,
    feetPerDegreeLat,
    feetPerDegreeLng,
    layerId: opts.layerId ?? 'gis',
    strokeColor: opts.strokeColor ?? '#00e5ff',
    strokeWidth: opts.strokeWidth ?? 1,
  };
}

// ── GeoJSON geometry conversion ───────────────────────────────────────────────

let lineIdCounter = 1;

function coordPairsToLines(
  coords: number[][],
  opts: Required<GeoImportOptions>,
  warnings: string[]
): CADLine[] {
  const lines: CADLine[] = [];
  for (let i = 0; i < coords.length - 1; i++) {
    const [lng1, lat1] = coords[i];
    const [lng2, lat2] = coords[i + 1];
    if (
      typeof lng1 !== 'number' || typeof lat1 !== 'number' ||
      typeof lng2 !== 'number' || typeof lat2 !== 'number'
    ) {
      warnings.push(`Skipped coordinate pair ${i} — non-numeric values`);
      continue;
    }
    const p1 = lngLatToFeet(lng1, lat1, opts);
    const p2 = lngLatToFeet(lng2, lat2, opts);
    lines.push({
      type: 'line',
      id: `gis-line-${lineIdCounter++}`,
      p1,
      p2,
      layerId: opts.layerId,
      strokeColor: opts.strokeColor,
      strokeWidth: opts.strokeWidth,
    });
  }
  return lines;
}

function processGeometry(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  geometry: any,
  opts: Required<GeoImportOptions>,
  warnings: string[]
): CADLine[] {
  if (!geometry || !geometry.type) {
    warnings.push('Feature with no geometry — skipped');
    return [];
  }

  const lines: CADLine[] = [];

  switch (geometry.type) {
    case 'LineString':
      lines.push(...coordPairsToLines(geometry.coordinates ?? [], opts, warnings));
      break;

    case 'MultiLineString':
      for (const ring of geometry.coordinates ?? []) {
        lines.push(...coordPairsToLines(ring, opts, warnings));
      }
      break;

    case 'Polygon':
      // Each ring is a closed coordinate array
      for (const ring of geometry.coordinates ?? []) {
        // Close the ring if not already closed
        const coords: number[][] = [...ring];
        if (coords.length > 1) {
          const first = coords[0];
          const last = coords[coords.length - 1];
          if (first[0] !== last[0] || first[1] !== last[1]) {
            coords.push(first);
          }
        }
        lines.push(...coordPairsToLines(coords, opts, warnings));
      }
      break;

    case 'MultiPolygon':
      for (const poly of geometry.coordinates ?? []) {
        for (const ring of poly) {
          const coords: number[][] = [...ring];
          if (coords.length > 1) {
            const first = coords[0];
            const last = coords[coords.length - 1];
            if (first[0] !== last[0] || first[1] !== last[1]) {
              coords.push(first);
            }
          }
          lines.push(...coordPairsToLines(coords, opts, warnings));
        }
      }
      break;

    case 'Point':
    case 'MultiPoint':
      // Points don't translate to lines — skip with a note
      warnings.push(`Geometry type "${geometry.type}" — points are not rendered, skipped`);
      break;

    case 'GeometryCollection':
      for (const geom of geometry.geometries ?? []) {
        lines.push(...processGeometry(geom, opts, warnings));
      }
      break;

    default:
      warnings.push(`Unknown geometry type "${geometry.type}" — skipped`);
  }

  return lines;
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Parse a GeoJSON file (as text) and return CAD elements.
 */
export function importGeoJSON(
  geojsonText: string,
  options: GeoImportOptions
): GeoImportResult {
  const opts = resolveOptions(options);
  const warnings: string[] = [];
  const elements: CADElement[] = [];
  let featureCount = 0;

  let parsed: unknown;
  try {
    parsed = JSON.parse(geojsonText);
  } catch (e) {
    throw new Error('Invalid GeoJSON — could not parse JSON: ' + String(e));
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const root = parsed as any;

  // Accept either a FeatureCollection or a single Feature
  const features: unknown[] =
    root.type === 'FeatureCollection'
      ? (root.features ?? [])
      : root.type === 'Feature'
      ? [root]
      : [];

  if (features.length === 0) {
    warnings.push('No features found in GeoJSON');
  }

  for (const feature of features) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const f = feature as any;
    featureCount++;
    const lines = processGeometry(f.geometry, opts, warnings);
    elements.push(...lines);
  }

  // Include the GIS layer definition if we produced any elements
  const newLayers = elements.length > 0 ? [GIS_LAYER] : [];

  return { elements, newLayers, featureCount, warnings };
}
