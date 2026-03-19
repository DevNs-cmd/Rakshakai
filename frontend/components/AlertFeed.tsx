'use client';
import { motion, AnimatePresence } from 'framer-motion';
import { ShieldAlert, Clock, AlertTriangle, CheckCircle2, MoreVertical, Bell } from 'lucide-react';
import { Alert, AlertType } from '@/lib/types';
import { formatDistanceToNow } from 'date-fns';

interface Props {
  alerts: Alert[];
  onMarkRead?: (id: string) => void;
}

const getAlertIcon = (type: AlertType) => {
  switch (type) {
    case 'no_evidence': return <Clock className="w-5 h-5 text-red-500" />;
    case 'deadline_risk': return <AlertTriangle className="w-5 h-5 text-yellow-500" />;
    case 'anomaly_spike': return <ShieldAlert className="w-5 h-5 text-red-600" />;
    case 'budget_overrun': return <AlertTriangle className="w-5 h-5 text-orange-500" />;
    default: return <Bell className="w-5 h-5 text-blue-500" />;
  }
};

const getSeverityStyles = (severity: string) => {
  switch (severity) {
    case 'high': return 'bg-red-50 text-red-700 border-red-100 shadow-sm shadow-red-500/10';
    case 'medium': return 'bg-yellow-50 text-yellow-700 border-yellow-100 shadow-sm shadow-yellow-500/10';
    default: return 'bg-blue-50 text-blue-700 border-blue-100';
  }
};

export default function AlertFeed({ alerts, onMarkRead }: Props) {
  return (
    <div className="flex flex-col h-full bg-white rounded-2xl shadow-card overflow-hidden border border-slate-100">
      <div className="p-6 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-white rounded-xl shadow-sm flex items-center justify-center border border-slate-200">
            <Bell className="w-5 h-5 text-rakshak-blue" />
          </div>
          <div>
            <h3 className="font-bold text-rakshak-navy text-sm">Integrity Alerts</h3>
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Live Monitoring Feed</p>
          </div>
        </div>
        <div className="bg-red-500 text-white text-[10px] font-black px-2 py-0.5 rounded-full shadow-sm animate-pulse-slow">
          {alerts.filter(a => !a.is_read).length} UNREAD
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        <AnimatePresence initial={false}>
          {alerts.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-slate-400 p-8 space-y-4">
              <CheckCircle2 className="w-12 h-12 text-slate-200" />
              <p className="text-sm font-medium">No alerts detected at this level</p>
            </div>
          ) : (
            alerts.map((alert, i) => (
              <motion.div
                key={alert.id}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ delay: i * 0.05 }}
                className={`p-5 border-b border-slate-50 relative group transition-all duration-300 ${alert.is_read ? 'opacity-60 grayscale-[40%]' : 'hover:bg-blue-50/30'}`}
              >
                {!alert.is_read && (
                  <div className="absolute left-1.5 top-1/2 -translate-y-1/2 w-1 h-12 bg-rakshak-blue rounded-full" />
                )}
                
                <div className="flex items-start gap-4">
                  <div className={`p-2.5 rounded-xl border flex-shrink-0 transition-transform group-hover:scale-110 duration-300 ${getSeverityStyles(alert.severity)}`}>
                    {getAlertIcon(alert.alert_type)}
                  </div>
                  
                  <div className="flex-1 min-w-0 pr-6">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                        {alert.created_at ? formatDistanceToNow(new Date(alert.created_at), { addSuffix: true }) : 'Now'}
                      </span>
                      {alert.severity === 'high' && (
                        <span className="text-[8px] font-black text-white bg-red-600 px-2 py-0.5 rounded-full uppercase">Priority</span>
                      )}
                    </div>
                    <h4 className="font-bold text-slate-800 text-sm mb-1 leading-snug group-hover:text-rakshak-blue transition-colors">{alert.title}</h4>
                    <p className="text-xs text-slate-500 leading-relaxed font-medium line-clamp-2">{alert.message}</p>
                    
                    {!alert.is_read && (
                      <button 
                        onClick={() => onMarkRead?.(alert.id)}
                        className="mt-3 text-[10px] font-black uppercase text-rakshak-blue hover:text-rakshak-navy tracking-widest flex items-center gap-2 group/btn transition-all"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5 transition-transform group-hover/btn:scale-125" />
                        Mark as Resolved
                      </button>
                    )}
                  </div>
                  
                  <button className="text-slate-300 hover:text-slate-600 p-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <MoreVertical className="w-4 h-4" />
                  </button>
                </div>
              </motion.div>
            ))
          )}
        </AnimatePresence>
      </div>

      <div className="p-4 bg-slate-50 border-t border-slate-100 text-center">
        <button className="text-[10px] font-black uppercase text-slate-400 hover:text-rakshak-blue tracking-[0.2em] transition-colors">
          View Complete Log Archive →
        </button>
      </div>
    </div>
  );
}
