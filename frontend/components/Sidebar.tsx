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

  return (
    <>
      {/* Mobile Toggle */}
      <div className="lg:hidden fixed top-4 right-4 z-[60]">
        <button 
          onClick={() => setIsOpen(!isOpen)}
          className="p-3 bg-rakshak-navy text-white rounded-xl shadow-lg border border-white/10"
        >
          {isOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </button>
      </div>

      {/* Sidebar Desktop/Mobile */}
      <motion.aside 
        initial={false}
        animate={{ x: isOpen ? 0 : (typeof window !== 'undefined' && window.innerWidth < 1024 ? -300 : 0) }}
        className={`fixed lg:static inset-y-0 left-0 w-72 h-screen bg-rakshak-navy text-white flex flex-col z-50 shadow-2xl transition-transform duration-300`}
      >
        {/* Brand Header */}
        <div className="p-8 pb-12 flex items-center gap-4">
          <div className="w-10 h-10 bg-gradient-to-br from-rakshak-blue to-rakshak-saffron rounded-xl flex items-center justify-center shadow-lg transform rotate-3">
            <span className="text-white text-xl font-black">R</span>
          </div>
          <div>
            <h1 className="font-black text-2xl tracking-tight">RAKSHAK</h1>
            <p className="text-[10px] text-blue-300 uppercase tracking-widest font-bold">Integrity System</p>
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
        <div className="p-6 mt-auto border-t border-white/10 bg-black/20">
          <div className="flex items-center gap-4 mb-6">
            <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-rakshak-blue to-blue-400 flex items-center justify-center text-white font-bold border-2 border-white/20">
              {user?.full_name?.charAt(0) || 'U'}
            </div>
            <div className="overflow-hidden">
              <p className="text-sm font-bold truncate">{user?.full_name}</p>
              <p className="text-[10px] text-blue-300 font-medium uppercase tracking-tighter">{user?.role} • {user?.department || 'Govt'}</p>
            </div>
          </div>
          
          <button 
            onClick={logout}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-red-400 hover:bg-red-500/10 hover:text-red-300 transition-all font-semibold text-sm border border-transparent hover:border-red-500/20"
          >
            <LogOut className="w-4 h-4" />
            <span>Exit Secure Portal</span>
          </button>
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
