'use client';
import { useState, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { api } from '@/lib/api';
import { Contractor, Project } from '@/lib/types';
import { 
  Building2, 
  UserPlus, 
  PlusCircle, 
  History, 
  MapPin, 
  IndianRupee, 
  Layers,
  Trash2,
  Settings
} from 'lucide-react';
import { format } from 'date-fns';

type Tab = 'projects' | 'contractors' | 'officers' | 'audit';

export default function AdminPortal() {
  const [activeTab, setActiveTab] = useState<Tab>('projects');
  const [projects, setProjects] = useState<Project[]>([]);
  const [contractors, setContractors] = useState<Contractor[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form states
  const [showCreateProject, setShowCreateProject] = useState(false);
  const [newProject, setNewProject] = useState({
    name: '',
    description: '',
    state: '',
    district: '',
    latitude: 20.5937,
    longitude: 78.9629,
    budget: 10000000,
    start_date: format(new Date(), 'yyyy-MM-dd'),
    deadline: format(new Date(Date.now() + 365 * 24 * 3600 * 1000), 'yyyy-MM-dd'),
    contractor_id: '',
    required_evidence_types: ['image', 'gps_log']
  });

  const [showCreateContractor, setShowCreateContractor] = useState(false);
  const [newContractor, setNewContractor] = useState({
    name: '',
    registration_no: '',
    contact_email: '',
    contact_phone: '',
    address: ''
  });

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [projData, contData] = await Promise.all([
        api.getProjects(),
        api.getContractors()
      ]);
      setProjects(projData);
      setContractors(contData);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await api.createProject({
        ...newProject,
        start_date: new Date(newProject.start_date).toISOString(),
        deadline: new Date(newProject.deadline).toISOString(),
      });
      setShowCreateProject(false);
      fetchData();
    } catch (e) {
      console.error(e);
      alert('Failed to create project');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCreateContractor = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await api.createContractor(newContractor);
      setShowCreateContractor(false);
      fetchData();
    } catch (e) {
      console.error(e);
      alert('Failed to create contractor');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="p-10 space-y-10 min-h-screen">
      {/* ── Admin Header ─────────────────────────────────────────── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <h1 className="text-4xl font-black text-rakshak-navy tracking-tight">Admin Operations</h1>
            <div className="bg-rakshak-saffron/10 text-rakshak-saffron text-[10px] font-black px-2.5 py-1 rounded-lg uppercase tracking-widest border border-rakshak-saffron/10">
              Internal Control
            </div>
          </div>
          <p className="text-slate-500 font-medium whitespace-pre-wrap">Configure project registries, manage field officers, and deploy governance assets.</p>
        </div>

        <div className="flex items-center gap-3">
          <button 
            onClick={() => setActiveTab('audit')}
            className={`p-4 rounded-2xl border transition-all ${activeTab === 'audit' ? 'bg-rakshak-navy text-white' : 'bg-white text-slate-400 hover:bg-slate-50'}`}
          >
            <History className="w-5 h-5" />
          </button>
          <button 
            onClick={() => fetchData()}
            className="p-4 bg-white border border-slate-200 rounded-2xl shadow-sm hover:bg-slate-50 transition-all text-slate-600"
          >
            <Settings className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* ── Tabs ──────────────────────────────────────────────────── */}
      <div className="flex items-center gap-2 p-1 bg-slate-100 rounded-2xl w-fit">
        {[
          { id: 'projects', label: 'Project Assets', icon: Layers },
          { id: 'contractors', label: 'Vendor Registry', icon: Building2 },
          { id: 'officers', label: 'Officer Deployment', icon: UserPlus },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as Tab)}
            className={`flex items-center gap-3 px-6 py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${
              activeTab === tab.id ? 'bg-white text-rakshak-blue shadow-sm' : 'text-slate-400 hover:text-slate-600'
            }`}
          >
            <tab.icon className={`w-4 h-4 ${activeTab === tab.id ? 'text-rakshak-blue' : 'text-slate-400'}`} />
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── Tab Content ───────────────────────────────────────────── */}
      <div className="space-y-8">
        {loading ? (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8 animate-pulse">
            {[1, 2, 3, 4, 5, 6].map(i => <div key={i} className="h-48 bg-slate-100 rounded-3xl" />)}
          </div>
        ) : activeTab === 'projects' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-black text-rakshak-navy tracking-tight">Project Registry</h2>
              <button 
                onClick={() => setShowCreateProject(true)}
                className="flex items-center gap-2 px-6 py-3.5 bg-rakshak-blue text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-rakshak-navy transition-all shadow-xl shadow-rakshak-blue/20"
              >
                <PlusCircle className="w-4 h-4" />
                New National Asset
              </button>
            </div>

            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
              {projects.map((p) => (
                <div key={p.id} className="glass-card p-6 bg-white border border-slate-100 shadow-card">
                  <div className="flex justify-between items-start mb-4">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">#{p.id.split('-')[0]}</span>
                    <div className="flex gap-2">
                       <button className="p-2 text-slate-400 hover:text-rakshak-blue"><Settings className="w-4 h-4" /></button>
                    </div>
                  </div>
                  <h3 className="font-bold text-rakshak-navy text-lg leading-tight mb-4">{p.name}</h3>
                  <div className="space-y-2 mb-6 text-xs text-slate-500 font-medium">
                    <p className="flex items-center gap-2"><MapPin className="w-3.5 h-3.5 opacity-50" /> {p.state}, {p.district}</p>
                    <p className="flex items-center gap-2"><IndianRupee className="w-3.5 h-3.5 opacity-50" /> ₹{(p.budget/10000000).toFixed(1)} Cr</p>
                  </div>
                  <div className="pt-4 border-t border-slate-50 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className={`w-2 h-2 rounded-full ${p.risk_level === 'green' ? 'bg-green-500' : p.risk_level === 'yellow' ? 'bg-yellow-500' : 'bg-red-500'}`} />
                      <span className="text-[10px] font-black uppercase text-slate-400">{p.risk_level} Risk</span>
                    </div>
                    <span className="text-sm font-black text-rakshak-navy">{p.progress_percent}%</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'contractors' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-black text-rakshak-navy tracking-tight">Approved Vendors</h2>
              <button 
                onClick={() => setShowCreateContractor(true)}
                className="flex items-center gap-2 px-6 py-3.5 bg-rakshak-blue text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-rakshak-navy transition-all shadow-xl shadow-rakshak-blue/20"
              >
                <PlusCircle className="w-4 h-4" />
                Add Organization
              </button>
            </div>

            <div className="bg-white border border-slate-100 rounded-3xl overflow-hidden shadow-card">
              <table className="w-full text-left">
                <thead className="bg-slate-50/80 border-b border-slate-100 italic">
                  <tr>
                    <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Organization Name</th>
                    <th className="px-6 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Reg ID</th>
                    <th className="px-6 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Project Load</th>
                    <th className="px-6 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Integrity Rank</th>
                    <th className="px-8 py-5 text-right text-[10px] font-black text-slate-400 uppercase tracking-widest">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {contractors.map((c) => (
                    <tr key={c.id} className="hover:bg-slate-50/50 transition-all">
                      <td className="px-8 py-6">
                        <p className="font-bold text-rakshak-navy">{c.name}</p>
                        <p className="text-[10px] text-slate-400 font-medium">{c.contact_email}</p>
                      </td>
                      <td className="px-6 py-6 font-mono text-[10px] font-bold text-slate-600">{c.registration_no}</td>
                      <td className="px-6 py-6 font-bold text-slate-700">{c.total_projects} Active</td>
                      <td className="px-6 py-6">
                        <div className={`px-2 py-1 rounded-md text-[9px] font-black uppercase tracking-widest inline-block ${
                          c.risk_score < 30 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                        }`}>
                          Score: {c.risk_score}%
                        </div>
                      </td>
                      <td className="px-8 py-6 text-right">
                        <button className="text-slate-400 hover:text-red-500"><Trash2 className="w-4 h-4" /></button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Create Project Modal */}
        <AnimatePresence>
          {showCreateProject && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
              <motion.div 
                initial={{ opacity: 0 }} 
                animate={{ opacity: 1 }} 
                exit={{ opacity: 0 }}
                onClick={() => setShowCreateProject(false)}
                className="absolute inset-0 bg-rakshak-navy/60 backdrop-blur-md" 
              />
              <motion.div 
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                className="relative bg-white w-full max-w-2xl rounded-3xl shadow-2xl overflow-hidden"
              >
                <div className="p-8 bg-rakshak-navy text-white flex justify-between items-center border-b-4 border-rakshak-blue">
                  <h2 className="text-2xl font-black uppercase tracking-tight">Initiate Infrastructure Asset</h2>
                  <button onClick={() => setShowCreateProject(false)} className="p-2 hover:bg-white/10 rounded-xl transition-all"><Trash2 className="w-5 h-5 opacity-50" /></button>
                </div>
                
                <form onSubmit={handleCreateProject} className="p-8 space-y-6 max-h-[70vh] overflow-y-auto">
                  <div className="grid md:grid-cols-2 gap-6">
                    <div className="space-y-2 col-span-2">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Project Command Title</label>
                      <input 
                        required 
                        type="text" 
                        value={newProject.name}
                        onChange={e => setNewProject({...newProject, name: e.target.value})}
                        className="w-full p-4 bg-slate-50 border-2 border-slate-100 rounded-2xl text-sm font-bold focus:border-rakshak-blue outline-none transition-all" 
                        placeholder="e.g. NH-44 Expressway Expansion Ph-II"
                      />
                    </div>

                    <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Asset Location (State)</label>
                        <input required type="text" value={newProject.state} onChange={e => setNewProject({...newProject, state: e.target.value})} className="w-full p-4 bg-slate-50 border-2 border-slate-100 rounded-2xl text-sm font-bold focus:border-rakshak-blue outline-none" />
                    </div>
                    <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">District Focus</label>
                        <input required type="text" value={newProject.district} onChange={e => setNewProject({...newProject, district: e.target.value})} className="w-full p-4 bg-slate-50 border-2 border-slate-100 rounded-2xl text-sm font-bold focus:border-rakshak-blue outline-none" />
                    </div>

                    <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Fiscal Budget (INR)</label>
                        <input required type="number" value={newProject.budget} onChange={e => setNewProject({...newProject, budget: parseInt(e.target.value)})} className="w-full p-4 bg-slate-50 border-2 border-slate-100 rounded-2xl text-sm font-bold focus:border-rakshak-blue outline-none" />
                    </div>
                    <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Execution Vendor</label>
                        <select 
                          required 
                          value={newProject.contractor_id}
                          onChange={e => setNewProject({...newProject, contractor_id: e.target.value})}
                          className="w-full p-4 bg-slate-50 border-2 border-slate-100 rounded-2xl text-sm font-bold focus:border-rakshak-blue outline-none"
                        >
                          <option value="">Select Primary Contractor</option>
                          {contractors.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                        </select>
                    </div>

                    <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Registry Start Date</label>
                        <input type="date" value={newProject.start_date} onChange={e => setNewProject({...newProject, start_date: e.target.value})} className="w-full p-4 bg-slate-50 border-2 border-slate-100 rounded-2xl text-sm font-bold focus:border-rakshak-blue outline-none" />
                    </div>
                    <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Final Integrity Deadline</label>
                        <input type="date" value={newProject.deadline} onChange={e => setNewProject({...newProject, deadline: e.target.value})} className="w-full p-4 bg-slate-50 border-2 border-slate-100 rounded-2xl text-sm font-bold focus:border-rakshak-blue outline-none" />
                    </div>
                  </div>

                  <div className="pt-4 flex gap-4">
                    <button type="button" onClick={() => setShowCreateProject(false)} className="flex-1 py-4 text-xs font-black uppercase tracking-widest text-slate-400 hober:text-slate-600">Cancel</button>
                    <button 
                        disabled={isSubmitting}
                        type="submit" 
                        className="flex-[2] py-4 bg-rakshak-blue text-white rounded-2xl font-black uppercase text-xs tracking-[0.2em] shadow-xl hover:bg-rakshak-navy active:translate-y-1 transition-all"
                    >
                      {isSubmitting ? 'Syncing...' : 'Deploy Asset Registry'}
                    </button>
                  </div>
                </form>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* Create Contractor Modal */}
        <AnimatePresence>
          {showCreateContractor && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
              <motion.div 
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                onClick={() => setShowCreateContractor(false)}
                className="absolute inset-0 bg-rakshak-navy/60 backdrop-blur-md" 
              />
              <motion.div 
                initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
                className="relative bg-white w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden"
              >
                <div className="p-8 bg-rakshak-gold text-rakshak-navy flex justify-between items-center border-b-4 border-yellow-600">
                  <h2 className="text-xl font-black uppercase tracking-tight">Register Integrity Vendor</h2>
                </div>
                
                <form onSubmit={handleCreateContractor} className="p-8 space-y-4">
                  <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Organization Name</label>
                      <input required type="text" value={newContractor.name} onChange={e => setNewContractor({...newContractor, name: e.target.value})} className="w-full p-4 bg-slate-50 border-2 border-slate-100 rounded-2xl text-sm font-bold" />
                  </div>
                  <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Reg ID (GST/Ministry)</label>
                      <input required type="text" value={newContractor.registration_no} onChange={e => setNewContractor({...newContractor, registration_no: e.target.value})} className="w-full p-4 bg-slate-50 border-2 border-slate-100 rounded-2xl text-sm font-bold" />
                  </div>
                  <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Official Email</label>
                      <input required type="email" value={newContractor.contact_email} onChange={e => setNewContractor({...newContractor, contact_email: e.target.value})} className="w-full p-4 bg-slate-50 border-2 border-slate-100 rounded-2xl text-sm font-bold" />
                  </div>

                  <div className="pt-6 flex gap-4">
                    <button 
                        disabled={isSubmitting}
                        type="submit" 
                        className="w-full py-4 bg-rakshak-navy text-white rounded-2xl font-black uppercase text-xs tracking-[0.2em] shadow-xl hover:bg-black transition-all"
                    >
                      {isSubmitting ? 'Processing...' : 'Verify & Add Vendor'}
                    </button>
                  </div>
                </form>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
