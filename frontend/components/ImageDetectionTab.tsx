'use client';
import { useState } from 'react';
import api from '@/lib/api';

export default function ImageDetectionTab() {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const handleFile = (f: File) => {
    setFile(f);
    setPreview(URL.createObjectURL(f));
    setResult(null);
  };

  const handleUpload = async () => {
    if (!file) return;
    setLoading(true);
    const formData = new FormData();
    formData.append('file', file);
    try {
      const res = await api.post('/api/v1/detect/image?return_image=true', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setResult(res.data);
    } catch (err) {
      console.error(err);
      alert('Detection failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Upload area */}
      <div
        onDrop={e => {
          e.preventDefault();
          const f = e.dataTransfer.files[0];
          if (f) handleFile(f);
        }}
        onDragOver={e => e.preventDefault()}
        onClick={() => document.getElementById('imgInput')?.click()}
        className="border-2 border-dashed border-slate-600 rounded-2xl p-10 text-center hover:border-blue-400 cursor-pointer transition-colors"
      >
        {preview ? (
          <img src={preview} alt="Preview" className="max-h-80 mx-auto rounded-lg shadow-lg" />
        ) : (
          <div className="text-slate-400">
            <svg className="w-14 h-14 mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <p>Drag & drop image or click</p>
          </div>
        )}
        <input id="imgInput" type="file" accept="image/*" className="hidden" onChange={e => e.target.files && handleFile(e.target.files[0])} />
      </div>

      <button
        onClick={handleUpload}
        disabled={!file || loading}
        className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-xl font-semibold disabled:opacity-50 transition"
      >
        {loading ? 'Processing...' : 'Detect Potholes'}
      </button>

      {/* Result */}
      {result && result.image_with_boxes_base64 && (
        <div className="bg-slate-800 rounded-xl p-6">
          <img src={`data:image/jpeg;base64,${result.image_with_boxes_base64}`} alt="Result" className="rounded-lg shadow-lg" />
          <div className="mt-4 space-y-2">
            <h3 className="text-lg font-semibold">Detections</h3>
            {result.detections.map((det: any, i: number) => (
              <div key={i} className="bg-slate-700/50 p-3 rounded">
                <span className="font-bold">{det.class_name}</span> – {(det.confidence * 100).toFixed(1)}%
                {det.depth_cm && <span className="ml-2 text-blue-400">Depth: {det.depth_cm}cm</span>}
                {det.severity && (
                  <span className={`ml-2 px-2 py-0.5 rounded text-xs font-bold ${
                    det.severity === 'Critical' ? 'bg-red-600' :
                    det.severity === 'Dangerous' ? 'bg-orange-600' :
                    det.severity === 'Moderate' ? 'bg-yellow-600' : 'bg-green-600'
                  }`}>
                    {det.severity}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}