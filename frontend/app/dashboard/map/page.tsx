'use client';
import { useEffect, useState } from 'react';
import DashboardMap from '@/components/DashboardMap';
import { api } from '@/lib/api';
import { ProjectMapPoint } from '@/lib/types';
import { ArrowLeft, Layers, ShieldCheck, Maximize2 } from 'lucide-react';
import Link from 'next/link';

export default function FullMapPage() {
  const [projects, setProjects] = useState<ProjectMapPoint[]>([]);

  useEffect(() => {
    const fetchMapData = async () => {
      try {
        const data = await api.getMapProjects();
        setProjects(data);
      } catch (e) {
        console.error(e);
      }
    };
    fetchMapData();
  }, []);

  return (
    <div className="h-screen w-full relative bg-slate-100">
      {/* Overlay Header */}
      <div className="absolute top-6 left-6 right-6 z-20 flex justify-between items-start pointer-events-none">
        <div className="flex items-center gap-4 pointer-events-auto">
          <Link href="/dashboard">
            <button className="p-4 bg-white/90 backdrop-blur-xl border border-white shadow-2xl rounded-2xl text-rakshak-navy hover:bg-rakshak-navy hover:text-white transition-all">
              <ArrowLeft className="w-5 h-5" />
            </button>
          </Link>
          <div className="p-4 bg-white/90 backdrop-blur-xl border border-white shadow-2xl rounded-2xl">
            <div className="flex items-center gap-3">
              <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
              <h1 className="text-sm font-black text-rakshak-navy uppercase tracking-widest leading-none">Live National Integrity Map</h1>
            </div>
            <p className="text-[10px] text-slate-400 font-bold mt-1 uppercase tracking-tighter">Monitoring {projects.length} Field Operations</p>
          </div>
        </div>

        <div className="pointer-events-auto flex flex-col gap-3">
          <div className="p-4 bg-white/90 backdrop-blur-xl border border-white shadow-2xl rounded-2xl w-64">
             <div className="flex items-center justify-between mb-4 border-b border-slate-100 pb-3">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Map Layers</span>
                <Layers className="w-4 h-4 text-slate-300" />
             </div>
             <div className="space-y-3">
                <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-slate-600">3D Terrain</span>
                    <input type="checkbox" checked readOnly className="accent-rakshak-blue" />
                </div>
                <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-slate-600">Active High Risk</span>
                    <input type="checkbox" checked readOnly className="accent-red-500" />
                </div>
                <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-slate-600">Verified Evidence</span>
                    <input type="checkbox" checked readOnly className="accent-green-500" />
                </div>
             </div>
          </div>
          
          <div className="p-4 bg-rakshak-navy text-white shadow-2xl rounded-2xl flex items-center justify-between">
             <div className="flex items-center gap-3">
                <ShieldCheck className="w-5 h-5 text-rakshak-saffron" />
                <span className="text-[10px] font-black uppercase tracking-widest">Asset Integrity Secure</span>
             </div>
             <Maximize2 className="w-4 h-4 opacity-50" />
          </div>
        </div>
      </div>

      <div className="h-full w-full">
        <DashboardMap projects={projects} />
      </div>
    </div>
  );
}
