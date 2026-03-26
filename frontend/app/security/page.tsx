'use client';

import Navbar from '@/components/Navbar';
import IntegrityTicker from '@/components/IntegrityTicker';
import { motion } from 'framer-motion';

export default function Security() {
  return (
    <div className="min-h-screen bg-[#0f172a] overflow-hidden flex flex-col text-white">
      <div className="fixed top-0 left-0 right-0 z-[100]">
        <IntegrityTicker />
      </div>
      <Navbar />

      <main className="flex-1 max-w-7xl mx-auto px-6 pt-40 pb-20 w-full relative">
        <div className="absolute top-20 left-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-red-500/10 blur-[100px] -z-10 rounded-full animate-pulse" />
        
        <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} className="text-center border-b border-white/10 pb-16">
           <h1 className="text-5xl md:text-6xl font-black text-white mb-6 tracking-tight">
             Zero-Trust <span className="text-red-500">Security</span>
           </h1>
           <p className="text-slate-400 max-w-2xl mx-auto text-lg md:text-xl font-medium">
             Military-grade encryption and strict access protocols to protect national infrastructure data.
           </p>
        </motion.div>

        <div className="mt-16 text-center">
            <h2 className="text-2xl font-black text-white mb-10">Threat Detection Surface</h2>
            <div className="w-full h-[300px] bg-[#1e293b] rounded-3xl border border-white/10 flex flex-col items-center justify-center p-8 relative overflow-hidden shadow-2xl shadow-red-900/20">
               <div className="absolute inset-0 bg-gradient-to-br from-transparent via-red-500/5 to-transparent animate-pulse" />
               <div className="relative z-10 text-center flex flex-col items-center">
                  <div className="w-20 h-20 rounded-full border-2 border-red-500 flex items-center justify-center mb-6">
                     <span className="w-2 h-2 rounded-full bg-red-500 animate-ping" />
                  </div>
                  <p className="font-black text-2xl text-white tracking-widest uppercase">System Protected</p>
                  <p className="text-red-400 font-bold text-sm mt-2 uppercase tracking-widest">No active anomalies detected across 42,000 nodes</p>
               </div>
            </div>
        </div>
      </main>
    </div>
  );
}
