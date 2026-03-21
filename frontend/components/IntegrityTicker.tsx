'use client';
import { motion } from 'framer-motion';

const TICKER_ITEMS = [
  "MUMBAI COASTAL ROAD PH-II: 92% Compliance Verified via Satellite Integrity Sync",
  "DELHI METRO PH-IV: New Geo-tagged evidence captured at Janakpuri Station",
  "BANGALORE SMART CITY: Risk Score decreased to 12% following field audit",
  "CHENNAI PORT UPGRADE: Material procurement variance detected (8.4%)",
  "KOLKATA FLYOVER: 48h since last evidence upload - Integrity Alert Triggered",
  "PUNJAB SOLAR PARK: 100% Milestone verification completed by ISO Auditor",
  "GUJARAT GIFT CITY: Network integrity heartbeat stable across all 14 nodes"
];

export default function IntegrityTicker() {
  return (
    <div className="bg-rakshak-navy text-white h-10 flex items-center overflow-hidden border-b border-white/10 relative z-50">
      <div className="bg-rakshak-saffron px-4 h-full flex items-center gap-2 shrink-0 relative z-10 shadow-[5px_0_15px_rgba(0,0,0,0.3)]">
        <div className="w-2 h-2 bg-white rounded-full animate-pulse" />
        <span className="text-[10px] font-black uppercase tracking-widest whitespace-nowrap text-white">Live Integrity Feed</span>
      </div>
      
      <div className="flex-1 overflow-hidden relative">
        <motion.div 
          animate={{ x: ["-0%", "-100%"] }}
          transition={{ 
            duration: 50, 
            repeat: Infinity, 
            ease: "linear" 
          }}
          className="flex whitespace-nowrap items-center gap-20 pl-10"
        >
          {[...TICKER_ITEMS, ...TICKER_ITEMS].map((item, i) => (
            <div key={i} className="flex items-center gap-4 group cursor-default">
              <span className="text-[10px] font-bold text-blue-300 opacity-60">RAKSHAK-SYS-ALERT</span>
              <span className="text-[11px] font-black uppercase tracking-tight text-white group-hover:text-rakshak-saffron transition-colors">{item}</span>
              <span className="text-rakshak-saffron">/</span>
            </div>
          ))}
        </motion.div>
      </div>

      <div className="bg-rakshak-navy px-4 h-full hidden sm:flex items-center gap-2 shrink-0 border-l border-white/10 text-[9px] font-mono text-blue-400">
        UTC: {new Date().toISOString().split('T')[0]} 
      </div>
    </div>
  );
}
