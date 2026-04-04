/**
 * BlueprintPanel — side panel for importing DXF/DWG blueprints,
 * comparing against scans, and exporting deviation reports.
 */

import React, { useState, useCallback, useRef } from 'react';
import type { CADElement } from '../../engine/types';
import { importDXF } from '../../engine/dxf-import';
import { deviationsToElements } from '../../engine/deviation-renderer';
import type { DeviationReport as RendererDeviationReport } from '../../engine/deviation-renderer';
import { api } from '../../services/api';
import type { BlueprintUploadResponse } from '../../services/blueprints';
import type { DeviationReport } from '../../services/blueprints';
import { useAuth } from '../../contexts/AuthContext';

// ── Types ────────────────────────────────────────────────────────────────────

export interface BlueprintPanelProps {
  isOpen: boolean;
  onClose: () => void;
  activeScanId: string | null;
  onBlueprintImported: (elements: CADElement[], blueprintId: string) => void;
  onDeviationsComputed: (elements: CADElement[]) => void;
  onShowPricing?: () => void;
}

// ── Component ────────────────────────────────────────────────────────────────

export default function BlueprintPanel({
  isOpen,
  onClose,
  activeScanId,
  onBlueprintImported,
  onDeviationsComputed,
  onShowPricing,
}: BlueprintPanelProps) {
  const { isAuthenticated } = useAuth();
  // Upload state
  const [isUploading, setIsUploading] = useState(false);
  const [uploadResponse, setUploadResponse] = useState<BlueprintUploadResponse | null>(null);
  const [blueprintId, setBlueprintId] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);

  // Compare state
  const [toleranceMm, setToleranceMm] = useState(25);
  const [isComparing, setIsComparing] = useState(false);
  const [deviationReport, setDeviationReport] = useState<DeviationReport | null>(null);
  const [compareError, setCompareError] = useState<string | null>(null);

  // Drag state
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── File handling ──────────────────────────────────────────────────────────

  const handleFile = useCallback(
    async (file: File) => {
      if (!activeScanId) return;

      setUploadError(null);
      setIsUploading(true);
      setUploadResponse(null);
      setBlueprintId(null);
      setDeviationReport(null);
      setCompareError(null);

      try {
        // Parse DXF locally for immediate canvas rendering
        const dxfResult = await importDXF(file);
        // Place imported elements on the blueprint layer
        const blueprintElements = dxfResult.elements.map((el) => ({
          ...el,
          layerId: 'blueprint',
        }));

        // Upload to API simultaneously
        const response = await api.uploadBlueprint(activeScanId, file);

        setUploadResponse(response);
        setBlueprintId(response.id);

        // Notify parent with local elements + blueprint ID
        onBlueprintImported(blueprintElements, response.id);
      } catch (err) {
        setUploadError(err instanceof Error ? err.message : 'Upload failed');
      } finally {
        setIsUploading(false);
      }
    },
    [activeScanId, onBlueprintImported],
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      const file = e.dataTransfer.files[0];
      if (file) handleFile(file);
    },
    [handleFile],
  );

  const handleFileInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) handleFile(file);
    },
    [handleFile],
  );

  // ── Compare ────────────────────────────────────────────────────────────────

  const handleCompare = useCallback(async () => {
    if (!activeScanId || !blueprintId) return;

    setIsComparing(true);
    setCompareError(null);
    setDeviationReport(null);

    try {
      const report = await api.compareBlueprint({
        scan_id: activeScanId,
        blueprint_id: blueprintId,
        tolerance_mm: toleranceMm,
      });
      setDeviationReport(report);

      // Convert to CAD elements for canvas overlay
      const rendererReport: RendererDeviationReport = {
        deviations: report.deviations.map((d) => ({
          id: d.id,
          deviation_type: d.deviation_type as RendererDeviationReport['deviations'][0]['deviation_type'],
          severity: d.severity as 'OK' | 'WARNING' | 'CRITICAL',
          distance_mm: d.distance_mm,
          planned_position: null,
          actual_position: null,
          planned_type: d.planned_type ?? null,
          actual_type: d.actual_type ?? null,
          message: d.message,
        })),
      };
      const devElements = deviationsToElements(rendererReport);
      onDeviationsComputed(devElements);
    } catch (err) {
      setCompareError(err instanceof Error ? err.message : 'Comparison failed');
    } finally {
      setIsComparing(false);
    }
  }, [activeScanId, blueprintId, toleranceMm, onDeviationsComputed]);

  // ── Export ─────────────────────────────────────────────────────────────────

  const handleExport = useCallback(async () => {
    if (!blueprintId) return;
    try {
      const blob = await api.exportDeviationDXF(blueprintId);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `deviations-${blueprintId}.dxf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      // Silently fail — user can retry
    }
  }, [blueprintId]);

  // ── Render ─────────────────────────────────────────────────────────────────

  if (!isOpen) return null;

  return (
    <div className="fixed top-0 right-0 w-80 h-full bg-gray-900 text-gray-100 border-l border-gray-700 z-40 flex flex-col shadow-xl">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-700">
        <h2 className="text-sm font-semibold tracking-wide uppercase text-gray-200">
          Blueprint Comparison
        </h2>
        <button
          onClick={onClose}
          className="text-gray-400 hover:text-gray-100 transition-colors"
          aria-label="Close"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Scan selector */}
        <div>
          <label className="block text-xs text-gray-400 mb-1 uppercase tracking-wide">
            Active Scan
          </label>
          {activeScanId ? (
            <div className="text-sm bg-gray-800 rounded px-3 py-2 font-mono text-cyan-400 truncate">
              {activeScanId}
            </div>
          ) : (
            <div className="text-sm text-gray-500 italic">Import a scan first</div>
          )}
        </div>

        {/* Upload section */}
        {activeScanId && (
          <div>
            <label className="block text-xs text-gray-400 mb-2 uppercase tracking-wide">
              Upload Blueprint (DXF/DWG)
            </label>
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragging(true);
              }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`
                border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors
                ${isDragging
                  ? 'border-cyan-400 bg-cyan-950/30'
                  : 'border-gray-600 hover:border-gray-500 bg-gray-800/50'
                }
                ${isUploading ? 'pointer-events-none opacity-60' : ''}
              `}
            >
              {isUploading ? (
                <div className="flex flex-col items-center gap-2">
                  <div className="w-5 h-5 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin" />
                  <span className="text-xs text-gray-400">Uploading &amp; parsing...</span>
                </div>
              ) : (
                <>
                  <svg
                    className="w-8 h-8 mx-auto mb-2 text-gray-500"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={1.5}
                      d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                    />
                  </svg>
                  <span className="text-xs text-gray-400">
                    Drop DXF/DWG here or click to browse
                  </span>
                </>
              )}
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept=".dxf,.dwg"
              className="hidden"
              onChange={handleFileInput}
            />

            {uploadError && (
              <div className="mt-2 text-xs text-red-400 bg-red-950/30 rounded px-3 py-2">
                {uploadError}
              </div>
            )}

            {/* Upload result */}
            {uploadResponse && (
              <div className="mt-3 bg-gray-800 rounded p-3 space-y-1 text-xs">
                <div className="text-green-400 font-medium mb-1">Upload complete</div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Layers</span>
                  <span className="text-gray-200">{uploadResponse.layer_count}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Elements</span>
                  <span className="text-gray-200">{uploadResponse.element_count}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Systems</span>
                  <span className="text-gray-200">{uploadResponse.detected_systems.join(', ') || 'None'}</span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Compare section — visible after upload */}
        {blueprintId && activeScanId && (
          <div className="border-t border-gray-700 pt-4">
            <label className="block text-xs text-gray-400 mb-2 uppercase tracking-wide">
              Compare Settings
            </label>

            {/* Tolerance slider */}
            <div className="mb-3">
              <div className="flex justify-between text-xs mb-1">
                <span className="text-gray-400">Tolerance</span>
                <span className="text-cyan-400 font-mono">{toleranceMm} mm</span>
              </div>
              <input
                type="range"
                min={10}
                max={100}
                step={5}
                value={toleranceMm}
                onChange={(e) => setToleranceMm(Number(e.target.value))}
                className="w-full h-1 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-cyan-500"
              />
              <div className="flex justify-between text-[10px] text-gray-500 mt-0.5">
                <span>10mm</span>
                <span>100mm</span>
              </div>
            </div>

            {/* Compare button — gated to authenticated users (Pro+) */}
            {!isAuthenticated ? (
              <button
                onClick={onShowPricing}
                className="w-full py-2 rounded text-sm font-medium transition-colors bg-indigo-600 hover:bg-indigo-500 text-white"
              >
                Upgrade to Pro to Compare
              </button>
            ) : (
              <button
                onClick={handleCompare}
                disabled={isComparing}
                className={`
                  w-full py-2 rounded text-sm font-medium transition-colors
                  ${isComparing
                    ? 'bg-gray-700 text-gray-400 cursor-wait'
                    : 'bg-cyan-600 hover:bg-cyan-500 text-white'
                  }
                `}
              >
                {isComparing ? (
                  <span className="flex items-center justify-center gap-2">
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Comparing...
                  </span>
                ) : (
                  'Compare'
                )}
              </button>
            )}

            {compareError && (
              <div className="mt-2 text-xs text-red-400 bg-red-950/30 rounded px-3 py-2">
                {compareError}
              </div>
            )}

            {/* Deviation results */}
            {deviationReport && (
              <div className="mt-3 bg-gray-800 rounded p-3 space-y-2 text-xs">
                <div className="flex justify-between items-center mb-1">
                  <span className="text-gray-400">Pass Rate</span>
                  <span
                    className={`text-lg font-bold ${
                      deviationReport.pass_rate >= 0.9
                        ? 'text-green-400'
                        : deviationReport.pass_rate >= 0.7
                          ? 'text-yellow-400'
                          : 'text-red-400'
                    }`}
                  >
                    {(deviationReport.pass_rate * 100).toFixed(1)}%
                  </span>
                </div>
                <div className="space-y-1">
                  <div className="flex justify-between">
                    <span className="text-green-400">Matches</span>
                    <span className="text-gray-200">{deviationReport.matches}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-yellow-400">Position deviations</span>
                    <span className="text-gray-200">{deviationReport.position_deviations}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-orange-400">Type mismatches</span>
                    <span className="text-gray-200">{deviationReport.type_mismatches}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-red-400">Missing in scan</span>
                    <span className="text-gray-200">{deviationReport.missing_in_scan}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-orange-300">Extra in scan</span>
                    <span className="text-gray-200">{deviationReport.extra_in_scan}</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Export button */}
        {blueprintId && deviationReport && (
          <div className="border-t border-gray-700 pt-4">
            <button
              onClick={handleExport}
              className="w-full py-2 rounded text-sm font-medium bg-gray-700 hover:bg-gray-600 text-gray-200 transition-colors"
            >
              Export Deviations DXF
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
