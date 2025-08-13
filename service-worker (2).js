const CACHE_NAME = 'work-toolkit-pro-cache-v1'; // Changed cache name to reflect new website name
const urlsToCache = [
  '/', // Base path for your User Page
  '/index.html',
  // Note: Privacy Policy and Terms and Conditions files are currently removed from index.html footer.
  // If you re-add them, you'll need to add their paths here as well:
  // '/privacy.html', 
  // '/terms.html',   
  '/icons/icon-192x192.png', // Corrected icon path
  '/icons/icon-512x512.png', // Corrected icon path
  'https://cdn.tailwindcss.com',
  'https://cdn.jsdelivr.net/npm/qrcodejs@1.0.0/qrcode.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js'
];

// Install event: caches all necessary assets
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Opened cache');
        return cache.addAll(urlsToCache);
      })
      .catch(error => {
        console.error('Failed to cache URLs during install:', error);
      })
  );
});

// Fetch event: serves cached content when offline, or fetches from network
self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        // Cache hit - return response
        if (response) {
          return response;
        }
        // No cache hit - fetch from network
        return fetch(event.request).catch(() => {
          // If network fails and no cache match, you could return an offline page here
          console.log('Network request failed and no cache match for:', event.request.url);
          // Example: return caches.match('/offline.html');
        });
      })
  );
});

// Activate event: cleans up old caches
self.addEventListener('activate', event => {
  const cacheWhitelist = [CACHE_NAME];
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheWhitelist.indexOf(cacheName) === -1) {
            console.log('Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});
