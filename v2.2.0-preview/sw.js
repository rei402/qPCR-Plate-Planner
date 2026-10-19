const CACHE_PREFIX = 'qpcr-planner-' + encodeURIComponent(self.registration?.scope || self.location.origin) + '-';
const CACHE = CACHE_PREFIX + 'v2.2.0';
const ASSETS = ['./qPCR%20Plate%20Planner.html', './styles.css', './tablet-guide.css', './print.css', './lab-layout.js', './core.js', './single-channel.js', './single-channel-ui.js', './single-channel.css', './plate-colors.js', './presentation.js', './selection.js', './tablet-guide-core.js', './tablet-guide.js', './execution.js', './project-io.js', './form-controller.js', './plate-renderer.js', './print-controller.js', './update-safety.js', './app.js', './manifest.json', './icons/icon.svg', './icons/icon-192.png', './icons/icon-512.png'];
self.addEventListener('install', event => { event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(ASSETS))); });
self.addEventListener('activate', event => { event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith(CACHE_PREFIX) && key !== CACHE).map(key => caches.delete(key)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', event => { if (event.request.method !== 'GET' || new URL(event.request.url).origin !== self.location.origin) return; event.respondWith(caches.match(event.request).then(hit => hit || fetch(event.request).then(response => { if (response.ok) { const copy = response.clone(); caches.open(CACHE).then(cache => cache.put(event.request, copy)); } return response; }))); });

self.addEventListener('message', event => { if (event.data?.type === 'ACTIVATE_UPDATE') self.skipWaiting(); });
