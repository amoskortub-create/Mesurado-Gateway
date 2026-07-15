// Minimal service worker — required by browsers (e.g. Chrome on Android) as
// an installability signal for the Web App Manifest ("Add to Home Screen" /
// PWA install prompt). Intentionally does not cache or intercept API calls
// (auth, dashboard data, /v1 completions must always hit the network), so it
// only passes requests through.
self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', () => {
  // No-op: always fall through to the network. Presence of a fetch handler
  // (even a no-op one) is part of the PWA installability criteria.
});
