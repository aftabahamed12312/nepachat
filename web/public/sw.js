const CACHE = 'nepachat-shell-v3';
const SHELL = ['/', '/manifest.webmanifest', '/icon.svg'];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(SHELL)));
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith('nepachat-shell-') && key !== CACHE).map(key => caches.delete(key)))));
  self.clients.claim();
});

self.addEventListener('fetch', event => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== self.location.origin || url.pathname.startsWith('/api') || url.pathname.startsWith('/socket.io')) return;
  if (request.mode === 'navigate') {
    event.respondWith(caches.open(CACHE).then(cache => fetch(request).then(async response => {
      if (response.ok) await cache.put('/', response.clone());
      return response;
    }).catch(() => cache.match('/'))));
    return;
  }
  event.respondWith(caches.open(CACHE).then(async cache => {
    const cached = await cache.match(request);
    if (cached) return cached;
    const response = await fetch(request);
    if (response.ok) await cache.put(request, response.clone());
    return response;
  }));
});

self.addEventListener('push', event => {
  const payload = event.data?.json() || {};
  event.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clients => {
    if (clients.some(client => client.visibilityState === 'visible')) return;
    return self.registration.showNotification(payload.title || 'NepaChat', {
      body: payload.body || 'You have a new notification',
      icon: '/icon.svg',
      badge: '/icon.svg',
      tag: payload.tag || 'nepachat-notification',
      data: { url: payload.url || '/', focusOnly: false },
      requireInteraction: Boolean(payload.requireInteraction),
      vibrate: [150, 80, 150],
    });
  }));
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  const target = new URL(event.notification.data?.url || '/', self.location.origin).href;
  event.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clients => {
    const existing = clients.find(client => new URL(client.url).origin === self.location.origin);
    if (existing && event.notification.data?.focusOnly) return existing.focus();
    return existing
      ? existing.navigate(target).then(client => (client || existing).focus())
      : self.clients.openWindow(target);
  }));
});