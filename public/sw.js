// A more robust service worker for caching and offline support

const CACHE_NAME = 'ai-podcast-studio-v5'; // Bumped version to invalidate all old caches
const urlsToCache = [
  '/',
  '/index.html',
  '/manifest.json',
];

// Install event: fires when the service worker is first installed.
// We cache our essential shell assets here.
self.addEventListener('install', event => {
  console.log('Service Worker: Install event in progress.');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Service Worker: Caching core assets.');
        return cache.addAll(urlsToCache);
      })
      .then(() => {
        console.log('Service Worker: Install completed, activating immediately.');
        // Force the waiting service worker to become the active service worker.
        return self.skipWaiting();
      })
  );
});

// Activate event: fires when the service worker becomes active.
// This is the perfect time to clean up old caches.
self.addEventListener('activate', event => {
  console.log('Service Worker: Activate event in progress.');
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames
          .filter(cacheName => cacheName !== CACHE_NAME)
          .map(cacheName => {
            console.log('Service Worker: Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          })
      );
    }).then(() => {
      console.log('Service Worker: Claiming clients.');
      // Take control of all open clients (tabs) immediately.
      return self.clients.claim();
    })
  );
});

// Fetch event: Handles all network requests from the app.
// We use a "Stale-While-Revalidate" strategy.
self.addEventListener('fetch', event => {
  // We only want to handle GET requests.
  if (event.request.method !== 'GET') {
    return;
  }

  event.respondWith(
    caches.open(CACHE_NAME).then(cache => {
      // 1. Return from cache immediately if possible.
      return cache.match(event.request).then(cachedResponse => {
        // 2. Simultaneously, fetch from the network to update the cache for next time.
        const fetchPromise = fetch(event.request).then(networkResponse => {
          // If the fetch is successful, update the cache.
          cache.put(event.request, networkResponse.clone());
          return networkResponse;
        }).catch(err => {
          // The network fetch failed, which is okay if we have a cached response.
          // Log the error for debugging.
          console.warn('Service Worker: Network fetch failed.', err);
        });

        // Return the cached response if it exists, otherwise wait for the network.
        return cachedResponse || fetchPromise;
      });
    })
  );
});
