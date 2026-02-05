import React, { useState, useEffect } from 'react';
import { AppData, ChemicalLog, ChemicalPlant, ChemicalStock } from '../../types';
import { saveChemicalLog, updateChemicalStock } from '../../services/storageService';

interface Props {
  data: AppData;
  onUpdate: (newData: AppData) => void;
}

// --- UTILITY: Toast Notification Component ---
const Toast = ({ message, type, onClose }: { message: string, type: 'success'|'error'|'warning', onClose: () => void }) => {
    useEffect(() => {
        const timer = setTimeout(onClose, 3000);
        return () => clearTimeout(timer);
    }, [onClose]);

    const bg = type === 'success' ? 'bg-teal-600' : type === 'error' ? 'bg-red-600' : 'bg-amber-500';
    
    return (
        <div className={`fixed top-4 right-4 z-50 ${bg} text-white px-6 py-4 rounded-lg shadow-2xl flex items-center gap-3 animate-in slide-in-from-right duration-300`}>
            <span className="text-xl">{type === 'success' ? '✅' : type === 'error' ? '⚠️' : 'ℹ️'}</span>
            <span className="font-bold text-sm tracking-wide">{message}</span>
        </div>
    );
};

export const ChemicalDashboard: React.FC<Props> = ({ data }) => {
  const [activeTab, setActiveTab] = useState<ChemicalPlant>('65mm');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  
  // Input States
  const [dop, setDop] = useState('');
  const [stabilizer, setStabilizer] = useState('');
  const [epoxy, setEpoxy] = useState('');
  const [g161, setG161] = useState('');
  const [nbs, setNbs] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [toast, setToast] = useState<{msg: string, type: 'success'|'error'|'warning'} | null>(null);

  const currentStock = data.chemicalStock || { dop: 0, stabilizer: 0, epoxy: 0, g161: 0, nbs: 0 };

  // Keyboard Shortcut: Ctrl+S to Save
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
        if ((e.ctrlKey || e.metaKey) && e.key === 's') {
            e.preventDefault();
            handleSaveLog();
        }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [dop, stabilizer, epoxy, g161, nbs, activeTab, date]);

  const handleSaveLog = async () => {
      if (isSaving) return;
      setIsSaving(true);

      const d = parseFloat(dop) || 0;
      const s = parseFloat(stabilizer) || 0;
      const e = parseFloat(epoxy) || 0;
      const n = parseFloat(nbs) || 0;
      const g = activeTab === '45mm' ? 0 : (parseFloat(g161) || 0);

      if (d===0 && s===0 && e===0 && n===0 && g===0) {
          setToast({ msg: "Please enter at least one value", type: 'warning' });
          setIsSaving(false);
          return;
      }

      // Validation: Check Negative Stock
      if (currentStock.dop < d || currentStock.stabilizer < s || currentStock.epoxy < e || currentStock.nbs < n || currentStock.g161 < g) {
          if(!confirm("Warning: This entry will result in negative stock. Continue?")) {
              setIsSaving(false);
              return;
          }
      }

      const log: ChemicalLog = {
          id: `chem-${Date.now()}`,
          date,
          plant: activeTab as ChemicalPlant,
          dop: d, stabilizer: s, epoxy: e, nbs: n, g161: g,
          createdAt: new Date().toISOString()
      };

      const newStock = { ...currentStock };
      newStock.dop -= log.dop;
      newStock.stabilizer -= log.stabilizer;
      newStock.epoxy -= log.epoxy;
      newStock.nbs -= log.nbs;
      if (log.g161) newStock.g161 -= log.g161;

      await saveChemicalLog(log);
      await updateChemicalStock(newStock);

      setDop(''); setStabilizer(''); setEpoxy(''); setG161(''); setNbs('');
      setToast({ msg: "Entry Logged Successfully", type: 'success' });
      setIsSaving(false);
  };

  const StockGauge = ({ name, value, max = 500 }: { name: string, value: number, max?: number }) => {
      const percent = Math.min((value / max) * 100, 100);
      let colorClass = 'bg-teal-500';
      if (value < 100) colorClass = 'bg-red-500';
      else if (value < 200) colorClass = 'bg-amber-500';

      return (
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 relative overflow-hidden">
              <div className="flex justify-between items-end mb-1 relative z-10">
                  <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">{name}</span>
                  <span className={`font-mono font-bold text-sm ${value < 100 ? 'text-red-600' : 'text-slate-800'}`}>
                      {value.toFixed(1)} <span className="text-[10px] text-slate-400">kg</span>
                  </span>
              </div>
              <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden">
                  <div className={`h-full ${colorClass} transition-all duration-1000 ease-out`} style={{ width: `${percent}%` }}></div>
              </div>
          </div>
      );
  };

  return (
    <div className="max-w-7xl mx-auto p-4 md:p-6 space-y-6 font-sans text-slate-900">
        
        {toast && <Toast message={toast.msg} type={toast.type} onClose={() => setToast(null)} />}

        {/* HEADER */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 pb-4">
            <div className="flex items-center gap-3">
                <div className="bg-slate-800 text-teal-400 p-3 rounded-lg shadow-lg">
                    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" /></svg>
                </div>
                <div>
                    <h1 className="text-2xl font-bold text-slate-900 tracking-tight uppercase">Chemical Division</h1>
                    <p className="text-xs font-semibold text-slate-500 flex items-center gap-2">
                        <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
                        Operational
                    </p>
                </div>
            </div>
            
            <div className="flex items-center gap-2 bg-white border border-slate-200 p-1 rounded-lg shadow-sm">
                {(['65mm', 'Jumbo', '45mm'] as const).map(plant => (
                    <button
                        key={plant}
                        onClick={() => setActiveTab(plant)}
                        className={`px-4 py-2 rounded-md text-xs font-bold uppercase tracking-wide transition-all ${
                            activeTab === plant 
                            ? 'bg-teal-600 text-white shadow-md transform scale-105' 
                            : 'text-slate-500 hover:bg-slate-50'
                        }`}
                    >
                        {plant}
                    </button>
                ))}
            </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* DATA ENTRY FORM */}
            <div className="lg:col-span-2">
                <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                    <div className="bg-slate-50 px-6 py-4 border-b border-slate-200 flex justify-between items-center">
                        <h2 className="font-bold text-slate-700 flex items-center gap-2">
                            <span className="text-teal-600">⚡</span> Production Log
                        </h2>
                        <input 
                            type="date" 
                            value={date} 
                            onChange={e => setDate(e.target.value)} 
                            className="bg-white border border-slate-300 rounded px-2 py-1 text-xs font-bold text-slate-800 outline-none focus:border-teal-500"
                        />
                    </div>
                    
                    <div className="p-6">
                        <div className="grid grid-cols-2 gap-x-6 gap-y-6">
                            {[
                                { label: 'DOP', val: dop, set: setDop, unit: 'kg' },
                                { label: 'Stabilizer', val: stabilizer, set: setStabilizer, unit: 'kg' },
                                { label: 'Epoxy', val: epoxy, set: setEpoxy, unit: 'kg' },
                                { label: 'NBS', val: nbs, set: setNbs, unit: 'kg' },
                                ...(activeTab !== '45mm' ? [{ label: 'G161', val: g161, set: setG161, unit: 'kg' }] : [])
                            ].map((field) => (
                                <div key={field.label} className="group relative">
                                    <label className="absolute -top-2 left-2 bg-white px-1 text-[10px] font-bold text-teal-600 uppercase tracking-wider transition-colors group-focus-within:text-amber-500">
                                        {field.label}
                                    </label>
                                    <input 
                                        type="number" 
                                        value={field.val}
                                        onChange={e => field.set(e.target.value)}
                                        className="w-full bg-slate-50 border-2 border-slate-200 rounded-lg px-4 py-3 text-lg font-bold text-slate-900 outline-none focus:border-teal-500 focus:bg-white transition-all placeholder-slate-300"
                                        placeholder="0.00"
                                    />
                                    <span className="absolute right-4 top-4 text-xs font-bold text-slate-400 pointer-events-none">{field.unit}</span>
                                </div>
                            ))}
                        </div>

                        <button 
                            onClick={handleSaveLog} 
                            disabled={isSaving}
                            className={`mt-8 w-full py-4 rounded-lg font-bold text-white uppercase tracking-widest shadow-lg transition-all transform active:scale-[0.98] ${isSaving ? 'bg-slate-400 cursor-not-allowed' : 'bg-slate-800 hover:bg-teal-600'}`}
                        >
                            {isSaving ? 'Processing...' : 'Confirm Entry (Ctrl+S)'}
                        </button>
                    </div>
                </div>
            </div>

            {/* LIVE STOCK OVERVIEW */}
            <div className="lg:col-span-1 space-y-4">
                <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
                    <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wide mb-4 flex items-center gap-2 border-b border-slate-100 pb-2">
                        <span className="w-2 h-2 bg-amber-500 rounded-full"></span>
                        Live Inventory
                    </h3>
                    <div className="space-y-3">
                        <StockGauge name="DOP" value={currentStock.dop} />
                        <StockGauge name="Stabilizer" value={currentStock.stabilizer} />
                        <StockGauge name="Epoxy" value={currentStock.epoxy} />
                        <StockGauge name="NBS" value={currentStock.nbs} />
                        <StockGauge name="G161" value={currentStock.g161} />
                    </div>
                </div>

                {/* RECENT ACTIVITY */}
                <div className="bg-slate-800 rounded-xl shadow-lg p-5 text-white">
                    <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">Recent Logs</h3>
                    <div className="space-y-3">
                        {data.chemicalLogs.slice(0,4).map(log => (
                            <div key={log.id} className="bg-slate-700/50 rounded p-2.5 border-l-4 border-teal-500">
                                <div className="flex justify-between items-center mb-1">
                                    <span className="text-[10px] font-bold uppercase text-teal-300">{log.plant}</span>
                                    <span className="text-[10px] text-slate-400">{log.date}</span>
                                </div>
                                <div className="text-xs font-mono text-slate-200 truncate">
                                    {[
                                        log.dop > 0 && `DOP:${log.dop}`,
                                        log.stabilizer > 0 && `ST:${log.stabilizer}`,
                                        log.epoxy > 0 && `EP:${log.epoxy}`,
                                        log.nbs > 0 && `NBS:${log.nbs}`,
                                        log.g161 && log.g161 > 0 && `G:${log.g161}`
                                    ].filter(Boolean).join(' | ')}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    </div>
  );
};