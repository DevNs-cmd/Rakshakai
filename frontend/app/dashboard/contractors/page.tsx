'use client';
import { useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { api } from '@/lib/api';
import { Contractor } from '@/lib/types';
import { 
  Building2, 
  Search, 
  Filter, 
  TrendingUp, 
  ShieldAlert, 
  CheckCircle2, 
  Star, 
  ExternalLink,
  ChevronRight,
  UserCheck
} from 'lucide-react';
import Link from 'next/link';

export default function ContractorsPage() {
  const [contractors, setContractors] = useState<Contractor[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const fetchData = useCallback(async () => {
    try {
      const data = await api.getContractors();
      setContractors(data);
    } catch (e) { console.error(e); }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const filtered = contractors.filter(c => 
    c.name.toLowerCase().includes(search.toLowerCase()) || 
    c.registration_no?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="p-10 space-y-10 min-h-screen">
      {/* ── Header ─────────────────────────────────────────── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
           <div className="flex items-center gap-3 mb-2">
              <h1 className="text-4xl font-black text-rakshak-navy tracking-tight">Vendor Integrity Registry</h1>
              <div className="bg-rakshak-blue/10 text-rakshak-blue text-[10px] font-black px-2.5 py-1 rounded-lg uppercase tracking-widest border border-rakshak-blue/10">
                 Pre-Qualified Partners
              </div>
           </div>
           <p className="text-slate-500 font-medium whitespace-pre-wrap">Historical performance tracking and data-driven risk profiling of execution agencies.</p>
        </div>

        <div className="flex items-center gap-4">
           <div className="relative w-64">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input 
                 type="text" 
                 placeholder="Search Vendor/Reg ID..." 
                 value={search}
                 onChange={(e) => setSearch(e.target.value)}
                 className="w-full pl-12 pr-6 py-4 bg-white border border-slate-200 rounded-2xl text-xs font-bold focus:outline-none focus:ring-2 focus:ring-rakshak-blue/20 transition-all shadow-sm"
              />
           </div>
           <button className="p-4 bg-white border border-slate-200 rounded-2xl shadow-sm hover:bg-slate-50 transition-all text-slate-400">
              <Filter className="w-5 h-5" />
           </button>
        </div>
      </div>

      {loading ? (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8 animate-pulse">
           {[1, 2, 3, 4, 5, 6].map(i => <div key={i} className="h-48 bg-slate-100 rounded-3xl" />)}
        </div>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
           <AnimatePresence>
              {filtered.map((c, i) => (
                 <motion.div
                    key={c.id}
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: i * 0.05 }}
                    className="glass-card p-8 bg-white border border-slate-100 shadow-card hover:shadow-card-hover group transition-all rounded-3xl relative overflow-hidden"
                 >
                    <div className="flex items-center justify-between mb-6">
                       <div className="p-3 bg-slate-50 rounded-2xl text-rakshak-blue group-hover:bg-rakshak-blue group-hover:text-white transition-all">
                          <Building2 className="w-6 h-6" />
                       </div>
                       <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full border text-[9px] font-black uppercase ${
                          c.risk_score < 30 ? 'bg-green-50 text-green-700 border-green-100' : 'bg-red-50 text-red-700 border-red-100'
                       }`}>
                          {c.risk_score < 30 ? <CheckCircle2 className="w-3 h-3" /> : <ShieldAlert className="w-3 h-3" />}
                          Integrity Rank: {c.risk_score < 30 ? 'A+' : 'C-'}
                       </div>
                    </div>

                    <h3 className="text-xl font-bold text-rakshak-navy mb-1 group-hover:text-rakshak-blue transition-colors">{c.name}</h3>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-6 border-b border-slate-50 pb-4">REG-ID: {c.registration_no || 'NA'}</p>

                    <div className="grid grid-cols-2 gap-4 mb-6">
                       <div>
                          <p className="text-[9px] font-black text-slate-400 uppercase tracking-tighter mb-1">Active Assets</p>
                          <p className="text-lg font-black text-rakshak-navy leading-none">{c.total_projects}</p>
                       </div>
                       <div>
                          <p className="text-[9px] font-black text-slate-400 uppercase tracking-tighter mb-1">Avg Delay Days</p>
                          <p className="text-lg font-black text-rakshak-navy leading-none">{c.avg_delay_days}d</p>
                       </div>
                    </div>

                    <div className="pt-6 border-t border-slate-50 flex items-center justify-between">
                       <div className="flex items-center gap-1">
                          {[1, 2, 3, 4, 5].map((star) => (
                             <Star key={star} className={`w-3 h-3 ${star <= (5 - (c.risk_score / 20)) ? 'text-rakshak-gold fill-rakshak-gold' : 'text-slate-200'}`} />
                          ))}
                       </div>
                       <button className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-rakshak-blue hover:text-rakshak-navy transition-all group-hover:translate-x-1 duration-300">
                          Profile <ChevronRight className="w-4 h-4" />
                       </button>
                    </div>

                    <div className="absolute top-0 right-0 w-32 h-32 bg-rakshak-blue/5 blur-3xl rounded-full opacity-0 group-hover:opacity-100 transition-opacity -z-10 scale-90 translate-x-1/2 -translate-y-1/2" />
                 </motion.div>
              ))}
           </AnimatePresence>
        </div>
      )}

      {/* Trust Badge Footer */}
      <div className="glass-card p-10 bg-slate-50 border border-slate-100 rounded-[2.5rem] flex flex-col md:flex-row items-center justify-between gap-8 opacity-75">
          <div className="flex items-center gap-6">
             <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center shadow-xl border border-slate-200">
                <UserCheck className="w-8 h-8 text-green-600" />
             </div>
             <div>
                <h4 className="font-black text-rakshak-navy text-lg tracking-tight uppercase leading-none mb-2">Automated Prequalification Active</h4>
                <p className="text-xs font-medium text-slate-500 max-w-sm">Every vendor listed is verified through the Central Registry of Integrity (CRI) and synced with historical project performance data.</p>
             </div>
          </div>
          <button className="px-8 py-4 bg-white border border-slate-200 text-[10px] font-black uppercase tracking-widest rounded-2xl shadow-xl hover:bg-rakshak-navy hover:text-white transition-all">Submit Verification Query</button>
      </div>
    </div>
  );
}
