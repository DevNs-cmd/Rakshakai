'use client';

import Navbar from '@/components/Navbar';
import IntegrityTicker from '@/components/IntegrityTicker';
import { motion } from 'framer-motion';

export default function AuditTrial() {
  return (
    <div className="min-h-screen bg-[#f1f4f9] overflow-hidden flex flex-col">
      <main className="flex-1 max-w-7xl mx-auto px-6 pt-40 pb-20 w-full relative">
        <div className="absolute top-20 left-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-slate-500/10 blur-[100px] -z-10 rounded-full animate-pulse" />
        
        <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} className="text-center border-b border-slate-200 pb-16">
           <h1 className="text-5xl md:text-6xl font-black text-[#0f172a] mb-6 tracking-tight">
             Blockchain <span className="text-slate-500 italic">Audit Trial</span>
           </h1>
           <p className="text-slate-500 max-w-2xl mx-auto text-lg md:text-xl font-medium">
             An immutable, transparent ledger recording every disbursement, evidence upload, and protocol action.
           </p>
        </motion.div>

        <div className="mt-16 w-full max-w-4xl mx-auto">
            <h2 className="text-xl font-black text-[#0f172a] mb-8 uppercase tracking-widest text-center">Recent Ledger Activity</h2>
            
            <div className="bg-white rounded-3xl shadow-xl overflow-hidden border border-slate-100 p-8 space-y-6">
              {[1,2,3].map((_, i) => (
                <div key={i} className="flex items-center gap-6 p-4 rounded-xl border border-slate-100 hover:border-[#1e3a8a] transition-colors cursor-pointer group">
                   <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center font-black text-[#0f172a] group-hover:bg-[#1e3a8a] group-hover:text-white transition-colors">
                     0x
                   </div>
                   <div className="flex-1">
                     <p className="font-black text-sm uppercase tracking-widest text-[#0f172a]">Smart Contract Execution</p>
                     <p className="text-xs text-slate-400 font-medium">Auto-verification passed for Hub-A92</p>
                   </div>
                   <div className="text-right">
                      <p className="text-xs font-black text-green-500 uppercase tracking-widest">VERIFIED</p>
                      <p className="text-[10px] text-slate-400">Timestamp: {new Date().toISOString()}</p>
                   </div>
                </div>
              ))}
            </div>
        </div>
      </main>
    </div>
  );
}
