'use client';
import { useState } from 'react';
import dynamic from 'next/dynamic';
import Sidebar from './Sidebar';

const MapView = dynamic(() => import('./MapView'), { ssr: false });
const LiveMonitor = dynamic(() => import('./LiveMonitor'), { ssr: false });
import AnalyticsView from './AnalyticsView';

export default function AppShell({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [activeModule, setActiveModule] = useState<'detection' | 'map' | 'analytics' | 'live'>('detection');
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const handleModuleChange = (module: 'detection' | 'map' | 'analytics' | 'live') => {
    setActiveModule(module);
    setSidebarOpen(false);
  };

  const handleReportSuccess = () => setRefreshTrigger(prev => prev + 1);

  return (
    <div className="h-screen flex flex-col bg-slate-900 text-slate-200">
      {/* Top bar – always visible */}
      <header className="h-14 bg-slate-800 border-b border-slate-700 flex items-center px-4 flex-shrink-0 z-50">
        <button
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className="mr-4 p-1.5 rounded-md hover:bg-slate-700 text-slate-300 lg:hidden"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
        <h1 className="text-lg font-semibold text-blue-400 tracking-tight">
          Pothole Detection
        </h1>
        <div className="flex-1" />
      </header>

      {/* Body */}
      <div className="flex-1 flex relative overflow-hidden">
        {/* Sidebar overlay (mobile) – high z‑index to cover map */}
        {sidebarOpen && (
          <div
            className="fixed inset-0 bg-black/50 lg:hidden"
            style={{ zIndex: 99998 }}
            onClick={() => setSidebarOpen(false)}
          />
        )}

        {/* Sidebar panel – highest z‑index so it appears above everything */}
        <div
          className={`
            fixed top-14 left-0 h-full w-64 bg-slate-800/95 backdrop-blur-md
            transform transition-transform duration-300 border-r border-slate-700
            ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
            lg:static lg:translate-x-0 lg:z-auto
          `}
          style={{ zIndex: 99999 }}
        >
          <Sidebar
            onModuleChange={handleModuleChange}
            activeModule={activeModule}
            refreshTrigger={refreshTrigger}
          />
        </div>

        {/* Main content */}
        <main className="flex-1 overflow-y-auto">
          {activeModule === 'detection' && children}
          {activeModule === 'map' && (
            <MapView onReportSuccess={handleReportSuccess} />
          )}
          {activeModule === 'analytics' && <AnalyticsView />}
          {activeModule === 'live' && <LiveMonitor />}
        </main>
      </div>
    </div>
  );
}