import React, { useState, useEffect } from 'react';
import { Layout } from './components/Layout';
import { UserDashboard } from './components/user/UserDashboard';
import { Dashboard } from './components/admin/Dashboard';
import { SlittingDashboard } from './components/slitting/SlittingDashboard'; 
import { ChemicalDashboard } from './components/chemical/ChemicalDashboard'; // New
import { subscribeToData } from './services/storageService';
import { Role, AppData } from './types';

const App: React.FC = () => {
  // Auth State
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [authId, setAuthId] = useState('');
  const [authPass, setAuthPass] = useState('');
  const [loginError, setLoginError] = useState('');

  // App State
  const [role, setRole] = useState<Role>(Role.ADMIN);
  const [view, setView] = useState<string>('dashboard');
  // Add missing plantProductionPlans property to initial state to satisfy AppData interface
  const [data, setData] = useState<AppData>({ 
    parties: [], 
    dispatches: [], 
    challans: [], 
    slittingJobs: [], 
    productionPlans: [], 
    plantProductionPlans: [],
    chemicalLogs: [], 
    chemicalPurchases: [],
    chemicalStock: { dop:0, stabilizer:0, epoxy:0, g161:0, nbs:0 } 
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Connect to Firebase Realtime Listeners
    const unsubscribe = subscribeToData((newData) => {
      setData(newData);
      setLoading(false);
    });

    // Cleanup on unmount
    return () => unsubscribe();
  }, []);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (authId === 'admin' && authPass === 'Admin.123') {
      setRole(Role.ADMIN);
      setIsAuthenticated(true);
      setLoginError('');
    } else if (authId === 'user' && authPass === 'User.123') {
      setRole(Role.USER);
      setIsAuthenticated(true);
      setLoginError('');
    } else if (authId === 'Chemical' && authPass === 'Chemical.123') {
      setRole(Role.CHEMICAL);
      setIsAuthenticated(true);
      setLoginError('');
    } else {
      setLoginError('Invalid ID or Password');
    }
  };

  const handleSlittingDirectLogin = () => {
    setRole(Role.SLITTING);
    setIsAuthenticated(true);
    setLoginError('');
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    setAuthId('');
    setAuthPass('');
    setRole(Role.ADMIN); // Default reset
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-purple-50 to-pink-50 flex items-center justify-center p-6">
        <div className="glass w-full max-w-md p-8 rounded-3xl shadow-2xl border border-white/50 backdrop-blur-xl animate-in fade-in zoom-in duration-500">
           <div className="flex flex-col items-center mb-10">
             <div className="w-16 h-16 bg-gradient-to-tr from-indigo-600 to-purple-600 rounded-2xl flex items-center justify-center text-white mb-4 shadow-lg shadow-indigo-200 transform rotate-3">
                <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" /></svg>
             </div>
             <h1 className="text-3xl font-bold text-slate-800 tracking-tight">RDMS</h1>
             <p className="text-slate-500 font-medium">Production & Dispatch</p>
           </div>
           
           <form onSubmit={handleLogin} className="space-y-6">
              <div className="group">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-2 ml-1">Access ID</label>
                <input 
                  type="text" 
                  value={authId}
                  onChange={e => setAuthId(e.target.value)}
                  className="w-full bg-white/80 border border-slate-200 rounded-2xl px-5 py-4 font-semibold text-slate-800 outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition-all shadow-sm group-hover:shadow-md"
                  placeholder="Enter your ID"
                />
              </div>
              <div className="group">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-2 ml-1">Passkey</label>
                <input 
                  type="password" 
                  value={authPass}
                  onChange={e => setAuthPass(e.target.value)}
                  className="w-full bg-white/80 border border-slate-200 rounded-2xl px-5 py-4 font-semibold text-slate-800 outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition-all shadow-sm group-hover:shadow-md"
                  placeholder="••••••••"
                />
              </div>
              
              {loginError && (
                <div className="bg-red-50 text-red-500 text-xs font-bold px-4 py-3 rounded-xl flex items-center gap-2">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                  {loginError}
                </div>
              )}

              <button className="w-full bg-slate-900 hover:bg-slate-800 text-white font-bold py-4 rounded-2xl shadow-xl shadow-slate-200 transition-all transform active:scale-[0.98] flex items-center justify-center gap-2 mt-4">
                <span>Secure Entry</span>
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" /></svg>
              </button>
           </form>

           {/* Quick Access Section */}
           <div className="relative my-8">
              <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-slate-200"></div></div>
              <div className="relative flex justify-center text-xs uppercase"><span className="bg-white/50 backdrop-blur px-2 text-slate-400 font-bold tracking-wider">Operator Access</span></div>
           </div>

           <button 
              type="button" 
              onClick={handleSlittingDirectLogin} 
              className="w-full bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white font-bold py-3.5 rounded-2xl shadow-lg shadow-amber-200 transition-all transform active:scale-[0.98] flex items-center justify-center gap-3"
           >
              <div className="bg-white/20 p-1 rounded-lg">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              </div>
              <span>Enter as Slitting Operator</span>
           </button>

           <div className="mt-8 text-center">
             <span className="text-[10px] font-semibold text-slate-300 uppercase tracking-widest">Authorized System V1.0</span>
           </div>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-4">
          <div className="relative">
             <div className="w-12 h-12 border-4 border-indigo-100 rounded-full"></div>
             <div className="w-12 h-12 border-4 border-indigo-600 rounded-full border-t-transparent animate-spin absolute top-0 left-0"></div>
          </div>
          <div className="text-slate-400 font-bold text-sm tracking-wide">Syncing Data...</div>
        </div>
      </div>
    );
  }

  return (
    <Layout currentRole={role} setRole={setRole} currentView={view} setView={setView} onLogout={handleLogout}>
      {role === Role.ADMIN && <Dashboard data={data} />}
      {role === Role.USER && <UserDashboard data={data} onUpdate={() => {}} />}
      {role === Role.SLITTING && <SlittingDashboard data={data} onUpdate={() => {}} />}
      {role === Role.CHEMICAL && <ChemicalDashboard data={data} onUpdate={() => {}} />}
    </Layout>
  );
};

export default App;