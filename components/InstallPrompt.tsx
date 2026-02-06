import React, { useState, useEffect } from 'react';
import { Smartphone, Download, X, Share } from 'lucide-react';

export const InstallPrompt: React.FC = () => {
  const [showPrompt, setShowPrompt] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isIOS, setIsIOS] = useState(false);

  useEffect(() => {
    // Detect iOS
    const isIOSDevice = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
    setIsIOS(isIOSDevice);

    // Detect if already installed
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches || (navigator as any).standalone;
    
    if (isStandalone) return;

    const handleBeforeInstallPrompt = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setShowPrompt(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    // For iOS, we show it manually after a delay
    if (isIOSDevice && !isStandalone) {
      const timer = setTimeout(() => setShowPrompt(true), 3000);
      return () => clearTimeout(timer);
    }

    return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setShowPrompt(false);
    }
    setDeferredPrompt(null);
  };

  if (!showPrompt) return null;

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[100] w-[95%] max-w-sm animate-in slide-in-from-bottom-10 duration-500">
      <div className="bg-slate-900 border border-white/10 rounded-2xl shadow-2xl p-5 text-white relative overflow-hidden">
        <div className="absolute top-0 right-0 p-2">
            <button onClick={() => setShowPrompt(false)} className="text-slate-400 hover:text-white p-1 transition-colors">
                <X size={18} />
            </button>
        </div>

        <div className="flex gap-4">
            <div className="w-12 h-12 bg-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-500/20 shrink-0">
                <Smartphone size={24} />
            </div>
            <div className="space-y-1">
                <h3 className="font-bold text-sm leading-tight">Install FactorySystem</h3>
                <p className="text-[10px] text-slate-400 font-medium">Access production logs faster from your home screen.</p>
            </div>
        </div>

        {isIOS ? (
            <div className="mt-4 bg-white/5 border border-white/10 rounded-xl p-3 space-y-2">
                <div className="flex items-center gap-2 text-[10px] font-bold text-indigo-400">
                   <Share size={12} /> Instructions for iPhone:
                </div>
                <p className="text-[10px] text-slate-300 leading-relaxed">
                    1. Tap the <span className="font-bold text-white">"Share"</span> button in Safari.<br/>
                    2. Scroll down and select <span className="font-bold text-white">"Add to Home Screen"</span>.
                </p>
            </div>
        ) : (
            <button 
                onClick={handleInstall}
                className="mt-4 w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-3 rounded-xl text-xs flex items-center justify-center gap-2 shadow-xl shadow-indigo-900/20 transition-all active:scale-95"
            >
                <Download size={14} /> Add to Home Screen
            </button>
        )}
      </div>
    </div>
  );
};