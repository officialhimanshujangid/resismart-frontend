'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth, IUserProfile } from '../../../context/AuthContext';
import { Button } from '../../../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../../components/ui/card';
import { Shield, Home, ShoppingBag, ArrowRight, Building } from 'lucide-react';

export default function SelectContextPage() {
  const { availableProfiles, selectProfileContext, isLoading, logout } = useAuth();
  const router = useRouter();
  const [profiles, setProfiles] = useState<IUserProfile[]>([]);
  const [tempUserId, setTempUserId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selecting, setSelecting] = useState<string | null>(null);

  useEffect(() => {
    // Read from localStorage if state is empty due to refresh
    const cachedUserId = localStorage.getItem('tempUserId');
    setTempUserId(cachedUserId);

    if (availableProfiles && availableProfiles.length > 0) {
      setProfiles(availableProfiles);
    } else {
      const cachedProfiles = localStorage.getItem('availableProfiles');
      if (cachedProfiles) {
        try {
          setProfiles(JSON.parse(cachedProfiles));
        } catch (_) {
          router.push('/login');
        }
      } else if (!isLoading) {
        router.push('/login');
      }
    }
  }, [availableProfiles, isLoading, router]);

  const handleSelect = async (profile: IUserProfile, index: number) => {
    if (!tempUserId) {
      setError('Session expired. Please log in again.');
      return;
    }

    const selectKey = `${profile.tenantId}-${profile.role}-${index}`;
    setSelecting(selectKey);
    setError(null);

    try {
      const result = await selectProfileContext(profile.tenantId, profile.role, tempUserId);
      if (result.success) {
        router.push('/dashboard');
      } else {
        setError(result.error || 'Failed to select context.');
        setSelecting(null);
      }
    } catch (err) {
      setError('An error occurred during context selection.');
      setSelecting(null);
    }
  };

  const getProfileIcon = (type: string) => {
    switch (type) {
      case 'SYSTEM':
        return <Shield className="w-8 h-8 text-violet-600" />;
      case 'SOCIETY':
        return <Home className="w-8 h-8 text-emerald-600" />;
      case 'SHOP':
        return <ShoppingBag className="w-8 h-8 text-amber-600" />;
      default:
        return <Shield className="w-8 h-8 text-slate-600" />;
    }
  };

  const getProfileTheme = (type: string) => {
    switch (type) {
      case 'SYSTEM':
        return 'border-violet-100 hover:border-violet-300 hover:bg-violet-50/20';
      case 'SOCIETY':
        return 'border-emerald-100 hover:border-emerald-300 hover:bg-emerald-50/20';
      case 'SHOP':
        return 'border-amber-100 hover:border-amber-300 hover:bg-amber-50/20';
      default:
        return 'border-slate-100 hover:border-slate-300 hover:bg-slate-50/20';
    }
  };

  const formatRoleName = (role: string) => {
    return role
      .split('_')
      .map((w) => w.charAt(0) + w.slice(1).toLowerCase())
      .join(' ');
  };

  if (isLoading && profiles.length === 0) {
    return (
      <div className="min-h-screen bg-slate-50/50 flex items-center justify-center">
        <div className="text-center space-y-3">
          <p className="text-muted-foreground animate-pulse text-sm font-medium">Preparing contexts...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50/50 flex items-center justify-center relative overflow-hidden px-4 py-12">
      {/* Background Decorative Blur Spots */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-indigo-500/5 blur-[120px] pointer-events-none z-0" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full bg-violet-500/5 blur-[120px] pointer-events-none z-0" />

      <div className="w-full max-w-4xl relative z-10 space-y-8">
        
        {/* Branding & Welcome */}
        <div className="text-center space-y-2">
          <div className="w-12 h-12 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center shadow-md mx-auto mb-3">
            <Building className="w-6 h-6 text-primary" />
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight text-foreground">
            Choose Your Workspace
          </h1>
          <p className="text-muted-foreground text-sm max-w-md mx-auto leading-relaxed">
            Your account is associated with multiple roles or contexts. Select a workspace to get started.
          </p>
        </div>

        {error && (
          <div className="w-full max-w-md mx-auto p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-sm font-medium text-center">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-2xl mx-auto">
          {profiles.map((profile, idx) => {
            const selectKey = `${profile.tenantId}-${profile.role}-${idx}`;
            const isSelecting = selecting === selectKey;

            return (
              <Card
                key={selectKey}
                onClick={() => !selecting && handleSelect(profile, idx)}
                className={`cursor-pointer bg-white border shadow-xl hover:shadow-2xl transition-all duration-300 transform hover:-translate-y-1 ${getProfileTheme(
                  profile.tenantType
                )} ${selecting && !isSelecting ? 'opacity-40 pointer-events-none' : ''}`}
              >
                <CardHeader className="flex flex-row items-center space-y-0 space-x-4 p-6">
                  <div className="p-3 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-center">
                    {getProfileIcon(profile.tenantType)}
                  </div>
                  <div className="flex-1">
                    <span className="text-[10px] font-bold tracking-wider uppercase text-slate-400">
                      {profile.tenantType} Level
                    </span>
                    <CardTitle className="text-lg font-extrabold text-slate-800 mt-0.5">
                      {formatRoleName(profile.role)}
                    </CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="px-6 pb-6 flex items-center justify-between text-xs text-muted-foreground">
                  <span className="font-mono text-slate-400 bg-slate-50 px-2 py-0.5 rounded border border-slate-100">
                    ID: {profile.tenantId.substring(0, 8)}...
                  </span>
                  <div className="flex items-center text-primary font-bold hover:underline">
                    {isSelecting ? 'Entering...' : 'Enter workspace'}
                    <ArrowRight className="w-4 h-4 ml-1.5" />
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        <div className="text-center pt-4">
          <Button
            variant="ghost"
            onClick={logout}
            className="text-muted-foreground hover:text-foreground font-semibold hover:bg-slate-100"
          >
            Back to Sign In
          </Button>
        </div>
      </div>
    </div>
  );
}
