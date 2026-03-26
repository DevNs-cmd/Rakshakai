'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import Sidebar from '@/components/Sidebar';
import IntegrityTicker from '@/components/IntegrityTicker';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && !user) {
      router.push('/login');
    }
  }, [user, isLoading, router]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-rakshak-blue border-t-transparent rounded-full animate-spin" />
          <p className="text-rakshak-blue font-black uppercase tracking-widest text-[10px]">RAKSHAK Initializing...</p>
        </div>
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden font-inter relative">
      <Sidebar />
      
      <main className="flex-1 overflow-x-hidden overflow-y-auto pt-16 md:pt-20 relative">
        {/* Subtle Govt Watermark Background */}
        <div className="fixed inset-0 pointer-events-none opacity-[0.03] flex items-center justify-center z-0">
           <div className="text-[12vw] md:text-[200px] font-black uppercase -rotate-12 select-none tracking-tighter text-rakshak-navy">RAKSHAK INTEGRITY</div>
        </div>
        
        <div className="relative z-10 w-full">
           {children}
        </div>
      </main>
    </div>
  );
}
