// service-worker.js
// Simple, robust service worker: pre-cache on install, cleanup on activate,
// network-first with cache fallback on fetch, and never read the same Response twice.

const CACHE_NAME = 'work-toolkit-pro-v1'; // bump this to force refresh
const PRECACHE_URLS = [
  '/',                // index
  '/index.html',
  '/manifest.json',
  '/robots.txt',
  '/sitemap.xml',
  '/seo.html',
  // add any other pages/assets you want pre-cached (optional)
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      try {
        const cache = await caches.open(CACHE_NAME);
        await cache.addAll(PRECACHE_URLS);
      } catch (err) {
        // Precache failure shouldn't block install; log for debugging
        console.warn('Service Worker precache failed:', err);
      }
      // Activate immediately on install
      await self.skipWaiting();
    })()
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      try {
        const keys = await caches.keys();
        await Promise.all(
          keys.map((key) => {
            if (key !== CACHE_NAME) {
              return caches.delete(key);
            }
            return Promise.resolve();
          })
        );
      } catch (err) {
        console.warn('Service Worker activation cleanup failed:', err);
      }
      await self.clients.claim();
    })()
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;

  // Only handle GET requests; let other methods pass through
  if (req.method !== 'GET') {
    return;
  }

  // Avoid attempting to handle internal extension requests (chrome-extension://)
  // These will fail to cache and can throw errors
  if (!req.url.startsWith('http')) {
    return;
  }

  // Network-first strategy: try network, cache successful responses, fallback to cache
  event.respondWith(
    (async () => {
      try {
        const networkResponse = await fetch(req);

        // If response is invalid, just return it without caching
        if (!networkResponse || networkResponse.status !== 200) {
          return networkResponse;
        }

        // For opaque cross-origin responses (type === 'opaque'), skip caching or cache with caution
        // Here we skip caching opaque responses to avoid storage bloat and CORS issues
        if (networkResponse.type === 'opaque') {
          return networkResponse;
        }

        // Clone before caching: reading/consuming response body can be done only once
        const responseClone = networkResponse.clone();

        // Cache in background (don't await blocking the response)
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(req, responseClone).catch((err) => {
            // Ignore cache failures (quota issues, invalid entries) but log
            console.warn('Cache put failed for', req.url, err);
          });
        });

        return networkResponse;
      } catch (err) {
        // Network failed — try cache
        const cached = await caches.match(req);
        if (cached) return cached;

        // Optionally return fallback page for navigation requests
        if (req.mode === 'navigate' || req.headers.get('accept')?.includes('text/html')) {
          const fallback = await caches.match('/index.html');
          if (fallback) return fallback;
        }

        // If nothing matched, rethrow to let browser handle (will be a network failure)
        throw err;
      }
    })()
  );
});
