
import React, { useState, useMemo } from 'react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  PieChart, Pie, Cell, LineChart, Line, AreaChart, Area
} from 'recharts';
import { AppData, DispatchStatus, PaymentMode } from '../../types';

interface Props {
  data: AppData;
}

const COLORS = ['#6366f1', '#8b5cf6', '#ec4899', '#10b981', '#f59e0b', '#3b82f6'];

export const AnalyticsDashboard: React.FC<Props> = ({ data }) => {
  const [mode, setMode] = useState<'production' | 'financial'>('financial');
  const [selectedParty, setSelectedParty] = useState<string>('all');
  const [selectedSize, setSelectedSize] = useState<string>('all');
  const [dateRange, setDateRange] = useState('30'); // days

  // --- HELPER: Filter Data ---
  const filteredData = useMemo(() => {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - parseInt(dateRange));

    // Filter Jobs
    const jobs = data.dispatches.filter(d => {
      const dDate = new Date(d.date);
      const matchesDate = dDate >= cutoffDate;
      const matchesParty = selectedParty === 'all' || d.partyId === selectedParty;
      // For size, we check if ANY row matches
      const matchesSize = selectedSize === 'all' || d.rows.some(r => r.size === selectedSize);
      return matchesDate && matchesParty && matchesSize;
    });

    // Filter Bills
    const bills = data.challans.filter(c => {
      const cDate = new Date(c.date);
      const matchesDate = cDate >= cutoffDate;
      const matchesParty = selectedParty === 'all' || c.partyId === selectedParty;
      // Bill lines size check
      const matchesSize = selectedSize === 'all' || c.lines.some(l => l.size === selectedSize);
      return matchesDate && matchesParty && matchesSize;
    });

    return { jobs, bills };
  }, [data, selectedParty, selectedSize, dateRange]);

  // --- PRODUCTION METRICS ---
  const productionStats = useMemo(() => {
    let totalWeight = 0;
    let totalBundles = 0;
    let totalWastage = 0;
    let sizeDist: Record<string, number> = {};
    let partyDist: Record<string, number> = {};
    let dailyTrend: Record<string, number> = {};

    filteredData.jobs.forEach(job => {
       const partyName = data.parties.find(p => p.id === job.partyId)?.name || 'Unknown';
       const dateKey = job.date.substring(5); // MM-DD

       job.rows.forEach(row => {
          if (selectedSize !== 'all' && row.size !== selectedSize) return;

          totalWeight += row.weight;
          totalBundles += row.bundle;
          totalWastage += (row.wastage || 0);

          // Size Distribution
          sizeDist[row.size] = (sizeDist[row.size] || 0) + row.weight;

          // Party Distribution (Weighted)
          partyDist[partyName] = (partyDist[partyName] || 0) + row.weight;
       });

       // Daily Trend
       dailyTrend[dateKey] = (dailyTrend[dateKey] || 0) + job.totalWeight;
    });

    const topSizes = Object.entries(sizeDist)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 5);

    const topParties = Object.entries(partyDist)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 5);
    
    const trendData = Object.entries(dailyTrend)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => a.name.localeCompare(b.name));

    return { totalWeight, totalBundles, totalWastage, topSizes, topParties, trendData };
  }, [filteredData.jobs, selectedSize, data.parties]);

  // --- FINANCIAL METRICS ---
  const financialStats = useMemo(() => {
    let totalRevenue = 0;
    let outstanding = 0;
    let cash = 0;
    let partyRev: Record<string, number> = {};
    let dailyRev: Record<string, number> = {};

    filteredData.bills.forEach(bill => {
      const partyName = data.parties.find(p => p.id === bill.partyId)?.name || 'Unknown';
      const dateKey = bill.date.substring(5);
      
      // Calculate Line Amount based on filter if needed, else Total
      let billAmount = 0;
      if (selectedSize === 'all') {
         billAmount = bill.totalAmount;
      } else {
         billAmount = bill.lines.filter(l => l.size === selectedSize).reduce((s, l) => s + l.amount, 0);
      }

      totalRevenue += billAmount;
      if (bill.paymentMode === PaymentMode.UNPAID) outstanding += billAmount;
      if (bill.paymentMode === PaymentMode.CASH) cash += billAmount;

      partyRev[partyName] = (partyRev[partyName] || 0) + billAmount;
      dailyRev[dateKey] = (dailyRev[dateKey] || 0) + billAmount;
    });

    const topPartiesRevenue = Object.entries(partyRev)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 5);

    const trendRevenue = Object.entries(dailyRev)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => a.name.localeCompare(b.name));

    return { totalRevenue, outstanding, cash, topPartiesRevenue, trendRevenue };
  }, [filteredData.bills, selectedSize, data.parties]);

  // Unique Sizes for Dropdown
  const uniqueSizes = useMemo(() => {
     const sizes = new Set<string>();
     data.dispatches.forEach(d => d.rows.forEach(r => sizes.add(r.size)));
     return Array.from(sizes).sort();
  }, [data.dispatches]);

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-12">
      
      {/* 1. CONTROL BAR */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-4 sm:p-6 sticky top-20 z-10">
         <div className="flex flex-col lg:flex-row justify-between items-center gap-4">
            
            {/* Toggles */}
            <div className="flex bg-slate-100 p-1 rounded-xl w-full lg:w-auto">
               <button 
                 onClick={() => setMode('financial')}
                 className={`flex-1 lg:flex-none px-6 py-2 rounded-lg text-sm font-bold transition-all ${mode === 'financial' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
               >
                 💰 Financial
               </button>
               <button 
                 onClick={() => setMode('production')}
                 className={`flex-1 lg:flex-none px-6 py-2 rounded-lg text-sm font-bold transition-all ${mode === 'production' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
               >
                 🏭 Production
               </button>
            </div>

            {/* Filters */}
            <div className="flex flex-wrap gap-3 w-full lg:w-auto justify-end">
               <select 
                  value={dateRange} 
                  onChange={e => setDateRange(e.target.value)}
                  className="bg-slate-50 border border-slate-200 text-slate-700 text-xs font-bold rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-indigo-100"
               >
                  <option value="7">Last 7 Days</option>
                  <option value="30">Last 30 Days</option>
                  <option value="90">Last 3 Months</option>
                  <option value="365">This Year</option>
               </select>

               <select 
                  value={selectedParty} 
                  onChange={e => setSelectedParty(e.target.value)}
                  className="bg-slate-50 border border-slate-200 text-slate-700 text-xs font-bold rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-indigo-100 max-w-[150px]"
               >
                  <option value="all">All Parties</option>
                  {data.parties.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
               </select>

               <select 
                  value={selectedSize} 
                  onChange={e => setSelectedSize(e.target.value)}
                  className="bg-slate-50 border border-slate-200 text-slate-700 text-xs font-bold rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-indigo-100 max-w-[150px]"
               >
                  <option value="all">All Sizes</option>
                  {uniqueSizes.map(s => <option key={s} value={s}>{s}</option>)}
               </select>
            </div>
         </div>
      </div>

      {/* 2. FINANCIAL DASHBOARD */}
      {mode === 'financial' && (
        <div className="space-y-6">
           {/* KPI Cards */}
           <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <KpiCard title="Total Revenue" value={`₹${financialStats.totalRevenue.toLocaleString()}`} icon="💳" color="indigo" />
              <KpiCard title="Total Outstanding" value={`₹${financialStats.outstanding.toLocaleString()}`} icon="📉" color="red" />
              <KpiCard title="Cash Received" value={`₹${financialStats.cash.toLocaleString()}`} icon="💵" color="emerald" />
              <KpiCard title="Avg. Bill Value" value={`₹${filteredData.bills.length ? Math.round(financialStats.totalRevenue / filteredData.bills.length).toLocaleString() : 0}`} icon="📊" color="blue" />
           </div>

           <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Revenue Trend Chart */}
              <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                 <h3 className="text-sm font-bold text-slate-500 uppercase mb-4">Revenue Trend</h3>
                 <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                       <AreaChart data={financialStats.trendRevenue}>
                          <defs>
                             <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#6366f1" stopOpacity={0.8}/>
                                <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                             </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                          <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fontSize: 10}} />
                          <YAxis axisLine={false} tickLine={false} tick={{fontSize: 10}} />
                          <Tooltip contentStyle={{borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'}} />
                          <Area type="monotone" dataKey="value" stroke="#6366f1" fillOpacity={1} fill="url(#colorRev)" />
                       </AreaChart>
                    </ResponsiveContainer>
                 </div>
              </div>

              {/* Top Customers Bar Chart */}
              <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                 <h3 className="text-sm font-bold text-slate-500 uppercase mb-4">Top 5 Customers (Revenue)</h3>
                 <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                       <BarChart layout="vertical" data={financialStats.topPartiesRevenue}>
                          <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e2e8f0" />
                          <XAxis type="number" axisLine={false} tickLine={false} tick={{fontSize: 10}} />
                          <YAxis dataKey="name" type="category" width={100} axisLine={false} tickLine={false} tick={{fontSize: 10, fontWeight: 'bold'}} />
                          <Tooltip cursor={{fill: '#f1f5f9'}} contentStyle={{borderRadius: '8px', border: 'none'}} />
                          <Bar dataKey="value" fill="#8b5cf6" radius={[0, 4, 4, 0]} barSize={20} />
                       </BarChart>
                    </ResponsiveContainer>
                 </div>
              </div>
           </div>
        </div>
      )}

      {/* 3. PRODUCTION DASHBOARD */}
      {mode === 'production' && (
         <div className="space-y-6">
            {/* KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
               <KpiCard title="Total Production" value={`${productionStats.totalWeight.toFixed(0)} kg`} icon="🏭" color="indigo" />
               <KpiCard title="Total Bundles" value={`${productionStats.totalBundles}`} icon="📦" color="blue" />
               <KpiCard title="Wastage" value={`${productionStats.totalWastage.toFixed(1)} kg`} icon="🗑️" color="orange" />
               <KpiCard title="Efficiency" value={`${productionStats.totalWeight > 0 ? (100 - (productionStats.totalWastage/productionStats.totalWeight)*100).toFixed(1) : 0}%`} icon="⚡" color="emerald" />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
               {/* Production Trend */}
               <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                  <h3 className="text-sm font-bold text-slate-500 uppercase mb-4">Daily Production Trend</h3>
                  <div className="h-64">
                     <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={productionStats.trendData}>
                           <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                           <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fontSize: 10}} />
                           <YAxis axisLine={false} tickLine={false} tick={{fontSize: 10}} />
                           <Tooltip contentStyle={{borderRadius: '8px', border: 'none'}} />
                           <Line type="monotone" dataKey="value" stroke="#3b82f6" strokeWidth={3} dot={{r: 4, fill: '#3b82f6'}} />
                        </LineChart>
                     </ResponsiveContainer>
                  </div>
               </div>

               {/* Top Sizes Pie Chart */}
               <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                  <h3 className="text-sm font-bold text-slate-500 uppercase mb-4">Top 5 Sizes Produced</h3>
                  <div className="h-64 flex justify-center">
                     <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                           <Pie 
                              data={productionStats.topSizes} 
                              cx="50%" cy="50%" 
                              innerRadius={60} outerRadius={80} 
                              paddingAngle={5} 
                              dataKey="value"
                           >
                              {productionStats.topSizes.map((entry, index) => (
                                 <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                              ))}
                           </Pie>
                           <Tooltip />
                        </PieChart>
                     </ResponsiveContainer>
                  </div>
                  <div className="flex flex-wrap justify-center gap-3 mt-2">
                     {productionStats.topSizes.map((entry, index) => (
                        <div key={index} className="flex items-center gap-1.5">
                           <div className="w-2 h-2 rounded-full" style={{backgroundColor: COLORS[index % COLORS.length]}}></div>
                           <span className="text-[10px] font-bold text-slate-600">{entry.name}</span>
                        </div>
                     ))}
                  </div>
               </div>
            </div>

            {/* Detailed Table */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50">
                    <h3 className="text-sm font-bold text-slate-700">Detailed Breakdown</h3>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                        <thead className="bg-white border-b border-slate-200 text-slate-400 font-bold uppercase">
                            <tr>
                                <th className="px-6 py-3">Party / Item</th>
                                <th className="px-6 py-3 text-right">Weight (kg)</th>
                                <th className="px-6 py-3 text-center">Percentage</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                            {productionStats.topParties.map((item, idx) => (
                                <tr key={idx} className="hover:bg-slate-50">
                                    <td className="px-6 py-3 font-bold text-slate-700">{item.name}</td>
                                    <td className="px-6 py-3 text-right font-mono text-slate-600">{item.value.toFixed(2)}</td>
                                    <td className="px-6 py-3 text-center">
                                        <div className="w-full bg-slate-100 rounded-full h-1.5 mt-1">
                                            <div className="bg-indigo-500 h-1.5 rounded-full" style={{width: `${(item.value / productionStats.totalWeight * 100).toFixed(0)}%`}}></div>
                                        </div>
                                        <span className="text-[10px] text-slate-400">{(item.value / productionStats.totalWeight * 100).toFixed(1)}%</span>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
         </div>
      )}

    </div>
  );
};

// --- SUB-COMPONENT: KPI Card ---
const KpiCard = ({ title, value, icon, color }: { title: string, value: string, icon: string, color: string }) => {
    // Tailwind colors safe-list mapping or specific logic
    const bgMap: any = { 
        indigo: 'bg-indigo-50 text-indigo-600', 
        red: 'bg-red-50 text-red-600', 
        emerald: 'bg-emerald-50 text-emerald-600', 
        blue: 'bg-blue-50 text-blue-600',
        orange: 'bg-orange-50 text-orange-600'
    };
    const styleClass = bgMap[color] || bgMap.indigo;

    return (
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex justify-between items-start mb-2">
                <div className={`p-2 rounded-xl ${styleClass} text-xl shadow-sm`}>{icon}</div>
                {/* Sparkline placeholder or percentage change */}
                <div className="text-[10px] font-bold text-slate-300">Last {30} days</div>
            </div>
            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wide">{title}</h4>
            <div className="text-2xl font-bold text-slate-800 mt-1">{value}</div>
        </div>
    );
};
