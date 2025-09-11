// service-worker.js
const CACHE_NAME = 'work-toolkit-cache-v1';
const PRECACHE_URLS = [
  './',
  './index.html',
  './index.css',      // if you have site css file, or remove
  './manifest.json',
  // add other essential resource paths here (images, icons, etc)
];

// Install - pre-cache static resources
self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE_NAME);
      try {
        await cache.addAll(PRECACHE_URLS);
      } catch (err) {
        // If a resource fails to cache it won't break install, log to console
        console.warn('ServiceWorker precache failed:', err);
      }
      await self.skipWaiting();
    })()
  );
});

// Activate - cleanup old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
      );
      await self.clients.claim();
    })()
  );
});

// Fetch - cache-first then network, and ensure Response cloning is handled
self.addEventListener('fetch', (event) => {
  const req = event.request;

  // only handle GET requests
  if (req.method !== 'GET') return;

  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME);

    // Try cache first
    const cached = await cache.match(req);
    if (cached) {
      // Kick off a network update in the background (stale-while-revalidate)
      event.waitUntil((async () => {
        try {
          const networkResp = await fetch(req);
          // clone before putting in cache or reading
          if (networkResp && networkResp.ok) {
            await cache.put(req, networkResp.clone());
          }
        } catch (e) {
          // ignore network errors
        }
      })());
      return cached;
    }

    // Fallback to network
    try {
      const response = await fetch(req);
      // Make sure we have a clone before we consume the response
      const responseClone = response.clone();

      // Put clone in cache asynchronously
      event.waitUntil((async () => {
        try {
          if (responseClone && responseClone.ok) {
            const c = await caches.open(CACHE_NAME);
            await c.put(req, responseClone);
          }
        } catch (e) {
          // caching failed — don't throw to the user
          console.warn('ServiceWorker cache put failed:', e);
        }
      })());

      // Return original response to the page
      return response;
    } catch (err) {
      // Network failed — try to return something from cache (offline fallback)
      const fallback = await cache.match('./'); // maybe index
      if (fallback) return fallback;
      // Final fallback: create a simple Response
      return new Response('Offline', { status: 503, statusText: 'Offline' });
    }
  })());
});
