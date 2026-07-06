'use client';

import React, { useState, useEffect, useRef } from 'react';
import api from '@/lib/api';
import { useToastConfirm } from '@/context/ToastConfirmContext';
import { DataTable, ColumnDef } from '@/components/common/DataTable';
import {
  Button, TextField, IconButton, Tooltip, Chip
} from '@mui/material';
import { Plus, Edit2, Trash2, Upload, Download } from 'lucide-react';
import ModuleScope from '@/components/common/ModuleScope';
import { useRouter } from 'next/navigation';
import BulkUploadResultModal, { BulkUploadSummary, BulkUploadResultRow } from '@/components/societies/BulkUploadResultModal';

interface Flat {
  _id: string;
  number: string;
  blockName: string;
  blockId: { _id: string; name: string } | string;
  status: string;
  ownerUserId?: { _id: string; name: string; email: string; phone?: string };
  size?: { _id: string; name: string };
  fullAddress?: string;
}

interface Block {
  _id: string;
  name: string;
}

interface FlatSize {
  _id: string;
  name: string;
  details?: string;
}

export default function FlatsPage() {
  const router = useRouter();
  const { showToast, confirm } = useToastConfirm();
  const [flats, setFlats] = useState<Flat[]>([]);
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [flatSizes, setFlatSizes] = useState<FlatSize[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [pagination, setPagination] = useState({ page: 0, pageSize: 10, total: 0 });
  const [search, setSearch] = useState('');
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [modalOpen, setModalOpen] = useState(false);
  const [uploadSummary, setUploadSummary] = useState<BulkUploadSummary | null>(null);
  const [uploadResults, setUploadResults] = useState<BulkUploadResultRow[]>([]);

  const fetchBlocks = async () => {
    try {
      const res = await api.get('/societies/blocks');
      setBlocks(res.data.blocks);
    } catch (err: any) {
      showToast('Failed to load blocks', 'error');
    }
  };

  const fetchFlatSizes = async () => {
    try {
      const res = await api.get('/flat-sizes');
      setFlatSizes(res.data.flatSizes);
    } catch (err: any) {
      console.warn('Failed to load flat sizes', err);
    }
  };

  const fetchFlats = async () => {
    try {
      setLoading(true);
      const res = await api.get('/societies/flats', {
        params: {
          isPagination: true,
          page: pagination.page + 1,
          pageSize: pagination.pageSize,
          search
        }
      });
      setFlats(res.data.flats);
      setPagination(prev => ({ ...prev, total: res.data.pagination.total }));
    } catch (err: any) {
      showToast(err.response?.data?.error || 'Failed to load flats', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBlocks();
    fetchFlatSizes();
  }, []);

  useEffect(() => {
    fetchFlats();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pagination.page, pagination.pageSize, search]);

  const handleOpen = (flat?: Flat) => {
    if (flat) {
      router.push(`/dashboard/flats/${flat._id}/edit`);
    } else {
      router.push(`/dashboard/flats/create`);
    }
  };

  const handleDelete = async (id: string, number: string) => {
    const isConfirmed = await confirm({
      title: 'Delete Flat',
      message: `Are you sure you want to delete flat "${number}"? This will also remove any resident associations.`,
      confirmText: 'Delete',
      severity: 'error'
    });

    if (isConfirmed) {
      try {
        await api.delete(`/societies/flats/${id}`);
        showToast('Flat deleted successfully', 'success');
        fetchFlats();
      } catch (err: any) {
        showToast(err.response?.data?.error || 'Failed to delete flat', 'error');
      }
    }
  };
  
  const handleDownloadTemplate = async () => {
    try {
      const response = await api.get('/societies/flats/bulk-upload-template', { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', 'flats_bulk_upload_template.xlsx');
      document.body.appendChild(link);
      link.click();
      link.parentNode?.removeChild(link);
    } catch (err) {
      showToast('Failed to download template', 'error');
    }
  };
  
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    const formData = new FormData();
    formData.append('file', file);
    
    setLoading(true);
    try {
      const res = await api.post('/societies/flats/bulk-upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      
      setUploadSummary(res.data.summary);
      setUploadResults(res.data.results);
      setModalOpen(true);
      fetchFlats();
    } catch (err: any) {
      showToast(err.response?.data?.error || 'Bulk upload failed', 'error');
    } finally {
      setLoading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const columns: ColumnDef<Flat>[] = [
    {
      id: 'number',
      label: 'Flat / Unit',
      render: (row) => (
        <div>
          <a href={`/dashboard/flats/${row._id}`} className="font-semibold text-blue-700 hover:underline">
            {row.number}
          </a>
          <div className="text-xs text-slate-500">{row.blockName}</div>
        </div>
      )
    },
    {
      id: 'owner',
      label: 'Flat/Plot Owner',
      render: (row) => row.ownerUserId ? (
        <div>
          <span className="text-sm">{row.ownerUserId.name}</span>
          <div className="text-xs text-slate-500">{row.ownerUserId.email}</div>
        </div>
      ) : <span className="text-slate-400 italic text-sm">Vacant</span>
    },
    {
      id: 'status',
      label: 'Status',
      render: (row) => (
        <Chip 
          label={row.status.replace('_', ' ')} 
          size="small" 
          color={row.status === 'VACANT' ? 'default' : row.status === 'OWNER_OCCUPIED' ? 'primary' : 'secondary'} 
          variant={row.status === 'VACANT' ? 'outlined' : 'filled'}
          sx={{ fontSize: '0.7rem', fontWeight: 600, height: 24 }}
        />
      )
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
            <IconButton onClick={() => handleDelete(row._id, row.number)} size="small" className="text-red-600 hover:bg-red-50">
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
            <h1 className="text-2xl font-black text-slate-800 tracking-tight">Flats Directory</h1>
            <ModuleScope scope="society" />
          </div>
          <p className="text-sm text-slate-500 mt-1">Manage all flats, apartments, or units in your society</p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outlined"
            onClick={handleDownloadTemplate}
            startIcon={<Download className="w-4 h-4" />}
            sx={{ borderColor: '#e2e8f0', color: '#64748b', '&:hover': { backgroundColor: '#f8fafc', borderColor: '#cbd5e1' } }}
          >
            Template
          </Button>
          <Button
            variant="outlined"
            onClick={() => fileInputRef.current?.click()}
            startIcon={<Upload className="w-4 h-4" />}
            sx={{ borderColor: '#e2e8f0', color: '#0a5bd7', '&:hover': { backgroundColor: '#eff6ff', borderColor: '#bfdbfe' } }}
          >
            Bulk Upload
          </Button>
          <input type="file" ref={fileInputRef} className="hidden" accept=".xlsx,.xls" onChange={handleFileUpload} />
          
          <Button
            variant="contained"
            onClick={() => handleOpen()}
            startIcon={<Plus className="w-4 h-4" />}
            sx={{ backgroundColor: '#0a5bd7', '&:hover': { backgroundColor: '#094cb0' } }}
          >
            Add Flat
          </Button>
        </div>
      </div>

      <div className="flex gap-4 mb-4">
        <TextField
          size="small"
          placeholder="Search flats by number, block or address..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          sx={{ width: 350, backgroundColor: 'white', borderRadius: 1 }}
        />
      </div>

      <DataTable
        columns={columns}
        data={flats}
        loading={loading}
        keyExtractor={(row) => row._id}
        emptyText="No flats found. Click 'Add New Flat' or use 'Bulk Upload' to add properties."
        pagination={{
          page: pagination.page,
          pageSize: pagination.pageSize,
          total: pagination.total,
          onPageChange: (p) => setPagination(prev => ({ ...prev, page: p })),
          onPageSizeChange: (s) => setPagination(prev => ({ ...prev, pageSize: s, page: 0 }))
        }}
      />
      <BulkUploadResultModal 
        open={modalOpen} 
        onClose={() => setModalOpen(false)} 
        summary={uploadSummary} 
        results={uploadResults} 
      />
    </div>
  );
}
