self.addEventListener('install', (event) => {
  event.waitUntil(caches.open('mipp-static-v1').then((cache) => cache.addAll(['/offline'])));
  self.skipWaiting();
});
self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});
self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  event.respondWith(
    fetch(request).catch(() => caches.open('mipp-static-v1').then((cache) => cache.match('/offline')))
  );
});
