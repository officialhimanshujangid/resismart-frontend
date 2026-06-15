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
  Collapse,
  Checkbox,
  Typography,
  FormControl,
  Select,
  MenuItem,
  Grid,
  Switch
} from '@mui/material';
import {
  Plus, Pencil, Trash2, CheckCircle2, XCircle, X, ChevronDown, ChevronUp, ShieldCheck, Calendar, UserCheck, SlidersHorizontal, RotateCcw, Search
} from 'lucide-react';
import { getSidebarLinks, SidebarLink } from '@/components/layout/sidebarContent';
import { useToastConfirm } from '@/context/ToastConfirmContext';

export interface PermissionModule {
  key: string;
  label: string;
  isChild: boolean;
  parentKey?: string;
  depth: number;
}

// Dynamically extract permission modules based on system employee links
const systemEmployeeLinks = getSidebarLinks('SYSTEM_EMPLOYEE');

const getModulesFromLinks = (links: SidebarLink[]): PermissionModule[] => {
  const modules: PermissionModule[] = [];

  const traverse = (items: SidebarLink[], depth = 0, parentKey?: string) => {
    for (const item of items) {
      if (item.moduleKey && item.moduleKey !== 'overview') {
        modules.push({
          key: item.moduleKey,
          label: item.label,
          isChild: depth > 0,
          parentKey,
          depth
        });

        if (item.children) {
          traverse(item.children, depth + 1, item.moduleKey);
        }
      }
    }
  };

  traverse(links);
  return modules;
};

const ALL_MODULES = getModulesFromLinks(systemEmployeeLinks);

interface ModulePermission {
  module: string;
  moduleLabel: string;
  canRead: boolean;
  canCreate: boolean;
  canEdit: boolean;
  canDelete: boolean;
}

interface PermissionRole {
  _id: string;
  name: string;
  description?: string;
  permissions: ModulePermission[];
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  createdBy?: { _id: string; name: string };
  updatedBy?: { _id: string; name: string };
}

const defaultPermissions = (): ModulePermission[] =>
  ALL_MODULES.map(m => ({
    module: m.key,
    moduleLabel: m.label,
    canRead: false,
    canCreate: false,
    canEdit: false,
    canDelete: false,
  }));

export default function PermissionRolesPage() {
  const { showToast, confirm } = useToastConfirm();
  const [roles, setRoles] = useState<PermissionRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [expandedRole, setExpandedRole] = useState<string | null>(null);

  // ── URL as single source of truth ──────────────────────────────────────
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Derived from URL — committed / applied values
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
  const [editTarget,  setEditTarget]  = useState<PermissionRole | null>(null);
  const [name,        setName]        = useState('');
  const [description, setDescription] = useState('');
  const [permissions, setPermissions] = useState<ModulePermission[]>(defaultPermissions());
  const [totalCount,  setTotalCount]  = useState(0);

  // refreshKey: bump after CRUD to re-fetch without changing URL
  const [refreshKey, setRefreshKey] = useState(0);
  const fetchRoles = () => setRefreshKey(k => k + 1);

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
        const res = await api.get(`/permission-roles?${params.toString()}`);
        setRoles(res.data.roles);
        setTotalCount(res.data.pagination?.total ?? 0);
      } catch {
        showToast('Failed to load permission roles', 'error');
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
    setName('');
    setDescription('');
    setPermissions(defaultPermissions());
    setModalOpen(true);
  };

  const syncPermissions = (nextPerms: ModulePermission[]): ModulePermission[] => {
    const copy = nextPerms.map(p => ({ ...p }));

    // 1. Recursive Parent Auto-Grant:
    // Toggling a child permission cascades Read access up to all grandparent menus.
    let changed = true;
    for (let runs = 0; runs < 5 && changed; runs++) {
      changed = false;
      ALL_MODULES.forEach(m => {
        if (m.parentKey) {
          const childPerm = copy.find(p => p.module === m.key);
          if (childPerm && (childPerm.canRead || childPerm.canCreate || childPerm.canEdit || childPerm.canDelete)) {
            const parentPerm = copy.find(p => p.module === m.parentKey);
            if (parentPerm && !parentPerm.canRead) {
              parentPerm.canRead = true;
              changed = true;
            }
          }
        }
      });
    }

    // 2. Recursive Child Auto-Reset:
    // If a parent's Read permission is disabled, it recursively resets all downstream children.
    changed = true;
    for (let runs = 0; runs < 5 && changed; runs++) {
      changed = false;
      ALL_MODULES.forEach(m => {
        const currentPerm = copy.find(p => p.module === m.key);
        if (currentPerm && !currentPerm.canRead) {
          ALL_MODULES.filter(child => child.parentKey === m.key).forEach(child => {
            const childPerm = copy.find(p => p.module === child.key);
            if (childPerm && (childPerm.canRead || childPerm.canCreate || childPerm.canEdit || childPerm.canDelete)) {
              childPerm.canRead = false;
              childPerm.canCreate = false;
              childPerm.canEdit = false;
              childPerm.canDelete = false;
              changed = true;
            }
          });
        }
      });
    }

    return copy;
  };

  const openEdit = (role: PermissionRole) => {
    setEditTarget(role);
    setName(role.name);
    setDescription(role.description || '');
    // Merge saved permissions onto the full module list
    const merged = ALL_MODULES.map(m => {
      const saved = role.permissions.find(p => p.module === m.key);
      return saved
        ? { ...saved }
        : { module: m.key, moduleLabel: m.label, canRead: false, canCreate: false, canEdit: false, canDelete: false };
    });
    setPermissions(syncPermissions(merged));
    setModalOpen(true);
  };

  const togglePerm = (moduleKey: string, field: keyof Omit<ModulePermission, 'module' | 'moduleLabel'>) => {
    setPermissions(prev => {
      const next = prev.map(p => {
        if (p.module !== moduleKey) return p;
        const updated = { ...p, [field]: !p[field] };
        // If canRead is turned off, clear all others for this module
        if (field === 'canRead' && !updated.canRead) {
          updated.canCreate = false;
          updated.canEdit = false;
          updated.canDelete = false;
        }
        // If any action is enabled, auto-enable read for this module
        if (field !== 'canRead' && updated[field]) {
          updated.canRead = true;
        }
        return updated;
      });
      return syncPermissions(next);
    });
  };

  const toggleAll = (field: keyof Omit<ModulePermission, 'module' | 'moduleLabel'>, value: boolean) => {
    setPermissions(prev => {
      const next = prev.map(p => {
        const updated = { ...p, [field]: value };
        if (field === 'canRead' && !value) {
          updated.canCreate = false;
          updated.canEdit = false;
          updated.canDelete = false;
        }
        if (field !== 'canRead' && value) {
          updated.canRead = true;
        }
        return updated;
      });
      return syncPermissions(next);
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = { name, description, permissions };
      if (editTarget) {
        await api.put(`/permission-roles/${editTarget._id}`, payload);
        showToast('Permission role updated successfully', 'success');
      } else {
        await api.post('/permission-roles', payload);
        showToast('Permission role created successfully', 'success');
      }
      setModalOpen(false);
      fetchRoles();
    } catch (err: any) {
      showToast(err.response?.data?.error || 'Failed to save permission role', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async (role: PermissionRole) => {
    try {
      await api.put(`/permission-roles/${role._id}`, { isActive: !role.isActive });
      showToast(`Permission role ${!role.isActive ? 'activated' : 'deactivated'} successfully`, 'success');
      fetchRoles();
    } catch {
      showToast('Failed to update status', 'error');
    }
  };

  const handleDelete = async (role: PermissionRole) => {
    const confirmed = await confirm({
      title: 'Deactivate Role',
      message: `Are you sure you want to deactivate the role "${role.name}"?`,
      confirmText: 'Deactivate',
      cancelText: 'Cancel',
      severity: 'error'
    });
    if (!confirmed) return;
    try {
      await api.delete(`/permission-roles/${role._id}`);
      showToast('Permission role deactivated successfully', 'success');
      fetchRoles();
    } catch {
      showToast('Failed to deactivate role', 'error');
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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-800 tracking-tight">Permission Roles</h1>
          <p className="text-sm text-slate-500 mt-0.5">Define access control roles for system employees</p>
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
            New Role
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

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <CircularProgress size={32} thickness={4} />
        </div>
      ) : (
        <>
          {roles.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-200/60 shadow-sm p-20 text-center text-slate-450 font-semibold text-sm">
              No permission roles yet. Click "New Role" to create one.
            </div>
          ) : (
            <>
              <div className="space-y-4">
                {roles.map((role, idx) => (
                  <Paper
                    key={role._id}
                    elevation={1}
                    className="bg-white rounded-2xl border border-slate-200/60 overflow-hidden animate-in slide-in-from-bottom-3 duration-300"
                    style={{ animationDelay: `${idx * 50}ms` }}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 px-6 py-4">
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-xl bg-violet-50 border border-violet-100 flex items-center justify-center">
                          <ShieldCheck className="w-5 h-5 text-violet-600" />
                        </div>
                        <div>
                          <p className="font-extrabold text-slate-800">{role.name}</p>
                          <p className="text-xs text-slate-400 mt-0.5">
                            {role.permissions.filter(p => p.canRead).length} / {ALL_MODULES.length} modules accessible &bull; Created by {role.createdBy?.name || 'Owner'}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                        <div className="flex items-center gap-1.5">
                          <Switch
                            checked={role.isActive}
                            onChange={() => handleToggleActive(role)}
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
                          <span className={`text-xs font-bold ${role.isActive ? 'text-emerald-600' : 'text-slate-450'}`}>
                            {role.isActive ? 'Active' : 'Inactive'}
                          </span>
                        </div>
                        <IconButton onClick={() => openEdit(role)} size="small" className="bg-slate-100 hover:bg-[#0a5bd7]/10 hover:text-[#0a5bd7] text-slate-500 rounded-xl p-2">
                          <Pencil className="w-4 h-4" />
                        </IconButton>
                        <IconButton onClick={() => handleDelete(role)} size="small" className="bg-slate-100 hover:bg-red-50 hover:text-red-650 text-slate-500 rounded-xl p-2">
                          <Trash2 className="w-4 h-4" />
                        </IconButton>
                        <IconButton
                          onClick={() => setExpandedRole(expandedRole === role._id ? null : role._id)}
                          size="small"
                          className="bg-slate-100 text-slate-500 hover:bg-slate-200 rounded-xl p-2"
                        >
                          {expandedRole === role._id ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                        </IconButton>
                      </div>
                    </div>

                    {/* MUI Collapse for expanded panel with content log */}
                    <Collapse in={expandedRole === role._id} timeout="auto" unmountOnExit>
                      <div className="border-t border-slate-100 px-6 py-5 grid grid-cols-1 lg:grid-cols-3 gap-6 bg-slate-50/20">

                        {/* Left Column: Permission Matrix Table */}
                        <div className="lg:col-span-2">
                          <Typography className="text-xs font-black uppercase tracking-wider text-slate-400 mb-3">
                            Permissions Matrix
                          </Typography>
                          <TableContainer component={Paper} elevation={0} className="border border-slate-200/50 rounded-xl overflow-x-auto no-scrollbar">
                            <Table size="small">
                              <TableHead>
                                <TableRow>
                                  <TableCell className="font-black">Module</TableCell>
                                  {['Read', 'Create', 'Edit', 'Delete'].map(a => (
                                    <TableCell key={a} align="center" className="font-black">{a}</TableCell>
                                  ))}
                                </TableRow>
                              </TableHead>
                              <TableBody className="bg-white">
                                {ALL_MODULES.map(m => {
                                  const perm = role.permissions.find(p => p.module === m.key);
                                  const hasChildren = ALL_MODULES.some(child => child.isChild && child.parentKey === m.key);
                                  return (
                                    <TableRow
                                      key={m.key}
                                      style={{ backgroundColor: m.isChild ? '#ffffff' : '#f8fafc' }}
                                    >
                                      <TableCell
                                        className={m.isChild ? "font-medium text-slate-500 text-xs" : "font-extrabold text-slate-800 text-sm"}
                                        style={{
                                          paddingLeft: `${16 + m.depth * 16}px`,
                                          borderLeft: m.isChild ? 'none' : '4px solid #0a5bd7'
                                        }}
                                      >
                                        {m.depth > 0 ? `${'↳ '.repeat(m.depth)}${m.label}` : m.label}
                                      </TableCell>
                                      {(['canRead', 'canCreate', 'canEdit', 'canDelete'] as const).map(field => {
                                        const showCell = !hasChildren || field === 'canRead';
                                        return (
                                          <TableCell key={field} align="center">
                                            <div className="flex items-center justify-center">
                                              {showCell ? (
                                                perm?.[field]
                                                  ? <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                                                  : <XCircle className="w-4 h-4 text-slate-200" />
                                              ) : (
                                                <span className="text-slate-350 font-mono">—</span>
                                              )}
                                            </div>
                                          </TableCell>
                                        );
                                      })}
                                    </TableRow>
                                  );
                                })}
                              </TableBody>
                            </Table>
                          </TableContainer>
                        </div>

                        {/* Right Column: Descriptions & Logs details */}
                        <div className="space-y-4">
                          <div>
                            <Typography className="text-xs font-black uppercase tracking-wider text-slate-400 mb-2">
                              Description
                            </Typography>
                            <p className="text-sm text-slate-600 bg-slate-50 border border-slate-200/50 p-3 rounded-xl">
                              {role.description || 'No description provided.'}
                            </p>
                          </div>

                          <div className="bg-slate-50/50 p-4 rounded-xl border border-slate-100 space-y-2.5 text-xs text-slate-550">
                            <p className="text-xs font-black uppercase tracking-wider text-slate-400 flex items-center gap-1.5 mb-1">
                              <UserCheck className="w-3.5 h-3.5 text-slate-400" /> Audit logs
                            </p>
                            <p><strong>Created by:</strong> {role.createdBy?.name || 'System / Owner'} <span className="text-slate-400 font-mono">({formatDate(role.createdAt)})</span></p>
                            {role.updatedBy && (
                              <p><strong>Last updated by:</strong> {role.updatedBy.name} <span className="text-slate-400 font-mono">({formatDate(role.updatedAt)})</span></p>
                            )}
                          </div>
                        </div>
                      </div>
                    </Collapse>
                  </Paper>
                ))}
              </div>
              {/* Pagination footer */}
              <Paper
                elevation={0}
                className="rounded-2xl border border-slate-200/60 bg-white"
              >
                <TablePagination
                  component="div"
                  count={totalCount}
                  page={page}
                  onPageChange={(_, newPage) => updateUrl({ page: String(newPage + 1) })}
                  rowsPerPage={pageSize}
                  onRowsPerPageChange={(e) => updateUrl({ pageSize: e.target.value, page: '1' })}
                  rowsPerPageOptions={[5, 10, 25, 50]}
                  sx={{
                    '.MuiTablePagination-selectLabel, .MuiTablePagination-displayedRows': {
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      color: '#64748b'
                    }
                  }}
                />
              </Paper>
            </>
          )}

          {/* Create/Edit Modal with Permission Matrix */}
          <Dialog
            open={modalOpen}
            onClose={() => setModalOpen(false)}
            slots={{ transition: Zoom }}
            maxWidth="sm"
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
              <span>{editTarget ? 'Edit Permission Role' : 'New Permission Role'}</span>
              <IconButton onClick={() => setModalOpen(false)} size="small" className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </IconButton>
            </DialogTitle>

            <form onSubmit={handleSubmit}>
              <DialogContent className="space-y-5">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <span className="text-xs font-black uppercase tracking-wider text-slate-500">Role Name *</span>
                    <TextField
                      hiddenLabel
                      required
                      fullWidth
                      variant="outlined"
                      placeholder="e.g. Operations Manager"
                      value={name}
                      onChange={e => setName(e.target.value)}
                      slotProps={{ input: { className: "font-semibold text-sm" } }}
                    />
                  </div>
                  <div className="space-y-1">
                    <span className="text-xs font-black uppercase tracking-wider text-slate-500">Description</span>
                    <TextField
                      hiddenLabel
                      fullWidth
                      variant="outlined"
                      placeholder="Optional description"
                      value={description}
                      onChange={e => setDescription(e.target.value)}
                      slotProps={{ input: { className: "font-semibold text-sm" } }}
                    />
                  </div>
                </div>

                {/* Permission Matrix */}
                <div>
                  <Typography className="text-xs font-black uppercase tracking-wider text-slate-500 mb-3">
                    Module Permissions
                  </Typography>
                  <TableContainer component={Paper} elevation={0} className="border border-slate-200 rounded-2xl overflow-x-auto no-scrollbar bg-slate-55/20">
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell className="font-black">Module</TableCell>
                          {(['canRead', 'canCreate', 'canEdit', 'canDelete'] as const).map((field, i) => (
                            <TableCell key={field} align="center" className="font-black">
                              <div className="flex flex-col items-center gap-0.5">
                                <span>{['Read', 'Create', 'Edit', 'Delete'][i]}</span>
                                <button
                                  type="button"
                                  onClick={() => {
                                    const allOn = permissions.every(p => p[field]);
                                    toggleAll(field, !allOn);
                                  }}
                                  className="text-[9px] font-bold text-[#0a5bd7] hover:underline focus:outline-none"
                                >
                                  {permissions.every(p => p[field]) ? 'None' : 'All'}
                                </button>
                              </div>
                            </TableCell>
                          ))}
                        </TableRow>
                      </TableHead>
                      <TableBody className="bg-white">
                        {ALL_MODULES.map(m => {
                          const perm = permissions.find(p => p.module === m.key)!;
                          const hasChildren = ALL_MODULES.some(child => child.isChild && child.parentKey === m.key);
                          return (
                            <TableRow
                              key={m.key}
                              style={{ backgroundColor: m.isChild ? '#ffffff' : '#f8fafc' }}
                            >
                              <TableCell
                                className={m.isChild ? "font-medium text-slate-500 text-xs" : "font-extrabold text-slate-800 text-sm"}
                                style={{
                                  paddingLeft: `${16 + m.depth * 16}px`,
                                  borderLeft: m.isChild ? 'none' : '4px solid #0a5bd7'
                                }}
                              >
                                {m.depth > 0 ? `${'↳ '.repeat(m.depth)}${m.label}` : m.label}
                              </TableCell>
                              {(['canRead', 'canCreate', 'canEdit', 'canDelete'] as const).map(field => {
                                const showCell = !hasChildren || field === 'canRead';
                                return (
                                  <TableCell key={field} align="center">
                                    {showCell ? (
                                      <Checkbox
                                        size="small"
                                        checked={perm[field]}
                                        onChange={() => togglePerm(m.key, field)}
                                        disabled={field !== 'canRead' && !perm.canRead}
                                        color="primary"
                                      />
                                    ) : (
                                      <span className="text-slate-350 font-mono">—</span>
                                    )}
                                  </TableCell>
                                );
                              })}
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </TableContainer>
                  <Typography className="text-xs text-slate-400 mt-2 font-medium">
                    * Enable "Read" first to unlock other permissions for a module.
                  </Typography>
                </div>
              </DialogContent>

              <DialogActions className="p-5 pt-0 gap-2">
                <Button onClick={() => setModalOpen(false)} variant="outlined" fullWidth className="py-2.5 font-bold">
                  Cancel
                </Button>
                <Button type="submit" disabled={saving} variant="contained" fullWidth className="py-2.5 font-bold">
                  {saving ? <CircularProgress size={20} color="inherit" /> : editTarget ? 'Save Changes' : 'Create Role'}
                </Button>
              </DialogActions>
            </form>
          </Dialog>
        </>
      )}
    </div>
  );
}
