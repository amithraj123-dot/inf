const CACHE = 'endless-drive-v7';
const ASSETS = [
  '.',
  'index.html',
  'css/style.css',
  'js/data.js',
  'js/save.js',
  'js/audio.js',
  'js/engine.js',
  'js/render.js',
  'js/ui.js',
  'manifest.json',
  'icon.svg',
  'icon-maskable.svg',
  'icon-180.png',
  'sw.js',
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  e.respondWith(
    caches.match(e.request).then(cached =>
      cached ||
      fetch(e.request).then(res => {
        const copy = res.clone();
        caches.open(CACHE).then(c => c.put(e.request, copy));
        return res;
      }).catch(() => caches.match('index.html'))
    )
  );
});
