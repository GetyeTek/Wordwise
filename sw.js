const CACHE_NAME = 'dse-pwa-cache-v4';

// Only cache files *specifically for the PWA*
const urlsToCache = [
      '/',
  '/index.html',
  '/manifest.json',
 
  'app.js',
  '/icon-192x192.png',
  '/icon-512x512.png'
];

// 1. Install
self.addEventListener('install', event => {
    console.log('Installing PWA service worker...');
    event.waitUntil(
        caches.open(CACHE_NAME)
        .then(cache => {
            console.log(`Caching files:`, urlsToCache);
            return cache.addAll(urlsToCache);
        })
        .then(() => self.skipWaiting())
    );
});

// 2. Activate
self.addEventListener('activate', event => {
    console.log('Activating service worker and clearing old caches...');
    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames.map(cacheName => {
                    if (cacheName !== CACHE_NAME) {
                        console.log(`Deleting old cache: ${cacheName}`);
                        return caches.delete(cacheName);
                    }
                })
            );
        })
    );
});

// 3. Fetch — Only intercept PWA-related requests
self.addEventListener('fetch', event => {
    const url = new URL(event.request.url);
    
    // Only cache stuff inside /app/ or icons used by the PWA
    if (
        url.pathname.startsWith('/app/') ||
        url.pathname === '/icon-192x192.png' ||
        url.pathname === '/icon-512x512.png'
    ) {
        event.respondWith(
            caches.match(event.request).then(response => {
                return response || fetch(event.request);
            })
        );
    }
});