const CACHE_NAME = 'mywar-v3';
const IMG_CACHE = 'mywar-img-v1';
const MUSIC_CACHE = 'mywar-music-v1';

// Core files to precache on install
const PRECACHE_URLS = [
  './game.html',
  './图标.jpg',
  './manifest.json'
];

// Install: precache core files only (images/music cached on first use)
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(PRECACHE_URLS);
    }).then(() => self.skipWaiting())
  );
});

// Activate: clean old caches
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME && k !== IMG_CACHE && k !== MUSIC_CACHE).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// Fetch strategy
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  const path = url.pathname;

  // Skip non-GET
  if (event.request.method !== 'GET') return;

  // Music files: cache-first (cache when played)
  if (path.includes('mywar音乐/') || path.endsWith('.mp3')) {
    event.respondWith(cacheFirst(event.request, MUSIC_CACHE));
    return;
  }

  // Image files: cache-first
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
