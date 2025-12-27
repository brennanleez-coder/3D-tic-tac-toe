'use client';

import dynamic from 'next/dynamic';

// Dynamic import to avoid SSR issues with Three.js
const Game = dynamic(() => import('@/components/Game'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-screen bg-gradient-to-br from-slate-950 via-purple-950 to-slate-950 flex items-center justify-center">
      <div className="text-center">
        <div className="w-16 h-16 border-4 border-purple-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
        <p className="text-purple-300 text-lg font-medium">Loading 3D Game...</p>
      </div>
    </div>
  ),
});

export default function Home() {
  return <Game />;
}
