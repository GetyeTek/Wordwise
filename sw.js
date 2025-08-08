// sw.js

// Use a more descriptive cache name and update the version when you make changes.
const APP_SHELL_CACHE = 'wordwise-app-shell-v1';
const DYNAMIC_CACHE = 'wordwise-dynamic-v1';

// All the essential files your app needs to load its basic UI.
// This INCLUDES your local files and critical third-party libraries.
const urlsToCache = [
  '/',
  '/index.html',
  '/manifest.json',
  '/app.js',
  '/icon-192x192.png',
  '/icon-512x512.png',
  // Critical Third-Party Scripts
  'https://cdn.jsdelivr.net/npm/marked/marked.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/PapaParse/5.3.2/papaparse.min.js',
  'https://unpkg.com/@phosphor-icons/web',
  'https://esm.run/@google/generative-ai',
  // Critical Google Fonts Stylesheet
  'https://fonts.googleapis.com/css2?display=swap&family=Lexend:wght@400;500;600;700&family=Noto+Sans:wght@400;500;700'
];

// 1. Install: Cache the App Shell
self.addEventListener('install', event => {
  console.log('Installing PWA service worker...');
  event.waitUntil(
    caches.open(APP_SHELL_CACHE)
      .then(cache => {
        console.log('Caching App Shell:', urlsToCache);
        // Use addAll with an array of requests to handle potential opaque responses from CDNs
        const requests = urlsToCache.map(url => new Request(url, { mode: 'no-cors' }));
        return cache.addAll(requests);
      })
      .catch(error => {
        console.error('Failed to cache App Shell during install:', error);
      })
      .then(() => self.skipWaiting())
  );
});

// 2. Activate: Clean up old caches
self.addEventListener('activate', event => {
  console.log('Activating service worker and clearing old caches...');
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== APP_SHELL_CACHE && cacheName !== DYNAMIC_CACHE) {
            console.log(`Deleting old cache: ${cacheName}`);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  return self.clients.claim();
});

// 3. Fetch: Intercept all requests and serve from cache
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // Strategy 1: Cache First for App Shell resources
  // This is fast and reliable for files that don't change often.
  if (urlsToCache.includes(event.request.url) || urlsToCache.includes(url.pathname)) {
    event.respondWith(
      caches.match(event.request).then(response => {
        return response || fetch(event.request);
      })
    );
    return; // Exit after handling
  }

  // Strategy 2: Stale-While-Revalidate for other requests (like font files)
  // This is great for dynamic content. It serves from cache immediately,
  // then updates the cache in the background for the next visit.
  event.respondWith(
    caches.open(DYNAMIC_CACHE).then(cache => {
      return cache.match(event.request).then(response => {
        const fetchPromise = fetch(event.request).then(networkResponse => {
          // Check if we received a valid response before caching
          if (networkResponse && networkResponse.status === 200) {
            cache.put(event.request, networkResponse.clone());
          }
          return networkResponse;
        }).catch(err => {
            // Handle network failure. If there's no cached response, this will fail.
            console.warn(`Fetch failed for: ${event.request.url}`, err);
        });
        // Return the cached response immediately if available, otherwise wait for the network
        return response || fetchPromise;
      });
    })
  );
});
