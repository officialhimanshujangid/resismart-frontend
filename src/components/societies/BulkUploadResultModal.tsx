import React from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Chip,
  IconButton
} from '@mui/material';
import { X, CheckCircle2, XCircle, AlertCircle } from 'lucide-react';

export interface BulkUploadResultRow {
  row: number;
  block: string;
  flat: string;
  status: 'SUCCESS' | 'FAILED' | 'DUPLICATE';
  reason: string;
}

export interface BulkUploadSummary {
  total: number;
  success: number;
  failed: number;
  duplicates: number;
}

interface BulkUploadResultModalProps {
  open: boolean;
  onClose: () => void;
  summary: BulkUploadSummary | null;
  results: BulkUploadResultRow[];
}

export default function BulkUploadResultModal({ open, onClose, summary, results }: BulkUploadResultModalProps) {
  if (!summary) return null;

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth slotProps={{ paper: { className: 'rounded-2xl' } }}>
      <DialogTitle className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
        <div>
          <h2 className="text-xl font-bold text-slate-800">Bulk Upload Results</h2>
          <p className="text-sm text-slate-500 font-normal mt-1">
            Processed {summary.total} rows.
          </p>
        </div>
        <IconButton onClick={onClose} size="small">
          <X className="w-5 h-5 text-slate-500" />
        </IconButton>
      </DialogTitle>
      
      <DialogContent className="p-0">
        <div className="bg-slate-50 p-4 border-b border-slate-100 flex gap-4">
          <div className="flex-1 bg-white p-3 rounded-lg border border-slate-200 shadow-sm text-center">
            <div className="text-2xl font-black text-green-600 flex items-center justify-center gap-2">
              <CheckCircle2 className="w-5 h-5" />
              {summary.success}
            </div>
            <div className="text-xs font-semibold text-slate-500 uppercase mt-1">Successfully Created</div>
          </div>
          <div className="flex-1 bg-white p-3 rounded-lg border border-slate-200 shadow-sm text-center">
            <div className="text-2xl font-black text-amber-500 flex items-center justify-center gap-2">
              <AlertCircle className="w-5 h-5" />
              {summary.duplicates}
            </div>
            <div className="text-xs font-semibold text-slate-500 uppercase mt-1">Duplicates Skipped</div>
          </div>
          <div className="flex-1 bg-white p-3 rounded-lg border border-slate-200 shadow-sm text-center">
            <div className="text-2xl font-black text-red-600 flex items-center justify-center gap-2">
              <XCircle className="w-5 h-5" />
              {summary.failed}
            </div>
            <div className="text-xs font-semibold text-slate-500 uppercase mt-1">Failed Errors</div>
          </div>
        </div>

        <div className="max-h-[50vh] overflow-y-auto">
          <table className="w-full text-sm text-left">
            <thead className="text-xs text-slate-500 uppercase bg-slate-50 sticky top-0 z-10 shadow-sm">
              <tr>
                <th className="px-6 py-3 font-semibold">Row</th>
                <th className="px-6 py-3 font-semibold">Flat Details</th>
                <th className="px-6 py-3 font-semibold">Status</th>
                <th className="px-6 py-3 font-semibold">Reason</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {results.map((r, idx) => (
                <tr key={idx} className="hover:bg-slate-50">
                  <td className="px-6 py-4 font-medium text-slate-900">#{r.row}</td>
                  <td className="px-6 py-4">
                    <div className="font-medium text-slate-800">{r.block} - {r.flat}</div>
                  </td>
                  <td className="px-6 py-4">
                    <Chip 
                      label={r.status} 
                      size="small" 
                      color={r.status === 'SUCCESS' ? 'success' : r.status === 'FAILED' ? 'error' : 'warning'}
                      variant={r.status === 'SUCCESS' ? 'filled' : 'outlined'}
                      className="font-bold text-[10px]"
                    />
                  </td>
                  <td className="px-6 py-4 text-slate-600 max-w-[200px] truncate" title={r.reason}>
                    {r.reason}
                  </td>
                </tr>
              ))}
              {results.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-6 py-12 text-center text-slate-500">
                    No results to display.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </DialogContent>
      <DialogActions className="p-4 border-t border-slate-100">
        <Button variant="contained" onClick={onClose} sx={{ backgroundColor: '#0a5bd7' }}>
          Done
        </Button>
      </DialogActions>
    </Dialog>
  );
}
