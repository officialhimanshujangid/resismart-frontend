'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';
import { CircularProgress, Button, Alert, LinearProgress, Chip } from '@mui/material';
import { CheckCircle2, Circle, ArrowRight, ClipboardList, Lock } from 'lucide-react';
import PageHeader from '@/components/common/PageHeader';
import { useToastConfirm } from '@/context/ToastConfirmContext';

/**
 * What is still unanswered before the operations side is worth using.
 *
 * The finance module has this and operations did not, which is how a society
 * ended up with a gate console, a staff roll and a complaints desk all switched
 * on and none of them configured — every visitor logged against no gate, every
 * complaint routed to nobody, every permission inert because no staff member
 * had a login.
 *
 * Deliberately a checklist rather than a wizard. Nothing here has to be done in
 * order, some of it is genuinely optional, and a society that already has a
 * working gate should be able to read this without being marched through it.
 */

interface Step {
  key: string;
  module?: string;
  title: string;
  why: string;
  done: boolean;
  href: string;
  optional?: boolean;
}
interface State {
  ready: boolean;
  blocking: boolean;
  steps: Step[];
  entriesEverRecorded: number;
}

export default function OperationsSetupPage() {
  const router = useRouter();
  const { showToast } = useToastConfirm();
  const [loading, setLoading] = useState(true);
  const [state, setState] = useState<State | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await api.get('/gate/setup');
        setState(res.data?.data || null);
      } catch (e: any) {
        showToast(e.response?.data?.message || 'Could not load the checklist', 'error');
      } finally { setLoading(false); }
    })();
    /* eslint-disable-next-line react-hooks/exhaustive-deps */
  }, []);

  if (loading) return <div className="flex justify-center py-24"><CircularProgress /></div>;
  if (!state) return null;

  const required = state.steps.filter(s => !s.optional);
  const doneCount = required.filter(s => s.done).length;
  const pct = required.length ? Math.round((doneCount / required.length) * 100) : 100;

  return (
    <div className="space-y-4 pb-24 max-w-3xl">
      <PageHeader
        breadcrumb="Operations"
        title="Setting up operations"
        icon={<ClipboardList className="w-4.5 h-4.5" />}
        subtitle="A handful of questions that decide whether the gate, the staff roll and the complaints desk actually work. Nothing here has to be done in order."
      />

      {state.ready ? (
        <Alert severity="success" icon={<CheckCircle2 className="w-5 h-5" />} className="!rounded-2xl !text-sm">
          Everything needed is answered. Anything still unticked below is optional.
        </Alert>
      ) : state.blocking ? (
        <Alert severity="warning" icon={<Lock className="w-5 h-5" />} className="!rounded-2xl !text-sm">
          <strong>The gate console will refuse the first entry until a gate is named.</strong>{' '}
          That is the one thing enforced here — a register that cannot say which door somebody
          used is worth very little, and it cannot be fixed afterwards. Everything else on this
          list is advice.
        </Alert>
      ) : (
        <Alert severity="info" className="!rounded-2xl !text-sm">
          This society has already recorded <strong>{state.entriesEverRecorded}</strong> gate{' '}
          {state.entriesEverRecorded === 1 ? 'entry' : 'entries'}, so nothing here is blocking you.
          The unanswered items below are still worth finishing — each one is something the software
          currently cannot do for you.
        </Alert>
      )}

      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-xs">
          <span className="font-bold text-slate-600">{doneCount} of {required.length} answered</span>
          <span className="text-slate-400">{pct}%</span>
        </div>
        <LinearProgress variant="determinate" value={pct}
          className="!h-2 !rounded-full !bg-slate-100" />
      </div>

      <div className="space-y-2">
        {state.steps.map(s => (
          <button key={s.key} onClick={() => router.push(s.href)}
            className={`w-full text-left rounded-2xl border p-4 transition-all hover:border-slate-300 ${
              s.done ? 'border-slate-200/70 bg-white' : 'border-slate-300 bg-slate-50/60'
            }`}>
            <div className="flex items-start gap-3">
              {s.done
                ? <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" />
                : <Circle className="w-5 h-5 text-slate-300 shrink-0 mt-0.5" />}
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className={`font-bold text-sm ${s.done ? 'text-slate-500' : 'text-slate-900'}`}>
                    {s.title}
                  </p>
                  {s.optional && (
                    <Chip size="small" label="optional" className="!bg-slate-100 !text-slate-500 !font-bold !text-[10px] !h-4" />
                  )}
                  {s.module && (
                    <Chip size="small" label={s.module.toLowerCase()} className="!bg-indigo-50 !text-indigo-600 !font-bold !text-[10px] !h-4" />
                  )}
                </div>
                <p className="text-xs text-slate-600 mt-1 leading-relaxed">{s.why}</p>
              </div>
              <ArrowRight className="w-4 h-4 text-slate-300 shrink-0 mt-0.5" />
            </div>
          </button>
        ))}
      </div>

      <div className="flex justify-end pt-2">
        <Button variant="outlined" onClick={() => router.push('/dashboard/gate/settings')}
          className="!rounded-xl !normal-case !font-bold">
          Operations settings
        </Button>
      </div>
    </div>
  );
}
