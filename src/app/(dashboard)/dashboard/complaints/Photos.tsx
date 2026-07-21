'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import api from '@/lib/api';
import { Button, Dialog, IconButton, CircularProgress } from '@mui/material';
import { Camera, X, ImageOff } from 'lucide-react';
import { useToastConfirm } from '@/context/ToastConfirmContext';
import ErrorState from '@/components/common/ErrorState';
import { Photo, refusal } from './shared';

/**
 * Photographs, at last.
 *
 * `photoKeys` has been on the complaint and on every event since the beginning,
 * validated by the schema and written by the service — with no uploader and no
 * viewer anywhere in the product. So a resident reporting a leak had to
 * describe it in prose and a technician's "after" picture was stored where
 * nobody could look at it. OPERATIONS_V2 §IV-1.2 names this as the single
 * biggest reason filing a complaint feels long, and it is the easiest to
 * believe: a photograph of a stain on a ceiling says in one tap what three
 * sentences say badly.
 *
 * Two components, because there are two jobs: choosing pictures before the
 * complaint exists, and looking at them afterwards. Neither ever holds a public
 * URL — the bucket is private, uploads return an object key, and viewing goes
 * through a link the server signs for five minutes for a caller it has already
 * checked.
 */

/**
 * Pick photos for a complaint that has not been saved yet.
 *
 * The bytes go up immediately and the KEY is what the form carries, the same
 * two-step the flat documents use: a half-finished form therefore never leaves
 * a complaint pointing at a file that was never stored, and pressing "Report
 * it" is instant instead of waiting on a 4G upload.
 */
export function PhotoPicker({
  value, onChange, limit = 6, label = 'Add a photo',
}: {
  value: string[];
  onChange: (keys: string[]) => void;
  limit?: number;
  label?: string;
}) {
  const { showToast } = useToastConfirm();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  // Local previews, keyed by the object key the server gave back, so a picture
  // can be shown without a round trip to fetch a signed link for something the
  // person is literally holding.
  const [previews, setPreviews] = useState<Record<string, string>>({});

  // Object URLs are a leak if nobody revokes them; a resident who changes their
  // mind six times on a phone would otherwise pin six images in memory.
  useEffect(() => () => { Object.values(previews).forEach(URL.revokeObjectURL); }, [previews]);

  const pick = async (files: FileList | null) => {
    if (!files?.length) return;
    const room = limit - value.length;
    if (room <= 0) return showToast(`That is ${limit} photos already — plenty.`, 'error');
    setBusy(true);
    try {
      const keys: string[] = [];
      const shots: Record<string, string> = {};
      for (const file of Array.from(files).slice(0, room)) {
        const fd = new FormData();
        fd.append('file', file);
        // `api` strips its JSON content type for FormData, so the browser sets
        // the multipart boundary. Doing it per call site is how uploads
        // elsewhere used to arrive empty.
        const res = await api.post('/complaints/photos', fd);
        const key = res.data?.data?.key;
        if (key) { keys.push(key); shots[key] = URL.createObjectURL(file); }
      }
      setPreviews(p => ({ ...p, ...shots }));
      onChange([...value, ...keys]);
    } catch (e: unknown) {
      showToast(refusal(e, 'That photo would not upload'), 'error');
    } finally {
      setBusy(false);
      if (input.current) input.current.value = '';
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {value.map(key => (
          <div key={key} className="relative w-16 h-16 rounded-xl overflow-hidden border border-slate-200 bg-slate-100">
            {previews[key]
              // A local blob, not a remote object — `next/image` would try to
              // optimise it through the server, which cannot see it.
              /* eslint-disable-next-line @next/next/no-img-element */
              ? <img src={previews[key]} alt="" className="w-full h-full object-cover" />
              : <div className="w-full h-full flex items-center justify-center"><Camera className="w-4 h-4 text-slate-400" /></div>}
            <IconButton size="small" aria-label="Remove this photo"
              onClick={() => onChange(value.filter(k => k !== key))}
              sx={{
                position: 'absolute', top: 2, right: 2, width: 20, height: 20,
                bgcolor: 'background.paper', boxShadow: 1,
                '&:hover': { bgcolor: 'background.paper' },
              }}>
              <X className="w-3 h-3" />
            </IconButton>
          </div>
        ))}
        {value.length < limit && (
          <Button variant="outlined" onClick={() => input.current?.click()} disabled={busy}
            sx={{ width: 64, height: 64, minWidth: 64, borderStyle: 'dashed', flexDirection: 'column', gap: 0.25 }}>
            {busy ? <CircularProgress size={16} /> : <Camera className="w-4 h-4" />}
          </Button>
        )}
      </div>
      <input ref={input} type="file" accept="image/*,application/pdf" multiple hidden
        onChange={e => pick(e.target.files)} />
      <p className="text-[11px] text-slate-400">
        {label} — a picture explains a leak far better than a paragraph. Up to {limit}.
      </p>
    </div>
  );
}

/**
 * The gallery on a complaint that already exists.
 *
 * Every link is minted per request and dies in five minutes, and the server
 * decides which photographs this reader may see at all — a picture attached to
 * an internal staff note is filtered out before anything is signed, not hidden
 * afterwards.
 */
export function PhotoGallery({ complaintId, reloadKey }: { complaintId: string; reloadKey?: number }) {
  const [photos, setPhotos] = useState<Photo[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [open, setOpen] = useState<Photo | null>(null);

  const load = useCallback(async () => {
    setFailed(false);
    try {
      const res = await api.get(`/complaints/${complaintId}/photos`);
      setPhotos(res.data?.data || []);
    } catch {
      // Never `return null` on a failure — a blank space reads as "there are no
      // photos", which is a different and misleading fact.
      setFailed(true);
    }
  }, [complaintId]);

  useEffect(() => { load(); }, [load, reloadKey]);

  if (failed) {
    return <ErrorState title="The photos would not load" message="They are still attached to this complaint."
      icon={<ImageOff className="w-6 h-6" />} onRetry={load} />;
  }
  if (!photos) return <div className="flex justify-center py-4"><CircularProgress size={20} /></div>;
  if (!photos.length) return null;

  return (
    <div>
      <p className="text-[10px] font-black uppercase tracking-wider text-slate-500 mb-2">Photos</p>
      <div className="flex flex-wrap gap-2">
        {photos.map(p => (
          <button key={p.key} type="button" onClick={() => setOpen(p)}
            title={`${p.caption || 'Photo'} · ${p.byName}`}
            className="w-20 h-20 rounded-xl overflow-hidden border border-slate-200 bg-slate-100 relative">
            <Image src={p.url} alt={p.caption || 'Photo of the problem'} fill sizes="80px"
              className="object-cover" unoptimized />
          </button>
        ))}
      </div>
      <Dialog open={!!open} onClose={() => setOpen(null)} maxWidth="md" fullWidth>
        {open && (
          <div className="relative">
            {/* Full size, unoptimised: the link is signed and short-lived, so
                routing it through the image optimiser would cache a URL that is
                about to stop working. */}
            <Image src={open.url} alt={open.caption || 'Photo of the problem'}
              width={1200} height={900} unoptimized
              className="w-full h-auto" />
            <div className="p-3">
              <p className="text-xs text-slate-600">{open.caption || 'Photo'} · {open.byName}</p>
            </div>
          </div>
        )}
      </Dialog>
    </div>
  );
}
