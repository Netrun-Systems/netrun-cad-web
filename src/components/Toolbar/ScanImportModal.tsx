/**
 * ScanImportModal — handles 3D scan file import (OBJ, PLY) from KIRI Engine.
 *
 * Features:
 *  - File picker for .obj and .ply
 *  - Processing options: scale, projection, output mode
 *  - Chunked processing via setTimeout to avoid blocking UI
 *  - Progress indicator for large scans
 */

import React, { useState, useCallback, useRef } from 'react';
import type { CADElement, Layer } from '../../engine/types';
import { parseOBJ } from '../../engine/obj-import';
import { parsePLY } from '../../engine/ply-import';
import { processScan, SCAN_LAYER } from '../../engine/scan-processor';
import type { ScanOutputMode } from '../../engine/scan-processor';

// ── Types ─────────────────────────────────────────────────────────────────────

interface ScanImportModalProps {
  onImport: (elements: CADElement[], newLayers: Layer[]) => void;
  onClose: () => void;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const SCALE_OPTIONS = [
  { label: 'Meters → Feet (KIRI default)', value: 3.28084 },
  { label: 'Centimeters → Feet', value: 0.0328084 },
  { label: 'No scaling (1:1)', value: 1 },
  { label: 'Custom…', value: -1 },
];

// ── Component ─────────────────────────────────────────────────────────────────

export const ScanImportModal: React.FC<ScanImportModalProps> = ({ onImport, onClose }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [scaleIdx, setScaleIdx] = useState(0);
  const [customScale, setCustomScale] = useState('3.28084');
  const [projection, setProjection] = useState<'planView' | 'elevation'>('planView');
  const [outputMode, setOutputMode] = useState<ScanOutputMode>('boundary');
  const [contourInterval, setContourInterval] = useState('1');
  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // ── File selection ────────────────────────────────────────────────────────

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    const ext = file.name.split('.').pop()?.toLowerCase();
    if (ext !== 'obj' && ext !== 'ply') {
      setError('Unsupported file type. Please select an .obj or .ply file.');
      return;
    }

    setSelectedFile(file);
    setError(null);
  }, []);

  // ── Processing ────────────────────────────────────────────────────────────

  const handleImport = useCallback(async () => {
    if (!selectedFile) return;
    setProcessing(true);
    setError(null);

    try {
      const ext = selectedFile.name.split('.').pop()?.toLowerCase();
      const text = await selectedFile.text();

      setProgress('Parsing file...');

      // Yield to UI before heavy parsing
      await new Promise<void>((resolve) => setTimeout(resolve, 0));

      const scaleFactor = scaleIdx === 3
        ? parseFloat(customScale) || 3.28084
        : SCALE_OPTIONS[scaleIdx].value;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let vertices: any[] = [];
      const parseWarnings: string[] = [];

      if (ext === 'obj') {
        setProgress('Parsing OBJ...');
        await new Promise<void>((resolve) => setTimeout(resolve, 0));
        const data = parseOBJ(text);
        vertices = data.vertices;
        parseWarnings.push(...data.warnings);
        setProgress(`Parsed ${data.vertexCount.toLocaleString()} vertices, ${data.faceCount.toLocaleString()} faces`);
      } else if (ext === 'ply') {
        setProgress('Parsing PLY...');
        await new Promise<void>((resolve) => setTimeout(resolve, 0));
        const data = parsePLY(text);
        vertices = data.vertices;
        parseWarnings.push(...data.warnings);
        setProgress(`Parsed ${data.vertexCount.toLocaleString()} vertices`);
      }

      if (vertices.length === 0) {
        throw new Error('No vertices found in file. Check that the file is a valid scan export.');
      }

      setProgress(`Processing ${vertices.length.toLocaleString()} vertices...`);
      await new Promise<void>((resolve) => setTimeout(resolve, 0));

      const result = processScan(vertices, {
        scaleFactor,
        projection,
        outputMode,
        contourInterval: parseFloat(contourInterval) || 1,
        layerId: 'scan',
        strokeColor: '#ff6e40',
      });

      if (result.warnings.length > 0) {
        console.warn('Scan import warnings:', [...parseWarnings, ...result.warnings]);
      }

      const { stats } = result;
      setProgress(
        `Done: ${stats.outputElements} elements` +
        (stats.boundaryPoints > 0 ? `, ${stats.boundaryPoints} boundary pts` : '') +
        (stats.contourLines > 0 ? `, ${stats.contourLines} contour segs` : '')
      );

      // Small delay so user sees the result message
      await new Promise<void>((resolve) => setTimeout(resolve, 500));

      onImport(result.elements, result.newLayers);
      onClose();
    } catch (err) {
      setError(String(err));
    } finally {
      setProcessing(false);
      setProgress(null);
    }
  }, [selectedFile, scaleIdx, customScale, projection, outputMode, contourInterval, onImport, onClose]);

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-cad-surface border border-cad-accent rounded-xl p-6 w-[460px] shadow-2xl">
        <h2 className="text-cad-text font-semibold text-lg mb-1">Import 3D Scan</h2>
        <p className="text-cad-dim text-xs mb-4">
          Supports KIRI Engine exports: OBJ and PLY (ASCII). Projects scan to 2D plan view.
        </p>

        {/* File picker */}
        <div className="mb-4">
          <label className="text-cad-dim text-xs mb-1 block">Scan File (.obj or .ply)</label>
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
            accept=".obj,.ply"
            className="hidden"
            onChange={handleFileChange}
          />
        </div>

        {/* Scale */}
        <div className="mb-3">
          <label className="text-cad-dim text-xs mb-1 block">Unit Scale</label>
          <select
            value={scaleIdx}
            onChange={(e) => setScaleIdx(Number(e.target.value))}
            className="w-full bg-cad-bg border border-cad-accent rounded px-2 py-1.5 text-cad-text text-sm outline-none"
          >
            {SCALE_OPTIONS.map((o, i) => (
              <option key={i} value={i}>{o.label}</option>
            ))}
          </select>
          {scaleIdx === 3 && (
            <input
              type="number"
              step="0.001"
              value={customScale}
              onChange={(e) => setCustomScale(e.target.value)}
              placeholder="Scale factor (e.g. 3.28084)"
              className="mt-2 w-full bg-cad-bg border border-cad-accent rounded px-2 py-1.5 text-cad-text text-sm outline-none"
            />
          )}
        </div>

        {/* Projection */}
        <div className="mb-3">
          <label className="text-cad-dim text-xs mb-1 block">Projection</label>
          <div className="flex gap-2">
            {[
              { value: 'planView', label: 'Plan View (top-down)' },
              { value: 'elevation', label: 'Front Elevation' },
            ].map((opt) => (
              <button
                key={opt.value}
                onClick={() => setProjection(opt.value as 'planView' | 'elevation')}
                className={`flex-1 px-3 py-1.5 rounded text-xs font-medium transition-colors ${
                  projection === opt.value
                    ? 'bg-blue-600 text-white'
                    : 'bg-cad-surface border border-cad-accent text-cad-dim hover:text-cad-text'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Output mode */}
        <div className="mb-3">
          <label className="text-cad-dim text-xs mb-1 block">Output</label>
          <div className="grid grid-cols-2 gap-2">
            {[
              { value: 'boundary', label: 'Boundary outline' },
              { value: 'pointCloud', label: 'Point cloud' },
              { value: 'contours', label: 'Contour lines' },
              { value: 'all', label: 'All (boundary + cloud + contours)' },
            ].map((opt) => (
              <button
                key={opt.value}
                onClick={() => setOutputMode(opt.value as ScanOutputMode)}
                className={`px-3 py-1.5 rounded text-xs font-medium transition-colors text-left ${
                  outputMode === opt.value
                    ? 'bg-blue-600 text-white'
                    : 'bg-cad-surface border border-cad-accent text-cad-dim hover:text-cad-text'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Contour interval (only when contours selected) */}
        {(outputMode === 'contours' || outputMode === 'all') && projection === 'planView' && (
          <div className="mb-3">
            <label className="text-cad-dim text-xs mb-1 block">Contour Interval (feet)</label>
            <input
              type="number"
              step="0.5"
              min="0.1"
              value={contourInterval}
              onChange={(e) => setContourInterval(e.target.value)}
              className="w-full bg-cad-bg border border-cad-accent rounded px-2 py-1.5 text-cad-text text-sm outline-none"
            />
          </div>
        )}

        {/* Progress / error */}
        {progress && (
          <div className="mb-3 px-3 py-2 bg-blue-900/30 border border-blue-500/30 rounded text-blue-300 text-xs">
            {progress}
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
            className="px-4 py-2 bg-orange-600 hover:bg-orange-500 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition-colors"
          >
            {processing ? 'Processing…' : 'Import Scan'}
          </button>
        </div>
      </div>
    </div>
  );
};
