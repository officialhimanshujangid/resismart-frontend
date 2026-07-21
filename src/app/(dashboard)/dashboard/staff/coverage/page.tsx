'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';
import { Alert, Button, Tooltip, Chip } from '@mui/material';
import { Users, AlertTriangle, ArrowRight, CheckCircle2 } from 'lucide-react';
import PageHeader from '@/components/common/PageHeader';
import PageSkeleton from '@/components/common/PageSkeleton';
import ErrorState from '@/components/common/ErrorState';
import { useToastConfirm } from '@/context/ToastConfirmContext';

/**
 * Who covers what — and what nobody covers.
 *
 * Complaint routing walks primary → backup → society-wide and then gives up,
 * parking the complaint unassigned. That is the right behaviour and it is
 * completely silent: a society only learns that nobody does LIFT for C wing
 * when a lift complaint has sat for a week.
 *
 * A grid, on purpose. The gaps are what you are here to see, and a hole in a
 * grid is visible at a glance in a way that no list of assignments ever is.
 */

interface Cell {
  category: string;
  scopeKey: string;
  scopeLabel: string;
  primary: { staffId: string; staffName: string }[];
  backup: { staffId: string; staffName: string }[];
}
interface Matrix {
  categories: string[];
  scopes: { key: string; label: string }[];
  cells: Cell[];
  gaps: { category: string; scopeKey: string; scopeLabel: string }[];
}

const CAT_LABEL: Record<string, string> = {
  PLUMBING: 'Plumbing', ELECTRICAL: 'Electrical', GARDEN: 'Garden', CLEANING: 'Cleaning',
  LIFT: 'Lift', SECURITY: 'Security', CARPENTRY: 'Carpentry', OTHER: 'Other',
};

export default function CoveragePage() {
  const router = useRouter();
  const { showToast } = useToastConfirm();
  const [loading, setLoading] = useState(true);
  const [m, setM] = useState<Matrix | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/staff/coverage');
      setM(res.data?.data || null);
    } catch (e: any) {
      showToast(e.response?.data?.message || 'Could not work out who covers what', 'error');
    } finally { setLoading(false); }
  }, [showToast]);

  useEffect(() => { load(); }, [load]);

  if (loading) return <PageSkeleton />;
  // This used to `return null`, which renders a blank white page — the same
  // thing a society with no staff at all would see, so a failure was
  // indistinguishable from "you have nobody".
  if (!m) return <ErrorState message="Who covers what could not be worked out." onRetry={load} />;

  const at = (category: string, scopeKey: string) =>
    m.cells.find(c => c.category === category && c.scopeKey === scopeKey);

  const societyWide = (category: string) => (at(category, 'SOCIETY')?.primary.length || 0)
    + (at(category, 'SOCIETY')?.backup.length || 0) > 0;

  const isGap = (category: string, scopeKey: string) =>
    m.gaps.some(g => g.category === category && g.scopeKey === scopeKey);

  return (
    <div className="space-y-4 pb-24">
      <PageHeader
        breadcrumb="Operations · Staff"
        title="Who covers what"
        icon={<Users className="w-4.5 h-4.5" />}
        subtitle="Every kind of work against every wing. A complaint is offered to the wing's primary, then its backup, then anyone covering the whole society — and if all three are empty it reaches nobody."
        actions={
          <Button variant="outlined" endIcon={<ArrowRight className="w-4 h-4" />}
            onClick={() => router.push('/dashboard/staff')}
          >Manage staff</Button>
        }
      />

      {m.gaps.length === 0 ? (
        <Alert severity="success" icon={<CheckCircle2 className="w-5 h-5" />} sx={{ borderRadius: '16px', fontSize: 14 }}>
          Every kind of work has somebody for every wing. No complaint will land unassigned.
        </Alert>
      ) : (
        <Alert severity="warning" icon={<AlertTriangle className="w-5 h-5" />} sx={{ borderRadius: '16px', fontSize: 14 }}>
          <strong>{m.gaps.length} {m.gaps.length === 1 ? 'gap' : 'gaps'}.</strong>{' '}
          A complaint raised for any of these reaches nobody and waits in the unassigned queue until
          somebody notices. Assign a staff member from their profile, or give one person the whole society.
        </Alert>
      )}

      <div className="overflow-x-auto rounded-2xl border border-slate-200/60 bg-white shadow-sm">
        <table className="w-full border-collapse min-w-[720px]">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200/60">
              <th className="text-left font-black text-slate-700 text-xs uppercase tracking-wider px-4 py-3 sticky left-0 bg-slate-50 z-10">
                Work
              </th>
              {m.scopes.map(s => (
                <th key={s.key}
                  className={`text-left font-bold text-xs px-4 py-3 whitespace-nowrap ${
                    s.key === 'SOCIETY' ? 'text-slate-700' : 'text-slate-500'}`}>
                  {s.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {m.categories.map(cat => (
              <tr key={cat} className="border-b border-slate-100 last:border-0 hover:bg-slate-50/40">
                <td className="px-4 py-3 font-bold text-slate-800 text-sm sticky left-0 bg-white z-10 whitespace-nowrap">
                  {CAT_LABEL[cat] || cat}
                </td>
                {m.scopes.map(s => {
                  const cell = at(cat, s.key);
                  const gap = isGap(cat, s.key);
                  const coveredByWide = s.key !== 'SOCIETY' && !cell?.primary.length && !cell?.backup.length && societyWide(cat);
                  return (
                    <td key={s.key} className="px-4 py-3 align-top">
                      {gap ? (
                        <Tooltip title="Nobody. A complaint here waits unassigned.">
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-rose-600 bg-rose-50 rounded-lg px-2 py-1">
                            <AlertTriangle className="w-3 h-3" /> nobody
                          </span>
                        </Tooltip>
                      ) : coveredByWide ? (
                        <span className="text-[11px] text-slate-400 italic">covered society-wide</span>
                      ) : (
                        <div className="space-y-1">
                          {cell?.primary.map(p => (
                            <div key={p.staffId} className="text-xs font-bold text-slate-700">{p.staffName}</div>
                          ))}
                          {cell?.backup.map(b => (
                            <div key={b.staffId} className="text-[11px] text-slate-500">
                              {b.staffName} <Chip size="small" label="backup" sx={{ height: 16, fontSize: 9, bgcolor: "#f1f5f9", color: "#64748b" }} />
                            </div>
                          ))}
                        </div>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="text-[11px] text-slate-400">
        A person shown in bold is the wing&rsquo;s primary. Somebody covering the whole society catches
        anything a wing has nobody for, which is why those squares read &ldquo;covered society-wide&rdquo;
        rather than being counted as a gap.
      </p>
    </div>
  );
}
