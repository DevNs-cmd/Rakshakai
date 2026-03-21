'use client';
import { useEffect, useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import { api } from '@/lib/api';
import { DashboardStats, ProjectMapPoint, Alert, WSEvent } from '@/lib/types';
import DashboardStatsGrid from '@/components/DashboardStats';
import DashboardMap from '@/components/DashboardMap';
import AlertFeed from '@/components/AlertFeed';
import { useWebSocket } from '@/lib/use-websocket';
import { 
  Building2, 
  IndianRupee, 
  Map as MapIcon, 
  RefreshCw, 
  Search,
  BellRing,
  ShieldCheck,
  ExternalLink
} from 'lucide-react';
import Link from 'next/link';
import Glass3D from '@/components/Glass3D';
import { 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer 
} from 'recharts';

import { useRef } from 'react';
import * as THREE from 'three';

function RiskOrb({ score }: { score: number }) {
  const mountRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!mountRef.current) return;
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(75, 1, 0.1, 1000);
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(120, 120);
    mountRef.current.appendChild(renderer.domElement);

    const geometry = new THREE.IcosahedronGeometry(1, 15);
    const material = new THREE.MeshPhongMaterial({
      color: score > 50 ? 0xef4444 : 0x3b82f6,
      wireframe: true,
      transparent: true,
      opacity: 0.6,
    });
    const orb = new THREE.Mesh(geometry, material);
    scene.add(orb);

    const light = new THREE.PointLight(0xffffff, 2);
    light.position.set(5, 5, 5);
    scene.add(light);
    scene.add(new THREE.AmbientLight(0xffffff, 0.5));

    camera.position.z = 2.5;

    const animate = () => {
      requestAnimationFrame(animate);
      orb.rotation.y += 0.01;
      orb.rotation.x += 0.005;
      const s = 1 + Math.sin(Date.now() * 0.002) * 0.1;
      orb.scale.set(s, s, s);
      renderer.render(scene, camera);
    };
    animate();

    return () => {
      renderer.dispose();
      mountRef.current?.removeChild(renderer.domElement);
    };
  }, [score]);

  return <div ref={mountRef} className="w-[120px] h-[120px] drop-shadow-[0_0_20px_rgba(59,130,246,0.3)]" />;
}

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [projects, setProjects] = useState<ProjectMapPoint[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [simulating, setSimulating] = useState(false);

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
    // Mock data for demo on Vercel
    setStats({
      total_projects: 12847,
      active_projects: 8742,
      high_risk_projects: 156,
      delayed_projects: 89,
      avg_delay_percent: 12,
      total_budget: 4200000000000,
      national_risk_score: 12.4,
      integrity_score: 87.6
    });
    setProjects([
      {
        id: 'proj-001',
        name: 'Delhi-Mumbai Expressway',
        state: 'Maharashtra',
        risk_level: 'green',
        budget: 12000000000,
        progress_percent: 78,
        lat: 19.0760,
        lon: 72.8777,
        status: 'active'
      },
      {
        id: 'proj-002',
        name: 'PM Gati Shakti Terminal',
        state: 'Gujarat',
        risk_level: 'yellow',
        budget: 8500000000,
        progress_percent: 45,
        lat: 23.0225,
        lon: 72.5714,
        status: 'delayed'
      }
    ]);
    setAlerts([
      {
        id: 'alert-1',
        title: 'Material Anomaly - Cement Grade',
        description: 'M20 cement detected in M25 spec bridge pour. Vendor: ABC Infra',
        project_id: 'proj-001',
        severity: 'high',
        is_read: false,
        timestamp: '2024-06-15T10:30:00Z',
        type: 'evidence_failure'
      }
    ]);
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
      fetchData();
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

  const handleSimulateFailure = async () => {
    if (simulating) return;
    setSimulating(true);
    try {
      const result = await api.simulateGlobalFailure();
      await fetchData(true);
      alert(`System Integrity Compromised: ${result.projects.length} nodes impacted.`);
    } catch (e) {
      console.error('Simulation failed:', e);
    } finally {
      setSimulating(false);
    }
  };

  if (loading) return (
    <div className="p-10 space-y-10 animate-pulse bg-slate-50/50 min-h-screen">
      <div className="flex justify-between items-center">
         <div className="space-y-4">
            <div className="h-10 bg-slate-200 rounded-2xl w-80" />
            <div className="h-4 bg-slate-200 rounded-xl w-64" />
         </div>
         <div className="h-14 bg-slate-200 rounded-2xl w-48" />
      </div>
      <div className="h-64 bg-slate-200 rounded-[2.5rem]" />
      <div className="grid grid-cols-4 gap-8">
        {[1, 2, 3, 4].map(i => <div key={i} className="h-40 bg-slate-200 rounded-[2rem]" />)}
      </div>
    </div>
  );

  return (
    <div className="p-4 sm:p-6 md:p-10 space-y-6 md:space-y-10">
      {/* ── Dashboard Header ────────────────────────────────────── */}
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-8">
        <div className="flex flex-col sm:flex-row items-center sm:items-start gap-4 md:gap-8 text-center sm:text-left">
          {stats && (
            <div className="shrink-0 scale-75 md:scale-100">
              <RiskOrb score={stats.national_risk_score} />
            </div>
          )}
          <div className="space-y-2">
            <div className="flex flex-col md:flex-row md:items-center gap-2 md:gap-4">
              <h1 className="text-3xl md:text-5xl font-extrabold text-slate-900 tracking-tight">Executive <span className="text-rakshak-blue/40 italic font-medium">Overwatch</span></h1>
              <div className="bg-blue-50 text-rakshak-blue text-[8px] md:text-[10px] font-bold px-3 md:px-4 py-1.5 rounded-full uppercase tracking-widest border border-blue-100/50 w-fit mx-auto md:mx-0">
                Live National Network
              </div>
            </div>
            <p className="text-xs md:text-sm text-slate-400 font-medium max-w-lg mx-auto sm:mx-0">
              Authorized surveillance of 28 States & UTs. Protocol <span className="text-green-600 font-bold">Sync: 100% Verified</span>.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-center sm:justify-end gap-3 md:gap-4">
          <button 
            onClick={handleSimulateFailure}
            disabled={simulating}
            className={`flex items-center gap-2 px-4 py-2.5 md:py-3 bg-red-50 text-red-600 border border-red-100 rounded-xl md:rounded-2xl text-[9px] md:text-[10px] font-black uppercase tracking-widest hover:bg-red-600 hover:text-white transition-all shadow-sm ${simulating ? 'opacity-50 animate-pulse' : ''}`}
          >
            <BellRing className="w-3.5 h-3.5 md:w-4 md:h-4" />
            {simulating ? 'Cascading...' : 'Simulate Failure'}
          </button>
          
          <div className="relative group flex-1 sm:flex-none max-w-md sm:w-auto">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-rakshak-blue transition-colors" />
            <input 
              type="text" 
              placeholder="Search IDs..."
              className="pl-11 pr-4 py-2.5 md:py-3 bg-white border border-slate-200 rounded-xl md:rounded-2xl text-xs md:text-sm font-medium focus:outline-none focus:ring-2 focus:ring-rakshak-blue/20 w-full sm:w-48 md:w-72 shadow-sm transition-all"
            />
          </div>
          <button 
            onClick={() => fetchData(true)}
            className={`p-2.5 md:p-3 bg-white border border-slate-200 rounded-xl md:rounded-2xl shadow-sm hover:bg-slate-50 transition-all ${refreshing ? 'animate-spin' : ''}`}
          >
            <RefreshCw className="w-4 h-4 md:w-5 md:h-5 text-slate-600" />
          </button>
        </div>
      </div>

      {/* ── National Integrity Score Meter ──────────────────────── */}
      <motion.div 
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass-card p-6 md:p-8 bg-gradient-to-r from-rakshak-navy to-rakshak-blue text-white shadow-2xl relative overflow-hidden"
      >
        <div className="relative z-10 flex flex-col md:flex-row items-center gap-6 md:gap-10">
          <div className="flex-shrink-0 flex flex-col items-center">
            <div className="relative w-28 h-28 md:w-32 md:h-32 flex items-center justify-center">
              <svg className="w-full h-full transform -rotate-90">
                <circle cx="56" cy="56" r="50" stroke="rgba(255,255,255,0.1)" strokeWidth="8" fill="transparent" className="md:hidden" />
                <circle cx="64" cy="64" r="58" stroke="rgba(255,255,255,0.1)" strokeWidth="10" fill="transparent" className="hidden md:block" />
                
                {/* Mobile version */}
                <motion.circle 
                  cx="56" cy="56" r="50" stroke="#16a34a" strokeWidth="8" fill="transparent"
                  strokeDasharray={314.16}
                  initial={{ strokeDashoffset: 314.16 }}
                  animate={{ strokeDashoffset: 314.16 - (314.16 * (stats?.integrity_score || 0) / 100) }}
                  transition={{ duration: 2, ease: "easeOut" }}
                  strokeLinecap="round"
                  className="md:hidden text-green-500"
                />
                
                {/* Desktop version */}
                <motion.circle 
                  cx="64" cy="64" r="58" stroke="#16a34a" strokeWidth="10" fill="transparent"
                  strokeDasharray={364.4}
                  initial={{ strokeDashoffset: 364.4 }}
                  animate={{ strokeDashoffset: 364.4 - (364.4 * (stats?.integrity_score || 0) / 100) }}
                  transition={{ duration: 2, ease: "easeOut" }}
                  strokeLinecap="round"
                  className="hidden md:block"
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-2xl md:text-3xl font-black">{stats?.integrity_score}%</span>
                <span className="text-[7px] md:text-[8px] font-black opacity-60 tracking-widest uppercase">Certified</span>
              </div>
            </div>
          </div>

          <div className="flex-1 space-y-4 text-center md:text-left">
            <div>
              <h2 className="text-xl md:text-2xl font-black tracking-tight mb-2 flex flex-col sm:flex-row items-center gap-2 sm:gap-3 justify-center md:justify-start">
                National Integrity Index (NII™)
                <ShieldCheck className="w-5 h-5 md:w-6 md:h-6 text-green-400" />
              </h2>
              <p className="text-blue-100/70 text-xs md:text-sm max-w-2xl leading-relaxed mx-auto md:mx-0">
                Aggregated system audit of all infrastructure projects. Current levels indicate <span className="text-green-400 font-bold uppercase tracking-widest text-[10px]">Stable Governance</span> across the subcontinent.
              </p>
            </div>
            
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6 pt-4">
              <div className="border-l border-white/10 pl-3 md:pl-4">
                <p className="text-[8px] md:text-[10px] font-black text-blue-300 uppercase tracking-widest mb-1">Risk Heat</p>
                <p className="text-base md:text-lg font-bold">{stats?.national_risk_score}%</p>
              </div>
              <div className="border-l border-white/10 pl-3 md:pl-4">
                <p className="text-[8px] md:text-[10px] font-black text-blue-300 uppercase tracking-widest mb-1">Audit Freq</p>
                <p className="text-base md:text-lg font-bold">4.2h / Proj</p>
              </div>
              <div className="border-l border-white/10 pl-3 md:pl-4">
                <p className="text-[8px] md:text-[10px] font-black text-blue-300 uppercase tracking-widest mb-1">Uptime</p>
                <p className="text-base md:text-lg font-bold">99.9%</p>
              </div>
              <div className="border-l border-white/10 pl-3 md:pl-4">
                <p className="text-[8px] md:text-[10px] font-black text-blue-300 uppercase tracking-widest mb-1">Verified Media</p>
                <p className="text-base md:text-lg font-bold">842K</p>
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
          
          <div className="h-[400px] md:h-[600px] w-full rounded-3xl shadow-2xl overflow-hidden border border-slate-200">
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
        
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 perspective-1000">
          {projects.slice(0, 6).map((p) => (
            <Link key={p.id} href={`/dashboard/projects/${p.id}`}>
              <Glass3D intensity={15}>
                <motion.div 
                  whileHover={{ y: -4 }}
                  className="glass-card p-6 border border-slate-100 bg-white group hover:shadow-card-hover transition-all min-h-[220px] flex flex-col justify-between overflow-hidden"
                >
                  <div>
                    <div className="flex justify-between items-start mb-4">
                      <div className={`px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-widest ${
                        p.risk_level === 'green' ? 'bg-green-100 text-green-700' :
                        p.risk_level === 'yellow' ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700'
                      }`}>
                        {p.risk_level} Risk
                      </div>
                      <span className="text-[10px] text-slate-400 font-mono">#{p.id.split('-')[0]}</span>
                    </div>
                    <h3 className="font-bold text-rakshak-navy text-lg leading-tight mb-2 group-hover:text-rakshak-blue transition-colors line-clamp-2">{p.name}</h3>
                    <div className="flex flex-wrap gap-x-4 gap-y-2 mb-4">
                      <div className="flex items-center gap-1.5">
                        <MapIcon className="w-3 h-3 text-slate-400" />
                        <span className="text-xs font-bold text-slate-500">{p.state}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <IndianRupee className="w-3 h-3 text-slate-400" />
                        <span className="text-xs font-bold text-slate-500">{(p.budget / 10000000).toFixed(1)} Cr</span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="space-y-2 mt-auto">
                    <div className="flex justify-between text-[10px] font-black uppercase tracking-widest">
                      <span className="text-slate-400">Progress</span>
                      <span className="text-rakshak-navy">{p.progress_percent}%</span>
                    </div>
                    <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                      <motion.div 
                        initial={{ width: 0 }}
                        animate={{ width: `${p.progress_percent}%` }}
                        className="h-full bg-rakshak-blue shadow-[0_0_10px_rgba(26,60,110,0.2)]" 
                      />
                    </div>
                  </div>
                </motion.div>
              </Glass3D>
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
