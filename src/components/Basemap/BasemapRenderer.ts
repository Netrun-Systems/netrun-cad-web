/**
 * BasemapRenderer — loads and renders satellite tile imagery onto a canvas.
 *
 * Uses Esri World Imagery tiles (free for non-commercial display, CORS-enabled).
 * Tile URL: https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}
 *
 * Coordinate system:
 *   - Web Mercator tile coordinates (z/x/y) map to screen pixels.
 *   - We maintain a "basemap anchor": the lat/lng that sits at a given drawing-space point.
 *   - The user can set scale: "this distance on screen = N feet in reality."
 */

// ── Constants ─────────────────────────────────────────────────────────────────

const TILE_SIZE = 256; // Standard web tile pixel size
const ESRI_URL = 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';
const OSM_URL = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';

export type TileProvider = 'esri' | 'osm';

// ── Tile math ─────────────────────────────────────────────────────────────────

/** Convert lat/lng to tile x/y at a given zoom level */
function lngLatToTile(lng: number, lat: number, zoom: number): { tx: number; ty: number; fx: number; fy: number } {
  const n = Math.pow(2, zoom);
  const tx = Math.floor(((lng + 180) / 360) * n);
  const latRad = (lat * Math.PI) / 180;
  const ty = Math.floor(((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * n);
  // Fractional part — how far into the tile the point falls
  const fx = (((lng + 180) / 360) * n) - tx;
  const fy = (((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * n) - ty;
  return { tx, ty, fx, fy };
}

/** Convert tile x/y at zoom to lat/lng (top-left corner of tile) */
function tileToLngLat(tx: number, ty: number, zoom: number): { lng: number; lat: number } {
  const n = Math.pow(2, zoom);
  const lng = (tx / n) * 360 - 180;
  const latRad = Math.atan(Math.sinh(Math.PI * (1 - (2 * ty) / n)));
  const lat = (latRad * 180) / Math.PI;
  return { lng, lat };
}

function buildTileUrl(provider: TileProvider, z: number, x: number, y: number): string {
  if (provider === 'osm') {
    return OSM_URL.replace('{z}', String(z)).replace('{x}', String(x)).replace('{y}', String(y));
  }
  return ESRI_URL.replace('{z}', String(z)).replace('{y}', String(y)).replace('{x}', String(x));
}

// ── Tile cache ────────────────────────────────────────────────────────────────

const tileCache = new Map<string, HTMLImageElement | 'loading' | 'error'>();

function loadTile(url: string, onLoad: () => void): HTMLImageElement | null {
  const cached = tileCache.get(url);
  if (cached === 'loading') return null;
  if (cached === 'error') return null;
  if (cached instanceof HTMLImageElement) return cached;

  tileCache.set(url, 'loading');
  const img = new Image();
  img.crossOrigin = 'anonymous';
  img.onload = () => {
    tileCache.set(url, img);
    onLoad();
  };
  img.onerror = () => {
    tileCache.set(url, 'error');
  };
  img.src = url;
  return null;
}

// ── BasemapState ──────────────────────────────────────────────────────────────

export interface BasemapState {
  enabled: boolean;
  provider: TileProvider;
  /** Center of the basemap in lat/lng */
  centerLat: number;
  centerLng: number;
  /** Zoom level for tile fetching */
  tileZoom: number;
  /**
   * Scale calibration: how many drawing-space feet correspond to one screen pixel at zoom=1.
   * Set by measuring a known distance on the basemap.
   * Default: auto-computed from tile resolution.
   */
  feetPerPixel: number | null;
  /**
   * Drawing-space anchor: the drawing X/Y that corresponds to centerLat/centerLng.
   * Usually (0, 0) after initial placement.
   */
  anchorX: number;
  anchorY: number;
  /** Opacity for the basemap layer (0-1) */
  opacity: number;
  /** Lock basemap position (prevent accidental panning) */
  locked: boolean;
}

export const DEFAULT_BASEMAP: BasemapState = {
  enabled: false,
  provider: 'esri',
  centerLat: 34.4483,   // Ojai, CA (Netrun home base)
  centerLng: -119.2434,
  tileZoom: 18,
  feetPerPixel: null,
  anchorX: 0,
  anchorY: 0,
  opacity: 0.6,
  locked: false,
};

// ── Renderer ──────────────────────────────────────────────────────────────────

/**
 * Render basemap tiles onto a canvas context, below all CAD layers.
 * Called from the main render loop before renderAll().
 */
export function renderBasemap(
  ctx: CanvasRenderingContext2D,
  basemap: BasemapState,
  viewOffsetX: number,
  viewOffsetY: number,
  viewZoom: number,
  canvasWidth: number,
  canvasHeight: number,
  onTileLoad: () => void
): void {
  if (!basemap.enabled) return;

  const { centerLat, centerLng, tileZoom, provider, opacity } = basemap;
  const z = tileZoom;

  // Find which tile contains the center
  const { tx: centerTX, ty: centerTY, fx, fy } = lngLatToTile(centerLng, centerLat, z);

  // In drawing space, the anchor point (anchorX, anchorY) corresponds to centerLat/centerLng.
  // Each tile covers TILE_SIZE drawing pixels at the natural basemap resolution.
  // With view zoom applied, tiles are TILE_SIZE * viewZoom screen pixels.

  // The center of the anchor tile in drawing space:
  const tileDrawSize = TILE_SIZE; // 1 drawing px = 1 tile px at zoom=1
  const anchorTileOriginX = basemap.anchorX - fx * tileDrawSize;
  const anchorTileOriginY = basemap.anchorY - fy * tileDrawSize;

  // Determine visible tile range
  // We need to cover the visible drawing area: from (-viewOffsetX/viewZoom, -viewOffsetY/viewZoom)
  // to ((canvasWidth - viewOffsetX) / viewZoom, (canvasHeight - viewOffsetY) / viewZoom)
  const visLeft = (-viewOffsetX) / viewZoom;
  const visTop = (-viewOffsetY) / viewZoom;
  const visRight = (canvasWidth - viewOffsetX) / viewZoom;
  const visBottom = (canvasHeight - viewOffsetY) / viewZoom;

  const tileLeft = Math.floor((visLeft - anchorTileOriginX) / tileDrawSize) - 1;
  const tileTop = Math.floor((visTop - anchorTileOriginY) / tileDrawSize) - 1;
  const tileRight = Math.ceil((visRight - anchorTileOriginX) / tileDrawSize) + 1;
  const tileBottom = Math.ceil((visBottom - anchorTileOriginY) / tileDrawSize) + 1;

  ctx.save();
  ctx.globalAlpha = opacity;

  const maxTile = Math.pow(2, z) - 1;

  for (let dy = tileTop; dy <= tileBottom; dy++) {
    for (let dx = tileLeft; dx <= tileRight; dx++) {
      const tx = centerTX + dx;
      const ty = centerTY + dy;

      // Skip out-of-bounds tiles
      if (tx < 0 || ty < 0 || tx > maxTile || ty > maxTile) continue;

      const url = buildTileUrl(provider, z, tx, ty);
      const img = loadTile(url, onTileLoad);

      if (img) {
        const drawX = anchorTileOriginX + dx * tileDrawSize;
        const drawY = anchorTileOriginY + dy * tileDrawSize;
        ctx.drawImage(img, drawX, drawY, tileDrawSize, tileDrawSize);
      }
    }
  }

  ctx.restore();
}

/**
 * Compute the approximate feet-per-pixel for a given lat/zoom level.
 * Uses the Web Mercator resolution formula.
 * Returns feet per drawing pixel at the native tile resolution.
 */
export function computeFeetPerPixel(lat: number, zoom: number): number {
  // Meters per pixel at equator for zoom level = 156543.03392 / 2^zoom
  const metersPerPixelEquator = 156543.03392 / Math.pow(2, zoom);
  // Adjust for latitude
  const metersPerPixel = metersPerPixelEquator * Math.cos((lat * Math.PI) / 180);
  // Convert to feet
  return metersPerPixel * 3.28084;
}

/**
 * Convert screen pixel coordinates to lat/lng given basemap state and view.
 * Useful for scale calibration (user clicks two points on the map).
 */
export function screenToLngLat(
  screenX: number,
  screenY: number,
  basemap: BasemapState,
  viewOffsetX: number,
  viewOffsetY: number,
  viewZoom: number
): { lng: number; lat: number } {
  // Convert screen → drawing space
  const drawX = (screenX - viewOffsetX) / viewZoom;
  const drawY = (screenY - viewOffsetY) / viewZoom;

  // Drawing offset from center tile origin
  const { tx: centerTX, ty: centerTY } = lngLatToTile(basemap.centerLng, basemap.centerLat, basemap.tileZoom);
  const { fx, fy } = lngLatToTile(basemap.centerLng, basemap.centerLat, basemap.tileZoom);
  const anchorTileOriginX = basemap.anchorX - fx * TILE_SIZE;
  const anchorTileOriginY = basemap.anchorY - fy * TILE_SIZE;

  const tileFloatX = (drawX - anchorTileOriginX) / TILE_SIZE;
  const tileFloatY = (drawY - anchorTileOriginY) / TILE_SIZE;

  const tileX = centerTX + tileFloatX;
  const tileY = centerTY + tileFloatY;

  // Convert tile float coords to lat/lng
  const z = basemap.tileZoom;
  const n = Math.pow(2, z);
  const lng = (tileX / n) * 360 - 180;
  const latRad = Math.atan(Math.sinh(Math.PI * (1 - (2 * tileY) / n)));
  const lat = (latRad * 180) / Math.PI;

  return { lng, lat };
}

// Export for use in tile math tests / calibration
export { lngLatToTile, tileToLngLat, TILE_SIZE };
