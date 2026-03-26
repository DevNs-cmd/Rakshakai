'use client';

import { useEffect, useRef } from 'react';
import * as THREE from 'three';

export default function NetworkMap3D() {
  const mountRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const currentMount = mountRef.current;
    if (!currentMount) return;

    const w = currentMount.clientWidth;
    const h = currentMount.clientHeight;
    
    // Scene Setup
    const scene = new THREE.Scene();
    scene.background = null; // transparent

    // Camera tilted for that angled 3D perspective
    const camera = new THREE.PerspectiveCamera(45, w / h, 0.1, 1000);
    camera.position.set(0, -6, 8);
    camera.lookAt(0, 0, 0);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(w, h);
    renderer.setPixelRatio(window.devicePixelRatio);
    currentMount.appendChild(renderer.domElement);

    const group = new THREE.Group();
    scene.add(group);

    // 1. The Glowing Base Map (Using a flat plane + topology map)
    const loader = new THREE.TextureLoader();
    const mapTexture = loader.load('https://unpkg.com/three-globe/example/img/earth-water.png');
    
    // We invert the water map so land is white, water is black, and use it as alpha/emissive
    const planeGeo = new THREE.PlaneGeometry(20, 10, 64, 64);
    const planeMat = new THREE.MeshStandardMaterial({
      color: 0xff4500, // orange base
      emissive: 0xff4500,
      emissiveIntensity: 0.5,
      transparent: true,
      opacity: 0.6,
      map: mapTexture,
      alphaMap: mapTexture, // land will show up
      alphaTest: 0.1,
      wireframe: true, // Gives it that techy grid look
    });
    const mapPlane = new THREE.Mesh(planeGeo, planeMat);
    group.add(mapPlane);

    // 2. Nodes (Glowing active locations)
    const nodes: { mesh: THREE.Mesh; pulse: number }[] = [];
    const nodeGeom = new THREE.SphereGeometry(0.1, 16, 16);
    
    const colors = [0x00ffff, 0xffa500, 0x00ff88, 0xff00ff];
    
    const nodePositions = [
      new THREE.Vector3(-4, 2, 0), // NA
      new THREE.Vector3(-2, -1, 0), // SA
      new THREE.Vector3(1, 2, 0), // Europe
      new THREE.Vector3(2, 0.5, 0), // Africa
      new THREE.Vector3(5, 2.5, 0), // Asia
      new THREE.Vector3(7, -1, 0), // Aus
      new THREE.Vector3(4, -0.5, 0), // India
      new THREE.Vector3(-6, 1, 0), // West Coast
      new THREE.Vector3(3, 3, 0), // Russia
    ];

    nodePositions.forEach((pos, i) => {
      const mat = new THREE.MeshBasicMaterial({ 
        color: colors[i % colors.length], 
        transparent: true, 
        opacity: 0.9 
      });
      const mesh = new THREE.Mesh(nodeGeom, mat);
      mesh.position.copy(pos);
      
      // Add a glow ring
      const ringGeom = new THREE.RingGeometry(0.15, 0.2, 32);
      const ringMat = new THREE.MeshBasicMaterial({ color: colors[i % colors.length], transparent: true, opacity: 0.5, side: THREE.DoubleSide });
      const ring = new THREE.Mesh(ringGeom, ringMat);
      mesh.add(ring);

      group.add(mesh);
      nodes.push({ mesh, pulse: Math.random() * Math.PI * 2 });
    });

    // 3. Animated Connections (Arcs)
    const arcs: { line: THREE.Line; progress: number; speed: number }[] = [];
    
    // Connect some random nodes
    for (let i = 0; i < 6; i++) {
        const startIdx = Math.floor(Math.random() * nodePositions.length);
        let endIdx = Math.floor(Math.random() * nodePositions.length);
        while (endIdx === startIdx) endIdx = Math.floor(Math.random() * nodePositions.length);
        
        const start = nodePositions[startIdx];
        const end = nodePositions[endIdx];
        
        // Quad Bezier Curve
        const mid = start.clone().lerp(end, 0.5);
        mid.z += start.distanceTo(end) * 0.3; // arc height
        
        const curve = new THREE.QuadraticBezierCurve3(start, mid, end);
        const points = curve.getPoints(50);
        
        const lineGeo = new THREE.BufferGeometry().setFromPoints(points);
        const lineMat = new THREE.LineBasicMaterial({
            color: 0x00ffff,
            transparent: true,
            opacity: 0.6,
        });
        
        const line = new THREE.Line(lineGeo, lineMat);
        group.add(line);
        arcs.push({ line, progress: 0, speed: 0.002 + Math.random() * 0.002 });
    }

    // Floating particles over the map
    const particleGeo = new THREE.BufferGeometry();
    const particleCount = 200;
    const pPos = new Float32Array(particleCount * 3);
    for(let i = 0; i < particleCount; i++) {
        pPos[i*3] = (Math.random() - 0.5) * 18; // x
        pPos[i*3+1] = (Math.random() - 0.5) * 8; // y
        pPos[i*3+2] = Math.random() * 2; // z height
    }
    particleGeo.setAttribute('position', new THREE.BufferAttribute(pPos, 3));
    const particleMat = new THREE.PointsMaterial({
        color: 0x00ffcc,
        size: 0.05,
        transparent: true,
        opacity: 0.4
    });
    const particles = new THREE.Points(particleGeo, particleMat);
    group.add(particles);

    // Initial slight rotation
    group.rotation.z = Math.PI * 0.05;

    // Animation Loop
    const animate = () => {
      requestAnimationFrame(animate);
      
      // Slowly rotate the whole map group for 3D effect
      group.rotation.z = Math.sin(Date.now() * 0.0002) * 0.05;
      camera.position.x = Math.sin(Date.now() * 0.0005) * 1;
      camera.lookAt(0,0,0);

      // Pulse nodes
      nodes.forEach(n => {
          n.pulse += 0.05;
          const scale = 1 + Math.sin(n.pulse) * 0.3;
          n.mesh.scale.set(scale, scale, scale);
          // Pulse ring
          n.mesh.children[0].scale.set(scale*1.2, scale*1.2, scale*1.2);
          ((n.mesh.children[0] as THREE.Mesh).material as THREE.MeshBasicMaterial).opacity = 0.5 - Math.sin(n.pulse)*0.3;
      });

      // Arc animation (simulate data flow by dashing)
      arcs.forEach(arc => {
          arc.progress += arc.speed;
          if (arc.progress > 1) arc.progress = 0;
          // Dynamically change opacity to simulate a burst traveling
          if (arc.line.material instanceof THREE.LineBasicMaterial) {
              arc.line.material.opacity = 0.2 + Math.sin(arc.progress * Math.PI) * 0.8;
          }
      });

      // Move particles
      const positions = particles.geometry.attributes.position.array as Float32Array;
      for(let i=0; i<particleCount; i++) {
          positions[i*3+2] += 0.005; // float up
          if (positions[i*3+2] > 3) {
             positions[i*3+2] = 0; // reset to surface
          }
      }
      particles.geometry.attributes.position.needsUpdate = true;

      renderer.render(scene, camera);
    };
    
    animate();

    // Clean up and resize
    const handleResize = () => {
      if (!mountRef.current) return;
      const width = mountRef.current.clientWidth;
      const height = mountRef.current.clientHeight;
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height);
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      renderer.dispose();
      currentMount?.removeChild(renderer.domElement);
    };
  }, []);

  return (
      <div className="w-full h-full relative cursor-crosshair">
          <div ref={mountRef} className="w-full h-full absolute inset-0 z-10" />
      </div>
  );
}
