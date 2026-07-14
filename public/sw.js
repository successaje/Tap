// Bump to invalidate every previously cached asset on the next visit —
// activate() below purges old caches and claims all clients immediately.
const CACHE = "tap-v3";

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  // Navigations: network first so the app is always fresh, cache as offline fallback.
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(request, copy));
          return res;
        })
        .catch(() =>
          caches.match(request).then((hit) => hit || caches.match("/"))
        )
    );
    return;
  }

  // Same-origin static assets: cache first.
  if (new URL(request.url).origin === location.origin) {
    event.respondWith(
      caches.match(request).then(
        (hit) =>
          hit ||
          fetch(request).then((res) => {
            if (res.ok) {
              const copy = res.clone();
              caches.open(CACHE).then((c) => c.put(request, copy));
            }
            return res;
          })
      )
    );
  }
});

self.addEventListener("push", (event) => {
  if (!event.data) return;
  
  try {
    const payload = event.data.json();
    const title = payload.title || "tap";
    const options = {
      body: payload.body || "New notification from tap",
      icon: "/icons/icon-192.png",
      badge: "/icons/icon-192.png", // Small monochrome icon for Android status bar
      vibrate: [100, 50, 100],
      data: {
        url: payload.url || "/",
      },
    };

    event.waitUntil(self.registration.showNotification(title, options));
  } catch {
    // Fallback if payload isn't JSON
    event.waitUntil(
      self.registration.showNotification("tap", {
        body: event.data.text(),
        icon: "/icons/icon-192.png",
      })
    );
  }
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  
  const urlToOpen = event.notification.data?.url || "/";
  
  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((windowClients) => {
      // If a window is already open, focus it and navigate
      for (let i = 0; i < windowClients.length; i++) {
        const client = windowClients[i];
        if (client.url.indexOf(self.location.origin) !== -1 && "focus" in client) {
          client.navigate(urlToOpen);
          return client.focus();
        }
      }
      // Otherwise, open a new window
      if (clients.openWindow) {
        return clients.openWindow(urlToOpen);
      }
    })
  );
});
