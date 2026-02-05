
import React, { useState, useEffect, useMemo } from 'react';
import { AppData, PlantProductionPlan, SlittingJob, SlittingCoil } from '../../types';
import { savePlantPlan, deletePlantPlan, updatePlantPlan, saveSlittingJob } from '../../services/storageService';
import { Factory, Trash2, CircleCheck, Search, Copy, Edit2, Ruler, Scale, Calendar, Hash, ArrowRightLeft, GitMerge, X, Calculator, Info, FileText, Scissors, Plus, Minus, CheckSquare, Square, TriangleAlert, Lightbulb, RefreshCw } from 'lucide-react';

interface Props {
  data: AppData;
}

const PROD_DENSITY = 0.00276;

export const PlantPlanner: React.FC<Props> = ({ data }) => {
  const [entryMode, setEntryMode] = useState<'SINGLE' | 'MASTER'>('SINGLE');
  const [editingId, setEditingId] = useState<string | null>(null);
  
  // Common States
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [partyCode, setPartyCode] = useState('');
  const [micron, setMicron] = useState('');
  const [qty, setQty] = useState('');
  
  // Single Order States
  const [size, setSize] = useState('');
  const [meter, setMeter] = useState('');
  const [lastEdited, setLastEdited] = useState<'qty' | 'meter'>('qty');

  // Master Job States (Direct Creation)
  const [masterSizer, setMasterSizer] = useState(''); 
  const [masterRollLength, setMasterRollLength] = useState('2000'); 
  const [masterSlitCoils, setMasterSlitCoils] = useState<{size: string}[]>([{size: ''}, {size: ''}]);

  const [showPartyDropdown, setShowPartyDropdown] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isMergeModalOpen, setIsMergeModalOpen] = useState(false);
  const [mergeSizer, setMergeSizer] = useState(''); 
  const [mergeRollLength, setMergeRollLength] = useState('2000'); 
  const [useMultiUp, setUseMultiUp] = useState<boolean>(false);

  const partySuggestions = data.parties.filter(p => 
    p.name.toLowerCase().includes(partyCode.toLowerCase()) || 
    (p.code && p.code.toLowerCase().includes(partyCode.toLowerCase()))
  );

  // Auto-calculation for Single Order (Label Entry)
  useEffect(() => {
    if (entryMode !== 'SINGLE') return;
    const s = parseFloat(size) || 0;
    const m = parseFloat(micron) || 0;
    const FACTOR = 0.00138;
    if (s > 0 && m > 0) {
      if (lastEdited === 'qty') {
        const q = parseFloat(qty) || 0;
        const calcMeter = q / (m * FACTOR * (s/1000)); 
        setMeter(calcMeter > 0 ? Math.round(calcMeter).toString() : '');
      } else if (lastEdited === 'meter') {
        const mtr = parseFloat(meter) || 0;
        const calcQty = (s/1000) * FACTOR * mtr * m;
        setQty(calcQty > 0 ? calcQty.toFixed(3) : '');
      }
    }
  }, [size, micron, qty, meter, lastEdited, entryMode]);

  // Master Calculation Logic (Unified for Merge and Direct)
  const calculateMasterSpecs = (orders: {size: number, qty: number}[], mic: number, sizerSize: number, slitLen: number, multiUp: boolean) => {
    let processedOrders = [...orders];
    if (multiUp && orders.length >= 2) {
        const lengths = orders.map(o => (o.qty * 1000) / (o.size * mic * (PROD_DENSITY/2)));
        const minLenIdx = lengths.indexOf(Math.min(...lengths));
        processedOrders[minLenIdx] = { ...processedOrders[minLenIdx], size: processedOrders[minLenIdx].size * 2, isMulti: true } as any;
    }

    const slittingSize = processedOrders.reduce((s, o) => s + o.size, 0);
    const totalCombinedQty = orders.reduce((s, o) => s + o.qty, 0);
    if (mic <= 0 || totalCombinedQty <= 0 || sizerSize <= 0 || slitLen <= 0 || slittingSize <= 0) return null;

    // Production Formulas (Tube)
    const tube1mtrWeight = sizerSize * mic * PROD_DENSITY;
    const tubeRollLength = slitLen / 2;
    const oneRollWeight = (tube1mtrWeight / 1000) * tubeRollLength;
    
    const productionQty = (totalCombinedQty / slittingSize) * sizerSize;

    // Slitting Formulas (Coils)
    const coilBreakdown = processedOrders.map((o: any) => {
        const coilUnitRollWeight = (o.size * mic * PROD_DENSITY / 2 * slitLen) / 1000;
        const rollsNeeded = Math.ceil(o.qty / coilUnitRollWeight);
        const mtrsRequired = (o.qty * 1000) / (o.size * mic * (PROD_DENSITY/2));

        return { 
            size: o.size, 
            unitRollWeight: coilUnitRollWeight, 
            totalCoilWeight: o.qty, 
            rolls: rollsNeeded,
            mtrsRequired,
            isMulti: o.isMulti || false
        };
    });

    const maxRolls = Math.max(...coilBreakdown.map(c => c.rolls));
    const maxMtrs = Math.max(...coilBreakdown.map(r => r.mtrsRequired));
    const minMtrs = Math.min(...coilBreakdown.map(r => r.mtrsRequired));
    const needsSplitRun = (maxMtrs - minMtrs) > 50;

    return { 
        combinedQty: totalCombinedQty, 
        tube1mtrWeight, 
        tubeRollLength, 
        oneRollWeight, 
        totalRolls: maxRolls, 
        productionQty, 
        coilBreakdown, 
        slittingSize,
        sizer: sizerSize,
        slitLen,
        mic,
        maxMtrs,
        minMtrs,
        needsSplitRun,
        multiUp
    };
  };

  const directMasterCalcs = useMemo(() => {
    if (entryMode !== 'MASTER') return null;
    const orderData = masterSlitCoils.map(c => ({ size: parseFloat(c.size) || 0, qty: (parseFloat(qty) || 0) / masterSlitCoils.length }));
    return calculateMasterSpecs(
        orderData,
        parseFloat(micron) || 0,
        parseFloat(masterSizer) || 0,
        parseFloat(masterRollLength) || 0,
        false
    );
  }, [qty, micron, masterSizer, masterRollLength, masterSlitCoils, entryMode]);

  const mergeCalcs = useMemo(() => {
    if (!isMergeModalOpen || selectedIds.length === 0) return null;
    const selectedPlans = data.plantProductionPlans.filter(p => selectedIds.includes(p.id));
    const firstMicron = selectedPlans[0].micron;
    const orderData = selectedPlans.map(p => ({ size: parseFloat(p.size) || 0, qty: p.qty }));
    
    const defaultSizer = useMultiUp 
        ? calculateMasterSpecs(orderData, firstMicron, 1, 2000, true)?.slittingSize || 0
        : orderData.reduce((s, o) => s + o.size, 0);

    return calculateMasterSpecs(
        orderData,
        firstMicron,
        parseFloat(mergeSizer) || defaultSizer,
        parseFloat(mergeRollLength) || 2000,
        useMultiUp
    );
  }, [isMergeModalOpen, selectedIds, data.plantProductionPlans, mergeSizer, mergeRollLength, useMultiUp]);

  const handleSave = async () => {
    if (entryMode === 'SINGLE') {
        if (!partyCode || !size || !qty) return alert("Fill Party, Size and Qty");
        const plan: PlantProductionPlan = {
            id: editingId || `plant-plan-${Date.now()}`,
            date, partyCode, sizer: 'LABEL', size, coils: [],
            micron: parseFloat(micron) || 0,
            qty: parseFloat(qty) || 0,
            meter: parseFloat(meter) || 0,
            status: editingId ? (data.plantProductionPlans.find(p => p.id === editingId)?.status || 'PENDING') : 'PENDING',
            createdAt: editingId ? (data.plantProductionPlans.find(p => p.id === editingId)?.createdAt || new Date().toISOString()) : new Date().toISOString()
        };
        await savePlantPlan(plan);
        alert("Order Saved!");
    } else {
        if (!partyCode || !directMasterCalcs) return alert("Complete all Master Job details");
        const jobNo = `M-${Date.now().toString().slice(-4)}`;
        const slittingCoils: SlittingCoil[] = masterSlitCoils.map((c, i) => ({
            id: `coil-${Date.now()}-${i}`,
            number: i + 1, 
            size: c.size, 
            rolls: directMasterCalcs.totalRolls, 
            targetQty: directMasterCalcs.coilBreakdown[i].totalCoilWeight,
            producedBundles: 0
        }));
        await saveSlittingJob({
            id: `slit-master-${Date.now()}`, date, jobNo, jobCode: partyCode, coils: slittingCoils,
            planMicron: parseFloat(micron), planQty: parseFloat(qty), planRollLength: parseFloat(masterRollLength),
            planSizer: parseFloat(masterSizer),
            rows: [], status: 'PENDING', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString()
        });
        alert(`Master Job Card #${jobNo} Created!`);
    }
    resetForm();
  };

  const handleConfirmMerge = async () => {
      if (!mergeCalcs) return;
      const selectedPlans = data.plantProductionPlans.filter(p => selectedIds.includes(p.id));
      const jobNo = `MJ-${Date.now().toString().slice(-4)}`;
      const partyCodes = Array.from(new Set(selectedPlans.map(p => p.partyCode))).join(' / ');
      
      const slittingCoils: SlittingCoil[] = mergeCalcs.coilBreakdown.map((c, idx) => ({
          id: `coil-${Date.now()}-${idx}`,
          number: idx + 1, 
          size: c.size.toString(), 
          rolls: c.rolls, 
          targetQty: c.totalCoilWeight,
          producedBundles: 0
      }));

      await saveSlittingJob({
          id: `slit-master-${Date.now()}`, 
          date: new Date().toISOString().split('T')[0],
          jobNo, jobCode: partyCodes, coils: slittingCoils,
          planMicron: selectedPlans[0].micron, planQty: mergeCalcs.combinedQty,
          planRollLength: parseFloat(mergeRollLength),
          planSizer: parseFloat(mergeSizer),
          rows: [], status: 'PENDING',
          createdAt: new Date().toISOString(), updatedAt: new Date().toISOString()
      });

      for (const p of selectedPlans) await updatePlantPlan({ id: p.id, status: 'COMPLETED' });
      setIsMergeModalOpen(false);
      setSelectedIds([]);
      alert(`Master Job #${jobNo} Created!`);
  };

  const handleEdit = (plan: PlantProductionPlan) => {
    setEntryMode('SINGLE');
    setEditingId(plan.id);
    setDate(plan.date);
    setPartyCode(plan.partyCode);
    setMicron(plan.micron.toString());
    setQty(plan.qty.toString());
    setSize(plan.size);
    setMeter(plan.meter?.toString() || '');
    setLastEdited('qty');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const resetForm = () => {
    setEditingId(null);
    setDate(new Date().toISOString().split('T')[0]);
    setPartyCode(''); setSize(''); setMicron(''); setQty(''); setMeter('');
    setMasterSizer(''); setMasterSlitCoils([{size: ''}, {size: ''}]);
  };

  const handleOpenMerge = () => {
    const selectedPlans = data.plantProductionPlans.filter(p => selectedIds.includes(p.id));
    if (selectedPlans.length < 1) return alert("Select at least 1 order");
    if (!selectedPlans.every(p => p.micron === selectedPlans[0].micron)) return alert("Microns must match to merge");
    const combinedSize = selectedPlans.reduce((sum, p) => sum + (parseFloat(p.size) || 0), 0);
    setMergeSizer(combinedSize.toString());
    setUseMultiUp(false);
    setIsMergeModalOpen(true);
  };

  const toggleSelection = (id: string) => setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);

  const filteredPlans = data.plantProductionPlans.filter(p => {
    const s = searchTerm.toLowerCase();
    return p.partyCode.toLowerCase().includes(s) || p.size.toLowerCase().includes(s);
  });

  const renderDigitalCard = (specs: any, party: string) => {
    return (
        <div className="bg-[#fefefe] w-full max-w-md overflow-hidden flex flex-col border-t-[8px] border-indigo-600 animate-in slide-in-from-bottom duration-500 max-h-[98vh] shadow-[0_-20px_50px_rgba(0,0,0,0.3)]">
            <div className="grid grid-cols-12 border-b-[2px] border-slate-900 text-slate-900 bg-white">
                <div className="col-span-4 border-r-[2px] border-slate-900 p-3 flex flex-col justify-center">
                    <span className="text-[10px] font-black uppercase tracking-tighter leading-none mb-1 text-slate-400">Job Serial :-</span>
                    <span className="text-3xl font-black font-mono leading-none">MJ-TEMP</span>
                </div>
                <div className="col-span-8 p-3 flex items-center justify-center">
                    <h3 className="text-4xl font-black uppercase tracking-[0.2em] italic text-indigo-700">Slitting</h3>
                </div>
            </div>

            <div className="p-4 overflow-y-auto space-y-4 custom-scrollbar bg-white">
                {specs.needsSplitRun && (
                    <button 
                        onClick={() => {
                            setUseMultiUp(!useMultiUp);
                            setMergeSizer(''); 
                        }}
                        className={`w-full py-3 rounded-xl border-[2.5px] font-black uppercase text-[10px] tracking-widest flex items-center justify-center gap-2 transition-all ${useMultiUp ? 'bg-emerald-600 border-slate-900 text-white shadow-md' : 'bg-white border-dashed border-slate-300 text-slate-400 hover:border-indigo-500 hover:text-indigo-600'}`}
                    >
                        <RefreshCw size={14} className={useMultiUp ? 'animate-spin-slow' : ''} />
                        {useMultiUp ? 'Multi-up (Re-slit) Mode ON' : 'Suggest Multi-up (Re-slit)'}
                    </button>
                )}

                <div className="grid grid-cols-2 border-[2.5px] border-slate-900 bg-white shadow-sm">
                    <div className="border-r-[2.5px] border-slate-900 p-2.5 flex flex-col">
                        <span className="text-[9px] font-black uppercase text-slate-400 mb-1">Job (Party Code) :-</span>
                        <span className="text-base font-black text-slate-900 uppercase truncate">{party}</span>
                    </div>
                    <div className="p-2.5 flex flex-col">
                        <span className="text-[9px] font-black uppercase text-slate-400 mb-1">Date :-</span>
                        <span className="text-base font-black text-slate-900 font-mono">{new Date().toLocaleDateString()}</span>
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
                            { label: 'Total Rolls (Master) :-', val: specs.totalRolls, unit: 'PCS' },
                            { label: 'Production Qty :-', val: specs.productionQty.toFixed(1), unit: 'KG' },
                            { label: '1 Mtr Weight :-', val: specs.tube1mtrWeight.toFixed(3), unit: 'KG' },
                            { label: '1 Roll Weight (Jumbo) :-', val: specs.oneRollWeight.toFixed(3), unit: 'KG' },
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
                                    {specs.coilBreakdown.map((c: any, i: number) => (
                                        <th key={i} className={`p-2 ${c.isMulti ? 'bg-emerald-50 text-emerald-700' : 'bg-indigo-50 text-slate-900'}`}>
                                            {c.isMulti ? 'Re-Slit Strip' : `Coil ${i+1}`}
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody className="text-xs font-black text-slate-900 divide-y-[2px] divide-slate-900">
                                <tr>
                                    <td className="p-2.5 bg-slate-50 text-left uppercase text-[9px] border-r-[2px] border-slate-900">Coil Size</td>
                                    {specs.coilBreakdown.map((c: any, i: number) => (
                                        <td key={i} className={`p-2.5 font-mono text-base ${c.isMulti ? 'text-emerald-600' : ''}`}>
                                            {c.size}
                                            {c.isMulti && <div className="text-[7px] text-emerald-500 font-bold uppercase leading-none mt-1">(2x Width)</div>}
                                        </td>
                                    ))}
                                </tr>
                                <tr>
                                    <td className="p-2.5 text-left uppercase text-[9px] border-r-[2px] border-slate-900">Total Rolls</td>
                                    {specs.coilBreakdown.map((c: any, i: number) => (
                                        <td key={i} className="p-2.5 font-mono text-base">{c.rolls}</td>
                                    ))}
                                </tr>
                                <tr className="bg-emerald-50/30">
                                    <td className="p-2.5 text-left uppercase text-[9px] border-r-[2px] border-slate-900">Total Weight</td>
                                    {specs.coilBreakdown.map((c: any, i: number) => (
                                        <td key={i} className="p-2.5 font-mono text-base text-emerald-600">{c.totalCoilWeight.toFixed(1)}</td>
                                    ))}
                                </tr>
                                <tr className="bg-slate-50">
                                    <td className="p-2.5 text-left uppercase text-[9px] border-r-[2px] border-slate-900">1 Roll Wt</td>
                                    {specs.coilBreakdown.map((c: any, i: number) => (
                                        <td key={i} className="p-2.5 font-mono text-sm italic text-indigo-600">{c.unitRollWeight.toFixed(3)}</td>
                                    ))}
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </div>

                {specs.needsSplitRun && (
                    <div className="border-[2px] border-indigo-500 rounded-2xl p-4 bg-indigo-50/30 space-y-2">
                        <div className="flex items-center gap-2 text-indigo-700 font-black text-xs uppercase tracking-tight">
                            <Lightbulb size={16} /> Run Strategy Suggestion
                        </div>
                        <div className="space-y-2">
                            <div className="bg-white p-2.5 rounded-lg border border-indigo-100 shadow-sm flex justify-between items-center">
                                <span className="text-[10px] font-black text-slate-800 uppercase">1. Combined Run:</span>
                                <span className="text-sm font-black text-indigo-600 font-mono">{Math.round(specs.minMtrs)} m</span>
                            </div>
                            <div className="bg-white p-2.5 rounded-lg border border-indigo-100 shadow-sm flex justify-between items-center">
                                <span className="text-[10px] font-black text-slate-800 uppercase">2. Single Finish:</span>
                                <span className="text-sm font-black text-indigo-600 font-mono">{Math.round(specs.maxMtrs - specs.minMtrs)} m</span>
                            </div>
                        </div>
                    </div>
                )}

                <div className="bg-indigo-50 border-[2.5px] border-slate-900 rounded-2xl p-4 space-y-4 shadow-sm">
                    <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1">
                            <label className="text-[8px] font-black text-slate-500 uppercase">Edit Sizer</label>
                            <input type="number" value={mergeSizer} onChange={e => setMergeSizer(e.target.value)} className="w-full bg-white border border-slate-300 rounded px-2 py-1.5 text-xs font-bold outline-none focus:border-indigo-600" />
                        </div>
                        <div className="space-y-1">
                            <label className="text-[8px] font-black text-slate-500 uppercase">Edit Roll Len</label>
                            <input type="number" value={mergeRollLength} onChange={e => setMergeRollLength(e.target.value)} className="w-full bg-white border border-slate-300 rounded px-2 py-1.5 text-xs font-bold outline-none focus:border-indigo-600" />
                        </div>
                    </div>
                </div>
            </div>

            <div className="mt-auto p-4 bg-white border-t-[2.5px] border-slate-900">
                <button 
                    onClick={handleConfirmMerge} 
                    className="w-full bg-indigo-600 text-white font-black py-6 uppercase text-sm tracking-[0.4em] active:bg-indigo-700 shadow-xl rounded-xl transition-all"
                >
                    Confirm & Generate Master Job Card
                </button>
            </div>
            
            <button onClick={() => setIsMergeModalOpen(false)} className="absolute top-4 right-4 text-slate-400 hover:text-red-500 transition-colors bg-white/80 rounded-full p-1 shadow-sm"><X size={24}/></button>
        </div>
    );
  };

  return (
    <div className="flex flex-col xl:flex-row gap-8 items-start max-w-7xl mx-auto pb-20">
      
      {/* MASTER PREVIEW MODAL */}
      {isMergeModalOpen && mergeCalcs && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/90 backdrop-blur-sm p-0 animate-in fade-in">
              {renderDigitalCard(mergeCalcs, data.plantProductionPlans.filter(p => selectedIds.includes(p.id)).map(p => p.partyCode).join(' / '))}
          </div>
      )}

      {/* FORM SECTION */}
      <div className="w-full xl:w-[480px] xl:sticky xl:top-24 z-30">
        <div className={`bg-white border-[2px] border-slate-900 overflow-hidden transition-all duration-300 ${editingId ? 'ring-4 ring-amber-100' : ''}`}>
          
          <div className="flex border-b-[2px] border-slate-900">
              <button onClick={() => setEntryMode('SINGLE')} className={`flex-1 py-4 text-xs font-black uppercase tracking-widest transition-colors ${entryMode === 'SINGLE' ? 'bg-slate-900 text-white' : 'bg-white text-slate-400 hover:bg-slate-50'}`}>Single Order</button>
              <button onClick={() => { setEntryMode('MASTER'); setEditingId(null); }} className={`flex-1 py-4 text-xs font-black uppercase tracking-widest border-l-[2px] border-slate-900 transition-colors ${entryMode === 'MASTER' ? 'bg-slate-900 text-white' : 'bg-white text-slate-400 hover:bg-slate-50'}`}>Master Job</button>
          </div>

          <div className="p-4 flex items-center justify-center bg-white border-b-[2px] border-slate-900 relative overflow-hidden">
             <div className="absolute top-0 left-0 w-full h-full opacity-[0.03] pointer-events-none flex items-center justify-center select-none text-7xl font-black italic">RDMS</div>
             <div className="text-2xl font-black uppercase tracking-tighter text-slate-900 text-center">{entryMode === 'MASTER' ? 'DIRECT MASTER JOB' : 'LABEL ORDER ENTRY'}</div>
          </div>

          <div className="grid grid-cols-2 border-b-[2px] border-slate-900 bg-slate-50">
            <div className="border-r-[1.5px] border-slate-900 p-3 flex flex-col">
              <label className="text-[8px] font-black uppercase text-slate-400 leading-none mb-1 flex items-center gap-1"><Calendar size={10} /> Date</label>
              <input type="date" value={date} onChange={e => setDate(e.target.value)} className="bg-transparent text-sm font-black font-mono leading-none w-full outline-none focus:text-indigo-600" />
            </div>
            <div className="p-3 flex flex-col relative">
              <label className="text-[8px] font-black uppercase text-slate-400 leading-none mb-1 flex items-center gap-1"><Hash size={10} /> Party</label>
              <input type="text" value={partyCode} onChange={e => { setPartyCode(e.target.value); setShowPartyDropdown(true); }} onFocus={() => setShowPartyDropdown(true)} onBlur={() => setTimeout(() => setShowPartyDropdown(false), 200)} placeholder="Code/Name..." className="bg-transparent text-sm font-black font-mono truncate w-full uppercase leading-none outline-none focus:text-indigo-600" />
              {showPartyDropdown && partyCode && (
                <div className="absolute z-50 left-0 right-0 top-full mt-0 bg-white border-[2px] border-slate-900 shadow-xl max-h-32 overflow-y-auto p-1">
                  {partySuggestions.map(p => (
                    <div key={p.id} className="px-2 py-1 hover:bg-slate-100 cursor-pointer text-[9px] font-bold border-b border-slate-100 last:border-0" onClick={() => { setPartyCode(p.code || p.name); setShowPartyDropdown(false); }}>
                      {p.name} <span className="text-[7px] text-slate-400">[{p.code}]</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="flex flex-col">
            {entryMode === 'SINGLE' ? (
                <div className="grid grid-cols-2 border-b-[1.5px] border-slate-900 bg-white">
                    <div className="p-3 border-r-[1.5px] border-slate-900 text-[9px] font-black uppercase flex items-center gap-1 justify-center"><Ruler size={12} className="text-indigo-500" /> Size :-</div>
                    <div className="p-3 flex items-center justify-center gap-1">
                        <input type="number" value={size} onChange={e => setSize(e.target.value)} placeholder="000" className="w-24 text-2xl font-black font-mono text-center outline-none focus:text-indigo-600 leading-none bg-transparent" />
                        <span className="text-[10px] text-slate-400 font-normal">MM</span>
                    </div>
                </div>
            ) : (
                <>
                    <div className="grid grid-cols-2 border-b-[1.5px] border-slate-900 bg-indigo-50/30">
                        <div className="p-3 border-r-[1.5px] border-slate-900 text-[9px] font-black uppercase flex items-center gap-1 justify-center"><Ruler size={12} className="text-indigo-600" /> Tube Size :-</div>
                        <div className="p-3 flex items-center justify-center gap-1">
                            <input type="number" value={masterSizer} onChange={e => setMasterSizer(e.target.value)} placeholder="000" className="w-24 text-2xl font-black font-mono text-center outline-none focus:text-indigo-600 leading-none bg-transparent" />
                            <span className="text-[10px] text-slate-400 font-normal">MM</span>
                        </div>
                    </div>
                    <div className="p-4 border-b-[1.5px] border-slate-900 bg-white">
                        <div className="flex justify-between items-center mb-3"><span className="text-[10px] font-black uppercase text-slate-400">Slitting Breakdown</span><button onClick={() => setMasterSlitCoils([...masterSlitCoils, {size: ''}])} className="text-[9px] bg-slate-900 text-white px-3 py-1.5 rounded font-bold uppercase tracking-widest hover:bg-black transition-colors">+ Add size</button></div>
                        <div className="grid grid-cols-2 gap-3">
                            {masterSlitCoils.map((c, i) => (
                                <div key={i} className="flex items-center gap-2 border-[1.5px] border-slate-900 rounded p-2 bg-slate-50">
                                    <span className="text-[9px] font-black text-slate-400">#{i+1}</span>
                                    <input value={c.size} onChange={e => {
                                        const updated = [...masterSlitCoils];
                                        updated[i].size = e.target.value;
                                        setMasterSlitCoils(updated);
                                    }} placeholder="Size" className="flex-1 text-sm font-black font-mono outline-none text-center bg-transparent" />
                                    {masterSlitCoils.length > 2 && <button onClick={() => setMasterSlitCoils(masterSlitCoils.filter((_, idx) => idx !== i))} className="text-red-500 p-1"><Minus size={14}/></button>}
                                </div>
                            ))}
                        </div>
                    </div>
                    <div className="p-4 border-b-[1.5px] border-slate-900 bg-slate-50 text-center">
                        <label className="text-[10px] font-black text-slate-400 uppercase block mb-1">Slitting Roll Length</label>
                        <div className="flex items-center justify-center gap-2">
                            <input type="number" value={masterRollLength} onChange={e => setMasterRollLength(e.target.value)} className="w-32 text-2xl font-black font-mono text-center outline-none bg-transparent border-b-2 border-slate-300 focus:border-indigo-500" />
                            <span className="text-[10px] text-slate-400 font-bold">MTR</span>
                        </div>
                    </div>
                </>
            )}

            <div className="grid grid-cols-2 border-b-[1.5px] border-slate-900 bg-white">
              <div className="p-3 border-r-[1.5px] border-slate-900 text-[9px] font-black uppercase flex items-center gap-1 justify-center"><div className="w-5 h-5 rounded-full border border-amber-500 flex items-center justify-center text-[10px] font-bold">μ</div> Micron :-</div>
              <div className="p-3 flex items-center justify-center gap-1">
                <input type="number" value={micron} onChange={e => setMicron(e.target.value)} placeholder="00" className="w-24 text-2xl font-black font-mono text-center outline-none focus:text-amber-600 leading-none bg-transparent" />
                <span className="text-[10px] text-slate-400 font-normal italic font-serif">μm</span>
              </div>
            </div>

            <div className="grid grid-cols-2 border-b-[2px] border-slate-900 bg-slate-50">
               <div className="p-4 border-r-[1.5px] border-slate-900 flex flex-col items-center justify-center">
                  <label className="text-[8px] font-black uppercase text-slate-400 leading-none mb-1 flex items-center gap-1"><Scale size={10} className="text-emerald-500" /> Dispatch Qty</label>
                  <div className="flex items-center">
                    <input type="number" value={qty} onChange={e => { setQty(e.target.value); setLastEdited('qty'); }} className="w-full text-2xl font-black font-mono text-center outline-none bg-transparent text-emerald-600" placeholder="0.00" />
                    <span className="text-[10px] text-slate-400 font-bold uppercase ml-1">kg</span>
                  </div>
               </div>
               <div className="p-4 flex flex-col items-center justify-center">
                  {entryMode === 'SINGLE' ? (
                      <>
                        <label className="text-[8px] font-black uppercase text-slate-400 leading-none mb-1 flex items-center gap-1"><ArrowRightLeft size={10} className="text-indigo-500" /> Meter (Est.)</label>
                        <div className="flex items-center">
                            <input type="number" value={meter} onChange={e => { setMeter(e.target.value); setLastEdited('meter'); }} className="w-full text-2xl font-black font-mono text-center outline-none bg-transparent text-indigo-600" placeholder="000" />
                            <span className="text-[10px] text-slate-400 font-bold uppercase ml-1">mtr</span>
                        </div>
                      </>
                  ) : (
                      <>
                        <label className="text-[8px] font-black uppercase text-slate-400 leading-none mb-1 flex items-center gap-1"><Info size={10} className="text-indigo-500" /> Rolls (Est.)</label>
                        <div className="text-2xl font-black font-mono text-indigo-600 leading-none">{directMasterCalcs ? Math.ceil(directMasterCalcs.totalRolls) : '-'}</div>
                      </>
                  )}
               </div>
            </div>
          </div>

          <button onClick={handleSave} className="w-full bg-slate-900 text-white font-black py-6 flex items-center justify-center gap-3 uppercase text-sm tracking-[0.2em] active:scale-[0.98] transition-all hover:bg-black border-t-[2px] border-slate-900">
            <CircleCheck size={20} /> {editingId ? 'Update Entry' : entryMode === 'MASTER' ? 'Generate Master Job Card' : 'Post Label Order'}
          </button>
        </div>
      </div>

      {/* QUEUE SECTION */}
      <div className="flex-1 space-y-4 w-full">
          <div className="flex flex-col sm:flex-row justify-between items-center bg-white p-4 rounded-2xl shadow-sm border border-slate-200 gap-3">
              <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-slate-900 text-white rounded-xl flex items-center justify-center"><Factory size={24} /></div>
                  <div><h3 className="text-lg font-bold text-slate-800 leading-none">Order Queue</h3><div className="flex items-center gap-2 mt-1"><p className="text-[10px] text-slate-500 font-black uppercase tracking-widest">Live Feed</p>{selectedIds.length > 0 && <span className="bg-indigo-600 text-white text-[9px] px-2 py-0.5 rounded-full font-bold animate-in zoom-in">{selectedIds.length} Selected</span>}</div></div>
              </div>
              <div className="flex gap-2 w-full sm:w-auto">
                  {selectedIds.length >= 1 && <button onClick={handleOpenMerge} className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest flex items-center gap-2 shadow-lg transition-all animate-in fade-in slide-in-from-right-2"><FileText size={16} /> Create Master Job</button>}
                  <div className="relative flex-1 sm:w-64"><Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} /><input type="text" placeholder="Search..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-4 py-2 text-xs font-bold outline-none focus:ring-4 focus:ring-slate-100 shadow-inner" /></div>
              </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 shadow-xl overflow-hidden min-h-[500px]">
              <div className="overflow-x-auto custom-scrollbar h-[600px]">
                  <table className="w-full text-left border-collapse min-w-[800px]">
                      <thead className="sticky top-0 z-20 bg-slate-900 text-white text-[10px] uppercase tracking-wider font-black">
                          <tr>
                              <th className="px-4 py-4 w-10 text-center"><input type="checkbox" className="rounded border-slate-300" onChange={e => setSelectedIds(e.target.checked ? filteredPlans.map(p => p.id) : [])} checked={selectedIds.length === filteredPlans.length && filteredPlans.length > 0} /></th>
                              <th className="px-4 py-4">Date</th>
                              <th className="px-4 py-4">Party</th>
                              <th className="px-4 py-4 text-center">Label Size</th>
                              <th className="px-4 py-4 text-center">Mic</th>
                              <th className="px-4 py-4 text-right">Target</th>
                              <th className="px-4 py-4 text-right">Meter</th>
                              <th className="px-4 py-4 text-center">Action</th>
                          </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                          {filteredPlans.map(plan => {
                              const isSelected = selectedIds.includes(plan.id);
                              return (
                                <tr key={plan.id} className={`hover:bg-indigo-50/50 transition-all ${plan.status === 'COMPLETED' ? 'opacity-50 grayscale bg-slate-50' : ''} ${isSelected ? 'bg-indigo-50' : ''}`}>
                                    <td className="px-4 py-3 text-center"><input type="checkbox" className="rounded border-slate-300 text-indigo-600" checked={isSelected} onChange={() => toggleSelection(plan.id)} /></td>
                                    <td className="px-4 py-3 whitespace-nowrap text-xs font-bold text-slate-500 font-mono">{plan.date.split('-').reverse().join('/')}</td>
                                    <td className="px-4 py-3 whitespace-nowrap text-xs font-black text-slate-800 uppercase">{plan.partyCode}</td>
                                    <td className="px-4 py-3 whitespace-nowrap text-xs font-black text-slate-700 font-mono text-center">{plan.size} MM</td>
                                    <td className="px-4 py-3 whitespace-nowrap text-xs font-bold text-slate-500 text-center">{plan.micron}</td>
                                    <td className="px-4 py-3 text-right whitespace-nowrap text-xs font-black text-emerald-600">{plan.qty.toFixed(3)} <span className="text-[9px] text-slate-400">KG</span></td>
                                    <td className="px-4 py-3 text-right whitespace-nowrap text-xs font-black text-indigo-600">{plan.meter || '-'} <span className="text-[9px] text-slate-400">M</span></td>
                                    <td className="px-4 py-3"><div className="flex justify-center gap-2"><button onClick={() => handleEdit(plan)} className="p-1.5 text-indigo-600 hover:bg-white border border-transparent hover:border-indigo-200 rounded transition-colors"><Edit2 size={12} /></button><button onClick={() => { if(confirm("Delete entry?")) deletePlantPlan(plan.id); }} className="p-1.5 text-red-500 hover:bg-white border border-transparent hover:border-red-200 rounded transition-colors"><Trash2 size={12} /></button></div></td>
                                </tr>
                              );
                          })}
                      </tbody>
                  </table>
              </div>
          </div>
      </div>
    </div>
  );
};
