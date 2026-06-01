'use client';
import { useState, useRef } from 'react';
import api from '@/lib/api';

export default function DetectionPanel({ onReportSuccess }: { onReportSuccess?: () => void }) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [result, setResult] = useState<any>(null);
  const [mode, setMode] = useState<'image' | 'video'>('image');
  const [loading, setLoading] = useState(false);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [saveToDb, setSaveToDb] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedFile(e.target.files[0]);
      setResult(null);
      setVideoUrl(null);
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) return;
    setLoading(true);
    const formData = new FormData();
    formData.append('file', selectedFile);

    try {
      if (mode === 'image') {
        const res = await api.post('/api/v1/detect/image?return_image=true', formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
        setResult(res.data);
        // Optionally save each detection to DB
        if (saveToDb && res.data.detections?.length > 0) {
          for (const det of res.data.detections) {
            await api.post('/api/v1/map/pothole', {
              latitude: 12.9716, // demo fixed location
              longitude: 77.5946,
              severity: det.severity || 'Moderate',
              depth_cm: det.depth_cm || null,
              confidence: det.confidence,
            });
          }
          onReportSuccess?.();
        }
      } else {
        const res = await api.post('/api/v1/detect/video', formData, {
          responseType: 'blob',
          headers: { 'Content-Type': 'multipart/form-data' },
        });
        const url = URL.createObjectURL(new Blob([res.data], { type: 'video/mp4' }));
        setVideoUrl(url);
        // Video does not return per-frame detections so we can't auto-save; just show a note
      }
    } catch (error) {
      console.error(error);
      alert('Detection failed. Make sure the backend is running.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white shadow rounded-lg p-4 space-y-4">
      <h2 className="text-lg font-semibold text-gray-800">Pothole Detection</h2>
      <div className="flex gap-4">
        <button
          onClick={() => setMode('image')}
          className={`px-4 py-2 rounded ${mode === 'image' ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-800'}`}
        >
          Image
        </button>
        <button
          onClick={() => setMode('video')}
          className={`px-4 py-2 rounded ${mode === 'video' ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-800'}`}
        >
          Video
        </button>
      </div>

      <input
        type="file"
        accept={mode === 'image' ? 'image/*' : 'video/mp4,video/x-msvideo,video/quicktime'}
        onChange={handleFileChange}
        ref={fileInputRef}
        className="block w-full text-sm text-gray-700"
      />

      <label className="flex items-center space-x-2 text-sm text-gray-700">
        <input
          type="checkbox"
          checked={saveToDb}
          onChange={e => setSaveToDb(e.target.checked)}
        />
        <span>Save detection to database (GPS: demo location)</span>
      </label>

      <button
        onClick={handleUpload}
        disabled={!selectedFile || loading}
        className="bg-green-600 text-white px-4 py-2 rounded disabled:opacity-50"
      >
        {loading ? 'Processing...' : `Detect Potholes in ${mode}`}
      </button>

      {/* Image result */}
      {mode === 'image' && result?.image_with_boxes_base64 && (
        <div>
          <img
            src={`data:image/jpeg;base64,${result.image_with_boxes_base64}`}
            alt="detection result"
            className="max-w-full h-auto border"
          />
          <div className="mt-2 text-gray-800">
            <strong>Detections:</strong>
            <ul className="list-disc pl-5">
              {result.detections.map((det: any, idx: number) => (
                <li key={idx}>
                  {det.class_name} – Confidence: {(det.confidence * 100).toFixed(1)}%
                  {det.depth_cm && ` | Depth: ${det.depth_cm}cm`}
                  {det.severity && ` | Severity: ${det.severity}`}
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {/* Video result */}
      {mode === 'video' && videoUrl && (
        <div>
          <video controls src={videoUrl} className="w-full max-h-96" />
          <a href={videoUrl} download="detected_potholes.mp4" className="text-blue-600 underline mt-2 block">
            Download processed video
          </a>
        </div>
      )}
    </div>
  );
}