// Basic Service Worker to satisfy PWA installation requirements
self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open('orion-store').then((cache) => cache.addAll([
      '/',
      '/index.html',
      '/icon.svg',
    ])),
  );
});

self.addEventListener('fetch', (e) => {
  e.respondWith(
    caches.match(e.request).then((response) => response || fetch(e.request)),
  );
});