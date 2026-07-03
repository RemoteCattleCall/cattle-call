// Cattle Call - Service Worker (PWA caller)
// Estrategia:
//  - caller.html: NETWORK-FIRST (asi los deploys se ven al instante; cache solo offline)
//  - Resto del shell (iconos, manifest, Firebase SDK): cache-first
//  - Firebase Realtime DB / Auth / TURN: nunca tocados por el SW

const CACHE_VERSION = 'cc-shell-v2';
const SHELL = [
  './',
  './caller.html',
  './manifest.webmanifest',
  './icon-192.png',
  './icon-512.png',
  './icon-180.png',
  './icon-32.png',
  './icon-512-maskable.png',
  'https://www.gstatic.com/firebasejs/12.12.1/firebase-app.js',
  'https://www.gstatic.com/firebasejs/12.12.1/firebase-database.js'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION).then((cache) => cache.addAll(SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_VERSION).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);

  // Firebase Realtime Database y Auth -> siempre red, nunca cache.
  if (url.hostname.endsWith('firebaseio.com') ||
      url.hostname.endsWith('firebasedatabase.app') ||
      url.hostname.endsWith('googleapis.com') ||
      url.hostname.endsWith('firebaseapp.com')) {
    return;
  }

  // caller.html (y navegaciones HTML): network-first
  // Esto permite que cualquier deploy se vea inmediatamente sin tener
  // que bumpear cache version cada vez. Cae al cache solo si no hay red.
  const isHtml = req.mode === 'navigate' ||
                 url.pathname.endsWith('/caller.html') ||
                 url.pathname.endsWith('/');
  if (isHtml && url.origin === self.location.origin) {
    event.respondWith(
      fetch(req).then((resp) => {
        if (resp && resp.status === 200) {
          const copy = resp.clone();
          caches.open(CACHE_VERSION).then((cache) => cache.put(req, copy));
        }
        return resp;
      }).catch(() => caches.match(req).then((c) => c || caches.match('./caller.html')))
    );
    return;
  }

  // Resto: cache-first con guardado oportunista.
  event.respondWith(
    caches.match(req).then((cached) => {
      if (cached) return cached;
      return fetch(req).then((resp) => {
        if (resp && resp.status === 200 &&
            (url.origin === self.location.origin ||
             url.hostname === 'www.gstatic.com')) {
          const copy = resp.clone();
          caches.open(CACHE_VERSION).then((cache) => cache.put(req, copy));
        }
        return resp;
      }).catch(() => cached);
    })
  );
});
