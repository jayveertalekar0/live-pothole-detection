'use client';
import { useState, useEffect, useCallback, useRef } from 'react';
import dynamic from 'next/dynamic';
import api from '@/lib/api';

const PotholeMapWithVehicle = dynamic(() => import('./PotholeMapWithVehicle'), { ssr: false });

function getDistanceMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371e3;
  const phi1 = (lat1 * Math.PI) / 180;
  const phi2 = (lat2 * Math.PI) / 180;
  const dPhi = ((lat2 - lat1) * Math.PI) / 180;
  const dLambda = ((lon2 - lon1) * Math.PI) / 180;
  const a = Math.sin(dPhi / 2) ** 2 + Math.cos(phi1) * Math.cos(phi2) * Math.sin(dLambda / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function getBearing(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const lat1Rad = (lat1 * Math.PI) / 180;
  const lat2Rad = (lat2 * Math.PI) / 180;
  const y = Math.sin(dLon) * Math.cos(lat2Rad);
  const x =
    Math.cos(lat1Rad) * Math.sin(lat2Rad) - Math.sin(lat1Rad) * Math.cos(lat2Rad) * Math.cos(dLon);
  const brng = (Math.atan2(y, x) * 180) / Math.PI;
  return (brng + 360) % 360;
}

export default function LiveMonitor() {
  // ---------- location ----------
  const [currentPos, setCurrentPos] = useState<{ lat: number; lng: number } | null>(null);
  const [tracking, setTracking] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);
  const watchIdRef = useRef<number | null>(null);

  // ---------- camera ----------
  const [cameraReady, setCameraReady] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);    // visible camera preview
  const overlayCanvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // ---------- controls ----------
  const [confThreshold, setConfThreshold] = useState<number>(0.2);
  const [estimateDepth, setEstimateDepth] = useState<boolean>(false);

  // ---------- detection state ----------
  const [detectionCount, setDetectionCount] = useState(0);
  // This ref holds the latest detection results to be drawn on the overlay canvas
  const detectionsRef = useRef<any[]>([]);

  // ---------- alerts & map ----------
  const [alerts, setAlerts] = useState<string[]>([]);
  const [mapRefreshTrigger, setMapRefreshTrigger] = useState(0);

  // ---------- orientation / speed ----------
  const [heading, setHeading] = useState<number | null>(null);
  const [speed, setSpeed] = useState<number>(0);
  const prevPosRef = useRef<{ lat: number; lng: number; timestamp: number } | null>(null);

  // ---------- loop control ----------
  const runningRef = useRef(false);
  const isProcessingRef = useRef(false);
  const lastFrameTimeRef = useRef<number>(0);
  const reportedPotholesRef = useRef<{ lat: number; lng: number; timestamp: number }[]>([]);
  const [snapshotReporting, setSnapshotReporting] = useState(false);
  const animationFrameIdRef = useRef<number | null>(null);

  // ---------- orientation listener ----------
  useEffect(() => {
    const handleOrientation = (e: DeviceOrientationEvent) => {
      const h = (e as any).webkitCompassHeading || (e.alpha !== null ? 360 - e.alpha : null);
      if (h !== null) setHeading(h);
    };
    window.addEventListener('deviceorientation', handleOrientation);
    return () => window.removeEventListener('deviceorientation', handleOrientation);
  }, []);

  // ---------- start/stop ----------
  const startTracking = useCallback(async () => {
    if (!navigator.geolocation) {
      setLocationError('Geolocation not supported');
      return;
    }
    setLocationError(null);

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCurrentPos({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        if (pos.coords.heading !== null) setHeading(pos.coords.heading);
        if (pos.coords.speed !== null) setSpeed(pos.coords.speed);
      },
      () => setLocationError('Location denied – GPS tagging disabled.'),
      { enableHighAccuracy: true, timeout: 10000 }
    );

    const id = navigator.geolocation.watchPosition(
      (pos) => {
        const now = Date.now();
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        setCurrentPos({ lat, lng });
        setLocationError(null);
        if (pos.coords.heading !== null) setHeading(pos.coords.heading);

        let calculatedSpeed = pos.coords.speed || 0;
        if (prevPosRef.current) {
          const dist = getDistanceMeters(prevPosRef.current.lat, prevPosRef.current.lng, lat, lng);
          const dt = (now - prevPosRef.current.timestamp) / 1000;
          if (dt > 0.5 && calculatedSpeed === 0) calculatedSpeed = dist / dt;
        }
        setSpeed(calculatedSpeed);
        prevPosRef.current = { lat, lng, timestamp: now };
      },
      () => {
        setLocationError('Location tracking stopped');
        setTracking(false);
      },
      { enableHighAccuracy: true, maximumAge: 1000, timeout: 10000 }
    );
    watchIdRef.current = id;

    // ---------- get local camera ----------
    try {
      const s = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: 640, height: 480 },
      });
      streamRef.current = s;
      if (videoRef.current) {
        videoRef.current.srcObject = s;
        await videoRef.current.play();
      }
      setCameraReady(true);
    } catch (e) {
      setLocationError('Camera access denied');
    }

    setTracking(true);
    runningRef.current = true;
  }, []);

  const stopTracking = useCallback(() => {
    runningRef.current = false;
    // Cancel any pending animation frame
    if (animationFrameIdRef.current) {
      cancelAnimationFrame(animationFrameIdRef.current);
      animationFrameIdRef.current = null;
    }
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    setTracking(false);
    setCameraReady(false);
    setDetectionCount(0);
    setAlerts([]);
    detectionsRef.current = [];
  }, []);

  useEffect(() => {
    return () => {
      runningRef.current = false;
      if (animationFrameIdRef.current) cancelAnimationFrame(animationFrameIdRef.current);
      if (watchIdRef.current !== null) navigator.geolocation.clearWatch(watchIdRef.current);
      if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop());
    };
  }, []);

  // ---------- auto‑reporting loop (every 5s) + overlay drawing ----------
  useEffect(() => {
    if (!cameraReady) return;
    const video = videoRef.current;
    if (!video) return;

    const detectCanvas = document.createElement('canvas');
    const detectCtx = detectCanvas.getContext('2d');
    if (!detectCtx) return;

    const loop = async () => {
      if (!runningRef.current) return;
      if (isProcessingRef.current) {
        animationFrameIdRef.current = requestAnimationFrame(loop);
        return;
      }

      const now = Date.now();
      // throttle detection to every 5s
      if (now - lastFrameTimeRef.current < 5000) {
        animationFrameIdRef.current = requestAnimationFrame(loop);
        return;
      }
      lastFrameTimeRef.current = now;

      // capture low‑res frame for detection
      const targetWidth = 320;
      const aspect = video.videoHeight / video.videoWidth;
      const targetHeight = Math.round(targetWidth * aspect);
      detectCanvas.width = targetWidth;
      detectCanvas.height = targetHeight;
      detectCtx.drawImage(video, 0, 0, targetWidth, targetHeight);

      const blob = await new Promise<Blob | null>(res => detectCanvas.toBlob(res, 'image/jpeg', 0.6));
      if (!blob) {
        animationFrameIdRef.current = requestAnimationFrame(loop);
        return;
      }

      const formData = new FormData();
      formData.append('file', blob, 'frame.jpg');
      isProcessingRef.current = true;

      try {
        const response = await api.post(
          `/api/v1/detect/image?return_image=false&conf=${confThreshold}&estimate_depth=${estimateDepth}`,
          formData,
          { headers: { 'Content-Type': 'multipart/form-data' } }
        );
        const data = response.data;
        setDetectionCount(data.detections?.length || 0);
        detectionsRef.current = data.detections || [];

        // auto‑report to map if GPS available
        if (data.detections?.length > 0 && currentPos) {
          const now2 = Date.now();
          reportedPotholesRef.current = reportedPotholesRef.current.filter(
            p => now2 - p.timestamp < 10000
          );
          for (const det of data.detections) {
            const duplicate = reportedPotholesRef.current.some(
              p => getDistanceMeters(p.lat, p.lng, currentPos.lat, currentPos.lng) < 10
            );
            if (!duplicate) {
              reportedPotholesRef.current.push({
                lat: currentPos.lat,
                lng: currentPos.lng,
                timestamp: now2,
              });
              await api.post('/api/v1/map/pothole', {
                latitude: currentPos.lat,
                longitude: currentPos.lng,
                severity: det.severity || 'Moderate',
                depth_cm: det.depth_cm || null,
                confidence: det.confidence,
                width_cm: det.width_cm || null,
                length_cm: det.length_cm || null,
                area_cm2: det.area_cm2 || null,
                mask: det.mask || null,
                bbox: det.bbox || null,
              });
            }
          }
          setMapRefreshTrigger(prev => prev + 1);
        }
      } catch (e) {
        // ignore
      } finally {
        isProcessingRef.current = false;
      }

      animationFrameIdRef.current = requestAnimationFrame(loop);
    };

    animationFrameIdRef.current = requestAnimationFrame(loop);
    return () => {
      if (animationFrameIdRef.current) cancelAnimationFrame(animationFrameIdRef.current);
    };
  }, [cameraReady, currentPos, confThreshold, estimateDepth]);

  // ---------- overlay canvas drawing (runs every frame) ----------
  useEffect(() => {
    let animId: number;
    const draw = () => {
      const video = videoRef.current;
      const canvas = overlayCanvasRef.current;
      if (!video || !canvas || video.videoWidth === 0) {
        animId = requestAnimationFrame(draw);
        return;
      }

      // match canvas to video dimensions
      if (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
      }

      const ctx = canvas.getContext('2d');
      if (!ctx) {
        animId = requestAnimationFrame(draw);
        return;
      }

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const dets = detectionsRef.current;
      if (dets.length > 0) {
        const scaleX = canvas.width / 320;   // detection was on 320px width
        const scaleY = canvas.height / (video.videoHeight * (320 / video.videoWidth));

        for (const det of dets) {
          // Blue mask
          if (det.mask && det.mask.length > 2) {
            ctx.beginPath();
            ctx.moveTo(det.mask[0].x * scaleX, det.mask[0].y * scaleY);
            for (let i = 1; i < det.mask.length; i++) {
              ctx.lineTo(det.mask[i].x * scaleX, det.mask[i].y * scaleY);
            }
            ctx.closePath();
            ctx.fillStyle = 'rgba(0, 0, 255, 0.25)';
            ctx.fill();
            ctx.strokeStyle = 'rgba(0, 0, 255, 0.8)';
            ctx.lineWidth = 2;
            ctx.stroke();
          }

          // Bounding box (hollow green)
          const { x1, y1, x2, y2 } = det.bbox;
          ctx.strokeStyle = '#00ff00';
          ctx.lineWidth = 2;
          ctx.strokeRect(x1 * scaleX, y1 * scaleY, (x2 - x1) * scaleX, (y2 - y1) * scaleY);

          // Label
          ctx.font = 'bold 14px Inter, sans-serif';
          ctx.fillStyle = 'white';
          ctx.shadowColor = 'black';
          ctx.shadowBlur = 4;
          const conf = (det.confidence * 100).toFixed(0);
          ctx.fillText(`Pothole ${conf}%`, x1 * scaleX, y1 * scaleY - 10);
          if (det.depth_cm) {
            ctx.font = '12px Inter, sans-serif';
            ctx.fillText(`Depth: ${det.depth_cm}cm`, x1 * scaleX, y1 * scaleY + 20);
          }
          if (det.severity) {
            ctx.font = '12px Inter, sans-serif';
            ctx.fillText(`Sev: ${det.severity}`, x1 * scaleX, y1 * scaleY + 35);
          }
          ctx.shadowColor = 'transparent';
          ctx.shadowBlur = 0;
        }
      }
      animId = requestAnimationFrame(draw);
    };
    animId = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(animId);
  }, []);

  // ---------- manual snapshot & report ----------
  const captureSnapshotAndReport = async () => {
    const video = videoRef.current;
    if (!video || !cameraReady || !currentPos) {
      alert('Camera or GPS not ready.');
      return;
    }
    setSnapshotReporting(true);
    try {
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth || 640;
      canvas.height = video.videoHeight || 480;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const blob = await new Promise<Blob | null>(res => canvas.toBlob(res, 'image/jpeg', 0.9));
        if (blob) {
          const formData = new FormData();
          formData.append('file', blob, 'snapshot.jpg');
          const response = await api.post(
            `/api/v1/detect/image?return_image=false&conf=${confThreshold}&estimate_depth=true`,
            formData,
            { headers: { 'Content-Type': 'multipart/form-data' } }
          );
          const detections = response.data.detections || [];
          if (detections.length > 0) {
            for (const det of detections) {
              await api.post('/api/v1/map/pothole', {
                latitude: currentPos.lat,
                longitude: currentPos.lng,
                severity: det.severity || 'Moderate',
                depth_cm: det.depth_cm || null,
                confidence: det.confidence,
                width_cm: det.width_cm || null,
                length_cm: det.length_cm || null,
                area_cm2: det.area_cm2 || null,
                mask: det.mask || null,
                bbox: det.bbox || null,
              });
            }
            setAlerts(prev => [`📸 Snapshot reported: ${detections.length} pothole(s) detected and saved.`, ...prev].slice(0, 5));
          } else {
            setAlerts(prev => [`📸 Snapshot reported: No potholes detected.`, ...prev].slice(0, 5));
          }
          setMapRefreshTrigger(prev => prev + 1);
        }
      }
    } catch (err) {
      console.error(err);
      alert('Failed to report snapshot.');
    } finally {
      setSnapshotReporting(false);
    }
  };

  // ---------- orientation‑based alerts ----------
  const checkForAlerts = useCallback(async (lat: number, lon: number) => {
    try {
      const res = await api.get('/api/v1/map/nearby', {
        params: { lat, lon, radius_km: 0.1, min_severity: 'Dangerous' },
      });
      const dangerous = res.data.filter(
        (p: any) => p.severity === 'Dangerous' || p.severity === 'Critical'
      );
      if (dangerous.length > 0) {
        const aheadPotholes = dangerous.filter((p: any) => {
          if (heading === null) return true;
          const bearing = getBearing(lat, lon, p.latitude, p.longitude);
          let diff = Math.abs(bearing - heading);
          if (diff > 180) diff = 360 - diff;
          return diff <= 30;
        });

        const criticalPotholes = aheadPotholes.filter((p: any) => {
          const dist = getDistanceMeters(lat, lon, p.latitude, p.longitude);
          const tti = speed > 1 ? dist / speed : (dist < 10 ? 5 : Infinity);
          return tti < 10;
        });

        if (criticalPotholes.length > 0) {
          const msg = `⚠️ ${criticalPotholes.length} critical pothole(s) ahead. Slow down.`;
          setAlerts(prev => [msg, ...prev].slice(0, 5));
          if (typeof window !== 'undefined' && window.speechSynthesis) {
            window.speechSynthesis.cancel();
            const utterance = new SpeechSynthesisUtterance(msg);
            utterance.rate = 0.9;
            window.speechSynthesis.speak(utterance);
          }
        }
      }
    } catch {}
  }, [heading, speed]);

  useEffect(() => {
    if (!tracking || !currentPos) return;
    checkForAlerts(currentPos.lat, currentPos.lng);
    const interval = setInterval(() => {
      if (currentPos) checkForAlerts(currentPos.lat, currentPos.lng);
    }, 3000);
    return () => clearInterval(interval);
  }, [tracking, currentPos, checkForAlerts]);

  // ---------- UI ----------
  return (
    <div className="h-full flex flex-col bg-slate-900 text-slate-100">
      {/* Top bar */}
      <div className="bg-slate-800 border-b border-slate-700 p-3 flex flex-wrap items-center gap-3">
        <div>
          <h3 className="text-sm font-semibold text-blue-400">Live Road Monitor</h3>
          {currentPos ? (
            <p className="text-xs text-slate-400">
              {currentPos.lat.toFixed(5)}, {currentPos.lng.toFixed(5)} | Dir:{' '}
              {heading !== null ? `${heading.toFixed(0)}°` : 'N/A'} | Spd:{' '}
              {(speed * 3.6).toFixed(0)} km/h
            </p>
          ) : (
            <p className="text-xs text-slate-400">{locationError || 'Not tracking'}</p>
          )}
        </div>

        <button
          onClick={tracking ? stopTracking : startTracking}
          className={`px-5 py-2 rounded-lg font-medium transition cursor-pointer ${
            tracking
              ? 'bg-red-600 hover:bg-red-700 text-white'
              : 'bg-green-600 hover:bg-green-700 text-white'
          }`}
        >
          {tracking ? 'Stop' : 'Start Tracking'}
        </button>

        <div className="flex items-center gap-1 text-xs">
          <span className="text-slate-400">Conf:</span>
          <input
            type="range"
            min={0.05}
            max={1.0}
            step={0.05}
            value={confThreshold}
            onChange={(e) => setConfThreshold(Number(e.target.value))}
            className="w-20 accent-blue-500 cursor-pointer h-1 bg-slate-700 rounded-lg appearance-none"
          />
          <span>{confThreshold.toFixed(2)}</span>
        </div>

        <label className="flex items-center gap-1 text-xs text-slate-300 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={estimateDepth}
            onChange={(e) => setEstimateDepth(e.target.checked)}
            className="rounded text-blue-500 bg-slate-700 border-slate-600"
          />
          Depth
        </label>
      </div>

      {/* Main area */}
      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
        <div className="h-64 lg:h-full lg:flex-1 flex-shrink-0">
          {currentPos ? (
            <PotholeMapWithVehicle vehiclePos={currentPos} refreshTrigger={mapRefreshTrigger} />
          ) : (
            <div className="h-full flex items-center justify-center text-slate-500 text-sm">
              {tracking ? 'Acquiring GPS…' : 'Start tracking to see map'}
            </div>
          )}
        </div>

        <div className="w-full lg:w-80 bg-slate-800 border-t lg:border-l lg:border-t-0 border-slate-700 flex flex-col">
          <div className="p-3 border-b border-slate-700">
            <h3 className="text-sm font-semibold text-blue-400 mb-1">Live Detection</h3>
            <div className="rounded-lg overflow-hidden bg-black relative">
              {/* Local camera preview */}
              <video
                ref={videoRef}
                playsInline
                muted
                className="w-full h-36 lg:h-40 object-cover"
              />
              {/* Overlay canvas for detections */}
              <canvas
                ref={overlayCanvasRef}
                className="absolute top-0 left-0 w-full h-full pointer-events-none"
              />
            </div>

            <div className="mt-2 flex gap-2">
              <button
                onClick={captureSnapshotAndReport}
                disabled={!cameraReady || snapshotReporting}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold py-2 px-3 rounded-lg disabled:opacity-50 transition cursor-pointer"
              >
                {snapshotReporting ? 'Reporting Snapshot...' : '📸 Snapshot & Report'}
              </button>
            </div>

            <div className="mt-1 text-xs font-medium">
              {detectionCount === 0 ? (
                <span className="text-slate-400">🔍 No potholes detected</span>
              ) : (
                <span className="text-green-400">✅ {detectionCount} pothole(s) detected</span>
              )}
            </div>
          </div>

          <div className="flex-1 p-3 overflow-y-auto">
            <h3 className="text-sm font-semibold text-blue-400 mb-2">⚠️ Alerts</h3>
            {alerts.length === 0 ? (
              <p className="text-slate-500 text-sm">No dangerous potholes ahead.</p>
            ) : (
              <ul className="space-y-2">
                {alerts.map((msg, i) => (
                  <li
                    key={i}
                    className="bg-red-900/30 border border-red-700 rounded-lg p-2 text-sm text-red-200"
                  >
                    {msg}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}