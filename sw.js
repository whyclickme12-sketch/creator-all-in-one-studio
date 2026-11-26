/* 앱 셸 오프라인 캐시 (network-first, 실패 시 캐시)
   index.html의 ?v= 값과 VERSION을 함께 올려 주세요(에셋 캐시 갱신용). */
const VERSION = 'v1.0.13';
const V = '1.0.13';
const SHELL = [
  './',
  './index.html',
  './assets/app.css?v=' + V,
  './assets/app.js?v=' + V,
  './assets/youtube.js?v=' + V,
  './assets/gemini.js?v=' + V,
  './assets/analyzer.js?v=' + V,
  './assets/script-studio.js?v=' + V,
  './assets/thumbnail-studio.js?v=' + V,
  './assets/cut-editor.js?v=' + V,
  './assets/boot.js?v=' + V,
  './manifest.webmanifest',
  './icons/icon-192.png',
  './icons/icon-512.png'
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()).catch(() => {}));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // API 호출은 캐시하지 않음
  e.respondWith(
    fetch(req).then((res) => {
      const copy = res.clone();
      caches.open(VERSION).then((c) => c.put(req, copy)).catch(() => {});
      return res;
    }).catch(() => caches.match(req).then((hit) => hit || caches.match('./index.html')))
  );
});
