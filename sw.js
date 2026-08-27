const CACHE = "day-rush-canvas-v1";
const ASSETS = [
  "./","./index.html","./styles.css","./manifest.webmanifest",
  "./icons/icon.svg","./src/app.js","./src/store.js","./src/canvas.js",
  "./src/seed.js","./src/utils.js"
];
self.addEventListener("install", event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(ASSETS)));
  self.skipWaiting();
});
self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
  );
  self.clients.claim();
});
self.addEventListener("fetch", event => {
  if (event.request.method !== "GET") return;
  event.respondWith(
    caches.match(event.request).then(hit => hit || fetch(event.request).then(resp => {
      const clone = resp.clone();
      caches.open(CACHE).then(cache => cache.put(event.request, clone)).catch(()=>{});
      return resp;
    }).catch(() => caches.match("./index.html")))
  );
});
