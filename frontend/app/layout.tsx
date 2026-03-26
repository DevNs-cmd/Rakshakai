import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { AuthProvider } from '@/lib/auth-context';
import { ReactNode } from 'react';

const inter = Inter({ 
  subsets: ['latin'], 
  variable: '--font-inter',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'RAKSHAK — Autonomous Governance Integrity System',
  description: 'Real-time AI-powered infrastructure project monitoring and governance accountability platform for India',
  keywords: ['governance', 'infrastructure', 'monitoring', 'AI', 'accountability', 'India'],
  openGraph: {
    title: 'RAKSHAK — Autonomous Governance Integrity System',
    description: 'From Blind Execution to Verified Governance',
    type: 'website',
  },
};

import Navbar from '@/components/Navbar';
import IntegrityTicker from '@/components/IntegrityTicker';

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} font-sans`}>
      <head>
        <link href="https://api.mapbox.com/mapbox-gl-js/v2.15.0/mapbox-gl.css" rel="stylesheet" />
      </head>
      <body className="antialiased bg-slate-50">
        <AuthProvider>
          <div className="fixed top-0 left-0 right-0 z-[100]">
            <IntegrityTicker />
          </div>
          <Navbar />
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}
