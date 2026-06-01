'use client';
import { useEffect, useRef, useState, useCallback, Fragment } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMapEvents, GeoJSON, Polygon } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet.heat';
import MarkerClusterGroup from 'react-leaflet-cluster';
import api from '@/lib/api';

const defaultIcon = L.icon({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});

const newMarkerIcon = L.icon({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});

const criticalIcon = L.divIcon({
  html: `<div class="bg-red-600 text-white rounded-full w-6 h-6 flex items-center justify-center font-bold border-2 border-white shadow-lg animate-pulse text-[10px]">!</div>`,
  className: '',
  iconSize: [24, 24],
  iconAnchor: [12, 12],
});

function LocationMarker({ onLocationSelect }: { onLocationSelect: (lat: number, lng: number) => void }) {
  useMapEvents({
    click(e) {
      onLocationSelect(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

function HeatmapLayer({ points }: { points: [number, number, number][] }) {
  const map = useMapEvents({});
  const heatRef = useRef<any>(null);

  useEffect(() => {
    if (!map) return;
    // @ts-ignore – leaflet.heat is a global plugin
    const heat = L.heatLayer(points, {
      radius: 25,
      blur: 15,
      maxZoom: 10,
      gradient: {
        0.2: 'blue',
        0.5: 'lime',
        0.8: 'orange',
        1.0: 'red'
      }
    }).addTo(map);
    heatRef.current = heat;
    return () => {
      map.removeLayer(heat);
    };
  }, [points, map]);

  return null;
}

function RoadHealthLayer() {
  const map = useMapEvents({});
  const geoJsonRef = useRef<L.GeoJSON | null>(null);

  const fetchHealth = useCallback(async () => {
    const bounds = map.getBounds();
    const sw = bounds.getSouthWest();
    const ne = bounds.getNorthEast();
    try {
      const res = await api.get('/api/v1/map/road-health', {
        params: {
          min_lat: sw.lat,
          max_lat: ne.lat,
          min_lng: sw.lng,
          max_lng: ne.lng,
          grid_size_km: 0.5,
        },
      });
      if (geoJsonRef.current) map.removeLayer(geoJsonRef.current);
      const layer = L.geoJSON(res.data, {
        style: (feature: any) => ({
          fillColor: feature.properties.color,
          fillOpacity: 0.45,
          color: '#000',
          weight: 0.5,
        }),
      }).addTo(map);
      geoJsonRef.current = layer;
    } catch (e) {
      console.error('Road health fetch failed', e);
    }
  }, [map]);

  useEffect(() => {
    fetchHealth();
    map.on('moveend', fetchHealth);
    return () => { map.off('moveend', fetchHealth); };
  }, [fetchHealth, map]);

  return null;
}

interface PotholeMapProps {
  potholes: any[];
  mode: 'markers' | 'clusters' | 'heatmap' | 'roadhealth';
  refreshTrigger: number;
  onReportSuccess: () => void;
  routeResult?: any | null;
}

export default function PotholeMap({
  potholes,
  mode,
  refreshTrigger,
  onReportSuccess,
  routeResult
}: PotholeMapProps) {
  const [newLat, setNewLat] = useState<number | null>(null);
  const [newLng, setNewLng] = useState<number | null>(null);
  const center: L.LatLngExpression = [20.5937, 78.9629];

  const handleMapClick = (lat: number, lng: number) => {
    setNewLat(lat);
    setNewLng(lng);
  };

  const handleFormSuccess = () => {
    setNewLat(null);
    setNewLng(null);
    onReportSuccess();
  };

  const heatmapPoints: [number, number, number][] = potholes.map(p => [
    p.latitude,
    p.longitude,
    Math.min(1, (p.severity === 'Critical' ? 1 : p.severity === 'Dangerous' ? 0.8 : p.severity === 'Moderate' ? 0.5 : 0.2) + (p.depth_cm ? p.depth_cm / 100 : 0))
  ] as [number, number, number]);

  const handleStatusChange = async (potholeId: string, newStatus: string) => {
    try {
      await api.patch(`/api/v1/map/pothole/${potholeId}`, {
        repair_status: newStatus
      });
    } catch (err) {
      console.error('Failed to patch status', err);
      alert('Failed to update status');
    }
  };

  const renderPopup = (p: any) => (
    <Popup>
      <div className="text-slate-900 min-w-[210px] font-sans">
        <div className="flex justify-between items-center border-b pb-1 mb-2">
          <strong className="text-xs font-bold text-blue-700">{p.severity} Pothole</strong>
          <span className="text-[9px] bg-slate-100 px-1 py-0.5 rounded text-slate-500 font-mono">
            {p.id.slice(-6)}
          </span>
        </div>
        <div className="space-y-1 text-xs mb-2">
          <div><span className="text-slate-500 font-medium">Depth:</span> {p.depth_cm ? `${p.depth_cm} cm` : 'N/A'}</div>
          <div><span className="text-slate-500 font-medium">Width/Len:</span> {p.width_cm && p.length_cm ? `${p.width_cm}x${p.length_cm} cm` : 'N/A'}</div>
          <div><span className="text-slate-500 font-medium">Area:</span> {p.area_cm2 ? `${p.area_cm2} cm²` : 'N/A'}</div>
          <div><span className="text-slate-500 font-medium">Report Count:</span> {p.report_count || p.detection_count || 1}</div>
          <div><span className="text-slate-500 font-medium">First Seen:</span> {new Date(p.first_seen || p.detected_at).toLocaleDateString()}</div>
          <div><span className="text-slate-500 font-medium">Last Seen:</span> {new Date(p.last_seen || p.detected_at).toLocaleDateString()}</div>
        </div>

        <div className="mt-2 pt-2 border-t">
          <label className="block text-[10px] text-slate-500 font-bold uppercase mb-1">Update Status</label>
          <select
            value={p.repair_status || 'Reported'}
            onChange={(e) => handleStatusChange(p.id, e.target.value)}
            className="w-full text-xs border border-slate-300 rounded-md px-1.5 py-1 bg-white text-slate-800 focus:outline-none"
          >
            <option value="Reported">Reported</option>
            <option value="Verified">Verified</option>
            <option value="In Progress">In Progress</option>
            <option value="Repaired">Repaired</option>
            <option value="Reappeared">Reappeared</option>
          </select>
        </div>

        {p.severity_history && p.severity_history.length > 0 && (
          <div className="mt-2 pt-2 border-t text-[10px] max-h-16 overflow-y-auto">
            <span className="text-slate-500 font-bold uppercase block mb-1">Severity Log</span>
            <ul className="list-disc pl-3 text-slate-600 space-y-0.5">
              {p.severity_history.map((sh: any, index: number) => (
                <li key={index}>
                  {new Date(sh.timestamp).toLocaleDateString()}: {sh.severity}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </Popup>
  );

  return (
    <MapContainer center={center} zoom={5} style={{ height: '100%', width: '100%' }}>
      <TileLayer
        attribution='&copy; OpenStreetMap contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <LocationMarker onLocationSelect={handleMapClick} />

      {routeResult && routeResult.route_geometry && (
        <GeoJSON
          data={routeResult.route_geometry}
          style={{ color: '#3b82f6', weight: 6, opacity: 0.8 }}
          key={JSON.stringify(routeResult.route_geometry)}
        />
      )}

      {routeResult && routeResult.critical_segments && routeResult.critical_segments.map((seg: any, idx: number) => (
        <Marker key={`crit-${idx}`} position={[seg.lat, seg.lng]} icon={criticalIcon}>
          <Popup>
            <div className="text-slate-900 text-xs">
              <strong className="text-red-600 font-semibold">Critical Risk Segment</strong>
              <p className="mt-1">Potholes detected within corridor: <strong>{seg.potholes}</strong></p>
              <p>Max Severity: <strong>{seg.max_severity}</strong></p>
            </div>
          </Popup>
        </Marker>
      ))}

      {mode === 'markers' &&
        potholes.map(p => (
          <Fragment key={p.id}>
            <Marker position={[p.latitude, p.longitude]} icon={defaultIcon}>
              {renderPopup(p)}
            </Marker>
            {p.polygon && p.polygon.length > 0 && (
              <Polygon
                positions={p.polygon}
                pathOptions={{
                  color: p.severity === 'Critical' ? '#ef4444' : p.severity === 'Dangerous' ? '#f97316' : '#eab308',
                  fillColor: p.severity === 'Critical' ? '#ef4444' : p.severity === 'Dangerous' ? '#f97316' : '#eab308',
                  fillOpacity: 0.35,
                  weight: 2
                }}
              />
            )}
          </Fragment>
        ))}

      {mode === 'clusters' && (
        <MarkerClusterGroup chunkedLoading>
          {potholes.map(p => (
            <Fragment key={p.id}>
              <Marker position={[p.latitude, p.longitude]} icon={defaultIcon}>
                {renderPopup(p)}
              </Marker>
              {p.polygon && p.polygon.length > 0 && (
                <Polygon
                  positions={p.polygon}
                  pathOptions={{
                    color: p.severity === 'Critical' ? '#ef4444' : p.severity === 'Dangerous' ? '#f97316' : '#eab308',
                    fillColor: p.severity === 'Critical' ? '#ef4444' : p.severity === 'Dangerous' ? '#f97316' : '#eab308',
                    fillOpacity: 0.35,
                    weight: 2
                  }}
                />
              )}
            </Fragment>
          ))}
        </MarkerClusterGroup>
      )}

      {mode === 'heatmap' && <HeatmapLayer points={heatmapPoints} />}
      {mode === 'roadhealth' && <RoadHealthLayer />}

      {newLat && newLng && (
        <Marker position={[newLat, newLng]} icon={newMarkerIcon}>
          <Popup>New report location</Popup>
        </Marker>
      )}

      {newLat && newLng && (
        <div className="absolute bottom-4 left-4 z-[1000] bg-white p-4 rounded-xl shadow-2xl text-slate-800">
          <p className="text-xs font-semibold">Report pothole at: {newLat.toFixed(5)}, {newLng.toFixed(5)}</p>
          <ReportForm lat={newLat} lng={newLng} onSuccess={handleFormSuccess} />
        </div>
      )}
    </MapContainer>
  );
}

function ReportForm({ lat, lng, onSuccess }: { lat: number; lng: number; onSuccess: () => void }) {
  const [severity, setSeverity] = useState('Moderate');
  const [depth, setDepth] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      await api.post('/api/v1/map/pothole', {
        latitude: lat,
        longitude: lng,
        severity,
        depth_cm: parseFloat(depth) || null,
        confidence: 1.0,
      });
      onSuccess();
    } catch (err) {
      console.error(err);
      alert('Failed to report');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex gap-2 mt-2">
      <select value={severity} onChange={e => setSeverity(e.target.value)} className="border p-1.5 rounded-lg text-xs bg-white">
        <option>Low</option>
        <option>Moderate</option>
        <option>Dangerous</option>
        <option>Critical</option>
      </select>
      <input
        type="number"
        placeholder="Depth (cm)"
        value={depth}
        onChange={e => setDepth(e.target.value)}
        className="border p-1.5 rounded-lg w-20 text-xs"
      />
      <button onClick={handleSubmit} disabled={submitting} className="bg-blue-600 hover:bg-blue-700 text-white px-3.5 py-1.5 rounded-lg text-xs font-semibold cursor-pointer">
        {submitting ? '...' : 'Report'}
      </button>
    </div>
  );
}