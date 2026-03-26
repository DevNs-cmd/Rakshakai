'use client';

import Navbar from '@/components/Navbar';
import IntegrityTicker from '@/components/IntegrityTicker';
import { motion } from 'framer-motion';
import { useEffect, useState } from 'react';

export default function Solutions() {
  const [stats, setStats] = useState<any>(null);

  useEffect(() => {
    fetch('http://localhost:8000/dashboard/stats')
      .then(res => res.json())
      .then(data => setStats(data))
      .catch(e => console.error(e));
  }, []);

  return (
    <div className="min-h-screen bg-[#f1f4f9] overflow-hidden flex flex-col">
      <main className="flex-1 max-w-7xl mx-auto px-6 pt-40 pb-20 w-full relative">
        <div className="absolute top-20 left-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-blue-500/10 blur-[100px] -z-10 rounded-full animate-pulse" />
        
        <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} className="text-center">
           <h1 className="text-5xl md:text-6xl font-black text-[#0f172a] mb-6 tracking-tight">
             Rakshak <span className="bg-gradient-to-r from-[#1e3a8a] to-[#ea580c] bg-clip-text text-transparent">Solutions</span>
           </h1>
           <p className="text-slate-500 max-w-2xl mx-auto text-lg md:text-xl font-medium">
             Enterprise-grade autonomous integrity modules synchronizing satellite telemetry with financial disbursements.
           </p>
        </motion.div>

        <div className="mt-20 grid md:grid-cols-2 lg:grid-cols-3 gap-8">
           {['Geo-Analytics', 'Budget Guardian', 'Field Telemetry', 'Risk Engine'].map((item, i) => (
             <motion.div 
               key={item} 
               initial={{ opacity: 0, y: 20 }} 
               animate={{ opacity: 1, y: 0 }} 
               transition={{ delay: i * 0.1 }}
               className="glass-card bg-white p-8 border border-white/50 shadow-xl rounded-3xl"
             >
               <h3 className="font-black text-xl text-[#0f172a] mb-4">{item}</h3>
               <p className="text-sm text-slate-500 leading-relaxed font-medium">Advanced algorithmic processing of milestone completion aligned directly with National Audit Authority standards.</p>
             </motion.div>
           ))}
        </div>

        {stats && (
          <div className="mt-20 p-8 glass-card bg-[#0f172a] text-white rounded-3xl overflow-hidden relative">
            <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full blur-2xl" />
            <h2 className="text-2xl font-black mb-6 flex items-center gap-3">
              <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" /> Live Backend Sync
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
              <div>
                <p className="text-slate-400 text-xs font-bold uppercase tracking-widest mb-2">Monitored Budget</p>
                <p className="text-3xl font-black text-white">₹{stats.total_budget || 42000}Cr</p>
              </div>
              <div>
                <p className="text-slate-400 text-xs font-bold uppercase tracking-widest mb-2">System Integrity</p>
                <p className="text-3xl font-black text-white">{stats.integrity_score || 95.2}%</p>
              </div>
              <div>
                <p className="text-slate-400 text-xs font-bold uppercase tracking-widest mb-2">Active Nodes</p>
                <p className="text-3xl font-black text-white">{stats.active_projects || 124}</p>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
