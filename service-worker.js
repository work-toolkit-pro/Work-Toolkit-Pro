// Service worker with safe response cloning to avoid "Response body is already used" errors.
const CACHE_NAME = 'wtp-cache-v1';
const PRECACHE_URLS = [
  '/', '/index.html', '/seo.html', '/image-compressor.html', '/image-resizer.html',
  '/jpg-to-pdf.html', '/pdf-compressor.html', '/ocr-hindi.html', '/robots.txt', '/sitemap.xml', '/manifest.json'
];

self.addEventListener('install', event => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(PRECACHE_URLS))
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(clients.claim());
});

// Fetch handler: tries cache first, falls back to network and caches a clone of the response.
self.addEventListener('fetch', event => {
  const req = event.request;

  // Only handle GET requests (don't try to cache form posts etc.)
  if (req.method !== 'GET') return;

  event.respondWith(
    caches.match(req).then(cachedResponse => {
      // If we have a cached response, return it immediately but also update cache in background
      const networkFetch = fetch(req).then(networkResponse => {
        // If invalid response, just return it
        if (!networkResponse || networkResponse.status !== 200) return networkResponse;

        // Clone for caching: clone() returns a fresh stream for the cache while we return the original.
        const responseClone = networkResponse.clone();
        caches.open(CACHE_NAME).then(cache => {
          cache.put(req, responseClone).catch(() => {/* put may fail on opaque responses */});
        });
        return networkResponse;
      }).catch(() => cachedResponse || new Response(null, { status: 404 }));

      // Return cached if present, otherwise wait for network
      return cachedResponse || networkFetch;
    })
  );
});

// Listen for skipWaiting from page to immediately activate new SW if posted
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});