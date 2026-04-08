const CACHE_NAME = "yachal-house-portal-v3";
const APP_SHELL = "/login";

const STATIC_ASSETS = [
  APP_SHELL,
  "/manifest.json",
  "/yahal.png",
  "/icons/icon-72.png",
  "/icons/icon-96.png",
  "/icons/icon-128.png",
  "/icons/icon-144.png",
  "/icons/icon-152.png",
  "/icons/icon-192.png",
  "/icons/icon-384.png",
  "/icons/icon-512.png"
];

self.addEventListener("install", (event) => {
  self.skipWaiting();

  event.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      await cache.addAll(STATIC_ASSETS);
    })
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      );
      await self.clients.claim();
    })()
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;

  if (request.method !== "GET") return;
  if (!request.url.startsWith("http")) return;

  const url = new URL(request.url);

  // Never touch backend/API/auth requests on Render
  if (
    url.hostname.includes("onrender.com") ||
    url.pathname.startsWith("/api/")
  ) {
    return;
  }

  // Only handle same-origin requests for caching
  if (url.origin !== self.location.origin) {
    return;
  }

  // Navigation requests: network first, fallback to cache, then app shell
  if (request.mode === "navigate") {
    event.respondWith(
      (async () => {
        try {
          const fresh = await fetch(request);

          if (fresh && fresh.ok) {
            const cache = await caches.open(CACHE_NAME);
            cache.put(request, fresh.clone());
          }

          return fresh;
        } catch {
          const cachedPage = await caches.match(request);
          if (cachedPage) return cachedPage;

          const appShell = await caches.match(APP_SHELL);
          if (appShell) return appShell;

          return new Response("Offline", {
            status: 503,
            statusText: "Offline",
            headers: { "Content-Type": "text/plain" }
          });
        }
      })()
    );
    return;
  }

  // Static assets: cache first, then network
  event.respondWith(
    (async () => {
      const cached = await caches.match(request);
      if (cached) return cached;

      try {
        const fresh = await fetch(request);

        if (
          fresh &&
          fresh.ok &&
          fresh.type === "basic"
        ) {
          const cache = await caches.open(CACHE_NAME);
          cache.put(request, fresh.clone());
        }

        return fresh;
      } catch {
        return caches.match(request);
      }
    })()
  );
});