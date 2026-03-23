/**
 * BasemapPanel — satellite imagery controls + address-based parcel lookup.
 *
 * Provides:
 *  - Address search (Nominatim geocoding)
 *  - Auto parcel boundary fetch from county ArcGIS after address search
 *  - Tile zoom slider
 *  - Provider selector (Esri / OSM)
 *  - Opacity slider
 *  - Scale calibration display
 *  - Lock toggle
 */

import React, { useState, useCallback } from 'react';
import type { BasemapState, TileProvider } from './BasemapRenderer';
import { computeFeetPerPixel } from './BasemapRenderer';
import { geocodeAddress } from './geocoding';
import type { CADElement, Layer } from '../../engine/types';
import { GIS_LAYER } from '../../engine/geojson-import';
import {
  lookupParcelByCoordinates,
  lookupNeighborParcels,
  isCountySupported,
  getCountyDisplayName,
  type ParcelResult,
} from '../../services/parcel-lookup';

/** GIS Context layer for neighboring parcels (renders below GIS) */
const GIS_CONTEXT_LAYER: Layer = {
  id: 'gis-context',
  name: 'GIS Context',
  visible: true,
  locked: false,
  opacity: 0.4,
  color: '#666666',
  order: -2,
};

// ── Props ─────────────────────────────────────────────────────────────────────

interface BasemapPanelProps {
  basemap: BasemapState;
  onChange: (updates: Partial<BasemapState>) => void;
  onClose: () => void;
  /** Called when parcel geometry is ready to be drawn on the GIS layer */
  onParcelImport?: (elements: CADElement[], newLayers: Layer[]) => void;
}

// ── GeoJSON → CAD line conversion ────────────────────────────────────────────

interface GeomToCADOptions {
  strokeColor: string;
  layerId: string;
  idPrefix: string;
  strokeWidth?: number;
  isNeighbor?: boolean;
  neighborApn?: string;
  dashPattern?: number[];
  opacity?: number;
}

/**
 * Convert a GeoJSON Polygon or MultiPolygon to CAD line segments,
 * using the same coordinate projection logic as geojson-import.ts.
 */
function geomToCADLines(
  geom: GeoJSON.Polygon | GeoJSON.MultiPolygon,
  originLat: number,
  originLng: number,
  opts: GeomToCADOptions
): CADElement[] {
  const FEET_PER_DEG_LAT = 364000;
  const FEET_PER_DEG_LNG = FEET_PER_DEG_LAT * Math.cos((originLat * Math.PI) / 180);

  const { strokeColor, layerId, idPrefix, strokeWidth = 2, isNeighbor, neighborApn, dashPattern, opacity } = opts;

  function lngLatToFeet(lng: number, lat: number) {
    return {
      x: (lng - originLng) * FEET_PER_DEG_LNG,
      y: -((lat - originLat) * FEET_PER_DEG_LAT),
    };
  }

  function ringToLines(ring: number[][], prefix: string): CADElement[] {
    const lines: CADElement[] = [];
    // Ensure ring is closed
    const coords = [...ring];
    if (
      coords.length > 1 &&
      (coords[0][0] !== coords[coords.length - 1][0] ||
        coords[0][1] !== coords[coords.length - 1][1])
    ) {
      coords.push(coords[0]);
    }
    for (let i = 0; i < coords.length - 1; i++) {
      const [lng1, lat1] = coords[i];
      const [lng2, lat2] = coords[i + 1];
      const metadata = (isNeighbor || dashPattern || opacity !== undefined)
        ? {
            isNeighbor,
            neighborApn: i === 0 ? neighborApn : undefined, // only first segment carries the label
            dashPattern,
            opacity,
          }
        : undefined;
      lines.push({
        type: 'line',
        id: `${prefix}-${i}`,
        p1: lngLatToFeet(lng1, lat1),
        p2: lngLatToFeet(lng2, lat2),
        layerId,
        strokeColor,
        strokeWidth,
        ...(metadata ? { metadata } : {}),
      } as CADElement);
    }
    return lines;
  }

  const lines: CADElement[] = [];

  if (geom.type === 'Polygon') {
    geom.coordinates.forEach((ring, ri) => {
      lines.push(...ringToLines(ring as number[][], `${idPrefix}-r${ri}`));
    });
  } else {
    // MultiPolygon
    geom.coordinates.forEach((poly, pi) => {
      poly.forEach((ring, ri) => {
        lines.push(...ringToLines(ring as number[][], `${idPrefix}-p${pi}-r${ri}`));
      });
    });
  }

  return lines;
}

// ── Parcel info card ──────────────────────────────────────────────────────────

interface ParcelInfoCardProps {
  result: ParcelResult;
  countyName: string;
}

const ParcelInfoCard: React.FC<ParcelInfoCardProps> = ({ result, countyName }) => (
  <div className="mt-2 rounded-lg bg-cyan-950/40 border border-cyan-500/30 p-2.5 text-xs space-y-1">
    <div className="font-semibold text-cyan-300 text-xs uppercase tracking-wide mb-1">
      Parcel Found — {countyName}
    </div>
    {result.address && (
      <div className="text-cad-text truncate" title={result.address}>
        {result.address}
      </div>
    )}
    {result.apn && (
      <div className="text-cad-dim">
        APN: <span className="text-cad-text font-mono">{result.apn}</span>
      </div>
    )}
    {result.lotSizeAcres !== undefined && (
      <div className="text-cad-dim">
        Lot size: <span className="text-cad-text">{result.lotSizeAcres.toFixed(3)} acres</span>
        <span className="text-cad-dim/60 ml-1">
          ({Math.round(result.lotSizeAcres * 43560).toLocaleString()} sq ft)
        </span>
      </div>
    )}
    {result.zoning && (
      <div className="text-cad-dim">
        Zoning: <span className="text-cad-text">{result.zoning}</span>
      </div>
    )}
    {result.ownerName && (
      <div className="text-cad-dim">
        Owner: <span className="text-cad-text">{result.ownerName}</span>
      </div>
    )}
    <div className="text-cad-dim/50 text-[10px] pt-0.5">
      Source: {result.source}
    </div>
  </div>
);

// ── Component ─────────────────────────────────────────────────────────────────

export const BasemapPanel: React.FC<BasemapPanelProps> = ({
  basemap,
  onChange,
  onClose,
  onParcelImport,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [lastResult, setLastResult] = useState<string | null>(null);

  // Parcel lookup state
  const [loadParcel, setLoadParcel] = useState(true);
  const [parcelStatus, setParcelStatus] = useState<
    'idle' | 'loading' | 'found' | 'not-found' | 'unsupported' | 'error'
  >('idle');
  const [parcelResult, setParcelResult] = useState<ParcelResult | null>(null);
  const [parcelCountyName, setParcelCountyName] = useState<string>('');
  const [parcelError, setParcelError] = useState<string | null>(null);

  // ── Geocoding + parcel lookup ─────────────────────────────────────────────

  const handleSearch = useCallback(async () => {
    if (!searchQuery.trim()) return;
    setSearching(true);
    setSearchError(null);
    setLastResult(null);
    setParcelStatus('idle');
    setParcelResult(null);
    setParcelError(null);

    try {
      const result = await geocodeAddress(searchQuery.trim());
      if (!result) {
        setSearchError('Address not found. Try a more specific address.');
        return;
      }

      // Update basemap position
      const feetPerPixel = computeFeetPerPixel(result.lat, basemap.tileZoom);
      onChange({
        centerLat: result.lat,
        centerLng: result.lng,
        feetPerPixel,
        anchorX: 0,
        anchorY: 0,
      });
      setLastResult(result.displayName);

      // ── Parcel lookup ───────────────────────────────────────────────────
      if (loadParcel && onParcelImport) {
        const addrDetails = result.addressDetails;
        const countyName = getCountyDisplayName(addrDetails);
        setParcelCountyName(countyName);

        if (!isCountySupported(addrDetails)) {
          setParcelStatus('unsupported');
          return;
        }

        setParcelStatus('loading');

        try {
          const parcel = await lookupParcelByCoordinates(result.lat, result.lng, addrDetails);

          if (!parcel) {
            setParcelStatus('not-found');
            return;
          }

          setParcelResult(parcel);
          setParcelStatus('found');

          // Convert parcel geometry → CAD lines on GIS layer (subject parcel: solid, bright)
          const parcelLines = geomToCADLines(
            parcel.geometry,
            result.lat,
            result.lng,
            {
              strokeColor: '#ffffff',
              layerId: 'gis',
              idPrefix: `parcel-${Date.now()}`,
              strokeWidth: 2,
            }
          );

          // Always load neighbors — they go on gis-context layer (dashed, muted, 40% opacity)
          let neighborLines: CADElement[] = [];
          try {
            const neighborFeatures = await lookupNeighborParcels(
              result.lat,
              result.lng,
              addrDetails,
              200
            );
            neighborFeatures.forEach((f, fi) => {
              if (
                f.geometry &&
                (f.geometry.type === 'Polygon' || f.geometry.type === 'MultiPolygon')
              ) {
                // Extract APN from raw properties for tiny label
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const props = (f as any).properties ?? {};
                const apn: string | undefined =
                  props.APN ?? props.apn ?? props.PARCEL_NO ?? props.parcel_no ?? undefined;

                const lines = geomToCADLines(
                  f.geometry as GeoJSON.Polygon | GeoJSON.MultiPolygon,
                  result.lat,
                  result.lng,
                  {
                    strokeColor: '#666666',
                    layerId: 'gis-context',
                    idPrefix: `neighbor-${fi}-${Date.now()}`,
                    strokeWidth: 1,
                    isNeighbor: true,
                    neighborApn: apn,
                    dashPattern: [6, 4],
                    opacity: 0.4,
                  }
                );
                neighborLines = [...neighborLines, ...lines];
              }
            });
          } catch {
            // Neighbors are best-effort — don't block if they fail
          }

          const allLines = [...parcelLines, ...neighborLines];
          const allNewLayers = neighborLines.length > 0
            ? [GIS_CONTEXT_LAYER, GIS_LAYER]
            : [GIS_LAYER];
          if (allLines.length > 0) {
            onParcelImport(allLines, allNewLayers);
          }
        } catch (err) {
          setParcelStatus('error');
          setParcelError(String(err));
        }
      }
    } catch (err) {
      setSearchError('Geocoding failed: ' + String(err));
    } finally {
      setSearching(false);
    }
  }, [searchQuery, basemap.tileZoom, onChange, loadParcel, onParcelImport]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') handleSearch();
    },
    [handleSearch]
  );

  // ── Zoom change ──────────────────────────────────────────────────────────

  const handleZoomChange = useCallback(
    (zoom: number) => {
      const feetPerPixel = computeFeetPerPixel(basemap.centerLat, zoom);
      onChange({ tileZoom: zoom, feetPerPixel });
    },
    [basemap.centerLat, onChange]
  );

  // ── Render ───────────────────────────────────────────────────────────────

  const feetPerPx = basemap.feetPerPixel ?? computeFeetPerPixel(basemap.centerLat, basemap.tileZoom);

  return (
    <div className="absolute top-12 left-1/2 -translate-x-1/2 z-30 bg-cad-surface/95 backdrop-blur-sm border border-cad-accent rounded-xl p-4 w-[420px] shadow-2xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-cad-text font-semibold text-sm">Satellite Basemap</h3>
        <button
          onClick={onClose}
          className="text-cad-dim hover:text-cad-text transition-colors text-sm"
        >
          Close
        </button>
      </div>

      {/* Enable toggle */}
      <div className="flex items-center gap-2 mb-3">
        <button
          onClick={() => onChange({ enabled: !basemap.enabled })}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
            basemap.enabled
              ? 'bg-blue-600 text-white hover:bg-blue-500'
              : 'bg-cad-surface border border-cad-accent text-cad-dim hover:text-cad-text'
          }`}
        >
          {basemap.enabled ? 'Basemap ON' : 'Basemap OFF'}
        </button>

        <button
          onClick={() => onChange({ locked: !basemap.locked })}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
            basemap.locked
              ? 'bg-amber-600 text-white hover:bg-amber-500'
              : 'bg-cad-surface border border-cad-accent text-cad-dim hover:text-cad-text'
          }`}
        >
          {basemap.locked ? 'Locked' : 'Unlocked'}
        </button>
      </div>

      {/* Address search */}
      <div className="mb-3">
        <label className="text-cad-dim text-xs mb-1 block">Site Address</label>
        <div className="flex gap-2">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="123 Main St, Ojai CA"
            className="flex-1 bg-cad-bg border border-cad-accent rounded px-2 py-1.5 text-cad-text text-sm outline-none focus:border-blue-400"
          />
          <button
            onClick={handleSearch}
            disabled={searching || !searchQuery.trim()}
            className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded text-xs font-medium transition-colors"
          >
            {searching ? '...' : 'Go'}
          </button>
        </div>
        {searchError && (
          <p className="text-red-400 text-xs mt-1">{searchError}</p>
        )}
        {lastResult && (
          <p className="text-green-400 text-xs mt-1 truncate" title={lastResult}>
            Found: {lastResult}
          </p>
        )}
      </div>

      {/* Parcel lookup options (only shown if onParcelImport is wired up) */}
      {onParcelImport && (
        <div className="mb-3 border border-cad-accent/50 rounded-lg p-2.5">
          <div className="text-cad-dim text-xs font-medium mb-2">Property Data</div>

          <label className="flex items-center gap-2 cursor-pointer mb-1.5">
            <input
              type="checkbox"
              checked={loadParcel}
              onChange={(e) => setLoadParcel(e.target.checked)}
              className="accent-cyan-500"
            />
            <span className="text-cad-text text-xs">Load property boundary + neighbors</span>
          </label>
          {loadParcel && (
            <p className="text-cad-dim/60 text-[10px] ml-1">
              Neighboring parcels load automatically as muted context on the GIS Context layer.
            </p>
          )}

          {/* Parcel status messages */}
          {parcelStatus === 'loading' && (
            <p className="text-cyan-400 text-xs mt-2">
              Fetching parcel data from {parcelCountyName}…
            </p>
          )}
          {parcelStatus === 'found' && parcelResult && (
            <ParcelInfoCard result={parcelResult} countyName={parcelCountyName} />
          )}
          {parcelStatus === 'not-found' && (
            <p className="text-amber-400 text-xs mt-2">
              No parcel found at this location in {parcelCountyName} data.
              You can import a GeoJSON/KML file manually.
            </p>
          )}
          {parcelStatus === 'unsupported' && (
            <p className="text-cad-dim text-xs mt-2">
              Parcel data not available for {parcelCountyName}.
              Supported counties: Ventura, Los Angeles, Santa Barbara, Orange,
              Riverside, San Diego, San Luis Obispo, Kern.
              You can import a GeoJSON/KML file manually.
            </p>
          )}
          {parcelStatus === 'error' && (
            <p className="text-red-400 text-xs mt-2">
              Parcel lookup failed (CORS or network error). Try the manual GIS import.
              {parcelError && (
                <span className="block text-red-400/70 mt-0.5">{parcelError}</span>
              )}
            </p>
          )}
        </div>
      )}

      {/* Provider */}
      <div className="mb-3">
        <label className="text-cad-dim text-xs mb-1 block">Tile Provider</label>
        <div className="flex gap-2">
          {(['esri', 'osm'] as TileProvider[]).map((p) => (
            <button
              key={p}
              onClick={() => onChange({ provider: p })}
              className={`px-3 py-1 rounded text-xs transition-colors ${
                basemap.provider === p
                  ? 'bg-blue-600 text-white'
                  : 'bg-cad-surface border border-cad-accent text-cad-dim hover:text-cad-text'
              }`}
            >
              {p === 'esri' ? 'Esri Satellite' : 'OpenStreetMap'}
            </button>
          ))}
        </div>
      </div>

      {/* Tile zoom */}
      <div className="mb-3">
        <label className="text-cad-dim text-xs mb-1 block">
          Detail Level (zoom {basemap.tileZoom})
          <span className="ml-2 text-cad-dim/70">
            ≈ {feetPerPx.toFixed(2)} ft/px
          </span>
        </label>
        <input
          type="range"
          min={14}
          max={20}
          value={basemap.tileZoom}
          onChange={(e) => handleZoomChange(Number(e.target.value))}
          className="w-full accent-blue-500"
        />
        <div className="flex justify-between text-cad-dim/60 text-[10px]">
          <span>City (14)</span>
          <span>Block (17)</span>
          <span>Parcel (20)</span>
        </div>
      </div>

      {/* Opacity */}
      <div className="mb-3">
        <label className="text-cad-dim text-xs mb-1 block">
          Opacity: {Math.round(basemap.opacity * 100)}%
        </label>
        <input
          type="range"
          min={0}
          max={100}
          value={Math.round(basemap.opacity * 100)}
          onChange={(e) => onChange({ opacity: Number(e.target.value) / 100 })}
          className="w-full accent-blue-500"
        />
      </div>

      {/* Current coordinates */}
      <div className="border border-cad-accent/50 rounded p-2 text-xs text-cad-dim">
        <div>Center: {basemap.centerLat.toFixed(6)}, {basemap.centerLng.toFixed(6)}</div>
        <div className="mt-0.5">
          Scale: {feetPerPx.toFixed(3)} ft/px
          {basemap.feetPerPixel === null && <span className="ml-1 text-cad-dim/60">(auto)</span>}
        </div>
        <div className="mt-1 text-cad-dim/60">
          Tip: Search your site address to load the satellite image and property boundary automatically.
        </div>
      </div>
    </div>
  );
};
