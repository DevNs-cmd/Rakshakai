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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      await login(email, password);
      router.push('/dashboard');
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Authentication failed. Please check credentials.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-hero flex items-center justify-center p-6">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="max-w-md w-full"
      >
        {/* Logo */}
        <div className="flex flex-col items-center mb-10">
          <Link href="/">
            <div className="w-16 h-16 bg-gradient-to-br from-rakshak-blue to-rakshak-saffron rounded-2xl flex items-center justify-center shadow-2xl mb-6 transform rotate-3">
              <span className="text-white text-3xl font-black">R</span>
            </div>
          </Link>
          <h1 className="text-3xl font-black text-rakshak-navy tracking-tight">RAKSHAK</h1>
          <p className="text-[10px] text-slate-400 font-black uppercase tracking-[0.3em] mt-1">Audit Intelligence Portal</p>
        </div>

        <div className="glass-card p-10 bg-white shadow-2xl relative overflow-hidden">
          {/* Subtle decorative elements */}
          <div className="absolute top-0 right-0 w-32 h-32 bg-blue-50 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
          
          <form onSubmit={handleSubmit} className="space-y-6 relative z-10">
            <div>
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">Official Email</label>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input 
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@rakshak.gov.in"
                  className="w-full pl-12 pr-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-rakshak-blue/20 transition-all"
                />
              </div>
            </div>

            <div>
              <div className="flex justify-between items-center mb-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Access Key</label>
                <Link href="#" className="text-[10px] font-black text-rakshak-blue uppercase tracking-widest hover:underline">Forgot?</Link>
              </div>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input 
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="w-full pl-12 pr-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-rakshak-blue/20 transition-all"
                />
              </div>
            </div>

            {error && (
              <motion.div 
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                className="p-4 bg-red-50 border border-red-100 rounded-2xl text-xs font-bold text-red-600 flex items-center gap-3"
              >
                <UserCheck className="w-4 h-4" />
                {error}
              </motion.div>
            )}

            <button 
              type="submit"
              disabled={isLoading}
              className="w-full py-4 bg-rakshak-blue text-white rounded-2xl font-black uppercase text-xs tracking-[0.2em] shadow-lg hover:shadow-xl hover:bg-rakshak-navy active:translate-y-0.5 transition-all flex items-center justify-center gap-3 disabled:opacity-70 disabled:cursor-not-allowed border-b-4 border-rakshak-navy"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Verifying Identity...
                </>
              ) : (
                <>
                  Enter Secure Portal
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          {/* Demo account hints */}
          <div className="mt-10 pt-8 border-t border-slate-50 space-y-4">
            <p className="text-[10px] font-black text-slate-400 uppercase text-center tracking-widest">Sandbox Credentials</p>
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 text-[10px] font-bold">
                <span className="text-slate-400 block mb-1">AUDITOR</span>
                <span className="text-rakshak-navy truncate block">auditor@rakshak.gov.in</span>
              </div>
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 text-[10px] font-bold">
                <span className="text-slate-400 block mb-1">PASSCODE</span>
                <span className="text-rakshak-navy block">Auditor@123</span>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-8 flex items-center justify-center gap-6">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-green-600" />
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">AES-256 Encrypted</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Govt Node Active</span>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
