const CACHE_NAME = "agrismart-v11-verified-accounts-whsf-home";
const APP_SHELL = [
  "/agrismart/",
  "/agrismart/app.html",
  "/agrismart/offline.html",
  "/agrismart/whsf-home.css",
  "/agrismart/manifest.webmanifest",
  "/agrismart/register-service-worker.js",
  "/agrismart/auth-provider.js",
  "/agrismart/cloud-sync-provider.js",
  "/agrismart/weather-provider.js",
  "/agrismart/market-provider.js",
  "/agrismart/market-alert-centre.js",
  "/agrismart/sync-queue.js",
  "/agrismart/sync-manager.js",
  "/agrismart/sync-integration.js",
  "/agrismart-app.css",
  "/agrismart-app.js",
  "/agrismart-auth-ui.js",
  "/agrismart-verification.js",
  "/agrismart-reports.js",
  "/agrismart-inventory.js",
  "/agrismart-farm-management.js",
  "/agrismart-crop-scanner.js",
  "/agrismart-ai-advisor.js",
  "/agrismart-weather.js",
  "/agrismart-analytics.js",
  "/agrismart-ui-fixes.css",
  "/agrismart-final-app.js",
  "/assets/whsf-logo.jpg"
];

async function notifyClients(message) {
  const clients = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
  clients.forEach(client => client.postMessage(message));
}

async function cacheAppShell() {
  const cache = await caches.open(CACHE_NAME);
  const results = await Promise.allSettled(
    APP_SHELL.map(async url => {
      const request = new Request(url, { cache: "reload" });
      const response = await fetch(request);
      if (!response.ok) throw new Error(`Unable to cache ${url}: ${response.status}`);
      await cache.put(request, response);
    })
  );

  const failed = results.filter(result => result.status === "rejected");
  if (failed.length) console.warn(`AgriSmart cached with ${failed.length} optional asset failure(s).`);
}

self.addEventListener("install", event => {
  event.waitUntil(cacheAppShell().then(() => self.skipWaiting()));
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(key => key.startsWith("agrismart-") && key !== CACHE_NAME)
          .map(key => caches.delete(key))
      ))
      .then(() => self.clients.claim())
      .then(() => notifyClients({ type: "AGRISMART_APP_READY", cache: CACHE_NAME }))
  );
});

self.addEventListener("message", event => {
  if (event.data?.type === "AGRISMART_SKIP_WAITING") event.waitUntil(self.skipWaiting());
  if (event.data?.type === "AGRISMART_SYNC_REQUEST") {
    event.waitUntil(notifyClients({ type: "AGRISMART_SYNC_REQUEST" }));
  }
});

self.addEventListener("sync", event => {
  if (event.tag === "agrismart-data-sync") {
    event.waitUntil(notifyClients({ type: "AGRISMART_SYNC_REQUEST" }));
  }
});

self.addEventListener("fetch", event => {
  if (event.request.method !== "GET") return;
  const requestUrl = new URL(event.request.url);

  if (event.request.mode === "navigate") {
    event.respondWith(
      fetch(event.request)
        .then(response => {
          if (response.ok && requestUrl.origin === self.location.origin) {
            const copy = response.clone();
            event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.put(event.request, copy)));
          }
          event.waitUntil(notifyClients({ type: "AGRISMART_CONNECTIVITY", online: true }));
          return response;
        })
        .catch(async () => {
          event.waitUntil(notifyClients({ type: "AGRISMART_CONNECTIVITY", online: false }));
          return (await caches.match(event.request)) ||
            (await caches.match("/agrismart/app.html")) ||
            caches.match("/agrismart/offline.html");
        })
    );
    return;
  }

  if (requestUrl.origin !== self.location.origin) return;

  const isCodeAsset = /\.(?:js|css)$/.test(requestUrl.pathname);
  if (isCodeAsset) {
    event.respondWith(
      fetch(event.request, { cache: "no-store" })
        .then(response => {
          if (response.ok) {
            const copy = response.clone();
            event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.put(event.request, copy)));
          }
          return response;
        })
        .catch(() => caches.match(event.request).then(cached => cached || Response.error()))
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then(cached => {
      const networkRequest = fetch(event.request)
        .then(response => {
          if (response.ok) {
            const copy = response.clone();
            event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.put(event.request, copy)));
          }
          return response;
        })
        .catch(() => cached || Response.error());
      return cached || networkRequest;
    })
  );
});
