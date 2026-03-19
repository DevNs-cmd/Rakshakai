'use client';
import { useEffect, useRef, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import { ProjectMapPoint } from '@/lib/types';
import { useRouter } from 'next/navigation';

interface Props {
  projects: ProjectMapPoint[];
}

export default function DashboardMap({ projects }: Props) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const router = useRouter();
  const markers = useRef<Record<string, mapboxgl.Marker>>({});

  useEffect(() => {
    if (!mapContainer.current) return;
    
    const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN || '';
    if (!token || token.includes('placeholder')) {
      console.warn('Mapbox token is missing or invalid.');
      return;
    }

    mapboxgl.accessToken = token;

    try {
      map.current = new mapboxgl.Map({
        container: mapContainer.current as HTMLElement,
        style: 'mapbox://styles/mapbox/light-v11',
        center: [78.9629, 20.5937], // Center of India
        zoom: 4.5,
        pitch: 45,
        bearing: -10,
        antialias: true
      });
      map.current.addControl(new mapboxgl.NavigationControl(), 'top-right');
    } catch (e) {
      console.error('Mapbox initialization failed:', e);
      return;
    }

    const handleLoad = () => {
      // Add custom layer for 3D buildings if needed
      const layers = map.current?.getStyle().layers;
      const labelLayerId = layers?.find(
        (layer) => layer.type === 'symbol' && layer.layout?.['text-field']
      )?.id;

      map.current?.addLayer(
        {
          'id': 'add-3d-buildings',
          'source': 'composite',
          'source-layer': 'building',
          'filter': ['==', 'extrude', 'true'],
          'type': 'fill-extrusion',
          'minzoom': 15,
          'paint': {
            'fill-extrusion-color': '#aaa',
            'fill-extrusion-height': ['get', 'height'],
            'fill-extrusion-base': ['get', 'min_height'],
            'fill-extrusion-opacity': 0.6
          }
        },
        labelLayerId
      );
    };

    map.current.on('load', handleLoad);

    return () => map.current?.remove();
  }, []);

  useEffect(() => {
    if (!map.current) return;

    // Clear existing markers
    Object.values(markers.current).forEach(m => m.remove());
    markers.current = {};

    projects.forEach((p) => {
      const el = document.createElement('div');
      el.className = `w-6 h-6 rounded-full border-2 border-white shadow-xl flex items-center justify-center cursor-pointer transition-transform hover:scale-125 z-10 ${
        p.risk_level === 'green' ? 'bg-green-500 marker-pulse-green' : 
        p.risk_level === 'yellow' ? 'bg-yellow-500' : 'bg-red-500 marker-pulse-red'
      }`;

      // Create popup content
      const popupContent = `
        <div class="p-3">
          <p class="text-[10px] text-slate-500 uppercase font-black mb-1">${p.state}</p>
          <h3 class="font-bold text-rakshak-navy text-sm mb-2 leading-snug">${p.name}</h3>
          <div class="space-y-2">
            <div class="flex items-center justify-between gap-4">
              <span class="text-[10px] text-slate-400 font-bold uppercase">Budget</span>
              <span class="text-xs font-bold text-rakshak-blue">₹${(p.budget / 10000000).toFixed(1)} Cr</span>
            </div>
            <div class="flex items-center justify-between gap-4">
              <span class="text-[10px] text-slate-400 font-bold uppercase">Risk Score</span>
              <span class="text-xs font-bold ${p.risk_level === 'red' ? 'text-red-600' : p.risk_level === 'yellow' ? 'text-yellow-600' : 'text-green-600'}">${p.risk_score}%</span>
            </div>
            <div class="w-full bg-slate-100 h-1 rounded-full overflow-hidden">
              <div class="bg-rakshak-blue h-full" style="width: ${p.progress_percent}%"></div>
            </div>
          </div>
          <button id="btn-${p.id}" class="w-full mt-4 py-2 bg-rakshak-blue text-white text-[10px] font-black uppercase tracking-widest rounded-lg shadow-lg hover:bg-rakshak-navy transition-all">Details →</button>
        </div>
      `;

      const popup = new mapboxgl.Popup({ offset: 25, closeButton: false })
        .setHTML(popupContent);

      const marker = new mapboxgl.Marker(el)
        .setLngLat([p.longitude, p.latitude])
        .setPopup(popup)
        .addTo(map.current!);

      marker.getElement().addEventListener('click', () => {
        setTimeout(() => {
          const btn = document.getElementById(`btn-${p.id}`);
          if (btn) {
            btn.onclick = () => router.push(`/dashboard/projects/${p.id}`);
          }
        }, 100);
      });

      markers.current[p.id] = marker;
    });
  }, [projects, router]);

  return (
    <div className="relative w-full h-full glass-card overflow-hidden flex items-center justify-center bg-slate-50">
      <div ref={mapContainer} className="absolute inset-0" />
      
      {!map.current && (
        <div className="z-10 text-center p-6">
          <p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-2">Map Engine Offline</p>
          <p className="text-[10px] text-slate-400 font-medium">Provide a valid Mapbox Token in .env.local to enable geospatial visualization</p>
        </div>
      )}
      
      {/* Legend overlay */}
      <div className="absolute bottom-6 left-6 glass-card p-4 bg-white/90 shadow-2xl z-20">
        <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Integrity Legend</h4>
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <span className="w-3 h-3 rounded-full bg-green-500 shadow-lg shadow-green-500/20" />
            <span className="text-xs font-bold text-slate-600">Secure (0-30)</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="w-3 h-3 rounded-full bg-yellow-500 shadow-lg shadow-yellow-500/20" />
            <span className="text-xs font-bold text-slate-600">Suspicious (31-70)</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="w-3 h-3 rounded-full bg-red-500 shadow-lg shadow-red-500/20 animate-pulse" />
            <span className="text-xs font-bold text-slate-600">Critical (71-100)</span>
          </div>
        </div>
      </div>
    </div>
  );
}
