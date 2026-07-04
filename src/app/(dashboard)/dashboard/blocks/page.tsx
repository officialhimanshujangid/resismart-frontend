'use client';

import React, { useState, useEffect } from 'react';
import api from '@/lib/api';
import { useToastConfirm } from '@/context/ToastConfirmContext';
import { DataTable, ColumnDef } from '@/components/common/DataTable';
import {
  Button, TextField, Dialog, DialogTitle, DialogContent, DialogActions,
  IconButton, CircularProgress, Tooltip
} from '@mui/material';
import { Plus, Edit2, Trash2, Building } from 'lucide-react';
import ModuleScope from '@/components/common/ModuleScope';

interface Block {
  _id: string;
  name: string;
  totalFloors?: number;
  blockType?: string;
  createdAt: string;
}

export default function BlocksPage() {
  const { showToast, confirm } = useToastConfirm();
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [loading, setLoading] = useState(true);

  const [openModal, setOpenModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({ name: '', totalFloors: '', blockType: '' });
  const [submitting, setSubmitting] = useState(false);

  const fetchBlocks = async () => {
    try {
      setLoading(true);
      const res = await api.get('/societies/blocks');
      setBlocks(res.data.blocks);
    } catch (err: any) {
      showToast(err.response?.data?.error || 'Failed to load blocks', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBlocks();
  }, []);

  const handleOpen = (block?: Block) => {
    if (block) {
      setEditingId(block._id);
      setFormData({
        name: block.name,
        totalFloors: block.totalFloors?.toString() || '',
        blockType: block.blockType || ''
      });
    } else {
      setEditingId(null);
      setFormData({ name: '', totalFloors: '', blockType: '' });
    }
    setOpenModal(true);
  };

  const handleClose = () => {
    setOpenModal(false);
  };

  const handleSubmit = async () => {
    if (!formData.name.trim()) {
      showToast('Block name is required', 'error');
      return;
    }
    setSubmitting(true);
    try {
      const payload: any = { name: formData.name.trim() };
      if (formData.totalFloors) payload.totalFloors = parseInt(formData.totalFloors, 10);
      if (formData.blockType) payload.blockType = formData.blockType.trim();

      if (editingId) {
        await api.put(`/societies/blocks/${editingId}`, payload);
        showToast('Block updated successfully', 'success');
      } else {
        await api.post('/societies/blocks', payload);
        showToast('Block created successfully', 'success');
      }
      handleClose();
      fetchBlocks();
    } catch (err: any) {
      showToast(err.response?.data?.error || 'Failed to save block', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    const isConfirmed = await confirm({
      title: 'Delete Block',
      message: `Are you sure you want to delete block "${name}"? This will not delete the associated flats automatically, but it may orphan them.`,
      confirmText: 'Delete',
      severity: 'error'
    });

    if (isConfirmed) {
      try {
        await api.delete(`/societies/blocks/${id}`);
        showToast('Block deleted successfully', 'success');
        fetchBlocks();
      } catch (err: any) {
        showToast(err.response?.data?.error || 'Failed to delete block', 'error');
      }
    }
  };

  const columns: ColumnDef<Block>[] = [
    {
      id: 'name',
      label: 'Block Name',
      render: (row) => <span className="font-semibold text-slate-800">{row.name}</span>
    },
    {
      id: 'totalFloors',
      label: 'Total Floors',
      render: (row) => row.totalFloors || '-'
    },
    {
      id: 'blockType',
      label: 'Type',
      render: (row) => row.blockType || '-'
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
            <h1 className="text-2xl font-black text-slate-800 tracking-tight">Block Management</h1>
            <ModuleScope scope="society" />
          </div>
          <p className="text-sm text-slate-500 mt-1">Manage physical blocks, wings, or towers in your society</p>
        </div>
        <Button
          variant="contained"
          onClick={() => handleOpen()}
          startIcon={<Plus className="w-4 h-4" />}
          sx={{ backgroundColor: '#0a5bd7', '&:hover': { backgroundColor: '#094cb0' } }}
        >
          Add Block
        </Button>
      </div>

      <DataTable
        columns={columns}
        data={blocks}
        loading={loading}
        keyExtractor={(row) => row._id}
        emptyText="No blocks found. Click 'Add Block' to create one."
      />

      <Dialog open={openModal} onClose={handleClose} maxWidth="sm" fullWidth slotProps={{ paper: { className: 'rounded-2xl' } }}>
        <DialogTitle className="font-bold text-slate-800 border-b border-slate-100">
          {editingId ? 'Edit Block' : 'Add New Block'}
        </DialogTitle>
        <DialogContent className="pt-6 space-y-4">
          <TextField
            autoFocus
            label="Block Name"
            fullWidth
            required
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            placeholder="e.g. Tower A, Wing 1"
          />
          <TextField
            label="Total Floors (Optional)"
            fullWidth
            type="number"
            value={formData.totalFloors}
            onChange={(e) => setFormData({ ...formData, totalFloors: e.target.value })}
          />
          <TextField
            label="Block Type (Optional)"
            fullWidth
            value={formData.blockType}
            onChange={(e) => setFormData({ ...formData, blockType: e.target.value })}
            placeholder="e.g. Residential, Commercial"
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
