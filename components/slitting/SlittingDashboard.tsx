
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { AppData, SlittingJob, SlittingProductionRow, DispatchRow, DispatchEntry, DispatchStatus } from '../../types';
import { saveSlittingJob, saveDispatch, ensurePartyExists } from '../../services/storageService';

interface Props {
  data: AppData;
  onUpdate: (newData: AppData) => void;
}

// Local interface for rows that might not be in DB yet
interface LocalRow {
    id: string; // Deterministic ID
    srNo: number;
    meter: string;
    gross: string;
    core: string;
    isSaved: boolean; // Visual indicator
}

// --- Helper: Format value for input (hides 0.000) ---
const formatInputValue = (val: number | string) => {
    if (!val) return '';
    const num = parseFloat(val.toString());
    return num === 0 ? '' : val.toString();
};

// --- Unified Row Component ---
interface UnifiedRowProps {
    id: string;
    srNo: number;
    meter: string | number;
    gross: string | number;
    core: string | number;
    net: number;
    isSaved: boolean;
    onSave: (srNo: number, gross: string, core: string) => void;
    onDelete: (id: string, srNo: number) => void;
    onInputChange?: (srNo: number, field: 'gross'|'core', value: string) => void;
}

const UnifiedRow: React.FC<UnifiedRowProps> = ({ 
    id, srNo, meter, gross, core, net, isSaved, onSave, onDelete, onInputChange 
}) => {
    // Local state for smooth typing
    const [localGross, setLocalGross] = useState(formatInputValue(gross));
    const [localCore, setLocalCore] = useState(formatInputValue(core));

    // Sync with props if they change externally (e.g. DB update or auto-fill)
    useEffect(() => {
        setLocalGross(formatInputValue(gross));
    }, [gross]);

    useEffect(() => {
        setLocalCore(formatInputValue(core));
    }, [core]);

    const handleChange = (field: 'gross' | 'core', val: string) => {
        if (field === 'gross') setLocalGross(val);
        else setLocalCore(val);
        
        // Propagate changes up for auto-calcs (like auto-core filling)
        if (onInputChange) onInputChange(srNo, field, val);
    };

    const handleBlur = () => {
        // Trigger save logic
        onSave(srNo, localGross, localCore);
    };

    return (
        <tr className={`transition-colors h-7 group ${isSaved ? 'bg-white hover:bg-slate-50' : 'bg-slate-50/50 hover:bg-blue-50'}`}>
            <td className="border border-slate-300 text-[10px] font-mono text-slate-500 font-bold text-center w-8 bg-slate-50 relative">
                {srNo}
                {isSaved && <span className="absolute top-0 right-0 w-1.5 h-1.5 bg-emerald-500 rounded-bl-full"></span>}
            </td>
            <td className="border border-slate-300 p-0 w-16 bg-slate-50">
                <div className="w-full h-full flex items-center justify-center font-mono font-bold text-slate-500 text-[10px]">
                    {meter || '-'}
                </div>
            </td>
            <td className="border border-slate-300 p-0">
                <input 
                   type="number" 
                   value={localGross} 
                   onChange={e => handleChange('gross', e.target.value)}
                   onBlur={handleBlur}
                   className="w-full h-full px-1 text-center bg-transparent outline-none font-bold text-slate-900 focus:bg-indigo-50 focus:text-indigo-900 text-[10px] transition-colors placeholder-slate-200"
                   placeholder=""
                />
            </td>
            <td className="border border-slate-300 p-0">
                <input 
                   type="number" 
                   value={localCore} 
                   onChange={e => handleChange('core', e.target.value)}
                   onBlur={handleBlur}
                   className="w-full h-full px-1 text-center bg-transparent outline-none font-bold text-slate-600 focus:bg-indigo-50 focus:text-indigo-900 text-[10px] transition-colors placeholder-slate-200"
                   placeholder=""
                />
            </td>
            <td className="border border-slate-300 bg-slate-50 text-[10px] font-bold text-emerald-700 text-center w-16 font-mono">
                {(parseFloat(localGross) > 0 && net > 0) ? net.toFixed(3) : ''}
            </td>
            <td className="border border-slate-300 bg-slate-50 text-center w-8 p-0">
                {(localGross || localCore || isSaved) && (
                    <button 
                        onClick={() => onDelete(id, srNo)}
                        className="w-full h-full flex items-center justify-center text-slate-300 hover:text-red-500 hover:bg-red-50 transition-colors"
                        title="Clear Row"
                        tabIndex={-1}
                    >
                        <span className="text-[10px] font-bold">✕</span>
                    </button>
                )}
            </td>
        </tr>
    );
};

export const SlittingDashboard: React.FC<Props> = ({ data, onUpdate }) => {
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [activeCoilId, setActiveCoilId] = useState<string>('');
  const [coilBundles, setCoilBundles] = useState<string>('');
  
  // Local Rows State (For new/unsaved entries)
  const [localRows, setLocalRows] = useState<LocalRow[]>([]);
  
  const [isSaving, setIsSaving] = useState(false);

  // --- FILTERS STATE ---
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('ALL');
  const [filterStartDate, setFilterStartDate] = useState('');
  const [filterEndDate, setFilterEndDate] = useState('');

  const selectedJob = data.slittingJobs.find(j => j.id === selectedJobId);

  // Initialize Coil Selection
  useEffect(() => {
    if (selectedJob && !activeCoilId && selectedJob.coils.length > 0) {
        setActiveCoilId(selectedJob.coils[0].id);
    }
  }, [selectedJobId, selectedJob]);

  // Init/Reset Local Rows when Coil Changes
  useEffect(() => {
      if (selectedJob && activeCoilId) {
          const coil = selectedJob.coils.find(c => c.id === activeCoilId);
          setCoilBundles(coil?.producedBundles?.toString() || '0');
          
          // Determine initial set of local rows
          // If DB has rows, find max SrNo and append 5 empty ones
          const dbRows = selectedJob.rows.filter(r => r.coilId === activeCoilId);
          const maxSr = dbRows.length > 0 ? Math.max(...dbRows.map(r => r.srNo)) : 0;
          
          generateLocalRows(maxSr, 5, true); 
      }
  }, [activeCoilId, selectedJobId]); // Only reset on explicit change

  // Helper: Generate Local Rows
  const generateLocalRows = (startAfterSr: number, count: number, reset: boolean = false) => {
      setLocalRows(prev => {
          const newRows: LocalRow[] = [];
          // Try to inherit core weight from previous local rows if available
          let defaultCore = '';
          if (!reset && prev.length > 0) {
              const last = prev[prev.length - 1];
              if (last.core) defaultCore = last.core;
          }

          for (let i = 1; i <= count; i++) {
              const sr = startAfterSr + i;
              newRows.push({
                  id: `slit-row-${activeCoilId}-${sr}`, // Deterministic ID
                  srNo: sr,
                  meter: '',
                  gross: '',
                  core: defaultCore,
                  isSaved: false
              });
          }
          return reset ? newRows : [...prev, ...newRows];
      });
  };

  // --- Merged Display Rows (DB + Local) ---
  const displayRows = useMemo(() => {
      if (!selectedJob || !activeCoilId) return [];

      const dbRows = selectedJob.rows.filter(r => r.coilId === activeCoilId);
      
      // Filter out local rows that have a corresponding DB row (to avoid dupes after save)
      // AND ensure we don't show local rows that conflict with DB rows
      const validLocalRows = localRows.filter(l => !dbRows.some(d => d.srNo === l.srNo));

      // Combine and Sort
      const combined = [
          ...dbRows.map(r => ({
              ...r,
              gross: r.grossWeight,
              core: r.coreWeight,
              net: r.netWeight,
              isSaved: true
          })),
          ...validLocalRows.map(r => {
              const g = parseFloat(r.gross) || 0;
              const c = parseFloat(r.core) || 0;
              return {
                  id: r.id,
                  coilId: activeCoilId,
                  srNo: r.srNo,
                  size: '', // Placeholder
                  meter: r.meter || 0,
                  micron: 0,
                  grossWeight: g,
                  coreWeight: c,
                  netWeight: g - c,
                  gross: r.gross,
                  core: r.core,
                  net: g - c,
                  isSaved: false
              };
          })
      ];

      return combined.sort((a, b) => a.srNo - b.srNo);
  }, [selectedJob, activeCoilId, localRows]);

  // --- Handlers ---

  const handleLocalInputChange = (srNo: number, field: 'gross'|'core', value: string) => {
      setLocalRows(prev => {
          const idx = prev.findIndex(r => r.srNo === srNo);
          if (idx === -1) return prev;

          const updated = [...prev];
          updated[idx] = { ...updated[idx], [field]: value };

          // Auto-Fill Core Logic: Update subsequent rows
          if (field === 'core') {
              for (let i = idx + 1; i < updated.length; i++) {
                  // Simply copy the core weight to subsequent rows
                  updated[i] = { ...updated[i], core: value };
              }
          }

          // Recalculate Meter for Local Row
          const row = updated[idx];
          const g = parseFloat(row.gross) || 0;
          const c = parseFloat(row.core) || 0;
          const net = Math.max(0, g - c);

          if (net > 0 && selectedJob) {
              const coil = selectedJob.coils.find(c => c.id === activeCoilId);
              const sizeVal = parseFloat(coil?.size || '0');
              const micron = selectedJob.planMicron;
              
              if (sizeVal > 0 && micron > 0) {
                  const sizeInMeters = sizeVal / 1000;
                  const calculatedMeter = net / micron / 0.00139 / sizeInMeters;
                  updated[idx].meter = (Math.round(calculatedMeter / 10) * 10).toString();
              }
          } else {
              updated[idx].meter = '';
          }

          return updated;
      });
  };

  const handleSaveRow = async (srNo: number, grossStr: string, coreStr: string) => {
      if (!selectedJob || !activeCoilId) return;

      const gross = parseFloat(grossStr) || 0;
      const core = parseFloat(coreStr);

      // Simple validation: gross needed, core needed (can be 0)
      if (gross <= 0 || isNaN(core)) return;

      // Check if data actually changed to avoid spamming DB
      const existingDbRow = selectedJob.rows.find(r => r.coilId === activeCoilId && r.srNo === srNo);
      if (existingDbRow && existingDbRow.grossWeight === gross && existingDbRow.coreWeight === core) {
          return;
      }

      setIsSaving(true);
      try {
          const selectedCoilIndex = selectedJob.coils.findIndex(c => c.id === activeCoilId);
          const selectedCoil = selectedJob.coils[selectedCoilIndex];
          const netWeight = gross - core;
          
          // Calculate Meter
          let meter = 0;
          const sizeVal = parseFloat(selectedCoil?.size || '0');
          const micron = selectedJob.planMicron;
          if (netWeight > 0 && sizeVal > 0 && micron > 0) {
              const sizeInMeters = sizeVal / 1000;
              const calculatedMeter = netWeight / micron / 0.00139 / sizeInMeters;
              meter = Math.round(calculatedMeter / 10) * 10;
          }

          const newEntry: SlittingProductionRow = {
              id: `slit-row-${activeCoilId}-${srNo}`, 
              coilId: activeCoilId,
              srNo: srNo,
              size: selectedCoil.size,
              micron: selectedJob.planMicron,
              grossWeight: gross,
              coreWeight: core,
              netWeight: netWeight,
              meter: meter
          };

          // Update DB State
          let updatedRows = [...selectedJob.rows];
          const existingIdx = updatedRows.findIndex(r => r.id === newEntry.id);
          if (existingIdx >= 0) {
              updatedRows[existingIdx] = newEntry;
          } else {
              updatedRows.push(newEntry);
          }

          const updatedJob: SlittingJob = {
              ...selectedJob,
              rows: updatedRows,
              status: 'IN_PROGRESS', 
              updatedAt: new Date().toISOString()
          };

          await saveSlittingJob(updatedJob);
          await syncWithDispatch(updatedJob, updatedRows);

      } catch (e) {
          console.error("Save Failed", e);
      } finally {
          setIsSaving(false);
      }
  };

  const handleDeleteRow = async (id: string, srNo: number) => {
      // 1. If in DB, delete from DB
      const inDb = selectedJob?.rows.some(r => r.id === id);
      if (inDb) {
          if (!selectedJob) return;
          const updatedRows = selectedJob.rows.filter(r => r.id !== id);
          const updatedJob = { ...selectedJob, rows: updatedRows, updatedAt: new Date().toISOString() };
          await saveSlittingJob(updatedJob);
          await syncWithDispatch(updatedJob, updatedRows);
      }

      // 2. Reset Local Row
      setLocalRows(prev => {
          const idx = prev.findIndex(r => r.srNo === srNo);
          if (idx !== -1) {
              const updated = [...prev];
              // Explicitly clear gross, core, and meter
              updated[idx] = { ...updated[idx], gross: '', core: '', meter: '', isSaved: false };
              return updated;
          }
          // If it wasn't in localRows (was purely DB), add empty placeholder
          return [...prev, {
              id: id,
              srNo: srNo,
              meter: '',
              gross: '',
              core: '', 
              isSaved: false
          }].sort((a, b) => a.srNo - b.srNo);
      });
  };

  const handleAddMoreRows = () => {
      // Find current max SrNo from Display Rows
      const maxSr = displayRows.length > 0 ? Math.max(...displayRows.map(r => r.srNo)) : 0;
      generateLocalRows(maxSr, 5, false); // Append 5
  };

  const handleBundleSave = async () => {
      if (!selectedJob || !activeCoilId) return;
      const selectedCoilIndex = selectedJob.coils.findIndex(c => c.id === activeCoilId);
      if (selectedCoilIndex === -1) return;

      const newBundleCount = parseInt(coilBundles) || 0;
      const selectedCoil = selectedJob.coils[selectedCoilIndex];

      if (newBundleCount === selectedCoil.producedBundles) return;

      const updatedCoils = [...selectedJob.coils];
      updatedCoils[selectedCoilIndex] = { ...selectedCoil, producedBundles: newBundleCount };

      const updatedJob = { ...selectedJob, coils: updatedCoils, updatedAt: new Date().toISOString() };
      await saveSlittingJob(updatedJob);
      await syncWithDispatch(updatedJob, selectedJob.rows);
  };

  const handleStatusChange = async (e: React.ChangeEvent<HTMLSelectElement>, job: SlittingJob) => {
      e.stopPropagation();
      const newStatus = e.target.value as 'PENDING' | 'IN_PROGRESS' | 'COMPLETED';
      const updatedJob = { ...job, status: newStatus, updatedAt: new Date().toISOString() };
      await saveSlittingJob(updatedJob);
  };

  // Sync with Dispatch (Same as before)
  const syncWithDispatch = async (job: SlittingJob, updatedRows: SlittingProductionRow[]) => {
      const existingDispatch = data.dispatches.find(d => d.dispatchNo === job.jobNo);
      const coilAggregates: Record<string, { weight: number, pcs: number }> = {};
      
      job.coils.forEach(c => { coilAggregates[c.size] = { weight: 0, pcs: 0 }; });

      updatedRows.forEach(r => {
          if (r.netWeight > 0) {
              const coil = job.coils.find(c => c.id === r.coilId);
              if (coil) {
                  coilAggregates[coil.size].weight += r.netWeight;
                  coilAggregates[coil.size].pcs += 1;
              }
          }
      });

      const dispatchRows: DispatchRow[] = job.coils.map(c => {
          const agg = coilAggregates[c.size];
          return {
              id: `slit-row-${c.id}`, 
              size: c.size,
              sizeType: 'ROLL',
              micron: job.planMicron,
              weight: parseFloat(agg.weight.toFixed(3)),
              productionWeight: 0,
              wastage: 0,
              pcs: agg.pcs, 
              bundle: c.producedBundles || 0,
              status: DispatchStatus.SLITTING,
              isCompleted: false,
              isLoaded: false
          };
      });

      let partyId = existingDispatch?.partyId;
      if (!partyId) {
          const searchKey = job.jobCode.trim().toLowerCase();
          const matchedParty = data.parties.find(p => 
              (p.code && p.code.toLowerCase() === searchKey) || 
              p.name.toLowerCase() === searchKey
          );
          partyId = matchedParty ? matchedParty.id : await ensurePartyExists(data.parties, job.jobCode);
      }

      const totalWt = parseFloat(Object.values(coilAggregates).reduce((s, a) => s + a.weight, 0).toFixed(3));
      const commonData = {
          rows: dispatchRows,
          totalWeight: totalWt,
          totalPcs: Object.values(coilAggregates).reduce((s, a) => s + a.pcs, 0),
          updatedAt: new Date().toISOString(),
          isTodayDispatch: true,
          status: DispatchStatus.SLITTING,
          partyId: partyId 
      };

      let dispatchEntry: DispatchEntry;
      if (existingDispatch) {
          dispatchEntry = { ...existingDispatch, ...commonData };
      } else {
          dispatchEntry = {
              id: `d-slit-${job.id}`,
              dispatchNo: job.jobNo,
              date: new Date().toISOString().split('T')[0],
              partyId: partyId,
              createdAt: new Date().toISOString(),
              ...commonData
          };
      }
      await saveDispatch(dispatchEntry);
  };

  const getPartyName = (job: SlittingJob) => {
      const searchKey = job.jobCode.trim();
      const searchKeyLower = searchKey.toLowerCase();
      const p = data.parties.find(p => 
          p.name.toLowerCase() === searchKeyLower || 
          (p.code && p.code.toLowerCase() === searchKeyLower)
      );
      return p ? (p.code ? `${p.name} [${p.code}]` : p.name) : job.jobCode;
  };

  // Filter Jobs
  const filteredJobs = useMemo(() => {
      return data.slittingJobs.filter(job => {
          const query = searchQuery.toLowerCase();
          const partyName = getPartyName(job).toLowerCase();
          const coilSizes = job.coils.map(c => c.size.toLowerCase()).join(' ');
          
          const matchesSearch = 
              job.jobNo.toLowerCase().includes(query) ||
              job.jobCode.toLowerCase().includes(query) ||
              partyName.includes(query) ||
              job.planMicron.toString().includes(query) ||
              coilSizes.includes(query);

          const matchesStatus = filterStatus === 'ALL' || job.status === filterStatus;
          return matchesSearch && matchesStatus;
      }).sort((a, b) => {
          const statusOrder: any = { 'IN_PROGRESS': 0, 'PENDING': 1, 'COMPLETED': 2 };
          if (statusOrder[a.status] !== statusOrder[b.status]) return statusOrder[a.status] - statusOrder[b.status];
          return new Date(b.date).getTime() - new Date(a.date).getTime();
      });
  }, [data.slittingJobs, searchQuery, filterStatus, data.parties]);

  if (selectedJob) {
      const totalProduction = selectedJob.rows.reduce((sum, r) => sum + r.netWeight, 0);

      return (
          <div className="max-w-5xl mx-auto p-2 sm:p-4 space-y-4 animate-in slide-in-from-right-4 duration-300 pb-20">
             
             {/* 1. Header & Details */}
             <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-3">
                <div className="flex justify-between items-start mb-2">
                    <div className="flex items-center gap-2">
                        <button onClick={() => setSelectedJobId(null)} className="bg-slate-100 p-1.5 rounded-lg text-slate-500 hover:text-slate-800 transition-colors">←</button>
                        <div>
                            <div className="flex items-center gap-2">
                                <h2 className="text-lg font-bold text-slate-800 leading-none">#{selectedJob.jobNo}</h2>
                                <span className="text-[10px] font-bold bg-slate-100 px-2 py-0.5 rounded text-slate-500">{selectedJob.date.split('-').reverse().join('/')}</span>
                            </div>
                            <p className="text-xs text-slate-500 font-bold truncate max-w-[200px]">{getPartyName(selectedJob)}</p>
                        </div>
                    </div>
                    
                    <div className="flex flex-col items-end gap-1.5">
                        <select 
                            value={selectedJob.status} 
                            onChange={(e) => handleStatusChange(e, selectedJob)}
                            className={`text-[10px] font-bold px-2 py-1.5 rounded border outline-none ${
                                selectedJob.status === 'IN_PROGRESS' ? 'bg-amber-100 text-amber-700 border-amber-200' :
                                selectedJob.status === 'COMPLETED' ? 'bg-emerald-100 text-emerald-700 border-emerald-200' :
                                'bg-slate-100 text-slate-600 border-slate-200'
                            }`}
                        >
                            <option value="PENDING">PENDING</option>
                            <option value="IN_PROGRESS">RUNNING</option>
                            <option value="COMPLETED">DONE</option>
                        </select>
                    </div>
                </div>
                
                {/* Specs Bar */}
                <div className="flex gap-2 text-xs bg-slate-50 p-2 rounded-lg border border-slate-100 overflow-x-auto whitespace-nowrap">
                    <div className="px-2 border-r border-slate-200">
                        <span className="text-[9px] text-slate-400 font-bold uppercase block">Micron</span>
                        <span className="font-bold text-slate-700">{selectedJob.planMicron}</span>
                    </div>
                    <div className="px-2 border-r border-slate-200">
                        <span className="text-[9px] text-slate-400 font-bold uppercase block">Length</span>
                        <span className="font-bold text-slate-700">{selectedJob.planRollLength} m</span>
                    </div>
                    <div className="px-2 border-r border-slate-200">
                        <span className="text-[9px] text-slate-400 font-bold uppercase block">Total Out</span>
                        <span className="font-bold text-emerald-600">{totalProduction.toFixed(3)} kg</span>
                    </div>
                </div>
             </div>

             {/* 2. Coil Tabs */}
             <div className="overflow-x-auto pb-1 -mx-2 px-2 sm:mx-0 sm:px-0 custom-scrollbar">
                 <div className="flex gap-2 min-w-max">
                     {selectedJob.coils.map((coil, idx) => {
                         const coilTotal = selectedJob.rows.filter(r => r.coilId === coil.id).reduce((s,r) => s + r.netWeight, 0);
                         return (
                             <button 
                                key={coil.id}
                                onClick={() => setActiveCoilId(coil.id)}
                                className={`flex flex-col items-center px-4 py-2 rounded-lg border-2 transition-all min-w-[80px] ${
                                    activeCoilId === coil.id 
                                    ? 'bg-indigo-600 border-indigo-600 text-white shadow-md transform scale-105' 
                                    : 'bg-white border-slate-200 text-slate-500 hover:border-indigo-300'
                                }`}
                             >
                                 <span className="text-[9px] font-bold uppercase opacity-80">Coil {idx+1}</span>
                                 <span className="text-sm font-bold">{coil.size}</span>
                                 <span className={`text-[9px] font-bold ${activeCoilId === coil.id ? 'text-indigo-200' : 'text-slate-400'}`}>
                                     {coilTotal.toFixed(1)} kg
                                 </span>
                             </button>
                         );
                     })}
                 </div>
             </div>

             {/* 3. Unified Excel Table */}
             <div className="bg-white rounded-lg shadow-lg shadow-slate-200/50 border border-slate-300 overflow-hidden flex flex-col">
                 <div className="bg-slate-50 px-4 py-2 border-b border-slate-300 flex flex-wrap justify-between items-center gap-3 sticky top-0 z-20">
                     <div className="flex items-center gap-2">
                         <span className="text-xs font-bold text-slate-700 uppercase tracking-wide">{selectedJob.coils.find(c => c.id === activeCoilId)?.size} LOG</span>
                         {isSaving && <span className="text-[9px] font-bold text-amber-500 animate-pulse bg-white px-2 py-0.5 rounded border border-amber-100">Saving...</span>}
                     </div>
                     <div className="flex items-center gap-2 bg-white px-2 py-1 rounded border border-slate-200 shadow-sm">
                         <span className="text-[9px] font-bold text-slate-500 uppercase">Bundles</span>
                         <input 
                            type="number" 
                            value={coilBundles}
                            onChange={(e) => setCoilBundles(e.target.value)}
                            onBlur={handleBundleSave}
                            className="w-10 font-bold text-indigo-700 outline-none border-b border-indigo-100 focus:border-indigo-500 text-center transition-colors text-xs"
                            placeholder="0"
                         />
                     </div>
                 </div>
                 
                 <div className="overflow-x-auto custom-scrollbar p-1">
                     <table className="w-full text-center text-[10px] border-collapse border border-slate-400">
                         <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-400 sticky top-0 z-10">
                             <tr>
                                 <th className="py-1 px-1 border border-slate-400 w-8 bg-slate-200">#</th>
                                 <th className="py-1 px-1 border border-slate-400 w-16 bg-slate-200">Meter</th>
                                 <th className="py-1 px-1 border border-slate-400 w-20 bg-slate-200">Gross Wt</th>
                                 <th className="py-1 px-1 border border-slate-400 w-20 bg-slate-200">Core Wt</th>
                                 <th className="py-1 px-1 border border-slate-400 w-16 text-indigo-800 bg-slate-200">Net Wt</th>
                                 <th className="py-1 px-1 border border-slate-400 w-8 bg-slate-200"></th>
                             </tr>
                         </thead>
                         <tbody className="bg-white">
                             {displayRows.map((row) => (
                                 <UnifiedRow 
                                    key={row.id}
                                    id={row.id}
                                    srNo={row.srNo}
                                    meter={row.meter}
                                    gross={row.gross || row.grossWeight}
                                    core={row.core || row.coreWeight}
                                    net={row.net || row.netWeight}
                                    isSaved={row.isSaved}
                                    onSave={handleSaveRow}
                                    onDelete={handleDeleteRow}
                                    onInputChange={handleLocalInputChange}
                                 />
                             ))}
                         </tbody>
                     </table>
                 </div>
                 
                 <div className="p-2 bg-slate-50 border-t border-slate-300 flex gap-2 sticky bottom-0 z-20">
                     <button 
                         onClick={handleAddMoreRows}
                         className="w-full bg-white border border-slate-300 text-slate-600 hover:bg-slate-100 hover:text-slate-800 font-bold py-2 rounded shadow-sm transition-all text-[10px] uppercase tracking-wide flex items-center justify-center gap-2"
                     >
                         <span>+ Add 5 Rows</span>
                     </button>
                 </div>
             </div>
          </div>
      );
  }

  // --- JOB LIST VIEW (User) ---
  return (
    <div className="max-w-7xl mx-auto p-4 space-y-6 pb-20">
       {/* Filters */}
       <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
           <div>
               <h1 className="text-2xl font-bold text-slate-800 tracking-tight">Operator Dashboard</h1>
               <p className="text-slate-500 text-xs font-bold">Select a Job Card to Start Production</p>
           </div>
           
           <div className="flex flex-wrap gap-2 w-full md:w-auto">
               <input 
                   type="text" 
                   placeholder="Search..." 
                   value={searchQuery}
                   onChange={(e) => setSearchQuery(e.target.value)}
                   className="flex-1 bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs font-bold focus:outline-none focus:ring-2 focus:ring-amber-200"
               />
               <select 
                   value={filterStatus}
                   onChange={(e) => setFilterStatus(e.target.value)}
                   className="bg-white border border-slate-200 rounded-lg px-2 py-2 text-xs font-bold focus:outline-none focus:ring-2 focus:ring-amber-200"
               >
                   <option value="ALL">All Status</option>
                   <option value="PENDING">Pending</option>
                   <option value="IN_PROGRESS">Running</option>
                   <option value="COMPLETED">Done</option>
               </select>
           </div>
       </div>

       {/* Job Cards Grid */}
       <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
           {filteredJobs.map(job => {
               const partyName = getPartyName(job);
               const producedWt = job.rows.reduce((s, r) => s + r.netWeight, 0);
               
               return (
               <div 
                   key={job.id} 
                   className={`bg-white rounded-xl border shadow-sm cursor-pointer hover:shadow-md transition-all group relative overflow-hidden ${
                       job.status === 'IN_PROGRESS' ? 'border-amber-400 ring-1 ring-amber-100' : 
                       job.status === 'COMPLETED' ? 'border-slate-200 opacity-80 bg-slate-50' : 'border-slate-200'
                   }`}
                   onClick={() => setSelectedJobId(job.id)}
               >
                   <div className={`absolute top-0 left-0 w-1.5 h-full ${
                        job.status === 'IN_PROGRESS' ? 'bg-amber-500' : 
                        job.status === 'COMPLETED' ? 'bg-emerald-500' : 'bg-slate-300'
                   }`}></div>

                   <div className="pl-5 p-4">
                       <div className="flex justify-between items-start mb-2">
                           <div>
                               <div className="flex items-center gap-2 mb-1">
                                   <h3 className="text-lg font-bold text-slate-800 leading-none">#{job.jobNo}</h3>
                                   <span className="text-[10px] font-bold text-slate-400 bg-slate-50 px-1.5 py-0.5 rounded border border-slate-100">{job.date.split('-').reverse().join('/')}</span>
                               </div>
                               <div className="text-xs font-bold text-slate-600 truncate max-w-[200px]" title={partyName}>
                                   {partyName}
                               </div>
                           </div>
                           
                           <div onClick={e => e.stopPropagation()}>
                               <span className={`text-[9px] font-bold px-1.5 py-1 rounded uppercase tracking-wide border ${
                                   job.status === 'IN_PROGRESS' ? 'bg-amber-50 text-amber-700 border-amber-200' :
                                   job.status === 'COMPLETED' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                                   'bg-slate-50 text-slate-500 border-slate-200'
                               }`}>
                                   {job.status.replace('_', ' ')}
                               </span>
                           </div>
                       </div>

                       <div className="grid grid-cols-3 gap-1 mb-3">
                           <div className="bg-slate-50 rounded p-1.5 text-center border border-slate-100">
                               <div className="text-[8px] text-slate-400 font-bold uppercase">Micron</div>
                               <div className="text-xs font-bold text-slate-700">{job.planMicron}</div>
                           </div>
                           <div className="bg-slate-50 rounded p-1.5 text-center border border-slate-100">
                               <div className="text-[8px] text-slate-400 font-bold uppercase">Length</div>
                               <div className="text-xs font-bold text-slate-700">{job.planRollLength} m</div>
                           </div>
                           <div className="bg-slate-50 rounded p-1.5 text-center border border-slate-100">
                               <div className="text-[8px] text-slate-400 font-bold uppercase">Target</div>
                               <div className="text-xs font-bold text-slate-700">{job.planQty} kg</div>
                           </div>
                       </div>
                       
                       {/* Compact Coil View for Card */}
                       <div className="space-y-1 mb-2">
                           {job.coils.map(coil => {
                               // Calculate coil totals
                               const coilRows = job.rows.filter(r => r.coilId === coil.id);
                               const coilNet = coilRows.reduce((sum, r) => sum + r.netWeight, 0);
                               const coilMeter = coilRows.reduce((sum, r) => sum + r.meter, 0);
                               return (
                                   <div key={coil.id} className="flex justify-between items-center bg-slate-50 border border-slate-100 rounded px-2 py-1 text-[10px]">
                                       <span className="font-bold text-slate-700">{coil.size}</span>
                                       <div className="flex gap-2">
                                            <span className="text-blue-500 font-bold">{coilMeter} m</span>
                                            <span className="text-emerald-600 font-bold">{coilNet.toFixed(1)} kg</span>
                                       </div>
                                   </div>
                               );
                           })}
                       </div>
                   </div>
               </div>
           )})}
       </div>
    </div>
  );
};
