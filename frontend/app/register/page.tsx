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

    // TESTING MODE BYPASS: Simulate registration success
    setTimeout(() => {
      setIsLoading(false);
      router.push('/login?registered=true');
    }, 1500);
  };

  return (
    <div className="min-h-screen bg-[#f1f4f9] flex flex-col items-center justify-center p-6 relative overflow-hidden selection:bg-rakshak-blue/20">
      {/* Dynamic Background Elements */}
      <div className="absolute top-0 left-0 w-full h-full pointer-events-none overflow-hidden -z-10">
         <motion.div 
            animate={{ 
               scale: [1, 1.3, 1],
               rotate: [0, -45, 0],
               x: [100, -100, 100],
               y: [50, -50, 50]
            }}
            transition={{ duration: 45, repeat: Infinity, ease: "linear" }}
            className="absolute -top-[20%] -right-[10%] w-[70%] h-[70%] bg-rakshak-blue/5 blur-[120px] rounded-full"
         />
      </div>

      {/* Official Watermark */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] opacity-[0.02] pointer-events-none">
         <img src="https://upload.wikimedia.org/wikipedia/commons/5/55/Emblem_of_India.svg" alt="Emblem" className="w-full h-full grayscale" />
      </div>

      <motion.div 
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8 }}
        className="max-w-3xl w-full z-10"
      >
        <div className="flex flex-col items-center mb-12 text-center">
          <motion.div 
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="flex items-center gap-3 mb-8 bg-white/60 backdrop-blur-xl px-4 py-2 rounded-full shadow-sm border border-white/40 ring-1 ring-black/5"
          >
             <img src="https://upload.wikimedia.org/wikipedia/commons/5/55/Emblem_of_India.svg" alt="Emblem" className="w-4 h-4 grayscale opacity-70" />
             <span className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-500">Government of India • National Audit Authority</span>
          </motion.div>
          
          <h1 className="text-4xl md:text-5xl font-black text-rakshak-navy tracking-tighter uppercase mb-4 flex items-center gap-4 justify-center">
             <div className="bg-rakshak-blue/10 p-3 rounded-2xl">
                <Globe className="w-8 h-8 text-rakshak-blue" />
             </div>
             Integrity Enrollment
          </h1>
          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-[0.4em] mb-6">Official Personnel Registry Protocol (OPR-v2.4)</p>
          <div className="h-1.5 w-24 bg-gradient-to-r from-rakshak-blue to-rakshak-saffron rounded-full mx-auto" />
        </div>

        <div className="glass-card p-10 md:p-14 bg-white/80 backdrop-blur-2xl border border-white shadow-[0_40px_100px_rgba(0,0,0,0.1)] rounded-[3rem] relative overflow-hidden ring-1 ring-black/5">
          <form onSubmit={handleSubmit} className="space-y-8 relative z-10">
            <div className="grid md:grid-cols-2 gap-x-10 gap-y-8">
               <div className="group">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1 mb-3 block group-focus-within:text-rakshak-blue transition-colors">Full Identity Name</label>
                  <div className="relative">
                     <User className="absolute left-5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-rakshak-blue transition-colors" />
                     <input 
                        required type="text" 
                        value={formData.full_name}
                        onChange={e => setFormData({...formData, full_name: e.target.value})}
                        className="w-full pl-14 pr-7 py-5 bg-white/50 border border-slate-200 group-focus-within:border-rakshak-blue rounded-3xl text-sm font-bold focus:ring-4 focus:ring-rakshak-blue/5 outline-none transition-all placeholder:text-slate-300" 
                        placeholder="Dr. Rajesh Kumar"
                     />
                  </div>
               </div>
               
               <div className="group">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1 mb-3 block group-focus-within:text-rakshak-blue transition-colors">Official Govt Email</label>
                  <div className="relative">
                     <Mail className="absolute left-5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-rakshak-blue transition-colors" />
                     <input 
                        required type="email" 
                        value={formData.email}
                        onChange={e => setFormData({...formData, email: e.target.value})}
                        className="w-full pl-14 pr-7 py-5 bg-white/50 border border-slate-200 group-focus-within:border-rakshak-blue rounded-3xl text-sm font-bold focus:ring-4 focus:ring-rakshak-blue/5 outline-none transition-all font-mono placeholder:text-slate-300" 
                        placeholder="name@gov.in"
                     />
                  </div>
               </div>

               <div className="group">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1 mb-3 block group-focus-within:text-rakshak-blue transition-colors">Assigned Department</label>
                  <div className="relative">
                     <Building2 className="absolute left-5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-rakshak-blue transition-colors" />
                     <input 
                        required type="text" 
                        value={formData.department}
                        onChange={e => setFormData({...formData, department: e.target.value})}
                        className="w-full pl-14 pr-7 py-5 bg-white/50 border border-slate-200 group-focus-within:border-rakshak-blue rounded-3xl text-sm font-bold focus:ring-4 focus:ring-rakshak-blue/5 outline-none transition-all placeholder:text-slate-300" 
                        placeholder="Ministry of Power"
                     />
                  </div>
               </div>

               <div className="group">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1 mb-3 block group-focus-within:text-rakshak-blue transition-colors">Access Protocol (Role)</label>
                  <div className="relative">
                    <select 
                       value={formData.role}
                       onChange={e => setFormData({...formData, role: e.target.value})}
                       className="w-full px-7 py-5 bg-white/50 border border-slate-200 focus:border-rakshak-blue rounded-3xl text-sm font-black focus:ring-4 focus:ring-rakshak-blue/5 outline-none appearance-none transition-all"
                    >
                       <option value="officer">Field Officer (Node Access)</option>
                       <option value="auditor">National Auditor (Full Oversight)</option>
                       <option value="admin">System Admin (Root Protocol)</option>
                    </select>
                    <div className="absolute right-6 top-1/2 -translate-y-1/2 pointer-events-none opacity-40">
                       <ArrowRight className="w-4 h-4 rotate-90" />
                    </div>
                  </div>
               </div>

               <div className="group col-span-full">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1 mb-3 block group-focus-within:text-rakshak-blue transition-colors">Integrity Access Key</label>
                  <div className="relative">
                     <Lock className="absolute left-5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-rakshak-blue transition-colors" />
                     <input 
                        required type="password" 
                        value={formData.password}
                        onChange={e => setFormData({...formData, password: e.target.value})}
                        className="w-full pl-14 pr-7 py-5 bg-white/50 border border-slate-200 group-focus-within:border-rakshak-blue rounded-3xl text-sm font-bold focus:ring-4 focus:ring-rakshak-blue/5 outline-none transition-all tracking-widest placeholder:text-slate-300" 
                        placeholder="••••••••••••"
                     />
                  </div>
               </div>
            </div>

            {error && <p className="text-red-500 text-[9px] font-black uppercase text-center tracking-[0.2em] bg-red-50 p-4 rounded-2xl border border-red-100">{error}</p>}

            <button 
              type="submit"
              disabled={isLoading}
              className="w-full py-6 md:py-7 bg-[#0f172a] text-white rounded-[2rem] font-black uppercase text-[10px] md:text-xs tracking-[0.3em] shadow-[0_20px_40px_rgba(15,23,42,0.3)] hover:bg-black active:translate-y-1 transition-all border-b-4 md:border-b-8 border-rakshak-blue flex items-center justify-center gap-4 group"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Processing Enrollment Protocol...
                </>
              ) : (
                <>
                  Initiate Handshake Protocol <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </>
              )}
            </button>
          </form>

          <div className="mt-12 flex flex-col items-center gap-4 border-t border-slate-50 pt-10">
             <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest opacity-60">Already Verified?</p>
             <Link href="/login">
                <div className="px-10 py-3 bg-slate-50 text-slate-500 text-[10px] font-black uppercase tracking-[0.2em] rounded-full hover:bg-[#0f172a] hover:text-white transition-all cursor-pointer border border-transparent hover:border-rakshak-blue active:scale-95 shadow-sm">
                   Sign In Registered Identity
                </div>
             </Link>
          </div>
        </div>

        <div className="mt-16 flex flex-col md:flex-row items-center justify-center gap-8 md:gap-14 opacity-50">
          <div className="flex items-center gap-3">
            <ShieldCheck className="w-5 h-5 text-green-600" />
            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none">Biometric Ready Activation</span>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-2.5 h-2.5 rounded-full bg-green-500 animate-pulse" />
            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none">Secure Handshake Protocol Active</span>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
