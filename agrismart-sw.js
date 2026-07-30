const CACHE_NAME = 'agrismart-connect-v5-production-features';
const APP_SHELL = [
  '/mobile-app.html',
  '/agrismart/app.html',
  '/agrismart/market-alert-centre.js',
  '/agrismart-app.css',
  '/agrismart-ui-fixes.css',
  '/agrismart-app.js',
  '/agrismart-weather.js',
  '/agrismart-analytics.js',
  '/agrismart-farm-management.js',
  '/agrismart-crop-scanner.js',
  '/agrismart-manifest.webmanifest',
  '/assets/whsf-logo.jpg',
  '/agrismart/index.html',
  '/agrismart/training.html'
];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(APP_SHELL)));
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))))
  );
  self.clients.claim();
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  event.respondWith(
    caches.match(event.request).then(cached => {
      const network = fetch(event.request)
        .then(response => {
          if (response && response.status === 200 && response.type === 'basic') {
            const copy = response.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(event.request, copy));
          }
          return response;
        })
        .catch(() => cached || caches.match('/mobile-app.html'));
      return cached || network;
    })
  );
});
