/**
 * KML import — parses KML XML (as text), extracts Placemark geometry,
 * and returns CAD elements on the "gis" layer.
 *
 * Supports: LineString, LinearRing, Polygon, MultiGeometry, and Point (ignored).
 * Uses the same feet-per-degree coordinate conversion as geojson-import.
 */

import type { CADElement, CADLine, Layer } from './types';
import type { GeoImportOptions } from './geojson-import';
import { GIS_LAYER } from './geojson-import';

// Re-export so consumers can share the GIS_LAYER constant.
export { GIS_LAYER };

export interface KMLImportResult {
  elements: CADElement[];
  newLayers: Layer[];
  placemarkCount: number;
  warnings: string[];
}

// ── Coordinate conversion (mirrors geojson-import) ────────────────────────────

interface ResolvedOpts {
  originLat: number;
  originLng: number;
  feetPerDegreeLat: number;
  feetPerDegreeLng: number;
  layerId: string;
  strokeColor: string;
  strokeWidth: number;
}

function resolveOptions(opts: GeoImportOptions): ResolvedOpts {
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

function lngLatToFeet(
  lng: number,
  lat: number,
  opts: ResolvedOpts
): { x: number; y: number } {
  const dLat = lat - opts.originLat;
  const dLng = lng - opts.originLng;
  return {
    x: dLng * opts.feetPerDegreeLng,
    y: -(dLat * opts.feetPerDegreeLat),
  };
}

// ── KML coordinate string parsing ─────────────────────────────────────────────

/**
 * KML coordinate tuples: "lng,lat[,alt] lng,lat[,alt] ..."
 */
function parseKMLCoords(text: string): Array<{ lng: number; lat: number }> {
  const tuples = text.trim().split(/\s+/);
  const result: Array<{ lng: number; lat: number }> = [];
  for (const t of tuples) {
    const parts = t.split(',');
    if (parts.length < 2) continue;
    const lng = parseFloat(parts[0]);
    const lat = parseFloat(parts[1]);
    if (isNaN(lng) || isNaN(lat)) continue;
    result.push({ lng, lat });
  }
  return result;
}

let lineIdCounter = 1;

function coordsToLines(
  coords: Array<{ lng: number; lat: number }>,
  opts: ResolvedOpts,
  closed: boolean
): CADLine[] {
  const lines: CADLine[] = [];
  const pts = [...coords];
  if (closed && pts.length > 1) {
    pts.push(pts[0]); // close the ring
  }
  for (let i = 0; i < pts.length - 1; i++) {
    const p1 = lngLatToFeet(pts[i].lng, pts[i].lat, opts);
    const p2 = lngLatToFeet(pts[i + 1].lng, pts[i + 1].lat, opts);
    lines.push({
      type: 'line',
      id: `kml-line-${lineIdCounter++}`,
      p1,
      p2,
      layerId: opts.layerId,
      strokeColor: opts.strokeColor,
      strokeWidth: opts.strokeWidth,
    });
  }
  return lines;
}

// ── KML element traversal ─────────────────────────────────────────────────────

function getChildElements(el: Element, tagName: string): Element[] {
  // Use querySelectorAll but KML may have namespace prefixes — fallback to tagName matching
  const direct = Array.from(el.querySelectorAll(tagName));
  if (direct.length > 0) return direct;
  // Try without namespace
  const all = Array.from(el.getElementsByTagNameNS('*', tagName));
  return all as Element[];
}

function getTextContent(el: Element, tagName: string): string {
  const child = getChildElements(el, tagName)[0];
  return child?.textContent?.trim() ?? '';
}

function processKMLElement(
  el: Element,
  opts: ResolvedOpts,
  warnings: string[],
  lines: CADLine[]
): void {
  const tag = el.localName ?? el.tagName;

  switch (tag) {
    case 'LineString': {
      const coordText = getTextContent(el, 'coordinates');
      if (!coordText) { warnings.push('LineString with no coordinates — skipped'); break; }
      const coords = parseKMLCoords(coordText);
      lines.push(...coordsToLines(coords, opts, false));
      break;
    }

    case 'LinearRing': {
      const coordText = getTextContent(el, 'coordinates');
      if (!coordText) { warnings.push('LinearRing with no coordinates — skipped'); break; }
      const coords = parseKMLCoords(coordText);
      lines.push(...coordsToLines(coords, opts, true));
      break;
    }

    case 'Polygon': {
      // Outer and inner boundaries
      const boundaries = [
        ...getChildElements(el, 'outerBoundaryIs'),
        ...getChildElements(el, 'innerBoundaryIs'),
      ];
      for (const boundary of boundaries) {
        const rings = getChildElements(boundary, 'LinearRing');
        for (const ring of rings) {
          const coordText = getTextContent(ring, 'coordinates');
          if (!coordText) continue;
          const coords = parseKMLCoords(coordText);
          lines.push(...coordsToLines(coords, opts, true));
        }
      }
      break;
    }

    case 'MultiGeometry': {
      const children = Array.from(el.children);
      for (const child of children) {
        processKMLElement(child, opts, warnings, lines);
      }
      break;
    }

    case 'Point':
      warnings.push('Point geometry — not rendered, skipped');
      break;

    default:
      // Not a geometry element — descend into children looking for geometry
      break;
  }
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Parse a KML file (as text) and return CAD elements.
 */
export function importKML(
  kmlText: string,
  options: GeoImportOptions
): KMLImportResult {
  const opts = resolveOptions(options);
  const warnings: string[] = [];
  const lines: CADLine[] = [];
  let placemarkCount = 0;

  let doc: Document;
  try {
    const parser = new DOMParser();
    doc = parser.parseFromString(kmlText, 'text/xml');
  } catch (e) {
    throw new Error('Could not parse KML XML: ' + String(e));
  }

  // Check for parse error
  const parseError = doc.querySelector('parsererror');
  if (parseError) {
    throw new Error('KML XML parse error: ' + (parseError.textContent ?? 'unknown'));
  }

  const placemarks = Array.from(doc.getElementsByTagNameNS('*', 'Placemark'));
  if (placemarks.length === 0) {
    warnings.push('No Placemarks found in KML');
  }

  for (const placemark of placemarks) {
    placemarkCount++;
    const children = Array.from(placemark.children);
    for (const child of children) {
      processKMLElement(child, opts, warnings, lines);
    }
  }

  const elements: CADElement[] = lines;
  const newLayers = elements.length > 0 ? [GIS_LAYER] : [];

  return { elements, newLayers, placemarkCount, warnings };
}
