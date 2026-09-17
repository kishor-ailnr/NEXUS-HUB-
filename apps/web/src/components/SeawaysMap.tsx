import React, { useEffect, useRef } from 'react';
import {
  Port,
  Vessel,
  VoyageMovement,
  LiveVesselTelemetryPayload,
  SeaConvoyGroup,
  Geofence,
  GhostPositionPayload,
} from '@nexus-ways/shared';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

interface SeawaysMapProps {
  ports: Port[];
  vessels: Vessel[];
  movements: VoyageMovement[];
  selectedMovement?: VoyageMovement | null;
  selectedVesselId?: string | null;
  liveTelemetry?: Record<string, LiveVesselTelemetryPayload>;
  ghostPositions?: Record<string, GhostPositionPayload>;
  convoys?: SeaConvoyGroup[];
  geofences?: Geofence[];
  onSelectMovement?: (movementId: string) => void;
  onSelectPort?: (portId: string) => void;
}

export const SeawaysMap: React.FC<SeawaysMapProps> = ({
  ports,
  vessels,
  movements,
  selectedMovement,
  selectedVesselId,
  liveTelemetry = {},
  ghostPositions = {},
  convoys = [],
  geofences = [],
  onSelectMovement,
  onSelectPort,
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const vesselMarkersRef = useRef<Map<string, L.Marker>>(new Map());
  const ghostMarkersRef = useRef<Map<string, L.Marker>>(new Map());
  const portMarkersRef = useRef<Map<string, L.Marker>>(new Map());
  const routeLayersRef = useRef<Map<string, L.Polyline>>(new Map());
  const geofenceLayersRef = useRef<Map<string, L.Circle>>(new Map());

  // Helper to check if vessel belongs to any convoy
  const getVesselConvoy = (vesselId: string): SeaConvoyGroup | undefined => {
    return convoys.find((c) => c.members?.some((m) => m.vessel_id === vesselId));
  };

  // 1. Initialize Leaflet Map
  useEffect(() => {
    if (!mapContainerRef.current || mapInstanceRef.current) return;

    // Center on Indian Ocean / Indian Peninsula (15.0° N, 78.0° E)
    const map = L.map(mapContainerRef.current, {
      center: [15.0, 78.0],
      zoom: 5,
      zoomControl: true,
    });

    // Dark base map layer (CartoDB Dark Matter)
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      attribution: '&copy; OpenStreetMap contributors &copy; CARTO',
      maxZoom: 19,
    }).addTo(map);

    mapInstanceRef.current = map;

    return () => {
      map.remove();
      mapInstanceRef.current = null;
    };
  }, []);

  // 2. Render Port Markers
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    // Remove old port markers
    for (const [, marker] of portMarkersRef.current.entries()) {
      marker.remove();
    }
    portMarkersRef.current.clear();

    ports.forEach((port) => {
      if (port.lat === null || port.lng === null || port.lat === undefined || port.lng === undefined) return;

      const portIconHtml = `
        <div class="relative flex items-center justify-center w-6 h-6 rounded-full bg-cyan-950 border border-cyan-400 text-cyan-300 shadow-lg cursor-pointer hover:scale-110 transition-transform">
          <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="5" r="3"></circle>
            <line x1="12" y1="22" x2="12" y2="8"></line>
            <path d="M5 12H2a10 10 0 0 0 20 0h-3"></path>
          </svg>
        </div>
      `;

      const customIcon = L.divIcon({
        html: portIconHtml,
        className: 'custom-port-pin',
        iconSize: [24, 24],
        iconAnchor: [12, 12],
      });

      const marker = L.marker([port.lat, port.lng], { icon: customIcon }).addTo(map);

      marker.bindPopup(`
        <div class="p-2 text-xs space-y-1 bg-slate-900 text-slate-100 rounded">
          <div class="font-bold text-cyan-400 flex items-center gap-1">
            ⚓ ${port.name}
          </div>
          ${port.unlocode ? `<div class="text-slate-300">UN/LOCODE: <span class="font-mono text-cyan-300">${port.unlocode}</span></div>` : ''}
          <div class="text-slate-400 text-[10px]">Position: ${port.lat.toFixed(4)}°N, ${port.lng.toFixed(4)}°E</div>
        </div>
      `);

      if (onSelectPort) {
        marker.on('click', () => onSelectPort(port.id));
      }

      portMarkersRef.current.set(port.id, marker);
    });
  }, [ports, onSelectPort]);

  // 3. Render Port Geofences (Anchorage limits)
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    for (const [, layer] of geofenceLayersRef.current.entries()) {
      layer.remove();
    }
    geofenceLayersRef.current.clear();

    geofences.forEach((gf) => {
      if (!gf.center_lat || !gf.center_lng) return;

      const circle = L.circle([gf.center_lat, gf.center_lng], {
        radius: gf.radius_m || 5000,
        color: '#06b6d4',
        fillColor: '#06b6d4',
        fillOpacity: 0.12,
        weight: 1.5,
        dashArray: '4, 4',
      }).addTo(map);

      circle.bindTooltip(`⚓ ${gf.name} (Port Limits)`, {
        permanent: false,
        direction: 'top',
        className: 'bg-slate-900 text-cyan-300 border-cyan-700 text-xs px-2 py-1',
      });

      geofenceLayersRef.current.set(gf.id, circle);
    });
  }, [geofences]);

  // 4. Render Land-Avoiding Sea Routes
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    // Clear old route polylines
    for (const [, layer] of routeLayersRef.current.entries()) {
      layer.remove();
    }
    routeLayersRef.current.clear();

    movements.forEach((mov) => {
      const isSelected = selectedMovement?.id === mov.id;
      const isInTransit = mov.status === 'in_transit';

      // Check if movement has route_geometry
      const coords = mov.route_geometry?.coordinates;
      let latLngs: [number, number][] = [];

      if (coords && Array.isArray(coords) && coords.length >= 2) {
        // [lng, lat] GeoJSON -> Leaflet [lat, lng]
        latLngs = coords.map(([lng, lat]) => [lat, lng]);
      } else if (mov.voyage?.origin_port && mov.voyage?.destination_port) {
        const oLat = mov.voyage.origin_port.lat;
        const oLng = mov.voyage.origin_port.lng;
        const dLat = mov.voyage.destination_port.lat;
        const dLng = mov.voyage.destination_port.lng;

        if (oLat && oLng && dLat && dLng) {
          latLngs = [[oLat, oLng], [dLat, dLng]];
        }
      }

      if (latLngs.length < 2) return;

      const routingSource = mov.route_geometry?.routing_source || 'searoute';
      const isFallback = routingSource === 'fallback-chokepoint';

      // Marine route styling: Deep Ocean Cyan/Blue with subtle dash for fallback
      const polyline = L.polyline(latLngs, {
        color: isSelected
          ? '#38bdf8'
          : isInTransit
          ? '#0284c7'
          : '#334155',
        weight: isSelected ? 3.5 : isInTransit ? 2.5 : 1.5,
        opacity: isSelected ? 0.95 : 0.7,
        dashArray: isFallback ? '6, 6' : undefined,
      }).addTo(map);

      polyline.bindTooltip(
        `🚢 ${mov.voyage?.voyage_number || 'Voyage'} (${routingSource}) • ${mov.distance_km || 0} km`,
        {
          permanent: false,
          direction: 'center',
          className: 'bg-slate-900 text-sky-300 border-sky-600 text-xs px-2 py-1',
        },
      );

      if (onSelectMovement) {
        polyline.on('click', () => onSelectMovement(mov.id));
      }

      routeLayersRef.current.set(mov.id, polyline);
    });
  }, [movements, selectedMovement, onSelectMovement]);

  // 5. Render Digital Twin Ghost Positions
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    // Clear old ghost markers
    for (const [, marker] of ghostMarkersRef.current.entries()) {
      marker.remove();
    }
    ghostMarkersRef.current.clear();

    Object.values(ghostPositions).forEach((ghost) => {
      if (!ghost.ghostLat || !ghost.ghostLng) return;

      const isAhead = ghost.status === 'ahead';
      const isBehind = ghost.status === 'behind';
      const statusColor = isAhead ? '#34d399' : isBehind ? '#f87171' : '#38bdf8';

      const ghostIconHtml = `
        <div class="flex flex-col items-center justify-center cursor-pointer pointer-events-auto">
          <div class="flex items-center justify-center w-7 h-7 rounded-full bg-cyan-950/80 border-2 border-dashed border-cyan-400 text-cyan-300 shadow-lg backdrop-blur-sm animate-pulse">
            <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M2 21c.6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1 .6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1"/>
              <path d="M19.38 20A11.6 11.6 0 0 0 21 14l-9-4-9 4c0 2.9.94 5.34 2.81 7.76"/>
            </svg>
          </div>
          <div class="mt-1 px-1.5 py-0.5 rounded text-[9px] font-bold uppercase shadow-md bg-slate-900/90 text-cyan-300 border border-cyan-500/40 whitespace-nowrap">
            Ghost Twin • ${
              isBehind
                ? `-${ghost.deviationMinutes}m Behind`
                : isAhead
                ? `+${Math.abs(ghost.deviationMinutes)}m Ahead`
                : 'On Schedule'
            }
          </div>
        </div>
      `;

      const customGhostIcon = L.divIcon({
        html: ghostIconHtml,
        className: 'custom-seaways-ghost-marker',
        iconSize: [90, 55],
        iconAnchor: [45, 27],
      });

      const marker = L.marker([ghost.ghostLat, ghost.ghostLng], { icon: customGhostIcon }).addTo(map);
      marker.bindPopup(`
        <div class="p-2 text-xs font-sans text-slate-900">
          <div class="font-bold text-sm text-cyan-700">Digital Twin (Ghost Vessel)</div>
          <div class="text-slate-600">Scheduled Voyage Plan Position</div>
          <div class="font-semibold mt-1" style="color: ${statusColor}">
            Status: ${ghost.status.toUpperCase()} (${ghost.deviationMinutes} min deviation)
          </div>
        </div>
      `);

      ghostMarkersRef.current.set(ghost.tripId, marker);
    });
  }, [ghostPositions]);

  // 6. Render Vessel Markers & Live Positions & Convoy Grouping
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    // Clear old vessel markers
    for (const [, marker] of vesselMarkersRef.current.entries()) {
      marker.remove();
    }
    vesselMarkersRef.current.clear();

    vessels.forEach((vessel) => {
      // Look for active movement for this vessel
      const activeMovement = movements.find(
        (m) => m.vessel_id === vessel.id && (m.status === 'in_transit' || m.status === 'planned'),
      );

      // Check live telemetry from socket or latest telemetry
      const tel = liveTelemetry[activeMovement?.id || ''] || activeMovement?.latest_telemetry;

      let lat = tel?.lat;
      let lng = tel?.lng;
      const speedKnots = tel ? (tel as any).speedKnots ?? (tel as any).speed_knots ?? 0 : 0;
      const heading = tel?.heading || 0;

      // If no telemetry, place at origin port or anchor position
      if (lat === undefined || lng === undefined) {
        if (activeMovement?.voyage?.origin_port?.lat && activeMovement?.voyage?.origin_port?.lng) {
          lat = activeMovement.voyage.origin_port.lat;
          lng = activeMovement.voyage.origin_port.lng;
        } else {
          return;
        }
      }

      const isSelected = selectedVesselId === vessel.id || selectedMovement?.vessel_id === vessel.id;
      const isInTransit = activeMovement?.status === 'in_transit';
      const convoy = getVesselConvoy(vessel.id);
      const isConvoyMember = !!convoy;

      // Custom Ship Icon with heading orientation and convoy halo
      const vesselIconHtml = `
        <div class="relative flex items-center justify-center cursor-pointer transition-transform ${
          isSelected ? 'scale-125 z-40' : 'z-20'
        }">
          ${
            isConvoyMember
              ? `<div class="absolute -inset-1.5 rounded-full border-2 border-dashed border-cyan-400 bg-cyan-500/20 animate-spin-slow"></div>`
              : ''
          }
          <div class="w-8 h-8 rounded-full ${
            isInTransit
              ? 'bg-blue-600 border-2 border-sky-300 text-white shadow-lg shadow-blue-500/50'
              : 'bg-slate-800 border border-slate-600 text-slate-300'
          } flex items-center justify-center" style="transform: rotate(${heading}deg);">
            <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M2 21c.6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1 .6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1"/>
              <path d="M19.38 20A11.6 11.6 0 0 0 21 14l-9-4-9 4c0 2.9.94 5.34 2.81 7.76"/>
              <path d="M19 13V7a2 2 0 0 0-2-2H7a2 2 0 0 0-2 2v6"/>
              <path d="M12 10v4"/>
              <path d="M12 2v3"/>
            </svg>
          </div>
          ${
            isConvoyMember
              ? `<span class="absolute -top-2 -right-1 px-1 py-0.2 bg-cyan-500 text-[8px] font-bold text-slate-950 rounded-full">CONVOY</span>`
              : ''
          }
        </div>
      `;

      const customIcon = L.divIcon({
        html: vesselIconHtml,
        className: 'custom-vessel-marker',
        iconSize: [32, 32],
        iconAnchor: [16, 16],
      });

      const marker = L.marker([lat, lng], { icon: customIcon }).addTo(map);

      marker.bindPopup(`
        <div class="p-2.5 text-xs space-y-1.5 bg-slate-900 text-slate-100 rounded-md min-w-[200px]">
          <div class="flex items-center justify-between border-b border-slate-800 pb-1">
            <span class="font-bold text-sky-400">🚢 ${vessel.vessel_name}</span>
            <span class="px-1.5 py-0.5 rounded text-[10px] uppercase font-mono ${
              isInTransit ? 'bg-emerald-500/20 text-emerald-400' : 'bg-slate-800 text-slate-400'
            }">${vessel.status}</span>
          </div>
          <div class="text-slate-300">Type: <span class="text-slate-100">${vessel.vessel_type}</span></div>
          ${vessel.imo_number ? `<div class="text-slate-400 font-mono text-[11px]">IMO: ${vessel.imo_number}</div>` : ''}
          ${
            convoy
              ? `<div class="text-cyan-300 font-medium text-[11px]">🛡️ Convoy: ${convoy.name}</div>`
              : ''
          }
          ${
            activeMovement
              ? `
              <div class="pt-1 border-t border-slate-800/80 space-y-0.5">
                <div class="text-sky-300 font-medium">Voyage: ${activeMovement.voyage?.voyage_number || 'N/A'}</div>
                <div class="text-slate-400 text-[11px]">Speed: <span class="text-emerald-400 font-semibold">${speedKnots} kts</span> (${Math.round(speedKnots * 1.852)} km/h)</div>
                <div class="text-slate-400 text-[11px]">Route: ${activeMovement.voyage?.origin_port?.name || 'Origin'} → ${activeMovement.voyage?.destination_port?.name || 'Dest'}</div>
              </div>
            `
              : '<div class="text-slate-500 italic text-[11px]">Vessel idle in port</div>'
          }
        </div>
      `);

      if (activeMovement && onSelectMovement) {
        marker.on('click', () => onSelectMovement(activeMovement.id));
      }

      vesselMarkersRef.current.set(vessel.id, marker);
    });
  }, [vessels, movements, liveTelemetry, selectedVesselId, selectedMovement, convoys, onSelectMovement]);

  return (
    <div className="relative w-full h-full bg-slate-950 overflow-hidden">
      <div ref={mapContainerRef} className="w-full h-full z-0" />

      {/* Map Legend Overlay */}
      <div className="absolute top-4 right-4 z-10 bg-slate-900/90 backdrop-blur-md border border-slate-800 rounded-lg p-3 text-xs text-slate-300 space-y-2 shadow-xl pointer-events-auto">
        <div className="font-semibold text-slate-100 flex items-center gap-1.5 border-b border-slate-800 pb-1.5">
          <span className="w-2 h-2 rounded-full bg-sky-400"></span>
          Maritime Navigation Map
        </div>
        <div className="space-y-1.5 text-[11px]">
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-blue-600 border border-sky-300"></span>
            <span>Active Vessel (In-Transit)</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-cyan-950 border border-cyan-400"></span>
            <span>Coastal Port (UN/LOCODE)</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-4 h-0.5 bg-sky-400"></span>
            <span>Land-Avoiding Sea Route (searoute)</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full border-2 border-dashed border-cyan-400 bg-cyan-950/80"></span>
            <span>Digital Twin Ghost Position</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full border border-dashed border-cyan-400 bg-cyan-500/20"></span>
            <span>Convoy Group Member</span>
          </div>
        </div>
      </div>
    </div>
  );
};
