const CACHE_NAME = 'mywar-v27';
const IMG_CACHE = 'mywar-img-v3';
// 音乐不缓存，按需从网络加载，大幅减少iPad存储占用

// 核心文件预缓存
const PRECACHE_URLS = [
  './game.html',
  './图标.jpg',
  './manifest.json'
];

// 安装时预缓存核心文件
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(PRECACHE_URLS);
    }).then(() => self.skipWaiting())
  );
});

// 激活时清理旧缓存
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME && k !== IMG_CACHE).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// 图片懒加载标记
const _imgCacheReady = new Set();

// 请求拦截
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  const path = url.pathname;

  // 跳过非GET请求
  if (event.request.method !== 'GET') return;

  // 音乐文件：仅网络，不缓存（节省iPad存储）
  if (path.includes('mywar音乐/') || path.endsWith('.mp3')) {
    event.respondWith(fetch(event.request).catch(() => new Response('', { status: 503 })));
    return;
  }

  // 图片文件：缓存优先（英雄/怪物/装备/战场/boss都压缩过了）
  if (path.includes('装备图片/') || path.includes('英雄图片/') || path.includes('怪物图片/') || path.includes('战场背景/') || path.includes('boss/')) {
    event.respondWith(cacheFirst(event.request, IMG_CACHE));
    return;
  }

  // game.html & 核心文件：stale-while-revalidate
  if (path.endsWith('game.html') || path.endsWith('图标.jpg') || path.endsWith('manifest.json')) {
    event.respondWith(staleWhileRevalidate(event.request, CACHE_NAME));
    return;
  }

  // 其他请求：网络优先
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
