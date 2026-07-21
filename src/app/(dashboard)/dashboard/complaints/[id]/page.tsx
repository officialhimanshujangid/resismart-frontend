'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import api from '@/lib/api';
import { Button, Paper } from '@mui/material';
import { ArrowLeft, MessageSquare, Printer } from 'lucide-react';
import PageHeader from '@/components/common/PageHeader';
import PageSkeleton from '@/components/common/PageSkeleton';
import ErrorState from '@/components/common/ErrorState';
import ComplaintDetail from '../ComplaintDetail';
import { Complaint, Options, ago, when, refusal } from '../shared';

/**
 * One complaint, at its own address.
 *
 * Everything in this module used to be a dialog. A committee member could not
 * send a colleague "look at this one", a resident could not bookmark their own
 * leak, and nobody could print a ticket to take to a meeting — the deep link
 * `?id=` opened a modal over a list that had to load first, and closing it
 * silently changed which complaint the URL described.
 *
 * So this is the canonical view and the list's dialog is the glance. The body
 * is the same component in both, which is the only way they stay in agreement
 * about which buttons a person gets.
 *
 * No `useSearchParams` here — the id is a route parameter, so there is nothing
 * to suspend on and the page prerenders cleanly.
 */
export default function ComplaintTicketPage() {
  const params = useParams();
  const id = String(params?.id || '');

  const [options, setOptions] = useState<Options | null>(null);
  const [summary, setSummary] = useState<Complaint | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState<string | null>(null);

  /**
   * The header needs the ticket number and the flat; the body fetches the rest
   * itself. Both come from the same endpoint, so this is one request, not two —
   * the summary is simply the part the header shows.
   */
  const load = useCallback(async () => {
    setFailed(null);
    try {
      const [d, o] = await Promise.all([
        api.get(`/complaints/${id}`),
        api.get('/complaints/options'),
      ]);
      setSummary(d.data?.data?.complaint || null);
      setOptions(o.data?.data || null);
    } catch (e: unknown) {
      setFailed(refusal(e, 'That complaint could not be opened'));
    } finally { setLoading(false); }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  if (loading) return <PageSkeleton />;

  if (failed || !summary) {
    return (
      <div className="space-y-4">
        <PageHeader breadcrumb="Operations" title="Complaint" icon={<MessageSquare className="w-4.5 h-4.5" />} />
        <ErrorState
          title="This complaint could not be opened"
          message={failed || 'It may have been merged into another one.'}
          hint={<>If somebody sent you this link and it is not your complaint, you will not be able to see it.{' '}
            <Link href="/dashboard/complaints" className="underline">Back to all complaints</Link>.</>}
          onRetry={load}
        />
      </div>
    );
  }

  return (
    <div className="space-y-4 pb-24">
      <PageHeader
        breadcrumb="Operations · Complaints"
        title={summary.title}
        icon={<MessageSquare className="w-4.5 h-4.5" />}
        subtitle={`Complaint no. ${summary.ticketCode} · ${summary.category}`
          + `${summary.subCategory ? ` — ${summary.subCategory}` : ''}`
          + ` · ${summary.flatLabel || summary.blockName || 'Common area'}`
          + ` · reported by ${summary.raisedByName} ${ago(summary.createdAt)}`}
        actions={
          <>
            <Button component={Link} href="/dashboard/complaints" variant="outlined"
              startIcon={<ArrowLeft className="w-4 h-4" />}>
              All complaints
            </Button>
            {/* A committee meeting still runs on paper. The browser's own print
                is enough — the page is a single column of text and photos. */}
            <Button variant="outlined" startIcon={<Printer className="w-4 h-4" />}
              onClick={() => window.print()}>
              Print
            </Button>
          </>
        }
      />

      <Paper elevation={0} className="rounded-2xl border border-slate-200 p-4 sm:p-5">
        <ComplaintDetail id={id} options={options} onChanged={load} />
      </Paper>

      <p className="text-[11px] text-slate-400 px-1">
        Reported {when(summary.createdAt)}. This page is the complaint&apos;s own address — the link can be shared
        with anybody who is already allowed to see it.
      </p>
    </div>
  );
}
