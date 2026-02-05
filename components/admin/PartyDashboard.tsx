
import React, { useState, useMemo } from 'react';
import { AppData, DispatchStatus, PaymentMode, Party, Challan } from '../../types';
import { deleteDispatch, deleteChallan, saveChallan, saveParty, deleteParty, updateParty } from '../../services/storageService';
import { Trash2, Plus, X, Edit2 } from 'lucide-react';

interface Props {
  data: AppData;
}

const PARTY_SEED_DATA = [
  { code: "REL/001", name: "FINE TECH PRINT WORLD" },
  { code: "REL/002", name: "M K SHRINK LABEL & LAMINATOR" },
  { code: "REL/003", name: "POLY PAPER CONVERTOR" },
  { code: "REL/004", name: "COMMERCIAL PRINT PACK" },
  { code: "REL/005", name: "VEERKRUPA PACKAGING" },
  { code: "REL/006", name: "MAKERS POLYSHRINK" },
  { code: "REL/007", name: "D K GLOBAL ENTERPRISE PVT LTD" },
  { code: "REL/008", name: "Ajay Traders" },
  { code: "REL/009", name: "Shyam Poly Pack - Odhav" },
  { code: "REL/010", name: "Consol Flexibles Pvt Ltd - Padra" },
  { code: "REL/011", name: "Krupa Packaging Industries - Aslali" },
  { code: "REL/012", name: "Radhe Labels - Ankleshwar" },
  { code: "REL/013", name: "Sterling Tapes Ltd. - Gandhidham" },
  { code: "REL/014", name: "Hempra Multi Prints Pvt Ltd - Pune" },
  { code: "REL/015", name: "Tirth Print Pack (P) Ltd - Shapar" },
  { code: "REL/016", name: "Secure Polymers Pvt Ltd - Shapar" },
  { code: "REL/017", name: "Prime Poly Film" },
  { code: "REL/018", name: "Sterling Tapes Ltd. - Belgaum" },
  { code: "REL/019", name: "GNS Print - Asangaon" },
  { code: "REL/020", name: "Shree PolyShrink - Rajkot" },
  { code: "REL/021", name: "Tanvika Polymers Pvt Ltd" },
  { code: "REL/022", name: "Baldha Enterprise Pvt Ltd" },
  { code: "REL/023", name: "Kansuee Industries Pvt Ltd - Changodar" },
  { code: "REL/024", name: "Parthsarthi Polymers - Santej" },
  { code: "REL/025", name: "D K Global Enterprise Pvt Ltd - Padra" },
  { code: "REL/026", name: "Phoenix Label - Surat" },
  { code: "REL/027", name: "Asia Chem Pvt Ltd - Nepal" },
  { code: "REL/028", name: "Ajit Industries West Pvt Ltd - Gandhidham" },
  { code: "REL/029", name: "Vikas Party - Surat" },
  { code: "REL/030", name: "Om Sai Process - Pune" },
  { code: "REL/031", name: "Hindustan Labels - Nashik" }
];

export const PartyDashboard: React.FC<Props> = ({ data }) => {
  const [selectedPartyId, setSelectedPartyId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [directoryTab, setDirectoryTab] = useState<'production' | 'billing' | 'manage'>('billing');
  const [filterDate, setFilterDate] = useState('');
  const [expandedChallanId, setExpandedChallanId] = useState<string | null>(null);
  const [isImporting, setIsImporting] = useState(false);

  // Manage State
  const [isPartyModalOpen, setIsPartyModalOpen] = useState(false);
  const [editingPartyId, setEditingPartyId] = useState<string | null>(null);
  const [newPartyName, setNewPartyName] = useState('');
  const [newPartyCode, setNewPartyCode] = useState('');

  // Helper to remove year
  const formatDateNoYear = (dateStr: string) => {
    if (!dateStr) return '-';
    const [y, m, d] = dateStr.split('-');
    return `${d}-${m}`;
  };

  const handleSeedParties = async () => {
      if(!confirm(`Import ${PARTY_SEED_DATA.length} legacy parties to the database? Existing parties with same code will be skipped.`)) return;
      
      setIsImporting(true);
      let addedCount = 0;

      for (const p of PARTY_SEED_DATA) {
          // Check if party exists by Code OR Name
          const exists = data.parties.some(existing => 
              (existing.code === p.code) || 
              (existing.name.toLowerCase() === p.name.toLowerCase())
          );

          if (!exists) {
              const newId = `party-${p.code.replace('/','-').toLowerCase()}`;
              const newParty: Party = {
                  id: newId,
                  name: p.name,
                  code: p.code,
                  contact: '',
                  address: ''
              };
              await saveParty(newParty);
              addedCount++;
          }
      }
      
      setIsImporting(false);
      alert(`Import Complete! Added ${addedCount} new parties.`);
  };

  // --- Aggregate Data per Party ---
  const partyStats = useMemo(() => {
    return data.parties.map(party => {
      const pDispatches = data.dispatches.filter(d => d.partyId === party.id);
      const pChallans = data.challans.filter(c => c.partyId === party.id);

      const totalRevenue = pChallans.reduce((sum, c) => sum + c.totalAmount, 0);
      const totalOutstanding = pChallans
        .filter(c => c.paymentMode === PaymentMode.UNPAID)
        .reduce((sum, c) => sum + c.totalAmount, 0);
      
      const totalWeight = pDispatches.reduce((sum, d) => sum + d.totalWeight, 0);

      return {
        ...party,
        jobCount: pDispatches.length,
        challanCount: pChallans.length,
        totalRevenue,
        totalOutstanding,
        totalWeight,
        lastJobDate: pDispatches.length > 0 ? pDispatches[0].date : null,
        lastBillDate: pChallans.length > 0 ? pChallans[0].date : null
      };
    }).sort((a, b) => b.totalOutstanding - a.totalOutstanding); 
  }, [data]);

  const filteredParties = useMemo(() => {
    return partyStats.filter(p => {
      const searchLower = searchTerm.toLowerCase();
      const matchesSearch = p.name.toLowerCase().includes(searchLower) || (p.code && p.code.toLowerCase().includes(searchLower));
      
      if (directoryTab === 'manage') return matchesSearch;

      // Strict separation based on user request for Billing/Production
      let matchesTab = false;
      if (directoryTab === 'production') {
        matchesTab = p.jobCount > 0;
      } else {
        matchesTab = p.challanCount > 0;
      }
      
      if (searchTerm) return matchesSearch;

      return matchesSearch && matchesTab;
    });
  }, [partyStats, searchTerm, directoryTab]);

  // --- Detailed View Logic ---
  const selectedParty = useMemo(() => 
    partyStats.find(p => p.id === selectedPartyId), 
  [partyStats, selectedPartyId]);

  // Determine which "View Mode" to show based on data presence
  const viewMode = useMemo(() => {
    if (!selectedParty) return null;
    if (directoryTab === 'production') return 'jobs';
    return 'bills';
  }, [selectedParty, directoryTab]);

  const partyJobs = useMemo(() => {
    if (!selectedPartyId) return [];
    return data.dispatches
      .filter(d => d.partyId === selectedPartyId)
      .flatMap(d => d.rows.map((r, idx) => ({
        ...r,
        uniqueId: `${d.id}_${idx}`,
        parentId: d.id,
        dispatchNo: d.dispatchNo,
        date: d.date,
        parentStatus: d.status,
        updatedAt: d.updatedAt
      })))
      .filter(item => {
         const matchesSearch = item.dispatchNo.toLowerCase().includes(searchTerm.toLowerCase()) || 
                               item.size.toLowerCase().includes(searchTerm.toLowerCase());
         const matchesDate = filterDate ? item.date === filterDate : true;
         return matchesSearch && matchesDate;
      })
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [data.dispatches, selectedPartyId, searchTerm, filterDate]);

  const partyChallans = useMemo(() => {
    if (!selectedPartyId) return [];
    return data.challans
      .filter(c => c.partyId === selectedPartyId)
      .filter(c => {
         const matchesSearch = c.challanNumber.toLowerCase().includes(searchTerm.toLowerCase());
         const matchesDate = filterDate ? c.date === filterDate : true;
         return matchesSearch && matchesDate;
      })
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [data.challans, selectedPartyId, searchTerm, filterDate]);

  // --- Actions ---
  const exportCSV = () => {
    if (!selectedParty || !viewMode) return;
    
    let content = '';
    let filename = '';

    if (viewMode === 'jobs') {
       const headers = ["Job ID", "Date", "Size", "Weight", "Pcs", "Bundle", "Status", "Notes"];
       const rows = partyJobs.map(j => [
         j.dispatchNo, j.date, `"${j.size}"`, j.weight, j.pcs, j.bundle, j.status, "" 
       ]);
       content = [headers.join(","), ...rows.map(r => r.join(","))].join("\n");
       filename = `${selectedParty.name}_Jobs.csv`;
    } else {
       const headers = ["Challan No", "Date", "Items", "Total Weight", "Total Amount", "Mode"];
       const rows = partyChallans.map(c => [
         c.challanNumber, c.date, `"${c.lines.map(l => l.size).join(' | ')}"`, c.totalWeight, c.totalAmount, c.paymentMode
       ]);
       content = [headers.join(","), ...rows.map(r => r.join(","))].join("\n");
       filename = `${selectedParty.name}_Bills.csv`;
    }

    const blob = new Blob([content], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    link.click();
  };

  const handleOpenParty = (partyId: string) => {
      // Prevent opening details in manage mode
      if (directoryTab === 'manage') return; 
      setSelectedPartyId(partyId);
      setSearchTerm('');
      setExpandedChallanId(null);
  };

  const handleTogglePayment = async (c: Challan) => {
    const newMode = c.paymentMode === PaymentMode.UNPAID ? PaymentMode.CASH : PaymentMode.UNPAID;
    const updatedChallan = { ...c, paymentMode: newMode };
    await saveChallan(updatedChallan);
  };

  const shareChallanImage = async (challan: Challan) => {
    const containerId = 'share-challan-gen';
    let container = document.getElementById(containerId);
    if (container) document.body.removeChild(container);
    
    container = document.createElement('div');
    container.id = containerId;
    container.style.position = 'absolute';
    container.style.left = '-9999px';
    container.style.top = '0px';
    container.style.width = '550px'; 
    container.style.background = '#fff';
    container.style.zIndex = '-1';
    document.body.appendChild(container);

    const rowsHtml = challan.lines.map((l, i) => `
        <tr style="border-bottom: 1px solid #f1f5f9;">
            <td style="padding: 12px; font-weight: bold; color: #334155; font-size: 16px;">${l.size}</td>
            <td style="padding: 12px; text-align: right; color: #475569; font-size: 16px; font-family: monospace;">${l.weight.toFixed(3)} kg</td>
            <td style="padding: 12px; text-align: right; color: #475569; font-size: 16px; font-family: monospace;">${l.rate}</td>
            <td style="padding: 12px; text-align: right; color: #334155; font-weight: bold; font-size: 16px;">₹${l.amount.toFixed(2)}</td>
        </tr>
    `).join('');

    const partyName = data.parties.find(p => p.id === challan.partyId)?.name || 'Unknown';

    container.innerHTML = `
        <div style="font-family: sans-serif; background: #fff; border: 2px solid #334155;">
            <div style="background: #1e293b; padding: 24px; color: white;">
                <div style="font-size: 14px; text-transform: uppercase; letter-spacing: 2px; color: #94a3b8; font-weight: bold;">Tax Invoice / Challan</div>
                <div style="font-size: 24px; font-weight: bold; margin-top: 8px; line-height: 1.2;">${partyName}</div>
                <div style="margin-top: 16px; display: flex; justify-content: space-between; align-items: center; border-top: 1px solid #334155; padding-top: 12px;">
                    <span style="font-size: 16px; background: #334155; padding: 4px 12px; rounded: 6px; font-weight: bold;">Bill #${challan.challanNumber}</span>
                    <span style="font-size: 14px; color: #cbd5e1; font-weight: bold;">${challan.date.split('-').reverse().join('/')}</span>
                </div>
            </div>
            <table style="width: 100%; border-collapse: collapse;">
                <thead>
                    <tr style="background: #f8fafc; color: #64748b; font-size: 12px; text-transform: uppercase;">
                        <th style="padding: 12px; text-align: left;">Description</th>
                        <th style="padding: 12px; text-align: right;">Weight</th>
                        <th style="padding: 12px; text-align: right;">Rate</th>
                        <th style="padding: 12px; text-align: right;">Amount</th>
                    </tr>
                </thead>
                <tbody>${rowsHtml}</tbody>
                <tfoot>
                    <tr style="background: #f1f5f9; font-weight: bold; color: #1e293b; border-top: 2px solid #cbd5e1;">
                        <td style="padding: 16px 12px; font-size: 16px;">TOTAL</td>
                        <td style="padding: 16px 12px; text-align: right; font-size: 16px;">${challan.totalWeight.toFixed(3)}</td>
                        <td style="padding: 16px 12px;"></td>
                        <td style="padding: 16px 12px; text-align: right; font-size: 20px;">₹${Math.round(challan.totalAmount).toLocaleString()}</td>
                    </tr>
                </tfoot>
            </table>
            <div style="padding: 12px; text-align: center; background: #1e293b; color: #64748b; font-size: 12px; font-weight: bold;">
                RDMS BILLING SYSTEM
            </div>
        </div>
    `;

    if ((window as any).html2canvas) {
      try {
        const canvas = await (window as any).html2canvas(container, { 
          backgroundColor: null,
          scale: 2
        });
        
        canvas.toBlob(async (blob: Blob) => {
          if (blob) {
            const file = new File([blob], `Challan_${challan.challanNumber}.png`, { type: 'image/png' });
            
            if (navigator.canShare && navigator.canShare({ files: [file] })) {
              try {
                await navigator.share({
                  files: [file],
                  title: `Challan #${challan.challanNumber}`,
                  text: `Bill details for ${partyName}`
                });
              } catch (err) {
                console.log("Share failed/cancelled", err);
              }
            } else {
              const link = document.createElement('a');
              link.href = URL.createObjectURL(blob);
              link.download = `Challan_${challan.challanNumber}.png`;
              link.click();
              alert("Image downloaded! You can now send it via WhatsApp Web.");
            }
          }
          if (document.body.contains(container!)) document.body.removeChild(container!);
        });
      } catch (e) {
        console.error("Image generation failed", e);
        if (document.body.contains(container!)) document.body.removeChild(container!);
        alert("Failed to generate image.");
      }
    } else {
      if (document.body.contains(container!)) document.body.removeChild(container!);
      alert("Image generator not ready.");
    }
  };

  const handleSaveParty = async () => {
      if (!newPartyName.trim()) return alert("Party Name is required");
      
      if (editingPartyId) {
          // Update
          await updateParty({ 
              id: editingPartyId, 
              name: newPartyName, 
              code: newPartyCode, 
              contact: '', 
              address: '' 
          });
      } else {
          // Create
          const id = `p-${Date.now()}`;
          await saveParty({ id, name: newPartyName, code: newPartyCode, contact: '', address: '' });
      }
      
      setNewPartyName('');
      setNewPartyCode('');
      setEditingPartyId(null);
      setIsPartyModalOpen(false);
  };

  const openAddModal = () => {
      setNewPartyName('');
      setNewPartyCode('');
      setEditingPartyId(null);
      setIsPartyModalOpen(true);
  };

  const openEditModal = (p: Party) => {
      setNewPartyName(p.name);
      setNewPartyCode(p.code || '');
      setEditingPartyId(p.id);
      setIsPartyModalOpen(true);
  };

  const handleDeleteParty = async (e: React.MouseEvent, id: string) => {
      e.stopPropagation();
      if (confirm("Are you sure you want to delete this party? Action cannot be undone.")) {
          await deleteParty(id);
      }
  };

  // 1. DIRECTORY VIEW
  if (!selectedPartyId) {
    return (
      <div className="space-y-4 sm:space-y-6 animate-in fade-in slide-in-from-right-4 duration-500">
        
        {/* ADD/EDIT PARTY MODAL */}
        {isPartyModalOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
                <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-200">
                    <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                        <h3 className="font-bold text-slate-800">{editingPartyId ? 'Edit Party' : 'Add New Party'}</h3>
                        <button onClick={() => setIsPartyModalOpen(false)} className="text-slate-400 hover:text-slate-600"><X size={20} /></button>
                    </div>
                    <div className="p-6 space-y-4">
                        <div>
                            <label className="text-xs font-bold text-slate-500 uppercase block mb-1">Party Name *</label>
                            <input autoFocus value={newPartyName} onChange={e => setNewPartyName(e.target.value)} className="w-full border border-slate-200 rounded-lg px-4 py-3 text-sm font-bold outline-none focus:border-indigo-500" placeholder="e.g. Acme Corp" />
                        </div>
                        <div>
                            <label className="text-xs font-bold text-slate-500 uppercase block mb-1">Party Code (Optional)</label>
                            <input value={newPartyCode} onChange={e => setNewPartyCode(e.target.value)} className="w-full border border-slate-200 rounded-lg px-4 py-3 text-sm font-bold outline-none focus:border-indigo-500" placeholder="e.g. REL/001" />
                        </div>
                        <button onClick={handleSaveParty} className="w-full bg-slate-900 text-white font-bold py-3.5 rounded-xl shadow-lg hover:bg-black transition-colors">
                            {editingPartyId ? 'Update Party' : 'Save Party'}
                        </button>
                    </div>
                </div>
            </div>
        )}

        <div className="bg-white rounded-2xl sm:rounded-3xl border border-slate-200 shadow-xl overflow-hidden">
          {/* Header & Toggle */}
          <div className="bg-white px-4 py-4 sm:px-6 sm:py-6 flex flex-col gap-4 sm:gap-6">
             <div className="flex flex-col sm:flex-row justify-between items-center gap-3">
                <div className="text-center sm:text-left flex items-center gap-3">
                  <div>
                    <h2 className="text-xl sm:text-2xl font-bold text-slate-800 tracking-tight">Directory</h2>
                    <p className="text-xs sm:text-sm text-slate-500 font-medium">Customer & Vendor Management</p>
                  </div>
                  {directoryTab === 'manage' ? (
                      <button onClick={openAddModal} className="text-[10px] font-bold bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-1.5 rounded-lg shadow-md transition-colors flex items-center gap-1">
                          <Plus size={14} /> Add Party
                      </button>
                  ) : (
                      <button onClick={handleSeedParties} disabled={isImporting} className="text-[10px] font-bold bg-slate-100 hover:bg-slate-200 text-slate-600 px-3 py-1.5 rounded-lg border border-slate-200 transition-colors">
                          {isImporting ? 'Importing...' : '+ Import Defaults'}
                      </button>
                  )}
                </div>
                <input 
                  type="text" 
                  placeholder="Search Name or Code..." 
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  className="w-full sm:w-72 bg-slate-50 border border-slate-200 text-slate-900 placeholder-slate-400 rounded-xl px-4 py-2.5 text-xs sm:text-sm font-medium outline-none focus:ring-2 focus:ring-indigo-100 transition-all shadow-inner"
                />
             </div>
             
             {/* Mode Toggle Tabs (Grid of 3) */}
             <div className="grid grid-cols-3 gap-2 sm:gap-4 w-full">
                <button 
                  onClick={() => setDirectoryTab('billing')}
                  className={`relative overflow-hidden p-3 sm:p-5 rounded-xl sm:rounded-2xl text-left transition-all duration-300 transform hover:scale-[1.01] ${directoryTab === 'billing' ? 'shadow-xl shadow-purple-200 ring-2 sm:ring-4 ring-purple-300 ring-offset-1 scale-[1.01]' : 'shadow-md opacity-90 hover:opacity-100'}`}
                >
                   <div className="absolute inset-0 bg-gradient-to-br from-purple-500 to-indigo-600"></div>
                   <div className="relative z-10 flex items-center gap-2 sm:gap-3 text-white justify-center sm:justify-start">
                      <span className="text-lg sm:text-2xl p-1.5 sm:p-2 rounded-lg bg-white/20 backdrop-blur-md">🧾</span>
                      <div><h3 className="text-[10px] sm:text-base font-bold">Billing</h3></div>
                   </div>
                </button>

                <button 
                  onClick={() => setDirectoryTab('production')}
                  className={`relative overflow-hidden p-3 sm:p-5 rounded-xl sm:rounded-2xl text-left transition-all duration-300 transform hover:scale-[1.01] ${directoryTab === 'production' ? 'shadow-xl shadow-indigo-100 ring-2 sm:ring-4 ring-indigo-300 ring-offset-1 scale-[1.01]' : 'shadow-md opacity-90 hover:opacity-100'}`}
                >
                   <div className="absolute inset-0 bg-gradient-to-br from-indigo-500 to-blue-600"></div>
                   <div className="relative z-10 flex items-center gap-2 sm:gap-3 text-white justify-center sm:justify-start">
                      <span className="text-lg sm:text-2xl p-1.5 sm:p-2 rounded-lg bg-white/20 backdrop-blur-md">🚛</span>
                      <div><h3 className="text-[10px] sm:text-base font-bold">Production</h3></div>
                   </div>
                </button>

                <button 
                  onClick={() => setDirectoryTab('manage')}
                  className={`relative overflow-hidden p-3 sm:p-5 rounded-xl sm:rounded-2xl text-left transition-all duration-300 transform hover:scale-[1.01] ${directoryTab === 'manage' ? 'shadow-xl shadow-slate-200 ring-2 sm:ring-4 ring-slate-300 ring-offset-1 scale-[1.01]' : 'shadow-md opacity-90 hover:opacity-100'}`}
                >
                   <div className="absolute inset-0 bg-gradient-to-br from-slate-600 to-slate-800"></div>
                   <div className="relative z-10 flex items-center gap-2 sm:gap-3 text-white justify-center sm:justify-start">
                      <span className="text-lg sm:text-2xl p-1.5 sm:p-2 rounded-lg bg-white/20 backdrop-blur-md">⚙️</span>
                      <div><h3 className="text-[10px] sm:text-base font-bold">Manage</h3></div>
                   </div>
                </button>
             </div>
          </div>
          
          <div className="p-4 sm:p-6 bg-slate-50 min-h-[400px]">
             
             {/* CONDITIONAL RENDER BASED ON TAB */}
             {directoryTab === 'manage' ? (
                 // --- SIMPLE TABLE VIEW FOR MANAGE ---
                 <div className="bg-white rounded-lg border border-slate-200 overflow-hidden shadow-sm">
                    <table className="w-full text-left text-xs">
                        <thead className="bg-slate-50 border-b border-slate-200 font-bold text-slate-500 uppercase tracking-wide">
                            <tr>
                                <th className="px-4 py-3">Party Name</th>
                                <th className="px-4 py-3 w-32 hidden sm:table-cell">Code</th>
                                <th className="px-4 py-3 w-24 text-center">Action</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {filteredParties.map(p => (
                                <tr key={p.id} className="hover:bg-slate-50 transition-colors">
                                    <td className="px-4 py-2 font-bold text-slate-700">{p.name} <span className="sm:hidden text-slate-400 font-mono ml-1">{p.code}</span></td>
                                    <td className="px-4 py-2 text-slate-500 font-mono hidden sm:table-cell">{p.code || '-'}</td>
                                    <td className="px-4 py-2 text-center flex justify-center gap-2">
                                        <button onClick={() => openEditModal(p)} className="p-1.5 text-indigo-600 hover:bg-indigo-50 rounded border border-transparent hover:border-indigo-100 transition-colors"><Edit2 size={14} /></button>
                                        <button onClick={(e) => handleDeleteParty(e, p.id)} className="p-1.5 text-red-500 hover:bg-red-50 rounded border border-transparent hover:border-red-100 transition-colors"><Trash2 size={14} /></button>
                                    </td>
                                </tr>
                            ))}
                            {filteredParties.length === 0 && (
                                <tr>
                                    <td colSpan={3} className="px-4 py-8 text-center text-slate-400 italic">No parties found.</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                 </div>
             ) : (
                 // --- CARD GRID FOR PRODUCTION / BILLING ---
                 <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                   {filteredParties.map(party => (
                     <div 
                       key={party.id} 
                       onClick={() => handleOpenParty(party.id)}
                       className="group relative bg-white rounded-xl border border-slate-200 shadow-sm cursor-pointer hover:shadow-md hover:border-indigo-300 transition-all duration-200 overflow-hidden flex items-center"
                     >
                        <div className={`w-1.5 self-stretch ${directoryTab === 'production' ? 'bg-indigo-500' : 'bg-purple-500'}`}></div>

                        <div className="flex-1 p-5">
                           <div className="flex items-center gap-2 mb-1">
                               <h3 className="text-lg font-bold text-slate-800 leading-tight">{party.name}</h3>
                           </div>
                           <div className="flex items-center gap-2">
                               {party.code && <span className="text-[10px] font-bold bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded border border-slate-200">{party.code}</span>}
                               <p className="text-xs font-medium text-slate-500">
                                  {directoryTab === 'production' ? (party.lastJobDate ? formatDateNoYear(party.lastJobDate) : 'No Jobs') : (party.lastBillDate ? formatDateNoYear(party.lastBillDate) : 'No Bills')}
                               </p>
                           </div>
                        </div>

                        <div className="pr-5">
                           <button className="bg-slate-50 text-slate-400 group-hover:bg-indigo-50 group-hover:text-indigo-600 p-2 rounded-lg transition-colors">
                              <div className="text-xs font-bold text-slate-600 bg-white border border-slate-200 px-3 py-1.5 rounded-lg shadow-sm">View</div>
                           </button>
                        </div>
                     </div>
                   ))}
                   {filteredParties.length === 0 && (
                      <div className="col-span-full flex flex-col items-center justify-center py-20 text-slate-400">
                         <p className="text-sm font-semibold">No parties found.</p>
                      </div>
                   )}
                 </div>
             )}
          </div>
        </div>
      </div>
    );
  }

  // 2. DETAILED VIEW (MUTUALLY EXCLUSIVE - NO TABS)
  if (!selectedParty || !viewMode) return null;

  return (
    <div className="space-y-4 sm:space-y-6 animate-in fade-in slide-in-from-right-8 duration-500">
       
       {/* Header & Stats */}
       <div className="flex flex-col gap-4 sm:gap-6">
          <div className="flex items-center gap-3 sm:gap-4">
             <button 
               onClick={() => setSelectedPartyId(null)}
               className="bg-white p-2 sm:p-3 rounded-xl border border-slate-200 text-slate-500 hover:text-indigo-600 hover:border-indigo-200 transition-all shadow-sm group"
             >
                <svg className="w-4 h-4 sm:w-5 sm:h-5 group-hover:-translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
             </button>
             <div>
                <h1 className="text-lg sm:text-2xl font-bold text-slate-800 tracking-tight">{selectedParty.name}</h1>
                <div className="flex items-center gap-2 mt-1">
                   {selectedParty.code && <span className="text-[10px] font-bold bg-slate-100 text-slate-600 px-2 py-0.5 rounded border border-slate-200">{selectedParty.code}</span>}
                   <span className={`text-[10px] sm:text-xs font-bold tracking-wide px-2 py-0.5 rounded ${viewMode === 'jobs' ? 'bg-indigo-100 text-indigo-600' : 'bg-purple-100 text-purple-600'}`}>
                     {viewMode === 'jobs' ? 'Production' : 'Billing'}
                   </span>
                </div>
             </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
             {viewMode === 'bills' && (
               <>
                 {/* Purple for Total Outstanding */}
                 <div className="bg-gradient-to-br from-purple-500 to-indigo-600 rounded-xl sm:rounded-2xl p-4 sm:p-5 text-white shadow-lg shadow-purple-200">
                    <div className="text-[10px] sm:text-xs font-bold text-purple-100 mb-1">Outstanding</div>
                    <div className="text-lg sm:text-2xl font-bold">₹{selectedParty.totalOutstanding.toLocaleString()}</div>
                 </div>
                 <div className="bg-white rounded-xl sm:rounded-2xl p-4 sm:p-5 border border-slate-200 shadow-sm">
                    <div className="text-[10px] sm:text-xs font-bold text-slate-400 mb-1">Billed</div>
                    <div className="text-lg sm:text-2xl font-bold text-slate-800">₹{selectedParty.totalRevenue.toLocaleString()}</div>
                 </div>
               </>
             )}
             
             {viewMode === 'jobs' && (
               <>
                 {/* Production Detailed Stats */}
                 <div className="bg-white rounded-xl sm:rounded-2xl p-4 sm:p-5 border border-slate-200 shadow-sm">
                    <div className="text-[10px] sm:text-xs font-bold text-slate-400 mb-1">Total Weight</div>
                    <div className="text-lg sm:text-2xl font-bold text-slate-800">{selectedParty.totalWeight.toFixed(3)} <span className="text-sm text-slate-400">kg</span></div>
                 </div>
                 <div className="bg-white rounded-xl sm:rounded-2xl p-4 sm:p-5 border border-slate-200 shadow-sm">
                    <div className="text-[10px] sm:text-xs font-bold text-slate-400 mb-1">Completed</div>
                    <div className="text-lg sm:text-2xl font-bold text-slate-800">{selectedParty.jobCount}</div>
                 </div>
               </>
             )}
          </div>
       </div>

       {/* CONTENT AREA - CARD BASED LIST (Like User Side) */}
       <div className="space-y-4">
          <div className="bg-white rounded-2xl sm:rounded-3xl border border-slate-200 shadow-xl overflow-hidden min-h-[500px] flex flex-col">
             <div className="border-b border-slate-200 flex flex-col sm:flex-row justify-between items-center px-4 py-3 sm:px-6 sm:py-4 gap-3 bg-slate-50/50">
                
                <h3 className="text-sm sm:text-lg font-bold text-slate-700 w-full sm:w-auto">
                   {viewMode === 'jobs' ? 'History' : 'Transactions'}
                </h3>
                
                <div className="flex gap-2 w-full sm:w-auto">
                    <input 
                      type="date" 
                      value={filterDate} 
                      onChange={e => setFilterDate(e.target.value)} 
                      className="bg-white border border-slate-200 rounded-lg sm:rounded-xl px-2 py-1.5 sm:px-3 sm:py-2 text-[10px] sm:text-xs font-bold text-slate-700 outline-none focus:border-indigo-300 w-1/3" 
                    />
                    <input 
                      type="text" 
                      placeholder="Search..."
                      value={searchTerm}
                      onChange={e => setSearchTerm(e.target.value)}
                      className="bg-white border border-slate-200 rounded-lg sm:rounded-xl px-3 py-1.5 sm:px-4 sm:py-2 text-[10px] sm:text-xs font-bold w-full sm:w-48 outline-none focus:border-indigo-300"
                    />
                    <button 
                      onClick={exportCSV}
                      className="bg-slate-800 text-white px-3 py-1.5 sm:px-4 sm:py-2 rounded-lg sm:rounded-xl text-[10px] sm:text-xs font-bold hover:bg-slate-900 transition-colors flex items-center gap-2"
                    >
                       <span className="hidden sm:inline">Export</span>
                       <span className="sm:hidden">⬇</span>
                    </button>
                </div>
             </div>

             {/* LIST CONTENT - CARD STYLE */}
             <div className="p-3 sm:p-6 bg-slate-50 flex-1 space-y-3 sm:space-y-4">
                {viewMode === 'jobs' ? (
                   // JOBS LIST (Card Style)
                   partyJobs.length === 0 ? (
                      <div className="text-center py-12 text-slate-400 italic">No job records found.</div>
                   ) : (
                      partyJobs.map((job) => {
                          let statusColor = "text-slate-500 bg-slate-100";
                          if(job.status === DispatchStatus.COMPLETED) statusColor = "text-emerald-600 bg-emerald-100";
                          else if(job.status === DispatchStatus.DISPATCHED) statusColor = "text-purple-600 bg-purple-100";
                          else if(job.status === DispatchStatus.PRINTING) statusColor = "text-indigo-600 bg-indigo-100";
                          else if(job.status === DispatchStatus.SLITTING) statusColor = "text-amber-600 bg-amber-100 animate-pulse";
                          else if(job.status === DispatchStatus.CUTTING) statusColor = "text-blue-600 bg-blue-100 animate-pulse";
                          
                          const isMm = job.size.toLowerCase().includes('mm');

                          return (
                            <div key={job.uniqueId} className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 hover:shadow-md transition-all">
                                <div className="flex justify-between items-start mb-2">
                                   <div>
                                      <div className="text-xs font-bold text-slate-400 mb-0.5">{formatDateNoYear(job.date)}</div>
                                      <div className="text-sm font-bold text-slate-800">{job.size}</div>
                                   </div>
                                   <span className={`px-2 py-0.5 rounded text-[10px] font-bold tracking-wide ${statusColor}`}>
                                      {job.status}
                                   </span>
                                </div>
                                <div className="grid grid-cols-3 gap-2 text-sm border-t border-slate-100 pt-2 mt-1">
                                    <div className="text-center">
                                       <div className="text-slate-400 font-semibold text-xs">Weight</div>
                                       <div className="font-mono font-bold text-slate-700">{job.weight.toFixed(3)}</div>
                                    </div>
                                    <div className="text-center border-l border-slate-100">
                                       <div className="text-slate-400 font-semibold text-xs">{isMm ? 'Rolls' : 'Pcs'}</div>
                                       <div className="font-mono font-bold text-slate-700">{job.pcs}</div>
                                    </div>
                                    <div className="text-center border-l border-slate-100">
                                       <div className="text-slate-400 font-semibold text-xs">Bundle</div>
                                       <div className="font-mono font-bold text-slate-700">{job.bundle}</div>
                                    </div>
                                </div>
                            </div>
                          );
                      })
                   )
                ) : (
                   // BILLS LIST (Card Style)
                   partyChallans.length === 0 ? (
                      <div className="text-center py-12 text-slate-400 italic">No bill records found.</div>
                   ) : (
                      partyChallans.map((challan) => {
                         const isUnpaid = challan.paymentMode === PaymentMode.UNPAID;
                         const itemSummary = challan.lines.map(l => l.size).join(', ');
                         const isExpanded = expandedChallanId === challan.id;

                         return (
                            <div key={challan.id} className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden hover:shadow-md transition-all">
                               <div 
                                  onClick={() => setExpandedChallanId(isExpanded ? null : challan.id)}
                                  className={`p-4 cursor-pointer border-l-4 ${isUnpaid ? 'border-red-500' : 'border-emerald-500'}`}
                               >
                                  <div className="flex justify-between items-start">
                                     <div>
                                        <div className="text-[10px] font-bold text-slate-400 mb-0.5">{formatDateNoYear(challan.date)} • Bill {challan.challanNumber}</div>
                                        <div className="text-xs font-semibold text-slate-500 max-w-[150px] truncate">{itemSummary}</div>
                                     </div>
                                     <div className="text-right">
                                        <div className="text-sm font-bold text-slate-900">₹{Math.round(challan.totalAmount).toLocaleString()}</div>
                                        <button 
                                           onClick={(e) => { e.stopPropagation(); handleTogglePayment(challan); }}
                                           className={`mt-1 px-2 py-0.5 rounded text-[10px] font-bold tracking-wide border transition-all ${isUnpaid ? 'bg-red-50 text-red-600 border-red-100' : 'bg-emerald-50 text-emerald-600 border-emerald-100'}`}
                                        >
                                           {challan.paymentMode}
                                        </button>
                                     </div>
                                  </div>
                               </div>

                               {isExpanded && (
                                  <div className="bg-slate-50 p-4 border-t border-slate-100 animate-in slide-in-from-top-2">
                                     <div id={`party-challan-card-${challan.id}`} className="bg-white p-3 rounded-lg border border-slate-200 mb-3">
                                         <div className="flex justify-between items-center mb-2 border-b border-slate-100 pb-2">
                                             <h4 className="text-xs font-bold text-slate-800">Bill {challan.challanNumber}</h4>
                                             <div className="text-[10px] text-slate-500">{challan.date}</div>
                                         </div>
                                         <div className="space-y-2">
                                            {challan.lines.map((line, idx) => (
                                               <div key={idx} className="flex justify-between text-[10px] sm:text-xs border-b border-slate-200 pb-1 last:border-0 last:pb-0">
                                                  <span className="font-bold text-slate-700">{line.size}</span>
                                                  <div className="flex gap-2 text-slate-600">
                                                     <span className="font-mono">{line.weight.toFixed(3)}kg</span>
                                                     <span className="font-mono text-indigo-600">{line.rate}</span>
                                                     <span className="font-bold text-slate-800">₹{line.amount.toFixed(2)}</span>
                                                  </div>
                                               </div>
                                            ))}
                                         </div>
                                         <div className="mt-2 pt-2 border-t border-slate-200 flex justify-between items-center">
                                             <span className="text-[10px] font-bold text-slate-500">Wt: {challan.totalWeight.toFixed(3)}</span>
                                             <div className="text-xs font-bold text-slate-800">Total: ₹{Math.round(challan.totalAmount).toLocaleString()}</div>
                                         </div>
                                     </div>
                                     
                                     <button 
                                        onClick={() => shareChallanImage(challan)}
                                        className="w-full bg-emerald-500 hover:bg-emerald-600 text-white py-2 rounded-lg text-xs font-bold flex justify-center items-center gap-2 transition-colors shadow-sm"
                                     >
                                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946.003-6.556 5.338-11.891 11.893-11.891 3.181.001 6.167 1.24 8.413 3.488 2.245 2.248 3.481 5.236 3.48 8.414-.003 6.557-5.338 11.892-11.893 11.892-1.99-.001-3.951-.5-5.688-1.448l-6.305 1.654zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884-.001 2.225.651 3.891 1.746 5.634l-.999 3.648 3.742-.981zm11.387-5.464c-.074-.124-.272-.198-.57-.347-.297-.149-1.758-8.683-2.031-.967-.272-.297-.471-.421-.92-.891-.298-.471-.794-.666-1.514-.666-.72 0-1.885.27-2.871 1.336-.986 1.066-3.758 3.515-3.758 8.57 0 5.055 3.684 9.941 4.179 10.662.495.721 7.218 11.025 17.514 11.025 10.296 0 11.757-.692 13.843-2.775 2.086-2.083 2.086-3.89 2.086-3.89.27-.124.544-.272.718-.396.174-.124.322-.272.396-.446.074-.174.198-.644.198-1.336 0-.692-.52-1.238-1.114-1.535z"/></svg>
                                        Share Bill on WhatsApp
                                     </button>
                                  </div>
                               )}
                            </div>
                         );
                      })
                   )
                )}
             </div>
          </div>
       </div>
    </div>
  );
};
