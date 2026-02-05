
import React, { useState, useMemo, useEffect } from 'react';
import { AppData, Challan, PaymentMode } from '../../types';
import { saveChallan, deleteChallan, ensurePartyExists } from '../../services/storageService';

interface Props {
  data: AppData;
  onUpdate: (newData: AppData) => void;
}

const SIZE_TYPES = ["", "INTAS", "OPEN", "ROUND", "ST.SEAL", "LABEL"];

export const ChallanManager: React.FC<Props> = ({ data, onUpdate }) => {
  const [activeChallan, setActiveChallan] = useState<Partial<Challan>>({
    date: new Date().toISOString().split('T')[0],
    challanNumber: '', 
    paymentMode: PaymentMode.UNPAID,
    lines: []
  });
  
  const [partyInput, setPartyInput] = useState('');
  const [showPartyDropdown, setShowPartyDropdown] = useState(false);
  const [lineSize, setLineSize] = useState('');
  const [lineType, setLineType] = useState('');
  const [lineMicron, setLineMicron] = useState(''); 
  const [lineWt, setLineWt] = useState('');
  const [linePrice, setLinePrice] = useState('');
  const [searchParty, setSearchParty] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [isEditingId, setIsEditingId] = useState<string | null>(null);

  useEffect(() => {
    if (!isEditingId && activeChallan.challanNumber === '') {
      const maxNo = data.challans.reduce((max, c) => {
        const num = parseInt(c.challanNumber);
        return !isNaN(num) && num > max ? num : max;
      }, 0);
      const nextNo = maxNo === 0 ? '101' : (maxNo + 1).toString();
      setActiveChallan(prev => ({ ...prev, challanNumber: nextNo }));
    }
  }, [data.challans, isEditingId]);

  useEffect(() => {
    if (partyInput && lineSize) {
       const party = data.parties.find(p => p.name.toLowerCase() === partyInput.toLowerCase());
       if (party) {
          const partyChallans = data.challans.filter(c => c.partyId === party.id);
          partyChallans.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
          for (const challan of partyChallans) {
             const matchingLine = challan.lines.find(l => l.size.toLowerCase() === lineSize.toLowerCase());
             if (matchingLine) {
                setLinePrice(matchingLine.rate.toString());
                break;
             }
          }
       }
    }
  }, [partyInput, lineSize, data.parties, data.challans]);

  const stats = useMemo(() => {
    const received = data.challans.filter(c => c.paymentMode === PaymentMode.CASH).reduce((a,b) => a + b.totalAmount, 0);
    const credit = data.challans.filter(c => c.paymentMode === PaymentMode.UNPAID).reduce((a,b) => a + b.totalAmount, 0);
    return { received, credit };
  }, [data.challans]);

  const currentFormTotals = useMemo(() => {
      const lines = activeChallan.lines || [];
      const totalWeight = lines.reduce((s, l) => s + l.weight, 0);
      const totalAmount = Math.round(lines.reduce((s, l) => s + l.amount, 0));
      return { weight: totalWeight, amount: totalAmount };
  }, [activeChallan.lines]);

  const addLine = () => {
    const wt = parseFloat(lineWt) || 0;
    const price = parseFloat(linePrice) || 0;
    const newLine = {
      id: `l-${Date.now()}-${Math.random()}`,
      size: lineSize || 'Item',
      sizeType: lineType,
      micron: parseFloat(lineMicron) || 0,
      weight: wt,
      rate: price,
      amount: wt > 0 ? wt * price : price 
    };
    setActiveChallan({ ...activeChallan, lines: [...(activeChallan.lines || []), newLine] });
    setLineSize(''); setLineType(''); setLineMicron(''); setLineWt(''); setLinePrice('');
  };

  const removeLine = (index: number) => {
    const newLines = [...(activeChallan.lines || [])];
    newLines.splice(index, 1);
    setActiveChallan({ ...activeChallan, lines: newLines });
  };

  const handleEdit = (c: Challan) => {
    const partyName = data.parties.find(p => p.id === c.partyId)?.name || '';
    setPartyInput(partyName);
    setActiveChallan({
        id: c.id,
        challanNumber: c.challanNumber,
        date: c.date,
        paymentMode: c.paymentMode,
        lines: c.lines
    });
    setIsEditingId(c.id);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleCloneBill = (c: Challan) => {
      const partyName = data.parties.find(p => p.id === c.partyId)?.name || '';
      setPartyInput(partyName);
      const newLines = c.lines.map(l => ({ ...l, id: `l-${Date.now()}-${Math.random()}`, weight: 0, amount: 0 }));
      setActiveChallan({
          date: new Date().toISOString().split('T')[0],
          challanNumber: '', 
          paymentMode: PaymentMode.UNPAID,
          lines: newLines
      });
      setIsEditingId(null);
      window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const resetForm = () => {
    setPartyInput('');
    setActiveChallan({ date: new Date().toISOString().split('T')[0], challanNumber: '', paymentMode: PaymentMode.UNPAID, lines: [] });
    setIsEditingId(null);
  };

  const handleSave = async () => {
    if (!partyInput) return alert("Party Name Required");
    const partyId = await ensurePartyExists(data.parties, partyInput);
    
    // Strict derived data on save
    const lines = activeChallan.lines || [];
    const totalWeight = lines.reduce((s, l) => s + (Number(l.weight) || 0), 0);
    const totalAmount = Math.round(lines.reduce((s, l) => s + (Number(l.amount) || 0), 0));

    const newChallan: Challan = {
      id: activeChallan.id || `c-${Date.now()}`,
      challanNumber: activeChallan.challanNumber || `AUTO`,
      date: activeChallan.date!,
      partyId,
      lines,
      totalWeight,
      totalAmount,
      paymentMode: activeChallan.paymentMode!,
      createdAt: new Date().toISOString()
    };
    await saveChallan(newChallan);
    resetForm();
  };

  const filteredChallans = data.challans.filter(c => {
    const p = data.parties.find(p => p.id === c.partyId);
    const partyName = p?.name.toLowerCase() || '';
    const partyCode = p?.code?.toLowerCase() || '';
    return partyName.includes(searchParty.toLowerCase()) || partyCode.includes(searchParty.toLowerCase()) || c.challanNumber.toLowerCase().includes(searchParty.toLowerCase());
  });

  const partySuggestions = data.parties.filter(p => {
    const search = partyInput.toLowerCase();
    return p.name.toLowerCase().includes(search) || (p.code && p.code.toLowerCase().includes(search));
  });

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4">
         <div className="bg-red-50 rounded-xl p-4 border border-red-100 text-center shadow-sm">
            <h3 className="text-xl md:text-2xl font-bold text-red-900">₹{Math.round(stats.credit).toLocaleString()}</h3>
            <p className="text-xs font-semibold text-red-600 tracking-wide">Unpaid Credit</p>
         </div>
         <div className="bg-emerald-50 rounded-xl p-4 border border-emerald-100 text-center shadow-sm">
            <h3 className="text-xl md:text-2xl font-bold text-emerald-900">₹{Math.round(stats.received).toLocaleString()}</h3>
            <p className="text-xs font-semibold text-emerald-700 tracking-wide">Cash Received</p>
         </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="space-y-6">
            <div className={`bg-white rounded-2xl shadow-sm border ${isEditingId ? 'border-indigo-300 ring-2 ring-indigo-100' : 'border-slate-200'} overflow-hidden transition-all`}>
                <div className={`px-6 py-4 flex justify-between items-center ${isEditingId ? 'bg-indigo-600' : 'bg-slate-800'}`}>
                    <div className="flex items-center gap-3">
                        <span className="text-2xl">{isEditingId ? '✏️' : '🧾'}</span>
                        <h3 className="text-base font-bold text-white tracking-wide">{isEditingId ? 'Edit Bill' : 'New Bill'}</h3>
                    </div>
                    <div className="text-right">
                        <div className="text-[9px] font-black text-white/50 uppercase">Form Total</div>
                        <div className="text-xs font-black text-white">₹{currentFormTotals.amount.toLocaleString()}</div>
                    </div>
                </div>

                <div className="p-6 space-y-4">
                    <div className="flex gap-4">
                        <div className="w-24">
                            <label className="text-xs font-bold text-slate-700 block mb-1">Bill #</label>
                            <input type="number" placeholder="Auto" value={activeChallan.challanNumber} onChange={e => setActiveChallan({...activeChallan, challanNumber: e.target.value})} className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm font-bold text-slate-900 text-center outline-none focus:border-indigo-500 bg-indigo-50/30" />
                        </div>
                        <div className="flex-1">
                            <label className="text-xs font-bold text-slate-700 block mb-1">Date</label>
                            <input type="date" value={activeChallan.date} onChange={e => setActiveChallan({...activeChallan, date: e.target.value})} className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm font-bold text-slate-900 outline-none focus:border-indigo-500" />
                        </div>
                    </div>
                    
                    <div className="relative">
                        <label className="text-xs font-bold text-slate-700 block mb-1">Party Name</label>
                        <input type="text" placeholder="Search..." value={partyInput} onChange={e => { setPartyInput(e.target.value); setShowPartyDropdown(true); }} onFocus={() => setShowPartyDropdown(true)} onBlur={() => setTimeout(() => setShowPartyDropdown(false), 200)} className="w-full bg-slate-50 border border-slate-200 rounded-lg px-4 py-3 text-sm font-bold text-slate-900 outline-none focus:border-indigo-500" />
                        {showPartyDropdown && (
                          <div className="absolute z-10 w-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg max-h-48 overflow-y-auto custom-scrollbar">
                            {partySuggestions.map(p => (
                                <div key={p.id} className="px-4 py-2 hover:bg-slate-50 cursor-pointer text-sm border-b border-slate-50 last:border-0" onClick={() => { setPartyInput(p.name); setShowPartyDropdown(false); }}>
                                    <div className="font-bold text-slate-800">{p.name}</div>
                                    {p.code && <div className="text-[10px] font-bold text-indigo-600">{p.code}</div>}
                                </div>
                            ))}
                          </div>
                        )}
                    </div>

                    <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                        <div className="grid grid-cols-12 gap-3 mb-3">
                            <div className="col-span-12 md:col-span-4">
                                <label className="text-xs font-bold text-slate-700 block mb-1">Item Desc</label>
                                <input placeholder="Size / Item" value={lineSize} onChange={e => setLineSize(e.target.value)} className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm font-bold text-slate-900 outline-none focus:border-indigo-500" />
                            </div>
                            <div className="col-span-6 md:col-span-3">
                                <label className="text-xs font-bold text-slate-700 block mb-1">Type</label>
                                <select value={lineType} onChange={e => setLineType(e.target.value)} className="w-full bg-white border border-slate-200 rounded-lg px-2 py-2 text-xs font-bold text-slate-900 outline-none focus:border-indigo-500 transition-colors">
                                   {SIZE_TYPES.map(t => <option key={t} value={t}>{t || 'Select...'}</option>)}
                                </select>
                            </div>
                            <div className="col-span-6 md:col-span-2">
                                <label className="text-xs font-bold text-slate-700 block mb-1">Micron</label>
                                <input type="number" placeholder="Mic" value={lineMicron} onChange={e => setLineMicron(e.target.value)} className="w-full bg-white border border-slate-200 rounded-lg px-2 py-2 text-sm font-bold text-slate-900 text-center outline-none focus:border-indigo-500" />
                            </div>
                            <div className="col-span-6 md:col-span-2">
                                <label className="text-xs font-bold text-slate-700 block mb-1">Weight</label>
                                <input type="number" placeholder="Wt" value={lineWt} onChange={e => setLineWt(e.target.value)} className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm font-bold text-slate-900 text-center outline-none focus:border-indigo-500" />
                            </div>
                            <div className="col-span-6 md:col-span-3 relative">
                                <label className="text-xs font-bold text-slate-700 block mb-1">Rate</label>
                                <input type="number" placeholder="Price" value={linePrice} onChange={e => setLinePrice(e.target.value)} className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm font-bold text-slate-900 text-center outline-none focus:border-indigo-500" />
                            </div>
                        </div>
                        <button onClick={addLine} className="w-full bg-white border border-red-200 text-red-600 rounded-lg py-2 text-xs font-bold hover:bg-red-50 transition-colors shadow-sm">+ Add Line Item</button>
                    </div>

                    <div className="space-y-1 max-h-40 overflow-auto custom-scrollbar">
                    {(activeChallan.lines || []).map((l, i) => (
                        <div key={i} className="group flex justify-between items-center text-xs bg-slate-50 px-3 py-2 rounded-lg border border-slate-100 hover:border-red-200 transition-colors">
                            <div className="flex flex-col">
                                <span className="font-bold text-slate-900">{l.size} {l.sizeType && `(${l.sizeType})`}</span>
                                <div className="flex gap-2 text-[10px] text-slate-600 font-bold">
                                   {l.micron > 0 && <span>{l.micron}mic</span>}
                                   <span>{l.weight.toFixed(3)}kg</span>
                                   <span>{l.rate}</span>
                                </div>
                            </div>
                            <div className="flex items-center gap-3">
                                <span className="font-bold text-slate-900">₹{l.amount.toFixed(2)}</span>
                                <button onClick={() => removeLine(i)} className="text-red-500 hover:text-red-700 opacity-0 group-hover:opacity-100 transition-opacity p-1">✖</button>
                            </div>
                        </div>
                    ))}
                    </div>

                    <div className="flex gap-2 pt-4 border-t border-slate-100">
                        <div className="flex-1 bg-slate-100/50 p-3 rounded-xl border border-slate-100">
                            <span className="text-[9px] font-black text-slate-400 uppercase block">Mode</span>
                            <div className="flex bg-white rounded-lg p-0.5 mt-1">
                                <button onClick={() => setActiveChallan({...activeChallan, paymentMode: PaymentMode.UNPAID})} className={`flex-1 py-1 text-[9px] font-bold rounded ${activeChallan.paymentMode === PaymentMode.UNPAID ? 'bg-red-500 text-white' : 'text-slate-400'}`}>Unpaid</button>
                                <button onClick={() => setActiveChallan({...activeChallan, paymentMode: PaymentMode.CASH})} className={`flex-1 py-1 text-[9px] font-bold rounded ${activeChallan.paymentMode === PaymentMode.CASH ? 'bg-emerald-500 text-white' : 'text-slate-400'}`}>Cash</button>
                            </div>
                        </div>
                        <div className="flex-1 text-right p-3">
                            <span className="text-xs font-bold text-slate-400">Grand Total</span>
                            <div className="text-2xl font-black text-slate-900">₹{currentFormTotals.amount.toLocaleString()}</div>
                        </div>
                    </div>

                    <div className="flex gap-2">
                        {isEditingId && <button onClick={resetForm} className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-4 rounded-xl text-sm transition-colors">Cancel</button>}
                        <button onClick={handleSave} className={`flex-[2] text-white font-bold py-4 rounded-xl text-sm shadow-lg transition-transform active:scale-[0.99] ${isEditingId ? 'bg-indigo-600 hover:bg-indigo-700' : 'bg-slate-900 hover:bg-black'}`}>
                            {isEditingId ? 'Update Bill' : 'Save Bill'}
                        </button>
                    </div>
                </div>
            </div>
          </div>

          <div className="space-y-4">
             <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold text-slate-800">Recent Transactions</h3>
                <input placeholder="Search..." value={searchParty} onChange={e => setSearchParty(e.target.value)} className="bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs font-bold text-slate-900 outline-none w-48 focus:ring-2 focus:ring-indigo-100" />
             </div>
             
             <div className="space-y-3">
                {filteredChallans.slice(0,30).map(c => {
                    const p = data.parties.find(p => p.id === c.partyId);
                    const party = p ? (p.code ? `[${p.code}] ${p.name}` : p.name) : 'Unknown';
                    const isUnpaid = c.paymentMode === PaymentMode.UNPAID;
                    const isExpanded = expandedId === c.id;
                    return (
                    <div key={c.id} className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden hover:shadow-md transition-all">
                        <div className={`p-4 border-l-4 cursor-pointer ${isUnpaid ? 'border-red-500 bg-red-50/10' : 'border-emerald-500 bg-emerald-50/10'}`} onClick={() => setExpandedId(isExpanded ? null : c.id)}>
                            <div className="flex justify-between items-start">
                                <div>
                                    <div className="text-[10px] font-bold text-slate-500 mb-0.5">{c.date} • #{c.challanNumber}</div>
                                    <h4 className="text-sm font-bold text-slate-900 leading-tight pr-2">{party}</h4>
                                </div>
                                <div className="text-right">
                                    <div className="text-base font-bold text-slate-900">₹{Math.round(c.totalAmount).toLocaleString()}</div>
                                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${isUnpaid ? 'bg-red-100 text-red-600' : 'bg-emerald-100 text-emerald-600'}`}>{c.paymentMode}</span>
                                </div>
                            </div>
                        </div>
                        {isExpanded && (
                            <div className="bg-slate-50 p-4 border-t border-slate-100 text-xs">
                                <div className="flex justify-end gap-2 mb-3">
                                    <button onClick={(e) => { e.stopPropagation(); handleCloneBill(c); }} className="flex items-center gap-1 text-slate-600 hover:text-white hover:bg-slate-600 text-xs font-bold border border-slate-300 px-3 py-1.5 rounded transition-colors shadow-sm"><span>⚡</span> Clone Bill</button>
                                </div>
                                <table className="w-full text-[10px] mb-3">
                                    <thead><tr className="text-slate-500 border-b border-slate-200"><th className="text-left pb-1 font-semibold">Item</th><th className="text-right pb-1 font-semibold">Weight</th><th className="text-right pb-1 font-semibold">Amount</th></tr></thead>
                                    <tbody>
                                        {c.lines.map((l, idx) => (
                                            <tr key={idx} className="border-b border-slate-100 last:border-0">
                                                <td className="py-2 font-bold text-slate-800">{l.size} {l.micron > 0 && `(${l.micron}m)`}</td>
                                                <td className="py-2 text-right text-slate-700 font-bold">{l.weight.toFixed(3)}</td>
                                                <td className="py-2 text-right font-bold text-slate-900">{l.amount.toFixed(2)}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                                <div className="flex justify-end gap-2">
                                    <button onClick={(e) => { e.stopPropagation(); handleEdit(c); }} className="flex items-center gap-1 text-indigo-700 hover:text-white hover:bg-indigo-700 text-xs font-bold border border-indigo-200 px-3 py-1.5 rounded transition-colors"><span>✏️</span> Edit</button>
                                    <button onClick={(e) => { e.stopPropagation(); if(confirm('Are you sure?')) deleteChallan(c.id); }} className="text-red-500 hover:text-white hover:bg-red-600 text-xs font-bold border border-red-200 px-3 py-1.5 rounded transition-colors">Delete</button>
                                </div>
                            </div>
                        )}
                    </div>
                    );
                })}
             </div>
          </div>
      </div>
    </div>
  );
};
