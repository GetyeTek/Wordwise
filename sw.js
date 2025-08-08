// sw.js

const APP_SHELL_CACHE = 'wordwise-app-shell-v4';   // <-- Incremented version
const DYNAMIC_CACHE = 'wordwise-dynamic-v4'; // <-- Incremented version

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
    .then(() => self.clients.claim())
  );
});

// 3. Fetch: Apply different strategies
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // Strategy 1: Cache First for the App Shell files.
  // This is for your own files that you know are in the cache.
  if (appShellFiles.includes(url.pathname) || url.pathname === '/') {
    event.respondWith(caches.match(event.request));
    return;
  }

  // Strategy 2: Stale-While-Revalidate for everything else (APIs, icons, fonts).
  // This serves from cache immediately for speed, then updates the cache from the network.
  event.respondWith(
    caches.open(DYNAMIC_CACHE).then(cache => {
      return cache.match(event.request).then(response => {
        // Fetch from network in the background
        const fetchPromise = fetch(event.request).then(networkResponse => {
          // If we get a valid response, update the cache
          if (networkResponse && networkResponse.status === 200) {
            cache.put(event.request, networkResponse.clone());
          }
          return networkResponse;
        }).catch(err => {
            // This will happen if the network is unavailable.
            // We've already served the cached response (if it exists), so this is okay.
            console.warn(`[Service Worker] Network fetch failed for ${event.request.url}:`, err);
        });

        // Return the cached version immediately if available, otherwise wait for the network.
        // This makes the app load instantly on repeat visits.
        return response || fetchPromise;
      });
    })
  );
});
