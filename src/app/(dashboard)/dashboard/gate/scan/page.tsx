'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import api from '@/lib/api';
import { Paper, Button, TextField, Chip, CircularProgress } from '@mui/material';
import { ScanLine, Wifi, WifiOff, CloudUpload, Check, X, Keyboard } from 'lucide-react';
import { useToastConfirm } from '@/context/ToastConfirmContext';
import {
  enqueue, queueCount, queued, removeQueued,
  cachePublicKey, verifyOffline,
} from '@/lib/gate-queue';

/**
 * The guard's scanner.
 *
 * Built around the assumption that the network is missing rather than present.
 * A gate is usually a metal cabin between two concrete towers; a scanner that
 * needs a round trip before it can say yes is a scanner the guard stops using
 * by the second week.
 *
 * So: verify locally, admit locally, queue, and reconcile when the signal comes
 * back. The server's job on sync is to record and flag, not to argue with a
 * decision that was made ten minutes ago at a physical gate.
 */

interface Outcome {
  ok: boolean;
  message: string;
  visitorName?: string;
  offline?: boolean;
}

export default function GateScanPage() {
  const { showToast } = useToastConfirm();
  const [online, setOnline] = useState(true);
  const [pending, setPending] = useState(0);
  const [scanning, setScanning] = useState(false);
  const [busy, setBusy] = useState(false);
  const [code, setCode] = useState('');
  const [last, setLast] = useState<Outcome | null>(null);
  const [ready, setReady] = useState(false);

  const scannerRef = useRef<any>(null);

  useEffect(() => {
    setOnline(navigator.onLine);
    setPending(queueCount());
    const up = () => setOnline(true);
    const down = () => setOnline(false);
    window.addEventListener('online', up);
    window.addEventListener('offline', down);
    return () => { window.removeEventListener('online', up); window.removeEventListener('offline', down); };
  }, []);

  // Fetch and cache the verifying key while we still have a network. If this
  // never runs, the device simply cannot work offline — which the UI says
  // plainly rather than discovering it at the worst moment.
  useEffect(() => {
    (async () => {
      try {
        const res = await api.get('/gate/passes/scanner-config');
        const key = res.data?.data?.publicKey;
        if (key) { cachePublicKey(key); setReady(true); }
      } catch {
        setReady(false);
      }
    })();
  }, []);

  const sync = useCallback(async () => {
    const items = queued();
    if (!items.length || !navigator.onLine) return;
    setBusy(true);
    try {
      const res = await api.post('/gate/passes/sync', {
        items: items.map(i => ({
          clientId: i.clientId, code: i.code, payload: i.payload, scannedAt: i.scannedAt,
        })),
      });
      const results = res.data?.data?.results || [];
      // Clear everything the server settled — including the ones it refused.
      // A scan it has already judged must not be sent again on the next sync,
      // or a flagged entry gets flagged repeatedly.
      removeQueued(results.map((r: any) => r.clientId));
      setPending(queueCount());

      const flagged = res.data?.data?.flagged || 0;
      showToast(
        flagged
          ? `${results.length} sent, ${flagged} flagged for review`
          : `${results.length} entries synced`,
        flagged ? 'warning' : 'success',
      );
    } catch {
      showToast('Could not sync yet — the entries are still saved on this device.', 'error');
    } finally { setBusy(false); }
  }, [showToast]);

  // Sync the moment the signal returns, without the guard having to think about it.
  useEffect(() => { if (online) sync(); }, [online, sync]);

  const handle = async (input: { code?: string; payload?: string }) => {
    setBusy(true);
    try {
      if (navigator.onLine) {
        const res = await api.post('/gate/passes/redeem', input);
        const d = res.data?.data;
        setLast({ ok: true, message: res.data?.message || 'Pass accepted', visitorName: d?.pass?.visitorName });
        return;
      }

      // Offline. A typed code carries no proof of anything, so it cannot be
      // trusted here — only a signed QR can be checked without the server.
      if (!input.payload) {
        setLast({ ok: false, message: 'No signal — a typed code cannot be checked. Scan the QR instead.' });
        return;
      }

      const check = await verifyOffline(input.payload);
      if (!check.valid) {
        setLast({ ok: false, message: check.reason || 'That pass is not valid.' });
        return;
      }

      enqueue({ payload: input.payload, visitorName: check.visitorName });
      setPending(queueCount());
      setLast({
        ok: true, offline: true, visitorName: check.visitorName,
        message: `${check.visitorName} — pass verified on this device. It will be sent when the signal returns.`,
      });
    } catch (e: any) {
      setLast({ ok: false, message: e.response?.data?.message || 'Could not check that pass' });
    } finally { setBusy(false); }
  };

  const startCamera = async () => {
    setScanning(true);
    try {
      // Loaded on demand: it pulls in a camera decoder that a guard typing
      // codes should never have to download.
      const { Html5Qrcode } = await import('html5-qrcode');
      const scanner = new Html5Qrcode('gate-reader');
      scannerRef.current = scanner;
      await scanner.start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 240, height: 240 } },
        async (text: string) => {
          // Stop first. Leaving it running fires the same QR a dozen times
          // while the guard is still holding it up.
          try { await scanner.stop(); } catch { /* already stopping */ }
          setScanning(false);
          await handle({ payload: text });
        },
        () => { /* a frame with no QR in it is not an error */ },
      );
    } catch {
      setScanning(false);
      showToast('Could not open the camera. Type the code instead.', 'error');
    }
  };

  const stopCamera = async () => {
    try { await scannerRef.current?.stop(); } catch { /* nothing to stop */ }
    setScanning(false);
  };

  useEffect(() => () => { scannerRef.current?.stop?.().catch(() => {}); }, []);

  return (
    <div className="space-y-4 pb-24 max-w-lg">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-black text-slate-900">Scan a pass</h1>
          <p className="text-sm text-slate-600 mt-1">Works without a signal.</p>
        </div>
        <Chip size="small" icon={online ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
          label={online ? 'Online' : 'No signal'}
          className={`!font-bold !text-[11px] ${online ? '!bg-emerald-50 !text-emerald-700' : '!bg-amber-50 !text-amber-800'}`} />
      </div>

      {!ready && (
        <Paper elevation={0} className="rounded-2xl border border-amber-300 bg-amber-50/60 p-3">
          <p className="text-xs text-amber-800">
            This device has not fetched its verifying key yet, so it cannot check
            passes without a signal. Open this page once while online.
          </p>
        </Paper>
      )}

      {pending > 0 && (
        <Paper elevation={0} className="rounded-2xl border border-slate-200/70 p-3 flex items-center justify-between gap-3">
          <div>
            <p className="font-bold text-slate-800 text-sm">{pending} waiting to be sent</p>
            <p className="text-[11px] text-slate-500">Saved on this device. Nothing is lost.</p>
          </div>
          <Button size="small" variant="outlined" disabled={!online || busy}
            startIcon={<CloudUpload className="w-3.5 h-3.5" />} onClick={sync}
            className="!rounded-xl !normal-case !font-bold !text-xs">Send now</Button>
        </Paper>
      )}

      <Paper elevation={0} className="rounded-2xl border border-slate-200/70 p-4 space-y-3">
        <div id="gate-reader" className={scanning ? 'rounded-xl overflow-hidden' : 'hidden'} />
        {scanning ? (
          <Button fullWidth variant="outlined" onClick={stopCamera}
            className="!rounded-xl !normal-case !font-bold">Stop camera</Button>
        ) : (
          <Button fullWidth variant="contained" startIcon={<ScanLine className="w-4 h-4" />}
            onClick={startCamera} disabled={busy}
            className="!rounded-xl !normal-case !font-bold !py-3">Scan QR</Button>
        )}

        <div className="flex items-center gap-2">
          <div className="h-px bg-slate-200 flex-1" />
          <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">or type it</span>
          <div className="h-px bg-slate-200 flex-1" />
        </div>

        <div className="flex gap-2">
          <TextField fullWidth size="small" label="Six-digit code" value={code}
            onChange={e => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
            slotProps={{ htmlInput: { inputMode: 'numeric', className: 'font-mono tracking-widest' } }} />
          <Button variant="contained" disabled={code.length !== 6 || busy}
            startIcon={<Keyboard className="w-4 h-4" />}
            onClick={() => { handle({ code }); setCode(''); }}
            className="!rounded-xl !normal-case !font-bold shrink-0">Check</Button>
        </div>
      </Paper>

      {busy && <div className="flex justify-center"><CircularProgress size={22} /></div>}

      {last && (
        <Paper elevation={0} className={`rounded-2xl border p-4 ${
          last.ok ? 'border-emerald-300 bg-emerald-50/60' : 'border-red-300 bg-red-50/60'}`}>
          <div className="flex items-start gap-2.5">
            {last.ok ? <Check className="w-5 h-5 text-emerald-600 shrink-0" />
                     : <X className="w-5 h-5 text-red-600 shrink-0" />}
            <div>
              {last.visitorName && <p className="font-black text-slate-900">{last.visitorName}</p>}
              <p className={`text-sm ${last.ok ? 'text-emerald-800' : 'text-red-800'}`}>{last.message}</p>
              {last.offline && (
                <p className="text-[11px] text-slate-500 mt-1">
                  Checked against the signature on this device — no server was involved.
                </p>
              )}
            </div>
          </div>
        </Paper>
      )}
    </div>
  );
}
