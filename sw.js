const CACHE_NAME = 'mywar-v16';
const IMG_CACHE = 'mywar-img-v2';
// 音乐不再缓存，按需从网络加载，大幅减少iPad存储占用

// Core files to precache on install
const PRECACHE_URLS = [
  './game.html',
  './图标.jpg',
  './manifest.json'
];

// Install: precache core files only
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(PRECACHE_URLS);
    }).then(() => self.skipWaiting())
  );
});

// Activate: clean old caches (including old music cache)
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME && k !== IMG_CACHE).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// Fetch strategy
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  const path = url.pathname;

  // Skip non-GET
  if (event.request.method !== 'GET') return;

  // Music files: network-only, never cache (save iPad storage)
  if (path.includes('mywar音乐/') || path.endsWith('.mp3')) {
    event.respondWith(fetch(event.request).catch(() => new Response('', { status: 503 })));
    return;
  }

  // Image files: cache-first (images are small after compression)
  if (path.includes('装备图片/') || path.includes('英雄图片/') || path.includes('怪物图片/')) {
    event.respondWith(cacheFirst(event.request, IMG_CACHE));
    return;
  }

  // game.html & core: stale-while-revalidate
  if (path.endsWith('game.html') || path.endsWith('图标.jpg') || path.endsWith('manifest.json')) {
    event.respondWith(staleWhileRevalidate(event.request, CACHE_NAME));
    return;
  }

  // Everything else: network-first
  event.respondWith(networkFirst(event.request));
});

async function cacheFirst(request, cacheName) {
  const cached = await caches.match(request);
  if (cached) return cached;
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, response.clone());
    }
    return response;
  } catch (e) {
    return new Response('Offline', { status: 503 });
  }
}

async function staleWhileRevalidate(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  const fetchPromise = fetch(request).then(response => {
    if (response.ok) cache.put(request, response.clone());
    return response;
  }).catch(() => cached);
  return cached || fetchPromise;
}

async function networkFirst(request) {
  try {
    const response = await fetch(request);
    return response;
  } catch (e) {
    const cached = await caches.match(request);
    return cached || new Response('Offline', { status: 503 });
  }
}
