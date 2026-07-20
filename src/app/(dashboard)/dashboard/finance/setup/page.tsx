'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import api from '@/lib/api';
import {
  Paper, Button, TextField, CircularProgress, Select, MenuItem, FormControl,
  IconButton, Checkbox, FormControlLabel, Chip, Autocomplete, ToggleButton, ToggleButtonGroup,
} from '@mui/material';
import {
  Landmark, Users, Truck, PiggyBank, ShieldCheck, Plus, Trash2, Check,
  AlertTriangle, Scale, Lock, Unlock, ArrowRight, Upload, SlidersHorizontal, Info,
} from 'lucide-react';
import { useToastConfirm } from '@/context/ToastConfirmContext';
import BulkImportPanel from '@/components/finance/BulkImportPanel';

/**
 * "Where do this society's books start?" — asked once, and answerable with
 * "nothing", which is the honest answer for most new societies.
 *
 * The design point worth preserving: this screen does not demand data, it
 * demands an ANSWER. A society with no vendors ticks a box and moves on. What
 * it must not be able to do is skip the question, because a balance sheet built
 * on an unstated opening position is wrong in a way nobody notices for a year.
 */

type Section = 'BANK_CASH' | 'FLAT_DUES' | 'VENDOR_DUES' | 'FUNDS' | 'DEPOSITS';

interface Account { _id: string; code: string; name: string; type: string; normalBalance: string }
interface VendorLite { _id: string; name: string; phone?: string }
interface SetupState {
  complete: boolean;
  completedAt?: string;
  completedByName?: string;
  declaredEmpty: Section[];
  openingVoucherId?: string;
  inferredFrom?: string;
  canReopen: boolean;
  /** False for a committee member: they may read this screen but not finish it. */
  canComplete: boolean;
  accounts: Account[];
  vendors: VendorLite[];
  progress: { flats: number; invoices: number };
}

const rupees = (p: number) => `₹${(p / 100).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
const toPaise = (v: string) => Math.round(parseFloat(v || '0') * 100) || 0;

const SECTION_LABEL: Record<Section, string> = {
  BANK_CASH: 'Bank & cash',
  FLAT_DUES: 'Member dues',
  VENDOR_DUES: 'Vendor dues',
  FUNDS: 'Fund balances',
  DEPOSITS: 'Deposits held',
};

function SectionCard({
  icon, title, hint, empty, onEmptyChange, emptyLabel, children,
}: {
  icon: React.ReactNode; title: string; hint: string;
  empty: boolean; onEmptyChange: (v: boolean) => void; emptyLabel: string;
  children: React.ReactNode;
}) {
  return (
    <Paper elevation={0} className="rounded-2xl border border-slate-200/70 overflow-hidden">
      <div className="p-4 border-b border-slate-100 bg-slate-50/60 flex items-start gap-3">
        <div className="p-2 rounded-xl bg-white border border-slate-200 shrink-0">{icon}</div>
        <div className="flex-1 min-w-0">
          <p className="font-bold text-slate-800 text-sm">{title}</p>
          <p className="text-xs text-slate-500 mt-0.5">{hint}</p>
        </div>
        {empty && <Chip size="small" label="Nothing here" className="!bg-slate-200 !text-slate-600 !font-bold !text-[10px]" />}
      </div>
      <div className="p-4 space-y-3">
        <FormControlLabel
          control={<Checkbox size="small" checked={empty} onChange={e => onEmptyChange(e.target.checked)} />}
          label={<span className="text-xs font-semibold text-slate-600">{emptyLabel}</span>}
        />
        {!empty && <div className="space-y-3 pt-1">{children}</div>}
      </div>
    </Paper>
  );
}

/**
 * Rows of "pick an account, type an amount".
 *
 * MUST stay at module scope. Defined inside the page component it gets a new
 * function identity on every render, so React tears the subtree down and mounts
 * a fresh one instead of reconciling — and the input loses focus after every
 * single keystroke. Entering ₹1,50,000 then takes six clicks.
 */
function AccountRows({
  rows, setRows, options, label,
}: {
  rows: { accountCode: string; amount: string }[];
  setRows: (r: { accountCode: string; amount: string }[]) => void;
  options: Account[]; label: string;
}) {
  // Never a hard-coded code: a society whose chart of accounts is numbered
  // differently would get a blank Select with no clue what it will post to.
  const fallback = options[0]?.code || '';
  return (
    <>
      {rows.map((r, i) => (
        <div key={i} className="flex gap-2 items-center">
          <FormControl size="small" className="flex-1">
            <Select
              value={options.some(a => a.code === r.accountCode) ? r.accountCode : ''}
              onChange={e => setRows(rows.map((x, j) => j === i ? { ...x, accountCode: e.target.value } : x))}
              className="!rounded-xl" displayEmpty
            >
              <MenuItem value="" disabled><em className="text-slate-400">Choose an account</em></MenuItem>
              {options.map(a => <MenuItem key={a._id} value={a.code}>{a.code} — {a.name}</MenuItem>)}
            </Select>
          </FormControl>
          <TextField
            size="small" type="number" placeholder="0.00" value={r.amount}
            onChange={e => setRows(rows.map((x, j) => j === i ? { ...x, amount: e.target.value } : x))}
            className="w-40"
            slotProps={{ input: { className: '!rounded-xl' }, htmlInput: { min: 0, step: '0.01' } }}
          />
          <IconButton size="small" onClick={() => setRows(rows.filter((_, j) => j !== i))}>
            <Trash2 className="w-4 h-4 text-slate-400" />
          </IconButton>
        </div>
      ))}
      {!options.length ? (
        <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-xl p-2.5">
          No suitable account exists yet. Add one in Chart of Accounts, or tick &ldquo;nothing here&rdquo;.
        </p>
      ) : (
        <Button size="small" startIcon={<Plus className="w-3.5 h-3.5" />}
          onClick={() => setRows([...rows, { accountCode: fallback, amount: '' }])}
          className="!normal-case !font-bold !text-xs">
          {label}
        </Button>
      )}
    </>
  );
}

type Tab = 'position' | 'import' | 'advanced';

export default function FinanceSetupPage() {
  const { showToast, confirm } = useToastConfirm();
  const router = useRouter();
  const searchParams = useSearchParams();

  // Honours ?tab=import so the retired Bulk Import route can redirect straight
  // to the right place rather than dumping people on the first tab.
  const [tab, setTab] = useState<Tab>(() => {
    const t = searchParams.get('tab');
    return t === 'import' || t === 'advanced' ? t : 'position';
  });

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [state, setState] = useState<SetupState | null>(null);
  const [loadError, setLoadError] = useState('');

  const [entryDate, setEntryDate] = useState('');
  const [emptySections, setEmptySections] = useState<Set<Section>>(new Set());
  const [bankCash, setBankCash] = useState<{ accountCode: string; amount: string }[]>([]);
  const [vendorDues, setVendorDues] = useState<{ vendorId: string; amount: string }[]>([]);
  const [funds, setFunds] = useState<{ accountCode: string; amount: string }[]>([]);
  const [deposits, setDeposits] = useState<{ accountCode: string; amount: string }[]>([]);

  const load = async () => {
    try {
      const res = await api.get('/finance/society/setup');
      const d: SetupState = res.data?.data;
      setState(d);
      const initial = new Set(d.declaredEmpty || []);
      // A society that already has invoices has answered the dues question by
      // having them — don't make it tick a box that contradicts its own data.
      if (d.progress?.invoices > 0) initial.delete('FLAT_DUES');
      setEmptySections(initial);
      // Start with one bank row, using whatever this society's first asset
      // account actually is.
      const firstAsset = (d.accounts || []).find(a => a.type === 'ASSET');
      if (firstAsset) setBankCash([{ accountCode: firstAsset.code, amount: '' }]);
    } catch (e: any) {
      setLoadError(e.response?.data?.message || 'Could not load setup');
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  const accounts = state?.accounts || [];
  const byType = (t: string) => accounts.filter(a => a.type === t);
  const assetAccounts = byType('ASSET');
  const equityAccounts = byType('EQUITY');
  const liabilityAccounts = byType('LIABILITY');

  const toggleEmpty = (s: Section, v: boolean) =>
    setEmptySections(prev => { const n = new Set(prev); v ? n.add(s) : n.delete(s); return n; });

  const sum = (rows: { amount: string }[]) => rows.reduce((t, r) => t + toPaise(r.amount), 0);
  const debitPaise = emptySections.has('BANK_CASH') ? 0 : sum(bankCash);
  const creditPaise =
    (emptySections.has('VENDOR_DUES') ? 0 : sum(vendorDues)) +
    (emptySections.has('FUNDS') ? 0 : sum(funds)) +
    (emptySections.has('DEPOSITS') ? 0 : sum(deposits));
  const balancing = debitPaise - creditPaise;

  /** Every section must be answered — with figures or with a tick. */
  const unanswered = useMemo(() => {
    const answered = new Set<Section>(emptySections);
    if (!emptySections.has('BANK_CASH') && sum(bankCash) > 0) answered.add('BANK_CASH');
    // A row with an amount but no vendor chosen is DROPPED on submit, so
    // counting it as answered lets ₹50,000 of payables vanish behind a success
    // toast — the exact understated-Creditors outcome this section warns about.
    if (!emptySections.has('VENDOR_DUES') && sum(vendorDues.filter(v => v.vendorId)) > 0) answered.add('VENDOR_DUES');
    if (!emptySections.has('FUNDS') && sum(funds) > 0) answered.add('FUNDS');
    if (!emptySections.has('DEPOSITS') && sum(deposits) > 0) answered.add('DEPOSITS');
    if ((state?.progress?.invoices || 0) > 0) answered.add('FLAT_DUES');
    return (['BANK_CASH', 'FLAT_DUES', 'VENDOR_DUES', 'FUNDS', 'DEPOSITS'] as Section[])
      .filter(s => !answered.has(s));
  }, [emptySections, bankCash, vendorDues, funds, deposits, state]);

  const submit = async () => {
    setSaving(true);
    try {
      await api.post('/finance/society/setup/complete', {
        entryDate: entryDate || undefined,
        bankCash: emptySections.has('BANK_CASH') ? [] :
          bankCash.filter(r => toPaise(r.amount) > 0).map(r => ({ accountCode: r.accountCode, amountPaise: toPaise(r.amount) })),
        vendorDues: emptySections.has('VENDOR_DUES') ? [] :
          vendorDues.filter(r => toPaise(r.amount) > 0 && r.vendorId).map(r => ({ vendorId: r.vendorId, amountPaise: toPaise(r.amount) })),
        funds: emptySections.has('FUNDS') ? [] :
          funds.filter(r => toPaise(r.amount) > 0).map(r => ({ accountCode: r.accountCode, amountPaise: toPaise(r.amount) })),
        deposits: emptySections.has('DEPOSITS') ? [] :
          deposits.filter(r => toPaise(r.amount) > 0).map(r => ({ accountCode: r.accountCode, amountPaise: toPaise(r.amount) })),
        declaredEmpty: [...emptySections],
      });
      showToast('Opening position recorded. Finance is open.', 'success');
      await load();
      router.push('/dashboard/finance/overview');
    } catch (e: any) {
      showToast(e.response?.data?.message || 'Could not complete setup', 'error');
    } finally { setSaving(false); }
  };

  const reopen = async () => {
    const yes = await confirm({
      title: 'Reopen setup?',
      message: 'You will be able to state the opening position again. Any opening voucher already posted stays on the books — reverse it separately if it was wrong.',
      confirmText: 'Reopen',
    });
    if (!yes) return;
    try {
      await api.post('/finance/society/setup/reopen');
      showToast('Setup reopened', 'success');
      await load();
    } catch (e: any) {
      showToast(e.response?.data?.message || 'Could not reopen', 'error');
    }
  };

  if (loading) return <div className="flex justify-center py-24"><CircularProgress size={28} /></div>;

  // Without this the page falls through to the form with an empty chart of
  // accounts — every dropdown blank, and a Confirm button that cannot succeed.
  if (!state) {
    return (
      <div className="max-w-md mx-auto mt-16 text-center">
        <AlertTriangle className="w-8 h-8 text-amber-500 mx-auto" />
        <p className="mt-3 font-bold text-slate-800">Could not load setup</p>
        <p className="mt-1 text-sm text-slate-600">{loadError}</p>
        <Button variant="outlined" className="!mt-4 !rounded-xl !normal-case !font-bold"
          onClick={() => { setLoading(true); setLoadError(''); load(); }}>
          Try again
        </Button>
      </div>
    );
  }

  // ------------------------------------------------------------------ the hub
  //
  // One place for every "where do these books start?" question. This used to be
  // three separate sidebar entries — Setup, Opening Balances and Bulk Import —
  // which meant a treasurer setting a society up was bounced between them
  // trying to work out which one they were supposed to be in.
  const hub = (body: React.ReactNode) => (
    <div className="max-w-3xl mx-auto space-y-5 pb-32">
      <div>
        <h1 className="text-xl font-black text-slate-900">Setup &amp; opening balances</h1>
        <p className="text-sm text-slate-600 mt-1.5 leading-relaxed">
          Everything a society needs to say once, before it starts billing.
        </p>
      </div>

      <ToggleButtonGroup exclusive size="small" value={tab}
        onChange={(_, v) => v && setTab(v)} className="!rounded-xl !flex-wrap">
        <ToggleButton value="position" className="!rounded-l-xl !normal-case !font-bold !text-xs !px-4">
          <Scale className="w-3.5 h-3.5 mr-1.5" /> Opening position
        </ToggleButton>
        <ToggleButton value="import" className="!normal-case !font-bold !text-xs !px-4">
          <Upload className="w-3.5 h-3.5 mr-1.5" /> Import data
        </ToggleButton>
        <ToggleButton value="advanced" className="!rounded-r-xl !normal-case !font-bold !text-xs !px-4">
          <SlidersHorizontal className="w-3.5 h-3.5 mr-1.5" /> Advanced
        </ToggleButton>
      </ToggleButtonGroup>

      {tab === 'position' && body}

      {tab === 'import' && (
        <div className="space-y-3">
          <div className="rounded-xl bg-sky-50 border border-sky-200 p-3 flex items-start gap-2">
            <Info className="w-4 h-4 text-sky-600 shrink-0 mt-0.5" />
            <p className="text-xs text-sky-900">
              Import your flats first, then members, then opening dues — each one needs the one
              before it. <strong>The downloaded template has dropdowns</strong> for wings, sizes
              and status, so you pick rather than type.
            </p>
          </div>
          <BulkImportPanel />
        </div>
      )}

      {tab === 'advanced' && (
        <Paper elevation={0} className="rounded-2xl border border-slate-200/70 p-5 space-y-4">
          <div>
            <p className="font-bold text-slate-800 text-sm">Post the opening entry by hand</p>
            <p className="text-xs text-slate-500 mt-1 leading-relaxed">
              For a treasurer who knows double-entry and wants to write the voucher themselves,
              rather than answering the questions above. Most societies never need this.
            </p>
            <Button size="small" variant="outlined" className="!mt-3 !rounded-xl !normal-case !font-bold"
              onClick={() => router.push('/dashboard/finance/opening-balances')}>
              Manual opening balances
            </Button>
          </div>
          <div className="pt-4 border-t border-slate-100">
            <p className="font-bold text-slate-800 text-sm">Chart of accounts</p>
            <p className="text-xs text-slate-500 mt-1 leading-relaxed">
              Add an account before you state what is in it — a bank you hold that is not on the
              standard list, for instance.
            </p>
            <Button size="small" variant="outlined" className="!mt-3 !rounded-xl !normal-case !font-bold"
              onClick={() => router.push('/dashboard/finance/chart-of-accounts')}>
              Chart of accounts
            </Button>
          </div>
        </Paper>
      )}
    </div>
  );

  // ---------------------------------------------------------------- done view
  if (state?.complete) {
    return hub(
      <div className="space-y-4">
        <Paper elevation={0} className="rounded-2xl border border-slate-200/70 p-6">
          <div className="flex items-start gap-4">
            <div className="p-3 rounded-2xl bg-emerald-50 border border-emerald-200">
              <ShieldCheck className="w-6 h-6 text-emerald-600" />
            </div>
            <div className="flex-1">
              <h1 className="font-bold text-slate-900">Finance setup is complete</h1>
              {state.inferredFrom ? (
                <p className="text-sm text-slate-600 mt-1 leading-relaxed">
                  This society was already recording transactions before this step existed, so its
                  starting point was taken from its <strong>first entry on{' '}
                  {new Date(state.inferredFrom).toLocaleDateString('en-IN')}</strong>. Nothing was
                  lost — but nobody has stated what the society actually held on day one. You can
                  still do that below.
                </p>
              ) : (
                <p className="text-sm text-slate-600 mt-1">
                  Recorded{state.completedByName ? ` by ${state.completedByName}` : ''}
                  {state.completedAt ? ` on ${new Date(state.completedAt).toLocaleDateString('en-IN')}` : ''}.
                </p>
              )}

              {!!state.declaredEmpty?.length && (
                <div className="mt-3 flex flex-wrap gap-1.5">
                  <span className="text-[10px] font-black uppercase tracking-wider text-slate-500 self-center mr-1">
                    Declared nothing:
                  </span>
                  {state.declaredEmpty.map(s => (
                    <Chip key={s} size="small" label={SECTION_LABEL[s]} className="!text-[10px] !font-semibold" />
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="mt-5 pt-4 border-t border-slate-100 flex items-center justify-between gap-3">
            <p className="text-xs text-slate-500 flex items-center gap-1.5">
              {state.canReopen ? <Unlock className="w-3.5 h-3.5" /> : <Lock className="w-3.5 h-3.5" />}
              {state.canReopen
                ? 'Nothing has been posted on top of this yet, so it can still be changed.'
                : 'Entries sit on top of this. Correct it with a reversal, not a rewrite.'}
            </p>
            {state.canReopen && (
              <Button size="small" variant="outlined" onClick={reopen} className="!rounded-xl !normal-case !font-bold shrink-0">
                {state.inferredFrom ? 'State opening position' : 'Reopen'}
              </Button>
            )}
          </div>
        </Paper>

        <Button
          variant="contained" endIcon={<ArrowRight className="w-4 h-4" />}
          className="!rounded-xl !normal-case !font-bold"
          onClick={() => router.push('/dashboard/finance/overview')}
        >
          Go to finance
        </Button>
      </div>
    );
  }

  // --------------------------------------------------------------- setup form
  return hub(
    <div className="space-y-5">
      <p className="text-sm text-slate-600 leading-relaxed">
        Asked once. If the society is brand new the answer is <strong>&ldquo;nothing&rdquo;</strong> —
        tick the boxes and you are done. If it has been running on paper, enter what it held
        on the day these books begin.
      </p>

      <Paper elevation={0} className="rounded-2xl border border-slate-200/70 p-4">
        <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">Books begin on</span>
        <TextField
          type="date" size="small" fullWidth value={entryDate}
          onChange={e => setEntryDate(e.target.value)}
          className="!mt-1.5" slotProps={{ input: { className: '!rounded-xl' } }}
        />
        <p className="text-xs text-slate-500 mt-2">Usually the first day of the financial year. Leave blank for today.</p>
      </Paper>

      <SectionCard
        icon={<Landmark className="w-4 h-4 text-slate-600" />}
        title="Bank & cash" hint="What was actually in the accounts on that day."
        empty={emptySections.has('BANK_CASH')} onEmptyChange={v => toggleEmpty('BANK_CASH', v)}
        emptyLabel="We had no bank or cash balance"
      >
        <AccountRows rows={bankCash} setRows={setBankCash} options={assetAccounts} label="Add account" />
      </SectionCard>

      <SectionCard
        icon={<Users className="w-4 h-4 text-slate-600" />}
        title="Member dues" hint="What members already owed. These come in through Bulk Import, which creates the opening invoices."
        empty={emptySections.has('FLAT_DUES')} onEmptyChange={v => toggleEmpty('FLAT_DUES', v)}
        emptyLabel="No member owed anything"
      >
        <div className="rounded-xl bg-slate-50 border border-slate-200 p-3 flex items-center justify-between gap-3">
          <p className="text-xs text-slate-600">
            {state?.progress?.invoices
              ? `${state.progress.invoices} invoice(s) already exist — dues are recorded.`
              : 'No invoices yet. Import opening dues to record them per flat.'}
          </p>
          <Button size="small" variant="outlined"
            onClick={() => router.push('/dashboard/finance/bulk-import')}
            className="!rounded-xl !normal-case !font-bold !text-xs shrink-0">
            Bulk import
          </Button>
        </div>
      </SectionCard>

      <SectionCard
        icon={<Truck className="w-4 h-4 text-slate-600" />}
        title="Vendor dues" hint="What the society already owed suppliers. Without this, Creditors is understated and the society looks richer than it is."
        empty={emptySections.has('VENDOR_DUES')} onEmptyChange={v => toggleEmpty('VENDOR_DUES', v)}
        emptyLabel="We owed no vendor anything"
      >
        {!state?.vendors?.length ? (
          <div className="rounded-xl bg-amber-50 border border-amber-200 p-3 flex items-center justify-between gap-3">
            <p className="text-xs text-amber-800">No vendors yet. Add them first, or tick the box above.</p>
            <Button size="small" variant="outlined"
              onClick={() => router.push('/dashboard/finance/vendors')}
              className="!rounded-xl !normal-case !font-bold !text-xs shrink-0">
              Vendors
            </Button>
          </div>
        ) : (
          <>
            {vendorDues.map((r, i) => (
              <div key={i} className="flex gap-2 items-center">
                <Autocomplete
                  size="small" className="flex-1"
                  options={state.vendors}
                  getOptionLabel={v => v.name}
                  value={state.vendors.find(v => v._id === r.vendorId) || null}
                  onChange={(_, v) => setVendorDues(vendorDues.map((x, j) => j === i ? { ...x, vendorId: v?._id || '' } : x))}
                  renderInput={p => <TextField {...p} placeholder="Vendor" />}
                />
                <TextField
                  size="small" type="number" placeholder="0.00" value={r.amount}
                  onChange={e => setVendorDues(vendorDues.map((x, j) => j === i ? { ...x, amount: e.target.value } : x))}
                  className="w-40" slotProps={{ input: { className: '!rounded-xl' } }}
                />
                <IconButton size="small" onClick={() => setVendorDues(vendorDues.filter((_, j) => j !== i))}>
                  <Trash2 className="w-4 h-4 text-slate-400" />
                </IconButton>
              </div>
            ))}
            <Button size="small" startIcon={<Plus className="w-3.5 h-3.5" />}
              onClick={() => setVendorDues([...vendorDues, { vendorId: '', amount: '' }])}
              className="!normal-case !font-bold !text-xs">
              Add vendor
            </Button>
          </>
        )}
      </SectionCard>

      <SectionCard
        icon={<PiggyBank className="w-4 h-4 text-slate-600" />}
        title="Fund balances" hint="Corpus, sinking and repair reserves already accumulated."
        empty={emptySections.has('FUNDS')} onEmptyChange={v => toggleEmpty('FUNDS', v)}
        emptyLabel="No fund had a balance"
      >
        <AccountRows rows={funds} setRows={setFunds} options={equityAccounts} label="Add fund" />
      </SectionCard>

      <SectionCard
        icon={<ShieldCheck className="w-4 h-4 text-slate-600" />}
        title="Deposits held" hint="Refundable deposits taken from members or contractors."
        empty={emptySections.has('DEPOSITS')} onEmptyChange={v => toggleEmpty('DEPOSITS', v)}
        emptyLabel="We held no deposits"
      >
        <AccountRows rows={deposits} setRows={setDeposits} options={liabilityAccounts} label="Add deposit" />
      </SectionCard>

      {/* --------------------------------------------------- the running total */}
      <Paper elevation={0} className="rounded-2xl border border-slate-200/70 p-4 sticky bottom-4 bg-white shadow-lg">
        <div className="flex items-center gap-2 mb-3">
          <Scale className="w-4 h-4 text-slate-500" />
          <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">Running total</span>
        </div>
        <div className="grid grid-cols-3 gap-3 text-center">
          <div><p className="text-[10px] text-slate-500 font-bold uppercase">Debits</p><p className="font-black text-slate-800">{rupees(debitPaise)}</p></div>
          <div><p className="text-[10px] text-slate-500 font-bold uppercase">Credits</p><p className="font-black text-slate-800">{rupees(creditPaise)}</p></div>
          <div>
            <p className="text-[10px] text-slate-500 font-bold uppercase">To 3900</p>
            <p className="font-black text-indigo-600">{rupees(Math.abs(balancing))}</p>
          </div>
        </div>
        <p className="text-[11px] text-slate-500 mt-2 text-center">
          The difference goes to <strong>Opening Balance Equity</strong> automatically — you do not have to make it balance.
        </p>

        {!state.canComplete && (
          <div className="mt-3 rounded-xl bg-slate-100 border border-slate-200 p-3 flex items-start gap-2">
            <Lock className="w-4 h-4 text-slate-500 shrink-0 mt-0.5" />
            <p className="text-xs text-slate-700">
              Only a <strong>society admin</strong> can record the opening position. You can review it here,
              but the admin has to confirm it.
            </p>
          </div>
        )}

        {unanswered.length > 0 && (
          <div className="mt-3 rounded-xl bg-amber-50 border border-amber-200 p-3 flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <p className="text-xs text-amber-800">
              Nothing said about <strong>{unanswered.map(s => SECTION_LABEL[s]).join(', ')}</strong>.
              Enter a figure or tick &ldquo;nothing here&rdquo;.
            </p>
          </div>
        )}

        <Button
          fullWidth variant="contained" disabled={saving || unanswered.length > 0 || !state.canComplete}
          startIcon={saving ? <CircularProgress size={16} color="inherit" /> : <Check className="w-4 h-4" />}
          onClick={submit}
          className="!mt-3 !rounded-xl !normal-case !font-bold !py-2.5"
        >
          {saving ? 'Recording…' : 'Confirm and open finance'}
        </Button>
      </Paper>
    </div>
  );
}
