'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { api } from '@/lib/api';
import { Loader2, ShieldCheck, Mail, Lock, User, Building2, ArrowRight, Globe } from 'lucide-react';
import Link from 'next/link';

export default function RegisterPage() {
  const [formData, setFormData] = useState({
    email: '',
    full_name: '',
    password: '',
    role: 'officer',
    department: ''
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      await api.register(formData);
      router.push('/login?registered=true');
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Registration failed. Try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex flex-col items-center justify-center p-6 relative overflow-hidden">
      {/* Official Watermark */}
      <div className="absolute bottom-0 left-0 w-[600px] h-[600px] opacity-[0.03] pointer-events-none translate-y-1/2 -translate-x-1/2">
         <img src="https://upload.wikimedia.org/wikipedia/commons/5/55/Emblem_of_India.svg" alt="Emblem" className="w-full h-full grayscale" />
      </div>

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-2xl w-full"
      >
        <div className="flex flex-col items-center mb-10 text-center">
          <div className="flex items-center gap-3 mb-6 bg-white px-5 py-2 rounded-full shadow-sm border border-slate-200">
             <img src="https://upload.wikimedia.org/wikipedia/commons/5/55/Emblem_of_India.svg" alt="Emblem" className="w-5 h-5 grayscale opacity-70" />
             <span className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-500">Government of India • National Audit Authority</span>
          </div>
          
          <h1 className="text-4xl font-black text-rakshak-navy tracking-tighter uppercase mb-1 flex items-center gap-3 justify-center">
             <Globe className="w-8 h-8 text-rakshak-blue" />
             Integrity Enrollment
          </h1>
          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-[0.3em] mb-4">Official Personnel Registry (OPR-v1)</p>
          <div className="h-1 w-20 bg-rakshak-saffron rounded-full mx-auto" />
        </div>

        <div className="glass-card p-12 bg-white shadow-2xl border border-slate-100 relative overflow-hidden">
          <form onSubmit={handleSubmit} className="space-y-8 relative z-10">
            <div className="grid md:grid-cols-2 gap-8">
               <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Full Identity Name</label>
                  <div className="relative">
                     <User className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                     <input 
                        required type="text" 
                        value={formData.full_name}
                        onChange={e => setFormData({...formData, full_name: e.target.value})}
                        className="w-full pl-12 pr-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-medium focus:ring-2 focus:ring-rakshak-blue/20 outline-none transition-all" 
                        placeholder="Dr. Rajesh Kumar"
                     />
                  </div>
               </div>
               
               <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Official Govt Email</label>
                  <div className="relative">
                     <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                     <input 
                        required type="email" 
                        value={formData.email}
                        onChange={e => setFormData({...formData, email: e.target.value})}
                        className="w-full pl-12 pr-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-medium focus:ring-2 focus:ring-rakshak-blue/20 outline-none transition-all font-mono" 
                        placeholder="name@gov.in"
                     />
                  </div>
               </div>

               <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Assigned Department</label>
                  <div className="relative">
                     <Building2 className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                     <input 
                        required type="text" 
                        value={formData.department}
                        onChange={e => setFormData({...formData, department: e.target.value})}
                        className="w-full pl-12 pr-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-medium focus:ring-2 focus:ring-rakshak-blue/20 outline-none transition-all" 
                        placeholder="Ministry of Power"
                     />
                  </div>
               </div>

               <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Access Protocol (Role)</label>
                  <select 
                     value={formData.role}
                     onChange={e => setFormData({...formData, role: e.target.value})}
                     className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold focus:ring-2 focus:ring-rakshak-blue/20 outline-none appearance-none transition-all shadow-sm"
                  >
                     <option value="officer">Field Officer</option>
                     <option value="auditor">National Auditor</option>
                     <option value="admin">System Admin</option>
                  </select>
               </div>

               <div className="space-y-2 col-span-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Integrity Access Key</label>
                  <div className="relative">
                     <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                     <input 
                        required type="password" 
                        value={formData.password}
                        onChange={e => setFormData({...formData, password: e.target.value})}
                        className="w-full pl-12 pr-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-medium focus:ring-2 focus:ring-rakshak-blue/20 outline-none transition-all" 
                        placeholder="••••••••••••"
                     />
                  </div>
               </div>
            </div>

            {error && <p className="text-red-500 text-[10px] font-black uppercase text-center tracking-widest bg-red-50 p-3 rounded-xl border border-red-100">{error}</p>}

            <button 
              type="submit"
              disabled={isLoading}
              className="w-full py-5 bg-rakshak-navy text-white rounded-2xl font-black uppercase text-xs tracking-[0.2em] shadow-2xl hover:bg-black active:translate-y-1 transition-all border-b-4 border-rakshak-blue flex items-center justify-center gap-3 lg:mt-4"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Processing Enrollment...
                </>
              ) : (
                <>
                  Initiate Handshake Protocol <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          <div className="mt-12 flex flex-col items-center gap-3 border-t border-slate-50 pt-10">
             <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Already Verified?</p>
             <Link href="/login">
                <div className="px-8 py-2 bg-slate-100 text-slate-500 text-[10px] font-black uppercase tracking-widest rounded-full hover:bg-rakshak-blue hover:text-white transition-all cursor-pointer shadow-sm">
                   Sign In Registered Identity
                </div>
             </Link>
          </div>
        </div>

        <div className="mt-12 flex items-center justify-center gap-10">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-green-600" />
            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Biometric Ready</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Secure Handshake Active</span>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
