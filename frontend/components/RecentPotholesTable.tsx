'use client';
import { useEffect, useState } from 'react';
import api from '@/lib/api';

export default function RecentPotholesTable({ refreshTrigger }: { refreshTrigger: number }) {
  const [rows, setRows] = useState<any[]>([]);

  useEffect(() => {
    api.get('/api/v1/map/nearby?lat=12.9716&lon=77.5946&radius_km=100&min_severity=Low')
      .then(res => setRows(res.data.slice(0, 10))) // latest 10
      .catch(err => console.error(err));
  }, [refreshTrigger]);

  return (
    <div className="bg-white shadow rounded-lg p-4 overflow-x-auto">
      <h3 className="text-lg font-semibold text-gray-800 mb-2">Recent Pothole Reports</h3>
      <table className="min-w-full text-sm">
        <thead>
          <tr className="text-left text-gray-500">
            <th className="py-1">Location</th>
            <th className="py-1">Severity</th>
            <th className="py-1">Depth (cm)</th>
            <th className="py-1">Confidence</th>
            <th className="py-1">Date</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(r => (
            <tr key={r.id} className="border-t text-gray-700">
              <td className="py-1">{r.latitude.toFixed(4)}, {r.longitude.toFixed(4)}</td>
              <td className="py-1">{r.severity}</td>
              <td className="py-1">{r.depth_cm ?? '—'}</td>
              <td className="py-1">{r.confidence ? (r.confidence * 100).toFixed(0) + '%' : '—'}</td>
              <td className="py-1">{new Date(r.detected_at).toLocaleDateString()}</td>
            </tr>
          ))}
          {rows.length === 0 && (
            <tr><td colSpan={5} className="py-4 text-center text-gray-400">No potholes reported yet.</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}