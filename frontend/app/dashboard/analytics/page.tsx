'use client';
import { useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { api } from '@/lib/api';
import { DashboardStats } from '@/lib/types';
import { 
  BarChart4, 
  Search, 
  Filter, 
  TrendingUp, 
  TrendingDown, 
  CheckCircle2, 
  IndianRupee, 
  Target, 
  Layers,
  ArrowRight,
  ShieldAlert,
  Calendar,
  Layers as LayersIcon
} from 'lucide-react';
import { 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  BarChart, 
  Bar, 
  Cell,
  PieChart,
  Pie
} from 'recharts';

const DUMMY_TIME_DATA = [
  { name: 'Jan', integrity: 88, risk: 12 },
  { name: 'Feb', integrity: 91, risk: 9 },
  { name: 'Mar', integrity: 85, risk: 15 },
  { name: 'Apr', integrity: 78, risk: 22 },
  { name: 'May', integrity: 92, risk: 8 },
  { name: 'Jun', integrity: 89, risk: 11 },
];

const STATE_DATA = [
  { name: 'Maharashtra', value: 45, color: '#1a3c6e' },
  { name: 'Karnataka', value: 32, color: '#3b82f6' },
  { name: 'Tamil Nadu', value: 28, color: '#ff7a1a' },
  { name: 'Gujarat', value: 24, color: '#f4c430' },
  { name: 'UP', value: 21, color: '#ef4444' },
];

export default function AnalyticsPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    try {
      const data = await api.getDashboardStats();
      setStats(data);
    } catch (e) { console.error(e); }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return (
    <div className="p-10 space-y-10 min-h-screen pb-20">
      {/* ── Header ─────────────────────────────────────────── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 pb-6 border-b border-slate-100">
        <div>
           <div className="flex items-center gap-3 mb-2">
              <h1 className="text-4xl font-black text-rakshak-navy tracking-tight">National Integrity Analytics</h1>
              <div className="bg-rakshak-navy text-white text-[10px] font-black px-2.5 py-1 rounded-lg uppercase tracking-widest border border-rakshak-navy/10">
                 Real-time Data Hub
              </div>
           </div>
           <p className="text-slate-500 font-medium">Predictive modeling and performance tracking across {stats?.total_projects || '...'} national assets.</p>
        </div>

        <div className="flex items-center gap-4">
           <button className="flex items-center gap-2 px-6 py-4 bg-white border border-slate-200 rounded-2xl shadow-sm hover:bg-slate-50 transition-all text-xs font-bold text-rakshak-navy leading-none">
              <Calendar className="w-4 h-4" />
              Last Q2 Oct-Dec
           </button>
           <button className="p-4 bg-rakshak-blue text-white rounded-2xl shadow-xl shadow-rakshak-blue/20 hover:bg-rakshak-navy transition-all">
              <Filter className="w-5 h-5" />
           </button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center p-20">
           <div className="w-12 h-12 border-4 border-rakshak-blue border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <div className="grid grid-cols-12 gap-10">
           {/* Chart 1: Time Series */}
           <div className="col-span-12 lg:col-span-8 glass-card p-10 bg-white border border-slate-100 shadow-card rounded-[2.5rem] relative overflow-hidden">
              <div className="flex items-center justify-between mb-8 relative z-10">
                 <div>
                    <h3 className="text-lg font-black text-rakshak-navy uppercase tracking-widest border-l-4 border-rakshak-blue pl-4">Asset Integrity Index</h3>
                    <p className="text-xs text-slate-400 font-bold ml-5 mt-1">Confidence Score Over Time (Verified Reporting)</p>
                 </div>
                 <div className="flex gap-4">
                    <div className="flex items-center gap-2">
                       <div className="w-3 h-3 rounded-full bg-rakshak-blue" />
                       <span className="text-[10px] font-black uppercase text-slate-400">Integrity</span>
                    </div>
                    <div className="flex items-center gap-2">
                       <div className="w-3 h-3 rounded-full bg-red-400 opacity-30" />
                       <span className="text-[10px] font-black uppercase text-slate-400">Risk Variance</span>
                    </div>
                 </div>
              </div>

              <div className="h-[350px] w-full mt-4 relative z-10">
                 <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={DUMMY_TIME_DATA}>
                       <defs>
                          <linearGradient id="colorInt" x1="0" y1="0" x2="0" y2="1">
                             <stop offset="5%" stopColor="#1a3c6e" stopOpacity={0.1}/>
                             <stop offset="95%" stopColor="#1a3c6e" stopOpacity={0}/>
                          </linearGradient>
                       </defs>
                       <XAxis 
                          dataKey="name" 
                          axisLine={false} 
                          tickLine={false} 
                          tick={{ fontSize: 10, fontWeight: '900', fill: '#94a3b8' }} 
                        />
                       <YAxis 
                          hide 
                          domain={[0, 100]} 
                        />
                       <Tooltip 
                          contentStyle={{ backgroundColor: '#fff', borderRadius: '16px', border: 'none', boxShadow: '0 10px 40px rgba(0,0,0,0.1)', fontSize: '10px', fontWeight: 'bold' }} 
                        />
                       <Area 
                          type="monotone" 
                          dataKey="integrity" 
                          stroke="#1a3c6e" 
                          fillOpacity={1} 
                          fill="url(#colorInt)" 
                          strokeWidth={4} 
                        />
                    </AreaChart>
                 </ResponsiveContainer>
              </div>
           </div>

           {/* Chart 2: Projects by State */}
           <div className="col-span-12 lg:col-span-4 glass-card p-10 bg-white border border-slate-100 shadow-card rounded-[2.5rem] flex flex-col items-center justify-center text-center">
              <h3 className="text-lg font-black text-rakshak-navy uppercase tracking-widest mb-2 leading-none">Top Performance Regions</h3>
              <p className="text-[10px] text-slate-400 font-bold mb-10">Asset density vs Compliance (Top 5 States)</p>
              
              <div className="h-[250px] w-full mb-8">
                 <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={STATE_DATA} layout="vertical">
                       <XAxis type="number" hide />
                       <YAxis 
                          dataKey="name" 
                          type="category" 
                          axisLine={false} 
                          tickLine={false} 
                          tick={{ fontSize: 9, fontWeight: '900', fill: '#1a3c6e' }} 
                          width={80}
                        />
                       <Tooltip cursor={{ fill: 'transparent' }} />
                       <Bar dataKey="value" radius={[0, 10, 10, 0]} barSize={20}>
                          {STATE_DATA.map((entry, index) => (
                             <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                       </Bar>
                    </BarChart>
                 </ResponsiveContainer>
              </div>

              <button className="w-full py-4 bg-slate-50 text-slate-400 text-[10px] font-black uppercase tracking-widest rounded-2xl hover:bg-slate-100 transition-all border border-slate-100 mb-2">View National Heatmap</button>
           </div>

           {/* Row 2: Prediction Insights */}
           <div className="col-span-12 lg:col-span-5 glass-card p-10 bg-rakshak-navy text-white rounded-[2.5rem] shadow-2xl relative overflow-hidden flex flex-col justify-between min-h-[400px]">
              <div>
                 <Target className="w-12 h-12 text-rakshak-saffron mb-6" />
                 <h3 className="text-3xl font-black tracking-tight leading-tight max-w-[280px]">AI-Forecasted Resource Deviations</h3>
                 <p className="text-sm text-blue-300 mt-4 max-w-sm font-medium">Predictive model predicts a 14% increase in procurement anomalies for Southern rail projects across Q3.</p>
              </div>
              <div className="pt-8 flex flex-col gap-4 border-t border-white/10 mt-8">
                 <div className="flex items-center justify-between">
                    <span className="text-[11px] font-black uppercase tracking-widest opacity-50">Model Confidence</span>
                    <span className="text-xl font-black text-rakshak-saffron">98.2%</span>
                 </div>
                 <button className="w-full py-4 bg-white/10 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-white/20 transition-all flex items-center justify-center gap-3">
                    Download Prediction Deck
                    <ArrowRight className="w-4 h-4" />
                 </button>
              </div>
              <div className="absolute top-0 right-0 w-64 h-64 bg-rakshak-saffron/10 blur-[120px] -translate-y-1/2 translate-x-1/2" />
           </div>

           <div className="col-span-12 lg:col-span-7 grid md:grid-cols-2 gap-8">
              {[
                 { label: 'Budget Adherence', value: 94.2, icon: IndianRupee, color: 'text-green-500' },
                 { label: 'Physical Compliance', value: 88.5, icon: LayersIcon, color: 'text-blue-500' },
                 { label: 'Reporting Velocity', value: 92.1, icon: TrendingUp, color: 'text-rakshak-saffron' },
                 { label: 'Integrity Rating', value: 91.8, icon: ShieldAlert, color: 'text-red-500' }
              ].map((m, i) => (
                 <div key={m.label} className="glass-card p-8 bg-white border border-slate-100 shadow-card rounded-3xl hover:translate-y-[-8px] transition-all duration-300 flex flex-col justify-between">
                    <m.icon className={`w-8 h-8 ${m.color} mb-6`} />
                    <div>
                       <h4 className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-1">{m.label}</h4>
                       <div className="flex items-end gap-2">
                          <span className="text-3xl font-black text-rakshak-navy">{m.value}%</span>
                          <span className="text-[10px] font-bold text-green-600 mb-1.5">+2.1%</span>
                       </div>
                    </div>
                 </div>
              ))}
           </div>
        </div>
      )}
    </div>
  );
}
