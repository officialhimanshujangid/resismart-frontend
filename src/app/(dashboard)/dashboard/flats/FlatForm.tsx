'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';
import { useToastConfirm } from '@/context/ToastConfirmContext';
import LocationPicker from '@/components/common/LocationPicker';
import {
  Button, TextField, CircularProgress, MenuItem, Select, FormControl, InputLabel, Grid, Paper, Divider, IconButton
} from '@mui/material';
import { Save, ArrowLeft } from 'lucide-react';
import OtpVerifyField from '@/components/common/OtpVerifyField';

interface Block {
  _id: string;
  name: string;
}

interface FlatSize {
  _id: string;
  name: string;
  details?: string;
}

interface Props {
  flatId?: string;
}

function deg2rad(deg: number) {
  return deg * (Math.PI / 180);
}

function getDistanceFromLatLonInMeters(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371e3; // Radius of the earth in m
  const dLat = deg2rad(lat2 - lat1);
  const dLon = deg2rad(lon2 - lon1); 
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) * 
    Math.sin(dLon/2) * Math.sin(dLon/2); 
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)); 
  return R * c; // Distance in m
}

export default function FlatForm({ flatId }: Props) {
  const router = useRouter();
  const { showToast } = useToastConfirm();

  const [blocks, setBlocks] = useState<Block[]>([]);
  const [flatSizes, setFlatSizes] = useState<FlatSize[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [formData, setFormData] = useState({
    number: '', blockId: '', sizeId: '', fullAddress: '',
    ownerName: '', ownerEmail: '', ownerPhone: '',
    latitude: '', longitude: ''
  });

  const [societyLocation, setSocietyLocation] = useState<{ lat: number; lng: number } | null>(null);

  // When provisioning an owner on create, BOTH email and phone must be OTP-verified.
  const [ownerEmailToken, setOwnerEmailToken] = useState('');
  const [ownerPhoneToken, setOwnerPhoneToken] = useState('');
  const emailVerified = !!ownerEmailToken;
  const phoneVerified = !!ownerPhoneToken;

  const hasOwnerInfo = !!(formData.ownerName.trim() || formData.ownerEmail.trim() || formData.ownerPhone.trim());

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const endpoint = flatId ? `/societies/flats/form-lookup?flatId=${flatId}` : '/societies/flats/form-lookup';
        const res = await api.get(endpoint);
        const { blocks, flatSizes, society: soc, flat } = res.data;

        setBlocks(blocks || []);
        setFlatSizes(flatSizes || []);

        let sLat: number | undefined;
        let sLng: number | undefined;
        if (soc?.location?.coordinates?.length === 2) {
          sLng = soc.location.coordinates[0];
          sLat = soc.location.coordinates[1];
          if (sLat !== undefined && sLng !== undefined) {
            setSocietyLocation({ lat: sLat, lng: sLng });
          }
        }

        if (flatId && flat) {

          const blockId = typeof flat.blockId === 'object' && flat.blockId !== null ? flat.blockId._id : flat.blockId;
          const sizeId = typeof flat.size === 'object' && flat.size !== null ? flat.size._id : flat.size;

          let lat = '';
          let lng = '';
          if (flat.location?.coordinates?.length === 2) {
            lng = flat.location.coordinates[0].toString();
            lat = flat.location.coordinates[1].toString();
          } else if (sLat !== undefined && sLng !== undefined) {
            // Fallback to society location if flat has no specific location
            lat = String(sLat);
            lng = String(sLng);
          }

          setFormData({
            number: flat.number,
            blockId: blockId || '',
            sizeId: sizeId || '',
            fullAddress: flat.fullAddress || '',
            ownerName: flat.ownerUserId?.name || '',
            ownerEmail: flat.ownerUserId?.email || '',
            ownerPhone: flat.ownerUserId?.phone || '',
            latitude: lat,
            longitude: lng
          });
        } else {
          // Pre-fill society location if available for creation
          setFormData((prev) => ({
            ...prev,
            blockId: blocks?.[0]?._id || '',
            latitude: sLat ? String(sLat) : '',
            longitude: sLng ? String(sLng) : ''
          }));
        }
      } catch (err: any) {
        showToast('Failed to load required data', 'error');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flatId]);

  const handleSubmit = async () => {
    if (!formData.number.trim() || !formData.blockId) {
      showToast('Flat number and block are required', 'error');
      return;
    }
    // If an owner is being provisioned (create only), name + verified email + verified phone are required.
    if (!flatId && hasOwnerInfo) {
      if (!formData.ownerName.trim() || !formData.ownerEmail.trim()) {
        showToast('Owner name and email are required', 'error');
        return;
      }
      if (!emailVerified || !phoneVerified) {
        showToast('Please verify the owner email and phone via OTP', 'error');
        return;
      }
    }
    setSubmitting(true);
    try {
      if (flatId) {
        await api.put(`/societies/flats/${flatId}`, {
          sizeId: formData.sizeId || undefined,
          fullAddress: formData.fullAddress,
          latitude: formData.latitude ? Number(formData.latitude) : undefined,
          longitude: formData.longitude ? Number(formData.longitude) : undefined
        });
        showToast('Flat updated successfully', 'success');
      } else {
        const block = blocks.find(b => b._id === formData.blockId);
        await api.post('/societies/flats', {
          number: formData.number,
          blockName: block?.name,
          blockId: formData.blockId,
          sizeId: formData.sizeId || undefined,
          fullAddress: formData.fullAddress,
          latitude: formData.latitude ? Number(formData.latitude) : undefined,
          longitude: formData.longitude ? Number(formData.longitude) : undefined,
          ownerName: formData.ownerName || undefined,
          ownerEmail: formData.ownerEmail || undefined,
          ownerPhone: formData.ownerPhone || undefined,
          ownerEmailVerificationToken: ownerEmailToken || undefined,
          ownerPhoneVerificationToken: ownerPhoneToken || undefined,
        });
        showToast('Flat created successfully', 'success');
      }
      router.push('/dashboard/flats');
    } catch (err: any) {
      showToast(err.response?.data?.error || 'Failed to save flat', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleLocationChange = (loc: { latitude: string; longitude: string; address?: string }) => {
    setFormData((prev) => ({
      ...prev,
      latitude: loc.latitude,
      longitude: loc.longitude,
      fullAddress: loc.address || prev.fullAddress
    }));
  };

  if (loading) {
    return <div className="flex items-center justify-center p-12"><CircularProgress size={32} /></div>;
  }

  let distanceStr = '';
  if (societyLocation && formData.latitude && formData.longitude) {
    const dist = getDistanceFromLatLonInMeters(
      societyLocation.lat,
      societyLocation.lng,
      Number(formData.latitude),
      Number(formData.longitude)
    );
    if (dist > 1) { // ignore very tiny sub-meter differences
      if (dist < 1000) {
        distanceStr = `${Math.round(dist)} meters from society center`;
      } else {
        distanceStr = `${(dist / 1000).toFixed(2)} km from society center`;
      }
    } else {
      distanceStr = 'Same as society center';
    }
  }

  return (
    <div className=" space-y-6">
      <div className="flex items-center gap-4">
        <IconButton onClick={() => router.push('/dashboard/flats')} size="small" className="bg-white border border-slate-200">
          <ArrowLeft className="w-4 h-4 text-slate-600" />
        </IconButton>
        <div>
          <h1 className="text-xl font-black text-slate-800">{flatId ? 'Edit Flat' : 'Add New Flat'}</h1>
          <p className="text-sm text-slate-500">{flatId ? 'Update details of an existing flat' : 'Create a new flat or unit in the society'}</p>
        </div>
      </div>

      <Paper className="p-6 rounded-2xl border border-slate-200 shadow-sm" elevation={0}>
        <Grid container spacing={4}>
          <Grid size={{ xs: 12, md: 6 }}>
            <h3 className="text-sm font-bold text-slate-800 mb-4">Flat Details</h3>
            <div className="flex flex-col gap-4">
              <FormControl fullWidth size="small" required>
                <InputLabel>Block</InputLabel>
                <Select
                  value={formData.blockId}
                  label="Block"
                  onChange={(e) => setFormData({ ...formData, blockId: e.target.value })}
                  disabled={!!flatId}
                >
                  {blocks.map(b => (
                    <MenuItem key={b._id} value={b._id}>{b.name}</MenuItem>
                  ))}
                </Select>
              </FormControl>

              <TextField
                label="Flat Number"
                fullWidth
                size="small"
                required
                value={formData.number}
                onChange={(e) => setFormData({ ...formData, number: e.target.value })}
                disabled={!!flatId}
              />

              <FormControl fullWidth size="small">
                <InputLabel>Flat Size</InputLabel>
                <Select
                  value={formData.sizeId}
                  label="Flat Size"
                  onChange={(e) => setFormData({ ...formData, sizeId: e.target.value })}
                >
                  <MenuItem value=""><em>None</em></MenuItem>
                  {flatSizes.map(s => (
                    <MenuItem key={s._id} value={s._id}>{s.name} {s.details ? `(${s.details})` : ''}</MenuItem>
                  ))}
                </Select>
              </FormControl>

              <TextField
                label="Full Address (Optional)"
                fullWidth
                size="small"
                multiline
                rows={2}
                value={formData.fullAddress}
                onChange={(e) => setFormData({ ...formData, fullAddress: e.target.value })}
              />
            </div>

            {!flatId && (
              <>
                <Divider sx={{ my: 4 }} />
                <h3 className="text-sm font-bold text-slate-800 mb-1">Primary Flat/Plot Owner (Optional)</h3>
                <p className="text-xs text-slate-500 mb-4">Leave blank for a vacant unit. If you add an owner, both their email and phone must be OTP-verified.</p>
                <div className="flex flex-col gap-4">
                  <TextField
                    label={hasOwnerInfo ? 'Owner Name *' : 'Owner Name'}
                    fullWidth
                    size="small"
                    value={formData.ownerName}
                    onChange={(e) => setFormData({ ...formData, ownerName: e.target.value })}
                  />
                  <div>
                    <TextField
                      label={hasOwnerInfo ? 'Owner Email *' : 'Owner Email'}
                      fullWidth
                      size="small"
                      type="email"
                      value={formData.ownerEmail}
                      disabled={emailVerified}
                      onChange={(e) => setFormData({ ...formData, ownerEmail: e.target.value })}
                    />
                    {hasOwnerInfo && (
                      <OtpVerifyField channel="EMAIL" target={formData.ownerEmail} purpose="FLAT_REGISTRATION"
                        onVerified={setOwnerEmailToken} onReset={() => setOwnerEmailToken('')} />
                    )}
                  </div>

                  <div>
                    <TextField
                      label={hasOwnerInfo ? 'Owner Phone *' : 'Owner Phone'}
                      fullWidth
                      size="small"
                      value={formData.ownerPhone}
                      disabled={phoneVerified}
                      onChange={(e) => setFormData({ ...formData, ownerPhone: e.target.value })}
                    />
                    {hasOwnerInfo && (
                      <OtpVerifyField channel="PHONE" target={formData.ownerPhone} purpose="FLAT_REGISTRATION"
                        onVerified={setOwnerPhoneToken} onReset={() => setOwnerPhoneToken('')} />
                    )}
                  </div>
                </div>
              </>
            )}
          </Grid>

          <Grid size={{ xs: 12, md: 6 }}>
            <h3 className="text-sm font-bold text-slate-800 mb-4">Location & Coordinates</h3>
            <div className="space-y-4">
              <LocationPicker
                latitude={formData.latitude}
                longitude={formData.longitude}
                onChange={handleLocationChange}
                height={250}
              />
              <div className="flex gap-2">
                <TextField
                  label="Latitude"
                  fullWidth
                  size="small"
                  type="number"
                  value={formData.latitude}
                  onChange={(e) => setFormData({ ...formData, latitude: e.target.value })}
                />
                <TextField
                  label="Longitude"
                  fullWidth
                  size="small"
                  type="number"
                  value={formData.longitude}
                  onChange={(e) => setFormData({ ...formData, longitude: e.target.value })}
                />
              </div>
              {distanceStr && (
                <p className="text-sm text-amber-600 font-medium">
                  {distanceStr}
                </p>
              )}
            </div>
          </Grid>
        </Grid>
      </Paper>

      <div className="flex justify-end gap-3 pt-2">
        <Button onClick={() => router.push('/dashboard/flats')} className="text-slate-600">
          Cancel
        </Button>
        <Button
          onClick={handleSubmit}
          variant="contained"
          disabled={submitting}
          startIcon={submitting ? <CircularProgress size={16} color="inherit" /> : <Save className="w-4 h-4" />}
          sx={{ backgroundColor: '#0a5bd7', '&:hover': { backgroundColor: '#094cb0' } }}
        >
          {flatId ? 'Update Flat' : 'Create Flat'}
        </Button>
      </div>
    </div>
  );
}
