'use client';
import { useEffect, useState, useCallback } from 'react';
import dynamic from 'next/dynamic';
import api from '@/lib/api';

const PotholeMap = dynamic(() => import('./PotholeMap'), { ssr: false });

interface MapViewProps {
  onReportSuccess: () => void;
}

export default function MapView({ onReportSuccess }: MapViewProps) {
  const [potholes, setPotholes] = useState<any[]>([]);
  const [severityFilter, setSeverityFilter] = useState('All');
  const [mode, setMode] = useState<'markers' | 'clusters' | 'heatmap' | 'roadhealth'>('clusters');
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [loading, setLoading] = useState(true);
  const [routeResult, setRouteResult] = useState<any | null>(null);

  const fetchAllPotholes = useCallback(async () => {
    try {
      const res = await api.get('/api/v1/map/all?min_severity=Low&limit=5000');
      setPotholes(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAllPotholes();
  }, [fetchAllPotholes, refreshTrigger]);

  // WebSocket real‑time updates – connect to backend directly
  useEffect(() => {
    const apiBase = api.defaults.baseURL || 'http://localhost:8000';
    const wsUrl = apiBase.replace(/^http/, 'ws') + '/api/v1/ws';   // dev hard‑coded
    const ws = new WebSocket(wsUrl);

    ws.onmessage = (event) => {
      try {
        const item = JSON.parse(event.data);
        if (item && item.id) {
          setPotholes((prev) => {
            const existsIdx = prev.findIndex((p) => p.id === item.id);
            if (existsIdx >= 0) {
              const updated = [...prev];
              updated[existsIdx] = item;
              return updated;
            } else {
              return [item, ...prev];
            }
          });
        }
      } catch (err) {
        console.error('Error parsing WS message:', err);
      }
    };

    ws.onclose = () => console.log('WebSocket closed');

    return () => {
      ws.close();
    };
  }, []);

  const handleReportSuccess = () => {
    setRefreshTrigger(prev => prev + 1);
    onReportSuccess();
  };

  const filteredPotholes = severityFilter === 'All' ? potholes : potholes.filter(p => p.severity === severityFilter);

  return (
    <div className="h-full flex flex-col bg-slate-900 relative">
      {/* Header */}
      <div className="bg-slate-800 border-b border-slate-700 p-4 flex flex-wrap items-center gap-4 z-10">
        <h2 className="text-lg font-semibold text-white">Road Intelligence Map</h2>

        {/* Mode buttons – mobile friendly */}
        <div className="flex flex-wrap bg-slate-700 rounded-xl p-1 gap-1 w-full sm:w-auto">
          {(['markers', 'clusters', 'heatmap', 'roadhealth'] as const).map(m => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={`flex-1 sm:flex-none px-4 py-2.5 rounded-lg text-xs sm:text-sm font-semibold transition cursor-pointer min-h-[44px] ${
                mode === m ? 'bg-blue-600 text-white' : 'text-slate-300 hover:text-white hover:bg-slate-600'
              }`}
            >
              {m === 'markers' ? 'Markers' : m === 'clusters' ? 'Clusters' : m === 'heatmap' ? 'Heatmap' : 'Health'}
            </button>
          ))}
        </div>

        <select
          value={severityFilter}
          onChange={e => setSeverityFilter(e.target.value)}
          className="bg-slate-700 border border-slate-600 rounded-xl px-4 py-2.5 text-xs sm:text-sm text-white cursor-pointer min-h-[44px] focus:outline-none focus:border-blue-500"
        >
          <option>All</option>
          <option>Low</option>
          <option>Moderate</option>
          <option>Dangerous</option>
          <option>Critical</option>
        </select>

        <span className="text-sm text-slate-400 font-medium">{filteredPotholes.length} pothole(s)</span>

        {/* Route Risk Panel */}
        <div className="bg-slate-850 p-4 rounded-xl border border-slate-700 flex flex-col gap-3 w-full lg:w-auto">
          <h3 className="text-xs font-bold uppercase tracking-wider text-blue-400">Route Risk Analyzer</h3>
          <div className="flex gap-2 flex-wrap">
            <input id="startLat" type="number" step="0.000001" placeholder="Start Lat" className="bg-slate-700 text-white rounded-lg px-3 py-2 w-28 text-xs" />
            <input id="startLng" type="number" step="0.000001" placeholder="Start Lng" className="bg-slate-700 text-white rounded-lg px-3 py-2 w-28 text-xs" />
          </div>
          <div className="flex gap-2 flex-wrap">
            <input id="endLat" type="number" step="0.000001" placeholder="End Lat" className="bg-slate-700 text-white rounded-lg px-3 py-2 w-28 text-xs" />
            <input id="endLng" type="number" step="0.000001" placeholder="End Lng" className="bg-slate-700 text-white rounded-lg px-3 py-2 w-28 text-xs" />
          </div>
          <button
            onClick={async () => {
              const sl = (document.getElementById('startLat') as HTMLInputElement)?.value;
              const sn = (document.getElementById('startLng') as HTMLInputElement)?.value;
              const el = (document.getElementById('endLat') as HTMLInputElement)?.value;
              const en = (document.getElementById('endLng') as HTMLInputElement)?.value;
              if (!sl || !sn || !el || !en) return;
              try {
                const res = await api.get('/api/v1/map/route-risk', {
                  params: { origin_lat: sl, origin_lng: sn, dest_lat: el, dest_lng: en },
                });
                setRouteResult(res.data);
              } catch (e) {
                console.error(e);
                alert('Route analysis failed');
              }
            }}
            className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold px-4 py-2.5 rounded-lg min-h-[40px] cursor-pointer transition"
          >
            Analyze Route
          </button>
        </div>
      </div>

      {/* Route result floating card */}
      {routeResult && (
        <div className="absolute top-28 right-4 z-[1000] bg-slate-800/95 border border-slate-700 p-4 rounded-xl shadow-2xl w-80 text-slate-100 backdrop-blur-md">
          <div className="flex justify-between items-start mb-2 border-b border-slate-700 pb-1.5">
            <h4 className="font-bold text-sm text-blue-400">Route Safety Assessment</h4>
            <button onClick={() => setRouteResult(null)} className="text-slate-400 hover:text-white text-xs bg-slate-700/50 hover:bg-slate-700 rounded-full w-5 h-5 flex items-center justify-center font-bold">✕</button>
          </div>
          <div className="space-y-2 text-xs">
            <div className="flex justify-between">
              <span className="text-slate-400">Risk Assessment:</span>
              <span className={`font-bold px-2 py-0.5 rounded text-[10px] uppercase ${
                routeResult.risk_level === 'Critical' ? 'bg-red-900/50 text-red-300 border border-red-700' :
                routeResult.risk_level === 'Dangerous' ? 'bg-orange-900/50 text-orange-300 border border-orange-700' :
                routeResult.risk_level === 'Moderate' ? 'bg-yellow-900/50 text-yellow-300 border border-yellow-700' :
                'bg-green-900/50 text-green-300 border border-green-700'}`}>
                {routeResult.risk_level}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Total Score:</span>
              <span className="font-semibold text-slate-200">{routeResult.total_risk_score}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Critical Segments:</span>
              <span className="font-semibold text-red-400">{routeResult.critical_segments.length} ahead</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Est. Distance:</span>
              <span className="font-semibold text-slate-200">{routeResult.distance_km.toFixed(2)} km</span>
            </div>
          </div>
        </div>
      )}

      {/* Map area */}
      <div className="flex-1 h-64 lg:h-full relative">
        {loading ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-800 animate-pulse text-slate-400">
            <div className="w-12 h-12 border-4 border-t-blue-500 border-r-transparent border-slate-600 rounded-full animate-spin mb-4" />
            <span className="text-sm font-semibold tracking-wide">Loading Road Intelligence Map...</span>
          </div>
        ) : (
          <PotholeMap
            potholes={filteredPotholes}
            mode={mode}
            refreshTrigger={refreshTrigger}
            onReportSuccess={handleReportSuccess}
            routeResult={routeResult}
          />
        )}
      </div>
    </div>
  );
}