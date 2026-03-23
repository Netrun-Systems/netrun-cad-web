/**
 * Geocoding via Nominatim (OpenStreetMap) — free, no API key required.
 *
 * Terms of use: https://operations.osmfoundation.org/policies/nominatim/
 * - Must identify the application (User-Agent)
 * - No bulk geocoding, max 1 req/sec
 */

export interface GeocodingResult {
  displayName: string;
  lat: number;
  lng: number;
  boundingBox: {
    south: number;
    north: number;
    west: number;
    east: number;
  };
  /**
   * Raw Nominatim address breakdown (county, state, city, etc.).
   * Used by the parcel lookup service to route to the correct county ArcGIS server.
   */
  addressDetails: Record<string, string>;
}

const NOMINATIM_BASE = 'https://nominatim.openstreetmap.org/search';

/**
 * Search for an address and return the top result.
 * Returns null if no results found.
 */
export async function geocodeAddress(address: string): Promise<GeocodingResult | null> {
  const url = new URL(NOMINATIM_BASE);
  url.searchParams.set('q', address);
  url.searchParams.set('format', 'json');
  url.searchParams.set('limit', '1');
  url.searchParams.set('addressdetails', '1');

  const response = await fetch(url.toString(), {
    headers: {
      'User-Agent': 'Netrun-CAD-Web/1.0 (landscape design tool)',
      'Accept-Language': 'en',
    },
  });

  if (!response.ok) {
    throw new Error(`Nominatim error ${response.status}: ${response.statusText}`);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data: any[] = await response.json();
  if (!data || data.length === 0) return null;

  const result = data[0];
  const bb = result.boundingbox; // [south, north, west, east] as strings

  return {
    displayName: result.display_name,
    lat: parseFloat(result.lat),
    lng: parseFloat(result.lon),
    boundingBox: {
      south: parseFloat(bb[0]),
      north: parseFloat(bb[1]),
      west: parseFloat(bb[2]),
      east: parseFloat(bb[3]),
    },
    addressDetails: (result.address ?? {}) as Record<string, string>,
  };
}
