
import React, { useState, useEffect } from 'react';
import { AppData, ChemicalStock, ChemicalLog, ChemicalPurchase } from '../../types';
import { updateChemicalStock, saveChemicalLog, saveChemicalPurchase, deleteChemicalPurchase } from '../../services/storageService';
import { doc, deleteDoc } from 'firebase/firestore'; 
import { db } from '../../services/firebaseConfig';

interface Props {
  data: AppData;
}

// --- SHARED UI COMPONENTS (Local) ---
const TabButton = ({ label, active, onClick, icon }: any) => (
    <button 
        onClick={onClick}
        className={`flex-1 py-3 text-xs font-bold uppercase tracking-wider transition-all border-b-2 ${
            active 
            ? 'border-teal-600 text-teal-700 bg-teal-50' 
            : 'border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-50'
        }`}
    >
        <span className="mr-2">{icon}</span> {label}
    </button>
);

const ConfirmModal = ({ isOpen, title, message, onConfirm, onCancel }: any) => {
    if (!isOpen) return null;
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white rounded-xl shadow-2xl p-6 max-w-sm w-full mx-4 transform transition-all scale-100">
                <div className="mb-4">
                    <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mb-3">
                        <svg className="w-6 h-6 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                    </div>
                    <h3 className="text-lg font-bold text-slate-900">{title}</h3>
                    <p className="text-sm text-slate-500 mt-2">{message}</p>
                </div>
                <div className="flex gap-3">
                    <button onClick={onCancel} className="flex-1 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-bold rounded-lg transition-colors">Cancel</button>
                    <button onClick={onConfirm} className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-sm font-bold rounded-lg transition-colors shadow-md">Confirm Delete</button>
                </div>
            </div>
        </div>
    );
};

export const ChemicalManager: React.FC<Props> = ({ data }) => {
  const [activeTab, setActiveTab] = useState<'PURCHASE' | 'STOCK' | 'LOGS'>('PURCHASE');
  const stock = data.chemicalStock || { dop: 0, stabilizer: 0, epoxy: 0, g161: 0, nbs: 0 };

  // Forms
  const [purchaseDate, setPurchaseDate] = useState(new Date().toISOString().split('T')[0]);
  const [addType, setAddType] = useState<keyof ChemicalStock>('dop');
  const [addQty, setAddQty] = useState('');
  
  // Modal State
  const [modalOpen, setModalOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<{type: 'log' | 'purchase', data: any} | null>(null);

  // Stats
  const totalUsed = data.chemicalLogs.reduce((acc, log) => ({
      dop: acc.dop + log.dop,
      stabilizer: acc.stabilizer + log.stabilizer,
      epoxy: acc.epoxy + log.epoxy,
      g161: acc.g161 + (log.g161 || 0),
      nbs: acc.nbs + log.nbs
  }), { dop: 0, stabilizer: 0, epoxy: 0, g161: 0, nbs: 0 });

  const handleAddStock = async () => {
      const qty = parseFloat(addQty) || 0;
      if (qty <= 0) return;

      const newStock = { ...stock };
      newStock[addType] += qty;

      const purchase: ChemicalPurchase = {
          id: `purch-${Date.now()}`,
          date: purchaseDate,
          chemical: addType,
          quantity: qty,
          createdAt: new Date().toISOString()
      };

      await saveChemicalPurchase(purchase);
      await updateChemicalStock(newStock);
      setAddQty('');
  };

  const confirmDelete = (type: 'log'|'purchase', data: any) => {
      setItemToDelete({ type, data });
      setModalOpen(true);
  };

  const executeDelete = async () => {
      if (!itemToDelete) return;
      const { type, data: item } = itemToDelete;

      const newStock = { ...stock };

      if (type === 'purchase') {
          // Reduce Stock
          newStock[item.chemical as keyof ChemicalStock] -= item.quantity;
          if (newStock[item.chemical as keyof ChemicalStock] < 0) newStock[item.chemical as keyof ChemicalStock] = 0;
          await deleteChemicalPurchase(item.id);
      } else {
          // Restore Stock (Log Deletion)
          newStock.dop += item.dop;
          newStock.stabilizer += item.stabilizer;
          newStock.epoxy += item.epoxy;
          newStock.nbs += item.nbs;
          if (item.g161) newStock.g161 += item.g161;
          await deleteDoc(doc(db, "chemical_logs", item.id));
      }

      await updateChemicalStock(newStock);
      setModalOpen(false);
      setItemToDelete(null);
  };

  const shareStockReport = async () => {
      const containerId = 'chem-share-container';
      let container = document.getElementById(containerId);
      if (container) document.body.removeChild(container);
      
      container = document.createElement('div');
      container.id = containerId;
      container.style.position = 'fixed';
      container.style.top = '-9999px';
      container.style.left = '-9999px';
      container.style.width = '500px'; 
      container.style.backgroundColor = '#ffffff';
      container.style.fontFamily = 'Inter, sans-serif';
      document.body.appendChild(container);
  
      const date = new Date().toLocaleDateString();
  
      // Generate Image HTML (Live Stock Only - No Consumption)
      container.innerHTML = `
        <div style="background: white; overflow: hidden; border: 2px solid #0f172a;">
           <div style="background: #0f172a; padding: 20px; color: white;">
              <div style="font-size: 10px; text-transform: uppercase; letter-spacing: 2px; opacity: 0.8; color: #14b8a6;">RDMS Industrial</div>
              <div style="font-size: 24px; font-weight: bold; margin-top: 5px;">Inventory Status</div>
              <div style="font-size: 12px; margin-top: 5px; opacity: 0.9;">Report Date: ${date}</div>
           </div>
  
           <div style="padding: 20px;">
              <div style="display: flex; justify-content: space-between; margin-bottom: 10px; border-bottom: 2px solid #e2e8f0; padding-bottom: 10px;">
                  <span style="font-weight: bold; color: #64748b; font-size: 12px; text-transform: uppercase;">Material</span>
                  <span style="font-weight: bold; color: #64748b; font-size: 12px; text-transform: uppercase;">Available Stock</span>
              </div>
              ${Object.entries(stock).map(([k, v]) => `
                  <div style="display: flex; justify-content: space-between; padding: 12px 0; border-bottom: 1px solid #f1f5f9;">
                      <span style="font-weight: bold; color: #1e293b; text-transform: uppercase;">${k}</span>
                      <span style="font-family: monospace; font-weight: bold; font-size: 16px; color: ${(v as number) < 100 ? '#dc2626' : '#0f766e'}">${(v as number).toFixed(1)} <span style="font-size:10px; color:#94a3b8;">kg</span></span>
                  </div>
              `).join('')}
           </div>
           
           <div style="background: #f8fafc; padding: 12px; text-align: center; border-top: 1px solid #e2e8f0;">
              <div style="font-size: 10px; font-weight: bold; color: #64748b; text-transform: uppercase;">Chemical Division</div>
           </div>
        </div>
      `;
  
      // Generate formatted text message
      const textMessage = Object.entries(stock).map(([k, v]) => {
          const name = k.charAt(0).toUpperCase() + k.slice(1);
          return `${name.padEnd(10, ' ')} *${(v as number).toFixed(3)} kg*`;
      }).join('\n');

      if ((window as any).html2canvas) {
        try {
          const canvas = await (window as any).html2canvas(container, { backgroundColor: '#ffffff', scale: 2 });
          canvas.toBlob(async (blob: Blob) => {
            if (blob) {
              const file = new File([blob], `Stock_${date.replace(/\//g,'-')}.png`, { type: 'image/png' });
              if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
                await navigator.share({ 
                    files: [file], 
                    title: `Stock Report`, 
                    text: textMessage // Added text message
                });
              } else {
                const link = document.createElement('a');
                link.href = URL.createObjectURL(blob);
                link.download = `Stock_${date.replace(/\//g,'-')}.png`;
                link.click();
                alert("Image downloaded. You can share this text manually:\n\n" + textMessage);
              }
            }
            if (document.body.contains(container!)) document.body.removeChild(container!);
          });
        } catch (e) { console.error(e); }
      }
  };

  return (
    <div className="space-y-6 font-sans">
        <ConfirmModal 
            isOpen={modalOpen} 
            title="Confirm Action" 
            message="Are you sure you want to delete this record? Stock levels will be adjusted automatically."
            onConfirm={executeDelete} 
            onCancel={() => setModalOpen(false)} 
        />

        {/* TOP NAVIGATION */}
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden flex">
            <TabButton active={activeTab==='PURCHASE'} onClick={() => setActiveTab('PURCHASE')} label="Purchase Entry" icon="📥" />
            <TabButton active={activeTab==='STOCK'} onClick={() => setActiveTab('STOCK')} label="Inventory Status" icon="📊" />
            <TabButton active={activeTab==='LOGS'} onClick={() => setActiveTab('LOGS')} label="Production Logs" icon="📋" />
        </div>

        {/* --- PURCHASE TAB --- */}
        {activeTab === 'PURCHASE' && (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
                <div className="bg-white rounded-lg border border-slate-200 p-6 shadow-sm">
                    <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wide mb-4 border-b border-slate-100 pb-2">Add New Stock</h3>
                    <div className="flex flex-col md:flex-row gap-4 items-end">
                        <div className="w-full md:w-1/4 space-y-1">
                            <label className="text-[10px] font-bold text-slate-500 uppercase">Date</label>
                            <input type="date" value={purchaseDate} onChange={e => setPurchaseDate(e.target.value)} className="w-full border-2 border-slate-200 rounded-md px-3 py-2 text-sm font-bold text-slate-900 focus:border-teal-500 outline-none" />
                        </div>
                        <div className="w-full md:w-1/4 space-y-1">
                            <label className="text-[10px] font-bold text-slate-500 uppercase">Chemical</label>
                            <select value={addType} onChange={e => setAddType(e.target.value as keyof ChemicalStock)} className="w-full border-2 border-slate-200 rounded-md px-3 py-2 text-sm font-bold text-slate-900 focus:border-teal-500 outline-none bg-white">
                                <option value="dop">DOP</option>
                                <option value="stabilizer">Stabilizer</option>
                                <option value="epoxy">Epoxy</option>
                                <option value="g161">G161</option>
                                <option value="nbs">NBS</option>
                            </select>
                        </div>
                        <div className="w-full md:w-1/4 space-y-1">
                            <label className="text-[10px] font-bold text-slate-500 uppercase">Qty (kg)</label>
                            <input type="number" placeholder="0" value={addQty} onChange={e => setAddQty(e.target.value)} className="w-full border-2 border-slate-200 rounded-md px-3 py-2 text-sm font-bold text-slate-900 focus:border-teal-500 outline-none" />
                        </div>
                        <button onClick={handleAddStock} className="w-full md:w-auto px-6 py-2.5 bg-teal-600 hover:bg-teal-700 text-white font-bold rounded-md shadow-md transition-all active:scale-95">
                            Add Stock
                        </button>
                    </div>
                </div>

                <div className="bg-white rounded-lg border border-slate-200 overflow-hidden shadow-sm">
                    <div className="bg-slate-50 px-6 py-3 border-b border-slate-200 text-xs font-bold text-slate-500 uppercase">Purchase History</div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm">
                            <thead className="bg-white border-b border-slate-100 text-slate-400 font-bold text-[10px] uppercase">
                                <tr>
                                    <th className="px-6 py-3">Date</th>
                                    <th className="px-6 py-3">Item</th>
                                    <th className="px-6 py-3 text-right">Added Qty</th>
                                    <th className="px-6 py-3 text-center">Action</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50">
                                {data.chemicalPurchases.map(p => (
                                    <tr key={p.id} className="hover:bg-slate-50 transition-colors">
                                        <td className="px-6 py-3 font-medium text-slate-700">{p.date}</td>
                                        <td className="px-6 py-3 font-bold text-slate-900 uppercase">{p.chemical}</td>
                                        <td className="px-6 py-3 text-right font-mono font-bold text-teal-600">+{p.quantity} kg</td>
                                        <td className="px-6 py-3 text-center">
                                            <button onClick={() => confirmDelete('purchase', p)} className="text-slate-400 hover:text-red-600 transition-colors font-bold text-xs border border-slate-200 hover:border-red-200 px-2 py-1 rounded">
                                                Delete
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        )}

        {/* --- STOCK TAB --- */}
        {activeTab === 'STOCK' && (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
                <div className="flex justify-end">
                    <button onClick={shareStockReport} className="bg-white border border-slate-200 text-slate-600 hover:text-teal-600 hover:border-teal-200 px-4 py-2 rounded-lg text-xs font-bold flex items-center gap-2 shadow-sm transition-all">
                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946.003-6.556 5.338-11.891 11.893-11.891 3.181.001 6.167 1.24 8.413 3.488 2.245 2.248 3.481 5.236 3.48 8.414-.003 6.557-5.338 11.892-11.893 11.892-1.99-.001-3.951-.5-5.688-1.448l-6.305 1.654zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884-.001 2.225.651 3.891 1.746 5.634l-.999 3.648 3.742-.981zm11.387-5.464c-.074-.124-.272-.198-.57-.347-.297-.149-1.758-8.683-2.031-.967-.272-.297-.471-.421-.92-.891-.298-.471-.794-.666-1.514-.666-.72 0-1.885.27-2.871 1.336-.986 1.066-3.758 3.515-3.758 8.57 0 5.055 3.684 9.941 4.179 10.662.495.721 7.218 11.025 17.514 11.025 10.296 0 11.757-.692 13.843-2.775 2.086-2.083 2.086-3.89 2.086-3.89.27-.124.544-.272.718-.396.174-.124.322-.272.396-.446.074-.174.198-.644.198-1.336 0-.692-.52-1.238-1.114-1.535z"/></svg>
                        Share Live Stock
                    </button>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <div className="bg-white rounded-lg border border-slate-200 shadow-sm p-6">
                        <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wide mb-6 flex items-center gap-2">
                            <span className="w-2 h-6 bg-teal-500 rounded-full"></span> Live Stock
                        </h3>
                        <div className="space-y-4">
                            {Object.entries(stock).map(([key, val]) => {
                                const num = val as number;
                                const max = 500; // estimated max for visual bar
                                const percent = Math.min((num / max) * 100, 100);
                                let color = 'bg-teal-500';
                                if (num < 100) color = 'bg-red-500';
                                else if (num < 200) color = 'bg-amber-500';

                                return (
                                    <div key={key}>
                                        <div className="flex justify-between text-xs font-bold text-slate-600 mb-1">
                                            <span className="uppercase">{key}</span>
                                            <span className={num < 100 ? 'text-red-600' : 'text-slate-800'}>{num.toFixed(1)} kg</span>
                                        </div>
                                        <div className="w-full bg-slate-100 rounded-full h-2">
                                            <div className={`h-2 rounded-full ${color}`} style={{ width: `${percent}%` }}></div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    <div className="bg-slate-800 rounded-lg shadow-lg p-6 text-white">
                        <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wide mb-6 flex items-center gap-2">
                            <span className="w-2 h-6 bg-purple-500 rounded-full"></span> Lifetime Consumption
                        </h3>
                        <div className="grid grid-cols-2 gap-4">
                            {Object.entries(totalUsed).map(([key, val]) => (
                                <div key={key} className="bg-slate-700/50 p-3 rounded border border-slate-600">
                                    <div className="text-[10px] font-bold text-slate-400 uppercase">{key}</div>
                                    <div className="text-xl font-bold text-slate-100">{(val as number).toFixed(0)}</div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        )}

        {/* --- LOGS TAB --- */}
        {activeTab === 'LOGS' && (
            <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden animate-in fade-in slide-in-from-bottom-2 duration-300">
                <div className="bg-slate-50 px-6 py-4 border-b border-slate-200">
                    <h3 className="text-sm font-bold text-slate-600 uppercase tracking-wide">Production Logbook</h3>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-white border-b border-slate-100 text-slate-400 font-bold text-[10px] uppercase">
                            <tr>
                                <th className="px-6 py-3">Date</th>
                                <th className="px-6 py-3">Plant</th>
                                <th className="px-6 py-3 text-right">DOP</th>
                                <th className="px-6 py-3 text-right">Stab</th>
                                <th className="px-6 py-3 text-right">Epoxy</th>
                                <th className="px-6 py-3 text-right">G161</th>
                                <th className="px-6 py-3 text-right">NBS</th>
                                <th className="px-6 py-3 text-center">Action</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                            {data.chemicalLogs.map(log => (
                                <tr key={log.id} className="hover:bg-slate-50 transition-colors">
                                    <td className="px-6 py-3 font-bold text-slate-700">{log.date}</td>
                                    <td className="px-6 py-3">
                                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${log.plant==='65mm'?'bg-blue-100 text-blue-700': log.plant==='Jumbo'?'bg-purple-100 text-purple-700':'bg-orange-100 text-orange-700'}`}>
                                            {log.plant}
                                        </span>
                                    </td>
                                    <td className="px-6 py-3 text-right font-mono font-bold text-slate-600">{log.dop}</td>
                                    <td className="px-6 py-3 text-right font-mono font-bold text-slate-600">{log.stabilizer}</td>
                                    <td className="px-6 py-3 text-right font-mono font-bold text-slate-600">{log.epoxy}</td>
                                    <td className="px-6 py-3 text-right font-mono font-bold text-slate-600">{log.g161 || '-'}</td>
                                    <td className="px-6 py-3 text-right font-mono font-bold text-slate-600">{log.nbs}</td>
                                    <td className="px-6 py-3 text-center">
                                        <button onClick={() => confirmDelete('log', log)} className="text-slate-400 hover:text-red-600 transition-colors font-bold text-xs">
                                            Delete
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        )}
    </div>
  );
};
