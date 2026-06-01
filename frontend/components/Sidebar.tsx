'use client';
import { useEffect, useState } from 'react';
import api from '@/lib/api';

interface SidebarProps {
  onModuleChange: (module: 'detection' | 'map' | 'analytics' | 'live') => void;
  activeModule: string;
  refreshTrigger: number;
}

export default function Sidebar({ onModuleChange, activeModule, refreshTrigger }: SidebarProps) {
  const [summary, setSummary] = useState<any>(null);

  useEffect(() => {
    api.get('/api/v1/analytics/summary').then(res => setSummary(res.data));
  }, [refreshTrigger]);

  useEffect(() => {
    const interval = setInterval(() => {
      api.get('/api/v1/analytics/summary').then(res => setSummary(res.data));
    }, 60000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="h-full flex flex-col p-4 space-y-6">
      {/* Quick Stats */}
      <div>
        <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">Quick Stats</h3>
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-slate-300">Total</span>
            <span className="font-bold">{summary?.total_potholes ?? '...'}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-slate-300">Critical</span>
            <span className="font-bold text-red-400">{summary?.critical_count ?? '...'}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-slate-300">Repair Rate</span>
            <span className="font-bold text-green-400">
              {summary ? `${(summary.repair_rate * 100).toFixed(0)}%` : '...'}
            </span>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="space-y-1">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">Modules</h3>
        <button
          onClick={() => onModuleChange('detection')}
          className={`w-full text-left px-3 py-2 rounded-md flex items-center space-x-2 transition-colors ${
            activeModule === 'detection' ? 'bg-blue-600/20 text-blue-400' : 'text-slate-300 hover:bg-slate-700/50'
          }`}
        >
          <span>🔍</span> <span>Detection</span>
        </button>
        <button
          onClick={() => onModuleChange('map')}
          className={`w-full text-left px-3 py-2 rounded-md flex items-center space-x-2 transition-colors ${
            activeModule === 'map' ? 'bg-blue-600/20 text-blue-400' : 'text-slate-300 hover:bg-slate-700/50'
          }`}
        >
          <span>🗺️</span> <span>Map</span>
        </button>
        <button
          onClick={() => onModuleChange('analytics')}
          className={`w-full text-left px-3 py-2 rounded-md flex items-center space-x-2 transition-colors ${
            activeModule === 'analytics' ? 'bg-blue-600/20 text-blue-400' : 'text-slate-300 hover:bg-slate-700/50'
          }`}
        >
          <span>📊</span> <span>Analytics</span>
        </button>
        <button
          onClick={() => onModuleChange('live')}
          className={`w-full text-left px-3 py-2 rounded-md flex items-center space-x-2 transition-colors ${
            activeModule === 'live' ? 'bg-blue-600/20 text-blue-400' : 'text-slate-300 hover:bg-slate-700/50'
          }`}
        >
          <span>📡</span> <span>Live Monitor</span>
        </button>
      </nav>
    </div>
  );
}