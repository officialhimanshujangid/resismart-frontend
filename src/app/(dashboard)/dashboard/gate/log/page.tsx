'use client';

import React, { useCallback, useEffect, useState } from 'react';
import api from '@/lib/api';
import {
  Paper, TextField, CircularProgress, Chip, Table, TableHead, TableBody, TableRow,
  TableCell, TableContainer, TablePagination, FormControl, Select, MenuItem, Button,
} from '@mui/material';
import { Search, AlertTriangle, ShieldCheck, TrendingUp } from 'lucide-react';
import { useToastConfirm } from '@/context/ToastConfirmContext';

/**
 * The gate record.
 *
 * Serves two very different readers from one screen and one endpoint: a
 * committee member seeing everything, and a resident seeing only their own
 * flat. The clamp is applied server-side — this page does not decide, it just
 * renders whatever it is allowed to have.
 */

interface Row {
  _id: string;
  entryCode: string;
  category: string;
  visitorName: string;
  visitorPhone?: string;
  flatLabel?: string;
  vehicleNumber?: string;
  status: string;
  enteredAt: string;
  exitedAt?: string;
  exitSource?: string;
  isEstimated: boolean;
  guardName: string;
}

interface Reconciliation {
  date: string;
  entries: number;
  exitsRecorded: number;
  estimated: number;
  accuracy: number | null;
}

const CATEGORY_LABEL: Record<string, string> = {
  GUEST: 'Guest', DELIVERY: 'Delivery', CAB: 'Cab',
  HOUSEHOLD_STAFF: 'Daily help', CONTRACTOR: 'Contractor', OTHER: 'Other',
};

const when = (iso?: string) => iso
  ? new Date(iso).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
  : '—';

export default function GateLogPage() {
  const { showToast } = useToastConfirm();
  const [rows, setRows] = useState<Row[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(25);
  const [q, setQ] = useState('');
  const [category, setCategory] = useState('');
  const [loading, setLoading] = useState(true);
  const [recon, setRecon] = useState<Reconciliation | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page + 1), pageSize: String(pageSize) });
      if (q.trim()) params.set('q', q.trim());
      if (category) params.set('category', category);
      const res = await api.get(`/gate/entries?${params}`);
      setRows(res.data?.rows || []);
      setTotal(res.data?.pagination?.total || 0);
    } catch (e: any) {
      showToast(e.response?.data?.message || 'Could not load the gate log', 'error');
    } finally { setLoading(false); }
  }, [page, pageSize, q, category, showToast]);

  useEffect(() => { load(); }, [load]);

  // Committee-only; a resident's request 403s and the card simply does not show.
  useEffect(() => {
    api.get('/gate/reconciliation')
      .then(r => setRecon(r.data?.data))
      .catch(() => setRecon(null));
  }, []);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-black text-slate-900">Gate records</h1>
        <p className="text-sm text-slate-500 mt-0.5">Who came, who went, and who nobody saw leave.</p>
      </div>

      {/* --------------------------------------------------- yesterday's truth */}
      {recon && recon.accuracy !== null && (
        <Paper elevation={0} className={`rounded-2xl border p-4 ${recon.accuracy >= 90 ? 'border-emerald-200 bg-emerald-50/50' : 'border-amber-300 bg-amber-50/60'}`}>
          <div className="flex items-start gap-3">
            {recon.accuracy >= 90
              ? <ShieldCheck className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
              : <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />}
            <div className="flex-1">
              <p className="font-bold text-slate-800 text-sm">
                {new Date(recon.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'long' })}
                {' — '}{recon.entries} entries, {recon.exitsRecorded} departures recorded ({recon.accuracy}%)
              </p>
              {recon.estimated > 0 && (
                <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                  <strong>{recon.estimated}</strong> were closed off automatically at the end of the day because
                  nobody marked them as gone. Those are shown below as <em>assumed</em> — the record is honest
                  about not knowing, which is what makes this figure worth acting on.
                </p>
              )}
            </div>
          </div>
        </Paper>
      )}

      <div className="flex gap-2 flex-wrap">
        <TextField
          size="small" placeholder="Name, phone, flat, vehicle…" value={q}
          onChange={e => { setPage(0); setQ(e.target.value); }} className="flex-1 min-w-56"
          slotProps={{ input: { className: '!rounded-xl', startAdornment: <Search className="w-4 h-4 text-slate-400 mr-2" /> } }}
        />
        <FormControl size="small" className="min-w-40">
          <Select displayEmpty value={category} className="!rounded-xl"
            onChange={e => { setPage(0); setCategory(e.target.value); }}>
            <MenuItem value="">All kinds</MenuItem>
            {Object.entries(CATEGORY_LABEL).map(([k, v]) => <MenuItem key={k} value={k}>{v}</MenuItem>)}
          </Select>
        </FormControl>
      </div>

      <TableContainer component={Paper} elevation={0} className="rounded-2xl border border-slate-200/70 overflow-x-auto">
        {loading ? <div className="flex justify-center py-16"><CircularProgress size={28} /></div>
          : rows.length === 0 ? <div className="text-center py-16 text-slate-400 font-semibold text-sm">Nothing here yet.</div>
          : (
            <Table size="small" sx={{ minWidth: 760 }}>
              <TableHead>
                <TableRow>
                  {['#', 'Visitor', 'Kind', 'Going to', 'In', 'Out', 'Logged by'].map(h => (
                    <TableCell key={h} className="!text-[10px] !font-black !uppercase !text-slate-500">{h}</TableCell>
                  ))}
                </TableRow>
              </TableHead>
              <TableBody>
                {rows.map(r => (
                  <TableRow key={r._id} className={r.isEstimated ? '!bg-amber-50/40' : ''}>
                    <TableCell className="!text-xs !text-slate-400">{r.entryCode}</TableCell>
                    <TableCell>
                      <p className="text-sm font-semibold text-slate-800">{r.visitorName}</p>
                      {r.vehicleNumber && <p className="text-[11px] text-slate-400">{r.vehicleNumber}</p>}
                    </TableCell>
                    <TableCell className="!text-xs !text-slate-600">{CATEGORY_LABEL[r.category] || r.category}</TableCell>
                    <TableCell className="!text-xs !text-slate-600">{r.flatLabel || '—'}</TableCell>
                    <TableCell className="!text-xs !text-slate-600">{when(r.enteredAt)}</TableCell>
                    <TableCell className="!text-xs">
                      {r.status === 'INSIDE'
                        ? <Chip size="small" label="Still inside" className="!bg-sky-50 !text-sky-700 !font-bold !text-[10px]" />
                        : (
                          <span className="text-slate-600">
                            {when(r.exitedAt)}
                            {r.isEstimated && (
                              <Chip size="small" label="assumed" title="Nobody marked this visitor as gone; the day was closed off automatically."
                                className="!ml-1.5 !bg-amber-100 !text-amber-800 !font-bold !text-[9px] !h-4" />
                            )}
                          </span>
                        )}
                    </TableCell>
                    <TableCell className="!text-xs !text-slate-500">{r.guardName}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        <TablePagination
          component="div" count={total} page={page} rowsPerPage={pageSize}
          rowsPerPageOptions={[25, 50, 100]}
          onPageChange={(_, p) => setPage(p)}
          onRowsPerPageChange={e => { setPageSize(Number(e.target.value)); setPage(0); }}
        />
      </TableContainer>
    </div>
  );
}
