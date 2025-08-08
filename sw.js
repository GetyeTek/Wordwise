// sw.js

const APP_CACHE_NAME = 'wordwise-static-v3'; // Increment version to force update
// We will combine dynamic and static into one for simplicity and robustness.

const appShellFiles = [
  '/', // This is crucial for the root URL
  '/index.html',
  '/manifest.json',
  '/app.js',
  '/icon-192x192.png',
  '/icon-512x512.png'
];

// 1. Install: Cache the minimal App Shell. This is our safety net.
self.addEventListener('install', event => {
  console.log('[Service Worker] Install');
  event.waitUntil(
    caches.open(APP_CACHE_NAME)
      .then(cache => {
        console.log('[Service Worker] Caching essential app shell files');
        return cache.addAll(appShellFiles);
      })
      .catch(error => {
          console.error('[Service Worker] App Shell caching failed:', error);
      })
      .then(() => {
        // Force the waiting service worker to become the active service worker.
        return self.skipWaiting();
      })
  );
});

// 2. Activate: Clean up old caches.
self.addEventListener('activate', event => {
  console.log('[Service Worker] Activate');
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== APP_CACHE_NAME) {
            console.log(`[Service Worker] Deleting old cache: ${cacheName}`);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => {
        // Tell the active service worker to take control of the page immediately.
        return self.clients.claim();
    })
  );
});

// 3. Fetch: The CORE LOGIC - "Cache First, then Network"
self.addEventListener('fetch', event => {
  // Ignore non-GET requests
  if (event.request.method !== 'GET') {
    return;
  }

  event.respondWith(
    caches.match(event.request)
      .then(cachedResponse => {
        // --- CACHE HIT ---
        // If the resource is in the cache, return it immediately.
        if (cachedResponse) {
          // console.log('[Service Worker] Found in cache:', event.request.url);
          return cachedResponse;
        }

        // --- CACHE MISS ---
        // If the resource is not in the cache, fetch it from the network.
        // console.log('[Service Worker] Not in cache, fetching:', event.request.url);
        return fetch(event.request).then(networkResponse => {
            // Check if we received a valid response
            if (!networkResponse || networkResponse.status !== 200 || networkResponse.type !== 'basic' && networkResponse.type !== 'cors') {
                return networkResponse;
            }

            // IMPORTANT: Clone the response. A response is a stream
            // and because we want the browser to consume the response
            // as well as the cache consuming the response, we need
            // to clone it so we have two streams.
            const responseToCache = networkResponse.clone();

            caches.open(APP_CACHE_NAME)
              .then(cache => {
                // console.log('[Service Worker] Caching new resource:', event.request.url);
                cache.put(event.request, responseToCache);
              });

            return networkResponse;
          }
        );
      }).catch(error => {
          // This catch() will handle exceptions thrown from the fetch() call,
          // which happens when the network is unavailable.
          // You could return a custom offline page here if you wanted.
          console.error('[Service Worker] Fetch failed:', error);
          // For now, we'll just let the browser handle the error.
      })
  );
});
