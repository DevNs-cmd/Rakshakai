'use client';
import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { api } from '@/lib/api';
import { Project, Evidence, RiskHistoryPoint } from '@/lib/types';
import RiskGauge from '@/components/RiskGauge';
import EvidenceUpload from '@/components/EvidenceUpload';
import Glass3D from '@/components/Glass3D';
import { 
  ArrowLeft, 
  IndianRupee, 
  Calendar, 
  User, 
  CheckCircle2, 
  Clock, 
  FileText,
  AlertTriangle,
  Zap,
  History,
  ShieldCheck
} from 'lucide-react';
import { format } from 'date-fns';

interface SimResult {
  message: string;
  original_risk_score: number;
  new_risk_score: number;
}

import { 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer 
} from 'recharts';

export default function ProjectDetail() {
  const { id } = useParams() as { id: string };
  const router = useRouter();
  const [project, setProject] = useState<Project | null>(null);
  const [evidence, setEvidence] = useState<Evidence[]>([]);
  const [riskHistory, setRiskHistory] = useState<RiskHistoryPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [simulating, setSimulating] = useState(false);
  const [simResult, setSimResult] = useState<SimResult | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const [projData, evData, riskData] = await Promise.all([
        api.getProject(id),
        api.getProjectEvidence(id),
        api.getHistory(id)
      ]);
      setProject(projData);
      setEvidence(evData);
      setRiskHistory(riskData);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const simulateFailure = async (scenario: string) => {
    setSimulating(true);
    try {
      const res = await api.simulateFailure(id, scenario);
      setSimResult(res);
      await fetchData();
      setTimeout(() => setSimResult(null), 10000);
    } catch (e) {
      console.error(e);
    } finally {
      setSimulating(false);
    }
  };

  const updateMilestone = async (mId: string, completed: boolean) => {
    try {
      await api.updateMilestone(id, mId, { is_completed: completed, completion_date: completed ? new Date().toISOString() : null });
      fetchData();
    } catch (e) { console.error(e); }
  };

  if (loading) return (
    <div className="p-10 space-y-10 animate-pulse">
      <div className="h-20 bg-slate-200 rounded-3xl" />
      <div className="grid grid-cols-3 gap-10">
        <div className="col-span-2 h-[600px] bg-slate-200 rounded-3xl" />
        <div className="h-96 bg-slate-200 rounded-3xl" />
      </div>
    </div>
  );

  if (!project) return <div>Project Not Found</div>;

  return (
    <div className="p-10 space-y-10">
      {/* ── Header ─────────────────────────────────────────── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="flex items-center gap-6">
          <button 
            onClick={() => router.back()}
            className="p-3 bg-white border border-slate-200 rounded-2xl shadow-sm hover:bg-slate-50 transition-all text-slate-600"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <div className="flex items-center gap-3 mb-1">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none">{project.state} • {project.district}</span>
              <span className={`px-2 py-0.5 rounded-md text-[8px] font-black uppercase tracking-widest ${
                project.risk_level === 'green' ? 'bg-green-100 text-green-700' :
                project.risk_level === 'yellow' ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700'
              }`}>
                {project.risk_level} Risk Level
              </span>
            </div>
            <h1 className="text-3xl font-black text-rakshak-navy tracking-tight">{project.name}</h1>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="px-6 py-3 bg-white border border-slate-200 rounded-2xl shadow-sm flex items-center gap-4">
            <div>
              <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Budget Utilization</p>
              <div className="flex items-center gap-2">
                <span className="text-lg font-bold">₹ {(project.spent_amount / 10000000).toFixed(1)} Cr</span>
                <span className="text-xs text-slate-400 font-medium italic">/ ₹ {(project.budget / 10000000).toFixed(1)} Cr</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Simulation Alert ────────────────────────────────── */}
      <AnimatePresence>
        {simResult && (
          <motion.div 
            initial={{ opacity: 0, y: -20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.95 }}
            className="p-6 bg-red-600 text-white rounded-3xl shadow-2xl flex items-center justify-between border-b-8 border-red-800"
          >
            <div className="flex items-center gap-6">
              <div className="w-14 h-14 bg-white/20 rounded-2xl flex items-center justify-center animate-pulse">
                <AlertTriangle className="w-8 h-8" />
              </div>
              <div>
                <h3 className="text-xl font-black uppercase tracking-tight">CRITICAL ANOMALY DETECTED</h3>
                <p className="text-sm font-medium opacity-80">Scenario Triggered: {simResult.message}. Integrity audit alerts pushed to ministry.</p>
              </div>
            </div>
            <div className="flex items-center gap-8">
              <div className="text-center">
                <p className="text-[10px] font-black opacity-60 uppercase tracking-widest mb-1">Old Score</p>
                <p className="text-2xl font-bold">{simResult.original_risk_score.toFixed(1)}</p>
              </div>
              <div className="text-3xl font-light opacity-30">→</div>
              <div className="text-center">
                <p className="text-[10px] font-black opacity-60 uppercase tracking-widest mb-1">Impact Score</p>
                <p className="text-3xl font-black text-yellow-300">{simResult.new_risk_score.toFixed(1)}</p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
        <div className="lg:col-span-2 space-y-10">
          {/* Main Visual Stats */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 perspective-1000">
            <Glass3D intensity={15}>
              <div className="glass-card p-8 flex flex-col items-center justify-center bg-white shadow-card h-full overflow-hidden transition-all group hover:shadow-card-hover">
                <RiskGauge score={project.risk_score} size={150} />
                <div className="mt-4 text-center">
                  <p className={`text-sm font-black uppercase tracking-[0.2em] ${project.risk_level === 'red' ? 'text-red-600' : 'text-green-600'}`}>
                    {project.risk_level} SHIELD
                  </p>
                </div>
              </div>
            </Glass3D>

            <Glass3D intensity={15}>
              <div className="glass-card p-8 flex flex-col items-center justify-center bg-white shadow-card h-full overflow-hidden transition-all group hover:shadow-card-hover">
                <div className="relative w-32 h-32 flex items-center justify-center">
                  <svg className="w-full h-full transform -rotate-90">
                    <circle cx="64" cy="64" r="58" stroke="#f1f5f9" strokeWidth="10" fill="transparent" />
                    <motion.circle 
                      cx="64" cy="64" r="58" stroke="#1e40af" strokeWidth="10" fill="transparent"
                      strokeDasharray={364.4}
                      initial={{ strokeDashoffset: 364.4 }}
                      animate={{ strokeDashoffset: 364.4 - (364.4 * project.progress_percent / 100) }}
                      transition={{ duration: 1.5 }}
                      strokeLinecap="round"
                    />
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-2xl font-black text-rakshak-navy">{project.progress_percent}%</span>
                    <span className="text-[8px] font-black text-slate-400 tracking-widest uppercase">Verified</span>
                  </div>
                </div>
                <div className="mt-6 text-center">
                  <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Milestone Progress</p>
                </div>
              </div>
            </Glass3D>

            <Glass3D intensity={15}>
              <div className="glass-card p-8 flex flex-col items-center justify-center bg-white shadow-card h-full overflow-hidden transition-all group hover:shadow-card-hover">
                <div className="w-16 h-16 bg-blue-50 rounded-2xl flex items-center justify-center mb-4">
                  <Calendar className="w-8 h-8 text-rakshak-blue" />
                </div>
                <div className="text-center space-y-1">
                  <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Deadline</p>
                  <p className="text-lg font-bold text-rakshak-navy">{format(new Date(project.deadline), 'dd MMM yyyy')}</p>
                  <p className="text-[10px] text-slate-500 font-bold uppercase">
                    {Math.ceil((new Date(project.deadline).getTime() - new Date().getTime()) / (1000 * 3600 * 24))} Days Left
                  </p>
                </div>
              </div>
            </Glass3D>
          </div>

          {/* Risk History Chart */}
          <div className="glass-card p-8 bg-white border border-slate-100 shadow-card">
            <div className="flex items-center justify-between mb-8 pb-4 border-b border-slate-50">
              <h3 className="font-black text-rakshak-navy uppercase tracking-widest text-xs flex items-center gap-2">
                <History className="w-4 h-4 text-slate-400" />
                Audit Trail Analytics (Audit Intelligence™)
              </h3>
            </div>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={riskHistory.slice().reverse()}>
                  <defs>
                    <linearGradient id="colorRisk" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#ef4444" stopOpacity={0.1}/>
                      <stop offset="95%" stopColor="#ef4444" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis 
                    dataKey="calculated_at" 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fontSize: 9, fontWeight: 700, fill: '#94a3b8' }}
                    tickFormatter={(val) => format(new Date(val), 'MMM dd')}
                  />
                  <YAxis domain={[0, 100]} axisLine={false} tickLine={false} tick={{ fontSize: 9, fontWeight: 700, fill: '#94a3b8' }} />
                  <Tooltip 
                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 8px 32px rgba(0,0,0,0.1)', fontWeight: 700, fontSize: '11px' }}
                  />
                  <Area type="monotone" dataKey="risk_score" stroke="#dc2626" strokeWidth={3} fillOpacity={1} fill="url(#colorRisk)" name="Risk Score" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Milestones */}
          <div className="glass-card p-8 bg-white border border-slate-100 shadow-card">
            <h3 className="font-black text-rakshak-navy uppercase tracking-widest text-xs mb-8">Auditable Milestones</h3>
            <div className="space-y-4">
              {project.milestones?.sort((a, b) => a.order_index - b.order_index).map((m) => (
                <div key={m.id} className={`p-5 rounded-2xl border transition-all flex items-center justify-between group ${m.is_completed ? 'bg-green-50/50 border-green-100' : 'bg-slate-50/50 border-slate-100'}`}>
                  <div className="flex items-center gap-5">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center border font-black text-sm ${m.is_completed ? 'bg-green-100 border-green-200 text-green-700' : 'bg-white border-slate-200 text-slate-400'}`}>
                      {m.is_completed ? <CheckCircle2 className="w-6 h-6" /> : m.order_index + 1}
                    </div>
                    <div>
                      <h4 className={`font-bold text-sm ${m.is_completed ? 'text-green-800' : 'text-slate-800'}`}>{m.title}</h4>
                      <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Due: {format(new Date(m.due_date), 'dd MMM yyyy')}</p>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-6">
                    <div className="text-right">
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Weight</p>
                      <p className="text-sm font-bold">{m.weight_percent}%</p>
                    </div>
                    
                    <button 
                      onClick={() => updateMilestone(m.id, !m.is_completed)}
                      className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                        m.is_completed ? 'bg-white text-slate-400 border border-slate-200 hover:text-red-500' : 'bg-rakshak-blue text-white shadow-lg hover:bg-rakshak-navy'
                      }`}
                    >
                      {m.is_completed ? 'Reset' : 'Verify Completion'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Evidence Gallery */}
          <div className="glass-card p-8 bg-white border border-slate-100 shadow-card">
            <h3 className="font-black text-rakshak-navy uppercase tracking-widest text-xs mb-8 flex justify-between items-center">
              Field Evidence Vault
              <span className="text-slate-400 italic text-[10px] font-medium tracking-normal">{evidence.length} Items Indexed</span>
            </h3>
            {evidence.length === 0 ? (
              <div className="h-48 flex flex-col items-center justify-center border-2 border-dashed border-slate-100 rounded-3xl text-slate-400 space-y-2">
                <FileText className="w-8 h-8 opacity-20" />
                <p className="text-xs font-bold uppercase tracking-[0.2em]">No media captured</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
                {evidence.map((ev, i) => (
                  <motion.div 
                    key={ev.id}
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: i * 0.05 }}
                    className="group relative rounded-2xl overflow-hidden border border-slate-100 shadow-sm"
                  >
                    <div className="aspect-square bg-slate-900 overflow-hidden">
                      <img 
                        src={`http://localhost:8000${ev.file_url}`} 
                        alt="Evidence" 
                        className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110 opacity-90 group-hover:opacity-100" 
                      />
                    </div>
                    <div className="absolute inset-x-0 bottom-0 p-3 bg-gradient-to-t from-black/80 to-transparent text-white">
                      <div className="flex items-center gap-1.5 mb-1">
                        <ShieldCheck className={`w-3 h-3 ${ev.location_verified ? 'text-green-400' : 'text-red-400'}`} />
                        <span className="text-[8px] font-black uppercase tracking-widest">
                          {ev.location_verified ? 'Verified Location' : 'Location Mismatch'}
                        </span>
                      </div>
                      <p className="text-[10px] text-white/70 font-mono truncate">{ev.sha256_hash.slice(0, 16)}...</p>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="space-y-10">
          {/* Upload Panel */}
          <EvidenceUpload projectId={id} onSuccess={fetchData} />

          {/* Simulation Tools (Demo Hack) */}
          <div className="glass-card p-8 border border-white bg-gradient-to-br from-rakshak-navy to-slate-900 text-white shadow-2xl overflow-hidden relative">
            <div className="relative z-10">
              <h3 className="font-black text-xs uppercase tracking-[0.3em] text-blue-400 mb-8 border-b border-white/10 pb-4 flex items-center gap-3">
                <Zap className="w-4 h-4 fill-blue-400" />
                Stress Test Controls
              </h3>
              
              <div className="space-y-4">
                {[
                  { id: 'no_evidence', label: 'Simulate Evidence Blackout', icon: <Clock className="w-4 h-4" />, desc: '14-day gap in field reporting' },
                  { id: 'budget_overrun', label: 'Simulate Budget Anomaly', icon: <IndianRupee className="w-4 h-4" />, desc: 'Identify 40% expenditure spike' },
                  { id: 'milestone_failure', label: 'Simulate Critical Delay', icon: <AlertTriangle className="w-4 h-4" />, desc: 'Miss structural deadline' },
                ].map((s) => (
                  <button 
                    key={s.id}
                    disabled={simulating}
                    onClick={() => simulateFailure(s.id)}
                    className="w-full p-5 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 hover:border-white/20 transition-all text-left group flex items-start gap-4"
                  >
                    <div className="p-3 bg-white/10 rounded-xl group-hover:scale-110 transition-transform">
                      {s.icon}
                    </div>
                    <div>
                      <h4 className="font-bold text-sm mb-1">{s.label}</h4>
                      <p className="text-[10px] text-blue-300 font-medium">{s.desc}</p>
                    </div>
                  </button>
                ))}
              </div>
            </div>
            
            <div className="absolute top-0 right-0 w-32 h-32 bg-red-500/10 blur-3xl rounded-full translate-x-1/2 -translate-y-1/2" />
          </div>

          {/* Contractor Profile */}
          <div className="glass-card p-8 bg-white border border-slate-100 shadow-card">
            <h3 className="font-black text-rakshak-navy uppercase tracking-widest text-xs mb-8">Executive Profile</h3>
            <div className="flex items-center gap-6 mb-8">
              <div className="w-16 h-16 bg-blue-50 rounded-2xl flex items-center justify-center">
                <User className="w-8 h-8 text-rakshak-blue" />
              </div>
              <div>
                <h4 className="font-black text-rakshak-navy text-xl leading-none mb-1">{project.contractor?.name}</h4>
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Reg: {project.contractor?.registration_no}</p>
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 bg-slate-50 rounded-2xl text-center">
                <p className="text-[9px] font-black text-slate-400 uppercase mb-1">Historical Risk</p>
                <p className={`text-lg font-bold ${(project.contractor?.risk_score ?? 0) > 50 ? 'text-red-500' : 'text-green-600'}`}>
                  {project.contractor?.risk_score}%
                </p>
              </div>
              <div className="p-4 bg-slate-50 rounded-2xl text-center">
                <p className="text-[9px] font-black text-slate-400 uppercase mb-1">Avg Lead Delay</p>
                <p className="text-lg font-bold text-rakshak-navy">{project.contractor?.avg_delay_days}d</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
