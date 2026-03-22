/**
 * GISImportModal — imports GeoJSON or KML vector GIS data.
 *
 * Handles coordinate reference: user provides their approximate lat/lng origin
 * (the point in their drawing that corresponds to 0,0) and the import
 * converts GIS coordinates to drawing-space feet.
 */

import React, { useState, useCallback, useRef } from 'react';
import type { CADElement, Layer } from '../../engine/types';
import { importGeoJSON, GIS_LAYER } from '../../engine/geojson-import';
import { importKML } from '../../engine/kml-import';

// ── Props ─────────────────────────────────────────────────────────────────────

interface GISImportModalProps {
  /** Pre-fill origin from basemap if available */
  defaultLat?: number;
  defaultLng?: number;
  onImport: (elements: CADElement[], newLayers: Layer[]) => void;
  onClose: () => void;
}

// ── Component ─────────────────────────────────────────────────────────────────

export const GISImportModal: React.FC<GISImportModalProps> = ({
  defaultLat = 34.4483,
  defaultLng = -119.2434,
  onImport,
  onClose,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [originLat, setOriginLat] = useState(defaultLat.toFixed(6));
  const [originLng, setOriginLng] = useState(defaultLng.toFixed(6));
  const [strokeColor, setStrokeColor] = useState('#00e5ff');
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);

  // ── File selection ────────────────────────────────────────────────────────

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    const ext = file.name.split('.').pop()?.toLowerCase();
    if (ext !== 'geojson' && ext !== 'json' && ext !== 'kml') {
      setError('Unsupported file type. Please select a .geojson, .json, or .kml file.');
      return;
    }

    setSelectedFile(file);
    setError(null);
    setResult(null);
  }, []);

  // ── Import ────────────────────────────────────────────────────────────────

  const handleImport = useCallback(async () => {
    if (!selectedFile) return;
    setProcessing(true);
    setError(null);
    setResult(null);

    try {
      const text = await selectedFile.text();
      const lat = parseFloat(originLat);
      const lng = parseFloat(originLng);

      if (isNaN(lat) || isNaN(lng)) {
        throw new Error('Invalid origin coordinates. Enter decimal degrees (e.g. 34.448300, -119.243400).');
      }

      const opts = {
        originLat: lat,
        originLng: lng,
        strokeColor,
        layerId: 'gis',
      };

      const ext = selectedFile.name.split('.').pop()?.toLowerCase();
      let elements: CADElement[] = [];
      let newLayers: Layer[] = [];
      let summary = '';

      if (ext === 'kml') {
        const res = importKML(text, opts);
        elements = res.elements;
        newLayers = res.newLayers;
        summary = `${res.placemarkCount} placemarks → ${elements.length} line segments`;
        if (res.warnings.length > 0) {
          console.warn('KML import warnings:', res.warnings);
        }
      } else {
        const res = importGeoJSON(text, opts);
        elements = res.elements;
        newLayers = res.newLayers;
        summary = `${res.featureCount} features → ${elements.length} line segments`;
        if (res.warnings.length > 0) {
          console.warn('GeoJSON import warnings:', res.warnings);
        }
      }

      if (elements.length === 0) {
        setError('No geometry imported. The file may contain only point features, or the origin coordinates may be far from the data.');
        setProcessing(false);
        return;
      }

      setResult(summary);

      // Ensure GIS layer is included
      if (!newLayers.find((l) => l.id === 'gis')) {
        newLayers = [GIS_LAYER, ...newLayers];
      }

      await new Promise<void>((resolve) => setTimeout(resolve, 400));
      onImport(elements, newLayers);
      onClose();
    } catch (err) {
      setError(String(err));
    } finally {
      setProcessing(false);
    }
  }, [selectedFile, originLat, originLng, strokeColor, onImport, onClose]);

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-cad-surface border border-cad-accent rounded-xl p-6 w-[440px] shadow-2xl">
        <h2 className="text-cad-text font-semibold text-lg mb-1">Import GIS Data</h2>
        <p className="text-cad-dim text-xs mb-4">
          Import property boundaries and parcel lines from GeoJSON or KML files.
        </p>

        {/* File picker */}
        <div className="mb-4">
          <label className="text-cad-dim text-xs mb-1 block">File (.geojson, .json, .kml)</label>
          <div className="flex gap-2">
            <div className="flex-1 bg-cad-bg border border-cad-accent rounded px-2 py-1.5 text-sm text-cad-dim truncate">
              {selectedFile ? selectedFile.name : 'No file selected'}
            </div>
            <button
              onClick={() => fileInputRef.current?.click()}
              className="px-3 py-1.5 bg-cad-surface border border-cad-accent text-cad-text rounded text-xs hover:bg-cad-accent/30 transition-colors"
            >
              Browse
            </button>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept=".geojson,.json,.kml"
            className="hidden"
            onChange={handleFileChange}
          />
        </div>

        {/* Origin coordinates */}
        <div className="mb-4">
          <label className="text-cad-dim text-xs mb-1 block">
            Drawing Origin (lat/lng that maps to 0,0 in your drawing)
          </label>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-cad-dim/70 text-xs">Latitude</label>
              <input
                type="text"
                value={originLat}
                onChange={(e) => setOriginLat(e.target.value)}
                placeholder="34.448300"
                className="w-full bg-cad-bg border border-cad-accent rounded px-2 py-1.5 text-cad-text text-sm outline-none focus:border-blue-400"
              />
            </div>
            <div>
              <label className="text-cad-dim/70 text-xs">Longitude</label>
              <input
                type="text"
                value={originLng}
                onChange={(e) => setOriginLng(e.target.value)}
                placeholder="-119.243400"
                className="w-full bg-cad-bg border border-cad-accent rounded px-2 py-1.5 text-cad-text text-sm outline-none focus:border-blue-400"
              />
            </div>
          </div>
          <p className="text-cad-dim/60 text-xs mt-1">
            Tip: Use the basemap center coordinates if you have the basemap positioned on your site.
          </p>
        </div>

        {/* Color */}
        <div className="mb-4 flex items-center gap-3">
          <label className="text-cad-dim text-xs">Line Color</label>
          <input
            type="color"
            value={strokeColor}
            onChange={(e) => setStrokeColor(e.target.value)}
            className="w-8 h-8 rounded border border-cad-accent bg-transparent cursor-pointer"
          />
          <span className="text-cad-dim text-xs">{strokeColor}</span>
        </div>

        {/* Result / error */}
        {result && (
          <div className="mb-3 px-3 py-2 bg-green-900/30 border border-green-500/30 rounded text-green-300 text-xs">
            {result}
          </div>
        )}
        {error && (
          <div className="mb-3 px-3 py-2 bg-red-900/30 border border-red-500/30 rounded text-red-300 text-xs">
            {error}
          </div>
        )}

        {/* Actions */}
        <div className="flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-cad-dim hover:text-cad-text text-sm transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleImport}
            disabled={!selectedFile || processing}
            className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition-colors"
          >
            {processing ? 'Importing…' : 'Import GIS'}
          </button>
        </div>
      </div>
    </div>
  );
};
