import { self as sw } from '$app/service-worker';
import { assets, immutable } from '$app/manifest';
import { version } from '$app/env';

// Minimal service worker so the app can be installed as a PWA.
// It caches the app shell only; chat data always comes from the network.
const CACHE = `lumio-${version}`;
const ASSETS = [...immutable, ...assets].map((a) => a.path as string);

sw.addEventListener('install', (event) => {
	event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(ASSETS)));
});

sw.addEventListener('activate', (event) => {
	event.waitUntil(
		caches
			.keys()
			.then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
	);
});

sw.addEventListener('fetch', (event) => {
	if (event.request.method !== 'GET') return;
	const url = new URL(event.request.url);
	if (url.origin !== sw.location.origin || !ASSETS.includes(url.pathname)) return;
	event.respondWith(caches.match(event.request).then((hit) => hit ?? fetch(event.request)));
});
