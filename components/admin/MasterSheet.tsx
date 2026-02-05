
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { AppData, DispatchStatus, SlittingJob } from '../../types';
import { 
    syncAllDataToCloud, triggerDashboardSetup, setGoogleSheetUrl, 
    getGoogleSheetUrl, restoreFullBackup 
} from '../../services/storageService';
import { 
    Cloud, RefreshCw, Download, Settings, CircleCheck, 
    CircleAlert, X, Database, UploadCloud, FileJson, Search, Filter
} from 'lucide-react';

interface Props {
  data: AppData;
}

const PROD_DENSITY = 0.00276;

export const MasterSheet: React.FC<Props> = ({ data }) => {
  const [activeSheet, setActiveSheet] = useState<'production' | 'billing' | 'plant' | 'slitting'>('production');
  const [searchTerm, setSearchTerm] = useState('');
  
  // Sync State
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncProgress, setSyncProgress] = useState({ current: 0, total: 0 });
  const [syncStatus, setSyncStatus] = useState<'idle' | 'running' | 'done'>('idle');
  
  // Restore State
  const [isRestoring, setIsRestoring] = useState(false);
  const [restoreProgress, setRestoreProgress] = useState({ step: '', current: 0, total: 0 });
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [isSetupOpen, setIsSetupOpen] = useState(false);
  const [sheetUrl, setSheetUrl] = useState('');

  useEffect(() => {
      setSheetUrl(getGoogleSheetUrl());
  }, [isSetupOpen]);

  // --- DATA PROCESSING ---
  const plantRows = useMemo(() => {
    return data.slittingJobs.map(job => {
        const sizer = job.planSizer || job.coils.reduce((s, c) => s + parseFloat(c.size), 0);
        const mic = job.planMicron;
        const slitLen = job.planRollLength;
        const tube1mtrWeight = sizer * mic * PROD_DENSITY;
        const tubeRollLen = slitLen / 2;
        const oneRollWeight = (tube1mtrWeight / 1000) * tubeRollLen;
        const totalRolls = Math.max(...job.coils.map(c => c.rolls));

        return {
            id: job.id, date: job.date, party: job.jobCode, srNo: job.jobNo.split('-').pop(),
            sizer, micron: mic, rollLength: slitLen, totalRolls, tube1mtrWeight, oneRollWeight,
        };
    }).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [data.slittingJobs]);

  const slittingRows = useMemo(() => {
    return data.slittingJobs.flatMap(job => {
        const combinedSize = job.coils.reduce((s, c) => s + parseFloat(c.size), 0);
        return job.coils.map((coil, idx) => {
            const coilWeight = (parseFloat(coil.size) * job.planMicron * PROD_DENSITY / 2 * job.planRollLength) / 1000;
            const totalCoilWeight = coilWeight * coil.rolls;
            return {
                id: `${job.id}-${idx}`, date: job.date, party: job.jobCode, srNo: job.jobNo.split('-').pop(),
                combinedSize, coilSize: coil.size, rolls: coil.rolls, totalWeight: totalCoilWeight
            };
        });
    }).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [data.slittingJobs]);

  const flatProductionRows = useMemo(() => {
    return data.dispatches.flatMap(d => {
      const party = data.parties.find(p => p.id === d.partyId)?.name || 'Unknown';
      return d.rows.map(row => ({
        dispatchId: d.id, date: d.date, party: party, size: row.size,
        sizeType: row.sizeType || "-", micron: row.micron || 0, weight: row.weight,
        productionWeight: row.productionWeight || 0, wastage: row.wastage || 0,
        pcs: row.pcs, bundle: row.bundle, status: row.status || DispatchStatus.PENDING,
        jobStatus: d.status
      }));
    }).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [data.dispatches, data.parties]);

  const flatBillingRows = useMemo(() => {
    return data.challans.flatMap(c => {
      const party = data.parties.find(p => p.id === c.partyId)?.name || 'Unknown';
      return c.lines.map((line, idx) => ({
        id: `${c.id}_${idx}`, date: c.date, challanNo: c.challanNumber, party: party,
        size: line.size, sizeType: line.sizeType || "-", micron: line.micron || 0,
        weight: line.weight, rate: line.rate, amount: line.amount, paymentMode: c.paymentMode
      }));
    }).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [data.challans, data.parties]);

  // --- ACTIONS ---
  const handleSync = async () => {
      setIsSyncing(true);
      setSyncStatus('running');
      try {
          await syncAllDataToCloud(data, (curr, total) => setSyncProgress({ current: curr, total }));
          setSyncStatus('done');
          setTimeout(() => setSyncStatus('idle'), 3000);
      } catch (e) {
          alert("Sync Failed");
          setSyncStatus('idle');
      } finally {
          setIsSyncing(false);
      }
  };

  const handleBackup = () => {
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `RDMS_Backup_${new Date().toISOString().split('T')[0]}.json`;
      link.click();
  };

  const handleRestore = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = async (event) => {
          try {
              const backup = JSON.parse(event.target?.result as string);
              if (confirm("This will overwrite existing data. Proceed?")) {
                  setIsRestoring(true);
                  await restoreFullBackup(backup, (step, curr, total) => setRestoreProgress({ step, current: curr, total }));
                  alert("Restore Complete!");
                  window.location.reload();
              }
          } catch (err) {
              alert("Invalid Backup File");
          } finally {
              setIsRestoring(false);
          }
      };
      reader.readAsText(file);
  };

  const handleSaveUrl = () => {
      setGoogleSheetUrl(sheetUrl);
      setIsSetupOpen(false);
      alert("Settings Saved Locally");
  };

  const filteredProduction = flatProductionRows.filter(r => 
    r.party.toLowerCase().includes(searchTerm.toLowerCase()) || r.size.toLowerCase().includes(searchTerm.toLowerCase())
  );
  const filteredBilling = flatBillingRows.filter(r => 
    r.party.toLowerCase().includes(searchTerm.toLowerCase()) || r.challanNo.includes(searchTerm)
  );
  const filteredPlant = plantRows.filter(r => r.party.toLowerCase().includes(searchTerm.toLowerCase()));
  const filteredSlitting = slittingRows.filter(r => r.party.toLowerCase().includes(searchTerm.toLowerCase()) || r.coilSize.includes(searchTerm));

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-20">
      
      {/* 1. CLOUD CONTROL HUB */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-xl overflow-hidden">
          <div className="bg-slate-900 p-6 flex flex-col md:flex-row justify-between items-center gap-6">
              <div className="flex items-center gap-4">
                  <div className={`p-4 rounded-2xl ${isSyncing ? 'bg-indigo-500 animate-pulse' : 'bg-slate-800'} text-white shadow-lg`}>
                      <Cloud size={32} />
                  </div>
                  <div>
                      <h2 className="text-xl font-bold text-white tracking-tight">Cloud & Maintenance Hub</h2>
                      <p className="text-slate-400 text-xs font-bold uppercase tracking-widest mt-1 flex items-center gap-2">
                        <span className="w-2 h-2 bg-emerald-500 rounded-full"></span> Systems Online
                      </p>
                  </div>
              </div>

              <div className="flex flex-wrap justify-center gap-3">
                  <button 
                    onClick={handleSync} 
                    disabled={isSyncing}
                    className="bg-white hover:bg-indigo-50 text-slate-900 px-6 py-3 rounded-xl text-sm font-bold flex items-center gap-2 shadow-lg transition-all active:scale-95 disabled:opacity-50"
                  >
                    {isSyncing ? <RefreshCw className="animate-spin" size={18}/> : <RefreshCw size={18}/>}
                    Live Sync to Sheet
                  </button>

                  <button 
                    onClick={handleBackup}
                    className="bg-slate-800 hover:bg-slate-700 text-white px-6 py-3 rounded-xl text-sm font-bold flex items-center gap-2 shadow-lg transition-all active:scale-95"
                  >
                    <Download size={18}/> Export Backup
                  </button>

                  <button 
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isRestoring}
                    className="bg-slate-800 hover:bg-slate-700 text-white px-6 py-3 rounded-xl text-sm font-bold flex items-center gap-2 shadow-lg transition-all active:scale-95"
                  >
                    <UploadCloud size={18}/> Restore Data
                  </button>
                  <input type="file" ref={fileInputRef} onChange={handleRestore} className="hidden" accept=".json" />

                  <button 
                    onClick={() => setIsSetupOpen(true)}
                    className="p-3 bg-slate-800 text-slate-400 hover:text-white rounded-xl transition-colors border border-slate-700"
                  >
                    <Settings size={20}/>
                  </button>
              </div>
          </div>

          {/* PROGRESS BARS */}
          {(isSyncing || isRestoring) && (
              <div className="bg-indigo-50 px-6 py-4 border-b border-indigo-100 flex items-center gap-6 animate-in slide-in-from-top">
                  <div className="flex-1">
                      <div className="flex justify-between text-[10px] font-black text-indigo-600 uppercase mb-1.5">
                          <span>{isRestoring ? `Restoring: ${restoreProgress.step}` : 'Syncing All Modules...'}</span>
                          <span>{isRestoring ? restoreProgress.current : syncProgress.current} / {isRestoring ? restoreProgress.total : syncProgress.total}</span>
                      </div>
                      <div className="w-full bg-indigo-200 h-2 rounded-full overflow-hidden">
                          <div 
                            className="bg-indigo-600 h-full transition-all duration-300" 
                            style={{ width: `${((isRestoring ? restoreProgress.current : syncProgress.current) / (isRestoring ? restoreProgress.total : syncProgress.total)) * 100}%` }}
                          ></div>
                      </div>
                  </div>
                  <div className="text-xs font-bold text-indigo-400 animate-pulse">DO NOT CLOSE APP</div>
              </div>
          )}

          {/* SETUP MODAL */}
          {isSetupOpen && (
              <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
                  <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in duration-200">
                      <div className="bg-slate-50 px-6 py-4 border-b border-slate-100 flex justify-between items-center">
                          <h3 className="font-bold text-slate-800">Connection Settings</h3>
                          <button onClick={() => setIsSetupOpen(false)} className="text-slate-400 hover:text-slate-600"><X size={20}/></button>
                      </div>
                      <div className="p-6 space-y-4">
                          <div className="space-y-1.5">
                              <label className="text-xs font-bold text-slate-500 uppercase">Google Apps Script Web URL</label>
                              <input 
                                value={sheetUrl} 
                                onChange={e => setSheetUrl(e.target.value)}
                                className="w-full border border-slate-200 rounded-xl px-4 py-3 text-xs font-mono bg-slate-50 focus:bg-white focus:border-indigo-500 outline-none transition-all" 
                                placeholder="https://script.google.com/macros/s/.../exec"
                              />
                              <p className="text-[10px] text-slate-400 font-medium">Paste the URL from Google Apps Script deployment here to enable live sheet sync.</p>
                          </div>
                          <div className="pt-2 flex gap-3">
                              <button onClick={handleSaveUrl} className="flex-1 bg-slate-900 text-white font-bold py-3 rounded-xl shadow-lg hover:bg-black transition-colors">Save URL</button>
                              <button onClick={() => triggerDashboardSetup()} className="flex-1 bg-white border border-slate-200 text-indigo-600 font-bold py-3 rounded-xl hover:bg-indigo-50 transition-colors">Init Sheet Headers</button>
                          </div>
                      </div>
                  </div>
              </div>
          )}
      </div>

      {/* 2. TABBED DATA GRID */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-xl overflow-hidden min-h-[600px] flex flex-col">
          <div className="border-b border-slate-200 bg-white sticky top-0 z-20">
              <div className="flex flex-col sm:flex-row justify-between items-center px-6 py-4 gap-4">
                  <div className="flex bg-slate-100 p-1 rounded-xl w-full sm:w-auto">
                      {(['production', 'billing', 'plant', 'slitting'] as const).map(tab => (
                          <button 
                            key={tab}
                            onClick={() => setActiveSheet(tab)}
                            className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all ${activeSheet === tab ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                          >
                              {tab}
                          </button>
                      ))}
                  </div>
                  <div className="relative w-full sm:w-64">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300" size={16} />
                      <input 
                        type="text" 
                        placeholder="Live Search Records..." 
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-100 rounded-xl pl-10 pr-4 py-2 text-xs font-bold focus:bg-white focus:ring-4 focus:ring-indigo-50 outline-none transition-all"
                      />
                  </div>
              </div>
          </div>

          <div className="flex-1 overflow-auto relative bg-slate-50/50">
            {activeSheet === 'production' && (
                <table className="min-w-full text-left text-[11px] table-auto">
                    <thead className="sticky top-0 z-10 bg-slate-100/80 backdrop-blur-md font-black uppercase tracking-tighter border-b border-slate-300">
                        <tr>
                            <th className="px-4 py-3">Date</th>
                            <th className="px-4 py-3">Party</th>
                            <th className="px-4 py-3">Size</th>
                            <th className="px-4 py-3 text-right">D.Wt</th>
                            <th className="px-4 py-3 text-right text-indigo-600">P.Wt</th>
                            <th className="px-4 py-3 text-right text-red-500">Wst</th>
                            <th className="px-4 py-3 text-center">Status</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 bg-white">
                        {filteredProduction.map((r, i) => (
                            <tr key={i} className="hover:bg-slate-50 transition-colors">
                                <td className="px-4 py-2 font-mono text-slate-500">{r.date.substring(5)}</td>
                                <td className="px-4 py-2 font-black text-slate-800 truncate max-w-[150px]">{r.party}</td>
                                <td className="px-4 py-2 font-bold text-indigo-600">{r.size}</td>
                                <td className="px-4 py-2 text-right font-mono font-bold text-slate-600">{r.weight.toFixed(3)}</td>
                                <td className="px-4 py-2 text-right font-mono font-bold text-indigo-700">{r.productionWeight.toFixed(3)}</td>
                                <td className="px-4 py-2 text-right font-mono font-bold text-red-500">{r.wastage.toFixed(3)}</td>
                                <td className="px-4 py-2 text-center uppercase font-black text-[9px]">
                                    <span className={`px-2 py-0.5 rounded border ${r.status === DispatchStatus.COMPLETED ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-50 text-slate-400'}`}>
                                        {r.status}
                                    </span>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            )}

            {activeSheet === 'billing' && (
                <table className="min-w-full text-left text-[11px] table-auto">
                    <thead className="sticky top-0 z-10 bg-slate-100/80 backdrop-blur-md font-black uppercase tracking-tighter border-b border-slate-300">
                        <tr>
                            <th className="px-4 py-3">Date</th>
                            <th className="px-4 py-3">Bill #</th>
                            <th className="px-4 py-3">Party</th>
                            <th className="px-4 py-3">Item</th>
                            <th className="px-4 py-3 text-right">Amt</th>
                            <th className="px-4 py-3 text-center">Mode</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 bg-white">
                        {filteredBilling.map((r, i) => (
                            <tr key={i} className="hover:bg-slate-50 transition-colors">
                                <td className="px-4 py-2 font-mono text-slate-500">{r.date.substring(5)}</td>
                                <td className="px-4 py-2 font-mono font-bold text-indigo-600">#{r.challanNo}</td>
                                <td className="px-4 py-2 font-black text-slate-800">{r.party}</td>
                                <td className="px-4 py-2 font-medium text-slate-600">{r.size}</td>
                                <td className="px-4 py-2 text-right font-black text-slate-900">₹{Math.round(r.amount).toLocaleString()}</td>
                                <td className="px-4 py-2 text-center">
                                    <span className={`px-2 py-0.5 rounded text-[9px] font-bold ${r.paymentMode === 'UNPAID' ? 'bg-red-50 text-red-600' : 'bg-emerald-50 text-emerald-600'}`}>
                                        {r.paymentMode}
                                    </span>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            )}

            {activeSheet === 'plant' && (
                <table className="min-w-full text-left text-[11px] table-auto">
                    <thead className="sticky top-0 z-10 bg-slate-100/80 backdrop-blur-md font-black uppercase tracking-tighter border-b border-slate-300">
                        <tr><th className="px-4 py-3">Date</th><th className="px-4 py-3">SR</th><th className="px-4 py-3">Party</th><th className="px-4 py-3">Sizer</th><th className="px-4 py-3 text-right">Tube Wt</th><th className="px-4 py-3 text-right">Jumbo</th></tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 bg-white">
                        {filteredPlant.map((r, i) => (
                            <tr key={i} className="hover:bg-slate-50 transition-colors">
                                <td className="px-4 py-2 font-mono text-slate-500">{r.date}</td>
                                <td className="px-4 py-2 font-bold text-indigo-600">{r.srNo}</td>
                                <td className="px-4 py-2 font-black text-slate-800">{r.party}</td>
                                <td className="px-4 py-2 font-bold text-slate-700">{r.sizer} mm</td>
                                <td className="px-4 py-2 text-right font-mono font-medium">{r.tube1mtrWeight.toFixed(3)}</td>
                                <td className="px-4 py-2 text-right font-mono font-bold text-emerald-600">{r.oneRollWeight.toFixed(3)}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            )}

            {activeSheet === 'slitting' && (
                <table className="min-w-full text-left text-[11px] table-auto">
                    <thead className="sticky top-0 z-10 bg-slate-100/80 backdrop-blur-md font-black uppercase tracking-tighter border-b border-slate-300">
                        <tr><th className="px-4 py-3">Date</th><th className="px-4 py-3">SR</th><th className="px-4 py-3">Party</th><th className="px-4 py-3">Coil</th><th className="px-4 py-3 text-right">Rolls</th><th className="px-4 py-3 text-right">Total Wt</th></tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 bg-white">
                        {filteredSlitting.map((r, i) => (
                            <tr key={i} className="hover:bg-slate-50 transition-colors">
                                <td className="px-4 py-2 font-mono text-slate-500">{r.date}</td>
                                <td className="px-4 py-2 font-bold text-indigo-600">{r.srNo}</td>
                                <td className="px-4 py-2 font-black text-slate-800">{r.party}</td>
                                <td className="px-4 py-2 font-bold text-slate-700">{r.coilSize}</td>
                                <td className="px-4 py-2 text-right font-bold text-slate-600">{r.rolls}</td>
                                <td className="px-4 py-2 text-right font-mono font-bold text-indigo-700">{r.totalWeight.toFixed(1)} kg</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            )}

            {searchTerm && filteredProduction.length === 0 && (
                <div className="py-20 text-center text-slate-400 italic font-medium">No records matching "{searchTerm}"</div>
            )}
          </div>
      </div>
    </div>
  );
};
