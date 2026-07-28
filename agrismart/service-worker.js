const CACHE_NAME = "agrismart-v3";
const APP_SHELL = [
  "/agrismart/",
  "/agrismart/app.html",
  "/agrismart/offline.html",
  "/agrismart/manifest.webmanifest",
  "/agrismart/service-worker.js",
  "/agrismart/register-service-worker.js",
  "/agrismart/auth-provider.js",
  "/agrismart/cloud-sync-provider.js",
  "/agrismart/weather-provider.js",
  "/agrismart/market-provider.js",
  "/agrismart/sync-queue.js",
  "/agrismart/sync-manager.js",
  "/agrismart/sync-integration.js",
  "/agrismart-app.css",
  "/agrismart-app.js",
  "/agrismart-reports.js",
  "/agrismart-inventory.js",
  "/agrismart-ai-advisor.js",
  "/agrismart-final-app.js",
  "/assets/whsf-logo.jpg"
];

async function notifyClients(message) {
  const clients = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
  clients.forEach((client) => client.postMessage(message));
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      ))
      .then(() => self.clients.claim())
      .then(() => notifyClients({ type: "AGRISMART_APP_READY", cache: CACHE_NAME }))
  );
});

self.addEventListener("message", (event) => {
  if (event.data?.type === "AGRISMART_SKIP_WAITING") self.skipWaiting();
  if (event.data?.type === "AGRISMART_SYNC_REQUEST") {
    notifyClients({ type: "AGRISMART_SYNC_REQUEST" });
  }
});

self.addEventListener("sync", (event) => {
  if (event.tag === "agrismart-data-sync") {
    event.waitUntil(notifyClients({ type: "AGRISMART_SYNC_REQUEST" }));
  }
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;

  if (event.request.mode === "navigate") {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
          notifyClients({ type: "AGRISMART_CONNECTIVITY", online: true });
          return response;
        })
        .catch(async () => {
          notifyClients({ type: "AGRISMART_CONNECTIVITY", online: false });
          const cached = await caches.match(event.request);
          return cached || caches.match("/agrismart/offline.html");
        })
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cached) => {
      const networkRequest = fetch(event.request)
        .then((response) => {
          if (response && response.status === 200 && response.type !== "opaque") {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
          }
          return response;
        })
        .catch(() => cached);

      return cached || networkRequest;
    })
  );
});