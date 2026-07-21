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
/** The pre-rotation cache: ONE key. Still read, never written. See `cachedPublicKeys`. */
const LEGACY_KEY_KEY = 'resismart.gate.publicKey';
const KEYS_KEY = 'resismart.gate.publicKeys';

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

/**
 * EVERY key the server will accept, not just the newest one.
 *
 * This cache used to hold a single PEM, and that made the server's two-key
 * rotation useless at the only place it matters. The server keeps a retired key
 * verifiable for a grace window precisely because every pass already sitting in
 * a guest's WhatsApp was signed with it — but a device that refreshed after a
 * rotation and stored only the newest key would reject all of them offline as
 * "tampered with", which is a real guest turned away at a gate that cannot
 * phone anybody to check. Store the list; try them all.
 */
export function cachePublicKeys(pems: string[]) {
  const clean = pems.filter(Boolean);
  if (!clean.length) return;
  try {
    localStorage.setItem(KEYS_KEY, JSON.stringify(clean));
    // The old single-key entry is removed rather than left behind, so a device
    // cannot keep verifying against a key the server has since dropped.
    localStorage.removeItem(LEGACY_KEY_KEY);
  } catch { /* nothing to do */ }
}

/**
 * The cached keys, newest first.
 *
 * Falls back to the old single-key entry, because a guard tablet that has been
 * offline since before this shipped is holding one and would otherwise lose
 * offline verification entirely at the moment it needs it — the failure this
 * whole file exists to avoid. It is upgraded to the list on the next refresh.
 */
export function cachedPublicKeys(): string[] {
  try {
    const raw = localStorage.getItem(KEYS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length) return parsed.filter((k) => typeof k === 'string');
    }
    const legacy = localStorage.getItem(LEGACY_KEY_KEY);
    return legacy ? [legacy] : [];
  } catch { return []; }
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
  const pems = cachedPublicKeys();
  if (!pems.length) return { valid: false, reason: 'This device has not been set up for offline use yet.' };

  try {
    const [body, sig] = payload.split('.');
    if (!body || !sig) return { valid: false, reason: 'That is not a ResiSmart pass.' };

    // Newest first, exactly as the server orders them, so the common case
    // matches on the first key and a rotation costs one extra verify on the
    // rare pass that predates it.
    const signature = b64urlToBytes(sig) as unknown as BufferSource;
    const signed = new TextEncoder().encode(body) as unknown as BufferSource;
    let good = false;
    for (const pem of pems) {
      const key = await crypto.subtle.importKey('spki', pemToDer(pem), { name: 'Ed25519' }, false, ['verify']);
      if (await crypto.subtle.verify('Ed25519', key, signature, signed)) { good = true; break; }
    }
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
