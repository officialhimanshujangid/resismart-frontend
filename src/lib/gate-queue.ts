/**
 * The gate's memory for the times it has no network.
 *
 * localStorage rather than IndexedDB, deliberately. The payload is a handful of
 * short strings per scan and a busy gate produces maybe a hundred in an outage
 * — well inside the 5MB budget. IndexedDB would buy asynchrony and versioning
 * that nothing here needs, at the cost of a schema to maintain on a device
 * nobody can debug.
 *
 * What is NOT here is just as deliberate: no verification logic. The device
 * checks a signature using the same rule the server does, and that rule lives
 * in one place (`verifyOffline` below calls WebCrypto with the server's own
 * public key). A second implementation of "is this pass valid" is how a gate
 * and a server end up disagreeing.
 */

const QUEUE_KEY = 'resismart.gate.queue';
const KEY_KEY = 'resismart.gate.publicKey';

export interface QueuedScan {
  clientId: string;
  code?: string;
  payload?: string;
  scannedAt: string;
  visitorName?: string;
}

const read = (): QueuedScan[] => {
  try { return JSON.parse(localStorage.getItem(QUEUE_KEY) || '[]'); } catch { return []; }
};
const write = (items: QueuedScan[]) => {
  try { localStorage.setItem(QUEUE_KEY, JSON.stringify(items)); } catch { /* full or blocked */ }
};

export const queued = (): QueuedScan[] => read();
export const queueCount = (): number => read().length;

export function enqueue(scan: Omit<QueuedScan, 'clientId' | 'scannedAt'>): QueuedScan {
  const item: QueuedScan = {
    ...scan,
    // Not a timestamp alone: two scans in the same millisecond would collide,
    // and the clientId is what the server echoes back to say which one it
    // settled.
    clientId: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    scannedAt: new Date().toISOString(),
  };
  write([...read(), item]);
  return item;
}

export function removeQueued(clientIds: string[]) {
  const gone = new Set(clientIds);
  write(read().filter(i => !gone.has(i.clientId)));
}

// ------------------------------------------------------------ the key cache

export function cachePublicKey(pem: string) {
  try { localStorage.setItem(KEY_KEY, pem); } catch { /* nothing to do */ }
}
export function cachedPublicKey(): string | null {
  try { return localStorage.getItem(KEY_KEY); } catch { return null; }
}

/** PEM → the raw SPKI bytes WebCrypto wants. */
function pemToDer(pem: string): ArrayBuffer {
  const b64 = pem.replace(/-----[A-Z ]+-----/g, '').replace(/\s+/g, '');
  const raw = atob(b64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out.buffer;
}

const b64urlToBytes = (s: string): Uint8Array => {
  const b64 = s.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (s.length % 4)) % 4);
  const raw = atob(b64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
};

export interface OfflineCheck {
  valid: boolean;
  reason?: string;
  visitorName?: string;
  flatLabel?: string;
}

/**
 * Verify a scanned pass with no network at all.
 *
 * Signature FIRST, contents second — reading the claims off an unverified blob
 * and showing the guard a name it contains would let a forged QR put any name
 * on the screen.
 */
export async function verifyOffline(payload: string): Promise<OfflineCheck> {
  const pem = cachedPublicKey();
  if (!pem) return { valid: false, reason: 'This device has not been set up for offline use yet.' };

  try {
    const [body, sig] = payload.split('.');
    if (!body || !sig) return { valid: false, reason: 'That is not a ResiSmart pass.' };

    const key = await crypto.subtle.importKey('spki', pemToDer(pem), { name: 'Ed25519' }, false, ['verify']);
    const good = await crypto.subtle.verify(
      'Ed25519', key,
      b64urlToBytes(sig) as unknown as BufferSource,
      new TextEncoder().encode(body) as unknown as BufferSource,
    );
    if (!good) return { valid: false, reason: 'This pass has been tampered with.' };

    const claims = JSON.parse(new TextDecoder().decode(b64urlToBytes(body)));
    if (claims.e * 1000 < Date.now()) {
      return { valid: false, reason: 'This pass has expired.', visitorName: claims.n };
    }
    return { valid: true, visitorName: claims.n, flatLabel: claims.f };
  } catch {
    // Includes browsers with no Ed25519 in WebCrypto. Saying so is better than
    // a silent "invalid pass" that makes the guard distrust every guest.
    return { valid: false, reason: 'This device cannot check passes offline. Try again when online.' };
  }
}
