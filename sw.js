// Service Worker: hält die App-Dateien bereit. Daten kommen immer live aus Supabase (fremde Hosts werden nicht gecacht).
// BEI JEDEM DEPLOY CACHE-Version um 1 erhöhen, sonst sehen Nutzer die alte Version!
const CACHE = 'app-template-v37';
const SHELL = ['./', 'index.html', 'styles.css', 'app.js', 'i18n.js', 'config.js', 'manifest.webmanifest',
  'apple-touch-icon.png', 'icon-192.png', 'icon-512.png', 'icon-maskable-512.png', 'icons/favicon-48.png'];

self.addEventListener('install', (e) => {
  // nur gültige Antworten (Status 200) in den Zwischenspeicher; leere/blockierte Antworten (z. B. 204 durch Webschutz) nie
  e.waitUntil(caches.open(CACHE).then((c) => Promise.all(SHELL.map((u) =>
    fetch(u, { cache: 'reload' }).then((r) => (r.status === 200 ? c.put(u, r) : null)).catch(() => {})))).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
// Erst das Netz (Änderungen kommen sofort an), sonst Zwischenspeicher.
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;
  e.respondWith(fetch(req).then((res) => {
    if (res.status === 200) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); return res; }
    return caches.match(req).then((hit) => hit || res);   // leere/fehlerhafte Antwort: lieber die gemerkte gute Version zeigen
  }).catch(() => caches.match(req).then((hit) => hit || caches.match('index.html'))));
});
