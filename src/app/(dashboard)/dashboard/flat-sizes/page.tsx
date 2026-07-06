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
}

export default function FlatSizesPage() {
  const { showToast, confirm } = useToastConfirm();
  const [sizes, setSizes] = useState<FlatSize[]>([]);
  const [loading, setLoading] = useState(true);

  const [openModal, setOpenModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({ name: '', details: '' });
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
        details: size.details || ''
      });
    } else {
      setEditingId(null);
      setFormData({ name: '', details: '' });
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
          <TextField
            label="Details (Optional)"
            fullWidth
            value={formData.details}
            onChange={(e) => setFormData({ ...formData, details: e.target.value })}
            placeholder="e.g. 1220 sq feet"
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
