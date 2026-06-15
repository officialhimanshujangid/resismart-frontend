'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import api from '@/lib/api';
import {
  Button,
  TextField,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  IconButton,
  CircularProgress,
  TableContainer,
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
  TablePagination,
  Paper,
  Zoom,
  Typography,
  Collapse,
  FormControl,
  Select,
  MenuItem,
  Grid,
  Switch
} from '@mui/material';
import {
  Plus, Pencil, Trash2, CheckCircle2, XCircle, X, Info, Calendar, UserCheck, SlidersHorizontal, RotateCcw, Search
} from 'lucide-react';
import { useToastConfirm } from '@/context/ToastConfirmContext';

interface Designation {
  _id: string;
  name: string;
  description?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  createdBy?: { _id: string; name: string };
  updatedBy?: { _id: string; name: string };
}

interface FormState {
  name: string;
  description: string;
}

export default function DesignationsPage() {
  const { showToast, confirm } = useToastConfirm();
  const [designations, setDesignations] = useState<Designation[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // ── URL as single source of truth ──────────────────────────────────────
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Derived from URL — these are the "committed" / applied values
  const page     = Math.max(0, parseInt(searchParams.get('page')     || '1',  10) - 1);
  const pageSize =             parseInt(searchParams.get('pageSize') || '10', 10);
  const appliedSearch    = searchParams.get('search')    || '';
  const appliedStatus    = searchParams.get('status')    || 'all';
  const appliedStartDate = searchParams.get('startDate') || '';
  const appliedEndDate   = searchParams.get('endDate')   || '';

  // Draft filter inputs — local until user clicks Apply
  const [showFilters, setShowFilters] = useState(false);
  const [searchTerm,   setSearchTerm]   = useState(appliedSearch);
  const [statusFilter, setStatusFilter] = useState(appliedStatus);
  const [startDate,    setStartDate]    = useState(appliedStartDate);
  const [endDate,      setEndDate]      = useState(appliedEndDate);

  const [modalOpen,   setModalOpen]   = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [editTarget,  setEditTarget]  = useState<Designation | null>(null);
  const [viewTarget,  setViewTarget]  = useState<Designation | null>(null);
  const [form, setForm] = useState<FormState>({ name: '', description: '' });
  const [totalCount, setTotalCount] = useState(0);

  // refreshKey: bump after CRUD to re-fetch without changing URL
  const [refreshKey, setRefreshKey] = useState(0);
  const fetchDesignations = () => setRefreshKey(k => k + 1);

  /** Push filter / pagination updates into the URL */
  const updateUrl = (updates: Record<string, string>) => {
    const params = new URLSearchParams(searchParams.toString());
    const DEFAULTS: Record<string, string> = { page: '1', pageSize: '10', status: 'all', search: '', startDate: '', endDate: '' };
    Object.entries(updates).forEach(([key, value]) => {
      if (!value || value === DEFAULTS[key]) params.delete(key);
      else params.set(key, value);
    });
    router.push(`${pathname}?${params.toString()}`, { scroll: false });
  };

  // Re-fetch whenever URL-derived params or refreshKey change
  useEffect(() => {
    const doFetch = async () => {
      try {
        setLoading(true);
        const params = new URLSearchParams();
        params.append('includeInactive', 'true');
        params.append('isPagination', 'true');
        params.append('page', String(page + 1));
        params.append('pageSize', String(pageSize));
        if (appliedSearch)            params.append('search',    appliedSearch);
        if (appliedStatus !== 'all') params.append('status',    appliedStatus);
        if (appliedStartDate)         params.append('startDate', appliedStartDate);
        if (appliedEndDate)           params.append('endDate',   appliedEndDate);
        const res = await api.get(`/designations?${params.toString()}`);
        setDesignations(res.data.designations);
        setTotalCount(res.data.pagination?.total ?? 0);
      } catch {
        showToast('Failed to load designations', 'error');
      } finally {
        setLoading(false);
      }
    };
    doFetch();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, pageSize, appliedSearch, appliedStatus, appliedStartDate, appliedEndDate, refreshKey]);

  const handleApplyFilters = () => {
    updateUrl({ search: searchTerm, status: statusFilter, startDate, endDate, page: '1' });
  };

  const handleResetFilters = () => {
    setSearchTerm('');
    setStatusFilter('all');
    setStartDate('');
    setEndDate('');
    router.push(pathname, { scroll: false });
  };

  const activeFiltersCount =
    (appliedSearch    ? 1 : 0) +
    (appliedStatus    !== 'all' ? 1 : 0) +
    (appliedStartDate ? 1 : 0) +
    (appliedEndDate   ? 1 : 0);

  const openCreate = () => {
    setEditTarget(null);
    setForm({ name: '', description: '' });
    setModalOpen(true);
  };

  const openEdit = (d: Designation) => {
    setEditTarget(d);
    setForm({ name: d.name, description: d.description || '' });
    setModalOpen(true);
  };

  const openDetails = (d: Designation) => {
    setViewTarget(d);
    setDetailsOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (editTarget) {
        await api.put(`/designations/${editTarget._id}`, form);
        showToast('Designation updated successfully', 'success');
      } else {
        await api.post('/designations', form);
        showToast('Designation created successfully', 'success');
      }
      setModalOpen(false);
      fetchDesignations();
    } catch (err: any) {
      showToast(err.response?.data?.error || 'Failed to save designation', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async (d: Designation) => {
    try {
      await api.put(`/designations/${d._id}`, { isActive: !d.isActive });
      showToast(`Designation ${!d.isActive ? 'activated' : 'deactivated'} successfully`, 'success');
      fetchDesignations();
    } catch {
      showToast('Failed to update status', 'error');
    }
  };

  const handleDelete = async (d: Designation) => {
    const confirmed = await confirm({
      title: 'Deactivate Designation',
      message: `Are you sure you want to deactivate the designation "${d.name}"?`,
      confirmText: 'Deactivate',
      cancelText: 'Cancel',
      severity: 'error'
    });
    if (!confirmed) return;
    try {
      await api.delete(`/designations/${d._id}`);
      showToast('Designation deactivated successfully', 'success');
      fetchDesignations();
    } catch {
      showToast('Failed to deactivate designation', 'error');
    }
  };

  const formatDate = (isoString?: string) => {
    if (!isoString) return '—';
    return new Date(isoString).toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-800 tracking-tight">Designations</h1>
          <p className="text-sm text-slate-500 mt-0.5">Manage employee designations / job titles</p>
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto justify-start sm:justify-end">
          <Button
            onClick={() => setShowFilters(!showFilters)}
            variant={showFilters || activeFiltersCount > 0 ? "contained" : "outlined"}
            color={activeFiltersCount > 0 ? "primary" : "inherit"}
            startIcon={<SlidersHorizontal className="w-4 h-4" />}
            className="transition-all hover:scale-[1.02] active:scale-[0.98] border-slate-205 text-slate-700 hover:bg-slate-50 flex-1 sm:flex-none"
            style={{
              borderColor: activeFiltersCount > 0 ? undefined : '#cbd5e1',
              color: showFilters || activeFiltersCount > 0 ? '#ffffff' : '#475569',
              backgroundColor: showFilters || activeFiltersCount > 0 ? undefined : '#ffffff',
              whiteSpace: 'nowrap'
            }}
          >
            Filters {activeFiltersCount > 0 && `(${activeFiltersCount})`}
          </Button>
          <Button
            onClick={openCreate}
            variant="contained"
            startIcon={<Plus className="w-4 h-4" />}
            className="transition-all hover:scale-[1.02] active:scale-[0.98] flex-1 sm:flex-none"
            sx={{ whiteSpace: 'nowrap' }}
          >
            Add Designation
          </Button>
        </div>
      </div>

      {/* Collapsible Filters Panel */}
      <Collapse in={showFilters}>
        <Paper
          elevation={0}
          className="p-5 rounded-2xl border border-slate-200/60 bg-slate-50/40 space-y-4"
        >
          <div className="flex items-center justify-between">
            <Typography className="text-xs font-black uppercase tracking-wider text-slate-450 flex items-center gap-1.5">
              <SlidersHorizontal className="w-3.5 h-3.5 text-slate-500" /> Filter Criteria
            </Typography>
            {(activeFiltersCount > 0 || searchTerm || statusFilter !== 'all' || startDate || endDate) && (
              <Button
                size="small"
                variant="text"
                color="primary"
                onClick={handleResetFilters}
                startIcon={<RotateCcw className="w-3.5 h-3.5" />}
                className="font-bold text-xs text-slate-500 hover:text-[#0a5bd7] hover:bg-transparent p-0"
              >
                Clear all filters
              </Button>
            )}
          </div>

          <Grid container spacing={2}>
            <Grid size={{ xs: 12, md: 4 }} className="space-y-1">
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">Search text</span>
              <TextField
                hiddenLabel
                fullWidth
                variant="outlined"
                placeholder="Search name or description..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                slotProps={{
                  input: {
                    className: "font-semibold text-sm bg-white rounded-xl",
                    startAdornment: <Search className="w-4 h-4 text-slate-400 mr-2" />,
                    endAdornment: searchTerm && (
                      <IconButton size="small" onClick={() => setSearchTerm('')}>
                        <X className="w-4 h-4 text-slate-400" />
                      </IconButton>
                    )
                  }
                }}
              />
            </Grid>

            <Grid size={{ xs: 12, sm: 4, md: 2 }} className="space-y-1">
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">Status</span>
              <FormControl fullWidth variant="outlined">
                <Select
                  value={statusFilter}
                  onChange={e => setStatusFilter(e.target.value as string)}
                  className="bg-white rounded-xl font-semibold text-sm"
                  slotProps={{
                    input: { className: "font-semibold text-sm" }
                  }}
                >
                  <MenuItem value="all" className="font-semibold text-sm">All Statuses</MenuItem>
                  <MenuItem value="active" className="font-semibold text-sm">Active</MenuItem>
                  <MenuItem value="inactive" className="font-semibold text-sm">Inactive</MenuItem>
                </Select>
              </FormControl>
            </Grid>

            <Grid size={{ xs: 12, sm: 4, md: 3 }} className="space-y-1">
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">Created From</span>
              <TextField
                type="date"
                hiddenLabel
                fullWidth
                variant="outlined"
                value={startDate}
                onChange={e => setStartDate(e.target.value)}
                slotProps={{
                  input: { className: "font-semibold text-sm bg-white rounded-xl text-slate-800" }
                }}
              />
            </Grid>

            <Grid size={{ xs: 12, sm: 4, md: 3 }} className="space-y-1">
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">Created To</span>
              <TextField
                type="date"
                hiddenLabel
                fullWidth
                variant="outlined"
                value={endDate}
                onChange={e => setEndDate(e.target.value)}
                slotProps={{
                  input: { className: "font-semibold text-sm bg-white rounded-xl text-slate-800" }
                }}
              />
            </Grid>
          </Grid>

          {/* Apply Filters Button */}
          <div className="flex justify-end pt-1">
            <Button
              variant="contained"
              size="small"
              onClick={handleApplyFilters}
              startIcon={<Search className="w-3.5 h-3.5" />}
              className="font-bold text-xs px-4"
            >
              Apply Filters
            </Button>
          </div>
        </Paper>
      </Collapse>

      {/* Table Container */}
      <TableContainer
        component={Paper}
        elevation={1}
        className="rounded-2xl border border-slate-200/60 shadow-sm overflow-x-auto no-scrollbar animate-in slide-in-from-bottom-3 duration-300 delay-150"
      >


        {loading ? (
          <div className="flex items-center justify-center py-20 bg-white">
            <CircularProgress size={32} thickness={4} />
          </div>
        ) : designations.length === 0 ? (
          <div className="text-center py-20 text-slate-450 font-semibold text-sm bg-white">
            No designations yet. Click "Add Designation" to create one.
          </div>
        ) : (
          <Table sx={{ minWidth: 1000 }}>
            <TableHead>
              <TableRow>
                <TableCell sx={{ width: 70 }}>S.No.</TableCell>
                <TableCell>Name</TableCell>
                <TableCell>Description</TableCell>
                <TableCell>Created By</TableCell>
                <TableCell>Created At</TableCell>
                <TableCell>Updated By</TableCell>
                <TableCell>Updated At</TableCell>
                <TableCell>Status</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody className="bg-white">
              {designations.map((d, index) => (
                <TableRow
                  key={d._id}
                  className="animate-in fade-in slide-in-from-bottom-2 duration-300"
                  style={{ animationDelay: `${index * 45}ms` }}
                >
                  <TableCell className="font-semibold text-slate-500">{page * pageSize + index + 1}</TableCell>
                  <TableCell className="font-bold text-slate-800">{d.name}</TableCell>
                  <TableCell className="text-slate-500 max-w-xs truncate">{d.description || '—'}</TableCell>
                  <TableCell>
                    <span className="font-semibold text-slate-600">{d.createdBy?.name || 'Owner'}</span>
                  </TableCell>
                  <TableCell className="font-mono text-xs text-slate-500">
                    {formatDate(d.createdAt)}
                  </TableCell>
                  <TableCell>
                    <span className="font-semibold text-slate-600">{d.updatedBy?.name || '—'}</span>
                  </TableCell>
                  <TableCell className="font-mono text-xs text-slate-500">
                    {d.updatedBy ? formatDate(d.updatedAt) : '—'}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1.5">
                      <Switch
                        checked={d.isActive}
                        onChange={() => handleToggleActive(d)}
                        color="primary"
                        size="small"
                        sx={{
                          '& .MuiSwitch-switchBase.Mui-checked': {
                            color: '#10b981',
                          },
                          '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': {
                            backgroundColor: '#10b981',
                          },
                        }}
                      />
                      <span className={`text-xs font-bold ${d.isActive ? 'text-emerald-600' : 'text-slate-450'}`}>
                        {d.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell align="right">
                    <div className="flex items-center justify-end gap-1">
                      <IconButton
                        onClick={() => openDetails(d)}
                        size="small"
                        className="bg-slate-100 hover:bg-violet-50 hover:text-violet-600 text-slate-500 rounded-xl p-2"
                      >
                        <Info className="w-4 h-4" />
                      </IconButton>
                      <IconButton
                        onClick={() => openEdit(d)}
                        size="small"
                        className="bg-slate-100 hover:bg-blue-50 hover:text-blue-600 text-slate-500 rounded-xl p-2"
                      >
                        <Pencil className="w-4 h-4" />
                      </IconButton>
                      <IconButton
                        onClick={() => handleDelete(d)}
                        size="small"
                        className="bg-slate-100 hover:bg-red-50 hover:text-red-650 text-slate-500 rounded-xl p-2"
                      >
                        <Trash2 className="w-4 h-4" />
                      </IconButton>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
        <TablePagination
          component="div"
          count={totalCount}
          page={page}
          onPageChange={(_, newPage) => updateUrl({ page: String(newPage + 1) })}
          rowsPerPage={pageSize}
          onRowsPerPageChange={(e) => updateUrl({ pageSize: e.target.value, page: '1' })}
          rowsPerPageOptions={[5, 10, 25, 50]}
          sx={{
            borderTop: '1px solid #f1f5f9',
            backgroundColor: '#ffffff',
            '.MuiTablePagination-selectLabel, .MuiTablePagination-displayedRows': {
              fontSize: '0.75rem',
              fontWeight: 600,
              color: '#64748b'
            }
          }}
        />
      </TableContainer>

      {/* Modal Dialog */}
      <Dialog
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        slots={{ transition: Zoom }}
        maxWidth="xs"
        fullWidth
        scroll="paper"
        slotProps={{
          paper: {
            sx: {
              maxHeight: 'calc(100% - 48px)',
              margin: '24px 16px',
              width: 'calc(100% - 32px)'
            }
          }
        }}
      >
        <DialogTitle className="flex justify-between items-center pr-3">
          <span>{editTarget ? 'Edit Designation' : 'New Designation'}</span>
          <IconButton onClick={() => setModalOpen(false)} size="small" className="text-slate-400 hover:text-slate-600">
            <X className="w-5 h-5" />
          </IconButton>
        </DialogTitle>

        <form onSubmit={handleSubmit}>
          <DialogContent className="space-y-4">
            <div className="space-y-1">
              <span className="text-xs font-black uppercase tracking-wider text-slate-450">Name *</span>
              <TextField
                hiddenLabel
                required
                fullWidth
                variant="outlined"
                placeholder="e.g. Senior Manager"
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                slotProps={{
                  input: { className: "font-semibold text-sm" }
                }}
              />
            </div>

            <div className="space-y-1">
              <span className="text-xs font-black uppercase tracking-wider text-slate-455">Description</span>
              <TextField
                hiddenLabel
                fullWidth
                multiline
                rows={3}
                variant="outlined"
                placeholder="Optional description..."
                value={form.description}
                onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                slotProps={{
                  input: { className: "font-semibold text-sm" }
                }}
              />
            </div>
          </DialogContent>

          <DialogActions className="p-5 pt-0 gap-2">
            <Button
              onClick={() => setModalOpen(false)}
              variant="outlined"
              fullWidth
              className="py-2.5 font-bold"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={saving}
              variant="contained"
              fullWidth
              className="py-2.5 font-bold"
            >
              {saving ? <CircularProgress size={20} color="inherit" /> : editTarget ? 'Save Changes' : 'Create'}
            </Button>
          </DialogActions>
        </form>
      </Dialog>

      {/* Details Dialog */}
      <Dialog
        open={detailsOpen}
        onClose={() => setDetailsOpen(false)}
        slots={{ transition: Zoom }}
        maxWidth="xs"
        fullWidth
        scroll="paper"
        slotProps={{
          paper: {
            sx: {
              maxHeight: 'calc(100% - 48px)',
              margin: '24px 16px',
              width: 'calc(100% - 32px)'
            }
          }
        }}
      >
        {viewTarget && (
          <>
            <DialogTitle className="flex justify-between items-center pr-3">
              <div className="flex items-center gap-2">
                <span>Designation Details</span>
                <span className={`text-[9px] uppercase px-2 py-0.5 rounded-full font-black border ${viewTarget.isActive
                    ? 'bg-emerald-50 text-emerald-600 border-emerald-100'
                    : 'bg-slate-100 text-slate-500 border-slate-200'
                  }`}>
                  {viewTarget.isActive ? 'Active' : 'Inactive'}
                </span>
              </div>
              <IconButton onClick={() => setDetailsOpen(false)} size="small" className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </IconButton>
            </DialogTitle>

            <DialogContent className="space-y-5">
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200/50">
                <h3 className="font-extrabold text-slate-800 text-base">{viewTarget.name}</h3>
                <p className="text-sm text-slate-500 mt-1.5 leading-normal">{viewTarget.description || 'No description provided.'}</p>
              </div>

              {/* Logs card */}
              <div className="bg-slate-50/50 p-4 rounded-2xl border border-slate-100 space-y-3 text-xs text-slate-650">
                <p className="text-xs font-black uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                  <UserCheck className="w-3.5 h-3.5 text-slate-400" /> Audit trail logs
                </p>
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between py-1 border-b border-slate-100/60">
                    <span className="font-bold text-slate-500">Created by</span>
                    <span className="text-slate-850 font-semibold">{viewTarget.createdBy?.name || 'System / Owner'}</span>
                  </div>
                  <div className="flex items-center justify-between py-1 border-b border-slate-100/60">
                    <span className="font-bold text-slate-500">Created at</span>
                    <span className="text-slate-850 font-mono flex items-center gap-1"><Calendar className="w-3 h-3 text-slate-400" /> {formatDate(viewTarget.createdAt)}</span>
                  </div>
                  {viewTarget.updatedBy && (
                    <>
                      <div className="flex items-center justify-between py-1 border-b border-slate-100/60">
                        <span className="font-bold text-slate-500">Updated by</span>
                        <span className="text-slate-850 font-semibold">{viewTarget.updatedBy.name}</span>
                      </div>
                      <div className="flex items-center justify-between py-1">
                        <span className="font-bold text-slate-500">Last updated at</span>
                        <span className="text-slate-850 font-mono flex items-center gap-1"><Calendar className="w-3 h-3 text-slate-400" /> {formatDate(viewTarget.updatedAt)}</span>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </DialogContent>

            <DialogActions className="p-5 pt-0">
              <Button
                onClick={() => setDetailsOpen(false)}
                variant="outlined"
                fullWidth
                className="py-2.5 font-bold"
              >
                Close
              </Button>
            </DialogActions>
          </>
        )}
      </Dialog>
    </div>
  );
}
