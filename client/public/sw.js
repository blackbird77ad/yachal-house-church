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
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS))
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
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

  if (url.hostname.includes("onrender.com") || url.pathname.startsWith("/api/")) return;
  if (url.origin !== self.location.origin) return;

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
          const cached = await caches.match(request);
          if (cached) return cached;
          const shell = await caches.match(APP_SHELL);
          if (shell) return shell;
          return new Response("Offline", { status: 503, headers: { "Content-Type": "text/plain" } });
        }
      })()
    );
    return;
  }

  event.respondWith(
    (async () => {
      const cached = await caches.match(request);
      if (cached) return cached;
      try {
        const fresh = await fetch(request);
        if (fresh && fresh.ok && fresh.type === "basic") {
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

// ── Push notification handler ──────────────────────────────────
self.addEventListener("push", (event) => {
  if (!event.data) return;

  let data = {};
  try { data = event.data.json(); } catch { data = { title: "Yachal House", body: event.data.text() }; }

  const options = {
    body: data.body || "",
    icon: data.icon || "/icons/icon-192.png",
    badge: "/icons/icon-96.png",
    vibrate: [100, 50, 100],
    data: { url: data.url || "/portal/dashboard" },
    actions: [
      { action: "open", title: "Open" },
      { action: "dismiss", title: "Dismiss" },
    ],
    requireInteraction: false,
    silent: false,
  };

  event.waitUntil(
    self.registration.showNotification(data.title || "Yachal House", options)
  );
});

// ── Notification click handler ─────────────────────────────────
self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  if (event.action === "dismiss") return;

  const url = event.notification.data?.url || "/portal/dashboard";

  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      // If app is already open, focus it and navigate
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && "focus" in client) {
          client.focus();
          client.navigate(url);
          return;
        }
      }
      // Otherwise open a new window
      if (clients.openWindow) return clients.openWindow(url);
    })
  );
});

// ── Badge update on push ───────────────────────────────────────
self.addEventListener("push", () => {
  if ("setAppBadge" in navigator) {
    clients.matchAll().then((clientList) => {
      if (clientList.length === 0) {
        navigator.setAppBadge().catch(() => {});
      }
    });
  }
});