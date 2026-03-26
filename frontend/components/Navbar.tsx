'use client';
import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ArrowRight, Menu, X } from 'lucide-react';

export default function Navbar() {
  const [isOpen, setIsOpen] = useState(false);
  const pathname = usePathname();
  
  const navItems = [
    { name: 'Solutions', path: '/solutions' },
    { name: 'Infrastructure', path: '/infrastructure' },
    { name: 'Audit Trial', path: '/audit-trial' },
    { name: 'Security', path: '/security' }
  ];

  // Prevent scroll when mobile menu is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => { document.body.style.overflow = 'unset'; };
  }, [isOpen]);

  return (
    <>
      <nav className="fixed top-8 md:top-12 left-1/2 -translate-x-1/2 z-[150] w-[95%] max-w-5xl rounded-3xl bg-white/70 backdrop-blur-3xl border border-white/40 shadow-[0_8px_32px_rgba(0,0,0,0.08)] h-16 md:h-20 flex items-center justify-between px-4 md:px-10 transition-all hover:bg-white/90">
        <Link href="/" className="flex items-center gap-2 md:gap-4 shrink-0 transition-transform active:scale-95">
          <div className="w-8 h-8 md:w-10 md:h-10 bg-gradient-to-br from-[#1e3a8a] to-[#ea580c] rounded-xl md:rounded-2xl flex items-center justify-center shadow-lg">
            <span className="text-white text-lg md:text-xl font-black">R</span>
          </div>
          <span className="font-black text-[#0f172a] text-base md:text-xl tracking-tighter hidden sm:block">RAKSHAK</span>
        </Link>

        {/* Desktop Nav */}
        <div className="hidden lg:flex items-center gap-10">
          {navItems.map(item => (
            <Link 
              key={item.name} 
              href={item.path} 
              className={`text-[11px] font-black uppercase tracking-widest transition-colors ${
                pathname === item.path ? 'text-[#1e3a8a]' : 'text-slate-500 hover:text-[#1e3a8a]'
              }`}
            >
              {item.name}
            </Link>
          ))}
        </div>

        {/* Right Actions & Mobile Toggle */}
        <div className="flex items-center gap-3 md:gap-6">
          <Link href="/login" className="hidden sm:block text-[10px] md:text-xs font-black uppercase tracking-widest text-[#475569] hover:text-[#1e3a8a] transition-colors whitespace-nowrap">
            Sign In
          </Link>
          <Link href="/dashboard" className="hidden sm:block">
            <button className="px-6 py-2.5 rounded-xl md:rounded-2xl bg-[#0f172a] text-white text-[10px] md:text-xs font-black uppercase tracking-widest shadow-xl hover:bg-black active:scale-95 transition-all flex items-center gap-2 group whitespace-nowrap overflow-hidden border-b-2 border-[#1e3a8a] active:border-b-0">
              Launch Platform
              <ArrowRight className="w-3 h-3 md:w-4 md:h-4 group-hover:translate-x-1 transition-transform" />
            </button>
          </Link>

          {/* Mobile Menu Button */}
          <button 
            className="lg:hidden p-2 rounded-xl bg-slate-100/50 text-[#0f172a] hover:bg-slate-200 transition-colors"
            onClick={() => setIsOpen(true)}
          >
            <Menu className="w-5 h-5" />
          </button>
        </div>
      </nav>

      {/* Mobile Menu Overlay */}
      <AnimatePresence>
        {isOpen && (
          <div className="fixed inset-0 z-[200] lg:hidden flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/40 backdrop-blur-sm"
              onClick={() => setIsOpen(false)}
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-sm bg-white/90 backdrop-blur-xl rounded-[2rem] shadow-2xl overflow-hidden flex flex-col border border-white"
            >
              <div className="flex items-center justify-between p-6 border-b border-slate-100">
                <div className="flex items-center gap-3">
                   <div className="w-8 h-8 bg-gradient-to-br from-[#1e3a8a] to-[#ea580c] rounded-xl flex items-center justify-center shadow-lg">
                     <span className="text-white text-base font-black">R</span>
                   </div>
                   <span className="font-black text-[#0f172a] text-lg tracking-tighter">RAKSHAK</span>
                </div>
                <button 
                  onClick={() => setIsOpen(false)}
                  className="p-2 rounded-full bg-slate-50 hover:bg-slate-100 text-[#0f172a] transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="flex flex-col items-center justify-center gap-6 py-8 px-6">
                {navItems.map((item, i) => (
                  <motion.div 
                    key={item.name}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.05 }}
                  >
                    <Link 
                      href={item.path} 
                      onClick={() => setIsOpen(false)}
                      className={`text-lg font-black uppercase tracking-widest transition-colors ${
                        pathname === item.path ? 'text-[#1e3a8a]' : 'text-[#0f172a] hover:text-[#1e3a8a]'
                      }`}
                    >
                      {item.name}
                    </Link>
                  </motion.div>
                ))}
              </div>

               <div className="p-6 bg-slate-50/50 flex flex-col gap-3 border-t border-slate-100">
                 <Link href="/login" onClick={() => setIsOpen(false)}>
                    <button className="w-full py-3 rounded-xl bg-white text-[#0f172a] font-black uppercase tracking-widest text-xs shadow-sm border border-slate-200 hover:bg-slate-50">
                       Sign In
                    </button>
                 </Link>
                 <Link href="/dashboard" onClick={() => setIsOpen(false)}>
                    <button className="w-full py-3 rounded-xl bg-[#0f172a] text-white font-black uppercase tracking-widest text-xs shadow-xl flex items-center justify-center gap-2 hover:bg-black">
                       Launch Platform
                       <ArrowRight className="w-4 h-4" />
                    </button>
                 </Link>
               </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}
