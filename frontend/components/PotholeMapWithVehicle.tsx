'use client';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { useEffect, useState } from 'react';
import api from '@/lib/api';

const potholeIcon = L.icon({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});

const vehicleIcon = L.icon({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconSize: [35, 56],
  iconAnchor: [17, 56],
});

function MapController({ pos }: { pos: L.LatLngExpression }) {
  const map = useMap();
  useEffect(() => {
    map.setView(pos, map.getZoom());
  }, [pos, map]);
  return null;
}

export default function PotholeMapWithVehicle({
  vehiclePos,
  refreshTrigger,
}: {
  vehiclePos: { lat: number; lng: number } | null;
  refreshTrigger?: number;
}) {
  const [potholes, setPotholes] = useState<any[]>([]);

  // Fallback if vehiclePos is null (shouldn't happen when map is shown)
  const center: L.LatLngExpression = vehiclePos
    ? [vehiclePos.lat, vehiclePos.lng]
    : [12.9716, 77.5946];  // default fallback

  useEffect(() => {
    if (!vehiclePos) return;
    const fetchPotholes = async () => {
      try {
        const res = await api.get(
          `/api/v1/map/nearby?lat=${vehiclePos.lat}&lon=${vehiclePos.lng}&radius_km=1`
        );
        setPotholes(res.data);
      } catch {
        // silently ignore network errors
      }
    };
    fetchPotholes();
    const interval = setInterval(fetchPotholes, 5000);
    return () => clearInterval(interval);
  }, [vehiclePos, refreshTrigger]);

  return (
    <MapContainer center={center} zoom={16} style={{ height: '100%', width: '100%' }}>
      <TileLayer
        attribution='&copy; OpenStreetMap contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <MapController pos={center} />
      {vehiclePos && (
        <Marker position={[vehiclePos.lat, vehiclePos.lng]} icon={vehicleIcon}>
          <Popup>Your location</Popup>
        </Marker>
      )}
      {potholes.map(p => (
        <Marker key={p.id} position={[p.latitude, p.longitude]} icon={potholeIcon}>
          <Popup>
            <strong>{p.severity}</strong><br />
            Depth: {p.depth_cm} cm<br />
            {new Date(p.detected_at).toLocaleDateString()}
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  );
}