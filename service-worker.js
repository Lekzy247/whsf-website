const WHSF_CACHE_NAME = 'whsf-pwa-v26';
const WHSF_OFFLINE_URL = '/offline.html';

const WHSF_CORE_ASSETS = [
  '/',
  '/index.html',
  '/mobile-app.html',
  '/mobile-app-admin.html',
  '/programs.html',
  '/innovation.html',
  '/events.html',
  '/events/index.html',
  '/contact.html',
  '/e-classroom.html',
  '/impact-dashboard.html',
  '/verify-certificate.html',
  '/styles.css',
  '/script.js',
  '/manifest.webmanifest',
  WHSF_OFFLINE_URL,
  '/assets/whsf-logo.jpg'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(WHSF_CACHE_NAME).then((cache) => cache.addAll(WHSF_CORE_ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) =>
      Promise.all(
        cacheNames
          .filter((cacheName) => cacheName !== WHSF_CACHE_NAME)
          .map((cacheName) => caches.delete(cacheName))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  const requestUrl = new URL(event.request.url);
  if (requestUrl.origin !== self.location.origin) return;
  const shouldRefreshFirst =
    event.request.destination === 'script' ||
    event.request.destination === 'style' ||
    requestUrl.pathname.endsWith('.html') ||
    requestUrl.pathname === '/events' ||
    requestUrl.pathname === '/mobile-app' ||
    requestUrl.pathname === '/mobile-app-admin';

  if (event.request.mode === 'navigate' || shouldRefreshFirst) {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          if (!response || response.status !== 200) return response;
          const copy = response.clone();
          caches.open(WHSF_CACHE_NAME).then((cache) => cache.put(event.request, copy));
          return response;
        })
        .catch(async () => {
          const cachedPage = await caches.match(event.request);
          return cachedPage || caches.match(WHSF_OFFLINE_URL);
        })
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) return cachedResponse;
      return fetch(event.request)
        .then((response) => {
          if (!response || response.status !== 200) return response;
          const responseCopy = response.clone();
          caches.open(WHSF_CACHE_NAME).then((cache) => cache.put(event.request, responseCopy));
          return response;
        })
        .catch(() => {
          if (event.request.destination === 'document') {
            return caches.match(WHSF_OFFLINE_URL);
          }
          return Response.error();
        });
    })
  );
});
