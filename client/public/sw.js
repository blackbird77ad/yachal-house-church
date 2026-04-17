const CACHE_NAME = "yachal-house-portal-v3";
const APP_SHELL = "/login";
const IS_LOCALHOST =
  self.location.hostname === "localhost" ||
  self.location.hostname === "127.0.0.1";

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
  if (IS_LOCALHOST) {
    self.skipWaiting();
    return;
  }

  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS)).catch(() => {})
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      if (IS_LOCALHOST) {
        const keys = await caches.keys();
        await Promise.all(keys.map((k) => caches.delete(k)));
        await self.registration.unregister();
        return;
      }

      const keys = await caches.keys();
      await Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)));
      await self.clients.claim();
    })()
  );
});

self.addEventListener("fetch", (event) => {
  if (IS_LOCALHOST) return;

  const { request } = event;
  if (request.method !== "GET") return;
  if (!request.url.startsWith("http")) return;

  const url = new URL(request.url);

  // Never intercept API or Render backend
  if (url.hostname.includes("onrender.com") || url.pathname.startsWith("/api/")) return;

  // Only handle same-origin
  if (url.origin !== self.location.origin) return;

  // Navigation requests
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((res) => {
          if (res && res.ok) {
            // Clone BEFORE doing anything else with the response
            const toCache = res.clone();
            caches.open(CACHE_NAME).then((c) => c.put(request, toCache));
          }
          return res;
        })
        .catch(async () => {
          const cached = await caches.match(request);
          if (cached) return cached;
          const shell = await caches.match(APP_SHELL);
          if (shell) return shell;
          return new Response("Offline", {
            status: 503,
            headers: { "Content-Type": "text/plain" },
          });
        })
    );
    return;
  }

  // Static assets — cache first, network fallback
  event.respondWith(
    (async () => {
      const cached = await caches.match(request);
      if (cached) return cached;

      try {
        const res = await fetch(request);
        if (res && res.ok && res.type === "basic") {
          // Clone BEFORE returning
          const toCache = res.clone();
          caches.open(CACHE_NAME).then((c) => c.put(request, toCache));
        }
        return res;
      } catch {
        return new Response("", { status: 503 });
      }
    })()
  );
});

// Push notifications
self.addEventListener("push", (event) => {
  if (IS_LOCALHOST) return;
  if (!event.data) return;
  let data = {};
  try { data = event.data.json(); } catch { data = { title: "Yachal House", body: event.data.text() }; }
  event.waitUntil(
    self.registration.showNotification(data.title || "Yachal House", {
      body: data.body || "",
      icon: data.icon || "/icons/icon-192.png",
      badge: "/icons/icon-96.png",
      vibrate: [100, 50, 100],
      data: { url: data.url || "/portal/dashboard" },
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  if (IS_LOCALHOST) return;
  event.notification.close();
  const url = event.notification.data?.url || "/portal/dashboard";
  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
      for (const client of list) {
        if (client.url.includes(self.location.origin) && "focus" in client) {
          client.focus();
          client.navigate(url);
          return;
        }
      }
      if (clients.openWindow) return clients.openWindow(url);
    })
  );
});
