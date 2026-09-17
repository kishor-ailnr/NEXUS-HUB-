import React, { useEffect, useRef } from 'react';
import { Airport, Aircraft, FlightMovement, LiveFlightTelemetryPayload, GhostPositionPayload } from '@nexus-ways/shared';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Plane } from 'lucide-react';

interface AirwaysMapProps {
  airports: Airport[];
  aircraft: Aircraft[];
  movements: FlightMovement[];
  selectedMovement: FlightMovement | null;
  selectedAircraftId: string | null;
  liveTelemetry: Record<string, LiveFlightTelemetryPayload>;
  ghostPositions?: Record<string, GhostPositionPayload>;
  onSelectMovement?: (movementId: string) => void;
  onSelectAirport?: (airportId: string) => void;
}

/**
 * Spherical interpolation for rendering smooth great-circle curves on Leaflet
 */
function getGreatCirclePoints(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
  numPoints = 60,
): [number, number][] {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const toDeg = (rad: number) => (rad * 180) / Math.PI;

  const phi1 = toRad(lat1);
  const lambda1 = toRad(lon1);
  const phi2 = toRad(lat2);
  const lambda2 = toRad(lon2);

  const deltaLambda = lambda2 - lambda1;
  const deltaPhi = phi2 - phi1;
  const a =
    Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
    Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
  const d = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  if (d < 1e-6) return [[lat1, lon1], [lat2, lon2]];

  const points: [number, number][] = [];
  for (let i = 0; i <= numPoints; i++) {
    const f = i / numPoints;
    const A = Math.sin((1 - f) * d) / Math.sin(d);
    const B = Math.sin(f * d) / Math.sin(d);

    const x = A * Math.cos(phi1) * Math.cos(lambda1) + B * Math.cos(phi2) * Math.cos(lambda2);
    const y = A * Math.cos(phi1) * Math.sin(lambda1) + B * Math.cos(phi2) * Math.sin(lambda2);
    const z = A * Math.sin(phi1) + B * Math.sin(phi2);

    const lat = toDeg(Math.atan2(z, Math.sqrt(x * x + y * y)));
    const lon = toDeg(Math.atan2(y, x));

    points.push([lat, lon]);
  }

  return points;
}

export const AirwaysMap: React.FC<AirwaysMapProps> = ({
  airports,
  aircraft,
  movements,
  selectedMovement,
  selectedAircraftId,
  liveTelemetry,
  ghostPositions = {},
  onSelectMovement,
  onSelectAirport,
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const aircraftMarkersRef = useRef<Map<string, L.Marker>>(new Map());
  const ghostMarkersRef = useRef<Map<string, L.Marker>>(new Map());
  const airportMarkersRef = useRef<Map<string, L.Marker>>(new Map());
  const routeLayersRef = useRef<Map<string, L.Polyline>>(new Map());

  // 1. Initialize Leaflet Map
  useEffect(() => {
    if (!mapContainerRef.current || mapInstanceRef.current) return;

    // Center on India (20.5937° N, 78.9629° E)
    const map = L.map(mapContainerRef.current, {
      center: [20.5937, 78.9629],
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

  // 2. Render Airport Markers
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    airportMarkersRef.current.forEach((marker) => marker.remove());
    airportMarkersRef.current.clear();

    airports.forEach((ap) => {
      if (ap.lat === null || ap.lng === null) return;

      const iconHtml = `
        <div class="flex items-center justify-center w-8 h-8 rounded-full shadow-lg bg-sky-500/20 border-2 border-sky-400 text-sky-300 backdrop-blur-md cursor-pointer hover:scale-110 transition-transform">
          <svg class="w-4 h-4 fill-current" viewBox="0 0 24 24"><path d="M21 16v-2l-8-5V3.5c0-.83-.67-1.5-1.5-1.5S10 2.67 10 3.5V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5l8 2.5z"/></svg>
        </div>
      `;

      const customIcon = L.divIcon({
        html: iconHtml,
        className: 'custom-airport-icon',
        iconSize: [32, 32],
        iconAnchor: [16, 16],
      });

      const marker = L.marker([ap.lat, ap.lng], { icon: customIcon }).addTo(map);

      marker.bindPopup(`
        <div class="p-2 space-y-1 text-slate-900">
          <div class="font-bold text-xs text-sky-700">${ap.name}</div>
          <div class="text-[11px] font-mono text-slate-600">IATA: ${ap.iata_code || 'N/A'} | ICAO: ${ap.icao_code || 'N/A'}</div>
          <div class="text-[10px] text-slate-500">Lat: ${ap.lat.toFixed(4)}, Lng: ${ap.lng.toFixed(4)}</div>
        </div>
      `);

      if (onSelectAirport) {
        marker.on('click', () => onSelectAirport(ap.id));
      }

      airportMarkersRef.current.set(ap.id, marker);
    });
  }, [airports, onSelectAirport]);

  // 3. Render Great-Circle Route Polylines
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    routeLayersRef.current.forEach((layer) => layer.remove());
    routeLayersRef.current.clear();

    movements.forEach((movement) => {
      const origin = movement.flight?.origin_airport;
      const dest = movement.flight?.destination_airport;
      if (!origin || !dest || origin.lat === null || origin.lng === null || dest.lat === null || dest.lng === null) {
        return;
      }

      const isSelected = selectedMovement?.id === movement.id;
      const isTransit = movement.status === 'in_transit';

      // Compute smooth great-circle curved arc
      const latlngs = getGreatCirclePoints(origin.lat, origin.lng, dest.lat, dest.lng, 60);

      const polyline = L.polyline(latlngs, {
        color: isSelected ? '#38bdf8' : isTransit ? '#0284c7' : '#64748b',
        weight: isSelected ? 4 : isTransit ? 3 : 2,
        opacity: isSelected ? 0.9 : isTransit ? 0.75 : 0.4,
        dashArray: isTransit ? '6, 6' : undefined,
      }).addTo(map);

      if (onSelectMovement) {
        polyline.on('click', () => onSelectMovement(movement.id));
      }

      routeLayersRef.current.set(movement.id, polyline);
    });
  }, [movements, selectedMovement, onSelectMovement]);

  // 4. Render Digital Twin Ghost Flight Markers
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    ghostMarkersRef.current.forEach((m) => m.remove());
    ghostMarkersRef.current.clear();

    Object.values(ghostPositions).forEach((ghost) => {
      if (!ghost.ghostLat || !ghost.ghostLng) return;

      const isBehind = ghost.status === 'behind';
      const isAhead = ghost.status === 'ahead';
      const statusColor = isBehind ? '#f43f5e' : isAhead ? '#06b6d4' : '#10b981';

      const ghostIconHtml = `
        <div class="relative flex flex-col items-center">
          <div style="
            position: relative;
            background: rgba(6, 182, 212, 0.25);
            border: 2px dashed ${statusColor};
            width: 32px;
            height: 32px;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            color: #06b6d4;
            box-shadow: 0 0 14px rgba(6, 182, 212, 0.45);
            animation: pulse 2s infinite;
          ">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
              <path d="M21 16v-2l-8-5V3.5c0-.83-.67-1.5-1.5-1.5S10 2.67 10 3.5V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5l8 2.5z"/>
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
        className: 'custom-airways-ghost-marker',
        iconSize: [90, 55],
        iconAnchor: [45, 27],
      });

      const marker = L.marker([ghost.ghostLat, ghost.ghostLng], { icon: customGhostIcon }).addTo(map);
      marker.bindPopup(`
        <div class="p-2 text-xs font-sans text-slate-900">
          <div class="font-bold text-sm text-cyan-700">Digital Twin (Ghost Flight)</div>
          <div class="text-slate-600">Scheduled Flight Plan Position</div>
          <div class="font-semibold mt-1" style="color: ${statusColor}">
            Status: ${ghost.status.toUpperCase()} (${ghost.deviationMinutes} min deviation)
          </div>
        </div>
      `);

      ghostMarkersRef.current.set(ghost.tripId, marker);
    });
  }, [ghostPositions]);

  // 5. Render Aircraft Markers & Live Telemetry
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    const currentMovementIds = new Set<string>();

    movements.forEach((movement) => {
      const telemetry = liveTelemetry[movement.id];
      const isSelected = selectedMovement?.id === movement.id;
      const isTransit = movement.status === 'in_transit';

      let lat = telemetry?.lat;
      let lng = telemetry?.lng;
      let altitudeFt = telemetry?.altitudeFt ?? 0;
      let speedKts = telemetry?.speedKts ?? 0;
      let heading = telemetry?.heading ?? 0;

      // If no live telemetry yet, default to origin airport
      if (lat === undefined || lng === undefined) {
        if (movement.flight?.origin_airport?.lat && movement.flight?.origin_airport?.lng) {
          lat = movement.flight.origin_airport.lat;
          lng = movement.flight.origin_airport.lng;
        } else {
          return;
        }
      }

      currentMovementIds.add(movement.id);

      const iconHtml = `
        <div class="relative flex items-center justify-center w-9 h-9 rounded-full shadow-2xl ${
          isSelected
            ? 'bg-sky-400 text-slate-950 ring-4 ring-sky-400/40 scale-125'
            : isTransit
            ? 'bg-sky-600 text-white animate-pulse ring-2 ring-sky-400/50'
            : 'bg-slate-800 text-slate-300 border border-slate-600'
        } transition-all duration-300">
          <div style="transform: rotate(${heading - 45}deg);" class="transition-transform duration-500">
            <svg class="w-5 h-5 fill-current" viewBox="0 0 24 24"><path d="M21 16v-2l-8-5V3.5c0-.83-.67-1.5-1.5-1.5S10 2.67 10 3.5V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5l8 2.5z"/></svg>
          </div>
          ${
            isTransit
              ? `<div class="absolute -bottom-1 -right-1 w-2.5 h-2.5 rounded-full bg-emerald-400 border border-slate-900"></div>`
              : ''
          }
        </div>
      `;

      const customIcon = L.divIcon({
        html: iconHtml,
        className: 'custom-aircraft-icon',
        iconSize: [36, 36],
        iconAnchor: [18, 18],
      });

      let marker = aircraftMarkersRef.current.get(movement.id);

      if (!marker) {
        marker = L.marker([lat, lng], { icon: customIcon }).addTo(map);
        if (onSelectMovement) {
          marker.on('click', () => onSelectMovement(movement.id));
        }
        aircraftMarkersRef.current.set(movement.id, marker);
      } else {
        marker.setLatLng([lat, lng]);
        marker.setIcon(customIcon);
      }

      marker.bindPopup(`
        <div class="p-2.5 space-y-1.5 text-slate-900 min-w-[200px]">
          <div class="flex items-center justify-between border-b pb-1 border-slate-200">
            <span class="font-bold text-xs text-sky-700">${movement.flight?.flight_number || 'Flight'}</span>
            <span class="text-[10px] font-mono px-1.5 py-0.5 rounded bg-sky-100 text-sky-800 font-semibold uppercase">${movement.status}</span>
          </div>
          <div class="text-[11px] font-medium text-slate-800">
            Tail: <span class="font-mono">${movement.aircraft?.tail_number || 'N/A'}</span> (${movement.aircraft?.aircraft_type || 'Cargo'})
          </div>
          <div class="text-[11px] text-slate-600">
            Pilot: <span class="font-medium text-slate-800">${movement.pilot?.user?.full_name || 'N/A'}</span>
          </div>
          <div class="text-[10px] text-slate-600">
            Route: ${movement.flight?.origin_airport?.name} &rarr; ${movement.flight?.destination_airport?.name}
          </div>
          ${
            isTransit
              ? `
              <div class="pt-1.5 border-t border-slate-200 grid grid-cols-2 gap-1 text-[10px] text-slate-700 font-mono">
                <div>Altitude: <span class="font-bold text-sky-700">${altitudeFt.toLocaleString()} ft</span></div>
                <div>Speed: <span class="font-bold text-sky-700">${speedKts} kts</span></div>
                <div>Heading: <span class="font-bold text-slate-800">${heading}°</span></div>
                <div>Progress: <span class="font-bold text-emerald-600">${telemetry?.progressPercent ?? 0}%</span></div>
              </div>
            `
              : ''
          }
        </div>
      `);
    });

    // Cleanup unneeded markers
    aircraftMarkersRef.current.forEach((marker, movementId) => {
      if (!currentMovementIds.has(movementId)) {
        marker.remove();
        aircraftMarkersRef.current.delete(movementId);
      }
    });
  }, [movements, liveTelemetry, selectedMovement, onSelectMovement]);

  // 6. Pan to selected flight movement
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !selectedMovement) return;

    const telemetry = liveTelemetry[selectedMovement.id];
    let lat: number | undefined = telemetry?.lat;
    let lng: number | undefined = telemetry?.lng;

    if (lat === undefined || lng === undefined) {
      const origLat = selectedMovement.flight?.origin_airport?.lat;
      const origLng = selectedMovement.flight?.origin_airport?.lng;
      if (origLat != null) lat = origLat;
      if (origLng != null) lng = origLng;
    }

    if (lat !== undefined && lng !== undefined) {
      map.flyTo([lat, lng], 8, { duration: 1.2 });
    }
  }, [selectedMovement, liveTelemetry]);

  return (
    <div className="relative w-full h-full" data-testid="airways-map">
      <div ref={mapContainerRef} className="w-full h-full z-0" />
      <div className="absolute top-4 right-4 z-10 bg-card/85 backdrop-blur-md px-3 py-1.5 rounded-md border border-border text-xs flex items-center gap-2 shadow-lg">
        <Plane className="h-4 w-4 text-sky-400" />
        <span className="font-medium text-foreground">Airways Live Radar</span>
        <span className="text-[10px] text-muted-foreground font-mono">(Great-Circle & Digital Twin)</span>
      </div>
    </div>
  );
};
