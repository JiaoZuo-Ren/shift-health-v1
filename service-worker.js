/* 今日活动建议 · Service Worker
   策略：
   - HTML / JS / CSS / manifest：network-first（保证更新能立刻到达），失败回退缓存（离线可打开）
   - 图标 / 截图库等静态大文件：cache-first
   - AI 接口（workers.dev）等跨域 API：完全绕过，不缓存
   - CACHE_VERSION 变化或重新部署后，旧缓存自动清理
*/
const CACHE_VERSION = 'shift-health-v1.0.0';
const SHELL_CACHE = CACHE_VERSION + '-shell';
const ASSET_CACHE = CACHE_VERSION + '-assets';

/* 首次安装预缓存的核心资源：保证断网时也能打开页面 */
const PRECACHE_URLS = [
  './',
  './index.html',
  './style.css',
  './script.js',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  './apple-touch-icon.png',
  './about.html'
];

/* 这些路径直接交给网络，绝不缓存（AI 接口每次都要真实请求） */
const BYPASS_PATTERNS = [
  /workers\.dev/i,
  /api\.deepseek\.com/i
];

self.addEventListener('install', function (event) {
  event.waitUntil(
    caches.open(SHELL_CACHE)
      .then(function (cache) { return cache.addAll(PRECACHE_URLS); })
      .then(function () { return self.skipWaiting(); })   /* 新 SW 立即接管，不等旧页面全部关闭 */
  );
});

self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches.keys().then(function (keys) {
      /* 清掉所有旧版本缓存，避免占空间 */
      return Promise.all(keys.map(function (key) {
        if (key.indexOf(CACHE_VERSION) !== 0) return caches.delete(key);
      }));
    }).then(function () { return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function (event) {
  const req = event.request;

  /* 只处理 GET；POST（AI 请求）直接放行 */
  if (req.method !== 'GET') return;

  /* API 请求绕过 SW */
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) {
    for (let i = 0; i < BYPASS_PATTERNS.length; i++) {
      if (BYPASS_PATTERNS[i].test(req.url)) return;
    }
  }

  /* 图标等静态资源：cache-first */
  const isStaticAsset = /\.(png|jpg|jpeg|svg|ico|woff2?)$/i.test(url.pathname) ||
    /html2canvas/i.test(url.pathname);

  if (isStaticAsset) {
    event.respondWith(
      caches.match(req).then(function (hit) {
        if (hit) return hit;
        return fetch(req).then(function (res) {
          if (res && res.ok) {
            const copy = res.clone();
            caches.open(ASSET_CACHE).then(function (c) { c.put(req, copy); });
          }
          return res;
        }).catch(function () { return hit; });
      })
    );
    return;
  }

  /* HTML / JS / CSS / manifest：network-first，失败读缓存（离线兜底） */
  event.respondWith(
    fetch(req).then(function (res) {
      if (res && res.ok) {
        const copy = res.clone();
        caches.open(SHELL_CACHE).then(function (c) { c.put(req, copy); });
      }
      return res;
    }).catch(function () {
      return caches.match(req).then(function (hit) {
        /* 页面请求离线时兜底返回 index.html（单页应用式体验） */
        if (hit) return hit;
        if (req.mode === 'navigate') return caches.match('./index.html');
        return Response.error();
      });
    })
  );
});
