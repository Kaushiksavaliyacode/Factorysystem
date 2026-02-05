
import React, { useState, useEffect } from 'react';
import { AppData, ProductionPlan, PlantProductionPlan } from '../../types';
import { saveProductionPlan, deleteProductionPlan, updateProductionPlan, saveDispatch, savePlantPlan, deletePlantPlan, updatePlantPlan } from '../../services/storageService';
import { SlittingManager } from './SlittingManager';
import { PlantPlanner } from './PlantPlanner';
import { Calendar, User, Ruler, Scale, Layers, CheckCircle, Clock, Trash2, Edit2, FileText, ChevronRight, Box, Printer, ArrowRightLeft, Scissors, Copy, Factory } from 'lucide-react';

interface Props {
  data: AppData;
  isUserView?: boolean;
}

const PLAN_TYPES = ["Printing", "Roll", "Winder", "St. Seal", "Round", "Open", "Intas"];

export const ProductionPlanner: React.FC<Props> = ({ data, isUserView = false }) => {
  const [activeMode, setActiveMode] = useState<'printing' | 'slitting' | 'plant'>('printing');

  // Printing/Cutting Form State
  const [editingId, setEditingId] = useState<string | null>(null);
  
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [partyName, setPartyName] = useState('');
  const [size, setSize] = useState('');
  const [planType, setPlanType] = useState('Printing');
  const [printName, setPrintName] = useState(''); 
  const [weight, setWeight] = useState('');
  const [meter, setMeter] = useState(''); // New State for Input
  const [micron, setMicron] = useState('');
  const [cuttingSize, setCuttingSize] = useState('');
  const [pcs, setPcs] = useState('');
  const [notes, setNotes] = useState('');
  
  // Calculation Mode
  const [lastEdited, setLastEdited] = useState<'weight' | 'pcs' | 'meter'>('weight');

  // Search Party Suggestions
  const [showPartyDropdown, setShowPartyDropdown] = useState(false);

  // Long Press State
  const [longPressTimer, setLongPressTimer] = useState<any>(null);

  // Helpers
  const getAllowance = (type: string) => {
      const t = type.toLowerCase();
      if (t.includes('seal')) return 5;
      if (t.includes('round')) return 15;
      return 0;
  };

  const getExtraMeter = (type: string) => {
      return type === 'Printing' ? 200 : 0;
  };

  const calculate = () => {
      const s = parseFloat(size) || 0;
      const m = parseFloat(micron) || 0;
      const cut = parseFloat(cuttingSize) || 0;
      const DENSITY = 0.00280;
      const allowance = getAllowance(planType);
      const extraMeter = getExtraMeter(planType);
      const effectiveCutSize = cut + allowance;

      if (s > 0 && m > 0) {
          if (lastEdited === 'weight') {
              const w = parseFloat(weight) || 0;
              const calcM = (w * 1000) / (s * m * DENSITY);
              setMeter(Math.floor(calcM).toString());
              
              if (effectiveCutSize > 0) {
                  const availableMeter = calcM > extraMeter ? calcM - extraMeter : 0;
                  const rawPcs = (availableMeter * 1000) / effectiveCutSize;
                  const roundedPcs = Math.round(rawPcs / 100) * 100;
                  setPcs(roundedPcs > 0 ? roundedPcs.toString() : '0');
              } else {
                  setPcs('0');
              }

          } else if (lastEdited === 'pcs') {
              const p = parseFloat(pcs) || 0;
              const cuttingMeter = (effectiveCutSize * p) / 1000;
              const totalMeter = cuttingMeter + extraMeter;
              setMeter(Math.ceil(totalMeter).toString());
              const calculatedWeight = (s * m * DENSITY * totalMeter) / 1000;
              setWeight(calculatedWeight > 0 ? calculatedWeight.toFixed(3) : '0');

          } else if (lastEdited === 'meter') {
              const mtr = parseFloat(meter) || 0;
              const calculatedWeight = (s * DENSITY * mtr * m) / 1000;
              setWeight(calculatedWeight > 0 ? calculatedWeight.toFixed(3) : '0');
              if (effectiveCutSize > 0) {
                  const netMeter = mtr > extraMeter ? mtr - extraMeter : 0;
                  const rawPcs = (netMeter * 1000) / effectiveCutSize;
                  const roundedPcs = Math.round(rawPcs / 100) * 100;
                  setPcs(roundedPcs > 0 ? roundedPcs.toString() : '0');
              } else {
                  setPcs('0');
              }
          }
      }
  };

  useEffect(() => {
      calculate();
  }, [size, micron, cuttingSize, planType, lastEdited === 'weight' ? weight : (lastEdited === 'pcs' ? pcs : meter)]); 

  const handleWeightChange = (val: string) => { setWeight(val); setLastEdited('weight'); };
  const handlePcsChange = (val: string) => { setPcs(val); setLastEdited('pcs'); };
  const handleMeterChange = (val: string) => { setMeter(val); setLastEdited('meter'); };

  const handleEdit = (plan: ProductionPlan) => {
      setEditingId(plan.id);
      setDate(plan.date);
      setPartyName(plan.partyName);
      setSize(plan.size);
      setPlanType(plan.type);
      setPrintName(plan.printName || '');
      setWeight(plan.weight.toString());
      setMicron(plan.micron.toString());
      setCuttingSize(plan.cuttingSize > 0 ? plan.cuttingSize.toString() : '');
      setPcs(plan.pcs.toString());
      setMeter(plan.meter.toString());
      setLastEdited('weight');
      setNotes(plan.notes || '');
      window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDuplicate = (plan: ProductionPlan) => {
      setPartyName(plan.partyName);
      setSize(plan.size);
      setPlanType(plan.type);
      setPrintName(plan.printName || '');
      setWeight(plan.weight.toString());
      setMicron(plan.micron.toString());
      setCuttingSize(plan.cuttingSize > 0 ? plan.cuttingSize.toString() : '');
      setPcs(plan.pcs.toString());
      setMeter(plan.meter.toString());
      setNotes(plan.notes || '');
      setEditingId(null);
      setDate(new Date().toISOString().split('T')[0]);
      window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSavePlan = async () => {
    if (!partyName || !size || !weight) return alert("Please fill Party, Size and Weight");

    const w = parseFloat(weight) || 0;
    const p = parseFloat(pcs) || 0;
    const mtr = parseFloat(meter) || 0;
    const cut = parseFloat(cuttingSize) || 0;

    const basePayload = {
        date, partyName, size, type: planType,
        printName: planType === 'Printing' ? printName : "",
        weight: w, micron: parseFloat(micron) || 0,
        meter: mtr, cuttingSize: cut, pcs: p, notes,
    };

    if (editingId) {
        await updateProductionPlan({ id: editingId, ...basePayload });
        const linkedDispatches = data.dispatches.filter(d => d.rows.some(r => r.planId === editingId));
        for (const d of linkedDispatches) {
            const newRows = d.rows.map(r => {
                if (r.planId === editingId) {
                    let displaySize = cut > 0 ? `${size}x${cut}` : size;
                    if (planType === 'Printing' && printName) displaySize = `${displaySize} (${printName})`;
                    return { ...r, size: displaySize, micron: parseFloat(micron) || 0, productionWeight: w };
                }
                return r;
            });
            await saveDispatch({ ...d, rows: newRows, updatedAt: new Date().toISOString() });
        }
        setEditingId(null);
    } else {
        const newPlan: ProductionPlan = {
            id: `plan-${Date.now()}`,
            ...basePayload,
            status: 'PENDING',
            createdAt: new Date().toISOString()
        };
        await saveProductionPlan(newPlan);
    }
    handleCancelEdit();
  };

  const handleCancelEdit = () => {
      setEditingId(null);
      setPartyName(''); setSize(''); setWeight(''); setMicron(''); setCuttingSize(''); setNotes(''); setPrintName(''); setPcs(''); setMeter('');
      setPlanType('Printing');
  };

  const handleDelete = async (id: string) => {
      if(confirm("Delete this plan?")) {
          await deleteProductionPlan(id);
          if (editingId === id) handleCancelEdit();
      }
  };

  const startLongPress = (id: string, status: string) => {
      if (status !== 'COMPLETED') return;
      const timer = setTimeout(() => {
          if (navigator.vibrate) navigator.vibrate(50);
          if (confirm("🗑️ Permanently Delete this COMPLETED plan?")) {
              deleteProductionPlan(id);
          }
      }, 800);
      setLongPressTimer(timer);
  };

  const cancelLongPress = () => {
      if (longPressTimer) {
          clearTimeout(longPressTimer);
          setLongPressTimer(null);
      }
  };

  const partySuggestions = data.parties.filter(p => 
    p.name.toLowerCase().includes(partyName.toLowerCase())
  );

  const sortedPlans = [...data.productionPlans].sort((a, b) => {
      if (a.status === 'PENDING' && b.status !== 'PENDING') return -1;
      if (a.status !== 'PENDING' && b.status === 'PENDING') return 1;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });

  const exportToExcel = () => {
    const headers = ["Date", "Sr.No", "Size", "Micron", "Weight", "Meter", "Cutting Size", "Type", "Printing", "Pcs", "Party Name", "Note"];
    const rows = sortedPlans.map((plan, index) => [
      plan.date, index + 1, `"${plan.size}"`, plan.micron, plan.weight.toFixed(3), plan.meter, plan.cuttingSize || "", plan.type, `"${plan.printName || ''}"`, plan.pcs, `"${plan.partyName}"`, `"${plan.notes || ''}"`
    ]);
    const csvContent = [headers.join(","), ...rows.map(r => r.join(","))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `Production_List_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-20">
        
        {/* Toggle Mode - Tabbed Navigation for different types of plans */}
        {!isUserView && (
            <div className="flex bg-white/50 backdrop-blur-sm p-1.5 rounded-xl w-full max-w-2xl mx-auto shadow-sm border border-white/60">
                <button onClick={() => setActiveMode('printing')} className={`flex-1 py-2.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-2 ${activeMode==='printing'?'bg-slate-900 text-white shadow-md':'text-slate-500 hover:bg-slate-100'}`}>
                    <Layers size={14} /> Printing
                </button>
                <button onClick={() => setActiveMode('slitting')} className={`flex-1 py-2.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-2 ${activeMode==='slitting'?'bg-slate-900 text-white shadow-md':'text-slate-500 hover:bg-slate-100'}`}>
                    <Ruler size={14} /> Slitting
                </button>
                <button onClick={() => setActiveMode('plant')} className={`flex-1 py-2.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-2 ${activeMode==='plant'?'bg-slate-900 text-white shadow-md':'text-slate-500 hover:bg-slate-100'}`}>
                    <Factory size={14} /> Plant Plan
                </button>
            </div>
        )}

        {activeMode === 'slitting' && !isUserView ? (
            <SlittingManager data={data} />
        ) : activeMode === 'plant' && !isUserView ? (
            <PlantPlanner data={data} />
        ) : (
            <div className="flex flex-col xl:flex-row gap-6 items-start">
                
                {/* 1. FORM SECTION - Hidden for User View */}
                {!isUserView && (
                    <div className={`w-full xl:w-[380px] bg-white rounded-2xl shadow-xl shadow-slate-200/50 border border-slate-100 p-6 xl:sticky xl:top-24 z-30 transition-all ${editingId ? 'ring-2 ring-amber-400' : ''}`}>
                        <div className="flex justify-between items-center mb-6 border-b border-slate-50 pb-4">
                            <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                                <span className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center text-indigo-600">
                                    {editingId ? <Edit2 size={16} /> : <Layers size={16} />}
                                </span>
                                {editingId ? 'Edit Plan' : 'Create Plan'}
                            </h3>
                            {editingId && <button onClick={handleCancelEdit} className="text-xs font-bold text-red-500 hover:bg-red-50 px-3 py-1.5 rounded-lg transition-colors">Cancel</button>}
                        </div>

                        <div className="space-y-5">
                            <div className="space-y-4">
                                <div>
                                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5">Date & Party</label>
                                    <div className="flex gap-2">
                                        <input type="date" value={date} onChange={e => setDate(e.target.value)} className="w-1/3 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-xs font-bold outline-none focus:border-indigo-500 focus:bg-white transition-all shadow-sm" />
                                        <div className="relative flex-1">
                                            <input 
                                                type="text" 
                                                value={partyName} 
                                                onChange={e => { setPartyName(e.target.value); setShowPartyDropdown(true); }}
                                                onBlur={() => setTimeout(() => setShowPartyDropdown(false), 200)}
                                                placeholder="Party Name" 
                                                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-xs font-bold outline-none focus:border-indigo-500 focus:bg-white transition-all shadow-sm" 
                                            />
                                            {showPartyDropdown && partyName && (
                                                <div className="absolute z-10 w-full mt-1 bg-white border border-slate-200 rounded-xl shadow-xl max-h-48 overflow-y-auto custom-scrollbar p-1">
                                                    {partySuggestions.map(p => (
                                                        <div key={p.id} className="px-3 py-2 hover:bg-indigo-50 rounded-lg cursor-pointer text-xs font-bold text-slate-700" onClick={() => { setPartyName(p.name); setShowPartyDropdown(false); }}>{p.name}</div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                <div>
                                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5">Job Type</label>
                                    <select value={planType} onChange={e => setPlanType(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-xs font-bold outline-none focus:border-indigo-500 focus:bg-white transition-all shadow-sm appearance-none">
                                        {PLAN_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                                    </select>
                                </div>
                            </div>

                            <div>
                                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5">Specs (Size / Mic / Cut)</label>
                                <div className="grid grid-cols-3 gap-2">
                                    <input type="number" value={size} onChange={e => setSize(e.target.value)} placeholder="Size" className="bg-slate-50 border border-slate-200 rounded-xl px-2 py-2.5 text-xs font-bold outline-none focus:border-indigo-500 focus:bg-white text-center shadow-sm" />
                                    <input type="number" value={micron} onChange={e => setMicron(e.target.value)} placeholder="Mic" className="bg-slate-50 border border-slate-200 rounded-xl px-2 py-2.5 text-xs font-bold outline-none focus:border-indigo-500 focus:bg-white text-center shadow-sm" />
                                    <input type="number" value={cuttingSize} onChange={e => setCuttingSize(e.target.value)} placeholder="Cut" className="bg-slate-50 border border-slate-200 rounded-xl px-2 py-2.5 text-xs font-bold outline-none focus:border-indigo-500 focus:bg-white text-center shadow-sm" />
                                </div>
                            </div>

                            {planType === 'Printing' && (
                                <div className="animate-in fade-in slide-in-from-top-1">
                                    <label className="text-[10px] font-bold text-indigo-400 uppercase tracking-wider block mb-1.5">Print Name</label>
                                    <input 
                                        type="text" 
                                        value={printName} 
                                        onChange={e => setPrintName(e.target.value)} 
                                        placeholder="Design Name" 
                                        className="w-full bg-indigo-50/30 border border-indigo-100 rounded-xl px-4 py-2.5 text-xs font-bold outline-none focus:border-indigo-500 focus:bg-white text-indigo-700 shadow-sm" 
                                    />
                                </div>
                            )}

                            <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200 relative overflow-hidden group hover:border-indigo-200 transition-colors">
                                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-2 flex items-center gap-1">
                                    <Scale size={10} /> Calculator
                                </label>
                                
                                <div className="flex items-center gap-2">
                                    <div className="flex-1">
                                        <label className="text-[9px] font-bold text-indigo-600 mb-1 block uppercase text-center">Weight (kg)</label>
                                        <input 
                                            type="number" 
                                            value={weight} 
                                            onChange={e => handleWeightChange(e.target.value)} 
                                            placeholder="0" 
                                            className={`w-full border rounded-xl p-2 text-sm font-bold text-center outline-none transition-all ${lastEdited === 'weight' ? 'border-indigo-500 shadow-sm ring-2 ring-indigo-100 bg-white' : 'border-slate-200 bg-white/50'}`} 
                                        />
                                    </div>
                                    <div className="text-slate-300"><ArrowRightLeft size={14} /></div>
                                    <div className="flex-1">
                                        <label className="text-[9px] font-bold text-blue-600 mb-1 block uppercase text-center">Meter (m)</label>
                                        <input 
                                            type="number" 
                                            value={meter} 
                                            onChange={e => handleMeterChange(e.target.value)} 
                                            placeholder="0" 
                                            className={`w-full border rounded-xl p-2 text-sm font-bold text-center outline-none transition-all ${lastEdited === 'meter' ? 'border-blue-500 shadow-sm ring-2 ring-blue-100 bg-white' : 'border-slate-200 bg-white/50'}`} 
                                        />
                                    </div>
                                    <div className="text-slate-300"><ArrowRightLeft size={14} /></div>
                                    <div className="flex-1">
                                        <label className="text-[9px] font-bold text-emerald-600 mb-1 block uppercase text-center">Pieces</label>
                                        <input 
                                            type="number" 
                                            value={pcs} 
                                            onChange={e => handlePcsChange(e.target.value)} 
                                            placeholder="0" 
                                            className={`w-full border rounded-xl p-2 text-sm font-bold text-center outline-none transition-all ${lastEdited === 'pcs' ? 'border-emerald-500 shadow-sm ring-2 ring-emerald-100 bg-white' : 'border-slate-200 bg-white/50'}`} 
                                        />
                                    </div>
                                </div>
                            </div>

                            <div>
                                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5">Notes</label>
                                <textarea value={notes} onChange={e => setNotes(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-xs font-bold text-slate-600 h-20 resize-none outline-none focus:border-indigo-500 focus:bg-white transition-all shadow-sm" placeholder="Optional details..."></textarea>
                            </div>

                            <button 
                                onClick={handleSavePlan} 
                                className={`w-full text-white font-bold py-3.5 rounded-xl shadow-lg hover:shadow-xl transition-all transform active:scale-[0.98] flex items-center justify-center gap-2 ${editingId ? 'bg-amber-500 hover:bg-amber-600' : 'bg-slate-900 hover:bg-black'}`}
                            >
                                {editingId ? <><Edit2 size={16} /> Update Plan</> : <><CheckCircle size={16} /> Add to Queue</>}
                            </button>
                        </div>
                    </div>
                )}

                {/* 2. TABLE SECTION */}
                <div className="flex-1 w-full min-w-0 space-y-4">
                    <div className="flex items-center justify-between bg-white px-5 py-4 rounded-2xl shadow-sm border border-slate-200">
                        <div className="flex items-center gap-3">
                            <div className="bg-indigo-100 text-indigo-600 p-2 rounded-lg">
                                <Layers size={20} />
                            </div>
                            <div>
                                <h3 className="text-lg font-bold text-slate-800 leading-none">Production Queue</h3>
                                <p className="text-xs text-slate-500 font-medium mt-1">{sortedPlans.filter(p => p.status === 'PENDING').length} Pending Orders</p>
                            </div>
                        </div>
                        <div className="flex gap-2">
                            <button 
                                onClick={exportToExcel}
                                className="bg-white hover:bg-slate-50 text-emerald-600 border border-emerald-200 text-xs font-bold px-3 py-1.5 rounded-lg shadow-sm transition-all flex items-center gap-2"
                            >
                                <FileText size={14} /> <span className="hidden sm:inline">Export</span>
                            </button>
                            <span className="bg-slate-100 text-slate-600 text-xs font-bold px-3 py-1.5 rounded-lg border border-slate-200 shadow-inner flex items-center">
                                Total: {sortedPlans.length}
                            </span>
                        </div>
                    </div>

                    <div className="bg-white rounded-2xl shadow-xl shadow-slate-200/50 border border-slate-200 overflow-hidden flex flex-col h-[700px]">
                        
                        {/* --- MOBILE COMPACT LIST (Visible on sm:hidden) --- */}
                        <div className="block sm:hidden overflow-y-auto custom-scrollbar h-full bg-slate-50 p-2">
                            {sortedPlans.length === 0 ? (
                                <div className="text-center py-12 text-slate-400">
                                    <Layers size={32} className="mx-auto mb-2 opacity-50" />
                                    <p className="text-xs font-bold">Empty Queue</p>
                                </div>
                            ) : (
                                <div className="space-y-2">
                                    {sortedPlans.map((plan) => {
                                        const isCompleted = plan.status === 'COMPLETED';
                                        return (
                                            <div 
                                                key={plan.id} 
                                                className={`bg-white rounded-lg border border-slate-200 shadow-sm p-3 relative ${isCompleted ? 'opacity-70 grayscale bg-slate-50' : ''}`}
                                                onMouseDown={() => startLongPress(plan.id, plan.status)}
                                                onMouseUp={cancelLongPress}
                                                onMouseLeave={cancelLongPress}
                                                onTouchStart={() => startLongPress(plan.id, plan.status)}
                                                onTouchEnd={cancelLongPress}
                                                onTouchMove={cancelLongPress}
                                                onContextMenu={(e) => isCompleted && e.preventDefault()}
                                            >
                                                <div className="flex justify-between items-start mb-1">
                                                    <div className="font-bold text-xs text-slate-900 truncate w-[65%] leading-tight">{plan.partyName}</div>
                                                    <div className="text-[9px] font-mono text-slate-400 font-bold">{plan.date.split('-').reverse().join('/')}</div>
                                                </div>
                                                <div className="flex justify-between items-center mb-2">
                                                    <div className="flex items-center gap-1.5 text-[10px] font-bold">
                                                        <span className="text-slate-800">{plan.size}</span>
                                                        <span className="text-slate-300">•</span>
                                                        <span className="text-indigo-600">{plan.type}</span>
                                                        <span className="text-slate-300">•</span>
                                                        <span className="text-slate-600">{plan.micron}m</span>
                                                    </div>
                                                    {plan.printName && <div className="text-[9px] text-purple-600 font-bold truncate max-w-[80px]">{plan.printName}</div>}
                                                </div>
                                                <div className="bg-slate-50 rounded border border-slate-100 p-1.5 grid grid-cols-4 gap-1 text-center mb-2">
                                                    <div><span className="block text-[7px] text-slate-400 uppercase font-bold">Weight</span><span className="text-[10px] font-bold text-slate-800">{plan.weight}</span></div>
                                                    <div><span className="block text-[7px] text-slate-400 uppercase font-bold">Meter</span><span className="text-[10px] font-bold text-blue-600">{plan.meter}</span></div>
                                                    <div><span className="block text-[7px] text-slate-400 uppercase font-bold">Pcs</span><span className="text-[10px] font-bold text-emerald-600">{plan.pcs}</span></div>
                                                    <div><span className="block text-[7px] text-slate-400 uppercase font-bold">Cut</span><span className="text-[10px] font-bold text-slate-600">{plan.cuttingSize || '-'}</span></div>
                                                </div>
                                                <div className="flex justify-between items-end">
                                                    <div className="flex-1 pr-2">
                                                        {plan.notes && (
                                                            <div className="flex items-start gap-1 text-[9px] text-amber-600 italic bg-amber-50 px-1.5 py-0.5 rounded w-fit max-w-full">
                                                                <FileText size={8} className="mt-0.5" />
                                                                <span className="truncate">{plan.notes}</span>
                                                            </div>
                                                        )}
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        {!isUserView && <button onClick={() => handleDuplicate(plan)} className="p-1.5 bg-blue-50 text-blue-600 rounded border border-blue-100 shadow-sm" title="Duplicate Plan"><Copy size={12} /></button>}
                                                        {isCompleted ? (
                                                            <span className="text-[9px] font-bold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-100">Taken</span>
                                                        ) : (
                                                            !isUserView && (
                                                                <>
                                                                    <button onClick={() => handleEdit(plan)} className="p-1.5 bg-indigo-50 text-indigo-600 rounded border border-indigo-100 shadow-sm"><Edit2 size={12} /></button>
                                                                    <button onClick={() => handleDelete(plan.id)} className="p-1.5 bg-red-50 text-red-500 rounded border border-red-100 shadow-sm"><Trash2 size={12} /></button>
                                                                </>
                                                            )
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>

                        {/* --- DESKTOP TABLE (Hidden on sm) --- */}
                        <div className="hidden sm:block overflow-auto custom-scrollbar flex-1">
                            <table className="w-full text-left border-collapse min-w-[1000px]">
                                <thead className="bg-slate-900 text-white text-[10px] uppercase tracking-wider sticky top-0 z-20 shadow-md">
                                    <tr>
                                        <th className="px-3 py-4 font-bold whitespace-nowrap"><div className="flex items-center gap-1"><Calendar size={12} /> Date</div></th>
                                        <th className="px-3 py-4 font-bold whitespace-nowrap"><div className="flex items-center gap-1"><User size={12} /> Party</div></th>
                                        <th className="px-3 py-4 font-bold whitespace-nowrap"><div className="flex items-center gap-1"><Layers size={12} /> Type</div></th>
                                        <th className="px-3 py-4 font-bold whitespace-nowrap"><div className="flex items-center gap-1"><Ruler size={12} /> Size</div></th>
                                        <th className="px-3 py-4 font-bold whitespace-nowrap"><div className="flex items-center gap-1"><Printer size={12} /> Print</div></th>
                                        <th className="px-3 py-4 font-bold text-right whitespace-nowrap">Mic</th>
                                        <th className="px-3 py-4 font-bold text-right whitespace-nowrap">Wt (kg)</th>
                                        <th className="px-3 py-4 font-bold text-right whitespace-nowrap">Mtr</th>
                                        <th className="px-3 py-4 font-bold text-right whitespace-nowrap">Pcs</th>
                                        <th className="px-3 py-4 font-bold whitespace-nowrap"><div className="flex items-center gap-1"><FileText size={12} /> Note</div></th>
                                        <th className="px-3 py-4 font-bold text-center whitespace-nowrap"><div className="flex items-center gap-1 justify-center"><Clock size={12} /> Status</div></th>
                                        {!isUserView && <th className="px-3 py-4 font-bold text-center whitespace-nowrap sticky right-0 bg-slate-900 z-30 shadow-[-4px_0_12px_rgba(0,0,0,0.2)] w-24">Action</th>}
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {sortedPlans.map((plan, idx) => {
                                        const isCompleted = plan.status === 'COMPLETED';
                                        const sizeDisplay = plan.cuttingSize > 0 ? `${plan.size} x ${plan.cuttingSize}` : plan.size;
                                        
                                        return (
                                            <tr 
                                                key={plan.id} 
                                                className={`group transition-all duration-300 hover:bg-indigo-50/30 ${isCompleted ? 'bg-slate-50/50 grayscale-[0.5]' : 'bg-white'} animate-in slide-in-from-bottom-2 fade-in`}
                                                style={{ animationDelay: `${idx * 30}ms` }}
                                                onMouseDown={() => startLongPress(plan.id, plan.status)}
                                                onMouseUp={cancelLongPress}
                                                onMouseLeave={cancelLongPress}
                                                onTouchStart={() => startLongPress(plan.id, plan.status)}
                                                onTouchEnd={cancelLongPress}
                                                onTouchMove={cancelLongPress}
                                                onContextMenu={(e) => isCompleted && e.preventDefault()}
                                            >
                                                <td className="px-3 py-3 whitespace-nowrap">
                                                    <span className="font-mono text-xs font-bold text-slate-500 bg-slate-100 px-2 py-1 rounded-md">{plan.date.split('-').slice(1).join('/')}</span>
                                                </td>
                                                <td className="px-3 py-3 whitespace-nowrap max-w-[150px]">
                                                    <div className="font-bold text-xs text-slate-800 truncate" title={plan.partyName}>{plan.partyName}</div>
                                                </td>
                                                <td className="px-3 py-3 whitespace-nowrap">
                                                    <span className="text-[10px] font-bold text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded uppercase border border-indigo-100">{plan.type}</span>
                                                </td>
                                                <td className="px-3 py-3 whitespace-nowrap">
                                                    <div className="font-bold text-xs text-slate-700 font-mono">{sizeDisplay}</div>
                                                </td>
                                                <td className="px-3 py-3 whitespace-nowrap max-w-[120px]">
                                                    <div className="text-xs text-slate-600 truncate font-medium" title={plan.printName || '-'}>{plan.printName || '-'}</div>
                                                </td>
                                                <td className="px-3 py-3 text-right whitespace-nowrap font-mono text-xs font-bold text-slate-500">
                                                    {plan.micron}
                                                </td>
                                                <td className="px-3 py-3 text-right whitespace-nowrap">
                                                    <div className="text-xs font-bold text-slate-900">{plan.weight}</div>
                                                </td>
                                                <td className="px-3 py-3 text-right whitespace-nowrap font-mono text-xs text-indigo-600 font-bold">
                                                    {plan.meter}
                                                </td>
                                                <td className="px-3 py-3 text-right whitespace-nowrap">
                                                    <div className="text-xs font-bold text-emerald-600">{plan.pcs}</div>
                                                </td>
                                                <td className="px-3 py-3 whitespace-nowrap max-w-[150px]">
                                                    <div className="text-[10px] text-slate-500 truncate" title={plan.notes || ''}>{plan.notes || '-'}</div>
                                                </td>
                                                <td className="px-3 py-3 text-center whitespace-nowrap">
                                                    {isCompleted ? (
                                                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 text-[10px] font-bold border border-emerald-200">
                                                            ✓ Taken
                                                        </span>
                                                    ) : (
                                                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 text-[10px] font-bold border border-amber-200">
                                                            • Pending
                                                        </span>
                                                    )}
                                                </td>
                                                {!isUserView && (
                                                <td className={`px-3 py-3 text-center whitespace-nowrap sticky right-0 z-10 shadow-[-4px_0_12px_rgba(0,0,0,0.05)] ${isCompleted ? 'bg-slate-50' : 'bg-white'}`}>
                                                    <div className="flex items-center justify-center gap-2">
                                                        <button 
                                                            onClick={() => handleDuplicate(plan)} 
                                                            className="bg-blue-50 border border-blue-100 text-blue-600 hover:bg-blue-600 hover:text-white p-1.5 rounded-md transition-colors shadow-sm" 
                                                            title="Duplicate Plan"
                                                        >
                                                            <Copy size={14} />
                                                        </button>
                                                        <button 
                                                            onClick={() => handleEdit(plan)} 
                                                            className="bg-indigo-50 border border-indigo-100 text-indigo-600 hover:bg-indigo-600 hover:text-white p-1.5 rounded-md transition-colors shadow-sm" 
                                                            title="Edit"
                                                        >
                                                            <Edit2 size={14} />
                                                        </button>
                                                        <button 
                                                            onClick={() => handleDelete(plan.id)} 
                                                            className="bg-red-50 border border-red-100 text-red-500 hover:bg-red-600 hover:text-white p-1.5 rounded-md transition-colors shadow-sm" 
                                                            title="Delete"
                                                        >
                                                            <Trash2 size={14} />
                                                        </button>
                                                    </div>
                                                </td>
                                                )}
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </div>
        )}
    </div>
  );
};
