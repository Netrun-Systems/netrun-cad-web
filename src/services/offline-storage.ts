/**
 * Offline storage service for Survai Construction.
 *
 * Uses IndexedDB directly (no library dependency) to cache:
 * - Project data for offline access
 * - Scan files (PLY, OBJ, DXF blobs)
 * - Queued actions to replay when connectivity returns
 */

const DB_NAME = 'survai-offline';
const DB_VERSION = 1;

const STORE_PROJECTS = 'projects';
const STORE_SCANS = 'scans';
const STORE_ACTIONS = 'actions';

// ─── IndexedDB helper ────────────────────────────────────────────────────────

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_PROJECTS)) {
        db.createObjectStore(STORE_PROJECTS, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(STORE_SCANS)) {
        db.createObjectStore(STORE_SCANS, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(STORE_ACTIONS)) {
        db.createObjectStore(STORE_ACTIONS, { keyPath: 'id' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function txPromise(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

function getOne<T>(store: IDBObjectStore, key: string): Promise<T | null> {
  return new Promise((resolve, reject) => {
    const req = store.get(key);
    req.onsuccess = () => resolve(req.result ?? null);
    req.onerror = () => reject(req.error);
  });
}

function getAll<T>(store: IDBObjectStore): Promise<T[]> {
  return new Promise((resolve, reject) => {
    const req = store.getAll();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function getAllKeys(store: IDBObjectStore): Promise<string[]> {
  return new Promise((resolve, reject) => {
    const req = store.getAllKeys();
    req.onsuccess = () => resolve(req.result as string[]);
    req.onerror = () => reject(req.error);
  });
}

// ─── Project caching ─────────────────────────────────────────────────────────

export async function cacheProject(projectId: string, data: unknown): Promise<void> {
  const db = await openDB();
  const tx = db.transaction(STORE_PROJECTS, 'readwrite');
  tx.objectStore(STORE_PROJECTS).put({ id: projectId, data, updatedAt: Date.now() });
  await txPromise(tx);
  db.close();
}

export async function getCachedProject(projectId: string): Promise<unknown | null> {
  const db = await openDB();
  const tx = db.transaction(STORE_PROJECTS, 'readonly');
  const record = await getOne<{ id: string; data: unknown }>(
    tx.objectStore(STORE_PROJECTS),
    projectId
  );
  db.close();
  return record?.data ?? null;
}

export async function listCachedProjects(): Promise<string[]> {
  const db = await openDB();
  const tx = db.transaction(STORE_PROJECTS, 'readonly');
  const keys = await getAllKeys(tx.objectStore(STORE_PROJECTS));
  db.close();
  return keys;
}

export async function clearCachedProject(projectId: string): Promise<void> {
  const db = await openDB();
  const tx = db.transaction(STORE_PROJECTS, 'readwrite');
  tx.objectStore(STORE_PROJECTS).delete(projectId);
  await txPromise(tx);
  db.close();
}

// ─── Scan file caching ──────────────────────────────────────────────────────

export async function cacheScanFile(scanId: string, file: Blob): Promise<void> {
  const db = await openDB();
  const tx = db.transaction(STORE_SCANS, 'readwrite');
  tx.objectStore(STORE_SCANS).put({ id: scanId, file, cachedAt: Date.now() });
  await txPromise(tx);
  db.close();
}

export async function getCachedScanFile(scanId: string): Promise<Blob | null> {
  const db = await openDB();
  const tx = db.transaction(STORE_SCANS, 'readonly');
  const record = await getOne<{ id: string; file: Blob }>(
    tx.objectStore(STORE_SCANS),
    scanId
  );
  db.close();
  return record?.file ?? null;
}

// ─── Offline action queue ────────────────────────────────────────────────────

export interface OfflineAction {
  id: string;
  type: 'upload_scan' | 'compare_blueprint' | 'save_project';
  payload: unknown;
  timestamp: number;
}

export async function queueAction(action: OfflineAction): Promise<void> {
  const db = await openDB();
  const tx = db.transaction(STORE_ACTIONS, 'readwrite');
  tx.objectStore(STORE_ACTIONS).put(action);
  await txPromise(tx);
  db.close();
}

export async function getPendingActions(): Promise<OfflineAction[]> {
  const db = await openDB();
  const tx = db.transaction(STORE_ACTIONS, 'readonly');
  const actions = await getAll<OfflineAction>(tx.objectStore(STORE_ACTIONS));
  db.close();
  return actions.sort((a, b) => a.timestamp - b.timestamp);
}

export async function clearPendingAction(id: string): Promise<void> {
  const db = await openDB();
  const tx = db.transaction(STORE_ACTIONS, 'readwrite');
  tx.objectStore(STORE_ACTIONS).delete(id);
  await txPromise(tx);
  db.close();
}

export async function flushPendingActions(): Promise<{ success: number; failed: number }> {
  const actions = await getPendingActions();
  let success = 0;
  let failed = 0;

  for (const action of actions) {
    try {
      // Determine endpoint and method based on action type
      let url: string;
      let method = 'POST';
      const apiBase = import.meta.env.VITE_API_URL || 'http://localhost:8000';

      switch (action.type) {
        case 'upload_scan':
          url = `${apiBase}/api/scans/upload`;
          break;
        case 'compare_blueprint':
          url = `${apiBase}/api/blueprints/compare`;
          break;
        case 'save_project':
          url = `${apiBase}/api/projects`;
          method = 'PUT';
          break;
        default:
          url = `${apiBase}/api/actions`;
      }

      const resp = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(action.payload),
      });

      if (resp.ok) {
        await clearPendingAction(action.id);
        success++;
      } else {
        failed++;
      }
    } catch {
      failed++;
    }
  }

  return { success, failed };
}
