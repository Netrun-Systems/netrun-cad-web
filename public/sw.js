/**
 * Service Worker for Survai Construction PWA.
 *
 * Enhanced offline-first strategy:
 * - App shell: stale-while-revalidate (cache-first, background update)
 * - API calls: network-first with cache fallback
 * - Scan files (PLY, OBJ, DXF): cache on first load (immutable)
 * - Google/OAuth: always network (never cached)
 * - POST requests when offline: queued in IndexedDB for later replay
 */

const CACHE_NAME = 'survai-construction-v2';
const STATIC_CACHE = 'survai-static-v2';
const DATA_CACHE = 'survai-data-v2';

const APP_SHELL = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icons/icon-192.svg',
  '/icons/icon-512.svg',
];

// File extensions treated as immutable scan data
const SCAN_EXTENSIONS = ['.ply', '.obj', '.dxf', '.las', '.laz'];

// ─── IndexedDB helpers for offline queue ─────────────────────────────────────

function openDB(name, version) {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(name, version || 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains('requests')) {
        db.createObjectStore('requests', { keyPath: 'id', autoIncrement: true });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function queueOfflineRequest(request) {
  try {
    const db = await openDB('survai-offline-queue', 1);
    const tx = db.transaction('requests', 'readwrite');
    const store = tx.objectStore('requests');
    const body = await request.clone().text();
    store.put({
      url: request.url,
      method: request.method,
      body: body,
      headers: Object.fromEntries(request.headers),
      timestamp: Date.now(),
    });
    await new Promise((resolve, reject) => {
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  } catch (err) {
    console.warn('[SW] Failed to queue offline request:', err);
  }
}

async function flushOfflineQueue() {
  try {
    const db = await openDB('survai-offline-queue', 1);
    const tx = db.transaction('requests', 'readonly');
    const store = tx.objectStore('requests');
    const all = await new Promise((resolve, reject) => {
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });

    let flushed = 0;
    for (const entry of all) {
      try {
        const resp = await fetch(entry.url, {
          method: entry.method,
          headers: entry.headers,
          body: entry.method !== 'GET' ? entry.body : undefined,
        });
        if (resp.ok) {
          // Remove from queue on success
          const delTx = db.transaction('requests', 'readwrite');
          delTx.objectStore('requests').delete(entry.id);
          await new Promise((resolve) => { delTx.oncomplete = resolve; });
          flushed++;
        }
      } catch {
        // Still offline or request failed — leave in queue
      }
    }

    db.close();

    // Notify all clients about queue flush
    if (flushed > 0) {
      const clients = await self.clients.matchAll();
      clients.forEach((client) => {
        client.postMessage({ type: 'OFFLINE_QUEUE_FLUSHED', count: flushed });
      });
    }
  } catch (err) {
    console.warn('[SW] Failed to flush offline queue:', err);
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function isGoogleOrAuth(url) {
  return (
    url.hostname.includes('google') ||
    url.hostname.includes('gstatic') ||
    url.hostname.includes('googleapis') ||
    url.pathname.includes('/oauth') ||
    url.pathname.includes('/auth')
  );
}

function isApiCall(url) {
  return url.pathname.startsWith('/api');
}

function isScanFile(url) {
  const path = url.pathname.toLowerCase();
  return SCAN_EXTENSIONS.some((ext) => path.endsWith(ext));
}

// ─── Install ─────────────────────────────────────────────────────────────────

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => cache.addAll(APP_SHELL))
  );
  self.skipWaiting();
});

// ─── Activate ────────────────────────────────────────────────────────────────

self.addEventListener('activate', (event) => {
  const keepCaches = new Set([CACHE_NAME, STATIC_CACHE, DATA_CACHE]);
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((k) => !keepCaches.has(k)).map((k) => caches.delete(k))
      )
    )
  );
  self.clients.claim();
});

// ─── Fetch ───────────────────────────────────────────────────────────────────

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // 1. Google / OAuth — always network, never cache
  if (isGoogleOrAuth(url)) {
    return;
  }

  // 2. POST/PUT/PATCH/DELETE — queue if offline, pass through if online
  if (event.request.method !== 'GET') {
    event.respondWith(
      fetch(event.request.clone()).catch(async () => {
        await queueOfflineRequest(event.request);
        return new Response(
          JSON.stringify({ queued: true, message: 'Request queued for offline sync' }),
          {
            status: 202,
            headers: { 'Content-Type': 'application/json' },
          }
        );
      })
    );
    return;
  }

  // 3. Scan files (PLY, OBJ, DXF) — cache on first load (immutable)
  if (isScanFile(url)) {
    event.respondWith(
      caches.open(DATA_CACHE).then((cache) =>
        cache.match(event.request).then((cached) => {
          if (cached) return cached;
          return fetch(event.request).then((response) => {
            if (response.ok) {
              cache.put(event.request, response.clone());
            }
            return response;
          });
        })
      )
    );
    return;
  }

  // 4. API calls — network-first with cache fallback
  if (isApiCall(url)) {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(DATA_CACHE).then((cache) => cache.put(event.request, clone));
          }
          return response;
        })
        .catch(() => caches.match(event.request).then((cached) =>
          cached || new Response(JSON.stringify({ offline: true }), {
            status: 503,
            headers: { 'Content-Type': 'application/json' },
          })
        ))
    );
    return;
  }

  // 5. App shell & static assets — stale-while-revalidate
  event.respondWith(
    caches.match(event.request).then((cached) => {
      const networkFetch = fetch(event.request)
        .then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(STATIC_CACHE).then((cache) => cache.put(event.request, clone));
          }
          return response;
        })
        .catch(() => cached);

      // Return cached immediately, update in background
      return cached || networkFetch;
    })
  );
});

// ─── Online event — flush queued requests ────────────────────────────────────

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'FLUSH_OFFLINE_QUEUE') {
    flushOfflineQueue();
  }
  if (event.data && event.data.type === 'GET_QUEUE_COUNT') {
    openDB('survai-offline-queue', 1)
      .then((db) => {
        const tx = db.transaction('requests', 'readonly');
        const store = tx.objectStore('requests');
        const countReq = store.count();
        return new Promise((resolve) => {
          countReq.onsuccess = () => {
            db.close();
            resolve(countReq.result);
          };
        });
      })
      .then((count) => {
        event.source.postMessage({ type: 'QUEUE_COUNT', count });
      })
      .catch(() => {
        event.source.postMessage({ type: 'QUEUE_COUNT', count: 0 });
      });
  }
});
