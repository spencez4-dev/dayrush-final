const CACHE="day-rush-fun-v8";
const ASSETS=[
  "./","./index.html","./styles.css","./manifest.webmanifest",
  "./icons/icon.svg","./src/app.js","./src/store.js","./src/canvas.js",
  "./src/seed.js","./src/utils.js"
];

self.addEventListener("install",event=>{
  event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(ASSETS)));
  self.skipWaiting();
});

self.addEventListener("activate",event=>{
  event.waitUntil(
    caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k))))
  );
  self.clients.claim();
});

self.addEventListener("fetch",event=>{
  if(event.request.method!=="GET") return;

  // Network-first so GitHub Pages updates show immediately.
  event.respondWith(
    fetch(event.request)
      .then(response=>{
        const clone=response.clone();
        caches.open(CACHE).then(cache=>cache.put(event.request,clone)).catch(()=>{});
        return response;
      })
      .catch(()=>caches.match(event.request).then(hit=>hit||caches.match("./index.html")))
  );
});
