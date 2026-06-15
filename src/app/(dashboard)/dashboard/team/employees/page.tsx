'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import api from '@/lib/api';
import axios from 'axios';
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
  Tabs,
  Tab,
  FormControl,
  Select,
  MenuItem,
  Collapse,
  Switch,
  Popover,
  Grid,
  Typography
} from '@mui/material';
import {
  Plus, Pencil, Trash2, CheckCircle2, XCircle, X, Eye, EyeOff, Info, MapPin, Landmark, Calendar, Contact, SlidersHorizontal, RotateCcw, Search, Mail, Users, Briefcase
} from 'lucide-react';
import { useToastConfirm } from '@/context/ToastConfirmContext';

interface Designation { _id: string; name: string; }
interface PermissionRoleOption { _id: string; name: string; }

interface SystemEmployee {
  _id: string;
  employeeCode: string;
  phone?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  userId: { _id: string; name: string; email: string; isActive: boolean; profileImage?: string };
  designationId: { _id: string; name: string };
  permissionRoleId: { _id: string; name: string };
  createdBy?: { _id: string; name: string };
  updatedBy?: { _id: string; name: string };
  dateOfBirth?: string;
  dateOfJoining?: string;
  emergencyContact?: string;
  reportingManagerId?: { _id: string; name: string; email: string };
  address?: {
    street: string;
    city: string;
    state: string;
    zipCode: string;
    country: string;
  };
  bankDetails?: {
    bankName: string;
    accountNumber: string;
    ifscCode: string;
  };
}

interface FormState {
  name: string;
  email: string;
  password: string;
  phone: string;
  designationId: string;
  permissionRoleId: string;
  dateOfBirth: string;
  dateOfJoining: string;
  emergencyContact: string;
  reportingManagerId: string;
  profileImage: string;
  address: {
    street: string;
    city: string;
    state: string;
    zipCode: string;
    country: string;
  };
  bankDetails: {
    bankName: string;
    accountNumber: string;
    ifscCode: string;
  };
}

export default function SystemEmployeesPage() {
  const { showToast, confirm } = useToastConfirm();
  const [employees, setEmployees] = useState<SystemEmployee[]>([]);
  const [designations, setDesignations] = useState<Designation[]>([]);
  const [permissionRoles, setPermissionRoles] = useState<PermissionRoleOption[]>([]);
  const [reportingManagers, setReportingManagers] = useState<{ _id: string; name: string; email: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingOptions, setLoadingOptions] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showPass, setShowPass] = useState(false);

  // ── URL as single source of truth ──────────────────────────────────────
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Derived from URL — committed / applied values
  const page               = Math.max(0, parseInt(searchParams.get('page')             || '1',   10) - 1);
  const pageSize           =             parseInt(searchParams.get('pageSize')         || '10',  10);
  const appliedSearch          = searchParams.get('search')          || '';
  const appliedStatus          = searchParams.get('status')          || 'all';
  const appliedDesignation     = searchParams.get('designationId')   || 'all';
  const appliedPermissionRole  = searchParams.get('permissionRoleId')|| 'all';
  const appliedStartDate       = searchParams.get('startDate')       || '';
  const appliedEndDate         = searchParams.get('endDate')         || '';
  const appliedJoiningStart    = searchParams.get('joiningStartDate')|| '';
  const appliedJoiningEnd      = searchParams.get('joiningEndDate')  || '';

  // Draft filter inputs — local until user clicks Apply
  const [showFilters, setShowFilters] = useState(false);
  const [searchTerm,           setSearchTerm]           = useState(appliedSearch);
  const [statusFilter,         setStatusFilter]         = useState(appliedStatus);
  const [designationFilter,    setDesignationFilter]    = useState(appliedDesignation);
  const [permissionRoleFilter, setPermissionRoleFilter] = useState(appliedPermissionRole);
  const [startDate,            setStartDate]            = useState(appliedStartDate);
  const [endDate,              setEndDate]              = useState(appliedEndDate);
  const [joiningStartDate,     setJoiningStartDate]     = useState(appliedJoiningStart);
  const [joiningEndDate,       setJoiningEndDate]       = useState(appliedJoiningEnd);

  const [modalOpen,   setModalOpen]   = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [viewTarget,  setViewTarget]  = useState<SystemEmployee | null>(null);
  const [editTarget,  setEditTarget]  = useState<SystemEmployee | null>(null);
  const [activeTab,   setActiveTab]   = useState(0);
  const [totalCount,  setTotalCount]  = useState(0);

  const [hoverAnchorEl, setHoverAnchorEl] = useState<HTMLElement | null>(null);
  const [hoveredEmp, setHoveredEmp] = useState<SystemEmployee | null>(null);

  const handleHoverOpen = (event: React.MouseEvent<HTMLElement>, emp: SystemEmployee) => {
    setHoverAnchorEl(event.currentTarget);
    setHoveredEmp(emp);
  };

  const handleHoverClose = () => {
    setHoverAnchorEl(null);
    setHoveredEmp(null);
  };

  const [uploadingImage, setUploadingImage] = useState(false);
  const [form, setForm] = useState<FormState>({
    name: '', email: '', password: '', phone: '', designationId: '', permissionRoleId: '',
    dateOfBirth: '', dateOfJoining: '', emergencyContact: '', reportingManagerId: '', profileImage: '',
    address: { street: '', city: '', state: '', zipCode: '', country: '' },
    bankDetails: { bankName: '', accountNumber: '', ifscCode: '' }
  });

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const file = files[0];
    if (file.size > 5 * 1024 * 1024) {
      showToast('Image file size cannot exceed 5MB.', 'error');
      return;
    }

    const formData = new FormData();
    formData.append('image', file);

    try {
      setUploadingImage(true);
      const res = await api.post('/upload', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
      setForm(f => ({ ...f, profileImage: res.data.imageUrl }));
      showToast('Image uploaded successfully', 'success');
    } catch (err: any) {
      showToast(err.response?.data?.error || 'Failed to upload image', 'error');
    } finally {
      setUploadingImage(false);
    }
  };

  // Fetch designations & roles on mount (for dropdowns)
  useEffect(() => {
    const fetchOptions = async () => {
      try {
        setLoadingOptions(true);
        const [desRes, roleRes, managerRes] = await Promise.all([
          api.get('/designations'),
          api.get('/permission-roles'),
          api.get('/system-employees/reporting-managers'),
        ]);
        setDesignations(desRes.data.designations);
        setPermissionRoles(roleRes.data.roles);
        setReportingManagers(managerRes.data.managers);
      } catch {
        showToast('Failed to load filter options', 'error');
      } finally {
        setLoadingOptions(false);
      }
    };
    fetchOptions();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // refreshKey: bump after CRUD to re-fetch without changing URL
  const [refreshKey, setRefreshKey] = useState(0);
  const fetchAll = () => {
    setRefreshKey(k => k + 1);
    // Also re-fetch reporting managers list in case team list changed
    api.get('/system-employees/reporting-managers')
      .then(res => setReportingManagers(res.data.managers))
      .catch(() => {});
  };

  /** Push filter / pagination updates into the URL */
  const updateUrl = (updates: Record<string, string>) => {
    const params = new URLSearchParams(searchParams.toString());
    const DEFAULTS: Record<string, string> = {
      page: '1', pageSize: '10', status: 'all', search: '',
      designationId: 'all', permissionRoleId: 'all',
      startDate: '', endDate: '', joiningStartDate: '', joiningEndDate: ''
    };
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
        if (appliedSearch)                    params.append('search',          appliedSearch);
        if (appliedStatus !== 'all')          params.append('status',          appliedStatus);
        if (appliedDesignation !== 'all')     params.append('designationId',   appliedDesignation);
        if (appliedPermissionRole !== 'all')  params.append('permissionRoleId',appliedPermissionRole);
        if (appliedStartDate)                 params.append('startDate',       appliedStartDate);
        if (appliedEndDate)                   params.append('endDate',         appliedEndDate);
        if (appliedJoiningStart)              params.append('joiningStartDate',appliedJoiningStart);
        if (appliedJoiningEnd)                params.append('joiningEndDate',  appliedJoiningEnd);
        const res = await api.get(`/system-employees?${params.toString()}`);
        setEmployees(res.data.employees);
        setTotalCount(res.data.pagination?.total ?? 0);
      } catch {
        showToast('Failed to load employees', 'error');
      } finally {
        setLoading(false);
      }
    };
    doFetch();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, pageSize, appliedSearch, appliedStatus, appliedDesignation, appliedPermissionRole, appliedStartDate, appliedEndDate, appliedJoiningStart, appliedJoiningEnd, refreshKey]);

  const handleApplyFilters = () => {
    updateUrl({
      search: searchTerm,
      status: statusFilter,
      designationId: designationFilter,
      permissionRoleId: permissionRoleFilter,
      startDate,
      endDate,
      joiningStartDate,
      joiningEndDate,
      page: '1',
    });
  };

  const handleResetFilters = () => {
    setSearchTerm('');
    setStatusFilter('all');
    setDesignationFilter('all');
    setPermissionRoleFilter('all');
    setStartDate('');
    setEndDate('');
    setJoiningStartDate('');
    setJoiningEndDate('');
    router.push(pathname, { scroll: false });
  };

  const activeFiltersCount =
    (appliedSearch           ? 1 : 0) +
    (appliedStatus           !== 'all' ? 1 : 0) +
    (appliedDesignation      !== 'all' ? 1 : 0) +
    (appliedPermissionRole   !== 'all' ? 1 : 0) +
    (appliedStartDate        ? 1 : 0) +
    (appliedEndDate          ? 1 : 0) +
    (appliedJoiningStart     ? 1 : 0) +
    (appliedJoiningEnd       ? 1 : 0);

  interface FormErrors {
    name?: string;
    email?: string;
    password?: string;
    phone?: string;
    designationId?: string;
    permissionRoleId?: string;
    zipCode?: string;
    accountNumber?: string;
    ifscCode?: string;
  }

  const [errors, setErrors] = useState<FormErrors>({});

  const validateForm = (): boolean => {
    const tempErrors: FormErrors = {};

    // Name Validation
    if (!form.name.trim()) {
      tempErrors.name = 'Full name is required';
    } else if (form.name.trim().length < 2) {
      tempErrors.name = 'Name must be at least 2 characters';
    }

    // Phone Validation (Indian phone number format: 10 digits)
    if (form.phone.trim()) {
      if (!/^[0-9]{10}$/.test(form.phone.trim())) {
        tempErrors.phone = 'Phone number must be exactly 10 digits';
      }
    }

    // Designation and Permission Role Validation
    if (!form.designationId) {
      tempErrors.designationId = 'Designation is required';
    }
    if (!form.permissionRoleId) {
      tempErrors.permissionRoleId = 'Permission role is required';
    }

    // Email & Password (only for creation)
    if (!editTarget) {
      if (!form.email.trim()) {
        tempErrors.email = 'Email address is required';
      } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) {
        tempErrors.email = 'Invalid email address';
      }

      if (!form.password) {
        tempErrors.password = 'Password is required';
      } else if (form.password.length < 6) {
        tempErrors.password = 'Password must be at least 6 characters';
      }
    }

    // Address Pincode Validation
    if (form.address.zipCode.trim()) {
      if (!/^[0-9]{6}$/.test(form.address.zipCode.trim())) {
        tempErrors.zipCode = 'Pincode must be exactly 6 digits';
      }
    }

    // Bank Details Validation
    if (form.bankDetails.accountNumber.trim()) {
      if (!/^[0-9]{9,18}$/.test(form.bankDetails.accountNumber.trim())) {
        tempErrors.accountNumber = 'Bank account number must be between 9 and 18 digits';
      }
    }
    if (form.bankDetails.ifscCode.trim()) {
      if (!/^[A-Z]{4}0[A-Z0-9]{6}$/.test(form.bankDetails.ifscCode.trim().toUpperCase())) {
        tempErrors.ifscCode = 'Invalid IFSC code format (e.g. SBIN0001234)';
      }
    }

    setErrors(tempErrors);

    // If there are errors, check which tab the error belongs to and active it
    if (Object.keys(tempErrors).length > 0) {
      if (tempErrors.name || tempErrors.phone || tempErrors.email || tempErrors.password || tempErrors.designationId || tempErrors.permissionRoleId) {
        setActiveTab(0);
      } else if (tempErrors.zipCode) {
        setActiveTab(2);
      } else if (tempErrors.accountNumber || tempErrors.ifscCode) {
        setActiveTab(2);
      }
      return false;
    }

    return true;
  };

  const handlePincodeChange = async (pincode: string) => {
    // Only allow numeric digits up to 6 characters
    const numericPincode = pincode.replace(/\D/g, '').slice(0, 6);

    setForm(prev => ({
      ...prev,
      address: { ...prev.address, zipCode: numericPincode }
    }));

    // Clear pincode error on type
    if (errors.zipCode) {
      setErrors(prev => ({ ...prev, zipCode: undefined }));
    }

    if (numericPincode.length === 6) {
      try {
        const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
        const res = await axios.get(`https://maps.googleapis.com/maps/api/geocode/json`, {
          params: {
            address: numericPincode,
            components: 'country:IN',
            key: apiKey
          }
        });

        if (res.data.status === 'OK' && res.data.results.length > 0) {
          const components = res.data.results[0].address_components;
          let city = '';
          let state = '';
          let country = 'India';

          for (const comp of components) {
            if (comp.types.includes('locality')) {
              city = comp.long_name;
            } else if (comp.types.includes('administrative_area_level_3') && !city) {
              city = comp.long_name;
            } else if (comp.types.includes('administrative_area_level_2') && !city) {
              city = comp.long_name;
            } else if (comp.types.includes('administrative_area_level_1')) {
              state = comp.long_name;
            } else if (comp.types.includes('country')) {
              country = comp.long_name;
            }
          }

          setForm(prev => ({
            ...prev,
            address: {
              ...prev.address,
              city: city || prev.address.city,
              state: state || prev.address.state,
              country: country
            }
          }));
          showToast(`Autofilled City: ${city || 'N/A'}, State: ${state || 'N/A'}`, 'success');
        } else {
          showToast('Pincode not found or invalid response', 'warning');
        }
      } catch (err) {
        console.error('Google Maps Pincode resolution failed', err);
      }
    }
  };

  const openCreate = () => {
    setEditTarget(null);
    setForm({
      name: '', email: '', password: '', phone: '', designationId: '', permissionRoleId: '',
      dateOfBirth: '', dateOfJoining: '', emergencyContact: '', reportingManagerId: '', profileImage: '',
      address: { street: '', city: '', state: '', zipCode: '', country: '' },
      bankDetails: { bankName: '', accountNumber: '', ifscCode: '' }
    });
    setErrors({});
    setActiveTab(0);
    setModalOpen(true);
  };

  const openEdit = (e: SystemEmployee) => {
    setEditTarget(e);
    setForm({
      name: e.userId.name,
      email: e.userId.email,
      password: '',
      phone: e.phone || '',
      designationId: e.designationId._id,
      permissionRoleId: e.permissionRoleId._id,
      dateOfBirth: e.dateOfBirth ? e.dateOfBirth.split('T')[0] : '',
      dateOfJoining: e.dateOfJoining ? e.dateOfJoining.split('T')[0] : '',
      emergencyContact: e.emergencyContact || '',
      reportingManagerId: e.reportingManagerId?._id || '',
      profileImage: e.userId.profileImage || '',
      address: {
        street: e.address?.street || '',
        city: e.address?.city || '',
        state: e.address?.state || '',
        zipCode: e.address?.zipCode || '',
        country: e.address?.country || '',
      },
      bankDetails: {
        bankName: e.bankDetails?.bankName || '',
        accountNumber: e.bankDetails?.accountNumber || '',
        ifscCode: e.bankDetails?.ifscCode || '',
      }
    });
    setErrors({});
    setActiveTab(0);
    setModalOpen(true);
  };

  const openDetails = (e: SystemEmployee) => {
    setViewTarget(e);
    setDetailsOpen(true);
  };

  const handleSubmit = async (evt: React.FormEvent) => {
    evt.preventDefault();
    if (!validateForm()) {
      showToast('Please correct the validation errors', 'error');
      return;
    }
    setSaving(true);
    try {
      const payload: any = {
        name: form.name,
        phone: form.phone,
        designationId: form.designationId,
        permissionRoleId: form.permissionRoleId,
        dateOfBirth: form.dateOfBirth || null,
        dateOfJoining: form.dateOfJoining || null,
        emergencyContact: form.emergencyContact,
        reportingManagerId: form.reportingManagerId || null,
        profileImage: form.profileImage || '',
        address: {
          ...form.address,
          zipCode: form.address.zipCode || ''
        },
        bankDetails: {
          ...form.bankDetails,
          ifscCode: form.bankDetails.ifscCode ? form.bankDetails.ifscCode.toUpperCase() : ''
        },
      };

      if (editTarget) {
        await api.put(`/system-employees/${editTarget._id}`, payload);
        showToast('Employee updated successfully', 'success');
      } else {
        payload.email = form.email;
        payload.password = form.password;
        await api.post('/system-employees', payload);
        showToast('Employee created successfully', 'success');
      }
      setModalOpen(false);
      fetchAll();
    } catch (err: any) {
      showToast(err.response?.data?.error || 'Failed to save employee', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async (emp: SystemEmployee) => {
    try {
      await api.put(`/system-employees/${emp._id}`, { isActive: !emp.isActive });
      showToast(`Employee ${!emp.isActive ? 'activated' : 'deactivated'} successfully`, 'success');
      fetchAll();
    } catch {
      showToast('Failed to update status', 'error');
    }
  };

  const handleDelete = async (emp: SystemEmployee) => {
    const confirmed = await confirm({
      title: 'Deactivate Employee',
      message: `Are you sure you want to deactivate the employee "${emp.userId.name}"?`,
      confirmText: 'Deactivate',
      cancelText: 'Cancel',
      severity: 'error'
    });
    if (!confirmed) return;
    try {
      await api.delete(`/system-employees/${emp._id}`);
      showToast('Employee deactivated successfully', 'success');
      fetchAll();
    } catch {
      showToast('Failed to deactivate employee', 'error');
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
          <h1 className="text-2xl font-black text-slate-800 tracking-tight">My Team</h1>
          <p className="text-sm text-slate-500 mt-0.5">Manage system-level employees and their access roles</p>
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
            Add Employee
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
            {(activeFiltersCount > 0 || searchTerm || statusFilter !== 'all' || designationFilter !== 'all' || permissionRoleFilter !== 'all' || startDate || endDate || joiningStartDate || joiningEndDate) && (
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
            {/* Search Input */}
            <Grid size={{ xs: 12, md: 4 }} className="space-y-1">
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">Search text</span>
              <TextField
                hiddenLabel
                fullWidth
                variant="outlined"
                placeholder="Search name, email, phone, code..."
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

            {/* Status Dropdown */}
            <Grid size={{ xs: 12, sm: 6, md: 2 }} className="space-y-1">
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">Status</span>
              <FormControl fullWidth variant="outlined">
                <Select
                  value={statusFilter}
                  onChange={e => setStatusFilter(e.target.value as string)}
                  className="bg-white rounded-xl font-semibold text-sm"
                >
                  <MenuItem value="all" className="font-semibold text-sm">All Statuses</MenuItem>
                  <MenuItem value="active" className="font-semibold text-sm">Active</MenuItem>
                  <MenuItem value="inactive" className="font-semibold text-sm">Inactive</MenuItem>
                </Select>
              </FormControl>
            </Grid>

            {/* Designation Dropdown */}
            <Grid size={{ xs: 12, sm: 6, md: 3 }} className="space-y-1">
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">Designation</span>
              <FormControl fullWidth variant="outlined">
                <Select
                  value={designationFilter}
                  onChange={e => setDesignationFilter(e.target.value as string)}
                  className="bg-white rounded-xl font-semibold text-sm"
                >
                  <MenuItem value="all" className="font-semibold text-sm">All Designations</MenuItem>
                  {designations.map(d => (
                    <MenuItem key={d._id} value={d._id} className="font-semibold text-sm">
                      {d.name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>

            {/* Permission Role Dropdown */}
            <Grid size={{ xs: 12, sm: 6, md: 3 }} className="space-y-1">
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">Permission Role</span>
              <FormControl fullWidth variant="outlined">
                <Select
                  value={permissionRoleFilter}
                  onChange={e => setPermissionRoleFilter(e.target.value as string)}
                  className="bg-white rounded-xl font-semibold text-sm"
                >
                  <MenuItem value="all" className="font-semibold text-sm">All Roles</MenuItem>
                  {permissionRoles.map(r => (
                    <MenuItem key={r._id} value={r._id} className="font-semibold text-sm">
                      {r.name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>

            {/* Created From Date */}
            <Grid size={{ xs: 12, sm: 6, md: 3 }} className="space-y-1">
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

            {/* Created To Date */}
            <Grid size={{ xs: 12, sm: 6, md: 3 }} className="space-y-1">
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

            {/* Joining From Date */}
            <Grid size={{ xs: 12, sm: 6, md: 3 }} className="space-y-1">
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">Joining From</span>
              <TextField
                type="date"
                hiddenLabel
                fullWidth
                variant="outlined"
                value={joiningStartDate}
                onChange={e => setJoiningStartDate(e.target.value)}
                slotProps={{
                  input: { className: "font-semibold text-sm bg-white rounded-xl text-slate-800" }
                }}
              />
            </Grid>

            {/* Joining To Date */}
            <Grid size={{ xs: 12, sm: 6, md: 3 }} className="space-y-1">
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">Joining To</span>
              <TextField
                type="date"
                hiddenLabel
                fullWidth
                variant="outlined"
                value={joiningEndDate}
                onChange={e => setJoiningEndDate(e.target.value)}
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
        className="rounded-2xl border border-slate-200/60 overflow-x-auto no-scrollbar animate-in slide-in-from-bottom-3 duration-300 delay-150"
      >


        {loading ? (
          <div className="flex items-center justify-center py-20 bg-white">
            <CircularProgress size={32} thickness={4} />
          </div>
        ) : employees.length === 0 ? (
          <div className="text-center py-20 text-slate-450 font-semibold text-sm bg-white">
            No employees yet. Click "Add Employee" to create one.
          </div>
        ) : (
          <Table sx={{ minWidth: 1250 }}>
            <TableHead>
              <TableRow>
                <TableCell>S.No.</TableCell>
                <TableCell>Employee</TableCell>
                <TableCell>Email</TableCell>
                <TableCell>Code</TableCell>
                <TableCell>Designation</TableCell>
                <TableCell>Permission Role</TableCell>
                <TableCell>Created By</TableCell>
                <TableCell>Created At</TableCell>
                <TableCell>Updated By</TableCell>
                <TableCell>Updated At</TableCell>
                <TableCell>Status</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody className="bg-white">
              {employees.map((emp, idx) => (
                <TableRow
                  key={emp._id}
                  className="animate-in fade-in slide-in-from-bottom-2 duration-300"
                  style={{ animationDelay: `${idx * 40}ms` }}
                >
                  <TableCell className="font-semibold text-slate-500">{page * pageSize + idx + 1}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <div
                        onMouseEnter={(e) => handleHoverOpen(e, emp)}
                        onMouseLeave={handleHoverClose}
                        className="w-9 h-9 rounded-full bg-gradient-to-br from-[#0a5bd7] to-[#2691f5] flex items-center justify-center text-white font-bold text-sm shadow-sm overflow-hidden cursor-pointer"
                      >
                        {emp.userId?.profileImage ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={emp.userId.profileImage} alt={emp.userId.name} className="w-full h-full object-cover" />
                        ) : (
                          (emp.userId?.name || 'Deleted').charAt(0).toUpperCase()
                        )}
                      </div>
                      <span className="font-bold text-slate-800">{emp.userId?.name || 'Deleted User'}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <span className="font-semibold text-slate-600">{emp.userId?.email || '—'}</span>
                  </TableCell>
                  <TableCell>
                    <span className="font-mono text-xs bg-slate-100 text-slate-650 font-bold px-2 py-1 rounded-lg border border-slate-200/40">{emp.employeeCode}</span>
                  </TableCell>
                  <TableCell className="font-semibold text-slate-705">{emp.designationId.name}</TableCell>
                  <TableCell>
                    <span className="bg-violet-50 text-violet-700 border border-violet-100 font-bold text-xs px-2.5 py-1 rounded-full">{emp.permissionRoleId.name}</span>
                  </TableCell>
                  <TableCell>
                    <span className="font-semibold text-slate-600">{emp.createdBy?.name || 'Owner'}</span>
                  </TableCell>
                  <TableCell className="font-mono text-xs text-slate-500">
                    {formatDate(emp.createdAt)}
                  </TableCell>
                  <TableCell>
                    <span className="font-semibold text-slate-600">{emp.updatedBy?.name || '—'}</span>
                  </TableCell>
                  <TableCell className="font-mono text-xs text-slate-500">
                    {emp.updatedBy ? formatDate(emp.updatedAt) : '—'}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1.5">
                      <Switch
                        checked={emp.isActive}
                        onChange={() => handleToggleActive(emp)}
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
                      <span className={`text-xs font-bold ${emp.isActive ? 'text-emerald-600' : 'text-slate-450'}`}>
                        {emp.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell align="right">
                    <div className="flex items-center justify-end gap-1">
                      <IconButton onClick={() => openDetails(emp)} size="small" className="bg-slate-100 hover:bg-violet-50 hover:text-violet-600 text-slate-500 rounded-xl p-2">
                        <Info className="w-4 h-4" />
                      </IconButton>
                      <IconButton onClick={() => openEdit(emp)} size="small" className="bg-slate-100 hover:bg-blue-50 hover:text-blue-600 text-slate-500 rounded-xl p-2">
                        <Pencil className="w-4 h-4" />
                      </IconButton>
                      <IconButton onClick={() => handleDelete(emp)} size="small" className="bg-slate-100 hover:bg-red-50 hover:text-red-655 text-slate-500 rounded-xl p-2">
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

      {/* Create/Edit Modal Dialog */}
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
          <span>{editTarget ? 'Edit Employee' : 'Add New Employee'}</span>
          <IconButton onClick={() => setModalOpen(false)} size="small" className="text-slate-400 hover:text-slate-600">
            <X className="w-5 h-5" />
          </IconButton>
        </DialogTitle>

        {/* Tab Headers switcher */}
        <Tabs value={activeTab} onChange={(e, val) => setActiveTab(val)} variant="fullWidth">
          <Tab label="Basic Info" />
          <Tab label="Personal & Job" />
          <Tab label="Address & Bank" />
        </Tabs>

        <form onSubmit={handleSubmit}>
          <DialogContent className="space-y-4 pt-4">

            {/* TAB 0: BASIC INFO */}
            {activeTab === 0 && (
              <div className="space-y-4 animate-in fade-in duration-200">
                {/* Profile Image Uploader */}
                <div className="flex flex-col items-center gap-2 pb-4 border-b border-slate-100 mb-2">
                  <div className="relative group w-20 h-20 rounded-full border-2 border-slate-200 hover:border-[#0a5bd7] transition-all overflow-hidden bg-slate-50 flex items-center justify-center cursor-pointer shadow-sm">
                    {uploadingImage ? (
                      <CircularProgress size={20} />
                    ) : form.profileImage ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={form.profileImage} alt="Profile" className="w-full h-full object-cover" />
                    ) : (
                      <div className="text-center text-slate-400">
                        <Contact className="w-7 h-7 mx-auto stroke-[1.5]" />
                        <span className="text-[9px] font-bold block mt-0.5 uppercase tracking-wider">Upload</span>
                      </div>
                    )}
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleImageUpload}
                      className="absolute inset-0 opacity-0 cursor-pointer"
                      disabled={uploadingImage}
                    />
                    {form.profileImage && !uploadingImage && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          setForm(f => ({ ...f, profileImage: '' }));
                        }}
                        className="absolute bottom-0 inset-x-0 bg-black/60 text-white text-[9px] font-bold py-0.5 text-center transition-colors z-20 hover:bg-red-655"
                      >
                        Remove
                      </button>
                    )}
                  </div>
                  <span className="text-[9px] font-black uppercase tracking-wider text-slate-400">Profile Photo</span>
                </div>

                <Grid container spacing={2}>
                  <Grid size={{ xs: 12, sm: 6 }} className="space-y-1">
                    <span className="text-xs font-black uppercase tracking-wider text-slate-500">Full Name *</span>
                    <TextField
                      hiddenLabel
                      required
                      fullWidth
                      variant="outlined"
                      placeholder="John Doe"
                      value={form.name}
                      onChange={e => {
                        setForm(f => ({ ...f, name: e.target.value }));
                        if (errors.name) setErrors(errs => ({ ...errs, name: undefined }));
                      }}
                      error={!!errors.name}
                      helperText={errors.name}
                      slotProps={{ input: { className: "font-semibold text-sm" } }}
                    />
                  </Grid>
                  <Grid size={{ xs: 12, sm: 6 }} className="space-y-1">
                    <span className="text-xs font-black uppercase tracking-wider text-slate-500">Phone</span>
                    <TextField
                      hiddenLabel
                      fullWidth
                      variant="outlined"
                      placeholder="10 digit number"
                      value={form.phone}
                      onChange={e => {
                        setForm(f => ({ ...f, phone: e.target.value }));
                        if (errors.phone) setErrors(errs => ({ ...errs, phone: undefined }));
                      }}
                      error={!!errors.phone}
                      helperText={errors.phone}
                      slotProps={{ input: { className: "font-semibold text-sm" } }}
                    />
                  </Grid>
                </Grid>

                {!editTarget && (
                  <Grid container spacing={2}>
                    <Grid size={{ xs: 12, sm: 6 }} className="space-y-1">
                      <span className="text-xs font-black uppercase tracking-wider text-slate-500">Email *</span>
                      <TextField
                        hiddenLabel
                        required
                        fullWidth
                        type="email"
                        variant="outlined"
                        placeholder="employee@company.com"
                        value={form.email}
                        onChange={e => {
                          setForm(f => ({ ...f, email: e.target.value }));
                          if (errors.email) setErrors(errs => ({ ...errs, email: undefined }));
                        }}
                        error={!!errors.email}
                        helperText={errors.email}
                        slotProps={{ input: { className: "font-semibold text-sm" } }}
                      />
                    </Grid>
                    <Grid size={{ xs: 12, sm: 6 }} className="space-y-1">
                      <span className="text-xs font-black uppercase tracking-wider text-slate-500">Password *</span>
                      <div className="relative">
                        <TextField
                          hiddenLabel
                          required
                          fullWidth
                          type={showPass ? 'text' : 'password'}
                          variant="outlined"
                          placeholder="Min 6 characters"
                          value={form.password}
                          onChange={e => {
                            setForm(f => ({ ...f, password: e.target.value }));
                            if (errors.password) setErrors(errs => ({ ...errs, password: undefined }));
                          }}
                          error={!!errors.password}
                          helperText={errors.password}
                          slotProps={{ input: { className: "font-semibold text-sm pr-11" } }}
                        />
                        <button
                          type="button"
                          onClick={() => setShowPass(s => !s)}
                          className="absolute right-3 top-[20px] -translate-y-1/2 text-slate-450 hover:text-slate-655 focus:outline-none z-10"
                        >
                          {showPass ? <EyeOff className="w-4.5 h-4.5" /> : <Eye className="w-4.5 h-4.5" />}
                        </button>
                      </div>
                    </Grid>
                  </Grid>
                )}

                <Grid container spacing={2}>
                  <Grid size={{ xs: 12, sm: 6 }} className="space-y-1">
                    <span className="text-xs font-black uppercase tracking-wider text-slate-500">Designation *</span>
                    <FormControl fullWidth variant="outlined" error={!!errors.designationId}>
                      <Select
                        value={form.designationId}
                        onChange={e => {
                          setForm(f => ({ ...f, designationId: e.target.value as string }));
                          if (errors.designationId) setErrors(errs => ({ ...errs, designationId: undefined }));
                        }}
                        displayEmpty
                        inputProps={{ className: "font-semibold text-sm" }}
                      >
                        <MenuItem value="" disabled><span className="text-slate-400">Select designation</span></MenuItem>
                        {designations.map(d => <MenuItem key={d._id} value={d._id}>{d.name}</MenuItem>)}
                      </Select>
                      {errors.designationId && <Typography className="text-red-500 text-xs mt-1 font-semibold">{errors.designationId}</Typography>}
                    </FormControl>
                  </Grid>
                  <Grid size={{ xs: 12, sm: 6 }} className="space-y-1">
                    <span className="text-xs font-black uppercase tracking-wider text-slate-500">Permission Role *</span>
                    <FormControl fullWidth variant="outlined" error={!!errors.permissionRoleId}>
                      <Select
                        value={form.permissionRoleId}
                        onChange={e => {
                          setForm(f => ({ ...f, permissionRoleId: e.target.value as string }));
                          if (errors.permissionRoleId) setErrors(errs => ({ ...errs, permissionRoleId: undefined }));
                        }}
                        displayEmpty
                        inputProps={{ className: "font-semibold text-sm" }}
                      >
                        <MenuItem value="" disabled><span className="text-slate-400">Select permission role</span></MenuItem>
                        {permissionRoles.map(r => <MenuItem key={r._id} value={r._id}>{r.name}</MenuItem>)}
                      </Select>
                      {errors.permissionRoleId && <Typography className="text-red-500 text-xs mt-1 font-semibold">{errors.permissionRoleId}</Typography>}
                    </FormControl>
                  </Grid>
                  <Grid size={{ xs: 12 }} className="space-y-1">
                    <span className="text-xs font-black uppercase tracking-wider text-slate-500">Reporting Manager</span>
                    <FormControl fullWidth variant="outlined">
                      <Select
                        value={form.reportingManagerId}
                        onChange={e => setForm(f => ({ ...f, reportingManagerId: e.target.value as string }))}
                        displayEmpty
                        inputProps={{ className: "font-semibold text-sm" }}
                      >
                        <MenuItem value=""><span className="text-slate-400">None (No Manager / Reports to Owner)</span></MenuItem>
                        {reportingManagers
                          .filter(m => !editTarget || m._id !== editTarget.userId._id)
                          .map(m => (
                            <MenuItem key={m._id} value={m._id}>
                              {m.name} ({m.email})
                            </MenuItem>
                          ))}
                      </Select>
                    </FormControl>
                  </Grid>
                </Grid>
              </div>
            )}

            {/* TAB 1: PERSONAL & JOB */}
            {activeTab === 1 && (
              <div className="space-y-4 animate-in fade-in duration-200">
                <Grid container spacing={2}>
                  <Grid size={{ xs: 12, sm: 6 }} className="space-y-1">
                    <span className="text-xs font-black uppercase tracking-wider text-slate-500">Date of Birth</span>
                    <TextField type="date" hiddenLabel fullWidth variant="outlined" value={form.dateOfBirth} onChange={e => setForm(f => ({ ...f, dateOfBirth: e.target.value }))} slotProps={{ input: { className: "font-semibold text-sm text-slate-800" } }} />
                  </Grid>
                  <Grid size={{ xs: 12, sm: 6 }} className="space-y-1">
                    <span className="text-xs font-black uppercase tracking-wider text-slate-500">Date of Joining</span>
                    <TextField type="date" hiddenLabel fullWidth variant="outlined" value={form.dateOfJoining} onChange={e => setForm(f => ({ ...f, dateOfJoining: e.target.value }))} slotProps={{ input: { className: "font-semibold text-sm text-slate-800" } }} />
                  </Grid>
                </Grid>
                <div className="space-y-1">
                  <span className="text-xs font-black uppercase tracking-wider text-slate-500">Emergency Contact (Name / Phone)</span>
                  <TextField hiddenLabel fullWidth variant="outlined" placeholder="e.g. Mary Doe: +91 99998 88888" value={form.emergencyContact} onChange={e => setForm(f => ({ ...f, emergencyContact: e.target.value }))} slotProps={{ input: { className: "font-semibold text-sm" } }} />
                </div>
              </div>
            )}

            {/* TAB 2: ADDRESS & BANK */}
            {activeTab === 2 && (
              <div className="space-y-5 animate-in fade-in duration-200">
                {/* Address Section */}
                <div className="space-y-3">
                  <Typography className="text-xs font-black uppercase tracking-widest text-[#0a5bd7] flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5" /> Address Details
                  </Typography>
                  <Grid container spacing={2}>
                    <Grid size={{ xs: 12 }}>
                      <TextField hiddenLabel fullWidth variant="outlined" placeholder="Street Address" value={form.address.street} onChange={e => setForm(f => ({ ...f, address: { ...f.address, street: e.target.value } }))} slotProps={{ input: { className: "font-semibold text-sm" } }} />
                    </Grid>
                    <Grid size={{ xs: 12, sm: 6 }}>
                      <TextField hiddenLabel fullWidth variant="outlined" placeholder="City" value={form.address.city} onChange={e => setForm(f => ({ ...f, address: { ...f.address, city: e.target.value } }))} slotProps={{ input: { className: "font-semibold text-sm" } }} />
                    </Grid>
                    <Grid size={{ xs: 12, sm: 6 }}>
                      <TextField hiddenLabel fullWidth variant="outlined" placeholder="State" value={form.address.state} onChange={e => setForm(f => ({ ...f, address: { ...f.address, state: e.target.value } }))} slotProps={{ input: { className: "font-semibold text-sm" } }} />
                    </Grid>
                    <Grid size={{ xs: 12, sm: 6 }}>
                      <TextField
                        hiddenLabel
                        fullWidth
                        variant="outlined"
                        placeholder="Pincode (6 digits)"
                        value={form.address.zipCode}
                        onChange={e => handlePincodeChange(e.target.value)}
                        error={!!errors.zipCode}
                        helperText={errors.zipCode}
                        slotProps={{ input: { className: "font-semibold text-sm" } }}
                      />
                    </Grid>
                    <Grid size={{ xs: 12, sm: 6 }}>
                      <TextField hiddenLabel fullWidth variant="outlined" placeholder="Country" value={form.address.country} onChange={e => setForm(f => ({ ...f, address: { ...f.address, country: e.target.value } }))} slotProps={{ input: { className: "font-semibold text-sm" } }} />
                    </Grid>
                  </Grid>
                </div>

                {/* Bank Section */}
                <div className="space-y-3 pt-1">
                  <Typography className="text-xs font-black uppercase tracking-widest text-[#0a5bd7] flex items-center gap-1.5">
                    <Landmark className="w-3.5 h-3.5" /> Bank Information
                  </Typography>
                  <Grid container spacing={2}>
                    <Grid size={{ xs: 12 }}>
                      <TextField hiddenLabel fullWidth variant="outlined" placeholder="Bank Name" value={form.bankDetails.bankName} onChange={e => setForm(f => ({ ...f, bankDetails: { ...f.bankDetails, bankName: e.target.value } }))} slotProps={{ input: { className: "font-semibold text-sm" } }} />
                    </Grid>
                    <Grid size={{ xs: 12, sm: 6 }}>
                      <TextField
                        hiddenLabel
                        fullWidth
                        variant="outlined"
                        placeholder="Account Number (9-18 digits)"
                        value={form.bankDetails.accountNumber}
                        onChange={e => {
                          setForm(f => ({ ...f, bankDetails: { ...f.bankDetails, accountNumber: e.target.value } }));
                          if (errors.accountNumber) setErrors(errs => ({ ...errs, accountNumber: undefined }));
                        }}
                        error={!!errors.accountNumber}
                        helperText={errors.accountNumber}
                        slotProps={{ input: { className: "font-semibold text-sm" } }}
                      />
                    </Grid>
                    <Grid size={{ xs: 12, sm: 6 }}>
                      <TextField
                        hiddenLabel
                        fullWidth
                        variant="outlined"
                        placeholder="IFSC / Bank Code"
                        value={form.bankDetails.ifscCode}
                        onChange={e => {
                          setForm(f => ({ ...f, bankDetails: { ...f.bankDetails, ifscCode: e.target.value } }));
                          if (errors.ifscCode) setErrors(errs => ({ ...errs, ifscCode: undefined }));
                        }}
                        error={!!errors.ifscCode}
                        helperText={errors.ifscCode}
                        slotProps={{ input: { className: "font-semibold text-sm" } }}
                      />
                    </Grid>
                  </Grid>
                </div>
              </div>
            )}

          </DialogContent>

          <DialogActions className="p-5 pt-0 gap-2 border-t border-slate-100">
            <Button onClick={() => setModalOpen(false)} variant="outlined" fullWidth className="py-2.5 font-bold">Cancel</Button>
            <Button type="submit" disabled={saving} variant="contained" fullWidth className="py-2.5 font-bold">
              {saving ? <CircularProgress size={20} color="inherit" /> : editTarget ? 'Save Changes' : 'Create Employee'}
            </Button>
          </DialogActions>
        </form>
      </Dialog>

      {/* Details View Modal Dialog */}
      <Dialog
        open={detailsOpen}
        onClose={() => setDetailsOpen(false)}
        slots={{ transition: Zoom }}
        maxWidth="md"
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
            <DialogTitle className="flex justify-between items-center pr-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <span>Employee Card: {viewTarget.userId.name}</span>
                <span className={`text-[9px] uppercase px-2 py-0.5 rounded-full font-black border ${viewTarget.isActive
                  ? 'bg-emerald-50 text-emerald-600 border-emerald-100'
                  : 'bg-slate-100 text-slate-550 border-slate-200'
                  }`}>
                  {viewTarget.isActive ? 'Active' : 'Inactive'}
                </span>
              </div>
              <IconButton onClick={() => setDetailsOpen(false)} size="small" className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </IconButton>
            </DialogTitle>

            <DialogContent className="pt-5 pb-5">
              <Grid container spacing={3}>

                {/* Column 1: Identity & System Stamping */}
                <Grid size={{ xs: 12, md: 6 }} className="space-y-4">
                  <div className="flex items-center gap-3.5 p-4 bg-slate-50 rounded-2xl border border-slate-200/50">
                    <div className="w-14 h-14 rounded-full bg-gradient-to-br from-[#0a5bd7] to-[#2691f5] flex items-center justify-center text-white font-extrabold text-lg shadow-md overflow-hidden">
                      {viewTarget.userId.profileImage ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={viewTarget.userId.profileImage} alt={viewTarget.userId.name} className="w-full h-full object-cover" />
                      ) : (
                        viewTarget.userId.name.charAt(0).toUpperCase()
                      )}
                    </div>
                    <div>
                      <p className="font-extrabold text-slate-800 text-base">{viewTarget.userId.name}</p>
                      <p className="text-xs text-slate-400 font-mono mt-0.5">{viewTarget.employeeCode}</p>
                      <p className="text-xs text-slate-450 mt-1">{viewTarget.userId.email}</p>
                    </div>
                  </div>

                  {/* Employment Details */}
                  <div className="bg-slate-50/50 p-4 rounded-2xl border border-slate-100 space-y-3">
                    <Typography className="text-xs font-black uppercase tracking-wider text-slate-400">Position Profile</Typography>
                    <table className="w-full text-xs text-slate-655">
                      <tbody>
                        <tr className="border-b border-slate-100/60"><td className="py-2 font-bold w-28">Designation</td><td className="py-2 text-slate-800 font-semibold">{viewTarget.designationId.name}</td></tr>
                        <tr className="border-b border-slate-100/60"><td className="py-2 font-bold">Permission Role</td><td className="py-2 text-slate-800 font-semibold">{viewTarget.permissionRoleId.name}</td></tr>
                        <tr className="border-b border-slate-100/60"><td className="py-2 font-bold">Phone</td><td className="py-2 text-slate-800 font-semibold">{viewTarget.phone || '—'}</td></tr>
                        <tr className="border-b border-slate-100/60"><td className="py-2 font-bold">Emergency</td><td className="py-2 text-slate-800 font-semibold">{viewTarget.emergencyContact || '—'}</td></tr>
                        <tr><td className="py-2 font-bold">Reporting Manager</td><td className="py-2 text-slate-800 font-semibold">{viewTarget.reportingManagerId ? `${viewTarget.reportingManagerId.name} (${viewTarget.reportingManagerId.email})` : 'Owner / None'}</td></tr>
                      </tbody>
                    </table>
                  </div>

                  {/* Audit Metadata Stamping */}
                  <div className="bg-slate-50/50 p-4 rounded-2xl border border-slate-100 space-y-3 text-xs text-slate-505">
                    <Typography className="text-xs font-black uppercase tracking-wider text-slate-400">System Logs</Typography>
                    <div className="space-y-2">
                      <p><strong>Created by:</strong> {viewTarget.createdBy?.name || 'System / Owner'} <span className="text-slate-400 font-mono">({formatDate(viewTarget.createdAt)})</span></p>
                      {viewTarget.updatedBy && (
                        <p><strong>Last updated by:</strong> {viewTarget.updatedBy.name} <span className="text-slate-400 font-mono">({formatDate(viewTarget.updatedAt)})</span></p>
                      )}
                    </div>
                  </div>
                </Grid>

                {/* Column 2: Personal, Address, & Bank Info */}
                <Grid size={{ xs: 12, md: 6 }} className="space-y-4">
                  {/* Personal Dates */}
                  <div className="bg-slate-50/50 p-4 rounded-2xl border border-slate-100 space-y-3">
                    <Typography className="text-xs font-black uppercase tracking-wider text-slate-400 flex items-center gap-1.5"><Calendar className="w-3.5 h-3.5 text-slate-400" /> Personal Dates</Typography>
                    <table className="w-full text-xs text-slate-655">
                      <tbody>
                        <tr className="border-b border-slate-100/60"><td className="py-1.5 font-bold w-32">Date of Birth</td><td className="py-1.5 text-slate-800 font-medium">{formatDate(viewTarget.dateOfBirth)}</td></tr>
                        <tr><td className="py-1.5 font-bold">Date of Joining</td><td className="py-1.5 text-slate-800 font-medium">{formatDate(viewTarget.dateOfJoining)}</td></tr>
                      </tbody>
                    </table>
                  </div>

                  {/* Address Section */}
                  <div className="bg-slate-50/50 p-4 rounded-2xl border border-slate-100 space-y-3">
                    <Typography className="text-xs font-black uppercase tracking-wider text-slate-400 flex items-center gap-1.5"><MapPin className="w-3.5 h-3.5 text-slate-400" /> Address Details</Typography>
                    {viewTarget.address?.street || viewTarget.address?.city ? (
                      <div className="text-xs text-slate-700 leading-normal space-y-1">
                        <p className="font-semibold">{viewTarget.address.street}</p>
                        <p>{viewTarget.address.city}, {viewTarget.address.state} {viewTarget.address.zipCode}</p>
                        <p className="text-slate-450 uppercase font-bold text-[10px] tracking-wider">{viewTarget.address.country}</p>
                      </div>
                    ) : (
                      <p className="text-xs text-slate-400 font-semibold italic">No address details configured.</p>
                    )}
                  </div>

                  {/* Bank Details Section */}
                  <div className="bg-slate-50/50 p-4 rounded-2xl border border-slate-100 space-y-3">
                    <Typography className="text-xs font-black uppercase tracking-wider text-slate-400 flex items-center gap-1.5"><Landmark className="w-3.5 h-3.5 text-slate-400" /> Bank Information</Typography>
                    {viewTarget.bankDetails?.bankName || viewTarget.bankDetails?.accountNumber ? (
                      <table className="w-full text-xs text-slate-650">
                        <tbody>
                          <tr className="border-b border-slate-100/60"><td className="py-1.5 font-bold w-32">Bank Name</td><td className="py-1.5 text-slate-800 font-medium">{viewTarget.bankDetails.bankName}</td></tr>
                          <tr className="border-b border-slate-100/60"><td className="py-1.5 font-bold">Account Number</td><td className="py-1.5 text-slate-800 font-medium font-mono">{viewTarget.bankDetails.accountNumber}</td></tr>
                          <tr><td className="py-1.5 font-bold">IFSC / Code</td><td className="py-1.5 text-slate-800 font-medium font-mono">{viewTarget.bankDetails.ifscCode}</td></tr>
                        </tbody>
                      </table>
                    ) : (
                      <p className="text-xs text-slate-400 font-semibold italic">No bank credentials configured.</p>
                    )}
                  </div>
                </Grid>

              </Grid>
            </DialogContent>

            <DialogActions className="p-5 pt-0 border-t border-slate-100">
              <Button onClick={() => setDetailsOpen(false)} variant="outlined" fullWidth className="py-2.5 font-bold">
                Close Card
              </Button>
            </DialogActions>
          </>
        )}
      </Dialog>

      {/* Profile Hover Popover Card */}
      <Popover
        id="employee-hover-popover"
        sx={{ pointerEvents: 'none' }}
        open={Boolean(hoverAnchorEl)}
        anchorEl={hoverAnchorEl}
        anchorOrigin={{
          vertical: 'bottom',
          horizontal: 'left',
        }}
        transformOrigin={{
          vertical: 'top',
          horizontal: 'left',
        }}
        onClose={handleHoverClose}
        disableRestoreFocus
        slotProps={{
          paper: {
            sx: {
              p: 2,
              mt: 1,
              width: 280,
              boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.08), 0 8px 10px -6px rgba(0, 0, 0, 0.08)',
              borderRadius: '16px',
              border: '1px solid #e2e8f0',
              pointerEvents: 'auto'
            }
          }
        }}
      >
        {hoveredEmp && (
          <div className="space-y-3.5">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-gradient-to-br from-[#0a5bd7] to-[#2691f5] flex items-center justify-center text-white font-black text-sm shadow-sm overflow-hidden">
                {hoveredEmp.userId?.profileImage ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={hoveredEmp.userId.profileImage} alt={hoveredEmp.userId.name} className="w-full h-full object-cover" />
                ) : (
                  (hoveredEmp.userId?.name || 'Deleted').charAt(0).toUpperCase()
                )}
              </div>
              <div className="min-w-0 flex-1">
                <h4 className="font-extrabold text-slate-800 text-sm truncate">{hoveredEmp.userId?.name}</h4>
                <p className="text-[10px] text-slate-400 font-mono mt-0.5">{hoveredEmp.employeeCode}</p>
              </div>
            </div>
            
            <div className="border-t border-slate-100 pt-3 space-y-2 text-xs">
              <div className="flex items-center gap-2">
                <Briefcase className="w-3.5 h-3.5 text-slate-400" />
                <span className="font-semibold text-slate-700">{hoveredEmp.designationId?.name}</span>
              </div>
              <div className="flex items-center gap-2">
                <Mail className="w-3.5 h-3.5 text-slate-400" />
                <span className="text-slate-500 truncate">{hoveredEmp.userId?.email}</span>
              </div>
              {hoveredEmp.phone && (
                <div className="flex items-center gap-2">
                  <Contact className="w-3.5 h-3.5 text-slate-400" />
                  <span className="text-slate-500">{hoveredEmp.phone}</span>
                </div>
              )}
              <div className="flex items-center gap-2 border-t border-slate-100 pt-2.5 mt-1">
                <Users className="w-3.5 h-3.5 text-slate-400" />
                <span className="text-slate-500 text-[10px]">
                  Reports to: <strong className="text-slate-700">{hoveredEmp.reportingManagerId?.name || 'Owner / None'}</strong>
                </span>
              </div>
            </div>
          </div>
        )}
      </Popover>
    </div>
  );
}
