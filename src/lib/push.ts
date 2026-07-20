import api from './api';

/**
 * Turning browser push on, from the page's side.
 *
 * Everything here is written to fail politely. Browser push is unavailable in
 * more situations than people expect — Safari before 16.4, any browser in a
 * private window, an iOS home-screen app that was never "added to home
 * screen", an insecure origin, a user who clicked Block last March — and none
 * of those are errors the resident should be shown a red toast about. The
 * caller gets a status it can explain in a sentence.
 */

export type PushStatus =
  | 'ENABLED'
  | 'BLOCKED'          // the user said no; only they can undo it, in browser settings
  | 'UNSUPPORTED'      // this browser or context cannot do push at all
  | 'UNAVAILABLE'      // the server has no VAPID key to sign with
  | 'DISMISSED'        // the permission prompt was closed without an answer
  | 'FAILED';

export function pushSupported(): boolean {
  return typeof window !== 'undefined'
    && 'serviceWorker' in navigator
    && 'PushManager' in window
    && 'Notification' in window
    // Push requires a secure context; localhost counts, plain http on a LAN
    // address does not, and the failure there is otherwise very confusing.
    && window.isSecureContext;
}

export function pushPermission(): NotificationPermission | 'unsupported' {
  if (!pushSupported()) return 'unsupported';
  return Notification.permission;
}

/** base64url → Uint8Array, the encoding the Push API insists on for the VAPID key. */
function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const normalised = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = window.atob(normalised);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

export async function enablePush(): Promise<PushStatus> {
  if (!pushSupported()) return 'UNSUPPORTED';
  if (Notification.permission === 'denied') return 'BLOCKED';

  try {
    const cfg = await api.get('/notifications/config');
    const vapid: string | null = cfg.data?.data?.vapidPublicKey;
    if (!vapid) return 'UNAVAILABLE';

    // Ask only after we know we can actually deliver. Prompting and then
    // failing costs the one permission request the browser will ever let us
    // make without the user digging through settings.
    const permission = await Notification.requestPermission();
    if (permission === 'denied') return 'BLOCKED';
    if (permission !== 'granted') return 'DISMISSED';

    const reg = await navigator.serviceWorker.register('/push-sw.js', { scope: '/' });
    await navigator.serviceWorker.ready;

    // Reuse an existing subscription rather than unsubscribing and
    // re-subscribing: the endpoint stays stable, so the server keeps one row
    // for this browser instead of accumulating one per visit.
    const sub = await reg.pushManager.getSubscription()
      || await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapid) as BufferSource,
      });

    const json = sub.toJSON();
    if (!json.keys?.p256dh || !json.keys?.auth) return 'FAILED';

    await api.post('/notifications/devices', {
      platform: 'WEB',
      token: sub.endpoint,
      keys: { p256dh: json.keys.p256dh, auth: json.keys.auth },
      deviceLabel: navigator.userAgent.slice(0, 120),
    });

    return 'ENABLED';
  } catch {
    return 'FAILED';
  }
}

export async function disablePush(): Promise<boolean> {
  if (!pushSupported()) return false;
  try {
    const reg = await navigator.serviceWorker.getRegistration('/');
    const sub = await reg?.pushManager.getSubscription();
    if (!sub) return true;

    // Tell the server FIRST. If unsubscribing succeeded and the delete then
    // failed, the row would linger and be pushed to forever with no
    // subscription behind it — a permanent, invisible failure on every send.
    await api.delete('/notifications/devices', { data: { token: sub.endpoint } });
    await sub.unsubscribe();
    return true;
  } catch {
    return false;
  }
}

/** Whether this browser currently has a live subscription. */
export async function pushEnabled(): Promise<boolean> {
  if (!pushSupported() || Notification.permission !== 'granted') return false;
  try {
    const reg = await navigator.serviceWorker.getRegistration('/');
    return !!(await reg?.pushManager.getSubscription());
  } catch {
    return false;
  }
}
