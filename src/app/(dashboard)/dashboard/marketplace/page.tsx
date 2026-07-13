'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { useToastConfirm } from '@/context/ToastConfirmContext';
import VerifiedBadge from '@/components/marketplace/VerifiedBadge';
import BoostDialog from '@/components/marketplace/BoostDialog';
import {
  Button, Chip, IconButton, Tooltip, CircularProgress, Menu, MenuItem,
  Dialog, DialogTitle, DialogContent, DialogActions,
} from '@mui/material';
import {
  Plus, Megaphone, MoreVertical, Pencil, Trash2, Rocket, KeyRound, Home, ImageOff,
  Mail, Phone, CheckCircle2, XCircle, Bell, Search,
} from 'lucide-react';

interface Listing {
  _id: string; kind: string; scope: string; flatId?: string; title: string; status: string;
  pricePaise: number; priceType: string; photos: { url: string; isCover: boolean }[];
  verification?: { status: string; method?: string }; boost?: { active: boolean };
  viewsCount: number; leadsCount: number; city?: string;
}

const money = (p: number) => `₹${(p / 100).toLocaleString('en-IN')}`;
const statusColor: Record<string, any> = { DRAFT: 'default', ACTIVE: 'success', PAUSED: 'warning', SOLD: 'info', RENTED: 'info', EXPIRED: 'default', TAKEN_DOWN: 'error' };

export default function MarketplacePage() {
  const router = useRouter();
  const { activeProfile } = useAuth();
  const { showToast, confirm } = useToastConfirm();
  const isAdmin = activeProfile?.role === 'SOCIETY_ADMIN' || activeProfile?.role === 'SOCIETY_COMMITTEE';

  const [listings, setListings] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);
  const [menuEl, setMenuEl] = useState<null | HTMLElement>(null);
  const [menuFor, setMenuFor] = useState<Listing | null>(null);
  const [boostFor, setBoostFor] = useState<Listing | null>(null);
  const [leadsFor, setLeadsFor] = useState<Listing | null>(null);
  const [leads, setLeads] = useState<any[]>([]);
  const [leadsLoading, setLeadsLoading] = useState(false);
  const [approvingId, setApprovingId] = useState<string | null>(null);

  const viewLeads = async (l: Listing) => {
    setLeadsFor(l); setLeadsLoading(true); setLeads([]);
    try { const r = await api.get(`/marketplace/listings/${l._id}/leads`); setLeads(r.data.leads || []); }
    catch (err: any) { showToast(err.response?.data?.error || 'Failed to load leads', 'error'); }
    finally { setLeadsLoading(false); }
  };

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/marketplace/listings/mine');
      setListings(res.data.listings || []);
    } catch {
      showToast('Failed to load listings', 'error');
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const act = async (id: string, path: string, msg: string) => {
    try {
      await api.post(`/marketplace/listings/${id}/${path}`);
      showToast(msg, 'success');
      fetchData();
    } catch (err: any) {
      showToast(err.response?.data?.error || 'Action failed', 'error');
    }
  };

  const handleApprove = async (l: Listing) => {
    setApprovingId(l._id);
    try {
      await api.post(`/marketplace/listings/${l._id}/approve-verification`);
      showToast("Listing verified — it's now marked as verified!", 'success');
      fetchData();
    } catch (err: any) {
      showToast(err.response?.data?.error || 'Approval failed', 'error');
    } finally { setApprovingId(null); }
  };

  const handleReject = async (l: Listing) => {
    const ok = await confirm({ title: 'Reject listing', message: `Reject "${l.title}"? The listing will return to draft and the admin can revise it.`, confirmText: 'Reject', severity: 'warning' });
    if (!ok) return;
    setApprovingId(l._id);
    try {
      await api.post(`/marketplace/listings/${l._id}/reject-verification`);
      showToast('Listing rejected and returned to draft', 'success');
      fetchData();
    } catch (err: any) {
      showToast(err.response?.data?.error || 'Rejection failed', 'error');
    } finally { setApprovingId(null); }
  };

  const del = async (l: Listing) => {
    const ok = await confirm({ title: 'Delete listing', message: `Delete "${l.title}"? This cannot be undone.`, confirmText: 'Delete', severity: 'error' });
    if (!ok) return;
    try { await api.delete(`/marketplace/listings/${l._id}`); showToast('Listing deleted', 'success'); fetchData(); }
    catch (err: any) { showToast(err.response?.data?.error || 'Failed to delete', 'error'); }
  };

  const openMenu = (e: React.MouseEvent<HTMLElement>, l: Listing) => { setMenuEl(e.currentTarget); setMenuFor(l); };
  const closeMenu = () => { setMenuEl(null); setMenuFor(null); };

  // Listings that need the current user's approval as flat owner
  const pendingApproval = !isAdmin ? listings.filter(
    (l) => l.verification?.status === 'PENDING_OWNER' && l.scope === 'FLAT'
  ) : [];
  const regularListings = listings.filter((l) => l.verification?.status !== 'PENDING_OWNER' || isAdmin);

  const renderListingCard = (l: Listing) => {
    const cover = l.photos?.find((p) => p.isCover) || l.photos?.[0];
    return (
      <div key={l._id} className="rounded-2xl border border-slate-200/70 bg-white overflow-hidden hover:shadow-md transition-shadow">
        <div className="relative h-40 bg-slate-100">
          {cover ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={cover.url} alt="" className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-slate-300"><ImageOff className="w-8 h-8" /></div>
          )}
          <div className="absolute top-2 left-2 flex gap-1.5">
            <Chip size="small" label={l.status} color={statusColor[l.status]} sx={{ height: 22, fontWeight: 700 }} />
            {l.boost?.active && <Chip size="small" icon={<Rocket className="w-3 h-3" />} label="Boosted" sx={{ height: 22, bgcolor: '#f59e0b', color: '#fff', fontWeight: 700 }} />}
          </div>
          <div className="absolute top-2 right-2"><VerifiedBadge status={l.verification?.status} /></div>
        </div>
        <div className="p-4">
          <div className="flex items-center gap-1.5 text-xs text-slate-500 mb-1">
            {l.kind === 'RENT' ? <KeyRound className="w-3.5 h-3.5" /> : <Home className="w-3.5 h-3.5" />}
            {l.kind === 'RENT' ? 'For Rent' : 'For Sale'}{l.city ? ` · ${l.city}` : ''}
          </div>
          <h3 className="font-bold text-slate-800 line-clamp-1">{l.title}</h3>
          <div className="mt-1 flex items-center justify-between">
            <span className="text-lg font-black text-teal-700">{money(l.pricePaise)}{l.priceType === 'PER_MONTH' ? <span className="text-xs font-medium text-slate-400">/mo</span> : ''}</span>
            <span className="text-[11px] text-slate-400">{l.viewsCount} views · {l.leadsCount} leads</span>
          </div>
          <div className="mt-3 flex items-center justify-between">
            <div className="flex gap-1.5">
              {l.status === 'DRAFT' && <Button size="small" variant="contained" onClick={() => act(l._id, 'publish', 'Listing published')} sx={{ backgroundColor: '#0f766e', textTransform: 'none' }}>Publish</Button>}
              {l.status === 'ACTIVE' && <Button size="small" variant="outlined" onClick={() => act(l._id, 'pause', 'Listing paused')} sx={{ textTransform: 'none' }}>Pause</Button>}
              {l.status === 'PAUSED' && <Button size="small" variant="outlined" onClick={() => act(l._id, 'activate', 'Listing re-activated')} sx={{ textTransform: 'none' }}>Activate</Button>}
              {l.status === 'ACTIVE' && (
                <Button size="small" onClick={() => setBoostFor(l)} startIcon={<Rocket className="w-3.5 h-3.5" />}
                  sx={{ textTransform: 'none', color: l.boost?.active ? '#b45309' : '#0f766e' }}>
                  {l.boost?.active ? 'Boosted' : 'Boost'}
                </Button>
              )}
            </div>
            <IconButton size="small" onClick={(e) => openMenu(e, l)}><MoreVertical className="w-4 h-4" /></IconButton>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-[#0f766e] to-[#14b8a6] p-6 md:p-7 shadow-lg">
        <div className="absolute -right-10 -top-10 w-48 h-48 rounded-full bg-white/10 blur-2xl" />
        <div className="relative flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5"><Megaphone className="w-6 h-6 text-white" /><h1 className="text-2xl font-black text-white tracking-tight">My Property Listings</h1></div>
            <p className="text-sm text-teal-50 mt-1">Advertise your flats for rent or sale on Resismart Housing</p>
          </div>
          <Button onClick={() => router.push('/dashboard/marketplace/create')} variant="contained" startIcon={<Plus className="w-4 h-4" />}
            sx={{ backgroundColor: 'rgba(255,255,255,0.2)', color: '#fff', boxShadow: 'none', '&:hover': { backgroundColor: 'rgba(255,255,255,0.3)', boxShadow: 'none' } }}>New Listing</Button>
        </div>
      </div>

      {/* ── Pending Owner Approval section (only visible to flat owners, not admins) ── */}
      {!isAdmin && pendingApproval.length > 0 && (
        <div className="rounded-2xl border-2 border-amber-300 bg-amber-50 p-5 space-y-3">
          <div className="flex items-center gap-2">
            <Bell className="w-5 h-5 text-amber-600" />
            <h2 className="font-black text-amber-800">Listings awaiting your approval</h2>
            <Chip size="small" label={pendingApproval.length} sx={{ bgcolor: '#f59e0b', color: '#fff', fontWeight: 700, height: 20 }} />
          </div>
          <p className="text-sm text-amber-700">
            Your society admin created these listings for your flat(s). Review them and choose to <strong>approve</strong> (they become Verified) or <strong>reject</strong> (returned to draft for the admin to revise).
          </p>
          <div className="space-y-3">
            {pendingApproval.map((l) => (
              <div key={l._id} className="bg-white rounded-xl border border-amber-200 p-4 flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <p className="font-bold text-slate-800 truncate">{l.title}</p>
                  <p className="text-sm text-slate-500">{money(l.pricePaise)}{l.priceType === 'PER_MONTH' ? '/mo' : ''} · Created by society admin</p>
                </div>
                <div className="flex gap-2 flex-shrink-0">
                  <Button
                    size="small" variant="contained" color="success"
                    startIcon={approvingId === l._id ? <CircularProgress size={14} color="inherit" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                    disabled={approvingId === l._id}
                    onClick={() => handleApprove(l)}
                    sx={{ textTransform: 'none' }}>
                    Approve & Verify
                  </Button>
                  <Button
                    size="small" variant="outlined" color="error"
                    startIcon={<XCircle className="w-3.5 h-3.5" />}
                    disabled={approvingId === l._id}
                    onClick={() => handleReject(l)}
                    sx={{ textTransform: 'none' }}>
                    Reject
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── My Listings grid ── */}
      {loading ? (
        <div className="flex justify-center py-24"><CircularProgress /></div>
      ) : regularListings.length === 0 && pendingApproval.length === 0 ? (
        <div className="text-center py-24 text-slate-400">
          <Megaphone className="w-10 h-10 mx-auto mb-3 opacity-40" />
          <p className="font-semibold">No listings yet</p>
          <p className="text-sm">Create your first rent or sale advertisement.</p>
        </div>
      ) : regularListings.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {regularListings.map((l) => renderListingCard(l))}
        </div>
      ) : null}

      <Menu anchorEl={menuEl} open={!!menuEl} onClose={closeMenu}>
        <MenuItem onClick={() => { closeMenu(); router.push(`/dashboard/marketplace/${menuFor?._id}/edit`); }}><Pencil className="w-4 h-4 mr-2" /> Edit</MenuItem>
        <MenuItem onClick={() => { const l = menuFor!; closeMenu(); viewLeads(l); }}><Mail className="w-4 h-4 mr-2" /> View leads</MenuItem>
        {menuFor && ['ACTIVE', 'PAUSED', 'DRAFT'].includes(menuFor.status) && menuFor.kind === 'RENT' && (
          <MenuItem onClick={() => { const l = menuFor!; closeMenu(); act(l._id, 'mark-rented', 'Marked as rented'); }}>Mark as rented</MenuItem>
        )}
        {menuFor && ['ACTIVE', 'PAUSED', 'DRAFT'].includes(menuFor.status) && menuFor.kind === 'SALE' && (
          <MenuItem onClick={() => { const l = menuFor!; closeMenu(); act(l._id, 'mark-sold', 'Marked as sold'); }}>Mark as sold</MenuItem>
        )}
        <MenuItem onClick={() => { const l = menuFor!; closeMenu(); del(l); }} className="text-rose-600"><Trash2 className="w-4 h-4 mr-2" /> Delete</MenuItem>
      </Menu>

      {boostFor && (
        <BoostDialog listingId={boostFor._id} listingTitle={boostFor.title} open={!!boostFor}
          onClose={() => setBoostFor(null)} onDone={fetchData} />
      )}

      <Dialog open={!!leadsFor} onClose={() => setLeadsFor(null)} maxWidth="sm" fullWidth slotProps={{ paper: { className: 'rounded-2xl' } }}>
        <DialogTitle className="font-bold border-b border-slate-100">Inquiries · {leadsFor?.title}</DialogTitle>
        <DialogContent className="pt-4">
          {leadsLoading ? <div className="flex justify-center py-10"><CircularProgress /></div> : leads.length === 0 ? (
            <p className="text-sm text-slate-400 py-8 text-center">No inquiries yet.</p>
          ) : (
            <div className="space-y-3">
              {leads.map((ld) => (
                <div key={ld._id} className="rounded-xl border border-slate-200/70 p-3">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-800">{ld.from?.name}</span>
                    <span className="text-[11px] text-slate-400">{new Date(ld.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</span>
                  </div>
                  <a href={`tel:${ld.from?.phone}`} className="text-sm text-teal-700 flex items-center gap-1 mt-0.5"><Phone className="w-3.5 h-3.5" /> {ld.from?.phone}{ld.from?.phoneVerified ? ' ✓' : ''}</a>
                  {ld.message && <p className="text-sm text-slate-600 mt-1">{ld.message}</p>}
                </div>
              ))}
            </div>
          )}
        </DialogContent>
        <DialogActions className="p-4 border-t border-slate-100"><Button onClick={() => setLeadsFor(null)}>Close</Button></DialogActions>
      </Dialog>
    </div>
  );
}
