// A more robust service worker for caching and offline support

const CACHE_NAME = 'ai-podcast-studio-v3'; // Bumped version to invalidate all old caches
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
// We use a "Network First, then Cache" strategy.
self.addEventListener('fetch', event => {
  // We only want to cache GET requests.
  if (event.request.method !== 'GET') {
    return;
  }

  event.respondWith(
    // 1. Try to fetch from the network
    fetch(event.request)
      .then(networkResponse => {
        // If the fetch is successful, we clone the response and cache it.
        const responseToCache = networkResponse.clone();
        caches.open(CACHE_NAME)
          .then(cache => {
            // We put the request and its response in the cache.
            cache.put(event.request, responseToCache);
          });
        // And return the original network response to the browser.
        return networkResponse;
      })
      .catch(() => {
        // 2. If the network fails (e.g., offline), try to find a match in the cache.
        return caches.match(event.request)
          .then(cachedResponse => {
            // If we find a response in the cache, return it.
            // Otherwise, the fetch will fail as it normally would.
            return cachedResponse || Response.error();
          });
      })
  );
});
