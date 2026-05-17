const CACHE = "tablasmult-v6";
const PRECACHE = [
  "/",
  "/index.html",
  "/css/styles.css",
  "/css/arcade-shell.css",
  "/css/arcade-game.css",
  "/css/arcade-difficulty.css",
  "/css/arcade-menu.css",
  "/js/app.js",
  "/js/api.js",
  "/js/game.js",
  "/js/adventure.js",
  "/js/worlds.config.js",
  "/js/cards.assets.js",
  "/js/collection.js",
  "/js/shop.js",
  "/data/cards.catalog.json",
  "/manifest.webmanifest",
  "/icon.svg",
  "/assets/cards/missing.svg",
  "/assets/cards/frames/frame_common.svg",
  "/assets/cards/frames/frame_rare.svg",
  "/assets/cards/frames/frame_epic.svg",
  "/assets/cards/frames/frame_legendary.svg",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(PRECACHE)).then(() => self.skipWaiting())
  );
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
  const url = new URL(request.url);

  if (url.pathname.startsWith("/api/")) {
    return;
  }

  if (request.method !== "GET") return;

  event.respondWith(
    caches.match(request).then((cached) => {
      const network = fetch(request)
        .then((response) => {
          if (response.ok && url.origin === self.location.origin) {
            const copy = response.clone();
            caches.open(CACHE).then((cache) => cache.put(request, copy));
          }
          return response;
        })
        .catch(() => cached);
      return cached || network;
    })
  );
});
