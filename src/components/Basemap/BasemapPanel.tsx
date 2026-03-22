/**
 * BasemapPanel — satellite imagery controls.
 *
 * Provides:
 *  - Address search (Nominatim geocoding)
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

// ── Props ─────────────────────────────────────────────────────────────────────

interface BasemapPanelProps {
  basemap: BasemapState;
  onChange: (updates: Partial<BasemapState>) => void;
  onClose: () => void;
}

// ── Component ─────────────────────────────────────────────────────────────────

export const BasemapPanel: React.FC<BasemapPanelProps> = ({ basemap, onChange, onClose }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [lastResult, setLastResult] = useState<string | null>(null);

  // ── Geocoding ────────────────────────────────────────────────────────────────

  const handleSearch = useCallback(async () => {
    if (!searchQuery.trim()) return;
    setSearching(true);
    setSearchError(null);
    setLastResult(null);

    try {
      const result = await geocodeAddress(searchQuery.trim());
      if (!result) {
        setSearchError('Address not found. Try a more specific address.');
        return;
      }

      // Compute approximate feet per pixel at this zoom level
      const feetPerPixel = computeFeetPerPixel(result.lat, basemap.tileZoom);

      onChange({
        centerLat: result.lat,
        centerLng: result.lng,
        feetPerPixel,
        anchorX: 0,
        anchorY: 0,
      });

      setLastResult(result.displayName);
    } catch (err) {
      setSearchError('Geocoding failed: ' + String(err));
    } finally {
      setSearching(false);
    }
  }, [searchQuery, basemap.tileZoom, onChange]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') handleSearch();
    },
    [handleSearch]
  );

  // ── Zoom change ──────────────────────────────────────────────────────────────

  const handleZoomChange = useCallback(
    (zoom: number) => {
      const feetPerPixel = computeFeetPerPixel(basemap.centerLat, zoom);
      onChange({ tileZoom: zoom, feetPerPixel });
    },
    [basemap.centerLat, onChange]
  );

  // ── Render ───────────────────────────────────────────────────────────────────

  const feetPerPx = basemap.feetPerPixel ?? computeFeetPerPixel(basemap.centerLat, basemap.tileZoom);

  return (
    <div className="absolute top-12 left-1/2 -translate-x-1/2 z-30 bg-cad-surface/95 backdrop-blur-sm border border-cad-accent rounded-xl p-4 w-[400px] shadow-2xl">
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
          Tip: Enable basemap, search your site address, then trace property lines with the Line tool.
        </div>
      </div>
    </div>
  );
};
