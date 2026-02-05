
import React, { useState, useMemo } from 'react';
import { AppData, PlantProductionPlan, SlittingCoil, SlittingJob } from '../../types';
import { updatePlantPlan, saveSlittingJob } from '../../services/storageService';
import { 
  Factory, Search, Ruler, Scale, CircleCheck, 
  RotateCcw, FileText, X, Scissors, GitMerge, 
  CheckSquare, Square, Zap, Calculator, Settings, Edit, TriangleAlert, Lightbulb, RefreshCw
} from 'lucide-react';

interface Props {
  data: AppData;
}

const PROD_DENSITY = 0.00276;

export const PlantQueueView: React.FC<Props> = ({ data }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isMergeModalOpen, setIsMergeModalOpen] = useState(false);
  const [showJobId, setShowJobId] = useState<string | null>(null);
  
  const [mergeSizer, setMergeSizer] = useState('');
  const [mergeRollLength, setMergeRollLength] = useState('2000');
  const [useMultiUp, setUseMultiUp] = useState<boolean>(false);

  const [inlineEditField, setInlineEditField] = useState<'sizer' | 'rollLength' | null>(null);
  const [inlineEditVal, setInlineEditVal] = useState('');

  const calculateSpecs = (orders: {size: number, qty: number}[], mic: number, sizer: number, slitLen: number, multiUp: boolean) => {
      // If Multi-up is ON, we treat the smallest coil as double width for calculation
      // Find the coil with smallest length requirement to "Multi-up" it
      let processedOrders = [...orders];
      if (multiUp && orders.length >= 2) {
          // Find the one that would run for the shortest length normally
          const lengths = orders.map(o => (o.qty * 1000) / (o.size * mic * (PROD_DENSITY/2)));
          const minLenIdx = lengths.indexOf(Math.min(...lengths));
          // Double the size, same target weight (it will finish in half the length)
          processedOrders[minLenIdx] = { ...processedOrders[minLenIdx], size: processedOrders[minLenIdx].size * 2, isMulti: true } as any;
      }

      const combinedSlitSize = processedOrders.reduce((s, o) => s + o.size, 0);
      const totalCombinedQty = orders.reduce((s, o) => s + o.qty, 0); // Total weight remains same
      if (combinedSlitSize === 0 || sizer === 0 || mic === 0 || totalCombinedQty === 0) return null;

      const tube1mtrWeight = sizer * mic * PROD_DENSITY;
      const tubeRollLen = slitLen / 2;
      const jumboWeight = (tube1mtrWeight / 1000) * tubeRollLen;
      
      const coilsBreakdown = processedOrders.map((o: any) => {
          const unitRollWeight = (o.size * mic * PROD_DENSITY / 2 * slitLen) / 1000;
          const specificRolls = Math.ceil(o.targetQty || o.qty / unitRollWeight);
          const mtrsRequired = (o.qty * 1000) / (o.size * mic * (PROD_DENSITY/2));
          
          return {
              size: o.size,
              unitRollWeight,
              targetQty: o.qty,
              specificRolls,
              totalCoilWeight: o.qty,
              mtrsRequired,
              isMulti: o.isMulti || false
          };
      });

      const maxMtrs = Math.max(...coilsBreakdown.map(r => r.mtrsRequired));
      const minMtrs = Math.min(...coilsBreakdown.map(r => r.mtrsRequired));
      const needsSplitRun = (maxMtrs - minMtrs) > 50; 
      
      const productionQty = (totalCombinedQty / combinedSlitSize) * sizer;

      return { 
          combinedSlitSize, sizer, mic, slitLen,
          tube1mtrWeight, tubeRollLen, jumboWeight,
          maxRolls: Math.max(...coilsBreakdown.map(c => c.specificRolls)), 
          totalCombinedQty,
          coilsBreakdown,
          productionQty,
          maxMtrs, minMtrs, needsSplitRun, multiUp
      };
  };

  const filteredPlans = useMemo(() => {
    const s = searchTerm.toLowerCase();
    return data.plantProductionPlans.filter(p => 
      p.partyCode.toLowerCase().includes(s) || p.size.toLowerCase().includes(s)
    ).sort((a, b) => {
      if (a.status === 'PENDING' && b.status !== 'PENDING') return -1;
      if (a.status !== 'PENDING' && b.status === 'PENDING') return 1;
      return new Date(b.date).getTime() - new Date(a.date).getTime();
    });
  }, [data.plantProductionPlans, searchTerm]);

  const mergePreview = useMemo(() => {
    if (!isMergeModalOpen || selectedIds.length === 0) return null;
    const items = data.plantProductionPlans.filter(p => selectedIds.includes(p.id));
    const orderData = items.map(p => ({ size: parseFloat(p.size), qty: p.qty }));
    
    // Auto-calculate suggested sizer if not set
    const defaultSizer = useMultiUp 
        ? calculateSpecs(orderData, items[0].micron, 1, 2000, true)?.combinedSlitSize || 0
        : orderData.reduce((s, o) => s + o.size, 0);

    return calculateSpecs(
        orderData,
        items[0].micron,
        parseFloat(mergeSizer) || defaultSizer,
        parseFloat(mergeRollLength),
        useMultiUp
    );
  }, [isMergeModalOpen, selectedIds, data.plantProductionPlans, mergeSizer, mergeRollLength, useMultiUp]);

  const activeJob = useMemo(() => {
    if (!showJobId) return null;
    const job = data.slittingJobs.find(j => j.id === showJobId);
    if (!job) return null;
    
    const orderData = job.coils.map(c => ({
        size: parseFloat(c.size),
        qty: c.targetQty || 0
    }));
    const combinedSize = orderData.reduce((s, o) => s + o.size, 0);
    const sizer = job.planSizer || combinedSize;

    return {
        job,
        specs: calculateSpecs(orderData, job.planMicron, sizer, job.planRollLength, false)
    };
  }, [showJobId, data.slittingJobs]);

  const toggleSelection = (id: string) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const handleOpenMerge = () => {
    const items = data.plantProductionPlans.filter(p => selectedIds.includes(p.id));
    if (items.length < 1) return alert("Select at least 1 order");
    if (!items.every(p => p.micron === items[0].micron)) return alert("Microns must match!");
    setMergeSizer(items.reduce((s, p) => s + parseFloat(p.size), 0).toString());
    setUseMultiUp(false);
    setIsMergeModalOpen(true);
  };

  const handleConfirmMerge = async () => {
    if (!mergePreview) return;
    const items = data.plantProductionPlans.filter(p => selectedIds.includes(p.id));
    const jobNo = `MJ-${Date.now().toString().slice(-4)}`;
    const partyCodes = Array.from(new Set(items.map(p => p.partyCode))).join(' / ');
    
    const slittingCoils: SlittingCoil[] = mergePreview.coilsBreakdown.map((c, idx) => ({
        id: `c-${Date.now()}-${idx}`,
        number: idx + 1, 
        size: c.size.toString(), 
        rolls: c.specificRolls, 
        targetQty: c.targetQty,
        producedBundles: 0
    }));

    await saveSlittingJob({
        id: `mj-${Date.now()}`, 
        date: new Date().toISOString().split('T')[0],
        jobNo, jobCode: partyCodes, coils: slittingCoils,
        planMicron: items[0].micron, planQty: mergePreview.totalCombinedQty,
        planRollLength: parseFloat(mergeRollLength),
        planSizer: parseFloat(mergeSizer),
        rows: [], status: 'PENDING',
        createdAt: new Date().toISOString(), updatedAt: new Date().toISOString()
    });

    for (const p of items) await updatePlantPlan({ id: p.id, status: 'COMPLETED' });
    setIsMergeModalOpen(false);
    setSelectedIds([]);
    alert(`Master Job Card #${jobNo} Created`);
  };

  const renderCard = (specs: any, job: any, isPreview: boolean) => {
    const srNo = isPreview ? 'MJ-TEMP' : job.jobNo.split('-').pop();
    const party = isPreview ? 'Merged Order' : job.jobCode;
    const cardDate = isPreview ? new Date().toLocaleDateString() : job.date;

    return (
        <div className="bg-[#fefefe] w-full max-w-md overflow-hidden flex flex-col border-t-[8px] border-indigo-600 animate-in slide-in-from-bottom duration-500 max-h-[98vh] shadow-[0_-20px_50px_rgba(0,0,0,0.3)]">
            <div className="grid grid-cols-12 border-b-[2px] border-slate-900 text-slate-900 bg-white">
                <div className="col-span-4 border-r-[2px] border-slate-900 p-3 flex flex-col justify-center">
                    <span className="text-[10px] font-black uppercase tracking-tighter leading-none mb-1 text-slate-400">Serial No :-</span>
                    <span className="text-3xl font-black font-mono leading-none">{srNo}</span>
                </div>
                <div className="col-span-8 p-3 flex items-center justify-center">
                    <h3 className="text-4xl font-black uppercase tracking-[0.2em] italic text-indigo-700">Slitting</h3>
                </div>
            </div>

            <div className="p-4 overflow-y-auto space-y-4 custom-scrollbar bg-white">
                {/* Multi-up Toggle for Preview */}
                {isPreview && specs.needsSplitRun && (
                    <button 
                        onClick={() => {
                            setUseMultiUp(!useMultiUp);
                            // Auto-set sizer when toggling multi-up
                            setMergeSizer(''); 
                        }}
                        className={`w-full py-3 rounded-xl border-[2.5px] font-black uppercase text-[10px] tracking-widest flex items-center justify-center gap-2 transition-all ${useMultiUp ? 'bg-emerald-600 border-slate-900 text-white shadow-md' : 'bg-white border-dashed border-slate-300 text-slate-400 hover:border-indigo-500 hover:text-indigo-600'}`}
                    >
                        <RefreshCw size={14} className={useMultiUp ? 'animate-spin-slow' : ''} />
                        {useMultiUp ? 'Multi-up (Re-slit) Mode ON' : 'Enable Multi-up (Re-slit) Suggestion'}
                    </button>
                )}

                <div className="grid grid-cols-2 border-[2.5px] border-slate-900 bg-white shadow-sm">
                    <div className="border-r-[2.5px] border-slate-900 p-2.5 flex flex-col">
                        <span className="text-[9px] font-black uppercase text-slate-400 mb-1">Job No (Party Code) :-</span>
                        <span className="text-base font-black text-slate-900 uppercase truncate">{party}</span>
                    </div>
                    <div className="p-2.5 flex flex-col">
                        <span className="text-[9px] font-black uppercase text-slate-400 mb-1">Date :-</span>
                        <span className="text-base font-black text-slate-900 font-mono">{cardDate}</span>
                    </div>
                </div>

                <div className="space-y-1">
                    <div className="bg-slate-900 text-white px-3 py-1.5 text-[9px] font-black uppercase tracking-widest flex items-center gap-2">
                        <Factory size={12} /> Production (Tube) Phase
                    </div>
                    <div className="grid grid-cols-1 border-x-[2.5px] border-t-[2.5px] border-slate-900">
                        {[
                            { label: 'Sizer (Tube Size) :-', val: specs.sizer, unit: 'MM' },
                            { label: 'Microne :-', val: specs.mic, unit: 'μ' },
                            { label: 'Roll Length :-', val: specs.slitLen, unit: 'MTRS' },
                            { label: 'Production Qty :-', val: specs.productionQty.toFixed(1), unit: 'KG' },
                            { label: '1 Mtr Weight :-', val: specs.tube1mtrWeight.toFixed(3), unit: 'KG' },
                            { label: '1 Roll Weight (Jumbo) :-', val: specs.jumboWeight.toFixed(3), unit: 'KG' },
                        ].map((s, i) => (
                            <div key={i} className="p-2.5 border-b-[2.5px] border-slate-900 flex justify-between items-center bg-white">
                                <span className="text-[10px] font-black uppercase text-slate-800">{s.label}</span>
                                <span className="text-sm font-black text-slate-900 font-mono">{s.val} <span className="text-[8px] opacity-40 uppercase tracking-widest ml-1">{s.unit}</span></span>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="space-y-1">
                    <div className="bg-indigo-600 text-white px-3 py-1.5 text-[9px] font-black uppercase tracking-widest flex items-center gap-2">
                        <Scissors size={12} /> Slitting (Coil) Breakdown
                    </div>
                    <div className="border-[2.5px] border-slate-900 overflow-hidden">
                        <table className="w-full text-center border-collapse">
                            <thead className="bg-slate-100 border-b-[2px] border-slate-900 text-slate-500 text-[8px] uppercase tracking-wider font-black">
                                <tr>
                                    <th className="p-2 text-left border-r border-slate-300 w-1/4">Label</th>
                                    {specs.coilsBreakdown.map((c: any, i: number) => (
                                        <th key={i} className={`p-2 ${c.isMulti ? 'bg-emerald-50 text-emerald-700' : 'bg-indigo-50 text-slate-900'}`}>
                                            {c.isMulti ? 'Re-Slit' : `Coil ${i+1}`}
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody className="text-xs font-black text-slate-900 divide-y-[2px] divide-slate-900">
                                <tr>
                                    <td className="p-2.5 bg-slate-50 text-left uppercase text-[9px] border-r-[2px] border-slate-900">Slit Size</td>
                                    {specs.coilsBreakdown.map((c: any, i: number) => (
                                        <td key={i} className={`p-2.5 font-mono text-base ${c.isMulti ? 'text-emerald-600' : ''}`}>
                                            {c.size}
                                            {c.isMulti && <div className="text-[7px] text-emerald-500 font-bold uppercase leading-none mt-1">(2x Width)</div>}
                                        </td>
                                    ))}
                                </tr>
                                <tr>
                                    <td className="p-2.5 text-left uppercase text-[9px] border-r-[2px] border-slate-900">Total Rolls</td>
                                    {specs.coilsBreakdown.map((c: any, i: number) => (
                                        <td key={i} className="p-2.5 font-mono text-base">{c.specificRolls}</td>
                                    ))}
                                </tr>
                                <tr className="bg-emerald-50/30">
                                    <td className="p-2.5 text-left uppercase text-[9px] border-r-[2px] border-slate-900">Total Weight</td>
                                    {specs.coilsBreakdown.map((c: any, i: number) => (
                                        <td key={i} className="p-2.5 font-mono text-base text-emerald-600">{c.totalCoilWeight.toFixed(1)}</td>
                                    ))}
                                </tr>
                                <tr className="bg-blue-50/50">
                                    <td className="p-2.5 text-left uppercase text-[9px] border-r-[2px] border-slate-900">Req. Mtrs</td>
                                    {specs.coilsBreakdown.map((c: any, i: number) => (
                                        <td key={i} className="p-2.5 font-mono text-[10px] text-blue-600">{Math.round(c.mtrsRequired)}m</td>
                                    ))}
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Smart Run Suggestion - Enhanced for Re-slitting */}
                {specs.needsSplitRun && (
                    <div className="border-[2px] border-indigo-500 rounded-2xl p-4 bg-indigo-50/30 space-y-2">
                        <div className="flex items-center gap-2 text-indigo-700 font-black text-xs uppercase tracking-tight">
                            <Lightbulb size={16} /> Exact Qty Strategy
                        </div>
                        <div className="space-y-2">
                            <div className="bg-white p-2.5 rounded-lg border border-indigo-100 shadow-sm">
                                <span className="text-[8px] font-black text-slate-400 uppercase block">Phase 1: Running Combined</span>
                                <div className="flex justify-between items-center">
                                    <span className="text-[10px] font-black text-slate-800 uppercase">Stop machine at</span>
                                    <span className="text-sm font-black text-indigo-600 font-mono">{Math.round(specs.minMtrs)} Mtrs</span>
                                </div>
                                <div className="text-[7px] text-slate-400 mt-1 font-bold italic">
                                    * At this point, {specs.coilsBreakdown.find((c:any) => c.mtrsRequired === specs.minMtrs)?.size}mm order is exactly finished.
                                </div>
                            </div>
                            <div className="bg-white p-2.5 rounded-lg border border-indigo-100 shadow-sm">
                                <span className="text-[8px] font-black text-slate-400 uppercase block">Phase 2: Finish Remaining</span>
                                <div className="flex justify-between items-center">
                                    <span className="text-[10px] font-black text-slate-800 uppercase">Run longest strip for</span>
                                    <span className="text-sm font-black text-indigo-600 font-mono">{Math.round(specs.maxMtrs - specs.minMtrs)} Mtrs</span>
                                </div>
                            </div>
                        </div>
                        {useMultiUp && (
                            <div className="bg-emerald-100/50 p-2 rounded-lg border border-emerald-200">
                                <p className="text-[9px] font-black text-emerald-800 leading-tight uppercase tracking-tighter">
                                    <Scissors size={10} className="inline mr-1" /> Re-slitting guide:
                                </p>
                                <p className="text-[8px] font-bold text-emerald-600 mt-0.5">
                                    Produce the {specs.coilsBreakdown.find((c:any)=>c.isMulti)?.size}mm strip as a single wide roll. Later re-slit it into two equal 250mm coils.
                                </p>
                            </div>
                        )}
                    </div>
                )}

                {isPreview && (
                    <div className="bg-indigo-50 border-[2.5px] border-slate-900 rounded-2xl p-4 space-y-4 shadow-sm">
                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1">
                                <label className="text-[8px] font-black text-slate-500 uppercase">Final Sizer</label>
                                <input type="number" value={mergeSizer} onChange={e => setMergeSizer(e.target.value)} className="w-full bg-white border border-slate-300 rounded px-2 py-1.5 text-xs font-bold outline-none focus:border-indigo-600" />
                            </div>
                            <div className="space-y-1">
                                <label className="text-[8px] font-black text-slate-500 uppercase">Roll Length</label>
                                <input type="number" value={mergeRollLength} onChange={e => setMergeRollLength(e.target.value)} className="w-full bg-white border border-slate-300 rounded px-2 py-1.5 text-xs font-bold outline-none focus:border-indigo-600" />
                            </div>
                        </div>
                    </div>
                )}
            </div>

            <div className="mt-auto p-4 bg-white border-t-[2.5px] border-slate-900">
                <button 
                    onClick={() => isPreview ? handleConfirmMerge() : setShowJobId(null)} 
                    className="w-full bg-indigo-600 text-white font-black py-6 uppercase text-sm tracking-[0.4em] active:bg-indigo-700 shadow-xl rounded-xl transition-all"
                >
                    {isPreview ? 'Generate Master Card' : 'Confirm & Close'}
                </button>
            </div>
            
            <button onClick={() => { setShowJobId(null); setIsMergeModalOpen(false); }} className="absolute top-4 right-4 text-slate-400 hover:text-red-500 transition-colors bg-white/80 rounded-full p-1 shadow-sm"><X size={24}/></button>
        </div>
    );
  };

  return (
    <div className="max-w-md mx-auto space-y-2 pb-24 px-2 select-none font-sans">
        <div className="bg-white border border-slate-200 rounded-2xl p-3 sticky top-0 z-40 shadow-sm flex flex-col gap-2">
            <div className="flex justify-between items-center">
                <div className="flex items-center gap-2">
                    <div className="w-8 h-8 bg-indigo-600 text-white rounded-lg flex items-center justify-center shadow-lg"><Factory size={16}/></div>
                    <h2 className="text-[11px] font-black uppercase tracking-widest text-slate-800">Industrial Board</h2>
                </div>
                {selectedIds.length > 0 && (
                    <button onClick={handleOpenMerge} className="bg-indigo-600 text-white text-[10px] font-bold px-3 py-1.5 rounded-lg flex items-center gap-1 shadow-lg animate-in zoom-in active:translate-y-0.5">
                        <FileText size={12}/> {selectedIds.length > 1 ? 'Merge Items' : 'Create Job'} ({selectedIds.length})
                    </button>
                )}
            </div>
            <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" size={12} />
                <input 
                    type="text" placeholder="Filter jobs..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg pl-8 pr-3 py-2 text-[10px] font-bold outline-none focus:ring-2 focus:ring-indigo-100" 
                />
            </div>
        </div>

        <div className="space-y-1.5">
            {filteredPlans.map((p, idx) => {
                const isSelected = selectedIds.includes(p.id);
                const isDone = p.status === 'COMPLETED';
                const mJob = data.slittingJobs.find(j => j.jobCode.includes(p.partyCode) && j.coils.some(c => c.size === p.size));

                return (
                    <div key={p.id} className={`bg-white border rounded-xl overflow-hidden transition-all relative ${isSelected ? 'border-indigo-400 ring-2 ring-indigo-50' : 'border-slate-200'} ${isDone ? 'opacity-40 grayscale bg-slate-50' : ''}`}>
                        <div className="flex items-center p-3 gap-3">
                            <button onClick={() => !isDone && toggleSelection(p.id)} className={`flex-shrink-0 ${isSelected ? 'text-indigo-600' : 'text-slate-300'}`}>
                                {isSelected ? <CheckSquare size={20} /> : <Square size={20} />}
                            </button>
                            <div className="flex-1 min-w-0" onClick={() => !isDone && toggleSelection(p.id)}>
                                <div className="flex justify-between items-center mb-1">
                                    <span className="text-[8px] font-black text-slate-400 font-mono tracking-tighter">#{idx+1} • {p.date.split('-').reverse().slice(0,2).join('/')}</span>
                                    {mJob && (
                                        <button onClick={(e) => { e.stopPropagation(); setShowJobId(mJob.id); }} className="text-[8px] font-black text-indigo-700 bg-indigo-50 px-1.5 py-0.5 rounded border border-indigo-100 flex items-center gap-1">
                                            <FileText size={8}/> Digital Card #{mJob.jobNo}
                                        </button>
                                    )}
                                </div>
                                <div className="text-[11px] font-black text-slate-800 uppercase truncate mb-1">{p.partyCode}</div>
                                <div className="flex gap-3">
                                    <span className="text-[9px] font-bold text-slate-500 flex items-center gap-1"><Ruler size={10}/>{p.size} MM</span>
                                    <span className="text-[9px] font-black text-emerald-600 flex items-center gap-1"><Scale size={10}/>{p.qty.toFixed(1)}kg</span>
                                </div>
                            </div>
                            <button onClick={() => updatePlantPlan({ id: p.id, status: isDone ? 'PENDING' : 'COMPLETED' })} className={`p-2.5 rounded-xl border flex-shrink-0 active:scale-90 ${isDone ? 'bg-slate-100 text-slate-400' : 'bg-white text-emerald-500 border-emerald-100 shadow-sm'}`}>
                                {isDone ? <RotateCcw size={16}/> : <CircleCheck size={16}/>}
                            </button>
                        </div>
                    </div>
                );
            })}
        </div>

        {showJobId && activeJob && (
            <div className="fixed inset-0 z-[100] flex items-end justify-center bg-slate-900/80 backdrop-blur-sm p-0 animate-in fade-in">
                {renderCard(activeJob.specs, activeJob.job, false)}
            </div>
        )}

        {isMergeModalOpen && mergePreview && (
            <div className="fixed inset-0 z-[100] flex items-end justify-center bg-slate-900/80 backdrop-blur-sm p-0 animate-in fade-in">
                {renderCard(mergePreview, null, true)}
            </div>
        )}

        <div className="flex items-center justify-center opacity-30 text-[8px] font-black uppercase tracking-[0.5em] pt-8 select-none">RDMS Industrial clipboard • v2.5</div>
    </div>
  );
};
