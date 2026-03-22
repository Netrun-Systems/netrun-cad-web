/**
 * Survai Service — pulls processed 3D site scans from the Survai cloud API.
 *
 * Survai is a GCP Cloud Run service that accepts OBJ/PLY/GLB uploads, runs
 * YOLOv8 object detection, and returns structured scan data with detections.
 *
 * API base URL is read from VITE_SURVAI_API_URL env var.
 * Falls back to localhost:8000 in development.
 * If the service is unreachable the service throws SurvaiUnavailableError —
 * callers should catch this and fall back to manual file import.
 *
 * Auth: Bearer token expected in VITE_SURVAI_TOKEN env var.
 * If absent, unauthenticated requests are attempted (useful for local dev).
 */

// ── Config ────────────────────────────────────────────────────────────────────

/** Resolved at build time by Vite. Override in .env.local for development. */
const SURVAI_API =
  (import.meta as unknown as Record<string, Record<string, string>>).env
    ?.VITE_SURVAI_API_URL ?? 'http://localhost:8000';

const SURVAI_TOKEN =
  (import.meta as unknown as Record<string, Record<string, string>>).env
    ?.VITE_SURVAI_TOKEN ?? '';

/** Timeout for individual HTTP requests in milliseconds. */
const REQUEST_TIMEOUT_MS = 15_000;

// ── Error types ───────────────────────────────────────────────────────────────

export class SurvaiUnavailableError extends Error {
  constructor(detail?: string) {
    super(
      detail
        ? `Survai service unavailable: ${detail}`
        : 'Survai service unavailable — import files manually'
    );
    this.name = 'SurvaiUnavailableError';
  }
}

export class SurvaiApiError extends Error {
  constructor(
    public readonly status: number,
    detail: string
  ) {
    super(`Survai API error ${status}: ${detail}`);
    this.name = 'SurvaiApiError';
  }
}

// ── Domain types ──────────────────────────────────────────────────────────────

export type ScanStatus = 'uploaded' | 'pending' | 'processing' | 'completed' | 'failed';

export interface Detection {
  /** Survai DB UUID. */
  id: string;
  /** YOLOv8 class label (e.g. "tree", "wall", "door", "vehicle"). */
  feature_type: string;
  /** Detection confidence 0–1. */
  confidence: number;
  /** 3D position in scan coordinates (meters). */
  coordinates: { x: number; y: number; z: number };
  /** Optional bounding box in 2D image space. */
  bounding_box?: { x1: number; y1: number; x2: number; y2: number } | null;
  /** Arbitrary extra metadata from the detector. */
  metadata?: Record<string, unknown>;
}

export interface SurvaiScan {
  id: string;
  filename: string;
  status: ScanStatus;
  created_at: string;
  /** Processing progress 0–100. */
  progress?: number;
  message?: string;
  detections?: Detection[];
  /** Signed URL to download the processed OBJ/PLY file. */
  model_url?: string;
  /** Thumbnail image URL (may be absent for older scans). */
  thumbnail_url?: string;
}

export interface UploadResult {
  scanId: string;
}

// ── Internal helpers ──────────────────────────────────────────────────────────

function buildHeaders(extra: Record<string, string> = {}): Record<string, string> {
  const headers: Record<string, string> = { ...extra };
  if (SURVAI_TOKEN) {
    headers['Authorization'] = `Bearer ${SURVAI_TOKEN}`;
  }
  return headers;
}

async function survaiRequest<T>(
  path: string,
  init: RequestInit = {}
): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch(`${SURVAI_API}${path}`, {
      ...init,
      signal: controller.signal,
      headers: {
        ...buildHeaders(),
        ...(init.headers as Record<string, string> | undefined),
      },
    });
  } catch (err) {
    // Network-level failure (service down, CORS, etc.)
    const msg = err instanceof Error ? err.message : String(err);
    throw new SurvaiUnavailableError(msg);
  } finally {
    clearTimeout(timer);
  }

  if (!response.ok) {
    let detail = response.statusText;
    try {
      const body = await response.json();
      detail = body?.detail ?? detail;
    } catch {
      // ignore JSON parse failure
    }
    throw new SurvaiApiError(response.status, detail);
  }

  return response.json() as Promise<T>;
}

// ── Normalise API shapes ───────────────────────────────────────────────────────

/**
 * Normalise a raw API scan object into our SurvaiScan shape.
 * The Survai API uses "processing" / "completed" / "failed" / "pending".
 * We map "uploaded" → "uploaded" as a pass-through.
 */
function normaliseScan(raw: Record<string, unknown>): SurvaiScan {
  const rawStatus = String(raw.status ?? 'unknown').toLowerCase();
  const statusMap: Record<string, ScanStatus> = {
    uploaded: 'uploaded',
    pending: 'pending',
    processing: 'processing',
    completed: 'completed',
    failed: 'failed',
  };

  return {
    id: String(raw.id ?? ''),
    filename: String(raw.filename ?? 'scan'),
    status: statusMap[rawStatus] ?? 'processing',
    created_at: String(raw.created_at ?? new Date().toISOString()),
    progress: typeof raw.progress === 'number' ? raw.progress : 0,
    message: typeof raw.message === 'string' ? raw.message : undefined,
    detections: Array.isArray(raw.detections)
      ? (raw.detections as Detection[])
      : undefined,
    model_url: typeof raw.model_url === 'string' ? raw.model_url : undefined,
    thumbnail_url:
      typeof raw.thumbnail_url === 'string' ? raw.thumbnail_url : undefined,
  };
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * List all scans belonging to the authenticated user.
 * Throws SurvaiUnavailableError if the service cannot be reached.
 */
export async function listScans(): Promise<SurvaiScan[]> {
  const raw = await survaiRequest<unknown[]>('/scans');
  return raw.map((r) => normaliseScan(r as Record<string, unknown>));
}

/**
 * Get status + details for a single scan (including detections when complete).
 */
export async function getScanStatus(scanId: string): Promise<SurvaiScan> {
  // The Survai API has separate /status and /detections endpoints.
  // We merge both into one call for the completed state.
  const statusRaw = await survaiRequest<Record<string, unknown>>(
    `/scans/${scanId}/status`
  );
  const scan = normaliseScan(statusRaw);

  if (scan.status === 'completed' && !scan.detections) {
    try {
      const detectionsRaw = await survaiRequest<Record<string, unknown>>(
        `/scans/${scanId}/detections`
      );
      scan.detections = Array.isArray(detectionsRaw.detections)
        ? (detectionsRaw.detections as Detection[])
        : [];
    } catch {
      // Detections endpoint failure is non-fatal — return scan without them.
    }
  }

  return scan;
}

/**
 * Poll `/scans/{id}/progress` until status reaches completed or failed.
 * Calls onProgress on each tick.
 * Resolves with the final scan state.
 */
export async function pollUntilDone(
  scanId: string,
  onProgress: (progress: number, message: string) => void,
  intervalMs = 2000,
  maxAttempts = 150
): Promise<SurvaiScan> {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    await new Promise<void>((r) => setTimeout(r, attempt === 0 ? 0 : intervalMs));

    const raw = await survaiRequest<Record<string, unknown>>(
      `/scans/${scanId}/progress`
    );
    const progress = typeof raw.progress === 'number' ? raw.progress : 0;
    const message = typeof raw.message === 'string' ? raw.message : '';
    const status = String(raw.status ?? '').toLowerCase();

    onProgress(progress, message);

    if (status === 'completed' || status === 'failed') {
      return getScanStatus(scanId);
    }
  }
  throw new Error(`Scan ${scanId} did not complete within the polling window`);
}

/**
 * Download the processed OBJ or PLY file for a completed scan.
 * Returns the raw file bytes — feed to parseOBJ / parsePLY.
 */
export async function downloadScan(scanId: string): Promise<{ data: ArrayBuffer; filename: string }> {
  const scan = await getScanStatus(scanId);

  if (scan.status !== 'completed') {
    throw new Error(`Scan ${scanId} is not complete (status: ${scan.status})`);
  }

  if (!scan.model_url) {
    throw new Error(`Scan ${scanId} has no model URL — re-processing may be needed`);
  }

  // Fetch the model file. The URL may be a signed GCS URL (no auth header needed)
  // or a relative API path. Handle both.
  const url = scan.model_url.startsWith('http')
    ? scan.model_url
    : `${SURVAI_API}${scan.model_url}`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 60_000); // 60s for file download

  let response: Response;
  try {
    response = await fetch(url, { signal: controller.signal });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new SurvaiUnavailableError(`Model download failed: ${msg}`);
  } finally {
    clearTimeout(timer);
  }

  if (!response.ok) {
    throw new SurvaiApiError(response.status, `Model download failed: ${response.statusText}`);
  }

  const data = await response.arrayBuffer();
  return { data, filename: scan.filename };
}

/**
 * Upload a local OBJ/PLY/GLB file to Survai for processing.
 * Returns the new scan ID immediately (processing is async).
 */
export async function uploadScan(file: File): Promise<UploadResult> {
  const formData = new FormData();
  formData.append('file', file, file.name);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 120_000); // 2 min for upload

  let response: Response;
  try {
    response = await fetch(`${SURVAI_API}/scans/upload`, {
      method: 'POST',
      headers: buildHeaders(), // do NOT set Content-Type — browser sets multipart boundary
      body: formData,
      signal: controller.signal,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new SurvaiUnavailableError(`Upload failed: ${msg}`);
  } finally {
    clearTimeout(timer);
  }

  if (!response.ok) {
    let detail = response.statusText;
    try {
      const body = await response.json();
      detail = body?.detail ?? detail;
    } catch {
      // ignore
    }
    throw new SurvaiApiError(response.status, detail);
  }

  const body = (await response.json()) as { id?: string; scan_id?: string };
  const scanId = body.id ?? body.scan_id ?? '';
  if (!scanId) {
    throw new Error('Survai upload response missing scan ID');
  }

  return { scanId };
}

/**
 * Map a Survai YOLOv8 feature_type label to the canonical CAD layer ID.
 *
 * Trees → "plants" layer (existing trees concept in the plant database)
 * Structures, walls → "site" layer
 * Vehicles, unknown → "scan" layer
 */
export function detectionToLayerId(featureType: string): string {
  const ft = featureType.toLowerCase();
  if (ft.includes('tree') || ft.includes('shrub') || ft.includes('plant') || ft.includes('vegetation')) {
    return 'plants';
  }
  if (
    ft.includes('wall') ||
    ft.includes('structure') ||
    ft.includes('building') ||
    ft.includes('fence') ||
    ft.includes('door') ||
    ft.includes('window') ||
    ft.includes('fixture') ||
    ft.includes('outlet') ||
    ft.includes('switch')
  ) {
    return 'site';
  }
  return 'scan';
}

/**
 * Return a human-readable label for a detection to show as a marker.
 */
export function detectionLabel(d: Detection): string {
  const pct = Math.round(d.confidence * 100);
  return `${d.feature_type} (${pct}%)`;
}
