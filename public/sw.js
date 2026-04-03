/**
 * Service Worker for Netrun CAD PWA.
 *
 * Minimal cache-first strategy for app shell + static assets.
 * Network-first for API calls and Google services.
 */

const CACHE_NAME = 'survai-construction-v1';
const APP_SHELL = [
  '/',
  '/index.html',
];

// Install — cache app shell
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL))
  );
  self.skipWaiting();
});

// Activate — clean old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Fetch — network-first for API/Google, cache-first for static assets
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Always go to network for Google APIs, OAuth, and Drive
  if (
    url.hostname.includes('google') ||
    url.hostname.includes('gstatic') ||
    url.pathname.startsWith('/api')
  ) {
    return;
  }

  // Cache-first for app assets
  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request).then((response) => {
        // Cache successful GET responses
        if (response.ok && event.request.method === 'GET') {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        }
        return response;
      });
    })
  );
});
