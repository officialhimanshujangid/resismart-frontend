'use client';

import React, { useState } from 'react';
import ProtectedRoute from '../../components/auth/ProtectedRoute';
import { Sidebar } from '../../components/layout/Sidebar';
import { Header } from '../../components/layout/Header';
import { RefreshCw } from 'lucide-react';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [switching, setSwitching] = useState(false);

  return (
    <ProtectedRoute>
      <div className="h-screen overflow-hidden bg-slate-100 flex flex-col text-slate-800 font-sans selection:bg-[#0a5bd7]/20">
        
        {/* Context Switching Overlay */}
        {switching && (
          <div className="fixed inset-0 bg-white/80 backdrop-blur-md z-[9999] flex flex-col items-center justify-center space-y-4 animate-in fade-in duration-200">
            <div className="w-16 h-16 bg-white rounded-2xl shadow-xl flex items-center justify-center">
              <RefreshCw className="w-8 h-8 text-[#0a5bd7] animate-spin" />
            </div>
            <p className="text-slate-800 text-sm font-black tracking-widest uppercase mt-4">Switching Workspace...</p>
          </div>
        )}

        <div className="flex-1 flex overflow-hidden">
          
          <Sidebar mobileOpen={sidebarOpen} setMobileOpen={setSidebarOpen} />

          {/* Main Content Area */}
          <div className="flex-1 flex flex-col min-w-0 overflow-hidden relative">
            
            <Header setMobileOpen={setSidebarOpen} setSwitching={setSwitching} />

            {/* Scrollable Dashboard Viewport */}
            <main className="flex-1 overflow-y-auto p-4 sm:p-6 md:p-8 bg-slate-100/50">
              <div className="max-w-7xl mx-auto space-y-6">
                <React.Suspense fallback={
                  <div className="flex items-center justify-center p-12">
                    <div className="relative w-12 h-12">
                      <div className="absolute inset-0 rounded-full border-4 border-[#0a5bd7]/20 animate-pulse" />
                      <div className="absolute inset-0 rounded-full border-4 border-t-[#0a5bd7] border-r-transparent border-b-transparent border-l-transparent animate-spin" />
                    </div>
                  </div>
                }>
                  {children}
                </React.Suspense>
              </div>
            </main>

          </div>
        </div>
      </div>
    </ProtectedRoute>
  );
}
