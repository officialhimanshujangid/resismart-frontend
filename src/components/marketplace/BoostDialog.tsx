'use client';

import React, { useState, useEffect } from 'react';
import api from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { useToastConfirm } from '@/context/ToastConfirmContext';
import {
  Dialog, DialogTitle, DialogContent, DialogActions, Button, CircularProgress, Chip,
} from '@mui/material';
import { Rocket, Radius, CalendarClock, Megaphone } from 'lucide-react';

interface Pkg { _id: string; label: string; pricePaise: number; durationDays: number; radiusKm: number; topPlacement: boolean; }

function loadRazorpay(): Promise<boolean> {
  return new Promise((resolve) => {
    if ((window as any).Razorpay) return resolve(true);
    const s = document.createElement('script');
    s.src = 'https://checkout.razorpay.com/v1/checkout.js';
    s.onload = () => resolve(true);
    s.onerror = () => resolve(false);
    document.body.appendChild(s);
  });
}

export default function BoostDialog({ listingId, listingTitle, open, onClose, onDone }: {
  listingId: string; listingTitle: string; open: boolean; onClose: () => void; onDone: () => void;
}) {
  const { user } = useAuth();
  const { showToast } = useToastConfirm();
  const [packages, setPackages] = useState<Pkg[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    api.get('/marketplace/boost-packages')
      .then((r) => setPackages(r.data.packages || []))
      .catch(() => showToast('Failed to load boost packages', 'error'))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const buy = async (pkg: Pkg) => {
    setBusy(pkg._id);
    try {
      const res = await api.post(`/marketplace/listings/${listingId}/boost/checkout`, { packageId: pkg._id });
      if (res.data.free) {
        showToast('Boost applied', 'success');
        onDone(); onClose();
        return;
      }
      const ok = await loadRazorpay();
      if (!ok) { showToast('Could not load the payment gateway', 'error'); return; }
      const { keyId, orderId, amountPaise, boostId } = res.data;
      const rzp = new (window as any).Razorpay({
        key: keyId, order_id: orderId, amount: amountPaise, currency: 'INR',
        name: 'ResiSmart Marketplace', description: `Boost: ${pkg.label}`,
        prefill: { name: user?.name, email: user?.email },
        theme: { color: '#0f766e' },
        handler: async (response: any) => {
          try {
            await api.post('/marketplace/boost/verify', {
              boostId,
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
            });
            showToast('Boost active — your listing is now promoted', 'success');
            onDone(); onClose();
          } catch (err: any) {
            showToast(err.response?.data?.error || 'Payment verification failed', 'error');
          }
        },
        modal: { ondismiss: () => setBusy(null) },
      });
      rzp.on('payment.failed', () => showToast('Payment failed. Please try again.', 'error'));
      rzp.open();
    } catch (err: any) {
      showToast(err.response?.data?.error || 'Could not start boost', 'error');
    } finally {
      setBusy(null);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth slotProps={{ paper: { className: 'rounded-2xl' } }}>
      <DialogTitle className="font-bold border-b border-slate-100 flex items-center gap-2">
        <Rocket className="w-5 h-5 text-amber-500" /> Boost “{listingTitle}”
      </DialogTitle>
      <DialogContent className="pt-6">
        <p className="text-sm text-slate-500 mb-4">Boosting widens your listing’s visibility radius and pins it to the top of search results.</p>
        {loading ? (
          <div className="flex justify-center py-10"><CircularProgress /></div>
        ) : packages.length === 0 ? (
          <p className="text-sm text-slate-400 py-6 text-center">No boost packages available right now.</p>
        ) : (
          <div className="space-y-3">
            {packages.map((p) => (
              <div key={p._id} className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200/70 p-4 hover:border-amber-300 transition-colors">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-800">{p.label}</span>
                    {p.topPlacement && <Chip size="small" icon={<Megaphone className="w-3 h-3" />} label="Top" sx={{ height: 20, bgcolor: '#fef3c7', color: '#b45309', fontWeight: 700 }} />}
                  </div>
                  <div className="flex items-center gap-3 text-xs text-slate-500 mt-1">
                    <span className="flex items-center gap-1"><Radius className="w-3.5 h-3.5" /> {p.radiusKm} km</span>
                    <span className="flex items-center gap-1"><CalendarClock className="w-3.5 h-3.5" /> {p.durationDays} days</span>
                  </div>
                </div>
                <Button variant="contained" disabled={!!busy} onClick={() => buy(p)}
                  sx={{ backgroundColor: '#0f766e', textTransform: 'none', whiteSpace: 'nowrap', '&:hover': { backgroundColor: '#0b5c55' } }}>
                  {busy === p._id ? <CircularProgress size={20} color="inherit" /> : (p.pricePaise === 0 ? 'Apply free' : `Pay ₹${(p.pricePaise / 100).toLocaleString('en-IN')}`)}
                </Button>
              </div>
            ))}
          </div>
        )}
      </DialogContent>
      <DialogActions className="p-4 border-t border-slate-100">
        <Button onClick={onClose} className="text-slate-600">Close</Button>
      </DialogActions>
    </Dialog>
  );
}
