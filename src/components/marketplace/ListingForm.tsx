'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import api, { getAccessTokenInMemory } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { useToastConfirm } from '@/context/ToastConfirmContext';
import {
  Button, TextField, MenuItem, Select, FormControl, InputLabel, CircularProgress,
  Paper, Grid, ToggleButton, ToggleButtonGroup, Switch, IconButton, Tooltip, Alert,
} from '@mui/material';
import { ImagePlus, Star, Trash2, Save, ArrowLeft, MapPin, Info } from 'lucide-react';

interface Photo { url: string; isCover: boolean; }

interface FlatOpt {
  _id: string;
  number: string;
  blockName: string;
  fullAddress?: string;
  city?: string;
  ownerUserId?: string;
  location?: { coordinates?: number[] };
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'https://resismart-backend.onrender.com/api/v1';

export default function ListingForm({ listingId }: { listingId?: string }) {
  const router = useRouter();
  const { activeProfile } = useAuth();
  const { showToast } = useToastConfirm();
  const isAdmin = activeProfile?.role === 'SOCIETY_ADMIN' || activeProfile?.role === 'SOCIETY_COMMITTEE';
  const editing = !!listingId;

  const [loading, setLoading] = useState(editing);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [flats, setFlats] = useState<FlatOpt[]>([]);
  const [selectedFlat, setSelectedFlat] = useState<FlatOpt | null>(null);

  const [kind, setKind] = useState<'RENT' | 'SALE'>('RENT');
  const [scope, setScope] = useState<'FLAT' | 'SOCIETY'>('FLAT');
  const [flatId, setFlatId] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('');
  const [bedrooms, setBedrooms] = useState('');
  const [sizeLabel, setSizeLabel] = useState('');
  const [furnishing, setFurnishing] = useState('');
  const [amenities, setAmenities] = useState('');
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [contactName, setContactName] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [revealPhone, setRevealPhone] = useState(false);

  const loadFlats = useCallback(async () => {
    try {
      const params: Record<string, string> = { isPagination: 'false' };
      // Non-admin flat owners: only fetch flats they own
      if (!isAdmin) params.myFlatsOnly = 'true';
      const res = await api.get('/societies/flats', { params });
      setFlats(res.data.flats || []);
    } catch { /* non-fatal */ }
  }, [isAdmin]);

  useEffect(() => {
    loadFlats();
    if (!editing) return;
    api.get(`/marketplace/listings/${listingId}`)
      .then((res) => {
        const l = res.data.listing;
        setKind(l.kind); setScope(l.scope); setFlatId(l.flatId || '');
        setTitle(l.title); setDescription(l.description || '');
        setPrice(String((l.pricePaise || 0) / 100));
        setBedrooms(l.bedrooms != null ? String(l.bedrooms) : '');
        setSizeLabel(l.sizeLabel || ''); setFurnishing(l.furnishing || '');
        setAmenities((l.amenities || []).join(', '));
        setPhotos(l.photos || []);
        setContactName(l.contact?.name || ''); setContactPhone(l.contact?.phone || '');
        setRevealPhone(!!l.contact?.revealPhone);
      })
      .catch(() => showToast('Failed to load listing', 'error'))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listingId]);

  // When a flat is selected, sync selectedFlat and auto-suggest title
  useEffect(() => {
    if (!flatId) { setSelectedFlat(null); return; }
    const flat = flats.find((f) => f._id === flatId) || null;
    setSelectedFlat(flat);
    if (flat && !editing && !title) {
      setTitle(`${flat.blockName}-${flat.number} — ${kind === 'RENT' ? 'For Rent' : 'For Sale'}`);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flatId, flats]);

  // Auto-update title suggestion when kind changes
  useEffect(() => {
    if (!selectedFlat || editing) return;
    setTitle(`${selectedFlat.blockName}-${selectedFlat.number} — ${kind === 'RENT' ? 'For Rent' : 'For Sale'}`);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kind]);

  const onFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    setUploading(true);
    const token = getAccessTokenInMemory();
    try {
      for (const file of Array.from(files)) {
        const fd = new FormData();
        fd.append('image', file);
        const res = await fetch(`${API_BASE}/upload`, { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: fd });
        if (!res.ok) throw new Error('upload failed');
        const j = await res.json();
        setPhotos((p) => [...p, { url: j.imageUrl, isCover: p.length === 0 }]);
      }
    } catch {
      showToast('Photo upload failed', 'error');
    } finally {
      setUploading(false);
    }
  };

  const setCover = (i: number) => setPhotos((p) => p.map((ph, j) => ({ ...ph, isCover: j === i })));
  const removePhoto = (i: number) => setPhotos((p) => {
    const next = p.filter((_, j) => j !== i);
    if (next.length && !next.some((ph) => ph.isCover)) next[0].isCover = true;
    return next;
  });

  const submit = async () => {
    if (title.trim().length < 4) return showToast('Give the listing a clear title', 'error');
    if (!price || Number(price) <= 0) return showToast('Enter a price', 'error');
    if (scope === 'FLAT' && !flatId) return showToast('Select a flat', 'error');

    const payload: any = {
      title, description, price: Number(price),
      bedrooms: bedrooms ? Number(bedrooms) : undefined,
      sizeLabel: sizeLabel || undefined, furnishing: furnishing || undefined,
      amenities: amenities.split(',').map((a) => a.trim()).filter(Boolean),
      photos,
      contact: { name: contactName || undefined, phone: contactPhone || undefined, revealPhone },
    };

    setSaving(true);
    try {
      if (editing) {
        await api.patch(`/marketplace/listings/${listingId}`, payload);
        showToast('Listing updated', 'success');
      } else {
        await api.post('/marketplace/listings', { ...payload, kind, scope, flatId: scope === 'FLAT' ? flatId : undefined });
        showToast('Listing created as a draft', 'success');
      }
      router.push('/dashboard/marketplace');
    } catch (err: any) {
      showToast(err.response?.data?.error || err.response?.data?.errors?.[0]?.message || 'Failed to save listing', 'error');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="flex justify-center py-24"><CircularProgress /></div>;

  // If non-admin has no owned flats, show a friendly message
  if (!isAdmin && !editing && flats.length === 0) {
    return (
      <div className="max-w-lg text-center py-20 mx-auto space-y-4">
        <div className="w-16 h-16 rounded-2xl bg-teal-50 flex items-center justify-center mx-auto">
          <MapPin className="w-8 h-8 text-teal-600" />
        </div>
        <h2 className="text-xl font-black text-slate-800">No flats assigned</h2>
        <p className="text-slate-500 text-sm">
          You can only create listings for flats you own. Ask your society admin to assign you as the owner of your flat first.
        </p>
        <Button onClick={() => router.push('/dashboard/marketplace')} variant="outlined">
          Go back
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl animate-in fade-in duration-300 pb-6">
      <div className="flex items-center gap-3">
        <IconButton onClick={() => router.push('/dashboard/marketplace')} className="bg-white shadow-sm border border-slate-200"><ArrowLeft className="w-5 h-5" /></IconButton>
        <h1 className="text-2xl font-black text-slate-800 tracking-tight">{editing ? 'Edit Listing' : 'New Property Listing'}</h1>
      </div>

      {/* Admin note: flat owner must approve */}
      {isAdmin && scope === 'FLAT' && !editing && (
        <Alert severity="info" icon={<Info className="w-4 h-4" />} sx={{ borderRadius: 3 }}>
          <strong>Note:</strong> Listings created for specific flats on behalf of the owner start as <strong>Pending Owner Approval</strong>.
          The flat owner must approve the listing before it becomes Verified. You can still publish it immediately, but it will show as Unverified until approved.
        </Alert>
      )}

      <Paper elevation={0} className="p-6 rounded-2xl border border-slate-200/70 space-y-5">
        <ToggleButtonGroup exclusive value={kind} onChange={(_, v) => v && setKind(v)} disabled={editing} size="small" color="primary">
          <ToggleButton value="RENT" sx={{ textTransform: 'none', px: 3 }}>For Rent</ToggleButton>
          <ToggleButton value="SALE" sx={{ textTransform: 'none', px: 3 }}>For Sale</ToggleButton>
        </ToggleButtonGroup>

        <Grid container spacing={2}>
          {isAdmin && (
            <Grid size={{ xs: 12, sm: 4 }}>
              <FormControl fullWidth size="small" disabled={editing}>
                <InputLabel>Scope</InputLabel>
                <Select value={scope} label="Scope" onChange={(e) => { setScope(e.target.value as any); setFlatId(''); setSelectedFlat(null); }}>
                  <MenuItem value="FLAT">A specific flat</MenuItem>
                  <MenuItem value="SOCIETY">Society-wide</MenuItem>
                </Select>
              </FormControl>
            </Grid>
          )}
          {scope === 'FLAT' && (
            <Grid size={{ xs: 12, sm: isAdmin ? 8 : 12 }}>
              <FormControl fullWidth size="small" disabled={editing}>
                <InputLabel>{isAdmin ? 'Select any flat' : 'Select your flat'}</InputLabel>
                <Select value={flatId} label={isAdmin ? 'Select any flat' : 'Select your flat'} onChange={(e) => setFlatId(e.target.value)}>
                  {flats.length === 0 && <MenuItem value="" disabled>No flats available</MenuItem>}
                  {flats.map((f) => (
                    <MenuItem key={f._id} value={f._id}>
                      {f.blockName}-{f.number}
                      {f.fullAddress ? ` · ${f.fullAddress}` : ''}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
          )}
        </Grid>

        {/* Flat location preview */}
        {selectedFlat && (
          <div className="flex items-center gap-2 px-3 py-2 bg-teal-50 rounded-xl border border-teal-100 text-sm text-teal-800">
            <MapPin className="w-4 h-4 flex-shrink-0 text-teal-600" />
            <span>
              <strong>Location:</strong>{' '}
              {selectedFlat.fullAddress || `${selectedFlat.blockName}-${selectedFlat.number}`}
              {selectedFlat.location?.coordinates?.length === 2
                ? ` · GPS: ${selectedFlat.location.coordinates[1].toFixed(5)}, ${selectedFlat.location.coordinates[0].toFixed(5)}`
                : ' · (No GPS coordinates on file — will use society location)'}
            </span>
          </div>
        )}

        <TextField label="Title" fullWidth size="small" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Bright 2BHK with balcony, near metro" />
        <TextField label="Description" fullWidth size="small" multiline minRows={3} value={description} onChange={(e) => setDescription(e.target.value)} />

        <Grid container spacing={2}>
          <Grid size={{ xs: 6, sm: 3 }}><TextField label={kind === 'SALE' ? 'Price (₹)' : 'Rent /mo (₹)'} type="number" fullWidth size="small" value={price} onChange={(e) => setPrice(e.target.value)} /></Grid>
          <Grid size={{ xs: 6, sm: 3 }}><TextField label="Bedrooms" type="number" fullWidth size="small" value={bedrooms} onChange={(e) => setBedrooms(e.target.value)} /></Grid>
          <Grid size={{ xs: 6, sm: 3 }}><TextField label="Size (e.g. 1200 sqft)" fullWidth size="small" value={sizeLabel} onChange={(e) => setSizeLabel(e.target.value)} /></Grid>
          <Grid size={{ xs: 6, sm: 3 }}>
            <FormControl fullWidth size="small"><InputLabel>Furnishing</InputLabel>
              <Select value={furnishing} label="Furnishing" onChange={(e) => setFurnishing(e.target.value)}>
                <MenuItem value="">—</MenuItem>
                <MenuItem value="UNFURNISHED">Unfurnished</MenuItem>
                <MenuItem value="SEMI_FURNISHED">Semi-furnished</MenuItem>
                <MenuItem value="FURNISHED">Furnished</MenuItem>
              </Select>
            </FormControl>
          </Grid>
        </Grid>

        <TextField label="Amenities (comma separated)" fullWidth size="small" value={amenities} onChange={(e) => setAmenities(e.target.value)} placeholder="Parking, Lift, Power backup, Gym" />

        {/* Photos */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-black uppercase tracking-wide text-slate-500">Photos</span>
            <Button component="label" size="small" startIcon={uploading ? <CircularProgress size={14} /> : <ImagePlus className="w-4 h-4" />} disabled={uploading}>
              Upload
              <input hidden type="file" accept="image/*" multiple onChange={(e) => onFiles(e.target.files)} />
            </Button>
          </div>
          {photos.length === 0 ? (
            <p className="text-xs text-slate-400">Add at least one photo before publishing.</p>
          ) : (
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
              {photos.map((p, i) => (
                <div key={i} className={`relative rounded-xl overflow-hidden border ${p.isCover ? 'border-blue-400 ring-1 ring-blue-300' : 'border-slate-200'}`}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={p.url} alt="" className="w-full h-24 object-cover" />
                  <div className="absolute top-1 right-1 flex gap-1">
                    <Tooltip title={p.isCover ? 'Cover photo' : 'Set as cover'}>
                      <IconButton size="small" onClick={() => setCover(i)} sx={{ bgcolor: 'rgba(255,255,255,0.9)', p: 0.4 }}>
                        <Star className={`w-3.5 h-3.5 ${p.isCover ? 'text-amber-500 fill-amber-400' : 'text-slate-400'}`} />
                      </IconButton>
                    </Tooltip>
                    <IconButton size="small" onClick={() => removePhoto(i)} sx={{ bgcolor: 'rgba(255,255,255,0.9)', p: 0.4 }}>
                      <Trash2 className="w-3.5 h-3.5 text-rose-500" />
                    </IconButton>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Contact */}
        <Grid container spacing={2} sx={{ alignItems: 'center' }}>
          <Grid size={{ xs: 12, sm: 4 }}><TextField label="Contact name" fullWidth size="small" value={contactName} onChange={(e) => setContactName(e.target.value)} /></Grid>
          <Grid size={{ xs: 12, sm: 4 }}><TextField label="Contact phone" fullWidth size="small" value={contactPhone} onChange={(e) => setContactPhone(e.target.value)} /></Grid>
          <Grid size={{ xs: 12, sm: 4 }}>
            <div className="flex items-center gap-2">
              <Switch checked={revealPhone} onChange={(e) => setRevealPhone(e.target.checked)} size="small" />
              <span className="text-xs text-slate-600">Show phone publicly</span>
            </div>
          </Grid>
        </Grid>
      </Paper>

      <div className="flex justify-end gap-2">
        <Button onClick={() => router.push('/dashboard/marketplace')} className="text-slate-600">Cancel</Button>
        <Button onClick={submit} variant="contained" disabled={saving} startIcon={saving ? <CircularProgress size={16} color="inherit" /> : <Save className="w-4 h-4" />} sx={{ backgroundColor: '#0a5bd7' }}>
          {editing ? 'Save Changes' : 'Create Draft'}
        </Button>
      </div>
    </div>
  );
}
