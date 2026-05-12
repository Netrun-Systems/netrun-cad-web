/**
 * Web Worker that runs OBJ + PLY parsing off the main thread.
 *
 * The actual parsing logic lives in the engine modules — they're pure
 * functions with no DOM access, so they work in a worker context as-is.
 * The worker just owns the message-handling shell.
 *
 * Wire is: { format: 'obj' | 'ply', text: string, requestId: string }
 *  → response: { requestId, ok: true, result: OBJData | PLYData }
 *           or { requestId, ok: false, error: string }
 *
 * The wrapper at src/engine/scan-parser-worker.ts owns the lifecycle and
 * exposes a Promise-based API to consumers.
 */

import { parseOBJ } from '../engine/obj-import';
import { parsePLY } from '../engine/ply-import';

interface WorkerRequest {
  format: 'obj' | 'ply';
  text: string;
  requestId: string;
}

self.onmessage = (e: MessageEvent<WorkerRequest>) => {
  const { format, text, requestId } = e.data;
  try {
    const result = format === 'obj' ? parseOBJ(text) : parsePLY(text);
    (self as unknown as Worker).postMessage({ requestId, ok: true, result });
  } catch (err) {
    (self as unknown as Worker).postMessage({
      requestId,
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    });
  }
};
