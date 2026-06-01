'use client';
import { useState } from 'react';
import ImageDetectionTab from '@/components/ImageDetectionTab';
import VideoDetectionTab from '@/components/VideoDetectionTab';

export default function Home() {
  const [tab, setTab] = useState<'image' | 'video'>('image');

  return (
    <div className="max-w-2xl mx-auto py-8">
      {/* Section heading */}
      <h2 className="text-2xl font-bold mb-6 text-center">Detect Potholes</h2>

      {/* Tab switcher */}
      <div className="flex justify-center mb-8">
        <div className="bg-slate-800 rounded-xl p-1 flex">
          <button
            onClick={() => setTab('image')}
            className={`px-6 py-2 rounded-lg text-sm font-medium transition ${
              tab === 'image' ? 'bg-blue-600 text-white shadow' : 'text-slate-400 hover:text-white'
            }`}
          >
            🖼️ Image
          </button>
          <button
            onClick={() => setTab('video')}
            className={`px-6 py-2 rounded-lg text-sm font-medium transition ${
              tab === 'video' ? 'bg-blue-600 text-white shadow' : 'text-slate-400 hover:text-white'
            }`}
          >
            🎬 Video
          </button>
        </div>
      </div>

      {/* Active tab content */}
      {tab === 'image' ? <ImageDetectionTab /> : <VideoDetectionTab />}
    </div>
  );
}