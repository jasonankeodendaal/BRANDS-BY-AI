// A more robust service worker for caching and offline support

const CACHE_NAME = 'ai-podcast-studio-v2'; // Bumped version to invalidate old cache
const urlsToCache = [
  '/',
  '/index.html',
  '/manifest.json',
];

// Install event: fires when the service worker is first installed.
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      console.log('Opened cache');
      return cache.addAll(urlsToCache);
    })
  );
  self.skipWaiting();
});

// Activate event: fires when the service worker becomes active.
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            console.log('Service Worker: clearing old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch event: Network-first strategy
self.addEventListener('fetch', event => {
  event.respondWith(
    // Try the network
    fetch(event.request)
      .then(res => {
        // If successful, cache the response and return it
        const responseClone = res.clone();
        caches.open(CACHE_NAME).then(cache => {
          cache.put(event.request, responseClone);
        });
        return res;
      })
      .catch(err => {
        // If the network fails, try to serve from the cache
        return caches.match(event.request).then(res => res);
      })
  );
});
