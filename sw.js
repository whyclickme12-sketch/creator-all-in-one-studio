/* 앱 셸 오프라인 캐시 (network-first, 실패 시 캐시) */
const VERSION = 'v1.0.0';
const SHELL = [
  './',
  './index.html',
  './assets/app.css',
  './assets/app.js',
  './assets/youtube.js',
  './assets/gemini.js',
  './assets/analyzer.js',
  './assets/script-studio.js',
  './assets/thumbnail-studio.js',
  './assets/cut-editor.js',
  './assets/boot.js',
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
