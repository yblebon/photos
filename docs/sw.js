// sw.js
const CACHE_NAME = 'photo-pwa-v2';

// Relative to the service worker scope so the app also works from a subpath.
const STATIC_ASSETS = [
  './',
  'index.html',
  'app.js',
  'api-photos.js',
  'auth.js',
  'config.js',
  'decryptor.js',
  'storage.js',
  'styles.css',
  'config.json',
  'manifest.json',
  'offline.html',
  'vendor/lucide.min.js'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(STATIC_ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', event => {
  const req = event.request;
  const url = new URL(req.url);

  // Only handle same-origin GETs. API calls (cross-origin, authenticated,
  // and carrying encrypted photo data) always go straight to the network
  // and are never cached.
  if (req.method !== 'GET' || url.origin !== self.location.origin) return;

  event.respondWith(
    caches.match(req).then(cached => {
      if (cached) return cached;
      return fetch(req).catch(() =>
        req.mode === 'navigate'
          ? caches.match('offline.html')
          : new Response('', { status: 503 })
      );
    })
  );
});
