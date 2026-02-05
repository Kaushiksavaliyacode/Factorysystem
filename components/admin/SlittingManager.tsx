
import React, { useState, useEffect } from 'react';
import { AppData, SlittingJob, SlittingCoil } from '../../types';
import { saveSlittingJob, deleteSlittingJob } from '../../services/storageService';
import { Share2, CheckSquare, Square } from 'lucide-react';

interface Props {
  data: AppData;
}

export const SlittingManager: React.FC<Props> = ({ data }) => {
  const [activeTab, setActiveTab] = useState<'create' | 'view'>('view');
  const [editingJobId, setEditingJobId] = useState<string | null>(null);
  
  // Selection for WhatsApp Share
  const [selectedSlitRowsForShare, setSelectedSlitRowsForShare] = useState<Record<string, string[]>>({});

  // Form State
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [jobNo, setJobNo] = useState('');
  const [jobCode, setJobCode] = useState(''); 
  const [showPartyDropdown, setShowPartyDropdown] = useState(false);
  const [coils, setCoils] = useState<SlittingCoil[]>([{ id: 'c-1', number: 1, size: '', rolls: 0 }]);
  const [planMicron, setPlanMicron] = useState('');
  const [planQty, setPlanQty] = useState('');
  const [planRollLength, setPlanRollLength] = useState('');
  const [expandedJobId, setExpandedJobId] = useState<string | null>(null);

  const partySuggestions = data.parties.filter(p => {
      const search = jobCode.toLowerCase();
      return p.name.toLowerCase().includes(search) || (p.code && p.code.toLowerCase().includes(search));
  });

  const addCoil = () => {
     setCoils([...coils, { id: `c-${Date.now()}`, number: coils.length + 1, size: '', rolls: 0 }]);
  };

  const removeCoil = (index: number) => {
     if (coils.length <= 1) return;
     const updated = coils.filter((_, i) => i !== index).map((c, i) => ({ ...c, number: i + 1 }));
     setCoils(updated);
  };

  const updateCoil = (index: number, field: keyof SlittingCoil, value: string) => {
     const updated = [...coils];
     updated[index] = { ...updated[index], [field]: field === 'rolls' ? (parseFloat(value)||0) : value };
     setCoils(updated);
  };

  const toggleRowSelectionForShare = (jobId: string, rowId: string) => {
      setSelectedSlitRowsForShare(prev => {
          const current = prev[jobId] || [];
          const updated = current.includes(rowId) ? current.filter(id => id !== rowId) : [...current, rowId];
          return { ...prev, [jobId]: updated };
      });
  };

  const toggleAllRowsForShare = (job: SlittingJob) => {
      const current = selectedSlitRowsForShare[job.id] || [];
      if (current.length === job.rows.length) {
          setSelectedSlitRowsForShare(prev => ({ ...prev, [job.id]: [] }));
      } else {
          setSelectedSlitRowsForShare(prev => ({ ...prev, [job.id]: job.rows.map(r => r.id) }));
      }
  };

  const shareSlittingJob = async (job: SlittingJob) => {
      const party = data.parties.find(p => p.name === job.jobCode)?.name || job.jobCode;
      const markedIds = selectedSlitRowsForShare[job.id] || [];
      const rowsToShare = markedIds.length > 0 ? job.rows.filter(r => markedIds.includes(r.id)) : job.rows;

      const containerId = 'share-slitting-gen';
      let container = document.getElementById(containerId);
      if (container) document.body.removeChild(container);
      
      container = document.createElement('div');
      container.id = containerId;
      container.style.position = 'absolute';
      container.style.left = '-9999px';
      container.style.top = '0px';
      container.style.width = '900px'; 
      container.style.background = '#fff';
      container.style.zIndex = '-1';
      document.body.appendChild(container);

      const totalNetWt = rowsToShare.reduce((s, r) => s + r.netWeight, 0);
      const rowsHtml = rowsToShare.map((r, i) => {
          const coil = job.coils.find(c => c.id === r.coilId);
          return `
            <tr style="background-color: ${i % 2 === 0 ? '#ffffff' : '#f0f9ff'}; border-bottom: 2px solid #e2e8f0;">
                <td style="padding: 12px; font-size: 18px; font-weight: bold; color: #1e293b; text-align: center;">${r.srNo}</td>
                <td style="padding: 12px; font-size: 18px; color: #0f172a; font-weight: bold;">${coil?.size || 'N/A'}</td>
                <td style="padding: 12px; font-size: 18px; color: #475569; text-align: center;">${r.meter}</td>
                <td style="padding: 12px; font-size: 18px; font-weight: bold; color: #0284c7; text-align: right;">${r.grossWeight.toFixed(3)}</td>
                <td style="padding: 12px; font-size: 18px; font-weight: bold; color: #10b981; text-align: right;">${r.netWeight.toFixed(3)}</td>
            </tr>
          `;
      }).join('');

      container.innerHTML = `
        <div style="font-family: 'Inter', sans-serif; border: 4px solid #0f172a; background: #fff;">
            <div style="background: #0f172a; padding: 32px; color: white;">
                <div style="font-size: 18px; text-transform: uppercase; letter-spacing: 2px; color: #38bdf8; font-weight: bold;">Slitting Production Details</div>
                <div style="font-size: 36px; font-weight: bold; margin-top: 8px;">${party}</div>
                <div style="margin-top: 20px; display: flex; justify-content: space-between; border-top: 1px solid #334155; padding-top: 15px;">
                    <span style="font-size: 24px; font-weight: bold;">Job No: #${job.jobNo}</span>
                    <span style="font-size: 20px; opacity: 0.8;">Date: ${job.date.split('-').reverse().join('/')}</span>
                </div>
            </div>
            <table style="width: 100%; border-collapse: collapse;">
                <thead style="background: #f1f5f9; border-bottom: 3px solid #0f172a;">
                    <tr style="text-transform: uppercase; color: #475569; font-size: 16px;">
                        <th style="padding: 15px 12px;">Sr</th>
                        <th style="padding: 15px 12px; text-align: left;">Size</th>
                        <th style="padding: 15px 12px;">Meter</th>
                        <th style="padding: 15px 12px; text-align: right;">Gross</th>
                        <th style="padding: 15px 12px; text-align: right;">Net Wt</th>
                    </tr>
                </thead>
                <tbody>${rowsHtml}</tbody>
                <tfoot style="background: #0f172a; color: white;">
                    <tr>
                        <td colspan="4" style="padding: 20px; font-size: 22px; font-weight: bold;">TOTAL OUTPUT</td>
                        <td style="padding: 20px; text-align: right; font-size: 26px; font-weight: bold;">${totalNetWt.toFixed(3)} kg</td>
                    </tr>
                </tfoot>
            </table>
            <div style="padding: 15px; text-align: center; background: #f8fafc; font-size: 14px; font-weight: bold; color: #0f172a;">RDMS SLITTING SYSTEM</div>
        </div>
      `;

      if ((window as any).html2canvas) {
          const canvas = await (window as any).html2canvas(container, { scale: 2 });
          canvas.toBlob(async (blob: Blob) => {
              if (blob) {
                  const file = new File([blob], `Slitting_${job.jobNo}.png`, { type: 'image/png' });
                  if (navigator.share && navigator.canShare({ files: [file] })) {
                      await navigator.share({ files: [file], title: `Slitting #${job.jobNo}`, text: `Production details for ${party}` });
                  } else {
                      const link = document.createElement('a');
                      link.href = URL.createObjectURL(blob);
                      link.download = `Slitting_${job.jobNo}.png`;
                      link.click();
                  }
              }
              document.body.removeChild(container!);
          });
      }
  };

  const handleEdit = (job: SlittingJob) => {
    setEditingJobId(job.id);
    setDate(job.date);
    setJobNo(job.jobNo);
    setJobCode(job.jobCode);
    setCoils(job.coils || [{ id: 'c-1', number: 1, size: '', rolls: 0 }]);
    setPlanMicron(job.planMicron?.toString() || '');
    setPlanQty(job.planQty?.toString() || '');
    setPlanRollLength(job.planRollLength?.toString() || '');
    setActiveTab('create');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const resetForm = () => {
    setEditingJobId(null);
    setJobNo(''); 
    setJobCode(''); 
    setDate(new Date().toISOString().split('T')[0]);
    setCoils([{ id: 'c-1', number: 1, size: '', rolls: 0 }]);
    setPlanMicron(''); setPlanQty(''); setPlanRollLength('');
  };

  const handleSave = async () => {
    if(!jobNo || !jobCode || coils.some(c => !c.size)) return alert("Fill required fields");
    const pMicron = parseFloat(planMicron) || 0;
    const pQty = parseFloat(planQty) || 0;
    const existingJob = editingJobId ? data.slittingJobs.find(j => j.id === editingJobId) : null;
    const jobData: SlittingJob = {
       id: editingJobId || `slit-${Date.now()}`,
       date, jobNo, jobCode, coils,
       planMicron: pMicron, planQty: pQty,
       planRollLength: parseFloat(planRollLength) || 0,
       rows: existingJob ? existingJob.rows : [],
       status: existingJob ? existingJob.status : 'PENDING',
       createdAt: existingJob ? existingJob.createdAt : new Date().toISOString(),
       updatedAt: new Date().toISOString()
    };
    await saveSlittingJob(jobData);
    resetForm();
    setActiveTab('view');
    alert("Saved Successfully!");
  };

  const handleDelete = async (id: string) => {
     if(confirm("Delete this Job Card?")) await deleteSlittingJob(id);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-20">
       <div className="flex bg-white/50 backdrop-blur-sm p-1.5 rounded-xl w-full max-w-md mx-auto mb-6 border border-white/60 shadow-sm">
          <button onClick={() => { setActiveTab('view'); setEditingJobId(null); }} className={`flex-1 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all ${activeTab==='view'?'bg-slate-900 text-white shadow-md':'text-slate-500 hover:bg-slate-100'}`}>View Jobs</button>
          <button onClick={() => { setActiveTab('create'); resetForm(); }} className={`flex-1 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all ${activeTab==='create' && !editingJobId ?'bg-slate-900 text-white shadow-md':'text-slate-500 hover:bg-slate-100'}`}>+ Create Job</button>
       </div>

       {activeTab === 'create' && (
          <div className="max-w-2xl mx-auto bg-white rounded-2xl shadow-xl border border-slate-100 overflow-hidden">
             <div className={`px-6 py-4 flex items-center justify-between ${editingJobId ? 'bg-amber-600' : 'bg-slate-900'}`}>
                <div className="flex items-center gap-3"><span className="text-xl text-white">{editingJobId ? '✏️' : '🏭'}</span><h3 className="text-white font-bold text-lg">{editingJobId ? 'Edit Slitting Job' : 'Create Slitting Job Card'}</h3></div>
                {editingJobId && <button onClick={() => { setEditingJobId(null); resetForm(); setActiveTab('view'); }} className="text-white/80 hover:text-white text-xs font-bold border border-white/30 px-3 py-1 rounded-md">Cancel Edit</button>}
             </div>
             <div className="p-6 space-y-5">
                <div className="grid grid-cols-2 gap-4">
                   <div><label className="text-[10px] font-bold text-slate-400 uppercase block mb-1.5">Date</label><input type="date" value={date} onChange={e => setDate(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-sm font-bold outline-none focus:border-indigo-500" /></div>
                   <div><label className="text-[10px] font-bold text-slate-400 uppercase block mb-1.5">Job No</label><input type="text" value={jobNo} onChange={e => setJobNo(e.target.value)} placeholder="e.g. 1005" className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-sm font-bold outline-none focus:border-indigo-500" /></div>
                </div>
                <div className="relative">
                    <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1.5">Select Party</label>
                    <input type="text" value={jobCode} onChange={e => { setJobCode(e.target.value); setShowPartyDropdown(true); }} onFocus={() => setShowPartyDropdown(true)} onBlur={() => setTimeout(() => setShowPartyDropdown(false), 200)} placeholder="Search..." className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-sm font-bold outline-none focus:border-indigo-500 shadow-sm" />
                    {showPartyDropdown && (
                        <div className="absolute z-10 w-full mt-1 bg-white border border-slate-200 rounded-lg shadow-xl max-h-48 overflow-y-auto">
                            {partySuggestions.map(p => (<div key={p.id} className="px-4 py-2 hover:bg-indigo-50 cursor-pointer text-sm border-b border-slate-50" onClick={() => { setJobCode(p.name); setShowPartyDropdown(false); }}><div className="font-bold text-slate-800">{p.name}</div></div>))}
                        </div>
                    )}
                </div>
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
                   <div className="flex justify-between items-center"><h4 className="text-xs font-bold text-slate-500 uppercase">Coil Plan</h4><button onClick={addCoil} className="text-[10px] font-bold text-indigo-600 bg-indigo-50 px-3 py-1.5 rounded-lg border border-indigo-100">+ Add Coil</button></div>
                   {coils.map((coil, idx) => (
                      <div key={coil.id} className="grid grid-cols-12 gap-3 items-end">
                          <div className="col-span-8"><label className="text-[9px] font-bold text-slate-400 uppercase">Size</label><input type="text" value={coil.size} onChange={e => updateCoil(idx, 'size', e.target.value)} placeholder="e.g. 100mm" className="w-full border border-slate-300 rounded-lg p-2 text-sm font-bold outline-none focus:border-indigo-500" /></div>
                          <div className="col-span-3"><label className="text-[9px] font-bold text-slate-400 uppercase">Rolls</label><input type="number" value={coil.rolls === 0 ? '' : coil.rolls} onChange={e => updateCoil(idx, 'rolls', e.target.value)} className="w-full border border-slate-300 rounded-lg p-2 text-sm font-bold text-center outline-none focus:border-indigo-500" /></div>
                          <div className="col-span-1 flex justify-center pb-2">{coils.length > 1 && <button onClick={() => removeCoil(idx)} className="text-red-400 hover:text-red-600 font-bold text-lg">×</button>}</div>
                      </div>
                   ))}
                </div>
                <div className="grid grid-cols-3 gap-4">
                   <div><label className="text-[10px] font-bold text-slate-400 uppercase block mb-1.5">Micron</label><input type="number" value={planMicron} onChange={e => setPlanMicron(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-sm font-bold text-center outline-none focus:border-indigo-500" /></div>
                   <div><label className="text-[10px] font-bold text-slate-400 uppercase block mb-1.5">Qty (kg)</label><input type="number" value={planQty} onChange={e => setPlanQty(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-sm font-bold text-center outline-none focus:border-indigo-500" /></div>
                   <div><label className="text-[10px] font-bold text-slate-400 uppercase block mb-1.5">Length (m)</label><input type="number" value={planRollLength} onChange={e => setPlanRollLength(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-sm font-bold text-center outline-none focus:border-indigo-500" /></div>
                </div>
                <button onClick={handleSave} className={`w-full text-white font-bold py-3.5 rounded-xl shadow-lg active:scale-[0.98] transform transition-all ${editingJobId ? 'bg-amber-600 hover:bg-amber-700' : 'bg-slate-900 hover:bg-black'}`}>
                   {editingJobId ? 'Update Job Card' : 'Create Job Card'}
                </button>
             </div>
          </div>
       )}

       {activeTab === 'view' && (
          <div className="space-y-4">
             {data.slittingJobs.map(job => {
                const isExpanded = expandedJobId === job.id;
                const totalNetWt = job.rows.reduce((s, r) => s + r.netWeight, 0);
                const markedCount = (selectedSlitRowsForShare[job.id] || []).length;
                return (
                   <div key={job.id} className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden hover:shadow-md transition-all">
                      <div onClick={() => setExpandedJobId(isExpanded ? null : job.id)} className="p-4 cursor-pointer hover:bg-slate-50/50">
                         <div className="flex justify-between items-center">
                            <div>
                               <div className="flex items-center gap-2 mb-1">
                                  <span className="text-[10px] font-bold bg-slate-100 text-slate-500 px-2 py-1 rounded border border-slate-200">{job.date}</span>
                                  <span className={`text-[10px] font-bold px-2 py-1 rounded border ${job.status === 'COMPLETED' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>{job.status}</span>
                               </div>
                               <h3 className="text-base font-bold text-slate-800">#{job.jobNo} | {job.jobCode}</h3>
                            </div>
                            <div className="text-right">
                               <div className="text-[10px] font-bold text-slate-400 uppercase">Output</div>
                               <div className="text-xl font-bold text-slate-800">{totalNetWt.toFixed(3)} kg</div>
                            </div>
                         </div>
                      </div>

                      {isExpanded && (
                         <div className="bg-slate-50/50 border-t border-slate-100 p-4 animate-in slide-in-from-top-2">
                            <div className="flex justify-between items-center mb-4">
                                <div className="flex gap-2">
                                   <button onClick={() => handleEdit(job)} className="text-indigo-600 text-xs font-bold border border-indigo-200 px-3 py-1.5 rounded-lg bg-white">✏️ Edit</button>
                                   <button onClick={() => handleDelete(job.id)} className="text-red-500 text-xs font-bold border border-red-200 px-3 py-1.5 rounded-lg bg-white">🗑️ Delete</button>
                                </div>
                                <div className="flex items-center gap-3">
                                   <button onClick={() => toggleAllRowsForShare(job)} className="text-xs font-bold text-indigo-600">Select All Items</button>
                                   <button onClick={() => shareSlittingJob(job)} className="bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-2">
                                       <Share2 size={14}/> {markedCount > 0 ? `Share Marked (${markedCount})` : 'Share All'}
                                   </button>
                                </div>
                            </div>
                            <div className="space-y-4">
                                {job.coils.map(coil => {
                                    const coilRows = job.rows.filter(r => r.coilId === coil.id).sort((a,b) => a.srNo - b.srNo);
                                    return (
                                        <div key={coil.id} className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
                                            <div className="bg-slate-50 px-4 py-2 border-b border-slate-200 flex justify-between items-center">
                                                <span className="font-bold text-slate-700 text-xs uppercase">{coil.size}</span>
                                                <span className="text-[10px] font-bold text-slate-400">Mark items below to share specifically</span>
                                            </div>
                                            <div className="overflow-x-auto">
                                                <table className="w-full text-xs text-left">
                                                    <thead className="bg-white text-slate-400 font-bold uppercase text-[9px] border-b border-slate-100">
                                                        <tr>
                                                            <th className="px-4 py-2 w-8 text-center">Mark</th>
                                                            <th className="px-4 py-2 w-12 text-center">Sr</th>
                                                            <th className="px-4 py-2 text-center">Meter</th>
                                                            <th className="px-4 py-2 text-right">Gross</th>
                                                            <th className="px-4 py-2 text-right text-indigo-600">Net Wt</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody className="divide-y divide-slate-50">
                                                        {coilRows.map(row => {
                                                            const isMarked = (selectedSlitRowsForShare[job.id] || []).includes(row.id);
                                                            return (
                                                                <tr key={row.id} className={`hover:bg-slate-50 transition-colors ${isMarked ? 'bg-indigo-50/40' : ''}`}>
                                                                    <td className="px-4 py-2 text-center">
                                                                        <button onClick={() => toggleRowSelectionForShare(job.id, row.id)} className={`transition-colors ${isMarked ? 'text-indigo-600' : 'text-slate-300'}`}>
                                                                            {isMarked ? <CheckSquare size={16} /> : <Square size={16} />}
                                                                        </button>
                                                                    </td>
                                                                    <td className="px-4 py-2 text-center font-mono text-[10px]">{row.srNo}</td>
                                                                    <td className="px-4 py-2 text-center font-bold text-slate-600">{row.meter}</td>
                                                                    <td className="px-4 py-2 text-right text-slate-500">{row.grossWeight.toFixed(3)}</td>
                                                                    <td className="px-4 py-2 text-right font-bold text-emerald-600">{row.netWeight.toFixed(3)}</td>
                                                                </tr>
                                                            );
                                                        })}
                                                    </tbody>
                                                </table>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                         </div>
                      )}
                   </div>
                );
             })}
          </div>
       )}
    </div>
  );
};
