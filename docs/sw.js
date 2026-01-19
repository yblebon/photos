const CACHE_NAME = 'pwa-cache-v1';
// Removed photos.json, added config.json and app.js
const assets = [
  '/', 
  '/index.html', 
  '/style.css', 
  '/app.js', 
  '/config.json', 
  'https://unpkg.com/lucide@latest'
];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(assets)));
});

self.addEventListener('fetch', event => {
  event.respondWith(caches.match(event.request).then(res => res || fetch(event.request)));
});