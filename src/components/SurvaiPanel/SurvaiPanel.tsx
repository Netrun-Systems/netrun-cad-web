/**
 * SurvaiPanel — pull processed 3D site scans from the Survai cloud API.
 *
 * Layout:
 *  - My Scans tab: lists user's cloud scans with status indicators
 *    - Completed scans: "Import to Canvas" button
 *    - Processing scans: animated progress bar
 *    - Thumbnail if available
 *  - Upload tab: drag-and-drop or file picker to send a new scan for processing
 *
 * On "Import to Canvas":
 *  1. Downloads the processed OBJ/PLY from Survai
 *  2. Parses it via the existing obj-import / ply-import pipeline
 *  3. Runs scan-processor (convex hull, contours)
 *  4. Places detections as labelled TextElements on scan/plants/site layers
 *  5. Calls onImport() — same interface as ScanImportModal
 *
 * If Survai is unreachable the panel shows a graceful fallback message
 * and the rest of the app continues to function normally.
 */

import React, {
  useState,
  useCallback,
  useEffect,
  useRef,
} from 'react';
import type { CADElement, Layer, TextElement } from '../../engine/types';
import { parseOBJ } from '../../engine/obj-import';
import { parsePLY } from '../../engine/ply-import';
import { processScan, SCAN_LAYER } from '../../engine/scan-processor';
import {
  listScans,
  getScanStatus,
  downloadScan,
  uploadScan,
  pollUntilDone,
  detectionToLayerId,
  detectionLabel,
  SurvaiUnavailableError,
  type SurvaiScan,
} from '../../services/survai';

// ── Types ─────────────────────────────────────────────────────────────────────

interface SurvaiPanelProps {
  onImport: (elements: CADElement[], newLayers: Layer[]) => void;
  onClose: () => void;
}

type Tab = 'scans' | 'upload';

// ── Helpers ───────────────────────────────────────────────────────────────────

// ── Processing step definitions ──────────────────────────────────────────────

interface ProcessingStep {
  label: string;
  note?: string;
  /** Progress range [min, max) that maps to this step being active */
  range: [number, number];
}

const PROCESSING_STEPS: ProcessingStep[] = [
  { label: 'Upload',           range: [0, 10] },
  { label: 'Mesh Processing',  range: [10, 25] },
  { label: 'ML Detection',     range: [25, 70], note: '~2-5 min for typical scan' },
  { label: 'Route Estimation',  range: [70, 90] },
  { label: 'Complete',          range: [90, 101] },
];

function getActiveStepIndex(progress: number): number {
  for (let i = 0; i < PROCESSING_STEPS.length; i++) {
    const [min, max] = PROCESSING_STEPS[i].range;
    if (progress >= min && progress < max) return i;
  }
  return PROCESSING_STEPS.length - 1;
}

// ── Step indicator sub-component ─────────────────────────────────────────────

const ProcessingStepIndicator: React.FC<{ progress: number }> = ({ progress }) => {
  const activeIdx = getActiveStepIndex(progress);

  return (
    <div className="mt-2 space-y-1">
      {PROCESSING_STEPS.map((step, i) => {
        const isDone = i < activeIdx;
        const isActive = i === activeIdx;
        const isPending = i > activeIdx;

        return (
          <div key={step.label} className="flex items-center gap-2 text-xs">
            {/* Step icon */}
            <div className="w-4 h-4 flex items-center justify-center shrink-0">
              {isDone ? (
                <svg className="w-3.5 h-3.5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                </svg>
              ) : isActive ? (
                <div className="w-2.5 h-2.5 border-2 border-yellow-400 border-t-transparent rounded-full animate-spin" />
              ) : (
                <div className="w-2 h-2 rounded-full bg-cad-accent/40" />
              )}
            </div>

            {/* Label */}
            <span
              className={
                isDone ? 'text-green-400/70 line-through' :
                isActive ? 'text-yellow-400 font-medium' :
                'text-cad-dim/60'
              }
            >
              {step.label}
            </span>

            {/* Note for active step */}
            {isActive && step.note && (
              <span className="text-cad-dim/50 text-[10px] ml-auto">{step.note}</span>
            )}
          </div>
        );
      })}

      {/* Time estimate */}
      <div className="text-cad-dim/50 text-[10px] mt-1 pt-1 border-t border-cad-accent/20">
        Estimated: 2-5 minutes
      </div>
    </div>
  );
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function statusColor(status: SurvaiScan['status']): string {
  switch (status) {
    case 'completed':  return 'text-green-400';
    case 'processing': return 'text-yellow-400';
    case 'uploaded':
    case 'pending':    return 'text-blue-400';
    case 'failed':     return 'text-red-400';
    default:           return 'text-cad-dim';
  }
}

function statusLabel(status: SurvaiScan['status']): string {
  switch (status) {
    case 'completed':  return 'Completed';
    case 'processing': return 'Processing…';
    case 'uploaded':   return 'Queued';
    case 'pending':    return 'Queued';
    case 'failed':     return 'Failed';
    default:           return status;
  }
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  } catch {
    return iso;
  }
}

// ── SCAN_DETECTIONS_LAYER ─────────────────────────────────────────────────────

const DETECTIONS_LAYER: Layer = {
  id: 'survai-detections',
  name: 'Survai Detections',
  visible: true,
  locked: false,
  opacity: 1,
  color: '#00e5ff',
  order: -1,
};

// ── Sub-components ────────────────────────────────────────────────────────────

interface ScanRowProps {
  scan: SurvaiScan;
  onImport: (scan: SurvaiScan) => void;
  importing: boolean;
}

const ScanRow: React.FC<ScanRowProps> = ({ scan, onImport, importing }) => (
  <div className="flex items-start gap-3 p-3 bg-cad-bg border border-cad-accent/60 rounded-lg hover:border-cad-accent transition-colors">
    {/* Thumbnail or placeholder */}
    <div className="w-12 h-12 shrink-0 rounded bg-cad-surface/50 border border-cad-accent/40 flex items-center justify-center overflow-hidden">
      {scan.thumbnail_url ? (
        <img
          src={scan.thumbnail_url}
          alt={scan.filename}
          className="w-full h-full object-cover"
          onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
        />
      ) : (
        <svg className="w-6 h-6 text-cad-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
            d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
        </svg>
      )}
    </div>

    {/* Info */}
    <div className="flex-1 min-w-0">
      <div className="text-cad-text text-xs font-medium truncate" title={scan.filename}>
        {scan.filename}
      </div>
      <div className="text-cad-dim text-xs mt-0.5">{formatDate(scan.created_at)}</div>

      {/* Status */}
      <div className={`text-xs mt-1 font-medium ${statusColor(scan.status)}`}>
        {statusLabel(scan.status)}
        {scan.status === 'processing' && typeof scan.progress === 'number' && (
          <span className="text-cad-dim font-normal ml-1">{scan.progress}%</span>
        )}
      </div>

      {/* Progress bar for in-progress scans */}
      {(scan.status === 'processing' || scan.status === 'uploaded' || scan.status === 'pending') && (
        <>
          <div className="mt-1.5 h-1 bg-cad-surface rounded-full overflow-hidden">
            <div
              className="h-full bg-yellow-500 rounded-full transition-all duration-500"
              style={{ width: `${scan.progress ?? 5}%` }}
            />
          </div>
          {scan.status === 'processing' && (
            <ProcessingStepIndicator progress={scan.progress ?? 0} />
          )}
        </>
      )}

      {/* Detection count for completed scans */}
      {scan.status === 'completed' && scan.detections && scan.detections.length > 0 && (
        <div className="text-cad-dim text-xs mt-0.5">
          {scan.detections.length} object{scan.detections.length !== 1 ? 's' : ''} detected
        </div>
      )}
    </div>

    {/* Action */}
    {scan.status === 'completed' && (
      <button
        onClick={() => onImport(scan)}
        disabled={importing}
        title="Import this scan to the canvas"
        className="shrink-0 px-2.5 py-1.5 bg-orange-600 hover:bg-orange-500 disabled:opacity-50 text-white rounded text-xs font-medium transition-colors"
      >
        Import
      </button>
    )}
  </div>
);

// ── Upload tab ────────────────────────────────────────────────────────────────

interface UploadTabProps {
  onScanUploaded: () => void;
}

const UploadTab: React.FC<UploadTabProps> = ({ onScanUploaded }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleFile = useCallback(async (file: File) => {
    const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
    if (!['obj', 'ply', 'glb'].includes(ext)) {
      setError('Unsupported format. Please select an OBJ, PLY, or GLB file.');
      return;
    }

    setError(null);
    setUploading(true);
    setUploadProgress(`Uploading ${file.name}…`);

    try {
      const { scanId } = await uploadScan(file);
      setUploadProgress(`Upload complete — processing started (scan ID: ${scanId.slice(0, 8)}…)`);
      setTimeout(() => {
        setUploading(false);
        setUploadProgress(null);
        onScanUploaded();
      }, 1500);
    } catch (err) {
      setUploading(false);
      setUploadProgress(null);
      if (err instanceof SurvaiUnavailableError) {
        setError('Survai service unavailable. Import the file manually using "Import 3D Scan".');
      } else {
        setError(String(err));
      }
    }
  }, [onScanUploaded]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleFile(file);
  }, [handleFile]);

  return (
    <div className="p-1">
      <p className="text-cad-dim text-xs mb-3">
        Upload a new scan to Survai for YOLOv8 processing. Processing takes 1–3 minutes.
        The scan will appear in <strong className="text-cad-text">My Scans</strong> when complete.
      </p>

      {/* Drop zone */}
      <div
        className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors ${
          dragging
            ? 'border-orange-500 bg-orange-500/10'
            : 'border-cad-accent/60 hover:border-cad-accent bg-cad-bg/50 hover:bg-cad-surface/30'
        }`}
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        onClick={() => !uploading && fileInputRef.current?.click()}
      >
        <svg className="w-8 h-8 text-cad-dim mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
            d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
        </svg>
        <p className="text-cad-dim text-xs">
          {uploading ? uploadProgress : 'Drop OBJ / PLY / GLB here, or click to browse'}
        </p>
        <p className="text-cad-dim/60 text-xs mt-1">Processed by YOLOv8 for object detection</p>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept=".obj,.ply,.glb"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = '';
          if (file) handleFile(file);
        }}
      />

      {error && (
        <div className="mt-3 px-3 py-2 bg-red-900/30 border border-red-500/30 rounded text-red-300 text-xs">
          {error}
        </div>
      )}
    </div>
  );
};

// ── Main component ────────────────────────────────────────────────────────────

export const SurvaiPanel: React.FC<SurvaiPanelProps> = ({ onImport, onClose }) => {
  const [tab, setTab] = useState<Tab>('scans');
  const [scans, setScans] = useState<SurvaiScan[]>([]);
  const [loading, setLoading] = useState(true);
  const [unavailable, setUnavailable] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [importingId, setImportingId] = useState<string | null>(null);
  const [importProgress, setImportProgress] = useState<string | null>(null);
  const [importError, setImportError] = useState<string | null>(null);

  // Polling interval ref — cleared on unmount
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Load scans ──────────────────────────────────────────────────────────────

  const loadScans = useCallback(async () => {
    setLoadError(null);
    try {
      const results = await listScans();
      // Sort: most recent first
      results.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      setScans(results);
      setUnavailable(false);
    } catch (err) {
      if (err instanceof SurvaiUnavailableError) {
        setUnavailable(true);
      } else {
        setLoadError(String(err));
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadScans();
  }, [loadScans]);

  // Poll in-progress scans every 3 seconds
  useEffect(() => {
    const hasInProgress = scans.some(
      (s) => s.status === 'processing' || s.status === 'uploaded' || s.status === 'pending'
    );

    if (hasInProgress && !pollRef.current) {
      pollRef.current = setInterval(async () => {
        try {
          const results = await listScans();
          results.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
          setScans(results);
        } catch {
          // Polling errors are silent — user can refresh manually
        }
      }, 3000);
    } else if (!hasInProgress && pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }

    return () => {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    };
  }, [scans]);

  // ── Import a completed scan ─────────────────────────────────────────────────

  const handleImportScan = useCallback(
    async (scan: SurvaiScan) => {
      setImportingId(scan.id);
      setImportError(null);

      try {
        // Step 1: If scan was just completed, fetch full details (detections + model_url)
        setImportProgress('Fetching scan details…');
        let fullScan = scan;
        if (!scan.model_url || !scan.detections) {
          fullScan = await getScanStatus(scan.id);
        }

        // Step 2: Download the processed model file
        setImportProgress('Downloading processed scan…');
        const { data, filename } = await downloadScan(fullScan.id);

        // Step 3: Parse OBJ or PLY
        const ext = filename.split('.').pop()?.toLowerCase() ?? 'obj';
        const textDecoder = new TextDecoder('utf-8');
        const text = textDecoder.decode(data);

        setImportProgress('Parsing scan geometry…');
        await new Promise<void>((r) => setTimeout(r, 0)); // yield to UI

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        let vertices: any[] = [];
        if (ext === 'ply') {
          const parsed = parsePLY(text);
          vertices = parsed.vertices;
        } else {
          // Default to OBJ parser for obj and glb (GLB text part)
          const parsed = parseOBJ(text);
          vertices = parsed.vertices;
        }

        if (vertices.length === 0) {
          throw new Error('No geometry found in downloaded scan file.');
        }

        // Step 4: Run scan-processor (convex hull + contours)
        setImportProgress(`Processing ${vertices.length.toLocaleString()} vertices…`);
        await new Promise<void>((r) => setTimeout(r, 0));

        const result = processScan(vertices, {
          scaleFactor: 3.28084, // Survai works in meters; convert to feet
          projection: 'planView',
          outputMode: 'boundary',
          layerId: 'scan',
          strokeColor: '#ff6e40',
        });

        const newElements: CADElement[] = [...result.elements];
        const newLayers: Layer[] = [...result.newLayers];

        // Step 5: Place detection markers as TextElements
        const detections = fullScan.detections ?? [];
        if (detections.length > 0) {
          setImportProgress(`Placing ${detections.length} detection marker${detections.length !== 1 ? 's' : ''}…`);
          await new Promise<void>((r) => setTimeout(r, 0));

          // Add detections layer if we have any detections
          if (!newLayers.find((l) => l.id === DETECTIONS_LAYER.id)) {
            newLayers.push(DETECTIONS_LAYER);
          }

          // Ensure SCAN_LAYER is in the list
          if (!newLayers.find((l) => l.id === SCAN_LAYER.id)) {
            newLayers.push(SCAN_LAYER);
          }

          for (const detection of detections) {
            // Project 3D detection coordinate to 2D plan view
            // Survai uses: x=east, y=north, z=up — same projection as KIRI
            const px = detection.coordinates.x * 3.28084;
            const py = detection.coordinates.z * 3.28084;

            const layerId = detectionToLayerId(detection.feature_type);

            const marker: TextElement = {
              type: 'text',
              id: `survai-detect-${detection.id}`,
              position: { x: px, y: py },
              content: detectionLabel(detection),
              layerId: DETECTIONS_LAYER.id,
              fontSize: 11,
              fontFamily: "'Architects Daughter', cursive, sans-serif",
              color: layerId === 'plants' ? '#66bb6a' : layerId === 'site' ? '#00e5ff' : '#ff6e40',
              rotation: 0,
            };

            newElements.push(marker);
          }
        }

        const { stats } = result;
        setImportProgress(
          `Done — ${stats.outputElements} elements` +
          (detections.length > 0 ? `, ${detections.length} detection markers` : '')
        );

        await new Promise<void>((r) => setTimeout(r, 600));

        onImport(newElements, newLayers);
        onClose();
      } catch (err) {
        if (err instanceof SurvaiUnavailableError) {
          setImportError('Survai service unavailable. Import files manually using "Import 3D Scan".');
        } else {
          setImportError(String(err));
        }
      } finally {
        setImportingId(null);
        setImportProgress(null);
      }
    },
    [onImport, onClose]
  );

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-cad-surface border border-cad-accent rounded-xl w-[500px] max-h-[80vh] flex flex-col shadow-2xl">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-cad-accent/40">
          <div className="flex items-center gap-2">
            {/* Cloud scan icon */}
            <svg className="w-5 h-5 text-orange-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
                d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z" />
            </svg>
            <h2 className="text-cad-text font-semibold text-base">Survai Cloud Scans</h2>
          </div>
          <button
            onClick={onClose}
            className="text-cad-dim hover:text-cad-text transition-colors text-lg leading-none"
            aria-label="Close Survai panel"
          >
            ×
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-cad-accent/40">
          {(['scans', 'upload'] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`flex-1 py-2.5 text-xs font-medium transition-colors ${
                tab === t
                  ? 'text-orange-400 border-b-2 border-orange-400'
                  : 'text-cad-dim hover:text-cad-text'
              }`}
            >
              {t === 'scans' ? 'My Scans' : 'Upload New Scan'}
            </button>
          ))}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-4">
          {/* ── My Scans tab ── */}
          {tab === 'scans' && (
            <>
              {/* Unavailable notice */}
              {unavailable && (
                <div className="px-4 py-3 bg-yellow-900/30 border border-yellow-500/40 rounded-lg text-yellow-300 text-xs mb-3">
                  Survai service unavailable. Import scan files manually using{' '}
                  <strong>Import 3D Scan</strong> in the toolbar.
                </div>
              )}

              {/* Load error */}
              {loadError && !unavailable && (
                <div className="px-4 py-3 bg-red-900/30 border border-red-500/30 rounded-lg text-red-300 text-xs mb-3">
                  {loadError}
                  <button
                    onClick={loadScans}
                    className="ml-2 underline hover:no-underline"
                  >
                    Retry
                  </button>
                </div>
              )}

              {/* Import progress/error for active import */}
              {importProgress && (
                <div className="px-3 py-2 bg-blue-900/30 border border-blue-500/30 rounded-lg text-blue-300 text-xs mb-3">
                  {importProgress}
                </div>
              )}
              {importError && (
                <div className="px-3 py-2 bg-red-900/30 border border-red-500/30 rounded-lg text-red-300 text-xs mb-3">
                  {importError}
                </div>
              )}

              {/* Loading */}
              {loading && !unavailable && (
                <div className="text-cad-dim text-xs text-center py-8">Loading scans…</div>
              )}

              {/* Empty state */}
              {!loading && !unavailable && scans.length === 0 && (
                <div className="text-center py-10">
                  <svg className="w-10 h-10 text-cad-accent/40 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.2}
                      d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                  </svg>
                  <p className="text-cad-dim text-sm">No scans yet</p>
                  <p className="text-cad-dim/60 text-xs mt-1">
                    Switch to <strong className="text-cad-dim">Upload New Scan</strong> to get started
                  </p>
                </div>
              )}

              {/* Scan list */}
              {!loading && scans.length > 0 && (
                <div className="flex flex-col gap-2">
                  {scans.map((scan) => (
                    <ScanRow
                      key={scan.id}
                      scan={scan}
                      onImport={handleImportScan}
                      importing={importingId !== null}
                    />
                  ))}
                </div>
              )}

              {/* Refresh button */}
              {!loading && !unavailable && (
                <button
                  onClick={() => { setLoading(true); loadScans(); }}
                  className="mt-3 w-full py-1.5 text-cad-dim hover:text-cad-text text-xs transition-colors border border-cad-accent/40 rounded hover:border-cad-accent"
                >
                  Refresh
                </button>
              )}
            </>
          )}

          {/* ── Upload tab ── */}
          {tab === 'upload' && (
            <UploadTab
              onScanUploaded={() => {
                setTab('scans');
                setLoading(true);
                loadScans();
              }}
            />
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-cad-accent/40 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-1.5 text-cad-dim hover:text-cad-text text-sm transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
