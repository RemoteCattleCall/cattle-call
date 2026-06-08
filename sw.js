// Cattle Call - Service Worker (PWA caller)
// Estrategia: cache del shell (caller.html + iconos + Firebase SDK).
// Todo lo demas (Realtime DB, signaling, TURN, WebRTC) va siempre por red.

const CACHE_VERSION = 'cc-shell-v1';
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

  // Solo manejamos GET. Todo lo demas (POST a Firebase, etc) pasa directo.
  if (req.method !== 'GET') return;

  const url = new URL(req.url);

  // Firebase Realtime Database y Auth -> siempre red, nunca cache.
  if (url.hostname.endsWith('firebaseio.com') ||
      url.hostname.endsWith('firebasedatabase.app') ||
      url.hostname.endsWith('googleapis.com') ||
      url.hostname.endsWith('firebaseapp.com')) {
    return;
  }

  // Resto: cache-first con fallback a red, y guardado oportunista.
  event.respondWith(
    caches.match(req).then((cached) => {
      if (cached) return cached;
      return fetch(req).then((resp) => {
        // Solo guardamos respuestas OK y del mismo origen o gstatic
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
