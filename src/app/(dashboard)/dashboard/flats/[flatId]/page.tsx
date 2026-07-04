'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import api from '@/lib/api';
import { useToastConfirm } from '@/context/ToastConfirmContext';
import { DataTable, ColumnDef } from '@/components/common/DataTable';
import {
  Button, TextField, Dialog, DialogTitle, DialogContent, DialogActions,
  IconButton, CircularProgress, Tooltip, MenuItem, Select, FormControl, InputLabel,
  Card, CardContent, Typography, Grid, Chip
} from '@mui/material';
import { ArrowLeft, UserPlus, Trash2, ShieldCheck, User } from 'lucide-react';

interface Flat {
  _id: string;
  number: string;
  blockName: string;
  status: string;
  plotNumber?: string;
  fullAddress?: string;
  ownerUserId?: { _id: string; name: string; email: string; phone?: string };
}

interface Resident {
  _id: string;
  userId: { _id: string; name: string; email: string; phone?: string };
  relationship: string;
  isOwner: boolean;
  isActive: boolean;
}

export default function FlatDetailsPage() {
  const params = useParams();
  const router = useRouter();
  const { showToast, confirm } = useToastConfirm();
  const flatId = params.flatId as string;
  
  const [flat, setFlat] = useState<Flat | null>(null);
  const [residents, setResidents] = useState<Resident[]>([]);
  const [loading, setLoading] = useState(true);

  const [openModal, setOpenModal] = useState(false);
  const [formData, setFormData] = useState({ name: '', email: '', phone: '', relationship: 'FAMILY_MEMBER' });
  const [submitting, setSubmitting] = useState(false);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [flatRes, resRes] = await Promise.all([
        api.get(`/societies/flats/${flatId}`),
        api.get(`/societies/flats/${flatId}/residents`)
      ]);
      setFlat(flatRes.data.flat);
      setResidents(resRes.data.residents);
    } catch (err: any) {
      showToast('Failed to load flat details', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flatId]);

  const handleAddResident = async () => {
    if (!formData.name.trim() || !formData.email.trim()) {
      showToast('Name and email are required', 'error');
      return;
    }
    setSubmitting(true);
    try {
      await api.post(`/societies/flats/${flatId}/residents`, {
        name: formData.name,
        email: formData.email,
        phone: formData.phone,
        relationship: formData.relationship
      });
      showToast('Resident added successfully', 'success');
      setOpenModal(false);
      setFormData({ name: '', email: '', phone: '', relationship: 'FAMILY_MEMBER' });
      fetchData();
    } catch (err: any) {
      showToast(err.response?.data?.error || 'Failed to add resident', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleRemoveResident = async (id: string, name: string, isOwner: boolean) => {
    if (isOwner) {
      showToast('Cannot remove primary owner from this view.', 'warning');
      return;
    }

    const isConfirmed = await confirm({
      title: 'Remove Resident',
      message: `Are you sure you want to remove ${name} from this flat?`,
      confirmText: 'Remove',
      severity: 'error'
    });

    if (isConfirmed) {
      try {
        await api.delete(`/societies/residents/${id}`);
        showToast('Resident removed successfully', 'success');
        fetchData();
      } catch (err: any) {
        showToast(err.response?.data?.error || 'Failed to remove resident', 'error');
      }
    }
  };

  const columns: ColumnDef<Resident>[] = [
    {
      id: 'name',
      label: 'Name',
      render: (row) => (
        <div className="flex items-center gap-2">
          {row.isOwner ? <ShieldCheck className="w-4 h-4 text-blue-600" /> : <User className="w-4 h-4 text-slate-400" />}
          <div>
            <span className="font-semibold text-slate-800">{row.userId?.name}</span>
            <div className="text-xs text-slate-500">{row.userId?.email}</div>
          </div>
        </div>
      )
    },
    {
      id: 'relationship',
      label: 'Role',
      render: (row) => (
        <Chip 
          label={row.relationship.replace('_', ' ')} 
          size="small" 
          color={row.isOwner ? 'primary' : 'default'} 
          variant={row.isOwner ? 'filled' : 'outlined'}
        />
      )
    },
    {
      id: 'actions',
      label: 'Actions',
      align: 'right',
      render: (row) => !row.isOwner ? (
        <Tooltip title="Remove">
          <IconButton onClick={() => handleRemoveResident(row._id, row.userId?.name, row.isOwner)} size="small" className="text-red-600 hover:bg-red-50">
            <Trash2 className="w-4 h-4" />
          </IconButton>
        </Tooltip>
      ) : null
    }
  ];

  if (loading) {
    return <div className="flex justify-center py-20"><CircularProgress /></div>;
  }

  if (!flat) {
    return <div className="text-center py-20">Flat not found.</div>;
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="flex items-center gap-4">
        <IconButton onClick={() => router.push('/dashboard/flats')} className="bg-white shadow-sm border border-slate-200">
          <ArrowLeft className="w-5 h-5 text-slate-700" />
        </IconButton>
        <div>
          <h1 className="text-2xl font-black text-slate-800 tracking-tight">Flat {flat.number}</h1>
          <p className="text-sm text-slate-500">{flat.blockName} Block</p>
        </div>
      </div>

      <Grid container spacing={4}>
        <Grid size={{ xs: 12, md: 4 }}>
          <Card elevation={0} className="border border-slate-200/60 rounded-2xl h-full">
            <CardContent className="space-y-4">
              <Typography variant="h6" className="font-bold text-slate-800">Flat Details</Typography>
              
              <div>
                <Typography variant="caption" className="text-slate-400 font-bold uppercase tracking-wider">Status</Typography>
                <div className="mt-1">
                  <Chip label={flat.status.replace('_', ' ')} color="primary" size="small" />
                </div>
              </div>
              
              <div>
                <Typography variant="caption" className="text-slate-400 font-bold uppercase tracking-wider">Address</Typography>
                <Typography variant="body2" className="mt-1 font-medium">{flat.fullAddress || '-'}</Typography>
              </div>
              
              <div>
                <Typography variant="caption" className="text-slate-400 font-bold uppercase tracking-wider">Primary Owner</Typography>
                <Typography variant="body2" className="mt-1 font-semibold">{flat.ownerUserId?.name || 'Vacant'}</Typography>
                {flat.ownerUserId && <Typography variant="caption" className="text-slate-500">{flat.ownerUserId.email}</Typography>}
              </div>
            </CardContent>
          </Card>
        </Grid>
        
        <Grid size={{ xs: 12, md: 8 }}>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-slate-800">Residents ({residents.length})</h2>
            <Button
              variant="contained"
              onClick={() => setOpenModal(true)}
              startIcon={<UserPlus className="w-4 h-4" />}
              sx={{ backgroundColor: '#0a5bd7', '&:hover': { backgroundColor: '#094cb0' } }}
            >
              Add Resident
            </Button>
          </div>
          
          <DataTable
            columns={columns}
            data={residents}
            loading={loading}
            keyExtractor={(row) => row._id}
            emptyText="No residents found."
          />
        </Grid>
      </Grid>

      <Dialog open={openModal} onClose={() => setOpenModal(false)} maxWidth="sm" fullWidth slotProps={{ paper: { className: 'rounded-2xl' } }}>
        <DialogTitle className="font-bold text-slate-800 border-b border-slate-100">
          Add Resident
        </DialogTitle>
        <DialogContent className="pt-6 space-y-4">
          <FormControl fullWidth size="small" required>
            <InputLabel>Relationship</InputLabel>
            <Select
              value={formData.relationship}
              label="Relationship"
              onChange={(e) => setFormData({ ...formData, relationship: e.target.value })}
            >
              <MenuItem value="FAMILY_MEMBER">Family Member</MenuItem>
              <MenuItem value="TENANT">Tenant</MenuItem>
            </Select>
          </FormControl>
          
          <TextField
            autoFocus
            label="Name"
            fullWidth
            size="small"
            required
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          />
          <TextField
            label="Email"
            fullWidth
            size="small"
            required
            type="email"
            value={formData.email}
            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
          />
          <TextField
            label="Phone (Optional)"
            fullWidth
            size="small"
            value={formData.phone}
            onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
          />
          
        </DialogContent>
        <DialogActions className="p-4 border-t border-slate-100">
          <Button onClick={() => setOpenModal(false)} className="text-slate-600">Cancel</Button>
          <Button
            onClick={handleAddResident}
            variant="contained"
            disabled={submitting}
            sx={{ backgroundColor: '#0a5bd7', '&:hover': { backgroundColor: '#094cb0' } }}
          >
            {submitting ? <CircularProgress size={24} color="inherit" /> : 'Add'}
          </Button>
        </DialogActions>
      </Dialog>
    </div>
  );
}
