'use client';
import { useEffect, useRef, useState } from 'react';
import { motion, useScroll, useTransform, AnimatePresence } from 'framer-motion';
import Link from 'next/link';
import * as THREE from 'three';

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
    <span ref={ref} className="counter-animation">
      {prefix}{count.toLocaleString('en-IN')}{suffix}
    </span>
  );
}

// ── Three.js Globe Component ───────────────────────────────────────────────────
function IndiaGlobe() {
  const mountRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!mountRef.current) return;

    const scene = new THREE.Scene();
    const w = mountRef.current.clientWidth;
    const h = mountRef.current.clientHeight;
    
    // Adjusted camera for mobile/desktop
    const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;
    const camera = new THREE.PerspectiveCamera(45, w / h, 0.1, 1000);
    camera.position.z = isMobile ? 4.2 : 3.5;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, logarithmicDepthBuffer: true });
    try {
      renderer.setSize(w, h);
      renderer.setPixelRatio(window.devicePixelRatio);
      renderer.toneMapping = THREE.ReinhardToneMapping;
      renderer.toneMappingExposure = 1.5;
      mountRef.current.appendChild(renderer.domElement);
    } catch (e) {
      console.error('Three.js failed to initialize:', e);
      return;
    }

    // ── Celestial Stars Background ──────────────────────────
    const starGeom = new THREE.BufferGeometry();
    const starCount = isMobile ? 1000 : 3000;
    const starCoords = new Float32Array(starCount * 3);
    for (let i = 0; i < starCount * 3; i++) {
      starCoords[i] = (Math.random() - 0.5) * 2000;
    }
    starGeom.setAttribute('position', new THREE.BufferAttribute(starCoords, 3));
    const starMat = new THREE.PointsMaterial({ color: 0xffffff, size: 0.8, transparent: true, opacity: 0.3 });
    const stars = new THREE.Points(starGeom, starMat);
    scene.add(stars);

    // ── Earth Group ───────────────────────────────────────────
    const earthGroup = new THREE.Group();
    scene.add(earthGroup);

    // 1. High-Fidelity Earth Sphere
    const geometry = new THREE.SphereGeometry(1, 64, 64);
    const material = new THREE.MeshStandardMaterial({
      color: 0x0a192f,      // Deep space navy base
      metalness: 0.4,
      roughness: 0.7,
      transparent: true,
      opacity: 0.98,
    });
    const globe = new THREE.Mesh(geometry, material);
    earthGroup.add(globe);

    // 2. Procedural Land Layout (Subtle glowing grid for tech aesthetic)
    const landGeom = new THREE.SphereGeometry(1.002, 64, 64);
    const landMat = new THREE.MeshStandardMaterial({
      color: 0x3b82f6,
      emissive: 0x1e40af,
      emissiveIntensity: 0.6,
      wireframe: true,
      transparent: true,
      opacity: 0.18,
    });
    const landOverlay = new THREE.Mesh(landGeom, landMat);
    earthGroup.add(landOverlay);

    // 3. Atmospheric Rim (Fresnel Shader)
    const atmGeom = new THREE.SphereGeometry(1.12, 64, 64);
    const atmMat = new THREE.ShaderMaterial({
      transparent: true,
      side: THREE.BackSide,
      uniforms: {
        glowColor: { value: new THREE.Color(0x3b82f6) },
        viewVector: { value: camera.position }
      },
      vertexShader: `
        varying vec3 vNormal;
        varying vec3 vViewPosition;
        void main() {
          vNormal = normalize(normalMatrix * normal);
          vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
          vViewPosition = -mvPosition.xyz;
          gl_Position = projectionMatrix * mvPosition;
        }
      `,
      fragmentShader: `
        uniform vec3 glowColor;
        varying vec3 vNormal;
        varying vec3 vViewPosition;
        void main() {
          float intensity = pow(0.7 - dot(vNormal, normalize(vViewPosition)), 4.0);
          gl_FragColor = vec4(glowColor, intensity);
        }
      `
    });
    const atmosphere = new THREE.Mesh(atmGeom, atmMat);
    earthGroup.add(atmosphere);

    // ── India Locators ────────────────────────────────────────
    const indiaPoints = [
      { lat: 28.6139, lng: 77.2090, label: 'DELHI', risk: 'secure' },
      { lat: 19.0760, lng: 72.8777, label: 'MUMBAI', risk: 'warning' },
      { lat: 12.9716, lng: 77.5946, label: 'BANGALORE', risk: 'secure' },
      { lat: 22.5726, lng: 88.3639, label: 'KOLKATA', risk: 'critical' },
    ];

    const markers: THREE.Group[] = [];
    indiaPoints.forEach((p) => {
      const phi = (90 - p.lat) * (Math.PI / 180);
      const theta = (p.lng + 180) * (Math.PI / 180);
      const x = -(Math.sin(phi) * Math.cos(theta));
      const z = Math.sin(phi) * Math.sin(theta);
      const y = Math.cos(phi);

      const markerGrp = new THREE.Group();
      markerGrp.position.set(x, y, z);
      
      const hexColor = p.risk === 'secure' ? 0x22c55e : p.risk === 'warning' ? 0xeab308 : 0xef4444;
      const point = new THREE.Mesh(
        new THREE.SphereGeometry(0.02, 12, 12),
        new THREE.MeshBasicMaterial({ color: hexColor })
      );
      markerGrp.add(point);

      const beacon = new THREE.Mesh(
        new THREE.CylinderGeometry(0.005, 0.005, 0.2, 8),
        new THREE.MeshBasicMaterial({ color: hexColor, transparent: true, opacity: 0.5 })
      );
      beacon.position.y = 0.1;
      markerGrp.add(beacon);

      markerGrp.lookAt(x * 2, y * 2, z * 2);
      earthGroup.add(markerGrp);
      markers.push(markerGrp);
    });

    // ── Professional Lighting ───────────────────────────────
    scene.add(new THREE.AmbientLight(0xffffff, 0.4));
    const sun = new THREE.DirectionalLight(0xffffff, 3.5);
    sun.position.set(5, 3, 5);
    scene.add(sun);
    const rim = new THREE.PointLight(0x3b82f6, 12, 10);
    rim.position.set(-5, 5, -5);
    scene.add(rim);

    // ── Interactivity & Animation ──────────────────────────
    let isDragging = false;
    let prevX = 0;
    let targetY = 0;

    const handleStart = (clientX: number) => { isDragging = true; prevX = clientX; };
    const handleMove = (clientX: number) => {
      if (isDragging) {
        targetY += (clientX - prevX) * 0.005;
        prevX = clientX;
      }
    };
    const handleEnd = () => isDragging = false;

    mountRef.current.addEventListener('mousedown', (e) => handleStart(e.clientX));
    window.addEventListener('mousemove', (e) => handleMove(e.clientX));
    window.addEventListener('mouseup', handleEnd);
    mountRef.current.addEventListener('touchstart', (e) => handleStart(e.touches[0].clientX));
    window.addEventListener('touchmove', (e) => handleMove(e.changedTouches[0].clientX));
    window.addEventListener('touchend', handleEnd);

    let time = 0;
    const animate = () => {
      time += 0.01;
      requestAnimationFrame(animate);
      if (!isDragging) earthGroup.rotation.y += 0.002;
      else earthGroup.rotation.y += (targetY - earthGroup.rotation.y) * 0.1;

      stars.rotation.y += 0.0001;
      markers.forEach((m, i) => {
        m.scale.setScalar(1 + Math.sin(time * 4 + i) * 0.1);
      });
      renderer.render(scene, camera);
    };
    animate();

    const handleResize = () => {
      if (!mountRef.current) return;
      const nw = mountRef.current.clientWidth;
      const nh = mountRef.current.clientHeight;
      camera.aspect = nw / nh;
      camera.updateProjectionMatrix();
      renderer.setSize(nw, nh);
      camera.position.z = nw < 768 ? 4.2 : 3.5;
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      renderer.dispose();
      if (mountRef.current?.contains(renderer.domElement)) {
        mountRef.current.removeChild(renderer.domElement);
      }
    };
  }, []);

  return (
    <div ref={mountRef} className="w-full h-full relative cursor-grab active:cursor-grabbing">
      <div className="absolute inset-0 pointer-events-none bg-radial-at-c from-transparent via-transparent to-rakshak-blue/10" />
    </div>
  );
}

// ── Feature Card ───────────────────────────────────────────────────────────────
function FeatureCard({ icon, title, description, delay }: {
  icon: string; title: string; description: string; delay: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ delay, duration: 0.5 }}
      className="glass-card p-6 group"
    >
      <div className="text-3xl mb-4">{icon}</div>
      <h3 className="font-semibold text-rakshak-blue text-lg mb-2">{title}</h3>
      <p className="text-slate-600 text-sm leading-relaxed">{description}</p>
    </motion.div>
  );
}

// ── Main Landing Page ─────────────────────────────────────────────────────────
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
      icon: '🛰️',
      title: 'Real-Time GPS Verification',
      description: 'Every piece of evidence is geo-tagged and validated against project coordinates. No fake submissions.',
    },
    {
      icon: '🤖',
      title: 'AI Risk Scoring',
      description: 'XGBoost model analyses timeline, evidence frequency, budget utilization, and contractor history.',
    },
    {
      icon: '🗺️',
      title: 'National Integrity Map',
      description: 'Live Mapbox visualization of all projects across India with color-coded risk indicators.',
    },
    {
      icon: '⚡',
      title: 'Real-Time Alerts',
      description: 'WebSocket-powered notifications for evidence gaps, deadline risks, and anomaly spikes.',
    },
    {
      icon: '🔒',
      title: 'Immutable Audit Trail',
      description: 'Every action is SHA-256 hashed and stored immutably. No tampering possible.',
    },
    {
      icon: '👥',
      title: 'Role-Based Access',
      description: 'Admin, Officer, and Auditor roles with granular permissions powered by JWT authentication.',
    },
  ];

  return (
    <div className="min-h-screen bg-gradient-hero overflow-hidden">
      {/* ── Navigation ──────────────────────────────────────────── */}
      <nav className="fixed top-0 left-0 right-0 z-50 nav-blur">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-gradient-to-br from-rakshak-blue to-rakshak-saffron rounded-lg flex items-center justify-center">
              <span className="text-white text-sm font-bold">R</span>
            </div>
            <div>
              <span className="font-bold text-rakshak-blue text-lg">RAKSHAK</span>
              <span className="text-xs text-slate-500 ml-2 hidden sm:inline">Governance Integrity System</span>
            </div>
          </div>

          <div className="flex items-center gap-6">
            <a href="#features" className="text-slate-600 hover:text-rakshak-blue text-sm transition-colors hidden md:block">
              Features
            </a>
            <a href="#stats" className="text-slate-600 hover:text-rakshak-blue text-sm transition-colors hidden md:block">
              Impact
            </a>
            <Link href="/login">
              <button className="px-4 py-2 rounded-lg border border-rakshak-blue/20 text-rakshak-blue text-sm font-medium hover:bg-rakshak-blue hover:text-white transition-all duration-200">
                Sign In
              </button>
            </Link>
            <Link href="/dashboard">
              <button className="px-4 py-2 rounded-lg bg-rakshak-blue text-white text-sm font-medium hover:bg-rakshak-navy transition-all duration-200 hidden sm:block">
                Dashboard →
              </button>
            </Link>
          </div>
        </div>
      </nav>

      {/* ── Hero Section ────────────────────────────────────────── */}
      <motion.section
        style={{ opacity: heroOpacity, y: heroY }}
        className="relative min-h-screen flex items-center pt-16"
      >
        <div className="max-w-7xl mx-auto px-6 grid lg:grid-cols-2 gap-16 items-center py-20">
          {/* Left: Text */}
          <div>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="inline-flex items-center gap-2 bg-blue-50 border border-blue-200 rounded-full px-4 py-1.5 mb-6"
            >
              <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse-slow" />
              <span className="text-blue-700 text-sm font-medium">Live Monitoring Active</span>
            </motion.div>

            <motion.h1
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="text-5xl lg:text-6xl font-bold text-rakshak-navy leading-tight mb-6"
            >
              From Blind Execution
              <br />
              <span className="bg-gradient-to-r from-rakshak-saffron to-yellow-500 bg-clip-text text-transparent">
                to Verified Governance
              </span>
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="text-xl text-slate-600 mb-8 leading-relaxed"
            >
              RAKSHAK is India&apos;s first autonomous infrastructure monitoring system. Every project, every rupee, every milestone — tracked in real-time with AI-powered risk intelligence.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              className="flex flex-wrap gap-4"
            >
              <Link href="/dashboard">
                <button className="px-8 py-4 bg-rakshak-blue text-white rounded-xl font-semibold text-lg hover:bg-rakshak-navy transition-all duration-200 shadow-lg hover:shadow-xl hover:-translate-y-0.5">
                  Launch Dashboard
                </button>
              </Link>
              <Link href="/login">
                <button className="px-8 py-4 bg-white text-rakshak-blue rounded-xl font-semibold text-lg border border-rakshak-blue/20 hover:border-rakshak-blue/40 transition-all duration-200 shadow-card hover:shadow-card-hover hover:-translate-y-0.5">
                  Sign In →
                </button>
              </Link>
            </motion.div>

            {/* Trust indicators */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.6 }}
              className="mt-12 flex items-center gap-6 flex-wrap"
            >
              <div className="flex items-center gap-2">
                <div className="w-5 h-5 bg-green-100 rounded-full flex items-center justify-center">
                  <span className="text-green-600 text-xs">✓</span>
                </div>
                <span className="text-slate-500 text-sm">PostGIS verified</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-5 h-5 bg-blue-100 rounded-full flex items-center justify-center">
                  <span className="text-blue-600 text-xs">✓</span>
                </div>
                <span className="text-slate-500 text-sm">SHA-256 immutable logs</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-5 h-5 bg-purple-100 rounded-full flex items-center justify-center">
                  <span className="text-purple-600 text-xs">✓</span>
                </div>
                <span className="text-slate-500 text-sm">XGBoost AI engine</span>
              </div>
            </motion.div>
          </div>

          {/* Right: 3D Globe */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.3, duration: 0.8 }}
            className="relative h-[500px] lg:h-[600px]"
          >
            <div className="absolute inset-0 bg-gradient-to-r from-blue-50/50 to-transparent rounded-3xl" />
            <IndiaGlobe />

            {/* Floating cards */}
            <motion.div
              animate={{ y: [0, -8, 0] }}
              transition={{ duration: 4, repeat: Infinity }}
              className="absolute top-8 right-4 glass-card p-4 max-w-[180px]"
            >
              <div className="text-xs text-slate-500 mb-1">National Integrity Score</div>
              <div className="text-2xl font-bold text-green-600">84.6%</div>
              <div className="text-xs text-green-500 mt-1">↑ 2.3% this week</div>
            </motion.div>

            <motion.div
              animate={{ y: [0, 8, 0] }}
              transition={{ duration: 3.5, repeat: Infinity, delay: 0.5 }}
              className="absolute bottom-16 left-4 glass-card p-4 max-w-[190px]"
            >
              <div className="flex items-center gap-2 mb-2">
                <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                <div className="text-xs text-red-600 font-medium">ALERT</div>
              </div>
              <div className="text-xs text-slate-700">NH-44 evidence gap: 18 days</div>
            </motion.div>
          </motion.div>
        </div>
      </motion.section>

      {/* ── Stats Section ────────────────────────────────────────── */}
      <section id="stats" className="py-12 md:py-20 px-6 bg-white/50">
        <div className="max-w-7xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-10 md:mb-16"
          >
            <h2 className="text-3xl md:text-4xl font-bold text-rakshak-navy mb-4">
              Governance at National Scale
            </h2>
            <p className="text-slate-600 text-base md:text-lg">Real numbers. Real impact.</p>
          </motion.div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {stats.map((stat, i) => (
              <motion.div
                key={stat.label}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className="glass-card p-8 text-center"
              >
                <div className="text-4xl mb-3">{stat.icon}</div>
                <div className="text-3xl lg:text-4xl font-bold text-rakshak-blue mb-2">
                  <AnimatedCounter
                    target={stat.value}
                    prefix={stat.prefix}
                    suffix={stat.suffix}
                  />
                </div>
                <div className="text-slate-500 text-sm">{stat.label}</div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Features Section ─────────────────────────────────────── */}
      <section id="features" className="py-20 px-6">
        <div className="max-w-7xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <h2 className="text-4xl font-bold text-rakshak-navy mb-4">
              Six Pillars of Integrity
            </h2>
            <p className="text-slate-600 text-lg max-w-2xl mx-auto">
              Every layer of RAKSHAK is engineered to ensure accountability cannot be faked.
            </p>
          </motion.div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((f, i) => (
              <FeatureCard key={f.title} {...f} delay={i * 0.1} />
            ))}
          </div>
        </div>
      </section>

      {/* ── Data Flow Section ────────────────────────────────────── */}
      <section className="py-20 px-6 bg-gradient-to-b from-white/30 to-blue-50/50">
        <div className="max-w-5xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <h2 className="text-4xl font-bold text-rakshak-navy mb-4">How It Works</h2>
          </motion.div>

          <div className="flex flex-col gap-6">
            {[
              { step: '01', title: 'Admin Creates Project', desc: 'Define project with GPS location, budget, deadline, milestones, contractor', icon: '👨‍💼' },
              { step: '02', title: 'Officer Uploads Evidence', desc: 'Geo-tagged photos/videos uploaded from field via mobile-friendly portal', icon: '📸' },
              { step: '03', title: 'System Verifies GPS + Hash', desc: 'EXIF data extracted, location cross-checked, SHA-256 computed for deduplication', icon: '🔍' },
              { step: '04', title: 'AI Recalculates Risk', desc: 'XGBoost model scores project on 5 dimensions and updates risk level', icon: '🤖' },
              { step: '05', title: 'Dashboard Updates Live', desc: 'WebSockets push risk changes, map updates, alerts fire in real-time', icon: '⚡' },
            ].map((item, i) => (
              <motion.div
                key={item.step}
                initial={{ opacity: 0, x: -30 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className="glass-card p-6 flex flex-col sm:flex-row items-center sm:items-start text-center sm:text-left gap-6"
              >
                <div className="w-14 h-14 bg-rakshak-blue/10 rounded-2xl flex items-center justify-center text-2xl flex-shrink-0">
                  {item.icon}
                </div>
                <div className="flex-1">
                  <div className="flex flex-col sm:flex-row items-center gap-3 mb-1">
                    <span className="text-xs font-mono text-rakshak-saffron font-bold">{item.step}</span>
                    <h3 className="font-semibold text-rakshak-navy">{item.title}</h3>
                  </div>
                  <p className="text-slate-500 text-sm">{item.desc}</p>
                </div>
                {i < 4 && (
                  <div className="hidden sm:block text-slate-300 text-xl">↓</div>
                )}
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA Section ──────────────────────────────────────────── */}
      <section className="py-20 px-6">
        <div className="max-w-4xl mx-auto text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="glass-card p-16"
          >
            <div className="text-5xl mb-6">🇮🇳</div>
            <h2 className="text-4xl font-bold text-rakshak-navy mb-4">
              Integrity is not optional.
              <br />
              It is infrastructure.
            </h2>
            <p className="text-slate-600 text-lg mb-10">
              Join the mission to ensure every rupee of public money reaches its intended purpose.
            </p>
            <div className="flex gap-4 justify-center flex-wrap">
              <Link href="/dashboard">
                <button className="px-10 py-4 bg-rakshak-blue text-white rounded-xl font-semibold text-lg hover:bg-rakshak-navy transition-all duration-200 shadow-lg hover:-translate-y-0.5">
                  Access Dashboard
                </button>
              </Link>
              <Link href="/login">
                <button className="px-10 py-4 bg-white text-rakshak-blue rounded-xl font-semibold text-lg border border-rakshak-blue/20 hover:border-rakshak-blue/40 transition-all duration-200 shadow-card hover:-translate-y-0.5">
                  Government Login
                </button>
              </Link>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ── Footer ───────────────────────────────────────────────── */}
      <footer className="border-t border-slate-200 py-8 px-6 bg-white/80">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-7 h-7 bg-gradient-to-br from-rakshak-blue to-rakshak-saffron rounded-lg flex items-center justify-center">
              <span className="text-white text-xs font-bold">R</span>
            </div>
            <span className="font-bold text-rakshak-blue">RAKSHAK</span>
          </div>
          <p className="text-slate-400 text-sm">
            Autonomous Governance Integrity System © 2024
          </p>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
            <span className="text-slate-500 text-sm">System Online</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
