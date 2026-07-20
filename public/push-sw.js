/* eslint-disable no-undef */
/**
 * The service worker that receives browser push.
 *
 * Deliberately tiny and deliberately NOT a caching/offline worker. Registering
 * something that intercepts fetch would change how every page in the app loads,
 * for a feature that only needs two event handlers. If offline support is ever
 * wanted, it belongs in its own worker with its own scope and its own decision.
 *
 * Served from /public, so it is a plain JS file rather than TypeScript — it is
 * never bundled and has no imports.
 */

self.addEventListener('push', event => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    // A push whose body we cannot parse is still worth surfacing — silently
    // dropping it means a real notification vanishes with no trace anywhere.
    payload = { title: 'ResiSmart', body: 'You have a new notification' };
  }

  const title = payload.title || 'ResiSmart';
  event.waitUntil(
    self.registration.showNotification(title, {
      body: payload.body || '',
      icon: '/favicon.png',
      badge: '/favicon.png',
      data: { link: payload.link || '/dashboard' },
      // Same kind replaces the previous one rather than stacking five copies of
      // "the lift is still broken".
      tag: payload.kind || 'resismart',
      renotify: false,
    })
  );
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  const link = (event.notification.data && event.notification.data.link) || '/dashboard';
  const url = new URL(link, self.location.origin).href;

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
      // Focus a tab that already has the app open rather than opening a fifth
      // one. Only then navigate it — a user with the app open on another screen
      // should not lose their place.
      for (const client of list) {
        if (client.url.startsWith(self.location.origin) && 'focus' in client) {
          return client.focus().then(c => (c.navigate ? c.navigate(url) : c));
        }
      }
      return clients.openWindow(url);
    })
  );
});
