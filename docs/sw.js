const CACHE_NAME = 'pwa-cache-v1';
const assets = ['/', '/index.html', '/style.css', '/photos.json', 'https://unpkg.com/lucide@latest'];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(assets)));
});

self.addEventListener('fetch', event => {
  event.respondWith(caches.match(event.request).then(res => res || fetch(event.request)));
});