const CACHE_NAME = 'photos-pwa-v2';
const assets = [
  '/', 
  '/index.html', 
  '/style.css', 
  '/app.js', 
  '/config.json', 
  'https://unpkg.com/lucide@latest'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(assets))
  );
});

// Stale-While-Revalidate: Serve from cache but update in background
self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request).then(cachedResponse => {
      const networkFetch = fetch(event.request).then(networkResponse => {
        // Update cache with new version if it's a successful static or API call
        if (networkResponse.ok) {
          const responseClone = networkResponse.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, responseClone));
        }
        return networkResponse;
      });
      return cachedResponse || networkFetch;
    })
  );
});