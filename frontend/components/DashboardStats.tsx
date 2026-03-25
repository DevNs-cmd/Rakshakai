'use client';
import { motion } from 'framer-motion';
import { TrendingUp, TrendingDown, Target, Building2, AlertTriangle, IndianRupee } from 'lucide-react';
import { DashboardStats } from '@/lib/types';

import Glass3D from './Glass3D';

interface Props {
  stats: DashboardStats;
}

export default function DashboardStatsGrid({ stats }: Props) {
  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(val / 10000000).replace('₹', '₹ ') + ' Cr';
  };

  const CARDS = [
    { 
      label: 'TOTAL PROJECTS', 
      value: stats.total_projects, 
      icon: <Building2 className="w-5 h-5 text-blue-500" />,
      color: 'bg-blue-500',
      trend: { val: '+12%', up: true }
    },
    { 
      label: 'ACTIVE RISK MONITOR', 
      value: stats.active_projects, 
      icon: <Target className="w-5 h-5 text-rakshak-saffron" />,
      color: 'bg-rakshak-saffron',
      trend: { val: '-2%', up: false }
    },
    { 
      label: 'HIGH RISK / DELAYED', 
      value: stats.high_risk_projects + stats.delayed_projects, 
      icon: <AlertTriangle className="w-5 h-5 text-red-500" />,
      color: 'bg-red-500',
      trend: { val: '+4%', up: true }
    },
    { 
      label: 'TOTAL EXPENDITURE', 
      value: formatCurrency(stats.total_budget), 
      icon: <IndianRupee className="w-5 h-5 text-green-600" />,
      color: 'bg-green-600',
      trend: { val: '₹ 1.2k Cr', up: true }
    },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8 perspective-1000">
      {CARDS.map((card, i) => (
        <Glass3D key={card.label} intensity={12}>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
            className={"glass-card p-6 border-l-4 group bg-white shadow-card hover:shadow-card-hover overflow-hidden border-" + card.color.replace('bg-', '')}
          >
            <div className="flex items-center justify-between mb-4">
              <div className={`p-2.5 rounded-xl ${card.color.replace('bg-', 'bg-')}/10 flex items-center justify-center transition-transform group-hover:scale-110 duration-300`}>
                {card.icon}
              </div>
              <div className={`flex items-center gap-1.5 px-2 py-1 rounded-full border text-[10px] font-black uppercase ${card.trend.up ? 'bg-green-50 text-green-700 border-green-100' : 'bg-red-50 text-red-700 border-red-100'}`}>
                {card.trend.up ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                {card.trend.val}
              </div>
            </div>
            
            <div className="space-y-1">
              <h3 className="text-2xl font-black text-rakshak-navy tracking-tight">{card.value}</h3>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{card.label}</p>
            </div>
            
            <div className="absolute inset-0 bg-gradient-to-br from-white/0 via-white/0 to-slate-100/30 opacity-0 group-hover:opacity-100 transition-opacity" />
          </motion.div>
        </Glass3D>
      ))}
    </div>
  );
}
