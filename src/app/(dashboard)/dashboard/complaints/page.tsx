'use client';

import React, { Suspense, useCallback, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import api from '@/lib/api';
import {
  Button, TextField, Select, MenuItem, FormControl, InputLabel, Chip,
  ToggleButton, ToggleButtonGroup,
} from '@mui/material';
import {
  Plus, Search, AlertTriangle, Check, Users, MessageSquare, ShieldAlert,
  RefreshCw, Wrench, Info, Camera, LayoutGrid, Rows3,
} from 'lucide-react';
import { useToastConfirm } from '@/context/ToastConfirmContext';
import { DataTable, ColumnDef } from '@/components/common/DataTable';
import AppDialog from '@/components/common/AppDialog';
import PageHeader from '@/components/common/PageHeader';
import PageSkeleton from '@/components/common/PageSkeleton';
import StatCard from '@/components/common/StatCard';
import StatusChip, { statusMeaning } from '@/components/common/StatusChip';
import Board from './Board';
import { PhotoPicker } from './Photos';
import {
  Complaint, Options, Stats, PAUSE_LABEL, ago, isOverdue, refusal,
} from './shared';

/**
 * Complaints.
 *
 * One screen serves a resident, a technician, a manager and a committee member,
 * because the server already decides what each of them may see. The page never
 * asks "who am I?" to filter — it renders what it was given, which means there
 * is exactly one place the privacy rule lives.
 *
 * Two things changed here, and both are about where a complaint LIVES:
 *
 *   **Opening one navigates.** Every complaint now has its own address at
 *   `/dashboard/complaints/[id]` — shareable, bookmarkable, printable. The old
 *   `?id=` deep link that every notification still carries is redirected there
 *   rather than reopening a modal over a list that has to load first.
 *
 *   **There is a board.** Columns by status, dragged to move, offering only
 *   what the published state machine says the server will accept.
 */

function ComplaintsScreen() {
  const { showToast } = useToastConfirm();
  const router = useRouter();
  const params = useSearchParams();

  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<Complaint[]>([]);
  const [options, setOptions] = useState<Options | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  const [q, setQ] = useState('');
  const [openOnly, setOpenOnly] = useState(true);
  const [view, setView] = useState<'list' | 'board'>('list');

  const [raiseOpen, setRaiseOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<Record<string, unknown>>({ title: '', description: '', categoryId: '', kind: 'SERVICE' });
  const [photoKeys, setPhotoKeys] = useState<string[]>([]);

  const [totalPages, setTotalPages] = useState(1);
  const [loadedPage, setLoadedPage] = useState(1);
  const [loadingMore, setLoadingMore] = useState(false);

  const canManage = !!options?.viewer?.canManage || !!options?.stats;

  /**
   * The form's contents — categories, staff, assets, the state machine — are
   * fetched ONCE.
   *
   * This used to come back attached to every list refresh, and every action
   * refreshed the list, so nine actions on one ticket fetched the whole
   * catalogue nine times and scanned the complaint collection nine times with
   * it (H-17). None of it changes while somebody is looking at a list.
   */
  const loadOptions = useCallback(async () => {
    try {
      const o = await api.get('/complaints/options');
      setOptions(o.data?.data || null);
      setStats(o.data?.data?.stats || null);
    } catch (e: unknown) {
      showToast(refusal(e, 'Could not load the complaint form'), 'error');
    }
  }, [showToast]);

  /**
   * `page` is passed through, and rows are APPENDED when it grows.
   *
   * Before this the page read only `data.rows` and never sent `page`, so a
   * society silently only ever saw its 25 most recent complaints.
   */
  const load = useCallback(async (page = 1) => {
    try {
      const p = new URLSearchParams();
      if (openOnly) p.set('open', 'true');
      if (q.trim()) p.set('q', q.trim());
      p.set('page', String(page));
      // The board needs the whole open set in front of it to be a board at all.
      if (page === 1) p.set('pageSize', '100');
      const l = await api.get(`/complaints?${p}`);
      const newRows = l.data?.rows || [];
      setRows(prev => (page === 1 ? newRows : [...prev, ...newRows]));
      setTotalPages(l.data?.pagination?.pages || 1);
      setLoadedPage(page);
    } catch (e: unknown) {
      showToast(refusal(e, 'Could not load complaints'), 'error');
    } finally { setLoading(false); }
  }, [openOnly, q, showToast]);

  useEffect(() => { loadOptions(); }, [loadOptions]);
  useEffect(() => { load(1); }, [load]);

  /** The six numbers on their own, rather than the whole form payload again. */
  const refreshStats = useCallback(async () => {
    if (!canManage) return;
    try { setStats((await api.get('/complaints/stats')).data?.data || null); } catch { /* the cards simply keep their last value */ }
  }, [canManage]);

  /**
   * Arriving from a scanned sticker, or from a notification.
   *
   * Every `COMPLAINT_*` notification ever sent links with `?id=`, and those
   * links live in people's inboxes for ninety days — so the parameter is
   * honoured and redirected to the complaint's real address rather than
   * dropped.
   */
  useEffect(() => {
    const id = params.get('id');
    if (id) { router.replace(`/dashboard/complaints/${id}`); return; }
    const asset = params.get('asset');
    const category = params.get('category');
    if (asset) {
      setForm(f => ({ ...f, assetId: asset, categoryId: category || f.categoryId }));
      setRaiseOpen(true);
    }
  }, [params, router]);

  const doRaise = async () => {
    setSaving(true);
    try {
      const res = await api.post('/complaints', { ...form, photoKeys });
      showToast(res.data?.message || 'Reported', 'success');
      setRaiseOpen(false);
      setForm({ title: '', description: '', categoryId: '', kind: 'SERVICE' });
      setPhotoKeys([]);
      await Promise.all([load(1), refreshStats()]);
    } catch (e: unknown) {
      showToast(refusal(e, 'Could not report that'), 'error');
    } finally { setSaving(false); }
  };

  const open = (id: string) => router.push(`/dashboard/complaints/${id}`);

  const complaintColumns: ColumnDef<Complaint>[] = [
    {
      id: 'title', label: 'Problem', alwaysVisible: true,
      sortValue: x => x.title,
      exportValue: x => x.title,
      render: x => (
        <div className="min-w-0 max-w-[26rem]">
          <div className="flex items-center gap-1.5 flex-wrap">
            <p className="font-bold text-slate-800 truncate">{x.title}</p>
            {x.kind === 'CONDUCT' && (
              <Chip size="small" icon={<ShieldAlert className="w-3 h-3" />} label="Conduct"
                sx={{ height: 20, fontSize: 10, fontWeight: 700, bgcolor: 'error.light', color: 'error.contrastText' }} />
            )}
            {x.priority === 'EMERGENCY' && (
              <Chip size="small" label="Emergency" color="error" sx={{ height: 20, fontSize: 10, fontWeight: 700 }} />
            )}
            {x.reopenCount > 0 && (
              <Chip size="small" icon={<RefreshCw className="w-3 h-3" />} label={`reopened ${x.reopenCount}×`}
                sx={{ height: 20, fontSize: 10, fontWeight: 700, bgcolor: 'error.light', color: 'error.contrastText' }} />
            )}
            {!!x.photoKeys?.length && (
              <span className="text-[11px] text-slate-400 flex items-center gap-0.5">
                <Camera className="w-3 h-3" />{x.photoKeys.length}
              </span>
            )}
          </div>
          <p className="text-[11px] text-slate-400 mt-0.5 truncate">
            Complaint no. {x.ticketCode} · {x.category}{x.subCategory && ` — ${x.subCategory}`}
          </p>
        </div>
      ),
    },
    {
      id: 'where', label: 'Where',
      sortValue: x => x.flatLabel || x.blockName || '',
      exportValue: x => [x.flatLabel || x.blockName, x.assetName].filter(Boolean).join(' · '),
      render: x => (
        <div className="min-w-0">
          <p className="text-sm text-slate-600 truncate">{x.flatLabel || x.blockName || 'Common area'}</p>
          {x.assetName && <p className="text-[11px] text-slate-400 truncate">{x.assetName}</p>}
        </div>
      ),
    },
    {
      id: 'status', label: 'Status',
      sortValue: x => statusMeaning(x.status).label,
      exportValue: x => statusMeaning(x.status).label,
      render: x => (
        <div className="min-w-0">
          <StatusChip status={x.status} />
          {x.pausedAt && (
            <p className="text-[11px] text-amber-700 font-semibold mt-0.5">
              {PAUSE_LABEL[x.pauseReason || ''] || 'Paused'}
            </p>
          )}
        </div>
      ),
    },
    {
      id: 'with', label: 'With',
      // Unassigned sorts to the top of an ascending sort on purpose: an empty
      // string beats every name, and "who has nobody" is the question this
      // column is actually asked.
      sortValue: x => x.assigneeName || x.assigneeVendorName || '',
      exportValue: x => x.assigneeName || x.assigneeVendorName || 'nobody',
      render: x => (x.assigneeName || x.assigneeVendorName
        ? <span className="text-sm text-slate-600">{x.assigneeName || x.assigneeVendorName}</span>
        : <span className="text-[11px] text-rose-600 font-bold">nobody assigned</span>),
    },
    {
      id: 'due', label: 'Fix by',
      // The clock, sortable — the whole reason a manager opens this screen.
      sortValue: x => x.resolutionDueAt || '',
      exportValue: x => (x.resolutionDueAt ? new Date(x.resolutionDueAt).toLocaleString('en-IN') : ''),
      render: x => {
        if (!x.resolutionDueAt) return <span className="text-slate-300">—</span>;
        const late = isOverdue(x);
        return (
          <span className={`text-[11px] font-semibold ${late ? 'text-amber-700' : 'text-slate-500'}`}>
            {late && <AlertTriangle className="w-3 h-3 inline mr-0.5 -mt-0.5" />}
            {new Date(x.resolutionDueAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
          </span>
        );
      },
    },
    {
      id: 'metoo', label: 'Affected', align: 'center', defaultHidden: true,
      sortValue: x => (x.meTooUserIds?.length || 0) + 1,
      exportValue: x => (x.meTooUserIds?.length || 0) + 1,
      render: x => (
        <span className="text-[11px] text-slate-500 flex items-center justify-center gap-0.5">
          <Users className="w-3 h-3" />{(x.meTooUserIds?.length || 0) + 1}
        </span>
      ),
    },
    {
      id: 'raised', label: 'Reported', align: 'right',
      sortValue: x => x.createdAt,
      exportValue: x => new Date(x.createdAt).toLocaleString('en-IN'),
      render: x => <span className="text-[11px] text-slate-400 whitespace-nowrap">{ago(x.createdAt)}</span>,
    },
  ];

  if (loading) return <PageSkeleton />;

  return (
    <div className="space-y-4 pb-24">
      <PageHeader
        breadcrumb="Operations"
        title="Complaints"
        icon={<MessageSquare className="w-4.5 h-4.5" />}
        subtitle="Report a problem, and see who is on it. Everyone lands on this same screen — the server decides what each person may see, so a resident sees their flat's and a plumber sees their queue."
        actions={
          <>
            {canManage && (
              <Button component={Link} href="/dashboard/complaints/categories" variant="outlined">
                Categories
              </Button>
            )}
            <Button variant="contained" startIcon={<Plus className="w-4 h-4" />}
              onClick={() => setRaiseOpen(true)}>
              Report a problem
            </Button>
          </>
        }
      />

      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <StatCard label="Open" value={stats.open} icon={<MessageSquare className="w-5 h-5" />} tone="blue" />
          <StatCard label="Past its time" value={stats.overdue} icon={<AlertTriangle className="w-5 h-5" />}
            tone={stats.overdue ? 'amber' : 'slate'} />
          <StatCard label="Nobody assigned" value={stats.unassigned} icon={<Users className="w-5 h-5" />}
            tone={stats.unassigned ? 'rose' : 'slate'}
            sub={stats.unassigned ? 'these reach nobody' : undefined} />
          <StatCard label="Reopened" value={`${stats.reopenRate}%`} icon={<RefreshCw className="w-5 h-5" />}
            tone={stats.reopenRate > 20 ? 'amber' : 'slate'}
            sub={stats.reopenRate > 20 ? 'work is not sticking' : undefined} />
        </div>
      )}

      {/* The two figures that used to contradict each other on two screens.
          Both now exclude the time a complaint was on hold, so neither counts
          hours nobody could work as time the society took. */}
      {stats && (stats.medianResolutionMinutes !== null || stats.avgResolutionMinutes !== null) && (
        <p className="text-[11px] text-slate-400 px-1">
          Typical fix takes {stats.medianResolutionMinutes !== null ? `${Math.round(stats.medianResolutionMinutes / 60)}h` : '—'}
          {' '}(average {stats.avgResolutionMinutes !== null ? `${Math.round(stats.avgResolutionMinutes / 60)}h` : '—'}).
          Time a complaint spent on hold is not counted — that wait was not ours.
        </p>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <TextField size="small" placeholder="Search…" value={q} onChange={e => setQ(e.target.value)}
          className="min-w-[220px]"
          slotProps={{ input: { startAdornment: <Search className="w-4 h-4 text-slate-400 mr-2" /> } }} />
        <ToggleButtonGroup exclusive size="small" value={openOnly ? 'open' : 'all'}
          onChange={(_, v) => v && setOpenOnly(v === 'open')}>
          <ToggleButton value="open" sx={{ textTransform: 'none', fontWeight: 700, fontSize: 12 }}>Open</ToggleButton>
          <ToggleButton value="all" sx={{ textTransform: 'none', fontWeight: 700, fontSize: 12 }}>All</ToggleButton>
        </ToggleButtonGroup>

        {/* The board is a manager's tool: it moves work between people, and the
            verbs it offers are the ones a manager holds. A resident gets the
            list, which is the whole of what their own complaints need. */}
        {canManage && (
          <ToggleButtonGroup exclusive size="small" value={view}
            onChange={(_, v) => v && setView(v)}>
            <ToggleButton value="list" sx={{ textTransform: 'none', fontWeight: 700, fontSize: 12 }}>
              <Rows3 className="w-3.5 h-3.5 mr-1" />List
            </ToggleButton>
            <ToggleButton value="board" sx={{ textTransform: 'none', fontWeight: 700, fontSize: 12 }}>
              <LayoutGrid className="w-3.5 h-3.5 mr-1" />Board
            </ToggleButton>
          </ToggleButtonGroup>
        )}
      </div>

      {view === 'board' && canManage ? (
        <Board rows={rows} options={options}
          onChanged={() => { load(1); refreshStats(); }} />
      ) : (
        <>
          <DataTable
            columns={complaintColumns}
            data={rows}
            keyExtractor={x => x._id}
            onRowClick={x => open(x._id)}
            exportFileName="complaints"
            columnToggle
            emptyTitle="Nothing outstanding"
            emptyText="Nothing is waiting on anybody. Report a problem with the button above when something needs fixing."
            emptyIcon={<Check className="w-6 h-6 text-emerald-400" />}
          />

          {rows.length > 0 && loadedPage < totalPages && (
            <Button variant="outlined" disabled={loadingMore}
              onClick={async () => { setLoadingMore(true); try { await load(loadedPage + 1); } finally { setLoadingMore(false); } }}
              className="mt-1">
              {loadingMore ? 'Loading…' : 'Show older complaints'}
            </Button>
          )}
        </>
      )}

      {/* ------------------------------------------------------------ report it */}
      <AppDialog
        open={raiseOpen}
        onClose={() => setRaiseOpen(false)}
        title="Report a problem"
        confirmText={saving ? 'Sending…' : 'Report it'}
        confirmDisabled={saving || !String(form.title || '').trim()}
        busy={saving}
        onConfirm={doRaise}
      >
        <div className="flex flex-col gap-4 pt-1">
          <ToggleButtonGroup exclusive size="small" fullWidth value={form.kind}
            onChange={(_, v) => v && setForm({ ...form, kind: v })}>
            <ToggleButton value="SERVICE" sx={{ textTransform: 'none', fontWeight: 700, fontSize: 12 }}>
              Something is broken
            </ToggleButton>
            <ToggleButton value="CONDUCT" sx={{ textTransform: 'none', fontWeight: 700, fontSize: 12 }}>
              Somebody&apos;s behaviour
            </ToggleButton>
          </ToggleButtonGroup>

          {form.kind === 'CONDUCT' && (
            <div className="rounded-xl bg-slate-100 border border-slate-200 p-3 flex items-start gap-2">
              <Info className="w-3.5 h-3.5 text-slate-500 shrink-0 mt-0.5" />
              <p className="text-[11px] text-slate-600 leading-relaxed">
                This goes only to the committee member who handles conduct — not to
                the person it is about, and not into anyone&apos;s work queue.
              </p>
            </div>
          )}

          <TextField autoFocus fullWidth size="small" label="What is wrong?" value={form.title as string}
            onChange={e => setForm({ ...form, title: e.target.value })} />

          {form.kind === 'SERVICE' && (
            <FormControl fullWidth size="small">
              <InputLabel>Kind of problem</InputLabel>
              <Select label="Kind of problem" value={(form.categoryId as string) || ''}
                onChange={e => setForm({ ...form, categoryId: e.target.value })}>
                {options?.categories.map(cat => (
                  <MenuItem key={cat._id} value={cat._id}>
                    {cat.category}{cat.subCategory && ` — ${cat.subCategory}`}
                    {cat.isEmergency && ' ⚡'}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          )}

          <TextField fullWidth size="small" multiline minRows={2} label="Anything else (optional)"
            value={form.description as string} onChange={e => setForm({ ...form, description: e.target.value })} />

          {/* The single biggest reason this form felt long: there was no way to
              show the problem, so a leak had to be described in prose. */}
          <PhotoPicker value={photoKeys} onChange={setPhotoKeys} limit={options?.photoLimit || 6}
            label="Show us the problem" />

          {options?.workingHours && (
            <p className="text-[11px] text-slate-400">{options.workingHours}</p>
          )}

          {!!form.assetId && (
            <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-2.5 flex items-center gap-2">
              <Wrench className="w-3.5 h-3.5 text-emerald-600" />
              <span className="text-xs text-emerald-900 font-semibold">
                {options?.assets.find(a => a._id === form.assetId)?.name || 'Equipment'} — picked up from the sticker
              </span>
            </div>
          )}
        </div>
      </AppDialog>
    </div>
  );
}

/**
 * `useSearchParams` suspends, and Next 16 fails the production build on a page
 * that reads it outside a boundary. The skeleton is what the reader sees for
 * the instant before the query string is known.
 */
export default function ComplaintsPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <ComplaintsScreen />
    </Suspense>
  );
}
