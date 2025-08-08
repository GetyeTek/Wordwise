// sw.js

const APP_SHELL_CACHE = 'wordwise-app-shell-v2'; // <-- Increment version to force update
const DYNAMIC_CACHE = 'wordwise-dynamic-v2';   // <-- Increment version

// Cache ONLY your LOCAL, ESSENTIAL files in the install step.
// These are guaranteed to be available and won't fail.
const appShellFiles = [
  '/',
  '/index.html',
  '/manifest.json',
  '/app.js',
  '/icon-192x192.png',
  '/icon-512x512.png'
];

// 1. Install: Cache the minimal App Shell
self.addEventListener('install', event => {
  console.log('[Service Worker] Install');
  event.waitUntil(
    caches.open(APP_SHELL_CACHE)
      .then(cache => {
        console.log('[Service Worker] Caching app shell');
        return cache.addAll(appShellFiles);
      })
      .then(() => self.skipWaiting())
  );
});

// 2. Activate: Clean up old caches
self.addEventListener('activate', event => {
  console.log('[Service Worker] Activate');
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== APP_SHELL_CACHE && cacheName !== DYNAMIC_CACHE) {
            console.log(`[Service Worker] Deleting old cache: ${cacheName}`);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  return self.clients.claim();
});

// 3. Fetch: Intercept requests and apply caching strategies
self.addEventListener('fetch', event => {
    // For navigation requests (like loading the page), use a Network Falling Back to Cache strategy.
    // This ensures the user gets the latest HTML if online, but it still works offline.
    if (event.request.mode === 'navigate') {
        event.respondWith(
            fetch(event.request)
                .catch(() => caches.match('/index.html'))
        );
        return;
    }

    // For all other requests (CSS, JS, Fonts, etc.)
    event.respondWith(
        caches.match(event.request)
            .then(cacheResponse => {
                // If the response is in the cache, return it immediately.
                if (cacheResponse) {
                    return cacheResponse;
                }

                // If not in cache, fetch from the network.
                return fetch(event.request).then(networkResponse => {
                    // Open the dynamic cache to store the new response.
                    return caches.open(DYNAMIC_CACHE).then(cache => {
                        // We must clone the response because it's a "stream"
                        // that can only be consumed once. We need one for the
                        // cache and one for the browser.
                        // We also check for valid responses to avoid caching errors.
                        if (networkResponse && networkResponse.status === 200) {
                           cache.put(event.request, networkResponse.clone());
                        }
                        // Return the network response to the browser.
                        return networkResponse;
                    });
                });
            }).catch(error => {
                // This will catch errors if the fetch fails (e.g., user is offline
                // and the item is not in the cache). You could return a fallback
                // image or data here if you wanted.
                console.error('[Service Worker] Fetch failed; returning offline fallback if available.', error);
            })
    );
});
