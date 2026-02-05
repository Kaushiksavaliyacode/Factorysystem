
import React, { useState } from 'react';
import { AppData } from '../../types';
import { DispatchManager } from './DispatchManager';
import { ChallanManager } from './ChallanManager';
import { SlittingManager } from '../admin/SlittingManager'; 
import { ProductionPlanner } from '../admin/ProductionPlanner';
import { PlantQueueView } from './PlantQueueView';

interface Props {
  data: AppData;
  onUpdate: (newData: AppData) => void;
}

export const UserDashboard: React.FC<Props> = ({ data, onUpdate }) => {
  const [activeTab, setActiveTab] = useState<'bill' | 'job' | 'slitting' | 'planning' | 'plant'>('bill');

  const tabClass = (tab: typeof activeTab, activeBg: string) => `
    flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg text-xs font-bold transition-all duration-200 border border-slate-200 shadow-sm
    ${activeTab === tab 
      ? `${activeBg} text-white border-transparent shadow-md` 
      : 'bg-white text-slate-500 hover:bg-slate-50'
    }
  `;

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Redesigned Navigation Tabs */}
      <div className="flex justify-center mb-8 px-4 sm:px-0">
        <div className="bg-white p-3 rounded-2xl shadow-sm border border-slate-200 w-full max-w-2xl space-y-2">
          {/* Row 1: 4 Tabs */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <button
              onClick={() => setActiveTab('bill')}
              className={tabClass('bill', 'bg-slate-800')}
            >
              <span className="text-base">📑</span>
              <span>Bills</span>
            </button>
            <button
              onClick={() => setActiveTab('job')}
              className={tabClass('job', 'bg-red-500')}
            >
              <span className="text-base">🚛</span>
              <span>Jobs</span>
            </button>
            <button
              onClick={() => setActiveTab('slitting')}
              className={tabClass('slitting', 'bg-red-600')}
            >
              <span className="text-base">🏭</span>
              <span>Slit</span>
            </button>
            <button
              onClick={() => setActiveTab('planning')}
              className={tabClass('planning', 'bg-orange-500')}
            >
              <span className="text-base">📋</span>
              <span>Print</span>
            </button>
          </div>
          
          {/* Row 2: Centered Plant Tab - Replaced 🌱 with 🏭 */}
          <div className="flex justify-center">
            <button
              onClick={() => setActiveTab('plant')}
              className={`${tabClass('plant', 'bg-emerald-500')} w-full sm:w-1/4`}
            >
              <span className="text-base">🏭</span>
              <span>Plant</span>
            </button>
          </div>
        </div>
      </div>

      {/* Content Area with Fade In */}
      <div key={activeTab} className="animate-in fade-in slide-in-from-bottom-4 duration-500 fill-mode-both">
        {activeTab === 'bill' ? (
          <ChallanManager data={data} onUpdate={onUpdate} />
        ) : activeTab === 'job' ? (
          <DispatchManager data={data} onUpdate={onUpdate} />
        ) : activeTab === 'slitting' ? (
          <SlittingManager data={data} />
        ) : activeTab === 'plant' ? (
          <PlantQueueView data={data} />
        ) : (
          <ProductionPlanner data={data} isUserView={true} />
        )}
      </div>
    </div>
  );
};
