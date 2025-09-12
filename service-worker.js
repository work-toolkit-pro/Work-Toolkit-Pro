// service-worker.js
// Lightweight cache-first service worker with safe checks.
// - avoids trying to cache chrome-extension:// or data: schemes
// - clones responses properly before caching to avoid "body already used" errors

const CACHE_NAME = 'work-toolkit-static-v1';
const ASSETS_TO_CACHE = [
  '/',         // root
  './index.html',
  './',        // ensure root fallback
  './manifest.json'
  // add any other static files you want pre-cached here (e.g. '/assets/icon-192.png')
];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(ASSETS_TO_CACHE).catch((err) => {
        console.warn('Precache failed (some resources may be missing):', err);
      }))
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.map(k => (k !== CACHE_NAME) ? caches.delete(k) : Promise.resolve()));
    await self.clients.claim();
  })());
});

function isSafeToCache(request) {
  try {
    const url = new URL(request.url);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch (err) {
    return false;
  }
}

// Fetch handler: cache-first with network fallback, safe caching
self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return; // only handle GET requests
  if (!isSafeToCache(req)) return; // ignore non-http(s) schemes

  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME);

    // Try cache first
    const cached = await cache.match(req);
    if (cached) {
      return cached;
    }

    // Otherwise fetch from network and optionally cache it
    try {
      const networkResponse = await fetch(req);
      if (!networkResponse || networkResponse.type === 'opaque') {
        // For opaque responses (cross-origin) we might not be able to cache properly; return it directly.
        return networkResponse;
      }

      // Clone before caching: one copy for cache, one for the browser
      const responseClone = networkResponse.clone();
      try {
        await cache.put(req, responseClone);
      } catch (cacheErr) {
        // ignore cache failures (e.g. quota, opaque responses, invalid scheme)
        console.warn('ServiceWorker cache put failed:', cacheErr);
      }
      return networkResponse;
    } catch (err) {
      // Network failed: try a fallback from cache, otherwise return an offline response
      const fallback = await cache.match('./index.html');
      if (fallback) return fallback;
      return new Response('Offline', { status: 503, statusText: 'Offline' });
    }
  })());
});