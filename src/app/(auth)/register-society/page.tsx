'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import api from '@/lib/api';
import {
  MapPin, Building, User, Mail, Phone, CheckCircle2, ArrowRight, ArrowLeft, Navigation, Loader2, AlertCircle,
} from 'lucide-react';
import OtpVerifyField from '@/components/common/OtpVerifyField';

const GMAPS_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
const DEFAULT_CENTER = { lat: 28.6273, lng: 77.3649 };

declare global {
  interface Window { google?: any; __gmapsLoading?: Promise<void>; }
}

function loadGoogleMaps(): Promise<void> {
  if (typeof window === 'undefined') return Promise.resolve();
  if (window.google?.maps?.places) return Promise.resolve();
  if (window.__gmapsLoading) return window.__gmapsLoading;
  window.__gmapsLoading = new Promise<void>((resolve, reject) => {
    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${GMAPS_KEY}&libraries=places`;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Failed to load Google Maps'));
    document.head.appendChild(script);
  });
  return window.__gmapsLoading;
}

export default function RegisterSocietyPage() {
  const [step, setStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [formData, setFormData] = useState({
    name: '', address: '', contactName: '', contactEmail: '', contactPhone: '',
    latitude: DEFAULT_CENTER.lat.toString(), longitude: DEFAULT_CENTER.lng.toString(),
  });

  const mapRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const mapObj = useRef<any>(null);
  const markerObj = useRef<any>(null);
  const [mapReady, setMapReady] = useState(false);
  const [mapError, setMapError] = useState(false);

  // Both the login email and the org phone must be OTP-verified before submitting.
  const [emailToken, setEmailToken] = useState('');
  const [phoneToken, setPhoneToken] = useState('');
  const emailVerified = !!emailToken;
  const phoneVerified = !!phoneToken;

  const OTP_PURPOSE = 'SOCIETY_REGISTRATION';

  const setLatLng = (lat: number, lng: number) => {
    setFormData((f) => ({ ...f, latitude: lat.toFixed(6), longitude: lng.toFixed(6) }));
  };

  const reverseGeocode = useCallback((lat: number, lng: number) => {
    if (!window.google?.maps) return;
    const geocoder = new window.google.maps.Geocoder();
    geocoder.geocode({ location: { lat, lng } }, (results: any, status: string) => {
      if (status === 'OK' && results?.[0]) {
        setFormData((f) => ({ ...f, address: results[0].formatted_address }));
      }
    });
  }, []);

  // Initialise map + autocomplete when entering step 1
  useEffect(() => {
    if (step !== 1) return;
    let cancelled = false;
    loadGoogleMaps()
      .then(() => {
        if (cancelled || !mapRef.current) return;
        const center = { lat: Number(formData.latitude) || DEFAULT_CENTER.lat, lng: Number(formData.longitude) || DEFAULT_CENTER.lng };
        const map = new window.google.maps.Map(mapRef.current, { center, zoom: 14, disableDefaultUI: true, zoomControl: true });
        const marker = new window.google.maps.Marker({ position: center, map, draggable: true });
        mapObj.current = map;
        markerObj.current = marker;
        setMapReady(true);

        marker.addListener('dragend', () => {
          const pos = marker.getPosition();
          setLatLng(pos.lat(), pos.lng());
          reverseGeocode(pos.lat(), pos.lng());
        });
        map.addListener('click', (e: any) => {
          marker.setPosition(e.latLng);
          setLatLng(e.latLng.lat(), e.latLng.lng());
          reverseGeocode(e.latLng.lat(), e.latLng.lng());
        });

        if (searchRef.current) {
          const ac = new window.google.maps.places.Autocomplete(searchRef.current, { fields: ['geometry', 'formatted_address', 'name'] });
          ac.addListener('place_changed', () => {
            const place = ac.getPlace();
            if (!place.geometry?.location) return;
            const loc = place.geometry.location;
            map.setCenter(loc); map.setZoom(16); marker.setPosition(loc);
            setLatLng(loc.lat(), loc.lng());
            setFormData((f) => ({
              ...f,
              address: place.formatted_address || f.address,
              name: f.name || place.name || '',
            }));
          });
        }
      })
      .catch(() => setMapError(true));
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!emailVerified || !phoneVerified) {
      setError('Please verify both your email and phone number before submitting.');
      return;
    }
    setSubmitting(true);
    try {
      await api.post('/societies/register-public', {
        name: formData.name.trim(),
        address: formData.address.trim(),
        contactName: formData.contactName.trim(),
        contactEmail: formData.contactEmail.trim(),
        contactPhone: formData.contactPhone.trim(),
        emailVerificationToken: emailToken,
        phoneVerificationToken: phoneToken,
        latitude: formData.latitude ? Number(formData.latitude) : undefined,
        longitude: formData.longitude ? Number(formData.longitude) : undefined,
      });
      setStep(3);
    } catch (err: any) {
      setError(err.response?.data?.error || err.response?.data?.message || 'Registration failed. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col lg:flex-row animate-in fade-in duration-300">
      {/* Left visual */}
      <div className="hidden lg:flex lg:w-5/12 bg-gradient-to-br from-[#0a5bd7] to-[#1e3a8a] text-white p-12 flex-col justify-between relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-white/10 rounded-full blur-3xl -mr-20 -mt-20" />
        <div className="absolute bottom-0 left-0 w-96 h-96 bg-cyan-400/10 rounded-full blur-3xl -ml-20 -mb-20" />
        <div className="flex items-center gap-3 relative z-10">
          <div className="w-9 h-9 rounded-xl bg-white/10 backdrop-blur-md flex items-center justify-center border border-white/20"><Building className="w-5 h-5 text-white" /></div>
          <span className="text-xl font-black tracking-tight">Resismart</span>
        </div>
        <div className="space-y-6 relative z-10">
          <Badge className="bg-white/10 text-cyan-200 hover:bg-white/15 border-white/10 w-fit">Next-Gen Society Management</Badge>
          <h2 className="text-4xl font-black leading-tight">Streamline your gated community operations.</h2>
          <p className="text-slate-200 text-md font-medium max-w-md">Pin your exact location, manage visitors and staff, and automate maintenance billing — all in one place.</p>
        </div>
        <div className="text-slate-300 text-xs font-semibold relative z-10">© 2026 Resismart Technology. All rights reserved.</div>
      </div>

      {/* Right form */}
      <div className="flex-1 flex flex-col justify-center items-center p-6 md:p-12 bg-slate-50">
        <div className="w-full max-w-lg space-y-8">
          {step < 3 && (
            <div className="flex items-center gap-4 justify-center sm:justify-start">
              <div className="flex items-center gap-2">
                <span className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-black ${step === 1 ? 'bg-[#0a5bd7] text-white shadow-md' : 'bg-emerald-100 text-emerald-800'}`}>{step > 1 ? <CheckCircle2 className="w-4 h-4" /> : '1'}</span>
                <span className="text-xs font-black text-slate-700">Society & Location</span>
              </div>
              <div className="w-8 h-px bg-slate-300" />
              <div className="flex items-center gap-2">
                <span className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-black ${step === 2 ? 'bg-[#0a5bd7] text-white shadow-md' : 'bg-slate-200 text-slate-500'}`}>2</span>
                <span className="text-xs font-black text-slate-700">Admin Contact</span>
              </div>
            </div>
          )}

          {step === 1 && (
            <Card className="shadow-xl border border-slate-200/80">
              <CardHeader>
                <CardTitle className="text-2xl font-black text-slate-800">Register Society</CardTitle>
                <CardDescription>Search your society, then drag the pin to fine-tune the exact location.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                <div className="space-y-1.5">
                  <Label className="font-bold text-slate-700">Search location</Label>
                  <div className="relative">
                    <Navigation className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4 z-10" />
                    <input ref={searchRef} placeholder="Search society or area..." disabled={mapError}
                      className="w-full pl-9 pr-3 h-11 rounded-xl border border-slate-200/80 text-sm outline-none focus:border-[#0a5bd7] focus:ring-2 focus:ring-[#0a5bd7]/15" />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="sName" className="font-bold text-slate-700">Society Name</Label>
                  <div className="relative">
                    <Building className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
                    <Input id="sName" placeholder="e.g. Greenwood Cooperative Society" className="pl-9 rounded-xl border-slate-200/80 h-11"
                      value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="sAddr" className="font-bold text-slate-700">Address</Label>
                  <div className="relative">
                    <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
                    <Input id="sAddr" placeholder="Street, District, State..." className="pl-9 rounded-xl border-slate-200/80 h-11"
                      value={formData.address} onChange={(e) => setFormData({ ...formData, address: e.target.value })} />
                  </div>
                </div>

                {/* Map */}
                <div className="space-y-2">
                  <span className="text-xs font-black uppercase text-slate-400 tracking-wider flex items-center gap-1.5">
                    <Navigation className="w-4 h-4 text-blue-600" /> Precise Location (drag the pin)
                  </span>
                  <div className="h-48 rounded-2xl overflow-hidden border border-slate-200 relative bg-blue-50/40">
                    {mapError ? (
                      <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-400 text-xs gap-1 p-4 text-center">
                        <AlertCircle className="w-6 h-6 text-amber-500" />
                        Map unavailable — you can still enter coordinates manually below.
                      </div>
                    ) : !mapReady ? (
                      <div className="absolute inset-0 flex items-center justify-center text-slate-400"><Loader2 className="w-6 h-6 animate-spin" /></div>
                    ) : null}
                    <div ref={mapRef} className="w-full h-full" />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label className="text-[10px] font-bold text-slate-500 uppercase">Latitude</Label>
                      <Input value={formData.latitude} onChange={(e) => setFormData({ ...formData, latitude: e.target.value })} className="rounded-xl border-slate-200/80 text-xs h-9 bg-slate-50" />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[10px] font-bold text-slate-500 uppercase">Longitude</Label>
                      <Input value={formData.longitude} onChange={(e) => setFormData({ ...formData, longitude: e.target.value })} className="rounded-xl border-slate-200/80 text-xs h-9 bg-slate-50" />
                    </div>
                  </div>
                </div>

                <Button onClick={() => setStep(2)} disabled={!formData.name || !formData.address}
                  className="w-full bg-[#0a5bd7] hover:bg-[#0a5bd7]/90 text-white rounded-xl h-11 font-black shadow-md mt-2">
                  Proceed to Contact Info <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </CardContent>
            </Card>
          )}

          {step === 2 && (
            <Card className="shadow-xl border border-slate-200/80">
              <CardHeader>
                <CardTitle className="text-2xl font-black text-slate-800">Admin Contact</CardTitle>
                <CardDescription>The primary admin who will manage this society once approved.</CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSubmit} className="space-y-5">
                  <div className="space-y-1.5">
                    <Label htmlFor="admName" className="font-bold text-slate-700">Administrator Full Name</Label>
                    <div className="relative">
                      <User className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
                      <Input id="admName" required placeholder="e.g. Johnathan Doe" className="pl-9 rounded-xl border-slate-200/80 h-11"
                        value={formData.contactName} onChange={(e) => setFormData({ ...formData, contactName: e.target.value })} />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="admEmail" className="font-bold text-slate-700">Official Email <span className="text-red-500">*</span></Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
                      <Input id="admEmail" required type="email" placeholder="admin@societydomain.com" disabled={emailVerified}
                        className="pl-9 rounded-xl border-slate-200/80 h-11 disabled:bg-slate-50 disabled:text-slate-500"
                        value={formData.contactEmail} onChange={(e) => setFormData({ ...formData, contactEmail: e.target.value })} />
                    </div>
                    <OtpVerifyField channel="EMAIL" target={formData.contactEmail} purpose={OTP_PURPOSE}
                      onVerified={setEmailToken} onReset={() => setEmailToken('')} />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="admPhone" className="font-bold text-slate-700">Phone <span className="text-red-500">*</span></Label>
                    <div className="relative">
                      <Phone className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
                      <Input id="admPhone" required placeholder="+91 98765 43210" disabled={phoneVerified}
                        className="pl-9 rounded-xl border-slate-200/80 h-11 disabled:bg-slate-50 disabled:text-slate-500"
                        value={formData.contactPhone} onChange={(e) => setFormData({ ...formData, contactPhone: e.target.value })} />
                    </div>
                    <OtpVerifyField channel="PHONE" target={formData.contactPhone} purpose={OTP_PURPOSE}
                      onVerified={setPhoneToken} onReset={() => setPhoneToken('')} />
                  </div>

                  {error && (
                    <div className="flex items-start gap-2 text-sm text-red-600 bg-red-50 border border-red-100 rounded-xl p-3">
                      <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" /> {error}
                    </div>
                  )}

                  <div className="flex gap-3 pt-2">
                    <Button type="button" onClick={() => setStep(1)} variant="outline" className="w-1/3 rounded-xl border-slate-200 text-slate-600 h-11 font-bold">
                      <ArrowLeft className="w-4 h-4 mr-2" /> Back
                    </Button>
                    <Button type="submit" disabled={submitting || !emailVerified || !phoneVerified} className="flex-1 bg-[#0a5bd7] hover:bg-[#0a5bd7]/90 text-white rounded-xl h-11 font-black shadow-md disabled:opacity-60">
                      {submitting ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : (!emailVerified || !phoneVerified) ? 'Verify Email & Phone' : 'Complete Registration'}
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          )}

          {step === 3 && (
            <Card className="shadow-xl border border-slate-200/80 text-center p-8">
              <CardContent className="space-y-6 pt-6">
                <div className="w-16 h-16 bg-emerald-100 rounded-2xl flex items-center justify-center mx-auto border border-emerald-200"><CheckCircle2 className="w-9 h-9 text-emerald-600" /></div>
                <div className="space-y-2">
                  <h3 className="text-2xl font-black text-slate-800">Registration Pending</h3>
                  <p className="text-slate-500 text-sm max-w-sm mx-auto font-medium"><strong>{formData.name}</strong> is registered. Our team will verify your details shortly.</p>
                </div>
                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 text-left text-xs text-slate-600 space-y-1">
                  <p>• A confirmation email was sent to <strong>{formData.contactEmail}</strong>.</p>
                  <p>• A free trial starts automatically on approval.</p>
                  <p>• Login credentials are emailed once approved.</p>
                </div>
                <Button onClick={() => (window.location.href = '/login')} className="w-full bg-black hover:bg-slate-800 text-white rounded-xl h-11 font-bold">Return to Portal Login</Button>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
