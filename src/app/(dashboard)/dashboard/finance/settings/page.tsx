'use client';

import React, { useState, useEffect } from 'react';
import api from '@/lib/api';
import {
  Paper, Button, TextField, CircularProgress, Switch, FormControl, Select, MenuItem,
  FormControlLabel, IconButton, Tooltip,
} from '@mui/material';
import { CalendarRange, Percent, BellRing, ReceiptText, CheckCheck, Hash, Landmark, Plus, Trash2, Info, Lock, BadgePercent, LayoutGrid } from 'lucide-react';
import { useToastConfirm } from '@/context/ToastConfirmContext';

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const CHANNELS = [
  { v: 'EMAIL', l: 'Email' }, { v: 'SMS', l: 'SMS' }, { v: 'WHATSAPP', l: 'WhatsApp' }, { v: 'PUSH', l: 'App push' },
];

const Label = ({ children, hint }: { children: React.ReactNode; hint?: string }) => (
  <span className="text-[10px] font-black uppercase tracking-wider text-slate-500 flex items-center gap-1">
    {children}
    {hint && <Tooltip title={hint}><Info className="w-3 h-3 text-slate-400 cursor-help" /></Tooltip>}
  </span>
);
const Section = ({ icon, title, subtitle, children }: { icon: React.ReactNode; title: string; subtitle?: string; children: React.ReactNode }) => (
  <Paper elevation={0} className="p-5 rounded-2xl border border-slate-200/60 space-y-4">
    <div>
      <div className="flex items-center gap-2 text-slate-700 font-black text-sm">{icon}{title}</div>
      {subtitle && <p className="text-xs text-slate-500 mt-1">{subtitle}</p>}
    </div>
    {children}
  </Paper>
);

const rupees = (paise?: number) => ((paise || 0) / 100).toString();
const toPaise = (v: string) => Math.round(parseFloat(v || '0') * 100) || 0;

interface Slab { uptoDays: number; ratePercent: number }
interface ModuleInfo { key: string; label: string; blurb: string; pages: string[] }

export default function FinanceSettingsPage() {
  const { showToast } = useToastConfirm();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [p, setP] = useState<any>(null);

  const [catalog, setCatalog] = useState<ModuleInfo[]>([]);
  const [modules, setModules] = useState<string[]>([]);

  const load = async () => {
    try {
      setLoading(true);
      const [pol, mod] = await Promise.all([
        api.get('/finance/society/policy'),
        api.get('/finance/society/modules'),
      ]);
      setP(pol.data);
      setCatalog(mod.data.catalog || []);
      // The server decides once from the society's own data if nobody has chosen,
      // so this is always a real answer rather than a guess made here.
      setModules(mod.data.modules || []);
    } catch (e: any) { showToast(e.response?.data?.error || 'Failed to load', 'error'); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, []);

  const toggleModule = (key: string, on: boolean) =>
    setModules(prev => (on ? [...new Set([...prev, key])] : prev.filter(k => k !== key)));

  const upd = (section: string, patch: any) => setP((prev: any) => ({ ...prev, [section]: { ...prev[section], ...patch } }));
  const updNumbering = (doc: string, patch: any) =>
    setP((prev: any) => ({ ...prev, numbering: { ...prev.numbering, [doc]: { ...prev.numbering?.[doc], ...patch } } }));

  const slabs: Slab[] = p?.lateFee?.slabs || [];
  const setSlabs = (next: Slab[]) => upd('lateFee', { slabs: next });
  // The engine charges ₹0 for SLAB with no slabs, and the API now rejects it —
  // so block the save here rather than letting the server bounce it back.
  const slabsInvalid = p?.lateFee?.enabled && p?.lateFee?.mode === 'SLAB' && slabs.length === 0;

  const save = async () => {
    if (slabsInvalid) { showToast('Add at least one slab, or no interest would be charged at all', 'error'); return; }
    setSaving(true);
    try {
      await api.put('/finance/society/policy', {
        financialYear: p.financialYear,
        gstin: p.gstin,
        pan: p.pan,
        numbering: p.numbering,
        billing: p.billing,
        lateFee: p.lateFee,
        reminders: p.reminders,
        gst: p.gst,
        tds: p.tds,
        rounding: p.rounding,
        approvals: p.approvals,
        advance: p.advance,
        rebate: p.rebate,
        allocation: p.allocation,
        lock: p.lock,
        modules,
      });
      showToast('Finance settings saved', 'success');
      // Tell the sidebar its menu just changed. It only fetches modules on mount,
      // so without this a toggle appears to do nothing until the next hard reload —
      // which reads as broken, not as pending.
      window.dispatchEvent(new Event('finance-modules-changed'));
      load();
    } catch (e: any) { showToast(e.response?.data?.error || 'Failed to save', 'error'); }
    finally { setSaving(false); }
  };

  if (loading || !p) return <div className="flex justify-center p-12"><CircularProgress size={32} /></div>;

  return (
    <div className="space-y-6 animate-in fade-in duration-300 max-w-3xl pb-8">
      <div>
        <h1 className="text-2xl font-black text-slate-800 tracking-tight">Finance Settings</h1>
        <p className="text-sm text-slate-500 mt-0.5">Billing rules, penalties, reminders and tax — set to your society&apos;s own bye-laws</p>
      </div>

      {/* First, because it decides what the rest of the menu even shows. */}
      <Section icon={<LayoutGrid className="w-4 h-4" />} title="What your society uses"
        subtitle="Switch off what you don't need and it disappears from the menu. Nothing is deleted — turn it back on any time and the screen returns with its data.">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4">
          {catalog.map(m => (
            <div key={m.key} className="py-2 border-b border-slate-100 last:border-0">
              <FormControlLabel
                control={<Switch checked={modules.includes(m.key)} onChange={e => toggleModule(m.key, e.target.checked)} />}
                label={<span className="text-sm font-semibold text-slate-700">{m.label}</span>}
              />
              <p className="text-[11px] text-slate-500 ml-11 -mt-1">{m.blurb}</p>
            </div>
          ))}
        </div>
        <p className="text-[11px] text-amber-700 flex items-start gap-1 pt-1">
          <Info className="w-3 h-3 mt-0.5 shrink-0" />
          Hiding a screen never hides its money. If you&apos;ve already used Fixed Assets, its depreciation stays on the
          Balance Sheet whether the screen is showing or not.
        </p>
        <p className="text-[11px] text-slate-500">
          Bills, collections, confirmations, charge heads, reports and settings are always here — a society can&apos;t
          bill without them.
        </p>
      </Section>

      <Section icon={<CalendarRange className="w-4 h-4" />} title="Financial year & billing"
        subtitle="April–March is the Indian default. Bills can be raised automatically each month.">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="space-y-1"><Label>FY starts in</Label>
            <FormControl fullWidth size="small"><Select value={p.financialYear?.startMonth ?? 4} onChange={e => upd('financialYear', { startMonth: e.target.value })}>{MONTHS.map((m, i) => <MenuItem key={m} value={i + 1}>{m}</MenuItem>)}</Select></FormControl>
          </div>
          <div className="space-y-1"><Label>Auto-generate bills</Label>
            <FormControlLabel control={<Switch checked={p.billing?.autoGenerateEnabled || false} onChange={e => upd('billing', { autoGenerateEnabled: e.target.checked })} />} label={<span className="text-sm">{p.billing?.autoGenerateEnabled ? 'On' : 'Off'}</span>} />
          </div>
          <div className="space-y-1"><Label hint="Day of the month the bills are raised (1-28).">Generate on day</Label>
            <TextField hiddenLabel fullWidth size="small" type="number" value={p.billing?.generationDay ?? 1} onChange={e => upd('billing', { generationDay: Number(e.target.value) })} />
          </div>
          <div className="space-y-1"><Label hint="How many days after a bill is raised it becomes overdue. Was fixed at 15 and not editable.">Due after (days)</Label>
            <TextField hiddenLabel fullWidth size="small" type="number" value={p.billing?.dueDays ?? 15} onChange={e => upd('billing', { dueDays: Number(e.target.value) })} />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1"><Label hint="Applies a member's advance credit to a new bill automatically.">Auto-apply advance credit</Label>
            <FormControlLabel control={<Switch checked={p.advance?.autoApply ?? true} onChange={e => upd('advance', { autoApply: e.target.checked })} />} label={<span className="text-sm">{p.advance?.autoApply ? 'On' : 'Off'}</span>} />
          </div>
          <div className="space-y-1"><Label>Society PAN</Label>
            <TextField hiddenLabel fullWidth size="small" value={p.pan || ''} onChange={e => setP((prev: any) => ({ ...prev, pan: e.target.value }))} />
          </div>
        </div>
      </Section>

      <Section icon={<Percent className="w-4 h-4" />} title="Late fee / interest on arrears"
        subtitle="Co-operative bye-laws commonly cap this at 21% per annum, simple.">
        <FormControlLabel control={<Switch checked={p.lateFee?.enabled || false} onChange={e => upd('lateFee', { enabled: e.target.checked })} />} label={<span className="text-sm font-semibold">Charge interest on overdue dues</span>} />
        {p.lateFee?.enabled && (<>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1"><Label>Mode</Label>
              <FormControl fullWidth size="small"><Select value={p.lateFee.mode} onChange={e => upd('lateFee', { mode: e.target.value })}>
                <MenuItem value="FLAT">Flat amount</MenuItem><MenuItem value="PERCENT_PER_MONTH">% per month</MenuItem><MenuItem value="PERCENT_PER_ANNUM">% per annum</MenuItem><MenuItem value="SLAB">Slab by days overdue</MenuItem>
              </Select></FormControl>
            </div>
            {p.lateFee.mode === 'FLAT'
              ? <div className="space-y-1"><Label>Flat amount (₹)</Label><TextField hiddenLabel fullWidth size="small" type="number" value={rupees(p.lateFee.flatAmountPaise)} onChange={e => upd('lateFee', { flatAmountPaise: toPaise(e.target.value) })} /></div>
              : p.lateFee.mode !== 'SLAB'
                ? <div className="space-y-1"><Label>Rate (%)</Label><TextField hiddenLabel fullWidth size="small" type="number" value={p.lateFee.ratePercent ?? ''} onChange={e => upd('lateFee', { ratePercent: Number(e.target.value) })} /></div>
                : <div />}
            <div className="space-y-1"><Label hint="Interest only starts once a bill is overdue by more than this many days.">Grace days</Label><TextField hiddenLabel fullWidth size="small" type="number" value={p.lateFee.graceDays ?? 0} onChange={e => upd('lateFee', { graceDays: Number(e.target.value) })} /></div>
            <div className="space-y-1"><Label>Compounding</Label>
              <FormControl fullWidth size="small"><Select value={p.lateFee.compounding || 'SIMPLE'} onChange={e => upd('lateFee', { compounding: e.target.value })}>
                <MenuItem value="SIMPLE">Simple</MenuItem><MenuItem value="COMPOUND">Compound</MenuItem>
              </Select></FormControl>
            </div>
            <div className="space-y-1"><Label>Cap per invoice (₹, 0 = none)</Label><TextField hiddenLabel fullWidth size="small" type="number" value={rupees(p.lateFee.capPerInvoicePaise)} onChange={e => upd('lateFee', { capPerInvoicePaise: toPaise(e.target.value) })} /></div>
            <div className="space-y-1"><Label hint="Never charge less than this once interest applies.">Minimum charge (₹)</Label><TextField hiddenLabel fullWidth size="small" type="number" value={rupees(p.lateFee.minChargePaise)} onChange={e => upd('lateFee', { minChargePaise: toPaise(e.target.value) })} /></div>
            <div className="space-y-1"><Label hint="The income account interest is posted to. 4140 = Interest on Arrears.">Posts to account</Label><TextField hiddenLabel fullWidth size="small" value={p.lateFee.chargeHeadCode || '4140'} onChange={e => upd('lateFee', { chargeHeadCode: e.target.value })} /></div>
            <div className="space-y-1"><Label hint="A payment always goes to the oldest bill first. This decides what it settles inside that bill.">When a member pays, settle</Label>
              <FormControl fullWidth size="small">
                <Select value={p.allocation?.interestOrder || 'PRINCIPAL_FIRST'} onChange={e => upd('allocation', { interestOrder: e.target.value })}>
                  <MenuItem value="PRINCIPAL_FIRST">Dues first, then interest</MenuItem>
                  <MenuItem value="INTEREST_FIRST">Interest first, then dues</MenuItem>
                </Select>
              </FormControl>
            </div>
          </div>
          <p className="text-[11px] text-slate-500">
            <b>Simple</b> charges interest on unpaid dues only. <b>Compound</b> charges it on the dues plus interest already
            added — so the penalty itself earns a penalty. Most model bye-laws allow simple interest only, capped at 21% a year.
            Settling dues before interest also shrinks next month&apos;s charge, which is why it&apos;s the default.
          </p>

          {/* Slab editor. Selecting SLAB used to render the rate field and leave
              slabs empty, which silently charged zero interest. */}
          {p.lateFee.mode === 'SLAB' && (
            <div className="space-y-2 pt-2 border-t border-slate-100">
              <Label hint="The first slab whose limit covers the days overdue is applied.">Slabs</Label>
              {slabs.map((s, i) => (
                <div key={i} className="flex gap-2 items-center">
                  <TextField hiddenLabel size="small" type="number" label="Up to days" value={s.uptoDays}
                    onChange={e => setSlabs(slabs.map((x, j) => j === i ? { ...x, uptoDays: Number(e.target.value) } : x))} className="w-36" />
                  <TextField hiddenLabel size="small" type="number" label="Rate %" value={s.ratePercent}
                    onChange={e => setSlabs(slabs.map((x, j) => j === i ? { ...x, ratePercent: Number(e.target.value) } : x))} className="w-32" />
                  <IconButton size="small" onClick={() => setSlabs(slabs.filter((_, j) => j !== i))}><Trash2 className="w-4 h-4 text-slate-400" /></IconButton>
                </div>
              ))}
              <Button size="small" startIcon={<Plus className="w-4 h-4" />} onClick={() => setSlabs([...slabs, { uptoDays: 30, ratePercent: 12 }])}>Add slab</Button>
              {slabsInvalid && <p className="text-xs text-red-600 font-semibold">Add at least one slab — without one, no interest would be charged at all.</p>}
            </div>
          )}
        </>)}
      </Section>

      <Section icon={<BadgePercent className="w-4 h-4" />} title="Early-payment rebate"
        subtitle="Reward a member who settles quickly. The rebate is only ever suggested — someone still has to apply it to the bill.">
        <FormControlLabel control={<Switch checked={p.rebate?.enabled || false} onChange={e => upd('rebate', { enabled: e.target.checked })} />} label={<span className="text-sm font-semibold">Offer a rebate for paying early</span>} />
        {p.rebate?.enabled && (
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1"><Label>Rebate (%)</Label>
              <TextField hiddenLabel fullWidth size="small" type="number" value={p.rebate.percent ?? 5} onChange={e => upd('rebate', { percent: Number(e.target.value) })} />
            </div>
            <div className="space-y-1"><Label hint="Counted from the date the bill was raised.">Paid within (days)</Label>
              <TextField hiddenLabel fullWidth size="small" type="number" value={p.rebate.withinDays ?? 15} onChange={e => upd('rebate', { withinDays: Number(e.target.value) })} />
            </div>
          </div>
        )}
        <p className="text-[11px] text-slate-500">
          Rebates are never applied automatically when a payment lands. A discount that appears by itself is one nobody
          approved and nobody can explain to the member who didn&apos;t get it — so it shows up as a suggestion on the bill,
          and the committee decides.
        </p>
      </Section>

      <Section icon={<BellRing className="w-4 h-4" />} title="Reminders" subtitle="Nudge members before and after a bill falls due.">
        <FormControlLabel control={<Switch checked={p.reminders?.enabled || false} onChange={e => upd('reminders', { enabled: e.target.checked })} />} label={<span className="text-sm font-semibold">Send due-date reminders</span>} />
        {p.reminders?.enabled && (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1"><Label hint="e.g. 3,1 sends 3 days and 1 day before the due date.">Days before due</Label><TextField hiddenLabel fullWidth size="small" value={(p.reminders.beforeDueDays || []).join(',')} onChange={e => upd('reminders', { beforeDueDays: e.target.value.split(',').map((x: string) => Number(x.trim())).filter((n: number) => n > 0) })} /></div>
              <div className="space-y-1"><Label>Days after due</Label><TextField hiddenLabel fullWidth size="small" value={(p.reminders.afterDueDays || []).join(',')} onChange={e => upd('reminders', { afterDueDays: e.target.value.split(',').map((x: string) => Number(x.trim())).filter((n: number) => n > 0) })} /></div>
            </div>
            <div className="space-y-1">
              <Label>Send via</Label>
              <FormControl fullWidth size="small">
                <Select multiple value={p.reminders.channels || ['EMAIL']}
                  onChange={e => upd('reminders', { channels: typeof e.target.value === 'string' ? e.target.value.split(',') : e.target.value })}
                  renderValue={(v) => (v as string[]).map(c => CHANNELS.find(x => x.v === c)?.l || c).join(', ')}>
                  {CHANNELS.map(c => <MenuItem key={c.v} value={c.v}>{c.l}</MenuItem>)}
                </Select>
              </FormControl>
              <p className="text-[11px] text-amber-600 mt-1">Only Email is delivered today — SMS, WhatsApp and push are recorded but not yet sent.</p>
            </div>
          </div>
        )}
      </Section>

      <Section icon={<ReceiptText className="w-4 h-4" />} title="GST, TDS & rounding">
        <FormControlLabel control={<Switch checked={p.gst?.enabled || false} onChange={e => upd('gst', { enabled: e.target.checked })} />} label={<span className="text-sm font-semibold">Charge GST on maintenance</span>} />
        {p.gst?.enabled && (<>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="space-y-1"><Label>Default rate (%)</Label><TextField hiddenLabel fullWidth size="small" type="number" value={p.gst.defaultRatePercent} onChange={e => upd('gst', { defaultRatePercent: Number(e.target.value) })} /></div>
            <div className="space-y-1"><Label>Default SAC</Label><TextField hiddenLabel fullWidth size="small" value={p.gst.defaultSac || ''} onChange={e => upd('gst', { defaultSac: e.target.value })} /></div>
            <div className="space-y-1"><Label>GSTIN</Label><TextField hiddenLabel fullWidth size="small" value={p.gstin || ''} onChange={e => setP((prev: any) => ({ ...prev, gstin: e.target.value }))} /></div>
            <div className="space-y-1"><Label hint="Recorded for your GST returns. A society's supply is always intra-state, so CGST+SGST is charged regardless.">Place of supply</Label><TextField hiddenLabel fullWidth size="small" value={p.gst.placeOfSupplyState || ''} onChange={e => upd('gst', { placeOfSupplyState: e.target.value })} /></div>
          </div>

          {/* The exemption is the whole ballgame for a society: charge GST below
              the limit and you're refunding members later. */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t border-slate-100">
            <div className="space-y-1"><Label hint="A member's monthly contribution up to this is exempt. 0 turns the test off and charges GST on everything.">Exempt up to, per member per month (₹)</Label>
              <TextField hiddenLabel fullWidth size="small" type="number" value={rupees(p.gst.rwaExemptionPerMemberPaise)} onChange={e => upd('gst', { rwaExemptionPerMemberPaise: toPaise(e.target.value) })} />
            </div>
            <div className="space-y-1"><Label>Once a member goes over</Label>
              <FormControl fullWidth size="small">
                <Select value={p.gst.exemptionBasis || 'FULL_IF_EXCEEDS'} onChange={e => upd('gst', { exemptionBasis: e.target.value })}>
                  <MenuItem value="FULL_IF_EXCEEDS">Charge GST on the whole amount</MenuItem>
                  <MenuItem value="EXCESS_ONLY">Charge GST only on the excess</MenuItem>
                </Select>
              </FormControl>
            </div>
            <div className="space-y-1"><Label hint="Below this annual turnover a society generally need not register for GST at all.">Registration threshold (₹/year)</Label>
              <TextField hiddenLabel fullWidth size="small" type="number" value={rupees(p.gst.registrationThresholdPaise)} onChange={e => upd('gst', { registrationThresholdPaise: toPaise(e.target.value) })} />
            </div>
          </div>
          <p className="text-[11px] text-slate-500">
            The law here is genuinely unsettled: CBIC Circular 109/28/2019 says GST applies to the <b>whole</b> contribution once ₹7,500 is
            breached, while the Madras High Court (<i>Greenwood Owners Association</i>, 2021) held it applies only to the <b>excess</b> and read
            the circular down — the department appealed. Societies follow both. Ask your auditor which line yours takes; we won&apos;t choose for you.
            Charges that are pure reimbursements (property tax, common-area electricity) can be excluded per charge head.
          </p>
        </>)}

        <div className="pt-2 border-t border-slate-100">
          <FormControlLabel control={<Switch checked={p.tds?.enabled || false} onChange={e => upd('tds', { enabled: e.target.checked })} />} label={<span className="text-sm font-semibold">Deduct TDS on vendor payments</span>} />
          {p.tds?.enabled && (
            <div className="grid grid-cols-2 gap-3 mt-2">
              <div className="space-y-1"><Label hint="e.g. 194C for contractors, 194J for professional fees. Can be overridden per vendor.">Default section</Label><TextField hiddenLabel fullWidth size="small" value={p.tds.defaultSection || ''} onChange={e => upd('tds', { defaultSection: e.target.value })} /></div>
              <div className="space-y-1"><Label>Default rate (%)</Label><TextField hiddenLabel fullWidth size="small" type="number" value={p.tds.defaultRatePercent ?? ''} onChange={e => upd('tds', { defaultRatePercent: Number(e.target.value) })} /></div>
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3 pt-2 border-t border-slate-100">
          <div className="space-y-1"><Label>Invoice rounding</Label>
            <FormControl fullWidth size="small"><Select value={p.rounding?.mode || 'NONE'} onChange={e => upd('rounding', { mode: e.target.value })}><MenuItem value="NONE">No rounding</MenuItem><MenuItem value="NEAREST_RUPEE">Nearest rupee</MenuItem><MenuItem value="CEIL_RUPEE">Round up to rupee</MenuItem></Select></FormControl>
          </div>
          <div className="space-y-1"><Label hint="Where the rounding difference is posted. 4900 = Rounding Off.">Rounding account</Label>
            <TextField hiddenLabel fullWidth size="small" value={p.rounding?.accountCode || '4900'} onChange={e => upd('rounding', { accountCode: e.target.value })} />
          </div>
        </div>
      </Section>

      <Section icon={<Hash className="w-4 h-4" />} title="Document numbering"
        subtitle="Tokens: {PREFIX} {FY} {FYSHORT} {SEQ} — e.g. INV/2026-27/00001. Numbers are gapless per financial year.">
        <div className="space-y-3">
          {([['invoice', 'Invoices'], ['receipt', 'Receipts'], ['voucher', 'Payment vouchers'], ['journal', 'Journal vouchers']] as const).map(([k, label]) => (
            <div key={k} className="grid grid-cols-3 gap-3 items-end">
              <div className="space-y-1"><Label>{label} prefix</Label>
                <TextField hiddenLabel fullWidth size="small" value={p.numbering?.[k]?.prefix || ''} onChange={e => updNumbering(k, { prefix: e.target.value })} />
              </div>
              <div className="space-y-1"><Label>Template</Label>
                <TextField hiddenLabel fullWidth size="small" value={p.numbering?.[k]?.template || ''} onChange={e => updNumbering(k, { template: e.target.value })} />
              </div>
              <div className="space-y-1"><Label>Digits</Label>
                <TextField hiddenLabel fullWidth size="small" type="number" value={p.numbering?.[k]?.padding ?? 5} onChange={e => updNumbering(k, { padding: Number(e.target.value) })} />
              </div>
            </div>
          ))}
        </div>
      </Section>

      <Section icon={<CheckCheck className="w-4 h-4" />} title="Approvals & controls"
        subtitle="Separation of duties — the person who records money shouldn't be the only one who approves it.">
        <div className="space-y-1"><Label hint="An expense at or above this needs a different person to approve it than the one who created it. 0 = always allowed.">Expense approval threshold (₹)</Label>
          <TextField hiddenLabel fullWidth size="small" type="number" value={rupees(p.approvals?.expenseThresholdPaise)} onChange={e => upd('approvals', { expenseThresholdPaise: toPaise(e.target.value) })} />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <FormControlLabel control={<Switch checked={p.approvals?.requireDualControlForReceipts || false} onChange={e => upd('approvals', { requireDualControlForReceipts: e.target.checked })} />} label={<span className="text-sm">Receipts need a second confirmer</span>} />
          <FormControlLabel control={<Switch checked={p.approvals?.refundRequiresApproval ?? true} onChange={e => upd('approvals', { refundRequiresApproval: e.target.checked })} />} label={<span className="text-sm">Refunds need approval</span>} />
        </div>
        <p className="text-[11px] text-amber-600 flex items-start gap-1"><Info className="w-3 h-3 mt-0.5 shrink-0" />These two are recorded but not yet enforced — refunds and dual-control receipts are still to be built.</p>
      </Section>

      <Section icon={<Lock className="w-4 h-4" />} title="Close the books"
        subtitle="Once a year has been audited and shown to members, a back-dated entry would quietly restate figures they've already been given.">
        <div className="space-y-1 max-w-xs">
          <Label hint="Nothing can be posted on or before this date — by anyone, through any screen. Clear it to reopen.">Books closed up to and including</Label>
          <TextField hiddenLabel fullWidth size="small" type="date"
            value={p.lock?.lockedUpToDate ? String(p.lock.lockedUpToDate).slice(0, 10) : ''}
            onChange={e => upd('lock', { lockedUpToDate: e.target.value || null })} />
        </div>
        {p.lock?.lockedUpToDate
          ? <p className="text-[11px] text-emerald-700 font-semibold">Locked. Invoices, receipts, expenses and manual vouchers dated on or before this will be refused.</p>
          : <p className="text-[11px] text-slate-500">Not locked — anything can still be posted into any past period.</p>}
      </Section>

      <Section icon={<Landmark className="w-4 h-4" />} title="Payments" subtitle="How members pay you online, and where the money settles.">
        <p className="text-sm text-slate-600">Gateway keys, UPI ID and payout bank live on the <a className="text-blue-600 font-bold hover:underline" href="/dashboard/finance/settlement">Settlement</a> page.</p>
      </Section>

      <div className="flex justify-end sticky bottom-4">
        <Button onClick={save} disabled={saving || slabsInvalid} variant="contained" className="px-8 py-2.5 font-bold shadow-lg">{saving ? <CircularProgress size={20} color="inherit" /> : 'Save Settings'}</Button>
      </div>
    </div>
  );
}
