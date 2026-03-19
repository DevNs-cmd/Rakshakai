'use client';
import { motion } from 'framer-motion';

interface Props {
  score: number;
  size?: number;
  strokeWidth?: number;
  showText?: boolean;
}

export default function RiskGauge({ score, size = 160, strokeWidth = 12, showText = true }: Props) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;

  const getColor = (s: number) => {
    if (s <= 30) return '#16a34a'; // green
    if (s <= 70) return '#eab308'; // yellow
    return '#dc2626'; // red
  };

  const color = getColor(score);

  return (
    <div className="flex flex-col items-center justify-center relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="transform -rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="#e2e8f0"
          strokeWidth={strokeWidth}
          fill="transparent"
        />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={color}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 1.5, ease: 'easeOut' }}
          strokeLinecap="round"
          fill="transparent"
          className="risk-gauge-fill"
        />
      </svg>
      {showText && (
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <motion.span 
            key={score}
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="text-2xl font-black text-rakshak-navy font-mono"
            style={{ color }}
          >
            {score.toFixed(1)}%
          </motion.span>
          <span className="text-[10px] text-slate-400 font-black tracking-widest uppercase">Risk Score</span>
        </div>
      )}
    </div>
  );
}
