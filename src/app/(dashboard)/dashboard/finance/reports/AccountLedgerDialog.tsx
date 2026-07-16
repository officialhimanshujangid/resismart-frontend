'use client';

import React, { useEffect, useState } from 'react';
import api from '@/lib/api';
import {
  Dialog, DialogTitle, DialogContent, IconButton, CircularProgress, Zoom,
  Table, TableHead, TableBody, TableRow, TableCell, TableContainer, Paper,
} from '@mui/material';
import { X } from 'lucide-react';

const rupees = (p?: number) => `₹${((p || 0) / 100).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
const shortDate = (d: string) => new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: '2-digit' });

interface LedgerRow {
  voucherNumber: string; voucherType: string; entryDate: string;
  narration?: string; description?: string;
  debitPaise: number; creditPaise: number; balancePaise: number;
}
interface Ledger {
  account: { code: string; name: string; type: string };
  openingPaise: number; closingPaise: number;
  totalDebitPaise: number; totalCreditPaise: number;
  rows: LedgerRow[];
}

/**
 * The vouchers behind a figure. Every number on a statement is a total of real
 * entries; without this the reader has to take it on faith.
 */
export default function AccountLedgerDialog({
  code, from, to, onClose,
}: { code: string | null; from?: string; to?: string; onClose: () => void }) {
  const [data, setData] = useState<Ledger | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!code) { setData(null); setError(''); return; }
    let cancelled = false;
    (async () => {
      setLoading(true); setError(''); setData(null);
      try {
        const params = new URLSearchParams();
        if (from) params.append('from', from);
        if (to) params.append('to', to);
        const res = await api.get(`/finance/society/reports/ledger/${code}?${params.toString()}`);
        if (!cancelled) setData(res.data);
      } catch (e: any) {
        if (!cancelled) setError(e.response?.data?.error || 'Could not load the entries behind this figure.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [code, from, to]);

  return (
    <Dialog open={!!code} onClose={onClose} slots={{ transition: Zoom }} maxWidth="md" fullWidth>
      <DialogTitle className="flex justify-between items-start pr-3">
        <div>
          <p className="font-bold text-slate-800">{data ? `${data.account.code} · ${data.account.name}` : 'Entries'}</p>
          <p className="text-xs text-slate-500 font-normal mt-0.5">Every voucher that makes up this figure</p>
        </div>
        <IconButton onClick={onClose} size="small"><X className="w-5 h-5" /></IconButton>
      </DialogTitle>
      <DialogContent>
        {loading ? <div className="flex justify-center py-12"><CircularProgress size={28} /></div>
          : error ? <div className="text-center py-10 text-sm text-red-600 font-semibold">{error}</div>
          : !data ? null
          : (
            <>
              <div className="flex flex-wrap gap-6 mb-3 text-sm">
                <div><span className="text-slate-500">Opening</span> <b className="text-slate-800">{rupees(data.openingPaise)}</b></div>
                <div><span className="text-slate-500">Debits</span> <b className="text-slate-800">{rupees(data.totalDebitPaise)}</b></div>
                <div><span className="text-slate-500">Credits</span> <b className="text-slate-800">{rupees(data.totalCreditPaise)}</b></div>
                <div><span className="text-slate-500">Closing</span> <b className="text-slate-800">{rupees(data.closingPaise)}</b></div>
              </div>
              {data.rows.length === 0 ? (
                <div className="text-center py-12 text-slate-400 text-sm font-semibold">No entries on this account in this period.</div>
              ) : (
                <TableContainer component={Paper} elevation={0} className="rounded-2xl border border-slate-200/60 overflow-x-auto">
                  <Table size="small" sx={{ minWidth: 640 }}>
                    <TableHead>
                      <TableRow>
                        <TableCell sx={{ fontWeight: 700 }}>Date</TableCell>
                        <TableCell sx={{ fontWeight: 700 }}>Voucher</TableCell>
                        <TableCell sx={{ fontWeight: 700 }}>Particulars</TableCell>
                        <TableCell sx={{ fontWeight: 700 }} align="right">Debit</TableCell>
                        <TableCell sx={{ fontWeight: 700 }} align="right">Credit</TableCell>
                        <TableCell sx={{ fontWeight: 700 }} align="right">Balance</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody className="bg-white">
                      {data.rows.map((r, i) => (
                        <TableRow key={i}>
                          <TableCell className="font-mono text-xs text-slate-500">{shortDate(r.entryDate)}</TableCell>
                          <TableCell className="font-mono text-xs font-bold text-slate-700">{r.voucherNumber}</TableCell>
                          <TableCell className="text-slate-600 text-sm">{r.description || r.narration || r.voucherType}</TableCell>
                          <TableCell align="right" className="font-mono text-slate-700">{r.debitPaise ? rupees(r.debitPaise) : '—'}</TableCell>
                          <TableCell align="right" className="font-mono text-emerald-700">{r.creditPaise ? rupees(r.creditPaise) : '—'}</TableCell>
                          <TableCell align="right" className="font-mono font-bold text-slate-800">{rupees(r.balancePaise)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              )}
            </>
          )}
      </DialogContent>
    </Dialog>
  );
}
