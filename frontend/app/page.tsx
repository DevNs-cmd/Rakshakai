'use client';
import { useEffect, useRef, useState } from 'react';
import { motion, useScroll, useTransform } from 'framer-motion';
import Link from 'next/link';
import * as THREE from 'three';
import { ArrowRight } from 'lucide-react';
import IntegrityTicker from '@/components/IntegrityTicker';

// ── Animated Counter Component ────────────────────────────────────────────────
function AnimatedCounter({ target, duration = 2, suffix = '', prefix = '' }: {
  target: number; duration?: number; suffix?: string; prefix?: string;
}) {
  const [count, setCount] = useState(0);
  const [started, setStarted] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setStarted(true); },
      { threshold: 0.5 }
    );
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!started) return;
    const steps = 60;
    const increment = target / steps;
    let current = 0;
    const timer = setInterval(() => {
      current += increment;
      if (current >= target) {
        setCount(target);
        clearInterval(timer);
      } else {
        setCount(Math.floor(current));
      }
    }, (duration * 1000) / steps);
    return () => clearInterval(timer);
  }, [started, target, duration]);

  return (
    <span ref={ref} className="counter-animation text-rakshak-blue">
      {prefix}{count.toLocaleString('en-IN')}{suffix}
    </span>
  );
}

// ── Three.js Globe Component ───────────────────────────────────────────────────
// ── Photorealistic Globe Component (Upgraded) ──────────────────────────────────
function IndiaGlobe() {
  const mountRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const currentMount = mountRef.current;
    if (!currentMount) return;
    const w = currentMount.clientWidth;
    const h = currentMount.clientHeight;
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(45, w / h, 0.1, 1000);
    camera.position.z = 3.2;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(w, h);
    renderer.setPixelRatio(window.devicePixelRatio);
    currentMount.appendChild(renderer.domElement);

    const loader = new THREE.TextureLoader();
    
    // High-res texture URLs
    const TEXTURES = {
      day: 'https://unpkg.com/three-globe/example/img/earth-blue-marble.jpg',
      night: 'https://unpkg.com/three-globe/example/img/earth-night.jpg',
      clouds: 'https://unpkg.com/three-globe/example/img/earth-clouds.png',
      topology: 'https://unpkg.com/three-globe/example/img/earth-topology.png',
      specular: 'https://unpkg.com/three-globe/example/img/earth-water.png'
    };

    const globeGroup = new THREE.Group();
    scene.add(globeGroup);

    // 🌍 Earth Sphere with Detailed Textures
    const geometry = new THREE.SphereGeometry(1, 64, 64);
    const material = new THREE.MeshPhongMaterial({
      map: loader.load(TEXTURES.day),
      bumpMap: loader.load(TEXTURES.topology),
      bumpScale: 0.015,
      specularMap: loader.load(TEXTURES.specular),
      specular: new THREE.Color('grey'),
      shininess: 10,
    });
    
    const earth = new THREE.Mesh(geometry, material);
    globeGroup.add(earth);

    // ☁️ Clouds Layer
    const cloudGeo = new THREE.SphereGeometry(1.015, 64, 64);
    const cloudMat = new THREE.MeshPhongMaterial({
      map: loader.load(TEXTURES.clouds),
      transparent: true,
      opacity: 0.4,
      depthWrite: false,
    });
    const clouds = new THREE.Mesh(cloudGeo, cloudMat);
    globeGroup.add(clouds);

    // ✨ Atmospheric Glow (Shader-like feel with multi-layer)
    const atmosphereGeo = new THREE.SphereGeometry(1.1, 64, 64);
    const atmosphereMat = new THREE.MeshPhongMaterial({
      color: 0x93c5fd,
      transparent: true,
      opacity: 0.1,
      side: THREE.BackSide,
    });
    const atmosphere = new THREE.Mesh(atmosphereGeo, atmosphereMat);
    scene.add(atmosphere);

    // 🏙️ City Lighting Emissive Layer (Simulated via emissive)
    earth.material.emissiveMap = loader.load(TEXTURES.night);
    earth.material.emissive = new THREE.Color(0xffff88);
    earth.material.emissiveIntensity = 0.5;

    // 💡 Realistic Lighting Setup
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
    scene.add(ambientLight);

    const sunLight = new THREE.DirectionalLight(0xffffff, 1.5);
    sunLight.position.set(5, 3, 5);
    scene.add(sunLight);

    // Background Stars (Static)
    const starGeo = new THREE.BufferGeometry();
    const starPos = [];
    for (let i = 0; i < 2000; i++) {
       starPos.push((Math.random() - 0.5) * 100, (Math.random() - 0.5) * 100, (Math.random() - 0.5) * 100);
    }
    starGeo.setAttribute('position', new THREE.Float32BufferAttribute(starPos, 3));
    const starMat = new THREE.PointsMaterial({ color: 0xffffff, size: 0.03, transparent: true, opacity: 0.4 });
    const stars = new THREE.Points(starGeo, starMat);
    scene.add(stars);

    // Interaction Rings for India Cities
    const cities = [
      { lat: 28.6139, lon: 77.2090 }, // Delhi
      { lat: 19.0760, lon: 72.8777 }, // Mumbai
      { lat: 12.9716, lon: 77.5946 }, // Bangalore
    ];

    cities.forEach(city => {
      const lat = city.lat * (Math.PI / 180);
      const lon = -city.lon * (Math.PI / 180);
      const x = Math.cos(lat) * Math.cos(lon);
      const y = Math.sin(lat);
      const z = Math.cos(lat) * Math.sin(lon);
      
      const ringGeom = new THREE.RingGeometry(0.015, 0.025, 32);
      const ringMat = new THREE.MeshBasicMaterial({ color: 0xffa500, transparent: true, opacity: 0.8, side: THREE.DoubleSide });
      const ring = new THREE.Mesh(ringGeom, ringMat);
      ring.position.set(x, y, z).multiplyScalar(1.02);
      ring.lookAt(0, 0, 0);
      (ring as unknown as { isRing: boolean }).isRing = true;
      globeGroup.add(ring);
    });

    const animate = () => {
      requestAnimationFrame(animate);
      globeGroup.rotation.y += 0.004;
      clouds.rotation.y += 0.003;
      
      globeGroup.children.forEach(child => {
        if ((child as unknown as { isRing: boolean }).isRing) {
          const s = 1 + Math.sin(Date.now() * 0.004) * 0.4;
          child.scale.set(s, s, s);
          ((child as THREE.Mesh).material as THREE.MeshBasicMaterial).opacity = 1 - (s - 0.6);
        }
      });
      renderer.render(scene, camera);
    };
    animate();

    const handleResize = () => {
      if (!mountRef.current) return;
      const w = mountRef.current.clientWidth;
      const h = mountRef.current.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      renderer.dispose();
      if (currentMount?.contains(renderer.domElement)) {
        currentMount.removeChild(renderer.domElement);
      }
    };
  }, []);

  return (
    <div className="w-full h-full relative cursor-grab group">
      <div ref={mountRef} className="w-full h-full drop-shadow-[0_20px_60px_rgba(0,0,0,0.4)]" />
      {/* Globe Shadow */}
      <div className="absolute bottom-[20%] left-1/2 -translate-x-1/2 w-[40%] h-[10%] bg-[#93c5fd]/10 blur-3xl -z-10 rounded-full" />
    </div>
  );
}

import Navbar from '@/components/Navbar';
import Glass3D from '@/components/Glass3D';

function FeatureCard({ icon, title, description, delay }: {
  icon: string; title: string; description: string; delay: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ delay, duration: 0.5 }}
      className="perspective-1000 h-full"
    >
      <Glass3D intensity={20}>
        <div className="glass-card p-6 md:p-10 bg-white border border-slate-100 shadow-card hover:shadow-card-hover transition-all h-full group">
          <div className="text-4xl md:text-5xl mb-6 group-hover:scale-110 transition-transform duration-500">{icon}</div>
          <h3 className="font-black text-rakshak-navy text-lg md:text-xl mb-3 tracking-tight">{title}</h3>
          <p className="text-slate-500 text-xs md:text-sm leading-relaxed font-medium">{description}</p>
        </div>
      </Glass3D>
    </motion.div>
  );
}

export default function LandingPage() {
  const { scrollYProgress } = useScroll();
  const heroOpacity = useTransform(scrollYProgress, [0, 0.3], [1, 0]);
  const heroY = useTransform(scrollYProgress, [0, 0.3], [0, -60]);

  const stats = [
    { label: 'Infrastructure Projects', value: 12847, suffix: '+', icon: '🏗️' },
    { label: 'Crores Monitored', value: 42000, prefix: '₹', suffix: 'Cr+', icon: '💰' },
    { label: 'States Covered', value: 28, suffix: '', icon: '🗺️' },
    { label: 'Evidence Verified', value: 98340, suffix: '+', icon: '✅' },
  ];

  const features = [
    {
      icon: '🛡️',
      title: 'Adaptive Integrity Guard',
      description: 'Continuous monitoring of financial disbursement against physical milestone signatures using blockchain-linked evidence.',
    },
    {
      icon: '📡',
      title: 'Sentinel Geo-Analytics',
      description: 'Satellite-grade verification of construction progress via autonomous image analysis and thermal anomaly detection.',
    },
    {
      icon: '🏢',
      title: 'Institutional Sync',
      description: 'Unified oversight layer bridging Ministry field data with National Audit Authority standards for 100% transparency.',
    },
  ];

  const modules = [
    { title: 'Budget Oversight', sub: 'Real-time fund tracking vs utilization', icon: '💎' },
    { title: 'Material Audit', sub: 'AI quality verification of procurement', icon: '🧱' },
    { title: 'Policy Simulation', sub: 'Impact analysis of governance directives', icon: '📜' },
    { title: 'Anti-Corruption AI', sub: 'Pattern detection for financial leakages', icon: '⚖️' },
  ];

  return (
      {/* Hero Section */}
      <section className="relative min-h-screen flex items-center pt-24 md:pt-32 pb-20">
        <div className="max-w-7xl mx-auto px-6 grid lg:grid-cols-2 gap-10 lg:gap-16 items-center">
          <motion.div 
            initial={{ opacity: 0, x: -30 }}
            animate={{ opacity: 1, x: 0 }}
            style={{ opacity: heroOpacity, y: heroY }} 
            className="relative z-10 text-center lg:text-left flex flex-col items-center lg:items-start"
          >
            <div className="flex items-center gap-3 mb-6 md:mb-10 bg-white/50 backdrop-blur-xl px-4 md:px-5 py-2 md:py-2.5 rounded-full border border-white/20 w-fit shadow-sm overflow-hidden">
               <img src="https://upload.wikimedia.org/wikipedia/commons/5/55/Emblem_of_India.svg" alt="Emblem" className="w-4 h-4 md:w-5 md:h-5 grayscale opacity-70" />
               <span className="text-[8px] md:text-[9px] font-black uppercase tracking-[0.15em] md:tracking-[0.2em] text-[#1a1a1a] whitespace-nowrap">Official Infrastructure Oversight Portal</span>
            </div>
            
            <h1 className="text-4xl sm:text-6xl lg:text-7xl font-black text-[#0f172a] leading-[1.1] lg:leading-[0.95] mb-6 md:mb-8 tracking-tight lg:tracking-[-0.03em]">
              Verified<br/>
              Governance,<br/>
              <span className="bg-gradient-to-r from-[#1e3a8a] via-blue-600 to-[#ea580c] bg-clip-text text-transparent italic">
                Autonomous.
              </span>
            </h1>
            <p className="text-base md:text-xl text-slate-500 mb-8 md:mb-14 leading-relaxed max-w-lg font-medium">
              India&apos;s first autonomous integrity framework. Live satellite-synced auditing of over <span className="text-rakshak-navy font-black border-b-2 border-rakshak-saffron/30">₹42 Lakh Cr</span> in national assets.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 md:gap-8 w-full sm:w-auto">
              <Link href="/dashboard" className="w-full sm:w-auto">
                <button className="w-full sm:w-auto px-8 md:px-12 py-4 md:py-6 bg-rakshak-navy text-white rounded-[1.2rem] md:rounded-[2rem] font-black text-[10px] md:text-sm shadow-[0_20px_40px_rgba(15,23,42,0.3)] hover:bg-black transition-all hover:-translate-y-2 border-b-4 md:border-b-8 border-rakshak-blue active:translate-y-0 active:border-b-0 uppercase tracking-widest">
                  Access Secure Portal
                </button>
              </Link>
              <div className="flex items-center justify-center gap-4 md:gap-6 px-6 md:px-8 py-3 md:py-5 bg-white/40 backdrop-blur-xl rounded-[1.2rem] md:rounded-[2rem] border border-white/20 shadow-sm w-full sm:w-auto">
                 <div className="flex -space-x-3 md:-space-x-4 shrink-0">
                    {[1,2,3,4].map(i => <div key={i} className="w-6 h-6 md:w-10 md:h-10 rounded-full bg-slate-200 border-2 md:border-4 border-white shadow-xl" />)}
                 </div>
                 <div className="text-left">
                    <p className="text-[7px] md:text-[10px] font-black text-slate-400 uppercase tracking-widest">Global Audit Reach</p>
                    <p className="text-[10px] md:text-sm font-black text-rakshak-navy uppercase">14.2K+ Registered Officers</p>
                 </div>
              </div>
            </div>
          </motion.div>
          
          <div className="h-[350px] sm:h-[500px] lg:h-[700px] relative mt-10 lg:mt-0">
            <IndiaGlobe />
            {/* Background Halo */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[140%] h-[140%] bg-blue-400/10 rounded-full blur-[80px] md:blur-[120px] -z-10 animate-pulse" />
          </div>
        </div>
      </section>

      {/* Dynamic News Feed News (iOS System Style) */}
      <section className="py-20 bg-white/30 backdrop-blur-sm border-y border-white selection:text-white selection:bg-rakshak-blue">
         <div className="max-w-7xl mx-auto px-6 mb-12">
            <div className="flex items-center justify-between">
               <h2 className="text-xs font-black uppercase tracking-[0.4em] text-slate-400 flex items-center gap-4">
                  <div className="w-12 h-[2px] bg-slate-200" />
                  Live Audit Intelligence (LAI™)
               </h2>
               <div className="flex items-center gap-2 text-[10px] font-black uppercase text-rakshak-blue tracking-widest bg-blue-50 px-4 py-1.5 rounded-full border border-blue-100">
                  <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
                  Real-time Sync Active
               </div>
            </div>
         </div>
         <div className="flex gap-8 px-6 overflow-hidden relative">
            <motion.div 
               animate={{ x: ["0%", "-50%"] }}
               transition={{ duration: 60, repeat: Infinity, ease: "linear" }}
               className="flex gap-8 whitespace-nowrap"
            >
               {[1,2,3,4,5].map((i) => (
                  <div key={i} className="flex gap-8">
                     {[
                        { title: "N-W Corridor Ph: IV", status: "Audit Passed", risk: "2.4%", color: "green" },
                        { title: "Mumbai Sewage Plant", status: "Anomalies Found", risk: "48.2%", color: "red" },
                        { title: "Gujarat Solar Hub", status: "Verification Sync", risk: "1.0%", color: "green" },
                        { title: "Assam Bridge B22", status: "Integrity Alert", risk: "18.5%", color: "yellow" },
                     ].map((item, idx) => (
                        <div key={idx} className="flex-shrink-0 w-80 p-8 glass-card bg-white border border-slate-100 shadow-[0_10px_30px_rgba(0,0,0,0.03)] group hover:border-rakshak-blue transition-all cursor-default relative overflow-hidden">
                           <div className="absolute top-0 right-0 w-16 h-16 bg-gradient-to-br from-rakshak-blue/5 to-transparent rounded-bl-3xl" />
                           <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4 flex items-center justify-between">
                              {item.title}
                              <span className={`w-2 h-2 rounded-full ${item.color === 'green' ? 'bg-green-500' : item.color === 'yellow' ? 'bg-yellow-500' : 'bg-red-500'}`} />
                           </p>
                           <h4 className="text-lg font-black text-rakshak-navy mb-2 group-hover:text-rakshak-blue transition-colors">{item.status}</h4>
                           <div className="flex items-center justify-between">
                              <span className="text-[10px] uppercase font-bold text-slate-400">Integrity Risk</span>
                              <span className={`text-sm font-black ${item.color === 'green' ? 'text-green-600' : 'text-red-600'}`}>{item.risk}</span>
                           </div>
                           <div className="h-1 bg-slate-50 mt-4 rounded-full overflow-hidden">
                              <div className={`h-full ${item.color === 'green' ? 'bg-green-500' : 'bg-red-500'}`} style={{ width: item.risk }} />
                           </div>
                        </div>
                     ))}
                  </div>
               ))}
            </motion.div>
         </div>
      </section>

      {/* Stats Section */}
      <section className="py-20 md:py-32 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 md:gap-16">
            {stats.map((s, i) => (
              <motion.div 
                key={s.label}
                initial={{ opacity: 0, scale: 0.95 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1, type: "spring", stiffness: 100 }}
                className="text-center group"
              >
                <div className="text-4xl md:text-7xl mb-4 md:mb-10 group-hover:scale-110 transition-transform duration-500">{s.icon}</div>
                <div className="text-2xl md:text-5xl font-black text-[#0f172a] mb-2 md:mb-4 tracking-tighter">
                  <AnimatedCounter target={s.value} prefix={s.prefix} suffix={s.suffix} />
                </div>
                <div className="text-slate-400 font-black text-[9px] md:text-[11px] tracking-[0.2em] md:tracking-[0.4em] uppercase">{s.label}</div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Oversight Modules Grid */}
      <section className="py-24 px-6 relative">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col items-center mb-16 text-center">
            <h2 className="text-xs font-black uppercase text-rakshak-blue tracking-[0.3em] md:tracking-[0.5em] mb-4">Core Intelligence Nodes</h2>
            <p className="text-3xl md:text-4xl font-extrabold text-rakshak-navy tracking-tight max-w-2xl px-4">
              Specialized Modules for <span className="text-transparent bg-clip-text bg-gradient-to-r from-rakshak-blue to-blue-400">Total Asset Integrity</span>
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 md:gap-8">
            {modules.map((m, i) => (
              <motion.div
                key={m.title}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className="glass-card p-8 md:p-10 flex flex-col items-center text-center gap-6 hover:border-rakshak-blue transition-all"
              >
                <div className="text-3xl md:text-4xl">{m.icon}</div>
                <div>
                   <h4 className="font-bold text-rakshak-navy text-base md:text-lg mb-2">{m.title}</h4>
                   <p className="text-[10px] md:text-xs text-slate-400 font-medium leading-relaxed">{m.sub}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Feature Section with Glass Cards */}
      <section className="py-32 px-6 bg-gradient-to-b from-[#f1f4f9] to-[#ffffff]">
        <div className="max-w-7xl mx-auto grid md:grid-cols-3 gap-10">
          {features.map((f, i) => (
            <FeatureCard key={f.title} {...f} delay={i * 0.1} />
          ))}
        </div>
      </section>

      <footer className="py-20 px-6 bg-white border-t border-slate-100 mt-20">
        <div className="max-w-7xl mx-auto flex flex-col lg:flex-row justify-between items-center lg:items-start gap-16 md:gap-20">
          <div className="flex items-center gap-4 text-center lg:text-left flex-col lg:flex-row">
             <div className="w-12 h-12 bg-slate-900 rounded-2xl flex items-center justify-center">
                <span className="text-white font-black">R</span>
             </div>
             <div>
                <p className="font-black text-rakshak-navy uppercase tracking-tighter text-2xl lg:text-lg">RAKSHAK INTEGRITY</p>
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-[0.2em] leading-none mt-1">Powered by National Audit Labs</p>
             </div>
          </div>
          <div className="flex flex-col sm:flex-row gap-12 md:gap-24 text-center sm:text-left">
             <div className="space-y-6">
                <p className="text-[10px] font-black uppercase text-slate-400 tracking-[0.25em]">Protocol Hub</p>
                <div className="flex flex-col gap-3">
                   {['Documentation', 'API Access', 'Audit Logs', 'Whitepaper'].map(item => (
                      <Link key={item} href="#" className="text-xs font-bold text-slate-600 hover:text-rakshak-blue transition-colors uppercase tracking-widest">{item}</Link>
                   ))}
                </div>
             </div>
             <div className="space-y-6">
                <p className="text-[10px] font-black uppercase text-slate-400 tracking-[0.25em]">Verification Node</p>
                <p className="text-xs font-black text-rakshak-navy uppercase">SHA-256 Verified Trail</p>
                <p className="text-xs font-bold text-slate-400 leading-relaxed uppercase tracking-widest">Ministry of Integrity<br/>New Delhi, IN 110001</p>
             </div>
          </div>
        </div>
        <div className="max-w-7xl mx-auto mt-20 pt-10 border-t border-slate-50 flex flex-col md:flex-row justify-between items-center gap-6 opacity-30 text-center md:text-left">
          <span className="text-[8px] md:text-[9px] font-black uppercase tracking-[0.3em] md:tracking-[0.5em]">NIC-GOV-SECURED-ENVIRONMENT</span>
          <span className="text-[8px] md:text-[9px] font-black uppercase tracking-[0.2em] md:tracking-widest">RAKSHAK-V2.4.0-PRIME</span>
        </div>
      </footer>
    </div>
  );
}
