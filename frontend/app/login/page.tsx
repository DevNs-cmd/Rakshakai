'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { useAuth } from '@/lib/auth-context';
import { Loader2, ShieldCheck, Mail, Lock, ArrowRight, UserCheck } from 'lucide-react';
import Link from 'next/link';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const { login } = useAuth();
  const router = useRouter();

  const handleGoogleSignIn = () => {
    // Redirect through the integrated auth-server handling Google OAuth logic 
    window.location.href = 'http://localhost:3001/auth/google';
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      await login(email, password);
      router.push('/dashboard');
    } catch (err: unknown) {
      const e = err as { response?: { data?: { detail?: string } } };
      setError(e.response?.data?.detail || 'Authentication failed. Please check credentials.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f1f4f9] flex flex-col items-center justify-center p-6 relative overflow-hidden selection:bg-rakshak-blue/20">
      {/* Dynamic Background Elements */}
      <div className="absolute top-0 left-0 w-full h-full pointer-events-none overflow-hidden -z-10">
         <motion.div 
            animate={{ 
               scale: [1, 1.2, 1],
               rotate: [0, 90, 0],
               x: [-100, 100, -100],
               y: [-50, 50, -50]
            }}
            transition={{ duration: 40, repeat: Infinity, ease: "linear" }}
            className="absolute -top-[20%] -left-[10%] w-[60%] h-[60%] bg-blue-400/5 blur-[120px] rounded-full"
         />
         <motion.div 
            animate={{ 
               scale: [1.2, 1, 1.2],
               rotate: [0, -90, 0],
               x: [100, -100, 100],
               y: [50, -50, 50]
            }}
            transition={{ duration: 35, repeat: Infinity, ease: "linear" }}
            className="absolute -bottom-[20%] -right-[10%] w-[60%] h-[60%] bg-rakshak-saffron/5 blur-[120px] rounded-full"
         />
      </div>

      {/* Official Watermark */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] opacity-[0.02] pointer-events-none">
         <img src="https://upload.wikimedia.org/wikipedia/commons/5/55/Emblem_of_India.svg" alt="Emblem" className="w-full h-full grayscale" />
      </div>

      <motion.div 
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, ease: "easeOut" }}
        className="max-w-lg w-full z-10"
      >
        <div className="flex flex-col items-center mb-12 text-center">
          <motion.div 
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="flex items-center gap-3 mb-8 bg-white/60 backdrop-blur-xl px-4 py-2 rounded-full shadow-sm border border-white/40 ring-1 ring-black/5"
          >
             <img src="https://upload.wikimedia.org/wikipedia/commons/5/55/Emblem_of_India.svg" alt="Emblem" className="w-4 h-4 grayscale opacity-60" />
             <span className="text-[9px] font-black uppercase tracking-[0.2em] text-[#1a1a1a] font-outfit">Official Government Infrastructure Oversight</span>
          </motion.div>
          
          <h1 className="text-5xl md:text-6xl font-black text-[#0f172a] leading-none mb-4 tracking-tighter">
             RAKSHAK <span className="text-rakshak-blue/40 italic font-light">Protocol</span>
          </h1>
          <p className="text-xs md:text-sm text-slate-500 font-bold max-w-sm leading-relaxed mb-8 uppercase tracking-widest opacity-80">
            Autonomous Integrity Framework for National Asset Monitoring. <br/>
            <span className="text-[10px] font-black tracking-[0.4em] text-rakshak-saffron/80 mt-2 block">NODE REGISTRY V2.4.91</span>
          </p>
          <div className="h-1.5 w-16 bg-gradient-to-r from-rakshak-blue via-blue-400 to-rakshak-saffron rounded-full mx-auto shadow-sm" />
        </div>

        <div className="glass-card p-10 md:p-14 bg-white/80 backdrop-blur-2xl border border-white shadow-[0_40px_100px_rgba(0,0,0,0.1)] rounded-[3rem] relative overflow-hidden ring-1 ring-black/5">
          <form onSubmit={handleSubmit} className="space-y-8 relative z-10">
            <div className="group">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 block px-1 group-focus-within:text-rakshak-blue transition-colors">Official Integrity ID</label>
              <div className="relative">
                <Mail className="absolute left-5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-rakshak-blue transition-colors" />
                <input 
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@rakshak.gov.in"
                  className="w-full pl-14 pr-7 py-5 bg-white/50 border border-slate-200 group-focus-within:border-rakshak-blue rounded-3xl text-sm font-bold focus:outline-none focus:ring-4 focus:ring-rakshak-blue/5 transition-all font-mono placeholder:text-slate-300"
                />
              </div>
            </div>

            <div className="group">
              <div className="flex justify-between items-center mb-3 px-1">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block group-focus-within:text-rakshak-blue transition-colors">Access Key</label>
                <Link href="#" className="text-[9px] font-black text-rakshak-blue uppercase tracking-[0.1em] hover:opacity-70 transition-opacity">Forgot Key?</Link>
              </div>
              <div className="relative">
                <Lock className="absolute left-5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-rakshak-blue transition-colors" />
                <input 
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="w-full pl-14 pr-7 py-5 bg-white/50 border border-slate-200 group-focus-within:border-rakshak-blue rounded-3xl text-sm font-bold focus:outline-none focus:ring-4 focus:ring-rakshak-blue/5 transition-all tracking-widest placeholder:text-slate-300"
                />
              </div>
            </div>

            <button 
              type="submit"
              disabled={isLoading}
              className="w-full py-6 md:py-7 bg-[#0f172a] text-white rounded-[2rem] font-black uppercase text-[10px] md:text-xs tracking-[0.3em] shadow-[0_20px_40px_rgba(15,23,42,0.3)] hover:bg-black active:translate-y-1 transition-all border-b-4 md:border-b-8 border-rakshak-blue flex items-center justify-center gap-4 group"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Verifying Identity...
                </>
              ) : (
                <>
                  Initiate Handshake <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </>
              )}
            </button>
          </form>

          <div className="mt-10 flex items-center gap-6">
             <div className="h-px flex-1 bg-slate-100" />
             <span className="text-[9px] font-black text-slate-300 uppercase tracking-[0.3em]">Identity Hub</span>
             <div className="h-px flex-1 bg-slate-100" />
          </div>

          <div className="mt-10 grid grid-cols-1 gap-4">
             <button 
                onClick={handleGoogleSignIn}
                className="w-full py-5 bg-white/50 border border-slate-200 text-[#0f172a] rounded-3xl font-black uppercase text-[10px] tracking-widest flex items-center justify-center gap-4 hover:bg-white hover:border-slate-300 transition-all shadow-sm active:scale-95"
             >
                <img src="https://www.google.com/favicon.ico" alt="Google" className="w-4 h-4" />
                Official Google Workspace
             </button>
          </div>

          <div className="mt-12 pt-10 border-t border-slate-50 flex flex-col items-center gap-4">
            <Link href="/register">
               <div className="px-8 py-3 bg-slate-50 text-slate-400 text-[10px] font-black uppercase tracking-[0.2em] rounded-full hover:bg-rakshak-navy hover:text-white transition-all cursor-pointer border border-transparent hover:border-rakshak-blue active:scale-95 shadow-sm">
                  New Identity? Request Enrollment
               </div>
            </Link>
          </div>
        </div>

        <div className="mt-16 flex flex-col md:flex-row items-center justify-center gap-8 md:gap-14 opacity-50">
          <div className="flex items-center gap-3">
            <ShieldCheck className="w-5 h-5 text-green-600" />
            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none">256-Bit SSL Secured</span>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-2.5 h-2.5 rounded-full bg-green-500 animate-pulse" />
            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none">System Node Alpha Active</span>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
