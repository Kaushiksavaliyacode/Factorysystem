import React from 'react';
import { AppData, PaymentMode } from '../../types';

interface Props {
  data: AppData;
}

export const PartyReport: React.FC<Props> = ({ data }) => {
  return (
    <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden animate-in fade-in duration-500">
      <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
        <h3 className="text-lg font-bold text-slate-800">Party Performance</h3>
        <button 
          onClick={() => {
             const jsonString = `data:text/json;chatset=utf-8,${encodeURIComponent(JSON.stringify(data.parties, null, 2))}`;
             const link = document.createElement("a");
             link.href = jsonString;
             link.download = "party_data.json";
             link.click();
          }}
          className="px-4 py-2 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-600 hover:bg-slate-50 hover:text-indigo-600 transition-colors shadow-sm"
        >
          Export JSON
        </button>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="bg-white text-slate-400 font-bold uppercase tracking-wider text-xs border-b border-slate-100">
            <tr>
              <th className="px-6 py-4">Party Name</th>
              <th className="px-6 py-4 text-right">Dispatches</th>
              <th className="px-6 py-4 text-right">Total Weight</th>
              <th className="px-6 py-4 text-right">Challans</th>
              <th className="px-6 py-4 text-right">Unpaid Amount</th>
              <th className="px-6 py-4 text-right">Last Activity</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {data.parties.map(party => {
              const partyDispatches = data.dispatches.filter(d => d.partyId === party.id);
              const partyChallans = data.challans.filter(c => c.partyId === party.id);
              const totalWeight = partyDispatches.reduce((s, d) => s + d.totalWeight, 0);
              const unpaid = partyChallans
                .filter(c => c.paymentMode === PaymentMode.UNPAID)
                .reduce((s, c) => s + c.totalAmount, 0);
              const lastDispatch = partyDispatches[0]?.date || '-';

              return (
                <tr key={party.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-6 py-4 font-bold text-slate-800">{party.name}</td>
                  <td className="px-6 py-4 text-right text-slate-600">{partyDispatches.length}</td>
                  <td className="px-6 py-4 text-right font-mono text-slate-600 font-medium">{totalWeight.toFixed(3)}</td>
                  <td className="px-6 py-4 text-right text-slate-600">{partyChallans.length}</td>
                  <td className={`px-6 py-4 text-right font-bold ${unpaid > 0 ? 'text-red-500' : 'text-slate-400'}`}>
                    ₹{unpaid.toLocaleString()}
                  </td>
                  <td className="px-6 py-4 text-right text-slate-400 text-xs font-medium">{lastDispatch}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};