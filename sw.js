/* Solaris Math · funcionamiento sin conexión
   Si cambias iconos o este archivo, sube el número de VERSION.
   Para actualizar solo la app basta con subir el nuevo index.html: se descarga solo. */
const VERSION = 'solaris-math-v2';
const BASICOS = ['./', './index.html', './manifest.json', './icon-192.png', './icon-512.png', './icon-maskable-512.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(BASICOS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(claves => Promise.all(claves.filter(k => k !== VERSION).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if(req.method !== 'GET') return;
  const url = new URL(req.url);
  const guardar = r => { if(r && (r.ok || r.type === 'opaque')){ const copia = r.clone(); caches.open(VERSION).then(c => c.put(req, copia)); } return r; };

  // La app: primero internet (para recibir mejoras); sin conexión, la copia guardada.
  if(req.mode === 'navigate' || (url.origin === location.origin && /\.html?$/.test(url.pathname))){
    e.respondWith(fetch(req).then(guardar).catch(() => caches.match(req).then(r => r || caches.match('./index.html'))));
    return;
  }
  // Íconos, letras y librerías: primero la copia guardada.
  const cacheable = url.origin === location.origin || /(^|\.)fonts\.(googleapis|gstatic)\.com$|(^|\.)cdnjs\.cloudflare\.com$/.test(url.hostname);
  if(!cacheable) return;
  e.respondWith(caches.match(req).then(hit => hit || fetch(req).then(guardar)));
});
