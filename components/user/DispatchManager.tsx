
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { AppData, DispatchEntry, DispatchStatus, DispatchRow, ProductionPlan } from '../../types';
import { saveDispatch, deleteDispatch, ensurePartyExists, updateProductionPlan } from '../../services/storageService';
import { Layers, CircleArrowRight, CircleCheck, BellRing, GitMerge, Share2, CheckSquare, Square, Trash2, Edit, FileInput, Plus, Minus, List, Calculator, Scale, ArrowRightLeft, X } from 'lucide-react';

interface Props {
  data: AppData;
  onUpdate: (newData: AppData) => void;
}

const SIZE_TYPES = ["", "INTAS", "OPEN", "ROUND", "ST.SEAL", "LABEL", "ROLL", "WINDER", "PRINTING", "PLAIN"];

export const DispatchManager: React.FC<Props> = ({ data, onUpdate }) => {
  // --- STATE MANAGEMENT ---
  const [activeDispatch, setActiveDispatch] = useState<Partial<DispatchEntry>>({
    date: new Date().toISOString().split('T')[0],
    dispatchNo: '',
    rows: [],
    status: DispatchStatus.PENDING,
    isTodayDispatch: false
  });
  
  const [partyInput, setPartyInput] = useState('');
  const [showPartyDropdown, setShowPartyDropdown] = useState(false);
  const [isEditingId, setIsEditingId] = useState<string | null>(null);

  // Row Entry State
  const [rowSize, setRowSize] = useState('');
  const [rowType, setRowType] = useState('');
  const [rowMicron, setRowMicron] = useState('');
  const [rowWeight, setRowWeight] = useState('');
  const [rowPcs, setRowPcs] = useState('');
  const [rowBundle, setRowBundle] = useState('');
  const [rowPlanId, setRowPlanId] = useState<string | null>(null);

  // List View State
  const [searchJob, setSearchJob] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [selectedJobIds, setSelectedJobIds] = useState<string[]>([]);
  
  // Selection for WhatsApp Share (Line items)
  const [selectedRowsForShare, setSelectedRowsForShare] = useState<Record<string, string[]>>({});
  
  // Notification State
  const [newPlanNotification, setNewPlanNotification] = useState(false);
  const prevPlanCountRef = useRef<number | null>(null);

  // --- DERIVED LIVE TOTALS ---
  const currentFormTotals = useMemo(() => {
      const rows = activeDispatch.rows || [];
      return {
          weight: rows.reduce((s, r) => s + (Number(r.weight) || 0), 0),
          pcs: rows.reduce((s, r) => s + (Number(r.pcs) || 0), 0),
          bundles: rows.reduce((s, r) => s + (Number(r.bundle) || 0), 0)
      };
  }, [activeDispatch.rows]);

  // --- EFFECTS ---

  // Auto-generate Dispatch Number if not editing
  useEffect(() => {
    if (!isEditingId && !activeDispatch.dispatchNo) {
        const maxNo = data.dispatches.reduce((max, d) => {
            const num = parseInt(d.dispatchNo);
            return !isNaN(num) && num > max ? num : max;
        }, 0);
        const nextNo = maxNo === 0 ? '1001' : (maxNo + 1).toString();
        setActiveDispatch(prev => ({ ...prev, dispatchNo: nextNo }));
    }
  }, [data.dispatches, isEditingId]);

  // Notification Logic for New Plans
  useEffect(() => {
      const pendingCount = data.productionPlans.filter(p => p.status === 'PENDING').length;
      if (prevPlanCountRef.current === null) {
          prevPlanCountRef.current = pendingCount;
          return;
      }
      if (pendingCount > prevPlanCountRef.current) {
          setNewPlanNotification(true);
          const timer = setTimeout(() => setNewPlanNotification(false), 4000);
          return () => clearTimeout(timer);
      }
      prevPlanCountRef.current = pendingCount;
  }, [data.productionPlans]);

  // --- HELPERS ---

  const partySuggestions = data.parties.filter(p => {
    const search = partyInput.toLowerCase();
    return p.name.toLowerCase().includes(search) || (p.code && p.code.toLowerCase().includes(search));
  });

  const pendingPlans = useMemo(() => 
    data.productionPlans
        .filter(p => p.status === 'PENDING')
        .sort((a,b) => new Date(a.createdAt).getTime() - new Date(a.createdAt).getTime()), 
  [data.productionPlans]);

  const plansByParty = useMemo(() => {
      const groups: Record<string, ProductionPlan[]> = {};
      pendingPlans.forEach(p => {
          if (!groups[p.partyName]) groups[p.partyName] = [];
          groups[p.partyName].push(p);
      });
      return groups;
  }, [pendingPlans]);

  const filteredDispatches = useMemo(() => {
      const search = searchJob.toLowerCase();
      return data.dispatches.filter(d => {
          const p = data.parties.find(p => p.id === d.partyId);
          const pName = p ? p.name.toLowerCase() : '';
          const pCode = p?.code ? p.code.toLowerCase() : '';
          return d.dispatchNo.includes(search) || pName.includes(search) || pCode.includes(search) || d.rows.some(r => r.size.toLowerCase().includes(search));
      }).sort((a, b) => {
          // 1. Mark Today strictly on TOP
          const aToday = a.isTodayDispatch === true;
          const bToday = b.isTodayDispatch === true;
          if (aToday && !bToday) return -1;
          if (!aToday && bToday) return 1;

          // 2. Status Priority
          const getStatusPriority = (s: string) => {
              if (s === DispatchStatus.PENDING) return 1;
              if (['PRINTING', 'SLITTING', 'CUTTING', 'LOADING'].includes(s)) return 2;
              if (s === DispatchStatus.COMPLETED) return 3;
              if (s === DispatchStatus.DISPATCHED) return 4;
              return 5;
          };
          
          const pA = getStatusPriority(a.status);
          const pB = getStatusPriority(b.status);
          if (pA !== pB) return pA - pB;

          // 3. Fallback to updated time
          return new Date(b.updatedAt || b.createdAt).getTime() - new Date(a.updatedAt || a.createdAt).getTime();
      });
  }, [data.dispatches, data.parties, searchJob]);

  // --- ACTIONS ---

  const mapPlanType = (type: string) => {
      const upperType = type.toUpperCase();
      return SIZE_TYPES.find(t => t === upperType) || 
             (type === 'St. Seal' ? 'ST.SEAL' : 
              type === 'Printing' ? 'PRINTING' : 
              type === 'Intas' ? 'INTAS' : 
              type === 'Round' ? 'ROUND' : 
              type === 'Open' ? 'OPEN' : 
              type === 'Roll' ? 'ROLL' : 
              type === 'Winder' ? 'WINDER' : '');
  };

  const handleImportPlan = (plan: ProductionPlan) => {
    setPartyInput(plan.partyName);
    setActiveDispatch(prev => ({ ...prev, date: plan.date, isTodayDispatch: true }));
    
    // Size Logic: Size x Cutting Size
    let displaySize = plan.cuttingSize > 0 ? `${plan.size} x ${plan.cuttingSize}` : plan.size;
    if (plan.printName) displaySize = `${displaySize} (${plan.printName})`;
    
    setRowSize(displaySize);
    setRowType(mapPlanType(plan.type));
    setRowMicron(plan.micron ? plan.micron.toString() : '');
    
    // DO NOT fill weight/pcs/bundle - User Request
    setRowWeight(''); 
    setRowPcs('');
    setRowBundle('');
    
    setRowPlanId(plan.id);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleMergePlans = (plans: ProductionPlan[]) => {
      if (plans.length === 0) return;
      const first = plans[0];
      setPartyInput(first.partyName);
      setActiveDispatch(prev => ({ ...prev, date: first.date, isTodayDispatch: true }));

      const newRows: DispatchRow[] = plans.map(plan => {
          let displaySize = plan.cuttingSize > 0 ? `${plan.size} x ${plan.cuttingSize}` : plan.size;
          if (plan.printName) displaySize = `${displaySize} (${plan.printName})`;
          return {
              id: `r-${Date.now()}-${Math.random()}`,
              planId: plan.id,
              size: displaySize,
              sizeType: mapPlanType(plan.type),
              micron: plan.micron || 0,
              weight: 0, 
              productionWeight: 0,
              wastage: 0,
              pcs: 0, 
              bundle: 0,
              status: DispatchStatus.PENDING,
              isCompleted: false,
              isLoaded: false
          };
      });
      setActiveDispatch(prev => ({
          ...prev,
          rows: [...(prev.rows || []), ...newRows]
      }));
      window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleMergeExistingJobs = () => {
    if (selectedJobIds.length < 2) return;
    const selectedJobs = data.dispatches.filter(d => selectedJobIds.includes(d.id));
    
    const parties = new Set(selectedJobs.map(j => j.partyId));
    if (parties.size > 1 && !confirm("Warning: Selected jobs belong to different parties. Merge anyway?")) return;

    const firstJob = selectedJobs[0];
    const p = data.parties.find(pt => pt.id === firstJob.partyId);
    setPartyInput(p ? p.name : '');

    const combinedRows: DispatchRow[] = selectedJobs.flatMap(j => 
        j.rows.map(r => ({
            ...r,
            id: `r-merge-${Date.now()}-${Math.random()}`,
            planId: undefined, 
            status: DispatchStatus.PENDING,
            isCompleted: false,
            isLoaded: false
        }))
    );

    setActiveDispatch({
        date: new Date().toISOString().split('T')[0],
        dispatchNo: '',
        rows: combinedRows,
        status: DispatchStatus.PENDING,
        isTodayDispatch: true
    });
    
    setIsEditingId(null);
    setSelectedJobIds([]);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const addRow = () => {
      if (!rowSize) return alert("Size is required");
      const newRow: DispatchRow = {
          id: `r-${Date.now()}-${Math.random()}`,
          planId: rowPlanId || undefined,
          size: rowSize,
          sizeType: rowType,
          micron: parseFloat(rowMicron) || 0,
          weight: parseFloat(rowWeight) || 0,
          productionWeight: 0, 
          wastage: 0,
          pcs: parseFloat(rowPcs) || 0,
          bundle: parseFloat(rowBundle) || 0,
          status: DispatchStatus.PENDING,
          isCompleted: false,
          isLoaded: false
      };
      setActiveDispatch(prev => ({
          ...prev,
          rows: [newRow, ...(prev.rows || [])]
      }));
      setRowSize(''); setRowType(''); setRowMicron(''); setRowWeight(''); setRowPcs(''); setRowBundle('');
      setRowPlanId(null);
  };

  const resetForm = () => {
      setPartyInput('');
      setActiveDispatch({
          date: new Date().toISOString().split('T')[0],
          dispatchNo: '',
          rows: [],
          status: DispatchStatus.PENDING,
          isTodayDispatch: false
      });
      setIsEditingId(null);
      setRowPlanId(null);
  };

  const handleSave = async () => {
      if (!partyInput) return alert("Party Name Required");
      if (!activeDispatch.rows || activeDispatch.rows.length === 0) return alert("Add at least one item");
      
      const partyId = await ensurePartyExists(data.parties, partyInput);
      
      const totalWeight = activeDispatch.rows.reduce((sum, r) => sum + (Number(r.weight) || 0), 0);
      const totalPcs = activeDispatch.rows.reduce((sum, r) => sum + (Number(r.pcs) || 0), 0);
      
      const dispatch: DispatchEntry = {
          id: activeDispatch.id || `d-${Date.now()}`,
          dispatchNo: activeDispatch.dispatchNo || 'AUTO',
          date: activeDispatch.date!,
          partyId,
          status: activeDispatch.status || DispatchStatus.PENDING,
          rows: activeDispatch.rows,
          totalWeight,
          totalPcs,
          isTodayDispatch: activeDispatch.isTodayDispatch || false,
          createdAt: activeDispatch.createdAt || new Date().toISOString(),
          updatedAt: new Date().toISOString()
      };
      
      await saveDispatch(dispatch);
      
      for (const row of dispatch.rows) {
          if (row.planId) {
              await updateProductionPlan({ id: row.planId, status: 'COMPLETED' });
          }
      }
      resetForm();
  };

  const handleEdit = (d: DispatchEntry) => {
      const p = data.parties.find(p => p.id === d.partyId);
      setPartyInput(p ? p.name : '');
      setActiveDispatch({ ...d });
      setIsEditingId(d.id);
      window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleRepeatOrder = (d: DispatchEntry) => {
      const p = data.parties.find(p => p.id === d.partyId);
      setPartyInput(p ? p.name : '');
      const clonedRows = d.rows.map(r => ({ 
          ...r, 
          id: `r-${Date.now()}-${Math.random()}`, 
          planId: undefined, 
          status: DispatchStatus.PENDING,
          productionWeight: 0, 
          weight: 0,
          wastage: 0
      }));
      setActiveDispatch({
          date: new Date().toISOString().split('T')[0],
          dispatchNo: '', 
          rows: clonedRows,
          status: DispatchStatus.PENDING,
          isTodayDispatch: true
      });
      setIsEditingId(null);
      window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const toggleJobSelection = (id: string) => {
      setSelectedJobIds(prev => 
          prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
      );
  };

  const toggleToday = async (e: React.MouseEvent, d: DispatchEntry) => {
      e.stopPropagation();
      await saveDispatch({ ...d, isTodayDispatch: !d.isTodayDispatch, updatedAt: new Date().toISOString() });
  };

  const updateDispatchWithRecalculatedTotals = (dispatch: Partial<DispatchEntry>, updatedRows: DispatchRow[]): Partial<DispatchEntry> => {
    const totalWeight = updatedRows.reduce((s, r) => s + (Number(r.weight) || 0), 0);
    const totalPcs = updatedRows.reduce((s, r) => s + (Number(r.pcs) || 0), 0);
    return { ...dispatch, rows: updatedRows, totalWeight, totalPcs, updatedAt: new Date().toISOString() };
  };

  const handleRowUpdate = async (d: Partial<DispatchEntry>, rowId: string, field: keyof DispatchRow, value: any) => {
      const newRows = (d.rows || []).map(r => {
          if (r.id === rowId) {
              const updatedRow = { ...r, [field]: value };
              if (field === 'productionWeight' || field === 'weight') {
                  const pWt = field === 'productionWeight' ? (parseFloat(value) || 0) : (r.productionWeight || 0);
                  const dWt = field === 'weight' ? (parseFloat(value) || 0) : (r.weight || 0);
                  updatedRow.wastage = pWt - dWt;
              }
              return updatedRow;
          }
          return r;
      });
      
      const updated = updateDispatchWithRecalculatedTotals(d, newRows);
      if (d.id) {
          await saveDispatch(updated as DispatchEntry);
      } else {
          setActiveDispatch(updated);
      }
  };

  const toggleRowSelectionForShare = (dispatchId: string, rowId: string) => {
      setSelectedRowsForShare(prev => {
          const current = prev[dispatchId] || [];
          const updated = current.includes(rowId) ? current.filter(id => id !== rowId) : [...current, rowId];
          return { ...prev, [dispatchId]: updated };
      });
  };

  const toggleAllRowsForShare = (d: DispatchEntry) => {
      const current = selectedRowsForShare[d.id] || [];
      if (current.length === d.rows.length) {
          setSelectedRowsForShare(prev => ({ ...prev, [d.id]: [] }));
      } else {
          setSelectedRowsForShare(prev => ({ ...prev, [d.id]: d.rows.map(r => r.id) }));
      }
  };

  const shareJobImage = async (d: DispatchEntry) => {
      const party = data.parties.find(p => p.id === d.partyId)?.name || 'Unknown';
      const markedIds = selectedRowsForShare[d.id] || [];
      const rowsToShare = markedIds.length > 0 ? d.rows.filter(r => markedIds.includes(r.id)) : d.rows;

      const totalBundles = rowsToShare.reduce((acc, r) => acc + (Number(r.bundle) || 0), 0);
      const totalWeight = rowsToShare.reduce((acc, r) => acc + (Number(r.weight) || 0), 0);
      const totalPcs = rowsToShare.reduce((acc, r) => acc + (Number(r.pcs) || 0), 0);
      
      const containerId = 'share-job-gen-user';
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

      const rowsHtml = rowsToShare.map((r, i) => `
        <tr style="background-color: ${i % 2 === 0 ? '#ffffff' : '#f0f9ff'}; border-bottom: 2px solid #e0f2fe;">
            <td style="padding: 16px 12px; font-size: 22px; font-weight: bold; color: #0c4a6e;">${r.size}</td>
            <td style="padding: 16px 12px; font-size: 20px; color: #0284c7; text-align: center; font-weight: bold;">${r.sizeType || '-'}</td>
            <td style="padding: 16px 12px; font-size: 20px; color: #64748b; text-align: center; font-weight: bold;">${r.micron || '-'}</td>
            <td style="padding: 16px 12px; font-size: 22px; font-weight: bold; color: #0c4a6e; text-align: right;">${r.weight > 0 ? r.weight.toFixed(3) : '-'}</td>
            <td style="padding: 16px 12px; font-size: 22px; font-weight: bold; color: #0c4a6e; text-align: right;">${r.pcs || '-'}</td>
            <td style="padding: 16px 12px; font-size: 22px; font-weight: bold; color: #0c4a6e; text-align: right;">${r.bundle || '-'}</td>
        </tr>
      `).join('');

      container.innerHTML = `
        <div style="font-family: 'Inter', sans-serif; border: 4px solid #0c4a6e; background: #fff;">
            <div style="background: linear-gradient(135deg, #0c4a6e 0%, #0284c7 100%); padding: 32px; color: white;">
                <div style="font-size: 18px; text-transform: uppercase; letter-spacing: 3px; color: #bae6fd; font-weight: bold;">Job Card ${markedIds.length > 0 ? '(Partial)' : ''}</div>
                <div style="font-size: 40px; font-weight: bold; margin-top: 8px; line-height: 1.1;">${party}</div>
                <div style="margin-top: 24px; display: flex; justify-content: space-between; align-items: center; border-top: 1px solid #7dd3fc; padding-top: 20px;">
                    <span style="font-size: 28px; background: rgba(255,255,255,0.2); padding: 8px 20px; rounded: 10px; font-weight: bold; border: 1px solid #7dd3fc;">#${d.dispatchNo}</span>
                    <span style="font-size: 24px; color: #e0f2fe; font-weight: bold;">${d.date.split('-').reverse().join('/')}</span>
                </div>
            </div>
            <table style="width: 100%; border-collapse: collapse;">
                <thead>
                    <tr style="background: #e0f2fe; color: #0c4a6e; font-size: 18px; text-transform: uppercase; border-bottom: 3px solid #0284c7;">
                        <th style="padding: 16px 12px; text-align: left;">Size</th>
                        <th style="padding: 16px 12px; text-align: center;">Type</th>
                        <th style="padding: 16px 12px; text-align: center;">Mic</th>
                        <th style="padding: 16px 12px; text-align: right;">Weight</th>
                        <th style="padding: 16px 12px; text-align: right;">Pcs</th>
                        <th style="padding: 16px 12px; text-align: right;">Box</th>
                    </tr>
                </thead>
                <tbody>${rowsHtml}</tbody>
                <tfoot>
                    <tr style="background: #0c4a6e; color: white; font-weight: bold;">
                        <td colspan="3" style="padding: 24px 12px; font-size: 24px;">TOTAL</td>
                        <td style="padding: 24px 12px; text-align: right; font-size: 28px;">${totalWeight.toFixed(3)}</td>
                        <td style="padding: 24px 12px; text-align: right; font-size: 28px;">${totalPcs}</td>
                        <td style="padding: 24px 12px; text-align: right; font-size: 28px;">${totalBundles}</td>
                    </tr>
                </tfoot>
            </table>
        </div>
      `;

      try {
          if (!(window as any).html2canvas) throw new Error("Library not loaded");
          const canvas = await (window as any).html2canvas(container, { scale: 2, backgroundColor: null });
          canvas.toBlob(async (blob: Blob) => {
              if (blob) {
                  const file = new File([blob], `Job_${d.dispatchNo}.png`, { type: 'image/png' });
                  if (navigator.canShare && navigator.canShare({ files: [file] })) {
                      try {
                          await navigator.share({ files: [file], title: `Job ${d.dispatchNo}`, text: `Job Card for ${party}` });
                      } catch (e) { console.log("Share dismissed", e); }
                  } else {
                      const link = document.createElement('a');
                      link.href = URL.createObjectURL(blob);
                      link.download = `Job_${d.dispatchNo}.png`;
                      link.click();
                      alert("Image downloaded. You can share it manually on WhatsApp.");
                  }
              }
              if (document.body.contains(container!)) document.body.removeChild(container!);
          }, 'image/png');
      } catch (err) {
          console.error(err);
          alert("Failed to generate image.");
          if (document.body.contains(container!)) document.body.removeChild(container!);
      }
  };

  const handleMasterStatusChange = async (job: DispatchEntry, newStatus: DispatchStatus) => {
      await saveDispatch({ ...job, status: newStatus, updatedAt: new Date().toISOString() });
  };

  return (
    <div className="relative space-y-8 animate-in fade-in duration-500 pb-20">
        
        {/* --- FLOATING MERGE ACTION --- */}
        {selectedJobIds.length >= 2 && (
            <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-[60] animate-in slide-in-from-bottom-10 duration-500">
                <button 
                    onClick={handleMergeExistingJobs}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white font-black uppercase tracking-[0.1em] px-8 py-4 rounded-full flex items-center gap-3 shadow-[0_20px_50px_rgba(79,70,229,0.3)] ring-4 ring-indigo-100 transition-all active:scale-95"
                >
                    <GitMerge size={20} /> Merge Selected Jobs ({selectedJobIds.length})
                </button>
            </div>
        )}

        {/* --- NOTIFICATION --- */}
        {newPlanNotification && (
            <div className="fixed top-20 right-4 z-50 bg-indigo-600 text-white px-6 py-3 rounded-lg shadow-2xl flex items-center gap-3 animate-in slide-in-from-right duration-300">
                <BellRing size={20} className="animate-pulse" />
                <div>
                    <div className="font-bold text-sm">New Production Plan!</div>
                    <div className="text-xs opacity-90">Admin just added a job.</div>
                </div>
            </div>
        )}

        {/* --- PENDING PLANS SECTION --- */}
        {pendingPlans.length > 0 && !isEditingId && (
            <div className="bg-gradient-to-r from-slate-50 to-indigo-50/30 rounded-2xl p-4 border border-indigo-100 shadow-inner">
                <h3 className="text-xs font-bold text-indigo-800 uppercase tracking-wider mb-3 flex items-center gap-2">
                    <Layers size={14} /> Production Queue (Tap to Create Job)
                </h3>
                <div className="flex gap-3 overflow-x-auto custom-scrollbar pb-2">
                    {pendingPlans.map(plan => {
                        const samePartyPlans = plansByParty[plan.partyName] || [];
                        const hasMergeOptions = samePartyPlans.length > 1;
                        return (
                            <div key={plan.id} className="min-w-[240px] bg-white border border-slate-200 rounded-xl p-3 hover:border-indigo-400 hover:shadow-md transition-all flex flex-col gap-2">
                                <div onClick={() => handleImportPlan(plan)} className="cursor-pointer">
                                    <div className="flex justify-between items-start mb-1">
                                        <span className="text-[9px] font-bold text-slate-400 font-mono bg-slate-50 px-1.5 py-0.5 rounded">{plan.date.split('-').reverse().join('/')}</span>
                                        <span className="text-[9px] font-bold bg-indigo-50 text-indigo-600 px-1.5 py-0.5 rounded border border-indigo-100 uppercase">{plan.type}</span>
                                    </div>
                                    <div className="font-bold text-slate-800 text-xs line-clamp-1">{plan.partyName}</div>
                                    <div className="bg-slate-50 rounded p-1.5 border border-slate-100 space-y-1">
                                        <div className="flex justify-between text-[10px]"><span className="text-slate-500">Size:</span><span className="font-bold text-slate-700">{plan.cuttingSize > 0 ? `${plan.size}x${plan.cuttingSize}` : plan.size}</span></div>
                                        <div className="flex justify-between text-[10px]"><span className="text-slate-500">Micron:</span><span className="font-bold text-slate-700">{plan.micron}</span></div>
                                    </div>
                                    <div className="grid grid-cols-3 gap-1 text-center mt-1">
                                        <div className="bg-indigo-50/50 rounded p-1 border border-indigo-50"><div className="text-[8px] text-indigo-400 uppercase font-bold">Wt</div><div className="text-[10px] font-bold">{plan.weight}</div></div>
                                        <div className="bg-blue-50/50 rounded p-1 border border-blue-50"><div className="text-[8px] text-blue-400 uppercase font-bold">Mtr</div><div className="text-[10px] font-bold">{plan.meter}</div></div>
                                        <div className="bg-emerald-50/50 rounded p-1 border border-emerald-50"><div className="text-[8px] text-emerald-400 uppercase font-bold">Pcs</div><div className="text-[10px] font-bold">{plan.pcs}</div></div>
                                    </div>
                                </div>
                                {hasMergeOptions && (
                                    <button onClick={() => handleMergePlans(samePartyPlans)} className="mt-1 w-full bg-indigo-600 hover:bg-indigo-700 text-white text-[10px] font-bold py-1.5 rounded-lg flex items-center justify-center gap-1">
                                        <GitMerge size={12} /> Merge All ({samePartyPlans.length})
                                    </button>
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>
        )}

        {/* --- FORM SECTION --- */}
        <div className={`bg-white rounded-2xl shadow-sm border ${isEditingId ? 'border-indigo-300 ring-2 ring-indigo-100' : 'border-slate-200'} overflow-hidden transition-all`}>
            <div className={`px-6 py-4 flex justify-between items-center ${isEditingId ? 'bg-indigo-600' : 'bg-slate-800'}`}>
                <h3 className="text-base font-bold text-white tracking-wide flex items-center gap-2">
                    {isEditingId ? <span className="animate-pulse">✏️ Edit Job</span> : <span>🚚 New Job Entry</span>}
                </h3>
                <div className="flex items-center gap-4">
                    <div className="text-right">
                        <div className="text-[9px] font-black text-white/50 uppercase">Form Total</div>
                        <div className="text-xs font-black text-white">{currentFormTotals.weight.toFixed(3)} kg</div>
                    </div>
                    <div className="h-6 w-px bg-white/20"></div>
                    <div className="text-xs font-bold text-white/80">{activeDispatch.rows?.length} Items</div>
                </div>
            </div>
            
            <div className="p-6 space-y-5">
                <div className="flex gap-4">
                    <div className="w-28">
                        <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Job #</label>
                        <input value={activeDispatch.dispatchNo} onChange={e => setActiveDispatch({...activeDispatch, dispatchNo: e.target.value})} className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm font-bold text-center outline-none focus:border-indigo-500" placeholder="Auto" />
                    </div>
                    <div className="flex-1">
                        <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Date</label>
                        <input type="date" value={activeDispatch.date} onChange={e => setActiveDispatch({...activeDispatch, date: e.target.value})} className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm font-bold outline-none focus:border-indigo-500" />
                    </div>
                </div>

                <div className="relative">
                    <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Party Name</label>
                    <div className="relative">
                        <input type="text" value={partyInput} onChange={e => { setPartyInput(e.target.value); setShowPartyDropdown(true); }} onFocus={() => setShowPartyDropdown(true)} onBlur={() => setTimeout(() => setShowPartyDropdown(false), 200)} className="w-full bg-slate-50 border border-slate-200 rounded-lg px-4 py-2.5 text-sm font-bold outline-none focus:border-indigo-500" placeholder="Search Party..." />
                        {partyInput && (
                            <button onClick={() => setPartyInput('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400"><X size={14}/></button>
                        )}
                    </div>
                    {showPartyDropdown && partyInput && (
                        <div className="absolute z-[100] w-full mt-1 bg-white border border-slate-200 rounded-lg shadow-xl max-h-48 overflow-y-auto p-1">
                            {partySuggestions.map(p => (
                                <div key={p.id} className="px-4 py-2 hover:bg-slate-50 cursor-pointer text-sm font-bold border-b border-slate-50 last:border-0" onClick={() => { setPartyInput(p.name); setShowPartyDropdown(false); }}>
                                    {p.name} <span className="text-[10px] text-slate-400 ml-2">{p.code}</span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 shadow-inner">
                    <div className="grid grid-cols-12 gap-3 mb-3 items-end">
                        <div className="col-span-12 md:col-span-4">
                            <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Size / Item</label>
                            <input value={rowSize} onChange={e => setRowSize(e.target.value)} className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm font-bold outline-none" />
                        </div>
                        <div className="col-span-6 md:col-span-2">
                             <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Type</label>
                             <select value={rowType} onChange={e => setRowType(e.target.value)} className="w-full bg-white border border-slate-200 rounded-lg px-2 py-2 text-xs font-bold">
                                 {SIZE_TYPES.map(t => <option key={t} value={t}>{t || '-'}</option>)}
                             </select>
                        </div>
                        <div className="col-span-6 md:col-span-2">
                            <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Mic</label>
                            <input type="number" value={rowMicron} onChange={e => setRowMicron(e.target.value)} className="w-full bg-white border border-slate-200 rounded-lg px-2 py-2 text-sm font-bold text-center" />
                        </div>
                        <div className="col-span-4 md:col-span-2">
                            <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Wt</label>
                            <input type="number" value={rowWeight} onChange={e => setRowWeight(e.target.value)} className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm font-bold text-center" />
                        </div>
                        <div className="col-span-4 md:col-span-1">
                            <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Pcs</label>
                            <input type="number" value={rowPcs} onChange={e => setRowPcs(e.target.value)} className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm font-bold text-center" />
                        </div>
                        <div className="col-span-4 md:col-span-1">
                            <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Box</label>
                            <input type="number" value={rowBundle} onChange={e => setRowBundle(e.target.value)} className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm font-bold text-center" />
                        </div>
                    </div>
                    <button onClick={addRow} className="w-full bg-white border border-slate-300 text-slate-600 rounded-lg py-2.5 text-xs font-bold shadow-sm flex items-center justify-center gap-1 transition-all active:scale-95 hover:bg-slate-50">+ Add Line Item</button>
                </div>

                {/* Form Line Items */}
                <div className="space-y-4">
                  {(activeDispatch.rows || []).map((row, idx) => {
                    return (
                        <div key={row.id} className="bg-slate-50 border border-slate-200 rounded-xl p-4 shadow-sm relative overflow-hidden">
                            <div className="flex justify-between items-center mb-3">
                            <div className="flex items-center gap-2">
                                <span className="text-[10px] font-black text-indigo-600 bg-indigo-50 px-2 py-1 rounded border border-indigo-100 uppercase tracking-tighter">Item #{idx+1}</span>
                                <h4 className="text-sm font-black text-slate-800">{row.size} <span className="text-[10px] text-slate-400 ml-1">({row.sizeType})</span></h4>
                            </div>
                            <button onClick={() => {
                                const newRows = [...(activeDispatch.rows || [])];
                                newRows.splice(idx, 1);
                                setActiveDispatch({...activeDispatch, rows: newRows});
                            }} className="text-red-400 hover:text-red-600"><Trash2 size={16}/></button>
                            </div>
                            <div className="grid grid-cols-4 gap-2">
                                <div className="text-center bg-white border border-slate-100 rounded p-1.5 shadow-sm relative group">
                                    <span className="text-[8px] font-black text-slate-400 uppercase block">Total Wt</span>
                                    <input type="number" value={row.weight || ''} onChange={e => handleRowUpdate(activeDispatch, row.id, 'weight', parseFloat(e.target.value) || 0)} className="w-full text-center bg-transparent text-xs font-bold outline-none" placeholder="0.000" />
                                </div>
                                <div className="text-center bg-white border border-slate-100 rounded p-1.5 shadow-sm">
                                    <span className="text-[8px] font-black text-slate-400 uppercase block">Total Pcs</span>
                                    <input type="number" value={row.pcs || ''} onChange={e => handleRowUpdate(activeDispatch, row.id, 'pcs', parseFloat(e.target.value) || 0)} className="w-full text-center bg-transparent text-xs font-bold outline-none" placeholder="0" />
                                </div>
                                <div className="text-center bg-white border border-slate-100 rounded p-1.5 shadow-sm">
                                    <span className="text-[8px] font-black text-slate-400 uppercase block">Micron</span>
                                    <input type="number" value={row.micron || ''} onChange={e => handleRowUpdate(activeDispatch, row.id, 'micron', parseFloat(e.target.value) || 0)} className="w-full text-center bg-transparent text-xs font-bold outline-none" placeholder="0" />
                                </div>
                                <div className="text-center bg-white border border-slate-100 rounded p-1.5 shadow-sm">
                                    <span className="text-[8px] font-black text-slate-400 uppercase block">Box</span>
                                    <input type="number" value={row.bundle || ''} onChange={e => handleRowUpdate(activeDispatch, row.id, 'bundle', parseFloat(e.target.value) || 0)} className="w-full text-center bg-transparent text-xs font-bold outline-none" placeholder="0" />
                                </div>
                            </div>
                        </div>
                    );
                  })}
                </div>

                <div className="flex gap-2 pt-2 border-t border-slate-100">
                    {isEditingId && <button onClick={resetForm} className="flex-1 bg-slate-100 text-slate-600 font-bold py-3 rounded-xl text-sm transition-colors">Cancel</button>}
                    <button onClick={handleSave} className={`flex-[2] text-white font-bold py-3 rounded-xl text-sm shadow-lg active:scale-[0.98] transition-all ${isEditingId ? 'bg-indigo-600 hover:bg-indigo-700' : 'bg-slate-900 hover:bg-black'}`}>
                        {isEditingId ? 'Update Job' : 'Save Job Card'}
                    </button>
                </div>
            </div>
        </div>

        {/* --- LIST SECTION --- */}
        <div className="space-y-4">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
                <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">📋 Recent Jobs</h3>
                <input placeholder="Search Job..." value={searchJob} onChange={e => setSearchJob(e.target.value)} className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs font-bold outline-none w-full sm:w-48 focus:ring-2 focus:ring-indigo-100" />
            </div>

            <div className="space-y-3">
                {filteredDispatches.map(d => {
                    const p = data.parties.find(p => p.id === d.partyId);
                    const partyName = p ? (p.code ? `${p.name} [${p.code}]` : p.name) : 'Unknown';
                    const isExpanded = expandedId === d.id;
                    const isSelected = selectedJobIds.includes(d.id);

                    let statusBadge = 'bg-slate-100 text-slate-500 border-slate-200';
                    let statusStripe = 'bg-slate-300';
                    if (d.status === DispatchStatus.SLITTING) { statusBadge = 'bg-amber-50 text-amber-700 border-amber-200'; statusStripe = 'bg-amber-500'; }
                    else if (d.status === DispatchStatus.COMPLETED) { statusBadge = 'bg-emerald-50 text-emerald-700 border-emerald-200'; statusStripe = 'bg-emerald-500'; }
                    else if (d.status === DispatchStatus.DISPATCHED) { statusBadge = 'bg-purple-50 text-purple-600 border-purple-200'; statusStripe = 'bg-purple-500'; }
                    else if (d.status === DispatchStatus.PRINTING) { statusBadge = 'bg-indigo-50 text-indigo-700 border-indigo-200'; statusStripe = 'bg-indigo-600'; }
                    else if (d.status === DispatchStatus.CUTTING) { statusBadge = 'bg-blue-50 text-blue-700 border-blue-200'; statusStripe = 'bg-blue-600'; }

                    const isToday = d.isTodayDispatch === true;

                    return (
                        <div key={d.id} className={`relative rounded-xl border bg-white overflow-hidden transition-all shadow-sm ${isSelected ? 'ring-2 ring-indigo-500' : 'border-slate-200'} ${isToday ? 'border-indigo-400 ring-1 ring-indigo-100 scale-[1.01]' : ''}`}>
                           <div className={`absolute top-0 left-0 w-1.5 h-full ${statusStripe}`}></div>
                           <div onClick={() => setExpandedId(isExpanded ? null : d.id)} className="p-4 pl-5 cursor-pointer relative">
                                {isToday && <div className="absolute top-2 right-12 bg-indigo-100 text-indigo-700 text-[9px] font-black px-2 py-0.5 rounded border border-indigo-200 uppercase tracking-wide z-10 shadow-sm">Today</div>}
                                <div className="absolute top-3 right-3">
                                    <button 
                                        onClick={(e) => { e.stopPropagation(); toggleJobSelection(d.id); }} 
                                        className={`p-1.5 rounded-lg border-2 transition-all ${isSelected ? 'bg-indigo-600 border-indigo-600 text-white shadow-md' : 'bg-slate-50 border-slate-200 text-slate-300'}`}
                                    >
                                        {isSelected ? <CheckSquare size={16}/> : <Square size={16}/>}
                                    </button>
                                </div>
                                <div className="flex flex-col gap-2 pr-12">
                                    <div className="flex items-center gap-2 text-[10px] font-bold text-slate-400 uppercase tracking-wide">
                                        <span>{d.date.substring(5).split('-').reverse().join('/')}</span>
                                        <span># {d.dispatchNo}</span>
                                        <select 
                                            value={d.status} 
                                            onClick={(e) => e.stopPropagation()}
                                            onChange={(e) => handleMasterStatusChange(d, e.target.value as DispatchStatus)}
                                            className={`px-1.5 py-0.5 rounded border text-[9px] font-black uppercase tracking-tighter outline-none cursor-pointer ${statusBadge}`}
                                        >
                                            {Object.values(DispatchStatus).map(st => <option key={st} value={st}>{st}</option>)}
                                        </select>
                                    </div>
                                    <div className="bg-indigo-50 px-3 py-2 rounded-lg border border-indigo-100 inline-block w-fit max-w-full">
                                        <h4 className="text-sm font-black text-indigo-900 leading-tight truncate">{partyName}</h4>
                                    </div>
                                    <div className="flex gap-4 pt-1">
                                        <div><span className="text-[9px] font-bold text-slate-400 uppercase block">Box</span><span className="text-sm font-bold text-slate-700">{d.rows.reduce((a,r)=>a+(Number(r.bundle)||0),0) || '-'}</span></div>
                                        <div><span className="text-[9px] font-bold text-slate-400 uppercase block">Weight</span><span className="text-sm font-bold text-slate-900">{d.totalWeight.toFixed(3)}</span></div>
                                    </div>
                                </div>
                           </div>
                           
                           {isExpanded && (
                             <div className="bg-slate-50 border-t border-slate-100 p-4 pl-5 animate-in slide-in-from-top-2 duration-200">
                                <div className="flex justify-between items-center mb-4">
                                    <div className="flex gap-2">
                                        <button onClick={() => handleRepeatOrder(d)} className="bg-white border border-blue-200 text-blue-600 px-3 py-1.5 rounded text-xs font-bold hover:bg-blue-50 transition-colors shadow-sm">Repeat</button>
                                        <button onClick={(e) => toggleToday(e, d)} className={`bg-white border text-xs font-bold px-3 py-1.5 rounded transition-colors shadow-sm ${isToday ? 'border-indigo-200 text-indigo-600 hover:bg-indigo-50' : 'border-slate-200 text-slate-500 hover:bg-slate-100'}`}>
                                            {isToday ? 'Unmark Today' : 'Mark Today'}
                                        </button>
                                    </div>
                                    <button onClick={() => shareJobImage(d)} className="bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 rounded text-xs font-bold flex items-center gap-1 transition-all shadow-md"><Share2 size={12}/> Share</button>
                                </div>
                                
                                <div className="flex justify-between items-center mb-3">
                                    <span className="text-[10px] font-black text-slate-500 uppercase tracking-wider">Line Item Details:</span>
                                    <button onClick={() => toggleAllRowsForShare(d)} className="text-[10px] font-bold text-indigo-600 hover:underline">Select All for Share</button>
                                </div>

                                {/* LINE ITEMS LIST */}
                                <div className="space-y-4">
                                    {d.rows.map((row, rIdx) => {
                                        const isMarked = (selectedRowsForShare[d.id] || []).includes(row.id);
                                        return (
                                            <div key={row.id} className={`bg-white rounded-xl border p-4 shadow-sm transition-all ${isMarked ? 'border-indigo-400 ring-1 ring-indigo-50' : 'border-slate-200'}`}>
                                                <div className="flex justify-between items-start mb-3 border-b border-slate-100 pb-2">
                                                    <div className="flex items-center gap-3">
                                                        <button onClick={() => toggleRowSelectionForShare(d.id, row.id)} className={`transition-colors ${isMarked ? 'text-indigo-600' : 'text-slate-300'}`}>
                                                            {isMarked ? <CheckSquare size={20} /> : <Square size={20} />}
                                                        </button>
                                                        <div className="flex flex-col">
                                                            <div className="flex items-center gap-2">
                                                                <span className="text-xs font-black text-slate-800 uppercase tracking-tighter">#{rIdx + 1}</span>
                                                                <input value={row.size} onChange={(e) => handleRowUpdate(d, row.id, 'size', e.target.value)} className="font-bold text-slate-900 text-sm bg-transparent outline-none w-32 border-b border-dashed border-slate-200 focus:border-indigo-500" />
                                                            </div>
                                                            <div className="flex gap-2 mt-1">
                                                                <select value={row.sizeType || ''} onChange={(e) => handleRowUpdate(d, row.id, 'sizeType', e.target.value)} className="text-[9px] font-bold text-slate-500 bg-slate-50 border border-slate-200 rounded px-1.5 py-0.5">
                                                                    {SIZE_TYPES.map(t => <option key={t} value={t}>{t || 'Type'}</option>)}
                                                                </select>
                                                                <input type="number" placeholder="Mic" value={row.micron || ''} onChange={(e) => handleRowUpdate(d, row.id, 'micron', parseFloat(e.target.value))} className="w-10 text-[9px] font-bold text-slate-500 bg-slate-50 border border-slate-200 rounded px-1.5 py-0.5 text-center" />
                                                            </div>
                                                        </div>
                                                    </div>
                                                    <button onClick={() => { if(confirm("Delete item?")) { const newRows = d.rows.filter(r => r.id !== row.id); const updated = updateDispatchWithRecalculatedTotals(d, newRows); saveDispatch(updated as DispatchEntry); }}} className="text-slate-300 hover:text-red-500 transition-colors"><Trash2 size={16}/></button>
                                                </div>

                                                <div className="grid grid-cols-3 gap-2">
                                                    <div className="bg-slate-50 p-2 rounded-lg border border-slate-100 flex flex-col items-center justify-center">
                                                        <span className="text-[8px] font-black text-slate-400 uppercase leading-none mb-1">Total Wt</span>
                                                        <input type="number" value={row.weight || ''} onChange={(e) => handleRowUpdate(d, row.id, 'weight', parseFloat(e.target.value) || 0)} className="w-full text-center bg-transparent text-xs font-bold outline-none focus:text-indigo-600" placeholder="0.000" />
                                                    </div>
                                                    <div className="bg-indigo-50/50 p-2 rounded-lg border border-indigo-100 flex flex-col items-center justify-center">
                                                        <span className="text-[8px] font-black text-indigo-400 uppercase leading-none mb-1">Prod Wt</span>
                                                        <input type="number" placeholder="-" value={row.productionWeight || ''} onChange={(e)=>handleRowUpdate(d, row.id, 'productionWeight', parseFloat(e.target.value))} className="w-full text-center font-bold text-indigo-700 text-xs bg-transparent outline-none" />
                                                    </div>
                                                    <div className="bg-red-50/50 p-2 rounded-lg border border-red-100 flex flex-col items-center justify-center">
                                                        <span className="text-[8px] font-black text-red-400 uppercase leading-none mb-1">Wastage</span>
                                                        <span className="text-xs font-black text-red-600">{row.wastage ? row.wastage.toFixed(3) : '-'}</span>
                                                    </div>
                                                    <div className="bg-slate-50 p-2 rounded-lg border border-slate-100 flex flex-col items-center justify-center">
                                                        <span className="text-[8px] font-black text-slate-400 uppercase leading-none mb-1">Total Pcs</span>
                                                        <input type="number" value={row.pcs || ''} onChange={(e) => handleRowUpdate(d, row.id, 'pcs', parseFloat(e.target.value) || 0)} className="w-full text-center bg-transparent text-xs font-bold outline-none focus:text-indigo-600" placeholder="0" />
                                                    </div>
                                                    <div className="bg-slate-50 p-2 rounded-lg border border-slate-100 flex flex-col items-center justify-center">
                                                        <span className="text-[8px] font-black text-slate-400 uppercase leading-none mb-1">Bundles</span>
                                                        <input type="number" placeholder="-" value={row.bundle || ''} onChange={(e)=>handleRowUpdate(d, row.id, 'bundle', parseFloat(e.target.value))} className="w-full text-center font-bold text-slate-900 text-xs bg-transparent outline-none" />
                                                    </div>
                                                    <div className="flex flex-col items-stretch">
                                                        <select value={row.status || DispatchStatus.PENDING} onChange={(e) => handleRowUpdate(d, row.id, 'status', e.target.value)} className="h-full w-full bg-white border border-slate-200 rounded-lg text-[9px] font-bold uppercase outline-none focus:border-indigo-500 px-1 shadow-sm">
                                                            {Object.values(DispatchStatus).map(s => <option key={s} value={s}>{s}</option>)}
                                                        </select>
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>

                                <div className="mt-4 flex gap-2 pt-3 border-t border-slate-200">
                                    <button onClick={() => handleEdit(d as DispatchEntry)} className="flex-1 bg-white border border-indigo-200 text-indigo-600 py-2 rounded-lg font-bold text-xs flex items-center justify-center gap-2 hover:bg-indigo-50 transition-colors shadow-sm"><Edit size={14}/> Edit Header</button>
                                    <button onClick={() => { if(confirm("Delete Job?")) deleteDispatch(d.id!); }} className="flex-1 bg-white border border-red-200 text-red-500 py-2 rounded-lg font-bold text-xs flex items-center justify-center gap-2 hover:bg-red-50 transition-colors shadow-sm"><Trash2 size={14}/> Delete Job</button>
                                </div>
                             </div>
                           )}
                        </div>
                    );
                })}
            </div>
        </div>
    </div>
  );
};
