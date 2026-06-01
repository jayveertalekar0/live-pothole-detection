'use client';
import { useState, useRef } from 'react';
import api from '@/lib/api';

export default function VideoDetectionTab() {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [error, setError] = useState(false);
  const playerRef = useRef<HTMLVideoElement>(null);

  const handleFile = (f: File) => {
    setFile(f);
    setVideoUrl(null);
    setError(false);
  };

  const handleUpload = async () => {
    if (!file) return;
    setLoading(true);
    const formData = new FormData();
    formData.append('file', file);
    try {
      const res = await api.post('/api/v1/detect/video', formData, {
        responseType: 'blob',
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      // Get actual MIME type from response headers
      const contentType = (res.headers['content-type'] as string) || 'video/mp4';
      const url = URL.createObjectURL(
        new Blob([res.data], { type: contentType })
      );
      setVideoUrl(url);
    } catch (err) {
      console.error(err);
      alert('Video processing failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Drop zone – unchanged */}
      <div
        onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) handleFile(f); }}
        onDragOver={e => e.preventDefault()}
        onClick={() => document.getElementById('vidInput')?.click()}
        className="border-2 border-dashed border-slate-600 rounded-2xl p-10 text-center hover:border-blue-400 cursor-pointer transition-colors"
      >
        {file ? (
          <div className="text-slate-300">
            <svg className="w-14 h-14 mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
            <p className="font-mono text-sm truncate">{file.name}</p>
          </div>
        ) : (
          <div className="text-slate-400">
            <svg className="w-14 h-14 mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
            <p>Drag & drop video or click</p>
            <p className="text-xs mt-1">MP4, MOV, AVI</p>
          </div>
        )}
        <input
          id="vidInput"
          type="file"
          accept="video/*"
          className="hidden"
          onChange={e => e.target.files && handleFile(e.target.files[0])}
        />
      </div>

      <button
        onClick={handleUpload}
        disabled={!file || loading}
        className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-xl font-semibold disabled:opacity-50 transition"
      >
        {loading ? 'Processing...' : 'Process Video'}
      </button>

      {videoUrl && (
        <div className="bg-slate-800 rounded-xl overflow-hidden shadow-2xl">
          {error ? (
            <div className="p-6 text-center">
              <p className="text-red-400 mb-2">This browser can’t play the processed video natively.</p>
              <a
                href={videoUrl}
                download="pothole_detected.mp4"
                className="inline-block bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg"
              >
                ⬇️ Download video to play offline
              </a>
            </div>
          ) : (
            <video
              ref={playerRef}
              controls
              autoPlay
              muted
              className="w-full max-h-[70vh] object-contain"
              src={videoUrl}
              onError={() => setError(true)}
            />
          )}
          {!error && (
            <div className="px-4 py-2 flex justify-end">
              <a
                href={videoUrl}
                download="pothole_detected.mp4"
                className="text-xs text-blue-400 hover:underline"
              >
                Download backup
              </a>
            </div>
          )}
        </div>
      )}
    </div>
  );
}