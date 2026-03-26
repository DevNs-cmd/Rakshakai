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
    <div className="min-h-screen bg-[#F8FAFC] flex flex-col items-center justify-center p-6 relative overflow-hidden">
      {/* Official Watermark */}
      <div className="absolute top-0 right-0 w-[600px] h-[600px] opacity-[0.03] pointer-events-none -translate-y-1/2 translate-x-1/2">
         <img src="https://upload.wikimedia.org/wikipedia/commons/5/55/Emblem_of_India.svg" alt="Emblem" className="w-full h-full grayscale" />
      </div>

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-xl w-full"
      >
        <div className="flex flex-col items-center mb-10 text-center">
          <div className="flex items-center gap-3 mb-6 bg-white px-5 py-2.5 rounded-full shadow-sm border border-slate-100">
             <img src="https://upload.wikimedia.org/wikipedia/commons/5/55/Emblem_of_India.svg" alt="Emblem" className="w-5 h-5 grayscale opacity-60" />
             <span className="text-[10px] font-semibold uppercase tracking-widest text-slate-400 font-outfit">Official Government Infrastructure oversight</span>
          </div>
          
          <h1 className="text-5xl font-extrabold text-rakshak-navy tracking-tight mb-2 flex items-center gap-4">
             RAKSHAK <span className="text-rakshak-blue/50 font-light italic">Protocol</span>
          </h1>
          <p className="text-sm text-slate-400 font-medium max-w-sm leading-relaxed mb-6">
            Autonomous Integrity Framework for National Asset Monitoring. <br/>
            <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-rakshak-saffron">Node Registry v2.4.91</span>
          </p>
          <div className="h-1 w-12 bg-gradient-to-r from-rakshak-blue to-blue-400 rounded-full mx-auto" />
        </div>

        <div className="glass-card p-12 bg-white shadow-2xl border border-slate-100 relative overflow-hidden">
          <form onSubmit={handleSubmit} className="space-y-6 relative z-10">
            <div>
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block px-1">Official Integrity ID</label>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input 
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@rakshak.gov.in"
                  className="w-full pl-12 pr-6 py-4.5 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-rakshak-blue/20 transition-all font-mono"
                />
              </div>
            </div>

            <div>
              <div className="flex justify-between items-center mb-2 px-1">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Access Key</label>
                <Link href="#" className="text-[10px] font-black text-rakshak-blue uppercase tracking-widest hover:underline">Forgot Key?</Link>
              </div>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input 
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="w-full pl-12 pr-6 py-4.5 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-rakshak-blue/20 transition-all"
                />
              </div>
            </div>

            {error && (
              <motion.div 
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                className="p-4 bg-red-50 border border-red-100 rounded-2xl text-[10px] font-black uppercase tracking-widest text-red-600 flex items-center justify-center gap-3"
              >
                <UserCheck className="w-4 h-4" />
                {error}
              </motion.div>
            )}

            <button 
              type="submit"
              disabled={isLoading}
              className="w-full py-5 bg-rakshak-navy text-white rounded-2xl font-black uppercase text-xs tracking-[0.2em] shadow-2xl hover:bg-black active:translate-y-1 transition-all border-b-4 border-rakshak-blue flex items-center justify-center gap-3"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Verifying Identity...
                </>
              ) : (
                <>
                  Initiate Handshake <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          <div className="mt-8 flex items-center gap-4">
             <div className="h-px flex-1 bg-slate-100" />
             <span className="text-[9px] font-black text-slate-300 uppercase tracking-widest">or sign in with</span>
             <div className="h-px flex-1 bg-slate-100" />
          </div>

          <div className="mt-8 grid grid-cols-1 gap-4">
             <button 
                onClick={handleGoogleSignIn}
                className="w-full py-4.5 bg-white border border-slate-200 text-slate-600 rounded-2xl font-black uppercase text-[10px] tracking-widest flex items-center justify-center gap-3 hover:bg-slate-50 transition-all shadow-sm"
             >
                <img src="https://www.google.com/favicon.ico" alt="Google" className="w-4 h-4" />
                Official Google Workspace
             </button>
          </div>

          <div className="mt-10 pt-10 border-t border-slate-50 flex flex-col items-center gap-4">
            <Link href="/register">
               <div className="px-6 py-2 bg-slate-100 text-slate-400 text-[10px] font-black uppercase tracking-widest rounded-full hover:bg-rakshak-blue hover:text-white transition-all cursor-pointer">
                  New Identity? Request Enrollment
               </div>
            </Link>
          </div>
        </div>

        <div className="mt-12 flex items-center justify-center gap-10">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-green-600" />
            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">256-Bit SSL Secured</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">System Node Alpha Active</span>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
