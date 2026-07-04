'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useToastConfirm } from '@/context/ToastConfirmContext';
import { Button, CircularProgress, TextField } from '@mui/material';
import { Camera, User, Mail, Save } from 'lucide-react';
import api from '@/lib/api';

export default function ProfilePage() {
  const { user, updateCurrentUser } = useAuth();
  const { showToast } = useToastConfirm();

  const [name, setName] = useState(user?.name || '');
  const [email] = useState(user?.email || '');
  const [profileImage, setProfileImage] = useState(user?.profileImage || '');

  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (user) {
      setName(user.name);
      setProfileImage(user.profileImage || '');
    }
  }, [user]);

  const handleImageClick = () => {
    fileInputRef.current?.click();
  };

  const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      showToast('Please select a valid image file', 'error');
      return;
    }

    try {
      setIsUploading(true);
      const formData = new FormData();
      formData.append('image', file);

      const response = await api.post('/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      if (response.data.imageUrl) {
        setProfileImage(response.data.imageUrl);
        showToast('Image uploaded successfully. Click Save to apply changes.', 'success');
      }
    } catch (error: any) {
      showToast(error.response?.data?.error || 'Failed to upload image', 'error');
    } finally {
      setIsUploading(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      showToast('Name cannot be empty', 'error');
      return;
    }

    try {
      setIsSaving(true);
      const response = await api.put('/users/me', {
        name: name.trim(),
        profileImage
      });

      if (response.data.success) {
        updateCurrentUser({
          name: response.data.user.name,
          profileImage: response.data.user.profileImage
        });
        showToast('Profile updated successfully', 'success');
      }
    } catch (error: any) {
      showToast(error.response?.data?.error || 'Failed to update profile', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  if (!user) return null;

  return (
    <div className=" mx-auto space-y-8 animate-in fade-in duration-300">


      <div className="bg-white rounded-3xl p-8 border border-slate-200/60 shadow-sm">
        <form onSubmit={handleSave} className="space-y-8">

          {/* Profile Image Section */}
          <div className="flex flex-col items-center sm:flex-row sm:items-start gap-6">
            <div className="relative group">
              <div
                className="w-32 h-32 rounded-full overflow-hidden bg-slate-100 border-4 border-white shadow-lg cursor-pointer relative"
                onClick={handleImageClick}
              >
                {isUploading ? (
                  <div className="absolute inset-0 flex items-center justify-center bg-white/50 backdrop-blur-sm z-10">
                    <CircularProgress size={24} />
                  </div>
                ) : null}

                {profileImage ? (
                  <img src={profileImage} alt="Profile" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full bg-gradient-to-br from-[#0a5bd7] to-[#2691f5] flex items-center justify-center text-white text-4xl font-bold">
                    {name.charAt(0).toUpperCase()}
                  </div>
                )}

                <div className="absolute inset-0 bg-black/40 flex flex-col items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-opacity">
                  <Camera className="w-6 h-6 mb-1" />
                  <span className="text-xs font-bold">Change</span>
                </div>
              </div>
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleImageChange}
                accept="image/*"
                className="hidden"
              />
            </div>

            <div className="flex-1 space-y-1 text-center sm:text-left pt-4">
              <h3 className="text-lg font-bold text-slate-800">Profile Picture</h3>
              <p className="text-sm text-slate-500">
                Upload a picture to personalize your account. We recommend a square image, at least 256x256px.
              </p>
            </div>
          </div>

          <hr className="border-slate-100" />

          {/* User Details */}
          <div className="space-y-6">
            <div className="space-y-2">
              <label className="text-sm font-bold text-slate-700 flex items-center">
                <User className="w-4 h-4 mr-2 text-slate-400" />
                Full Name
              </label>
              <TextField
                fullWidth
                value={name}
                onChange={(e) => setName(e.target.value)}
                variant="outlined"
                size="small"
                className="bg-slate-50"
                required
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-bold text-slate-700 flex items-center">
                <Mail className="w-4 h-4 mr-2 text-slate-400" />
                Email Address
              </label>
              <TextField
                fullWidth
                value={email}
                disabled
                variant="outlined"
                size="small"
                className="bg-slate-50 opacity-70"
                helperText="Email address cannot be changed."
              />
            </div>
          </div>

          <div className="flex justify-end pt-4">
            <Button
              type="submit"
              variant="contained"
              disabled={isSaving || isUploading}
              className="bg-[#0a5bd7] hover:bg-[#0a5bd7]/90 text-white font-bold rounded-xl px-8 h-12 shadow-md"
            >
              {isSaving ? <CircularProgress size={24} className="text-white" /> : (
                <>
                  <Save className="w-4 h-4 mr-2" />
                  Save Changes
                </>
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
