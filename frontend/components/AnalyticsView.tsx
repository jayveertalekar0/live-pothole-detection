'use client';
import { useEffect, useState } from 'react';
import api from '@/lib/api';
import SeverityPieChart from './SeverityPieChart';
import DailyDetectionsChart from './DailyDetectionsChart';

function ChartSkeleton() {
  return (
    <div className="w-full h-64 flex flex-col justify-between animate-pulse p-4">
      <div className="flex gap-2 items-end justify-around h-48 w-full px-4">
        <div className="bg-slate-700/60 w-6 h-12 rounded-t" />
        <div className="bg-slate-700/60 w-6 h-24 rounded-t" />
        <div className="bg-slate-700/60 w-6 h-36 rounded-t" />
        <div className="bg-slate-700/60 w-6 h-20 rounded-t" />
        <div className="bg-slate-700/60 w-6 h-16 rounded-t" />
        <div className="bg-slate-700/60 w-6 h-28 rounded-t" />
      </div>
      <div className="h-4 bg-slate-700/60 w-full rounded mt-4" />
      <div className="h-3 bg-slate-700/60 w-2/3 rounded mt-2" />
    </div>
  );
}

export default function AnalyticsView() {
  const [summary, setSummary] = useState<any>(null);
  const [severity, setSeverity] = useState<any>(null);
  const [daily, setDaily] = useState<any>(null);

  const fetchData = () => {
    api.get('/api/v1/analytics/summary').then(res => setSummary(res.data));
    api.get('/api/v1/analytics/severity-distribution').then(res => setSeverity(res.data));
    api.get('/api/v1/analytics/daily-detections?days=30').then(res => setDaily(res.data));
  };

  useEffect(() => {
    fetchData();
  }, []);

  return (
    <div className="max-w-5xl mx-auto py-8 px-4 text-slate-100">
      <h2 className="text-2xl font-bold mb-6">Analytics Dashboard</h2>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <Card title="Total Potholes" value={summary?.total_potholes ?? '...'} />
        <Card title="Critical" value={summary?.critical_count ?? '...'} color="text-red-400" />
        <Card title="Repair Rate" value={summary ? `${(summary.repair_rate * 100).toFixed(0)}%` : '...'} color="text-green-400" />
        <Card title="Detection Trend" value="+8%" color="text-blue-400" />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-slate-800 rounded-xl p-4 border border-slate-700">
          <h3 className="text-sm font-medium text-slate-400 mb-2">Severity Distribution</h3>
          {severity ? <SeverityPieChart data={severity} /> : <ChartSkeleton />}
        </div>
        <div className="bg-slate-800 rounded-xl p-4 border border-slate-700">
          <h3 className="text-sm font-medium text-slate-400 mb-2">Daily Detections (30 days)</h3>
          {daily ? <DailyDetectionsChart data={daily} /> : <ChartSkeleton />}
        </div>
      </div>
    </div>
  );
}

// Simple Card component
function Card({ title, value, color = 'text-slate-200' }: { title: string; value: string | number; color?: string }) {
  return (
    <div className="bg-slate-800 rounded-xl p-4 shadow-lg border border-slate-700">
      <p className="text-xs text-slate-400 uppercase tracking-wide">{title}</p>
      <p className={`text-2xl font-bold ${color}`}>{value}</p>
    </div>
  );
}