'use client';

import React, { useState, useEffect } from 'react';
import api from '@/lib/api';
import { useToastConfirm } from '@/context/ToastConfirmContext';
import { DataTable, ColumnDef } from '@/components/common/DataTable';
import {
  Button, TextField, Dialog, DialogTitle, DialogContent, DialogActions,
  IconButton, CircularProgress, Tooltip
} from '@mui/material';
import { Plus, Edit2, Trash2, Maximize } from 'lucide-react';
import ModuleScope from '@/components/common/ModuleScope';

interface FlatSize {
  _id: string;
  name: string;
  details?: string;
  carpetAreaSqft?: number;
  builtUpAreaSqft?: number;
}

export default function FlatSizesPage() {
  const { showToast, confirm } = useToastConfirm();
  const [sizes, setSizes] = useState<FlatSize[]>([]);
  const [loading, setLoading] = useState(true);

  const [openModal, setOpenModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({ name: '', details: '', carpetAreaSqft: '', builtUpAreaSqft: '' });
  const [submitting, setSubmitting] = useState(false);

  const fetchSizes = async () => {
    try {
      setLoading(true);
      const res = await api.get('/flat-sizes');
      setSizes(res.data.flatSizes);
    } catch (err: any) {
      showToast(err.response?.data?.error || 'Failed to load flat sizes', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSizes();
  }, []);

  const handleOpen = (size?: FlatSize) => {
    if (size) {
      setEditingId(size._id);
      setFormData({
        name: size.name,
        details: size.details || '',
        carpetAreaSqft: size.carpetAreaSqft != null ? String(size.carpetAreaSqft) : '',
        builtUpAreaSqft: size.builtUpAreaSqft != null ? String(size.builtUpAreaSqft) : ''
      });
    } else {
      setEditingId(null);
      setFormData({ name: '', details: '', carpetAreaSqft: '', builtUpAreaSqft: '' });
    }
    setOpenModal(true);
  };

  const handleClose = () => {
    setOpenModal(false);
  };

  const handleSubmit = async () => {
    if (!formData.name.trim()) {
      showToast('Name is required', 'error');
      return;
    }
    setSubmitting(true);
    try {
      const payload: any = { name: formData.name.trim() };
      if (formData.details) payload.details = formData.details.trim();
      // Sent even when blank, so clearing an area actually clears it.
      payload.carpetAreaSqft = formData.carpetAreaSqft ? Number(formData.carpetAreaSqft) : undefined;
      payload.builtUpAreaSqft = formData.builtUpAreaSqft ? Number(formData.builtUpAreaSqft) : undefined;

      if (editingId) {
        await api.put(`/flat-sizes/${editingId}`, payload);
        showToast('Flat size updated successfully', 'success');
      } else {
        await api.post('/flat-sizes', payload);
        showToast('Flat size created successfully', 'success');
      }
      handleClose();
      fetchSizes();
    } catch (err: any) {
      showToast(err.response?.data?.error || 'Failed to save flat size', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    const isConfirmed = await confirm({
      title: 'Delete Flat Size',
      message: `Are you sure you want to delete "${name}"? Flats using this size will retain the ID but it will not resolve to a name.`,
      confirmText: 'Delete',
      severity: 'error'
    });

    if (isConfirmed) {
      try {
        await api.delete(`/flat-sizes/${id}`);
        showToast('Flat size deleted successfully', 'success');
        fetchSizes();
      } catch (err: any) {
        showToast(err.response?.data?.error || 'Failed to delete flat size', 'error');
      }
    }
  };

  const columns: ColumnDef<FlatSize>[] = [
    {
      id: 'name',
      label: 'Size Name',
      render: (row) => <span className="font-semibold text-slate-800">{row.name}</span>
    },
    {
      id: 'area',
      label: 'Area (sq. ft.)',
      render: (row) => (row.carpetAreaSqft || row.builtUpAreaSqft)
        ? <span className="text-slate-700">{row.carpetAreaSqft ? `${row.carpetAreaSqft} carpet` : ''}{row.carpetAreaSqft && row.builtUpAreaSqft ? ' · ' : ''}{row.builtUpAreaSqft ? `${row.builtUpAreaSqft} built-up` : ''}</span>
        : <span className="text-amber-600 text-xs font-semibold">not set</span>
    },
    {
      id: 'details',
      label: 'Details',
      render: (row) => row.details || '-'
    },
    {
      id: 'actions',
      label: 'Actions',
      align: 'right',
      render: (row) => (
        <div className="flex justify-end gap-1">
          <Tooltip title="Edit">
            <IconButton onClick={() => handleOpen(row)} size="small" className="text-blue-600 hover:bg-blue-50">
              <Edit2 className="w-4 h-4" />
            </IconButton>
          </Tooltip>
          <Tooltip title="Delete">
            <IconButton onClick={() => handleDelete(row._id, row.name)} size="small" className="text-red-600 hover:bg-red-50">
              <Trash2 className="w-4 h-4" />
            </IconButton>
          </Tooltip>
        </div>
      )
    }
  ];

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-black text-slate-800 tracking-tight">Flat Sizes</h1>
            <ModuleScope scope="society" />
          </div>
          <p className="text-sm text-slate-500 mt-1">Manage standard sizes/configurations for flats (e.g. 3 BHK)</p>
        </div>
        <Button
          variant="contained"
          onClick={() => handleOpen()}
          startIcon={<Plus className="w-4 h-4" />}
          sx={{ backgroundColor: '#0a5bd7', '&:hover': { backgroundColor: '#094cb0' } }}
        >
          Add Flat Size
        </Button>
      </div>

      <DataTable
        columns={columns}
        data={sizes}
        loading={loading}
        keyExtractor={(row) => row._id}
        emptyText="No flat sizes found. Click 'Add Flat Size' to create one."
      />

      <Dialog open={openModal} onClose={handleClose} maxWidth="sm" fullWidth slotProps={{ paper: { className: 'rounded-2xl' } }}>
        <DialogTitle className="font-bold text-slate-800 border-b border-slate-100">
          {editingId ? 'Edit Flat Size' : 'Add New Flat Size'}
        </DialogTitle>
        <DialogContent className="pt-6 flex flex-col gap-4">
          <TextField
            autoFocus
            label="Name (e.g. 3 BHK)"
            fullWidth
            required
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            placeholder="e.g. 3 BHK"
          />
          <div className="grid grid-cols-2 gap-3">
            <TextField
              label="Carpet area (sq. ft.)"
              type="number" fullWidth
              value={formData.carpetAreaSqft}
              onChange={(e) => setFormData({ ...formData, carpetAreaSqft: e.target.value })}
            />
            <TextField
              label="Built-up area (sq. ft.)"
              type="number" fullWidth
              value={formData.builtUpAreaSqft}
              onChange={(e) => setFormData({ ...formData, builtUpAreaSqft: e.target.value })}
            />
          </div>
          <p className="text-xs text-slate-500 -mt-1">
            Every flat of this size bills on this area, so it is entered once here rather than on each flat.
            If two layouts differ — say a 1BHK of 1200 and another of 1500 — make them two sizes.
            Correcting it here fixes every flat of this size at once.
          </p>

          <TextField
            label="Details (Optional)"
            fullWidth
            value={formData.details}
            onChange={(e) => setFormData({ ...formData, details: e.target.value })}
            placeholder="e.g. corner units, east facing"
          />
        </DialogContent>
        <DialogActions className="p-4 border-t border-slate-100">
          <Button onClick={handleClose} className="text-slate-600">Cancel</Button>
          <Button
            onClick={handleSubmit}
            variant="contained"
            disabled={submitting}
            sx={{ backgroundColor: '#0a5bd7', '&:hover': { backgroundColor: '#094cb0' } }}
          >
            {submitting ? <CircularProgress size={24} color="inherit" /> : 'Save'}
          </Button>
        </DialogActions>
      </Dialog>
    </div>
  );
}
