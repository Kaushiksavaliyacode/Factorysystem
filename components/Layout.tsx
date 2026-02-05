
import React, { useState } from 'react';
import { Role } from '../types';

interface LayoutProps {
  currentRole: Role;
  setRole: (role: Role) => void;
  currentView: string;
  setView: (view: string) => void;
  onLogout: () => void;
  children: React.ReactNode;
}

export const Layout: React.FC<LayoutProps> = ({ currentRole, setRole, currentView, setView, onLogout, children }) => {
  const handleRotate = async () => {
    try {
      if (!document.fullscreenElement) {
        await document.documentElement.requestFullscreen();
        // Attempt to lock to landscape if supported
        if (screen.orientation && 'lock' in screen.orientation) {
            // @ts-ignore
            await screen.orientation.lock('landscape').catch(e => console.log('Orientation lock failed:', e));
        }
      } else {
        if (document.exitFullscreen) {
            await document.exitFullscreen();
        }
        if (screen.orientation && 'unlock' in screen.orientation) {
            screen.orientation.unlock();
        }
      }
    } catch (err) {
      console.error(err);
      alert("Manual rotation required on this device.");
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50/50 selection:bg-indigo-100 selection:text-indigo-900">
      
      {/* Ambient Background */}
      <div className="fixed inset-0 z-[-1] overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-0 w-full h-[500px] bg-gradient-to-b from-indigo-50/50 to-transparent opacity-60"></div>
      </div>

      {/* Floating Modern Header */}
      <header className="sticky top-0 z-50 pt-4 px-4 sm:px-6 mb-6">
        <div className="glass max-w-[1920px] mx-auto rounded-2xl shadow-lg shadow-slate-200/50 px-4 h-16 flex items-center justify-between transition-all">
          
          {/* Brand Identity */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-indigo-600 to-violet-600 rounded-xl flex items-center justify-center text-white shadow-md shadow-indigo-200">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" /></svg>
            </div>
            <div className="flex flex-col leading-none">
              <h1 className="text-lg font-bold text-slate-800 tracking-tight">RDMS</h1>
              <div className="flex items-center gap-1.5 mt-1">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                </span>
                <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide">Live System</span>
              </div>
            </div>
          </div>

          {/* Navigation Controls */}
          <div className="flex items-center gap-3 sm:gap-6">
             {currentRole === Role.ADMIN && (
               <nav className="hidden md:flex items-center bg-slate-100/80 p-1 rounded-xl">
                 <button 
                   onClick={() => setView('dashboard')}
                   className={`px-5 py-2 rounded-lg text-xs font-bold transition-all duration-200 ${currentView === 'dashboard' ? 'bg-white text-indigo-700 shadow-sm ring-1 ring-black/5' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200/50'}`}
                 >
                   Overview
                 </button>
               </nav>
             )}
             
             <div className="flex items-center gap-3 pl-6 border-l border-slate-200/60">
                <div className="text-right hidden sm:block">
                   <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">Session</div>
                   <div className="flex items-center gap-1.5 bg-slate-100 px-2 py-1 rounded-md">
                      <span className="w-1.5 h-1.5 bg-indigo-500 rounded-full"></span>
                      <span className="text-xs font-bold text-slate-700 uppercase">{currentRole}</span>
                   </div>
                </div>

                {/* Rotate Screen Button */}
                <button 
                  onClick={handleRotate}
                  className="group relative p-2.5 bg-white border border-slate-100 hover:bg-indigo-50 hover:border-indigo-100 rounded-xl text-slate-400 hover:text-indigo-600 transition-all shadow-sm hover:shadow-md"
                  title="Rotate Screen / Fullscreen"
                >
                  <svg className="w-5 h-5 transition-transform group-hover:rotate-90 duration-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                </button>

                <button 
                  onClick={onLogout}
                  className="group relative p-2.5 bg-white border border-slate-100 hover:bg-red-50 hover:border-red-100 rounded-xl text-slate-400 hover:text-red-500 transition-all shadow-sm hover:shadow-md"
                  title="Logout"
                >
                  <svg className="w-5 h-5 transition-transform group-hover:translate-x-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
                </button>
             </div>
          </div>
        </div>
      </header>

      {/* Main Content Viewport */}
      <main className="flex-1 w-full max-w-[1920px] mx-auto px-4 sm:px-6 pb-8">
          {children}
      </main>
    </div>
  );
};
