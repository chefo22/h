// Service worker de Audiobook Pro: permite abrir y usar la app sin conexión.
// Colócalo en la MISMA carpeta que index.html (y sírvelo por HTTPS).
const CACHE = 'audiobook-v3';
const PAGE = ['./', './index.html'];
// Librerías y fuentes externas que la app necesita para arrancar
const EXTERNAL = [
  'https://cdn.jsdelivr.net/npm/megajs@1/dist/main.browser-umd.js',
  'https://cdnjs.cloudflare.com/ajax/libs/jsmediatags/3.9.5/jsmediatags.min.js',
  'https://cdn.jsdelivr.net/npm/mp4box@0.5.2/dist/mp4box.all.min.js',
  'https://fonts.googleapis.com/icon?family=Material+Icons'
];
// Solo se interceptan estos dominios; MEGA y el resto pasan directos a la red
const HOSTS = ['cdn.jsdelivr.net', 'cdnjs.cloudflare.com', 'fonts.googleapis.com', 'fonts.gstatic.com'];

self.addEventListener('install', e => {
  self.skipWaiting();
  e.waitUntil((async () => {
    const c = await caches.open(CACHE);
    await Promise.all(PAGE.map(u => c.add(u).catch(() => {})));
    await Promise.all(EXTERNAL.map(u => fetch(new Request(u, { mode: 'no-cors' })).then(r => c.put(u, r)).catch(() => {})));
  })());
});

self.addEventListener('activate', e => e.waitUntil(
  caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())
));

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // La página: con conexión se pide a la red (siempre la última versión); sin ella, la guardada
  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req).then(r => {
        if (r && r.ok) { const cp = r.clone(); caches.open(CACHE).then(c => c.put('./index.html', cp)).catch(() => {}); }
        return r;
      }).catch(() => caches.match('./index.html').then(r => r || caches.match('./')))
    );
    return;
  }

  // Librerías y fuentes: primero lo guardado, y se actualiza en segundo plano
  if (HOSTS.includes(url.hostname)) {
    e.respondWith(
      caches.match(req).then(hit => {
        const net = fetch(req).then(r => {
          if (r && (r.ok || r.type === 'opaque')) { const cp = r.clone(); caches.open(CACHE).then(c => c.put(req, cp)).catch(() => {}); }
          return r;
        }).catch(() => hit);
        return hit || net;
      })
    );
  }
});
