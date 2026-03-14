/**
 * Aman Service Worker  v4.0
 * - Caches static assets for offline use
 * - Network-first for API calls
 * - Stale-while-revalidate for pages
 */

const CACHE    = 'aman-v4';
const PRECACHE = [
  '/',
  '/app',
  '/pricing',
  '/manifest.json',
];

// Install: pre-cache shell pages
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(PRECACHE)).then(() => self.skipWaiting())
  );
});

// Activate: clean old caches
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// Fetch strategy
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);

  // API calls: network only (never cache)
  if (url.pathname.startsWith('/api/')) {
    e.respondWith(fetch(e.request));
    return;
  }

  // Static assets (js/css/fonts): cache-first
  if (/\.(js|css|woff2?|ttf|png|ico|svg)(\?|$)/.test(url.pathname)) {
    e.respondWith(
      caches.match(e.request).then(cached => cached || fetch(e.request).then(res => {
        const clone = res.clone();
        caches.open(CACHE).then(c => c.put(e.request, clone));
        return res;
      }))
    );
    return;
  }

  // HTML pages: network-first, fall back to cache
  e.respondWith(
    fetch(e.request)
      .then(res => {
        const clone = res.clone();
        caches.open(CACHE).then(c => c.put(e.request, clone));
        return res;
      })
      .catch(() => caches.match(e.request).then(cached => cached || caches.match('/')))
  );
});

// Background sync (future: queue translations)
self.addEventListener('sync', e => {
  if (e.tag === 'sync-translations') {
    // placeholder for offline queue
  }
});
