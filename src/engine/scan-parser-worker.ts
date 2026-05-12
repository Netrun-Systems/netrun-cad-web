/**
 * Promise-based wrapper around the OBJ/PLY parsing Web Worker.
 *
 * Spinning up a fresh worker per call is intentional: parsing happens
 * once per imported file (rare, never bursty), and a fresh worker
 * guarantees we never leak listeners across invocations or accidentally
 * deadlock if a previous parse died mid-flight. Per-call cost is ~5ms
 * for worker startup, dwarfed by the parsing itself which is what we're
 * trying to move off the main thread.
 *
 * Vite handles bundling via the `?worker` import suffix — the worker
 * gets its own chunk and is fetched on first use.
 */

import ScanParserWorker from '../workers/scan-parser.worker?worker';
import type { OBJData } from './obj-import';
import type { PLYData } from './ply-import';

let nextRequestId = 1;

interface WorkerResponse<T> {
  requestId: string;
  ok: boolean;
  result?: T;
  error?: string;
}

function runParse<T>(format: 'obj' | 'ply', text: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const worker = new ScanParserWorker();
    const requestId = String(nextRequestId++);

    worker.onmessage = (e: MessageEvent<WorkerResponse<T>>) => {
      if (e.data.requestId !== requestId) return; // shouldn't happen — single-shot worker
      worker.terminate();
      if (e.data.ok && e.data.result !== undefined) resolve(e.data.result);
      else reject(new Error(e.data.error ?? 'Worker parse failed'));
    };

    worker.onerror = (err) => {
      worker.terminate();
      reject(err.error ?? new Error(err.message));
    };

    worker.postMessage({ format, text, requestId });
  });
}

/** Parse an OBJ file off the main thread. Drop-in replacement for parseOBJ. */
export function parseOBJInWorker(text: string): Promise<OBJData> {
  return runParse<OBJData>('obj', text);
}

/** Parse a PLY file off the main thread. Drop-in replacement for parsePLY. */
export function parsePLYInWorker(text: string): Promise<PLYData> {
  return runParse<PLYData>('ply', text);
}
