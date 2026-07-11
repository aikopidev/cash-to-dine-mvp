// Cash to Dine v0.7 cache killer.
// This service worker intentionally does not cache anything.
// Existing old service workers will be replaced, then this one unregisters itself.
self.addEventListener("install", event => {
  self.skipWaiting();
});

self.addEventListener("activate", event => {
  event.waitUntil((async () => {
    try {
      const keys = await caches.keys();
      await Promise.all(keys.map(k => caches.delete(k)));
      await self.registration.unregister();
      const clients = await self.clients.matchAll({ type: "window" });
      for (const client of clients) client.navigate(client.url);
    } catch (e) {}
  })());
});

self.addEventListener("fetch", event => {
  event.respondWith(fetch(event.request, { cache: "no-store" }));
});
