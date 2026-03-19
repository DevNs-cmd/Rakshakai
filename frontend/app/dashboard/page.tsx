'use client';
import { useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { api } from '@/lib/api';
import { DashboardStats, ProjectMapPoint, Alert, WSEvent } from '@/lib/types';
import DashboardStatsGrid from '@/components/DashboardStats';
import DashboardMap from '@/components/DashboardMap';
import AlertFeed from '@/components/AlertFeed';
import { useWebSocket } from '@/lib/use-websocket';
import { 
  Building2, 
  ChevronRight, 
  IndianRupee, 
  Map as MapIcon, 
  RefreshCw, 
  Search,
  BellRing,
  ShieldCheck,
  TrendingUp,
  ExternalLink
} from 'lucide-react';
import Link from 'next/link';
import { 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer 
} from 'recharts';

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [projects, setProjects] = useState<ProjectMapPoint[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchData = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    try {
      const [statsData, mapData, alertsData] = await Promise.all([
        api.getDashboardStats(),
        api.getMapProjects(),
        api.getAllAlerts(15)
      ]);
      setStats(statsData);
      setProjects(mapData);
      setAlerts(alertsData);
    } catch (error) {
      console.error('Failed to fetch dashboard data:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Real-time updates handler
  const handleWSEvent = useCallback((event: WSEvent) => {
    console.log('WS Event Received:', event);
    if (event.type === 'risk_update' || event.type === 'evidence_uploaded' || event.type === 'simulation_failure') {
      fetchData(); // Simplest strategy: re-fetch everything for consistency
    }
  }, [fetchData]);

  useWebSocket(handleWSEvent);

  const markAlertRead = async (id: string) => {
    try {
      await api.markAlertRead(id);
      setAlerts(prev => prev.map(a => a.id === id ? { ...a, is_read: true } : a));
    } catch (e) {
      console.error(e);
    }
  };

  if (loading) return (
    <div className="p-8 space-y-8 animate-pulse">
      <div className="h-10 bg-slate-200 rounded-xl w-64" />
      <div className="grid grid-cols-4 gap-6">
        {[1, 2, 3, 4].map(i => <div key={i} className="h-32 bg-slate-200 rounded-2xl" />)}
      </div>
      <div className="grid grid-cols-3 gap-8">
        <div className="col-span-2 h-[500px] bg-slate-200 rounded-3xl" />
        <div className="h-[500px] bg-slate-200 rounded-3xl" />
      </div>
    </div>
  );

  return (
    <div className="p-10 space-y-10">
      {/* ── Dashboard Header ────────────────────────────────────── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <h1 className="text-4xl font-black text-rakshak-navy tracking-tight">Executive Overwatch</h1>
            <div className="bg-rakshak-blue/10 text-rakshak-blue text-[10px] font-black px-2.5 py-1 rounded-lg uppercase tracking-widest border border-rakshak-blue/10">
              Live National Feed
            </div>
          </div>
          <p className="text-slate-500 font-medium">Monitoring 28 States & UTs with AI Risk Intelligence</p>
        </div>

        <div className="flex items-center gap-4">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input 
              type="text" 
              placeholder="Search Project ID, Contractor..."
              className="pl-11 pr-6 py-3 bg-white border border-slate-200 rounded-2xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-rakshak-blue/20 w-72 shadow-sm transition-all"
            />
          </div>
          <button 
            onClick={() => fetchData(true)}
            className={`p-3 bg-white border border-slate-200 rounded-2xl shadow-sm hover:bg-slate-50 transition-all ${refreshing ? 'animate-spin' : ''}`}
          >
            <RefreshCw className="w-5 h-5 text-slate-600" />
          </button>
        </div>
      </div>

      {/* ── National Integrity Score Meter ──────────────────────── */}
      <motion.div 
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass-card p-8 bg-gradient-to-r from-rakshak-navy to-rakshak-blue text-white shadow-2xl relative overflow-hidden"
      >
        <div className="relative z-10 flex flex-col md:flex-row items-center gap-10">
          <div className="flex-shrink-0 flex flex-col items-center">
            <div className="relative w-32 h-32 flex items-center justify-center">
              <svg className="w-full h-full transform -rotate-90">
                <circle cx="64" cy="64" r="58" stroke="rgba(255,255,255,0.1)" strokeWidth="10" fill="transparent" />
                <motion.circle 
                  cx="64" cy="64" r="58" stroke="#16a34a" strokeWidth="10" fill="transparent"
                  strokeDasharray={364.4}
                  initial={{ strokeDashoffset: 364.4 }}
                  animate={{ strokeDashoffset: 364.4 - (364.4 * (stats?.integrity_score || 0) / 100) }}
                  transition={{ duration: 2, ease: "easeOut" }}
                  strokeLinecap="round"
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-3xl font-black">{stats?.integrity_score}%</span>
                <span className="text-[8px] font-black opacity-60 tracking-widest uppercase">Certified</span>
              </div>
            </div>
          </div>

          <div className="flex-1 space-y-4 text-center md:text-left">
            <div>
              <h2 className="text-2xl font-black tracking-tight mb-2 flex items-center gap-3 justify-center md:justify-start">
                National Integrity Index (NII™)
                <ShieldCheck className="w-6 h-6 text-green-400" />
              </h2>
              <p className="text-blue-100/70 text-sm max-w-2xl leading-relaxed">
                Aggregated system audit of all infrastructure projects. Current levels indicate <span className="text-green-400 font-bold">Stable Governance</span> across the subcontinent.
              </p>
            </div>
            
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6 pt-4">
              <div className="border-l border-white/10 pl-4">
                <p className="text-[10px] font-black text-blue-300 uppercase tracking-widest mb-1">Risk Heat</p>
                <p className="text-lg font-bold">{stats?.national_risk_score}%</p>
              </div>
              <div className="border-l border-white/10 pl-4">
                <p className="text-[10px] font-black text-blue-300 uppercase tracking-widest mb-1">Audit Freq</p>
                <p className="text-lg font-bold">4.2h / Proj</p>
              </div>
              <div className="border-l border-white/10 pl-4">
                <p className="text-[10px] font-black text-blue-300 uppercase tracking-widest mb-1">Uptime</p>
                <p className="text-lg font-bold">99.98%</p>
              </div>
              <div className="border-l border-white/10 pl-4">
                <p className="text-[10px] font-black text-blue-300 uppercase tracking-widest mb-1">Verified Media</p>
                <p className="text-lg font-bold">842K</p>
              </div>
            </div>
          </div>
        </div>

        {/* Abstract design elements */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
        <div className="absolute bottom-0 left-0 w-32 h-32 bg-rakshak-saffron/10 rounded-full blur-2xl -translate-x-1/2 translate-y-1/2" />
      </motion.div>

      {/* ── Stats Grid ──────────────────────────────────────────── */}
      {stats && <DashboardStatsGrid stats={stats} />}

      {/* ── Centerpiece: Map & Alerts ───────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
        <div className="lg:col-span-2 space-y-8">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-black text-rakshak-navy tracking-tight flex items-center gap-3">
              Live Deployment Map
              <MapIcon className="w-5 h-5 text-rakshak-blue" />
            </h2>
            <Link href="/dashboard/map" className="text-xs font-black text-rakshak-blue uppercase tracking-widest hover:underline flex items-center gap-1.5">
              Full Screen Mode <ExternalLink className="w-3 h-3" />
            </Link>
          </div>
          
          <div className="h-[600px] w-full rounded-3xl shadow-2xl overflow-hidden border border-slate-200">
            <DashboardMap projects={projects} />
          </div>

          <div className="glass-card p-8 space-y-6">
            <h3 className="font-black text-rakshak-navy uppercase tracking-widest text-xs border-b border-slate-100 pb-4">Integrity Trends</h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={[
                  { name: 'Mon', score: 82 },
                  { name: 'Tue', score: 84 },
                  { name: 'Wed', score: 83 },
                  { name: 'Thu', score: 85 },
                  { name: 'Fri', score: 84 },
                  { name: 'Sat', score: 86 },
                  { name: 'Sun', score: 84.6 },
                ]}>
                  <defs>
                    <linearGradient id="colorScore" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.1}/>
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 700, fill: '#94a3b8' }} />
                  <YAxis domain={[70, 100]} axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 700, fill: '#94a3b8' }} />
                  <Tooltip 
                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 8px 32px rgba(0,0,0,0.1)', fontWeight: 700, fontSize: '12px' }}
                    itemStyle={{ color: '#1e3a8a' }}
                  />
                  <Area type="monotone" dataKey="score" stroke="#3b82f6" strokeWidth={3} fillOpacity={1} fill="url(#colorScore)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        <div className="space-y-8 h-full flex flex-col">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-black text-rakshak-navy tracking-tight flex items-center gap-3">
              Risk Feed
              <BellRing className="w-5 h-5 text-red-500 animate-bounce" />
            </h2>
          </div>
          <div className="flex-1">
            <AlertFeed alerts={alerts} onMarkRead={markAlertRead} />
          </div>
          
          <div className="glass-card p-6 bg-white border border-slate-100">
            <div className="flex items-center gap-4 mb-4">
              <div className="w-10 h-10 bg-green-50 rounded-xl flex items-center justify-center">
                <ShieldCheck className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <h4 className="font-bold text-rakshak-navy text-sm">System Verified</h4>
                <p className="text-[10px] text-slate-400 font-bold uppercase">All nodes operational</p>
              </div>
            </div>
            <div className="space-y-2">
              <div className="h-1 bg-slate-100 rounded-full overflow-hidden">
                <div className="bg-green-500 h-full w-[94%]" />
              </div>
              <p className="text-[9px] text-slate-500 font-medium">Next system-wide sync in 12m 44s</p>
            </div>
          </div>
        </div>
      </div>

      {/* ── Recent Projects Quick List ──────────────────────────── */}
      <div className="space-y-6">
        <h2 className="text-2xl font-black text-rakshak-navy tracking-tight flex items-center gap-3">
          Field Operations
          <Building2 className="w-5 h-5 text-slate-400" />
        </h2>
        
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {projects.slice(0, 6).map((p) => (
            <Link key={p.id} href={`/dashboard/projects/${p.id}`}>
              <motion.div 
                whileHover={{ y: -4 }}
                className="glass-card p-6 border border-slate-100 bg-white group hover:shadow-card-hover transition-all"
              >
                <div className="flex justify-between items-start mb-4">
                  <div className={`px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-widest ${
                    p.risk_level === 'green' ? 'bg-green-100 text-green-700' :
                    p.risk_level === 'yellow' ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700'
                  }`}>
                    {p.risk_level} Risk
                  </div>
                  <span className="text-[10px] text-slate-400 font-mono">#{p.id.split('-')[0]}</span>
                </div>
                <h3 className="font-bold text-rakshak-navy text-lg leading-tight mb-2 group-hover:text-rakshak-blue transition-colors">{p.name}</h3>
                <div className="flex flex-wrap gap-x-4 gap-y-2 mb-6">
                  <div className="flex items-center gap-1.5">
                    <MapIcon className="w-3 h-3 text-slate-400" />
                    <span className="text-xs font-bold text-slate-500">{p.state}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <IndianRupee className="w-3 h-3 text-slate-400" />
                    <span className="text-xs font-bold text-slate-500">{(p.budget / 10000000).toFixed(1)} Cr</span>
                  </div>
                </div>
                
                <div className="space-y-2">
                  <div className="flex justify-between text-[10px] font-black uppercase tracking-widest">
                    <span className="text-slate-400">Progress</span>
                    <span className="text-rakshak-navy">{p.progress_percent}%</span>
                  </div>
                  <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                    <motion.div 
                      initial={{ width: 0 }}
                      animate={{ width: `${p.progress_percent}%` }}
                      className="h-full bg-rakshak-blue" 
                    />
                  </div>
                </div>
              </motion.div>
            </Link>
          ))}
        </div>
        
        <div className="flex justify-center pt-6">
          <Link href="/dashboard/projects">
            <button className="px-8 py-3 bg-white border border-slate-200 text-rakshak-blue font-black uppercase text-[10px] tracking-[0.2em] rounded-2xl hover:bg-rakshak-blue hover:text-white hover:border-rakshak-blue transition-all shadow-sm">
              View All Auditable Assets →
            </button>
          </Link>
        </div>
      </div>
    </div>
  );
}
