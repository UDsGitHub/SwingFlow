const CACHE_NAME = 'swingflow-v1';

self.addEventListener('install', (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('push', (event) => {
  event.waitUntil(
    (async () => {
      // DevTools "Push" often sends no payload — we still show something so local testing works.
      let payload;
      if (!event.data) {
        payload = {
          title: 'SwingFlow',
          body: 'Push received (empty payload — normal for DevTools simulate)',
          data: {},
        };
      } else {
        try {
          payload = event.data.json();
        } catch {
          const text = await event.data.text();
          payload = { title: 'SwingFlow Alert', body: text || 'New alert', data: {} };
        }
      }

      const options = {
        body: payload.body,
        icon: '/favicon.svg',
        badge: '/favicon.svg',
        tag: payload.data?.setupId ?? 'swingflow',
        renotify: true,
        data: payload.data ?? {},
        actions: [
          { action: 'view', title: 'View Setup' },
          { action: 'dismiss', title: 'Dismiss' },
        ],
        vibrate: [200, 100, 200],
      };

      await self.registration.showNotification(payload.title, options);
    })(),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  if (event.action === 'dismiss') return;

  const setupId = event.notification.data?.setupId;
  const url = setupId ? `/setup/${setupId}` : '/';

  const fullUrl = new URL(url, self.location.origin).href;

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(async (clients) => {
      const existing = clients.find(c => c.url.startsWith(self.location.origin));
      if (existing) {
        await existing.focus();
        if (typeof existing.navigate === 'function') {
          try {
            await existing.navigate(fullUrl);
            return;
          } catch (e) {
            console.warn('[sw] client.navigate failed, falling back to openWindow', e);
          }
        }
      }
      return self.clients.openWindow(fullUrl);
    })
  );
});
