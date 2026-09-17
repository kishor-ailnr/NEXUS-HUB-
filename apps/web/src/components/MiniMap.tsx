import React, { useEffect, useRef } from 'react';
import { MapPin, MapPinOff } from 'lucide-react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

interface MiniMapProps {
  latitude?: number | null;
  longitude?: number | null;
  orgName?: string;
  className?: string;
}

export const MiniMap: React.FC<MiniMapProps> = ({
  latitude,
  longitude,
  orgName = 'Organization HQ',
  className = '',
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);

  const hasCoordinates =
    typeof latitude === 'number' &&
    typeof longitude === 'number' &&
    !isNaN(latitude) &&
    !isNaN(longitude);

  useEffect(() => {
    if (!hasCoordinates || !mapContainerRef.current) {
      return;
    }

    try {
      if (!mapInstanceRef.current) {
        const map = L.map(mapContainerRef.current, {
          center: [latitude!, longitude!],
          zoom: 12,
          zoomControl: false,
          attributionControl: false,
          dragging: false,
          scrollWheelZoom: false,
          doubleClickZoom: false,
        });

        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          maxZoom: 18,
        }).addTo(map);

        const customIcon = L.divIcon({
          className: 'custom-pin',
          html: `<div style="background-color: #0f172a; width: 14px; height: 14px; border-radius: 50%; border: 2px solid #38bdf8; box-shadow: 0 0 6px rgba(56,189,248,0.8);"></div>`,
          iconSize: [14, 14],
          iconAnchor: [7, 7],
        });

        L.marker([latitude!, longitude!], { icon: customIcon })
          .addTo(map)
          .bindPopup(orgName);

        mapInstanceRef.current = map;
        setTimeout(() => map.invalidateSize(), 100);
      } else {
        mapInstanceRef.current.setView([latitude!, longitude!], 12);
        mapInstanceRef.current.invalidateSize();
      }
    } catch {
      // Graceful fallback in environments without full DOM canvas
    }

    return () => {
      if (mapInstanceRef.current) {
        try {
          mapInstanceRef.current.remove();
        } catch {
          // ignore
        }
        mapInstanceRef.current = null;
      }
    };
  }, [latitude, longitude, hasCoordinates, orgName]);

  if (!hasCoordinates) {
    return (
      <div
        className={`w-36 h-20 sm:w-44 sm:h-24 bg-slate-100 border border-dashed border-slate-300 rounded-lg flex flex-col items-center justify-center p-2 text-center select-none ${className}`}
        data-testid="location-placeholder"
      >
        <MapPinOff className="w-5 h-5 text-slate-400 mb-1" />
        <span className="text-[10px] font-semibold text-slate-600 leading-tight">
          Location not yet available
        </span>
      </div>
    );
  }

  return (
    <div
      className={`w-36 h-20 sm:w-44 sm:h-24 rounded-lg overflow-hidden border border-slate-300 shadow-inner relative z-0 ${className}`}
      data-testid="mini-map"
    >
      <div ref={mapContainerRef} className="w-full h-full" style={{ width: '100%', height: '100%' }} />
      <div className="absolute bottom-1 right-1 z-[400] bg-navy/80 backdrop-blur-sm px-1.5 py-0.5 rounded text-[9px] text-white flex items-center gap-1 font-mono">
        <MapPin className="w-2.5 h-2.5 text-blue-400" />
        <span>
          {latitude?.toFixed(2)}, {longitude?.toFixed(2)}
        </span>
      </div>
    </div>
  );
};
