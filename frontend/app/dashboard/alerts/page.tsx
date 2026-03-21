'use client';
import { useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { api } from '@/lib/api';
import { Alert } from '@/lib/types';
import { 
  BellRing, 
  Search, 
  Filter, 
  RefreshCw, 
  ShieldAlert, 
  CheckCircle2, 
  Clock, 
  ExternalLink,
  Zap,
  ChevronDown
} from 'lucide-react';
import Link from 'next/link';
import { format } from 'date-fns';

export default function AlertsPage() {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<'all' | 'unread' | 'high'>('all');

  const fetchData = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    try {
      const data = await api.getAllAlerts(50);
      setAlerts(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const markRead = async (id: string) => {
    try {
      await api.markAlertRead(id);
      setAlerts(prev => prev.map(a => a.id === id ? { ...a, is_read: true } : a));
    } catch (e) { console.error(e); }
  };

  const filteredAlerts = alerts.filter(a => {
    if (filter === 'unread') return !a.is_read;
    if (filter === 'high') return a.severity === 'high';
    return true;
  });

  return (
    <div className="p-10 space-y-10 min-h-screen">
      {/* ── Header ─────────────────────────────────────────── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <h1 className="text-4xl font-black text-rakshak-navy tracking-tight">System Risk Feed</h1>
            <div className="bg-red-50 text-red-600 text-[10px] font-black px-2.5 py-1 rounded-lg uppercase tracking-widest border border-red-100 flex items-center gap-2">
              <Zap className="w-3 h-3 animate-pulse" />
              Live Anomalies
            </div>
          </div>
          <p className="text-slate-500 font-medium">Real-time integrity breaches and evidence deficits across the national asset network.</p>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 bg-slate-100 p-1 rounded-xl">
             <button 
                onClick={() => setFilter('all')}
                className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${filter === 'all' ? 'bg-white text-rakshak-blue shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
             >
                All
             </button>
             <button 
                onClick={() => setFilter('unread')}
                className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${filter === 'unread' ? 'bg-white text-red-600 shadow-sm' : 'text-slate-400 hover:text-red-400'}`}
             >
                Unread
             </button>
             <button 
                onClick={() => setFilter('high')}
                className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${filter === 'high' ? 'bg-red-600 text-white shadow-lg shadow-red-500/20' : 'text-slate-400 hover:text-red-500'}`}
             >
                High Risk
             </button>
          </div>
          
          <button 
            onClick={() => fetchData(true)}
            className={`p-4 bg-white border border-slate-200 rounded-2xl shadow-sm hover:bg-slate-50 transition-all ${refreshing ? 'animate-spin' : ''}`}
          >
            <RefreshCw className="w-5 h-5 text-slate-600" />
          </button>
        </div>
      </div>

      <div className="grid md:grid-cols-4 gap-10">
        <div className="md:col-span-3 space-y-6">
           {loading ? (
             <div className="space-y-4 animate-pulse">
                {[1, 2, 3, 4, 5].map(i => <div key={i} className="h-24 bg-slate-200 rounded-2xl" />)}
             </div>
           ) : filteredAlerts.length === 0 ? (
             <div className="flex flex-col items-center justify-center py-20 bg-white rounded-3xl border border-slate-100 italic">
                <CheckCircle2 className="w-16 h-16 text-green-100 mb-4" />
                <p className="text-slate-400 font-black uppercase tracking-widest text-xs">No critical anomalies registered in this view</p>
             </div>
           ) : (
             <div className="space-y-4">
                <AnimatePresence>
                   {filteredAlerts.map((alert, i) => (
                      <motion.div
                         key={alert.id}
                         initial={{ opacity: 0, x: -20 }}
                         animate={{ opacity: 1, x: 0 }}
                         exit={{ opacity: 0, x: 20 }}
                         transition={{ delay: i * 0.05 }}
                         className={`group glass-card p-6 border-l-4 transition-all hover:bg-white/95 ${
                            alert.is_read ? 'border-slate-100 bg-slate-50 opacity-70' : 
                            alert.severity === 'high' ? 'border-red-500 bg-white' : 'border-yellow-500 bg-white'
                         } flex items-center gap-6`}
                      >
                         <div className={`w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 ${
                            alert.is_read ? 'bg-slate-200 text-slate-400' : 
                            alert.severity === 'high' ? 'bg-red-50 text-red-500 shadow-lg shadow-red-500/10' : 'bg-yellow-50 text-yellow-500'
                         }`}>
                            {alert.severity === 'high' ? <ShieldAlert className="w-7 h-7" /> : <BellRing className="w-7 h-7" />}
                         </div>
                         
                         <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-3 mb-1">
                               <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{alert.alert_type.replace('_', ' ')}</p>
                               <span className="text-[10px] text-slate-300 font-bold">•</span>
                               <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{format(new Date(alert.created_at!), 'dd MMM HH:mm')}</p>
                            </div>
                            <h3 className="font-black text-rakshak-navy text-lg leading-tight mb-1 group-hover:text-rakshak-blue transition-colors truncate">
                               {alert.title}
                            </h3>
                            <p className="text-sm font-medium text-slate-500 line-clamp-1">{alert.message}</p>
                         </div>

                         <div className="flex items-center gap-4">
                            <Link href={`/dashboard/projects/${alert.project_id}`}>
                               <button className="flex items-center gap-2 px-4 py-2 rounded-xl text-[10px] font-black uppercase bg-slate-100 text-slate-600 hover:bg-rakshak-blue hover:text-white transition-all">
                                  Investigate
                                  <ExternalLink className="w-3 h-3" />
                               </button>
                            </Link>
                            {!alert.is_read && (
                               <button 
                                  onClick={() => markRead(alert.id)}
                                  className="p-3 bg-white border border-slate-200 rounded-xl hover:bg-blue-50 text-slate-400 hover:text-rakshak-blue shadow-sm transition-all"
                               >
                                  <CheckCircle2 className="w-4 h-4" />
                               </button>
                            )}
                         </div>
                      </motion.div>
                   ))}
                </AnimatePresence>
             </div>
           )}
        </div>

        <div className="space-y-8">
           <div className="glass-card p-8 bg-gradient-to-br from-rakshak-navy to-slate-900 text-white rounded-3xl shadow-xl overflow-hidden relative">
              <div className="relative z-10">
                 <h4 className="text-[10px] font-black uppercase tracking-[0.3em] text-blue-400 mb-6 border-b border-white/10 pb-4">National Risk Heat</h4>
                 <div className="space-y-6">
                    <div>
                       <div className="flex justify-between items-end mb-2">
                          <span className="text-xs font-bold opacity-60">Critical Assets</span>
                          <span className="text-xl font-black text-red-400">08</span>
                       </div>
                       <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
                          <div className="bg-red-500 h-full w-[15%]" />
                       </div>
                    </div>
                    <div>
                       <div className="flex justify-between items-end mb-2">
                          <span className="text-xs font-bold opacity-60">Resource Diversion</span>
                          <span className="text-xl font-black text-yellow-400">14%</span>
                       </div>
                       <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
                          <div className="bg-yellow-500 h-full w-[34%]" />
                       </div>
                    </div>
                 </div>
              </div>
              <div className="absolute top-0 right-0 w-32 h-32 bg-red-500/10 blur-3xl -translate-y-1/2 translate-x-1/2" />
           </div>

           <div className="glass-card p-8 bg-white border border-slate-100 rounded-3xl shadow-card">
              <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-6 flex items-center gap-2">
                 <Clock className="w-4 h-4" />
                 Last 24 Hours
              </h4>
              <div className="space-y-6">
                 <div className="flex items-start gap-4">
                    <div className="w-2 h-2 rounded-full bg-red-500 mt-1.5 shrink-0" />
                    <div>
                       <p className="text-xs font-bold text-rakshak-navy">High-speed rail corridor report delayed by 18h.</p>
                       <p className="text-[10px] text-slate-400 font-medium">09:44 AM</p>
                    </div>
                 </div>
                 <div className="flex items-start gap-4">
                    <div className="w-2 h-2 rounded-full bg-yellow-500 mt-1.5 shrink-0" />
                    <div>
                       <p className="text-xs font-bold text-rakshak-navy">Budget deviation (8%) detected in Bangalore Metro Ph-3.</p>
                       <p className="text-[10px] text-slate-400 font-medium">07:12 AM</p>
                    </div>
                 </div>
                 <div className="flex items-start gap-4">
                    <div className="w-2 h-2 rounded-full bg-green-500 mt-1.5 shrink-0" />
                    <div>
                       <p className="text-xs font-bold text-rakshak-navy">GPS signature verified for Mumbai Coastal Ph-II.</p>
                       <p className="text-[10px] text-slate-400 font-medium">Yesterday</p>
                    </div>
                 </div>
              </div>
              <button className="w-full mt-8 py-3 bg-slate-50 text-slate-400 font-black uppercase tracking-widest text-[9px] rounded-xl hover:bg-slate-100 transition-all flex items-center justify-center gap-2">
                 Full Audit Log <ChevronDown className="w-3 h-3" />
              </button>
           </div>
        </div>
      </div>
    </div>
  );
}
