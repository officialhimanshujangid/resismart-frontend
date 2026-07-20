'use client';

import React, { useEffect, useState, use } from 'react';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';
import { CircularProgress, Button, Paper } from '@mui/material';
import { Wrench, AlertTriangle } from 'lucide-react';

/**
 * Where a scanned sticker lands.
 *
 * Deliberately outside the dashboard shell: somebody is standing in front of a
 * broken lift holding a phone, and the fastest useful thing is to identify the
 * machine and hand them straight to the report form with it already chosen.
 *
 * Next 16: `params` is a Promise and has to be unwrapped with `use()`.
 */
export default function ScanPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);
  const router = useRouter();
  const [error, setError] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const res = await api.get(`/complaints/scan/${token}`);
        const d = res.data?.data;
        const q = new URLSearchParams({ asset: d.asset._id });
        if (d.suggestedCategoryId) q.set('category', d.suggestedCategoryId);
        router.replace(`/dashboard/complaints?${q}`);
      } catch (e: any) {
        setError(e.response?.data?.message || 'That sticker did not work. Sign in and try again.');
      }
    })();
  }, [token, router]);

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-slate-50">
      <Paper elevation={0} className="rounded-2xl border border-slate-200 p-8 max-w-sm w-full text-center">
        {error ? (
          <>
            <AlertTriangle className="w-8 h-8 text-amber-500 mx-auto" />
            <p className="mt-3 font-bold text-slate-800">Could not read that sticker</p>
            <p className="text-sm text-slate-600 mt-1">{error}</p>
            <Button variant="outlined" className="!mt-4 !rounded-xl !normal-case !font-bold"
              onClick={() => router.push('/dashboard')}>
              Go to ResiSmart
            </Button>
          </>
        ) : (
          <>
            <Wrench className="w-8 h-8 text-slate-400 mx-auto" />
            <CircularProgress size={22} className="!mt-4" />
            <p className="mt-3 text-sm text-slate-600">Finding the equipment…</p>
          </>
        )}
      </Paper>
    </div>
  );
}
