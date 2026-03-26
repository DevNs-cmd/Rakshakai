'use client';
import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { motion } from 'framer-motion';
import { 
  LayoutDashboard, 
  Map as MapIcon, 
  FileCheck, 
  Users, 
  ShieldAlert, 
  Settings, 
  LogOut,
  ChevronRight,
  TrendingUp,
  Menu,
  X
} from 'lucide-react';
import { useAuth } from '@/lib/auth-context';

const MENU_ITEMS = [
  { id: 'dashboard', label: 'Overview', icon: LayoutDashboard, href: '/dashboard' },
  { id: 'admin', label: 'Admin Portal', icon: Settings, href: '/dashboard/admin' },
  { id: 'map', label: 'National Map', icon: MapIcon, href: '/dashboard/map' },
  { id: 'projects', label: 'Audit Projects', icon: FileCheck, href: '/dashboard/projects' },
  { id: 'alerts', label: 'Risk Alerts', icon: ShieldAlert, href: '/dashboard/alerts' },
  { id: 'contractors', label: 'Contractors', icon: Users, href: '/dashboard/contractors' },
  { id: 'analytics', label: 'Analytics', icon: TrendingUp, href: '/dashboard/analytics' },
];

export default function Sidebar() {
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const [isOpen, setIsOpen] = useState(false);

  const sidebarVariants = {
    open: { x: 0 },
    closed: { x: '-100%' }
  };

  return (
    <>
      {/* Mobile Toggle */}
      <div className="lg:hidden fixed top-12 right-4 z-[70]">
        <button 
          onClick={() => setIsOpen(!isOpen)}
          className="p-2.5 bg-[#0f172a] text-white rounded-xl shadow-2xl border border-white/10 active:scale-95 transition-transform"
        >
          {isOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </div>

      {/* Sidebar Desktop/Mobile */}
      <motion.aside 
        initial={false}
        animate={isOpen ? "open" : "closed"}
        variants={sidebarVariants}
        className="fixed lg:static inset-y-0 left-0 w-72 md:w-80 h-screen bg-[#0f172a] backdrop-blur-3xl text-white flex flex-col z-[100] shadow-2xl border-r border-white/5 lg:!translate-x-0"
        transition={{ type: "spring", stiffness: 300, damping: 30 }}
      >
        {/* Brand Header */}
        <div className="p-6 md:p-10 pb-8 md:pb-12 flex items-center gap-4 md:gap-5">
          <div className="w-10 h-10 md:w-12 md:h-12 bg-gradient-to-br from-rakshak-blue to-rakshak-saffron rounded-2xl flex items-center justify-center shadow-lg transform rotate-2">
            <span className="text-white text-xl md:text-2xl font-black">R</span>
          </div>
          <div>
            <h1 className="font-black text-2xl md:text-3xl tracking-tighter">RAKSHAK</h1>
            <p className="text-[8px] md:text-[10px] text-blue-300 uppercase tracking-widest font-black opacity-60 italic">Integrity OS v2.4</p>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-4 space-y-2 overflow-y-auto">
          {MENU_ITEMS.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link key={item.id} href={item.href} onClick={() => setIsOpen(false)}>
                <div className={`sidebar-link group ${isActive ? 'active shadow-lg bg-white/15' : 'hover:bg-white/5'}`}>
                  <item.icon className={`w-5 h-5 transition-transform duration-300 ${isActive ? 'scale-110 text-rakshak-saffron' : 'text-blue-300 group-hover:text-white'}`} />
                  <span className="flex-1 text-sm font-medium tracking-wide">{item.label}</span>
                  {isActive && (
                    <motion.div layoutId="active-indicator" className="w-1.5 h-1.5 rounded-full bg-rakshak-saffron shadow-[0_0_8px_rgba(255,122,26,0.8)]" />
                  )}
                </div>
              </Link>
            );
          })}
        </nav>

        {/* User Footer */}
        <div className="p-6 mt-auto border-t border-white/10 bg-black/20 shrink-0">
          <div className="flex items-center gap-4 mb-6">
            <div className="w-10 h-10 shrink-0 rounded-full bg-gradient-to-tr from-rakshak-blue to-blue-400 flex items-center justify-center text-white font-bold border-2 border-white/20">
              {user?.full_name?.charAt(0) || 'U'}
            </div>
            <div className="overflow-hidden">
              <p className="text-sm font-bold truncate">{user?.full_name}</p>
              <p className="text-[9px] text-blue-300 font-medium uppercase tracking-[0.1em]">{user?.role} • {user?.department || 'Govt'}</p>
            </div>
          </div>
          
          <button 
            onClick={logout}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-red-400 hover:bg-red-500/10 hover:text-red-300 transition-all font-semibold text-xs border border-transparent hover:border-red-500/20 mb-6"
          >
            <LogOut className="w-4 h-4" />
            <span className="uppercase tracking-widest">Exit Portal</span>
          </button>

          {/* Official Govt Certification */}
          <div className="p-4 bg-white/5 border border-white/10 rounded-2xl flex items-center gap-4">
             <img 
                src="https://upload.wikimedia.org/wikipedia/commons/5/55/Emblem_of_India.svg" 
                alt="Emblem" 
                className="w-8 h-8 grayscale opacity-50 invert shrink-0" 
             />
             <div className="flex-1 overflow-hidden">
                <p className="text-[8px] font-black text-blue-300 uppercase tracking-widest leading-none mb-1">Authenticated</p>
                <p className="text-[9px] font-black text-white uppercase tracking-tighter truncate">National Audit Auth</p>
                <div className="flex items-center gap-1.5 mt-1">
                   <div className="w-1 h-1 rounded-full bg-green-500 animate-pulse" />
                   <span className="text-[7px] font-black text-green-400 uppercase tracking-widest">S1V-SECURED</span>
                </div>
             </div>
          </div>
        </div>
      </motion.aside>

      {/* Backdrop for mobile */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40 lg:hidden"
          onClick={() => setIsOpen(false)}
        />
      )}
    </>
  );
}
