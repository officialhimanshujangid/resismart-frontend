'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth, IContext } from '../../../context/AuthContext';
import { Button } from '../../../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../../../components/ui/card';
import { Home, ShoppingBag, ArrowRight, Building } from 'lucide-react';

export default function SelectContextPage() {
  const { availableContexts, selectProfileContext, isLoading, logout } = useAuth();
  const router = useRouter();
  const [contexts, setContexts] = useState<IContext[]>([]);
  const [tempUserId, setTempUserId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selecting, setSelecting] = useState<string | null>(null);

  useEffect(() => {
    const cachedUserId = localStorage.getItem('tempUserId');
    setTempUserId(cachedUserId);

    if (availableContexts && availableContexts.length > 0) {
      setContexts(availableContexts);
    } else {
      const cached = localStorage.getItem('availableContexts');
      if (cached) {
        try {
          setContexts(JSON.parse(cached));
        } catch (_) {
          router.push('/login');
        }
      } else if (!isLoading) {
        router.push('/login');
      }
    }
  }, [availableContexts, isLoading, router]);

  const handleSelect = async (ctx: IContext) => {
    if (!tempUserId) {
      setError('Session expired. Please log in again.');
      return;
    }

    setSelecting(ctx.contextId);
    setError(null);

    try {
      const result = await selectProfileContext(ctx.contextId, tempUserId);
      if (result.success) {
        router.push('/dashboard');
      } else {
        setError(result.error || 'Failed to select workspace.');
        setSelecting(null);
      }
    } catch (err) {
      setError('An error occurred during selection.');
      setSelecting(null);
    }
  };

  const getIcon = (ctx: IContext) => {
    if (ctx.kind === 'SHOP') return <ShoppingBag className="w-8 h-8 text-amber-600" />;
    if (ctx.kind === 'SOCIETY_UNIT') return <Home className="w-8 h-8 text-emerald-600" />;
    return <Building className="w-8 h-8 text-violet-600" />;
  };

  const getTheme = (ctx: IContext) => {
    if (ctx.kind === 'SHOP') return 'border-amber-100 hover:border-amber-300 hover:bg-amber-50/20';
    if (ctx.kind === 'SOCIETY_UNIT') return 'border-emerald-100 hover:border-emerald-300 hover:bg-emerald-50/20';
    return 'border-violet-100 hover:border-violet-300 hover:bg-violet-50/20';
  };

  const formatRoleName = (role: string) =>
    role.split('_').map((w) => w.charAt(0) + w.slice(1).toLowerCase()).join(' ');

  if (isLoading && contexts.length === 0) {
    return (
      <div className="min-h-screen bg-slate-50/50 flex items-center justify-center">
        <div className="text-center space-y-3">
          <p className="text-muted-foreground animate-pulse text-sm font-medium">Preparing your units...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50/50 flex items-center justify-center relative overflow-hidden px-4 py-12">
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-indigo-500/5 blur-[120px] pointer-events-none z-0" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full bg-violet-500/5 blur-[120px] pointer-events-none z-0" />

      <div className="w-full max-w-4xl relative z-10 space-y-8">
        <div className="text-center space-y-2">
          <div className="w-12 h-12 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center shadow-md mx-auto mb-3">
            <Building className="w-6 h-6 text-primary" />
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight text-foreground">
            Choose Your Unit
          </h1>
          <p className="text-muted-foreground text-sm max-w-md mx-auto leading-relaxed">
            Your account holds multiple flats, plots or shops. Pick one to get started — you can switch anytime.
          </p>
        </div>

        {error && (
          <div className="w-full max-w-md mx-auto p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-sm font-medium text-center">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-2xl mx-auto">
          {contexts.map((ctx) => {
            const isSelecting = selecting === ctx.contextId;
            return (
              <Card
                key={ctx.contextId}
                onClick={() => !selecting && handleSelect(ctx)}
                className={`cursor-pointer bg-white border shadow-xl hover:shadow-2xl transition-all duration-300 transform hover:-translate-y-1 ${getTheme(ctx)} ${selecting && !isSelecting ? 'opacity-40 pointer-events-none' : ''}`}
              >
                <CardHeader className="flex flex-row items-center space-y-0 space-x-4 p-6">
                  <div className="p-3 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-center">
                    {getIcon(ctx)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className="text-[10px] font-bold tracking-wider uppercase text-slate-400">
                      {formatRoleName(ctx.role)}
                    </span>
                    <CardTitle className="text-lg font-extrabold text-slate-800 mt-0.5 truncate">
                      {ctx.unitLabel || ctx.tenantName}
                    </CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="px-6 pb-6 flex items-center justify-between text-xs text-muted-foreground">
                  <span className="font-semibold text-slate-500 truncate">
                    {ctx.unitLabel ? ctx.tenantName : ctx.tenantType}
                  </span>
                  <div className="flex items-center text-primary font-bold hover:underline shrink-0">
                    {isSelecting ? 'Entering...' : 'Enter'}
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
