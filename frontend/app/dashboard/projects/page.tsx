'use client';
import { useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { api } from '@/lib/api';
import { Project, ProjectStatus, RiskLevel } from '@/lib/types';
import Link from 'next/link';
import { 
  Search, 
  MapPin, 
  IndianRupee, 
  ChevronRight, 
  Filter, 
  Table as TableIcon, 
  Grid as GridIcon,
  RefreshCw,
  Building2,
  AlertTriangle,
  Clock,
  ArrowUpDown
} from 'lucide-react';
import { format } from 'date-fns';

export default function ProjectList() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');
  
  // Filters
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [riskFilter, setRiskFilter] = useState<string>('');
  const [stateFilter, setStateFilter] = useState<string>('');

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.getProjects({ 
        status: statusFilter || undefined, 
        risk_level: riskFilter || undefined, 
        state: stateFilter || undefined 
      });
      setProjects(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [statusFilter, riskFilter, stateFilter]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const filteredProjects = projects.filter(p => 
    p.name.toLowerCase().includes(search.toLowerCase()) || 
    p.id.toLowerCase().includes(search.toLowerCase()) ||
    p.contractor?.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="p-10 space-y-10">
      {/* ── Header ─────────────────────────────────────────── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-4xl font-black text-rakshak-navy tracking-tight mb-2">Project Inventory</h1>
          <p className="text-slate-500 font-medium whitespace-pre-wrap">Audit intelligence of all registered infrastructure assets nationwide.</p>
        </div>

        <div className="flex items-center gap-3">
          <button 
            onClick={() => setViewMode('grid')}
            className={`p-3 rounded-xl border transition-all ${viewMode === 'grid' ? 'bg-rakshak-blue text-white shadow-lg border-rakshak-blue' : 'bg-white text-slate-400 border-slate-200'}`}
          >
            <GridIcon className="w-5 h-5" />
          </button>
          <button 
            onClick={() => setViewMode('table')}
            className={`p-3 rounded-xl border transition-all ${viewMode === 'table' ? 'bg-rakshak-blue text-white shadow-lg border-rakshak-blue' : 'bg-white text-slate-400 border-slate-200'}`}
          >
            <TableIcon className="w-5 h-5" />
          </button>
          <button 
            onClick={fetchData}
            className="p-3 bg-white border border-slate-200 rounded-xl shadow-sm hover:bg-slate-50 text-slate-600 transition-all"
          >
            <RefreshCw className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* ── Filters ───────────────────────────────────────────── */}
      <div className="glass-card p-6 bg-white border border-slate-100 flex flex-wrap items-center gap-6 shadow-card">
        <div className="relative flex-1 min-w-[300px]">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input 
            type="text" 
            placeholder="Search by name, ID or contractor..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-11 pr-6 py-3.5 bg-slate-50 border border-slate-100 rounded-2xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-rakshak-blue/20 transition-all shadow-sm"
          />
        </div>

        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-slate-400" />
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Filter by:</span>
          </div>

          <select 
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl text-[10px] font-black uppercase tracking-widest focus:outline-none transition-all shadow-sm"
          >
            <option value="">All Status</option>
            <option value="active">Active</option>
            <option value="delayed">Delayed</option>
            <option value="completed">Completed</option>
          </select>

          <select 
            value={riskFilter}
            onChange={(e) => setRiskFilter(e.target.value)}
            className="px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl text-[10px] font-black uppercase tracking-widest focus:outline-none transition-all shadow-sm"
          >
            <option value="">All Risk</option>
            <option value="green">Secure (Green)</option>
            <option value="yellow">Suspicious (Yellow)</option>
            <option value="red">Critical (Red)</option>
          </select>

          <input 
            type="text" 
            placeholder="State..."
            value={stateFilter}
            onChange={(e) => setStateFilter(e.target.value)}
            className="px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl text-[10px] font-black uppercase tracking-widest focus:outline-none w-32 shadow-sm transition-all"
          />
        </div>
      </div>

      {/* ── Content ───────────────────────────────────────────── */}
      {loading ? (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 animate-pulse">
          {[1, 2, 3, 4, 5, 6].map(i => <div key={i} className="h-64 bg-slate-200 rounded-3xl" />)}
        </div>
      ) : viewMode === 'grid' ? (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
          <AnimatePresence>
            {filteredProjects.map((p, i) => (
              <motion.div
                key={p.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
              >
                <Link href={`/dashboard/projects/${p.id}`}>
                  <div className="glass-card p-8 bg-white border border-slate-100 group hover:shadow-card-hover transition-all h-full flex flex-col">
                    <div className="flex justify-between items-start mb-6">
                      <div className={`px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest shadow-sm ${
                        p.risk_level === 'green' ? 'bg-green-100 text-green-700' :
                        p.risk_level === 'yellow' ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700 font-bold animate-pulse'
                      }`}>
                        {p.risk_level} Risk Level
                      </div>
                      <span className="text-[10px] text-slate-300 font-mono font-bold tracking-tighter">#{p.id.split('-')[0]}</span>
                    </div>

                    <h3 className="text-xl font-black text-rakshak-navy mb-3 leading-tight group-hover:text-rakshak-blue transition-colors line-clamp-2">
                      {p.name}
                    </h3>
                    
                    <div className="space-y-3 mb-8">
                      <div className="flex items-center gap-2 text-slate-500">
                        <MapPin className="w-3.5 h-3.5 text-slate-400" />
                        <span className="text-xs font-bold">{p.state} • {p.district}</span>
                      </div>
                      <div className="flex items-center gap-2 text-slate-500">
                        <IndianRupee className="w-3.5 h-3.5 text-slate-400" />
                        <span className="text-xs font-bold">{(p.budget / 10000000).toFixed(1)} Cr Total Budget</span>
                      </div>
                      <div className="flex items-center gap-2 text-slate-500">
                        <Building2 className="w-3.5 h-3.5 text-slate-400" />
                        <span className="text-xs font-bold truncate max-w-[200px]">{p.contractor?.name}</span>
                      </div>
                    </div>

                    <div className="mt-auto pt-6 border-t border-slate-50 space-y-3">
                      <div className="flex justify-between items-end">
                        <div>
                          <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Infrastructure Progress</p>
                          <p className="text-lg font-black text-rakshak-navy">{p.progress_percent}%</p>
                        </div>
                        <div className="p-2 bg-slate-50 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity">
                          <ChevronRight className="w-5 h-5 text-rakshak-blue" />
                        </div>
                      </div>
                      <div className="h-2 bg-slate-100 rounded-full overflow-hidden shadow-inner">
                        <motion.div 
                          initial={{ width: 0 }}
                          animate={{ width: `${p.progress_percent}%` }}
                          className={`h-full ${p.status === 'delayed' ? 'bg-red-500' : 'bg-rakshak-blue'} shadow-lg`} 
                        />
                      </div>
                    </div>
                  </div>
                </Link>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      ) : (
        <div className="glass-card bg-white border border-slate-100 overflow-hidden shadow-card">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-100">
                <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Project Identification</th>
                <th className="px-6 py-5 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Location</th>
                <th className="px-6 py-5 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Audit Status</th>
                <th className="px-6 py-5 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Progress</th>
                <th className="px-6 py-5 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Risk Profile</th>
                <th className="px-8 py-5 text-right text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filteredProjects.map((p) => (
                <tr key={p.id} className="hover:bg-blue-50/20 transition-all group">
                  <td className="px-8 py-6">
                    <div>
                      <h4 className="font-bold text-rakshak-navy text-sm leading-tight group-hover:text-rakshak-blue transition-colors mb-1">{p.name}</h4>
                      <p className="text-[10px] text-slate-400 font-mono font-bold tracking-tighter">ID: {p.id}</p>
                    </div>
                  </td>
                  <td className="px-6 py-6">
                    <p className="text-xs font-bold text-slate-600 mb-0.5">{p.state}</p>
                    <p className="text-[10px] text-slate-400 font-medium">{p.district}</p>
                  </td>
                  <td className="px-6 py-6">
                    <span className={`px-2 py-1 rounded-md text-[9px] font-black uppercase tracking-widest ${
                      p.status === 'active' ? 'bg-blue-100 text-blue-700' :
                      p.status === 'delayed' ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'
                    }`}>
                      {p.status}
                    </span>
                  </td>
                  <td className="px-6 py-6">
                    <div className="flex items-center gap-3">
                      <div className="w-24 h-1.5 bg-slate-100 rounded-full overflow-hidden flex-shrink-0">
                        <div className="bg-rakshak-blue h-full" style={{ width: `${p.progress_percent}%` }} />
                      </div>
                      <span className="text-xs font-black text-rakshak-navy font-mono">{p.progress_percent}%</span>
                    </div>
                  </td>
                  <td className="px-6 py-6">
                    <div className="flex items-center gap-2">
                      <div className={`w-2 h-2 rounded-full ${
                        p.risk_level === 'green' ? 'bg-green-500' :
                        p.risk_level === 'yellow' ? 'bg-yellow-500' : 'bg-red-500 animate-pulse'
                      }`} />
                      <span className="text-xs font-bold text-slate-700">{p.risk_score}% Score</span>
                    </div>
                  </td>
                  <td className="px-8 py-6 text-right">
                    <Link href={`/dashboard/projects/${p.id}`}>
                      <button className="p-3 bg-white border border-slate-200 rounded-xl text-rakshak-blue shadow-sm hover:shadow-md hover:bg-rakshak-blue hover:text-white transition-all">
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filteredProjects.length === 0 && (
            <div className="p-20 flex flex-col items-center justify-center text-slate-400">
              <Building2 className="w-16 h-16 opacity-30 mb-4" />
              <p className="font-black uppercase tracking-[0.2em] text-xs">No projects found matching current criteria</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
