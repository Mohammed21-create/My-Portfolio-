// Minimal service worker: makes the admin installable. It never caches pages, API calls or content,
// so you always see live data. Only a friendly offline message is shown when there is no connection.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()));
self.addEventListener('fetch', e => {
  if (e.request.mode !== 'navigate') return;
  e.respondWith(fetch(e.request).catch(() => new Response(
    '<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Offline</title><body style="font-family:system-ui;background:#0b0f1a;color:#e6e9f2;display:flex;align-items:center;justify-content:center;min-height:100vh;text-align:center"><div><h2>You are offline</h2><p>Connect to the internet and reopen the admin.</p></div>',
    { headers: { 'Content-Type': 'text/html; charset=utf-8' } })));
});
