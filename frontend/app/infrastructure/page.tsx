'use client';

import Navbar from '@/components/Navbar';
import IntegrityTicker from '@/components/IntegrityTicker';
import NetworkMap3D from '@/components/NetworkMap3D';
import { motion } from 'framer-motion';

export default function Infrastructure() {
  return (
    <div className="min-h-screen bg-[#f1f4f9] overflow-hidden flex flex-col">
      <div className="fixed top-0 left-0 right-0 z-[100]">
        <IntegrityTicker />
      </div>
      <Navbar />

      <main className="flex-1 max-w-7xl mx-auto px-6 pt-32 md:pt-40 pb-20 w-full relative">
        <div className="absolute top-20 left-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-orange-500/10 blur-[100px] -z-10 rounded-full animate-pulse" />
        
        <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} className="text-center border-b border-slate-200 pb-16">
           <h1 className="text-3xl md:text-6xl font-black text-[#0f172a] mb-6 tracking-tight">
             National <span className="text-[#ea580c] italic">Infrastructure</span>
           </h1>
           <p className="text-slate-500 max-w-2xl mx-auto text-lg md:text-xl font-medium">
             Centralized view of all 12,847+ assets under live security and compliance monitoring.
           </p>
        </motion.div>

        <div className="mt-16 text-center">
            <h2 className="text-2xl font-black text-[#0f172a] mb-10">Select Region for Deep Analysis</h2>
            <div className="flex flex-wrap justify-center gap-4">
              {['Northern Grid', 'Southern Peninsula', 'Western Ghats', 'Eastern Hub', 'Central Backbone'].map((region, i) => (
                <motion.button 
                  key={region}
                  initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: i * 0.1 }}
                  className="px-8 py-4 bg-white hover:bg-[#0f172a] text-[#0f172a] hover:text-white transition-colors rounded-2xl font-black uppercase tracking-widest text-xs shadow-sm shadow-slate-200/50"
                >
                  {region}
                </motion.button>
              ))}
            </div>
            
            <div className="mt-20 w-full h-[500px] bg-[#020617] rounded-3xl shadow-[0_30px_60px_rgba(234,88,12,0.15)] border border-white/10 flex items-center justify-center relative overflow-hidden group">
               {/* 3D Map Component */}
               <NetworkMap3D />
               
               {/* Overlay Content */}
               <div className="absolute top-8 left-8 z-20 pointer-events-none">
                  <span className="w-12 h-12 rounded-full bg-[#1e3a8a]/20 flex items-center justify-center mb-4 border border-[#1e3a8a]">
                     <span className="w-3 h-3 rounded-full bg-[#00ffff] animate-ping" />
                  </span>
                  <p className="font-black text-xl text-white tracking-widest uppercase text-left drop-shadow-lg">Global Integrity Sync</p>
                  <p className="text-[#00ffff] font-medium text-xs mt-2 text-left uppercase tracking-widest bg-black/40 px-3 py-1 rounded-full backdrop-blur-sm border border-[#00ffff]/30 w-fit">42,000 Nodes Active</p>
               </div>
               
               {/* Scanline Effect */}
               <div className="absolute inset-0 bg-[linear-gradient(transparent_0%,rgba(0,255,255,0.05)_50%,transparent_100%)] bg-[length:100%_4px] opacity-30 pointer-events-none" />
            </div>
        </div>
      </main>
    </div>
  );
}
