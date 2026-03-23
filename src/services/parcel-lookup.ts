/**
 * Parcel Lookup Service
 *
 * Fetches property boundary (parcel) GeoJSON from free public sources:
 *   1. County ArcGIS REST services (no API key, CORS-enabled for most counties)
 *   2. US Census TIGER/Line (road/address reference, no parcel boundaries)
 *
 * Strategy:
 *   - Geocode address → lat/lng via Nominatim (done upstream in BasemapPanel)
 *   - Detect county from Nominatim address_details
 *   - Query the county's ArcGIS parcel layer by point geometry
 *   - Return GeoJSON Feature(s) for the hit parcel + optional neighbors
 *
 * All sources are free public endpoints — no API keys required.
 * Nominatim rate limit: 1 req/sec — geocoding is done upstream; this service
 * only fires after a geocoding result is available.
 */

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ParcelResult {
  /** Formatted address or parcel label */
  address: string;
  /** Assessor Parcel Number */
  apn?: string;
  /** Lot size in acres */
  lotSizeAcres?: number;
  /** Zoning designation (e.g. "R-1") */
  zoning?: string;
  /** Owner name, if available in public data */
  ownerName?: string;
  /** The parcel boundary as a GeoJSON Polygon or MultiPolygon */
  geometry: GeoJSON.Polygon | GeoJSON.MultiPolygon;
  /** Raw properties from the ArcGIS response (for display) */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  rawProperties: Record<string, any>;
  /** Which data source was used */
  source: string;
}

export interface ParcelLookupOptions {
  /** Include neighboring parcels within ~200 ft */
  includeNeighbors?: boolean;
  /** Timeout for each fetch in ms (default 8000) */
  timeoutMs?: number;
}

// ── County ArcGIS Server Registry ────────────────────────────────────────────

/**
 * County → ArcGIS REST parcel layer URL.
 *
 * Query format (standard ArcGIS REST):
 *   {url}/query?geometry={lng},{lat}&geometryType=esriGeometryPoint
 *        &inSR=4326&outSR=4326&outFields=*&returnGeometry=true&f=geojson
 *
 * Sources verified as of 2025-2026:
 *   Ventura:    https://maps.ventura.org/arcgis/rest/services/
 *   LA:         https://public.gis.lacounty.gov/gis/rest/services/
 *   Santa Barbara: https://sbcogeospatial.maps.arcgis.com/
 *   Orange:     https://ocgis.com/arcpub/rest/services/
 *   Riverside:  https://gis.rctlma.org/arcgis/rest/services/
 *   San Diego:  https://rdw.sandag.org/arcgis/rest/services/
 *   San Luis Obispo: https://gis.slocounty.gov/arcgis/rest/services/
 *   Kern:       https://gis.co.kern.ca.us/arcgis/rest/services/
 */
const COUNTY_GIS_SERVERS: Record<string, { url: string; apnField?: string; acresField?: string; zoningField?: string; ownerField?: string }> = {
  ventura: {
    url: 'https://maps.ventura.org/arcgis/rest/services/Parcels/Parcels/MapServer/0',
    apnField: 'APN',
    acresField: 'ACRES',
    zoningField: 'ZONE_CODE',
    ownerField: 'OWNER_NAME',
  },
  losangeles: {
    url: 'https://public.gis.lacounty.gov/gis/rest/services/LACounty_Dynamic/LMS_Data_Public/MapServer/71',
    apnField: 'AIN',
    acresField: 'SHAPE_Area',
    ownerField: 'OwnerName',
  },
  santabarbara: {
    url: 'https://services1.arcgis.com/q5uyFfTZo3LFL3Z8/arcgis/rest/services/SBCO_Parcels/FeatureServer/0',
    apnField: 'APN',
    acresField: 'ACRES',
    ownerField: 'OWNER',
  },
  orange: {
    url: 'https://ocgis.com/arcpub/rest/services/Basemap/Parcels/MapServer/0',
    apnField: 'APN',
    acresField: 'CALC_AREA',
  },
  riverside: {
    url: 'https://gis.rctlma.org/arcgis/rest/services/Parcel/MapServer/0',
    apnField: 'APN',
    acresField: 'GROSS_AREA',
    ownerField: 'OWNER_NAME',
  },
  sandiego: {
    url: 'https://rdw.sandag.org/arcgis/rest/services/Parcel/MapServer/0',
    apnField: 'APN',
    acresField: 'AREA',
    ownerField: 'OWNERS_NAME',
  },
  sanluisobispo: {
    url: 'https://gis.slocounty.gov/arcgis/rest/services/Public_Parcels/MapServer/0',
    apnField: 'APN',
    acresField: 'ACRES',
  },
  kern: {
    url: 'https://gis.co.kern.ca.us/arcgis/rest/services/Parcels/MapServer/0',
    apnField: 'APN',
    acresField: 'CALC_ACRES',
  },
};

// ── County Detection ──────────────────────────────────────────────────────────

/**
 * Map Nominatim county strings (county or state_district) to our server keys.
 * Nominatim returns county names like "Ventura County", "Los Angeles County", etc.
 */
function detectCountyKey(nominatimAddress: Record<string, string>): string | null {
  const county = (nominatimAddress.county ?? nominatimAddress.state_district ?? '').toLowerCase();

  if (county.includes('ventura')) return 'ventura';
  if (county.includes('los angeles')) return 'losangeles';
  if (county.includes('santa barbara')) return 'santabarbara';
  if (county.includes('orange')) return 'orange';
  if (county.includes('riverside')) return 'riverside';
  if (county.includes('san diego')) return 'sandiego';
  if (county.includes('san luis obispo')) return 'sanluisobispo';
  if (county.includes('kern')) return 'kern';

  return null;
}

// ── Fetch helpers ─────────────────────────────────────────────────────────────

async function fetchWithTimeout(url: string, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { signal: controller.signal });
    return response;
  } finally {
    clearTimeout(timer);
  }
}

// ── ArcGIS query ──────────────────────────────────────────────────────────────

/**
 * Query an ArcGIS REST feature layer for the parcel containing the given point.
 */
async function queryArcGISPoint(
  layerUrl: string,
  lat: number,
  lng: number,
  timeoutMs: number,
  bufferFeet = 0
): Promise<GeoJSON.FeatureCollection | null> {
  const url = new URL(`${layerUrl}/query`);
  url.searchParams.set('where', '1=1');
  url.searchParams.set('geometry', `${lng},${lat}`);
  url.searchParams.set('geometryType', 'esriGeometryPoint');
  url.searchParams.set('inSR', '4326');
  url.searchParams.set('spatialRel', 'esriSpatialRelIntersects');
  url.searchParams.set('outSR', '4326');
  url.searchParams.set('outFields', '*');
  url.searchParams.set('returnGeometry', 'true');
  url.searchParams.set('f', 'geojson');
  if (bufferFeet > 0) {
    url.searchParams.set('distance', String(bufferFeet));
    url.searchParams.set('units', 'esriSRUnit_Foot');
  }

  const response = await fetchWithTimeout(url.toString(), timeoutMs);
  if (!response.ok) return null;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data: any = await response.json();
  if (data?.error) return null;
  if (data?.type !== 'FeatureCollection') return null;
  return data as GeoJSON.FeatureCollection;
}

// ── Property normalization ────────────────────────────────────────────────────

function normalizeParcelFeature(
  feature: GeoJSON.Feature,
  countyConfig: typeof COUNTY_GIS_SERVERS[string],
  countyKey: string,
  lat: number,
  lng: number
): ParcelResult | null {
  const geom = feature.geometry;
  if (!geom || (geom.type !== 'Polygon' && geom.type !== 'MultiPolygon')) return null;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const props: Record<string, any> = (feature.properties ?? {}) as Record<string, any>;

  const apn = countyConfig.apnField ? String(props[countyConfig.apnField] ?? '') : undefined;
  const ownerRaw = countyConfig.ownerField ? props[countyConfig.ownerField] : undefined;
  const zoningRaw = countyConfig.zoningField ? props[countyConfig.zoningField] : undefined;

  // Compute acres from raw field. LA county uses SHAPE_Area in sq meters (EPSG:2229 usually ft²)
  let lotSizeAcres: number | undefined;
  if (countyConfig.acresField) {
    const raw = parseFloat(props[countyConfig.acresField]);
    if (!isNaN(raw) && raw > 0) {
      // If the field is clearly in square feet (very large numbers), convert
      if (countyKey === 'losangeles' && raw > 1000) {
        // SHAPE_Area is in sq feet for LA county public layer
        lotSizeAcres = raw / 43560;
      } else {
        lotSizeAcres = raw;
      }
    }
  }

  // Build a human-readable address label
  const addressParts: string[] = [];
  const streetCandidates = ['SITUS_ADDR', 'SITUS', 'SitusAddress', 'ADDRESS', 'SITE_ADDR', 'ADDR'];
  for (const key of streetCandidates) {
    if (props[key]) { addressParts.push(String(props[key])); break; }
  }
  const cityCandidates = ['CITY', 'SITUS_CITY', 'SitusCity', 'MUNI'];
  for (const key of cityCandidates) {
    if (props[key]) { addressParts.push(String(props[key])); break; }
  }
  if (addressParts.length === 0) {
    addressParts.push(`${lat.toFixed(6)}, ${lng.toFixed(6)}`);
  }

  return {
    address: addressParts.join(', '),
    apn: apn || undefined,
    lotSizeAcres,
    zoning: zoningRaw ? String(zoningRaw) : undefined,
    ownerName: ownerRaw ? String(ownerRaw) : undefined,
    geometry: geom as GeoJSON.Polygon | GeoJSON.MultiPolygon,
    rawProperties: props,
    source: `${countyKey} county arcgis`,
  };
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Look up parcel data by coordinates and Nominatim address details.
 *
 * @param lat Latitude from geocoding
 * @param lng Longitude from geocoding
 * @param nominatimAddress The `address` object from Nominatim (county field used for routing)
 * @param options Lookup options
 * @returns ParcelResult if found, null otherwise
 */
export async function lookupParcelByCoordinates(
  lat: number,
  lng: number,
  nominatimAddress: Record<string, string>,
  options: ParcelLookupOptions = {}
): Promise<ParcelResult | null> {
  const timeoutMs = options.timeoutMs ?? 8000;
  const countyKey = detectCountyKey(nominatimAddress);

  if (!countyKey) return null;

  const config = COUNTY_GIS_SERVERS[countyKey];
  if (!config) return null;

  try {
    const fc = await queryArcGISPoint(config.url, lat, lng, timeoutMs);
    if (!fc || fc.features.length === 0) return null;

    const feature = fc.features[0];
    return normalizeParcelFeature(feature, config, countyKey, lat, lng);
  } catch (err) {
    // CORS, network error, timeout — treat as no data available
    console.warn(`Parcel lookup failed for ${countyKey}:`, err);
    return null;
  }
}

/**
 * Fetch neighboring parcels within a radius.
 *
 * @param lat Center latitude
 * @param lng Center longitude
 * @param nominatimAddress The `address` object from Nominatim
 * @param radiusFeet Search radius in feet (default 200)
 * @param options Lookup options
 * @returns Array of GeoJSON features (raw, for drawing)
 */
export async function lookupNeighborParcels(
  lat: number,
  lng: number,
  nominatimAddress: Record<string, string>,
  radiusFeet = 200,
  options: ParcelLookupOptions = {}
): Promise<GeoJSON.Feature[]> {
  const timeoutMs = options.timeoutMs ?? 8000;
  const countyKey = detectCountyKey(nominatimAddress);
  if (!countyKey) return [];

  const config = COUNTY_GIS_SERVERS[countyKey];
  if (!config) return [];

  try {
    const fc = await queryArcGISPoint(config.url, lat, lng, timeoutMs, radiusFeet);
    if (!fc) return [];
    // Exclude the primary parcel (index 0) — return neighbors
    return fc.features.slice(1);
  } catch {
    return [];
  }
}

/**
 * Check whether we have a configured ArcGIS server for a given Nominatim address.
 * Useful for showing "parcel data not available" before attempting the lookup.
 */
export function isCountySupported(nominatimAddress: Record<string, string>): boolean {
  return detectCountyKey(nominatimAddress) !== null;
}

/**
 * Return a human-readable county name from Nominatim address data.
 */
export function getCountyDisplayName(nominatimAddress: Record<string, string>): string {
  return nominatimAddress.county ?? nominatimAddress.state_district ?? 'Unknown County';
}
