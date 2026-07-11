const CACHE = 'cen-journey-engine-v1.7.25';
const CORE = [
  './',
  './index.html',
  './css/styles.css',
  './js/app.js',
  './manifest.webmanifest',
  './data/journeys.json',
  './data/places-master.json',
  './data/place-map-links-master.json',
  './journeys/OT/J000-engine-demo.json',
  './journeys/OT/J001-abraham-journey.json',
  './journeys/OT/J002-isaac-endurance-journey.json',
  './journeys/OT/J003-jacob-transformation-journey.json',
  './journeys/OT/J004-joseph-providence-journey.json',
  './journeys/OT/J005-exodus-liberation-journey.json',
  './journeys/OT/J006-wilderness-training-journey.json',
  './journeys/OT/J007-joshua-conquest-journey.json',
  './journeys/OT/J008-judges-cycle-journey.json',
  './journeys/OT/J009-samuel-calling-kingship-journey.json',
  './journeys/OT/J010-david-calling-kingdom-journey.json',
  './journeys/OT/J011-solomon-temple-journey.json',
  './journeys/OT/J012-divided-kingdom-journey.json',
  './journeys/OT/J013-elijah-prophetic-journey.json',
  './journeys/OT/J014-elisha-miracles-journey.json',
  './journeys/OT/J015-northern-kingdom-fall-journey.json',
  './journeys/OT/J016-southern-kingdom-fall-journey.json',
  './journeys/OT/J017-babylon-exile-journey.json',
  './journeys/OT/J018-zerubbabel-return-temple-journey.json',
  './journeys/OT/J019-ezra-return-reform-journey.json',
  './journeys/OT/J020-nehemiah-wall-restoration-journey.json',
  './journeys/NT/J021-jesus-birth-childhood-journey.json',
  './journeys/NT/J022-john-baptist-baptism-journey.json',
  './journeys/NT/J023-galilee-early-ministry-journey.json',
  './journeys/NT/J024-galilee-expanded-ministry-journey.json',
  './journeys/NT/J025-galilee-final-ministry-journey.json',
  './assets/icons/icon-192.png',
  './assets/icons/icon-512.png',
  './assets/icons/icon-512-maskable.png'
];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(CORE)));
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
  );
  self.clients.claim();
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  event.respondWith(
    caches.match(event.request).then(cached => cached || fetch(event.request).then(response => {
      const copy = response.clone();
      caches.open(CACHE).then(cache => cache.put(event.request, copy));
      return response;
    }).catch(() => caches.match('./index.html')))
  );
});
