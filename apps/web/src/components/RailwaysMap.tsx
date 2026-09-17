import React, { useEffect, useRef } from 'react';
import { Station, Train, TrainMovement, GhostPositionPayload } from '@nexus-ways/shared';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { LiveRailTelemetryPayload } from '../services/socket';
import { Badge } from './ui/badge';
import { TrainFront } from 'lucide-react';

interface RailwaysMapProps {
  stations: Station[];
  trains: Train[];
  movements: TrainMovement[];
  selectedMovement: TrainMovement | null;
  selectedTrainId: string | null;
  liveTelemetry: Record<string, LiveRailTelemetryPayload>;
  ghostPositions?: Record<string, GhostPositionPayload>;
  onSelectMovement?: (movementId: string) => void;
  onSelectStation?: (stationId: string) => void;
}

export const RailwaysMap: React.FC<RailwaysMapProps> = ({
  stations,
  trains,
  movements,
  selectedMovement,
  selectedTrainId,
  liveTelemetry,
  ghostPositions = {},
  onSelectMovement,
  onSelectStation,
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const trainMarkersRef = useRef<Map<string, L.Marker>>(new Map());
  const ghostMarkersRef = useRef<Map<string, L.Marker>>(new Map());
  const stationMarkersRef = useRef<Map<string, L.Marker>>(new Map());
  const routeLayersRef = useRef<Map<string, L.Polyline>>(new Map());

  // 1. Initialize Leaflet Map with OpenRailwayMap Layer
  useEffect(() => {
    if (!mapContainerRef.current || mapInstanceRef.current) return;

    // Default center on India
    const map = L.map(mapContainerRef.current, {
      center: [19.076, 72.8777],
      zoom: 7,
      zoomControl: true,
    });

    // Dark base map layer (CartoDB Dark Matter)
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      attribution: '&copy; OpenStreetMap contributors &copy; CARTO',
      maxZoom: 19,
    }).addTo(map);

    // OpenRailwayMap overlay layer
    L.tileLayer('https://{s}.tiles.openrailwaymap.org/standard/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenRailwayMap &copy; OpenStreetMap contributors',
      maxZoom: 19,
      opacity: 0.85,
    }).addTo(map);

    mapInstanceRef.current = map;

    return () => {
      map.remove();
      mapInstanceRef.current = null;
    };
  }, []);

  // 2. Render Station Markers
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    // Clear old station markers
    stationMarkersRef.current.forEach((marker) => marker.remove());
    stationMarkersRef.current.clear();

    stations.forEach((st) => {
      if (st.lat === null || st.lng === null) return;

      const isJunction = st.station_type === 'junction';
      const isYard = st.station_type === 'yard';

      const iconHtml = `
        <div class="flex items-center justify-center w-7 h-7 rounded-full shadow-lg ${
          isJunction
            ? 'bg-amber-500/20 border-2 border-amber-400 text-amber-300'
            : isYard
            ? 'bg-blue-500/20 border-2 border-blue-400 text-blue-300'
            : 'bg-emerald-500/20 border-2 border-emerald-400 text-emerald-300'
        } backdrop-blur-md">
          <svg class="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/></svg>
        </div>
      `;

      const customIcon = L.divIcon({
        html: iconHtml,
        className: 'custom-station-icon',
        iconSize: [28, 28],
        iconAnchor: [14, 14],
      });

      const marker = L.marker([st.lat, st.lng], { icon: customIcon }).addTo(map);
      marker.bindPopup(`
        <div class="p-2 text-xs font-sans text-slate-900">
          <div class="font-bold text-sm text-slate-950">${st.name}</div>
          <div class="text-slate-600">Code: ${st.station_code || 'N/A'}</div>
          <div class="text-slate-500 capitalize">Type: ${st.station_type}</div>
        </div>
      `);

      if (onSelectStation) {
        marker.on('click', () => onSelectStation(st.id));
      }

      stationMarkersRef.current.set(st.id, marker);
    });
  }, [stations, onSelectStation]);

  // 3. Render Route Polylines
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    // Clear old route polylines
    routeLayersRef.current.forEach((layer) => layer.remove());
    routeLayersRef.current.clear();

    movements.forEach((mov) => {
      const geom = mov.route_geometry;
      if (!geom || !geom.coordinates || geom.coordinates.length < 2) return;

      const isSelected = selectedMovement?.id === mov.id;
      const latLngs = geom.coordinates.map((coord) => [coord[1], coord[0]] as [number, number]);

      const polyline = L.polyline(latLngs, {
        color: isSelected ? '#10b981' : mov.status === 'in_transit' ? '#3b82f6' : '#64748b',
        weight: isSelected ? 5 : 3.5,
        opacity: isSelected ? 0.95 : 0.65,
        dashArray: geom.routing_source === 'fallback-straight-line' ? '6, 6' : undefined,
      }).addTo(map);

      polyline.bindTooltip(
        `${mov.train?.train_number || 'Train'}: ${mov.origin_station?.name} → ${mov.destination_station?.name} (${geom.routing_source || 'overpass'})`,
        { sticky: true, className: 'bg-slate-900 text-white text-xs border border-slate-700 px-2 py-1 rounded' },
      );

      if (onSelectMovement) {
        polyline.on('click', () => onSelectMovement(mov.id));
      }

      routeLayersRef.current.set(mov.id, polyline);
    });

    // Auto-fit selected movement
    if (selectedMovement?.route_geometry?.coordinates?.length) {
      const latLngs = selectedMovement.route_geometry.coordinates.map(
        (c) => [c[1], c[0]] as [number, number],
      );
      map.fitBounds(L.latLngBounds(latLngs), { padding: [50, 50], maxZoom: 12 });
    }
  }, [movements, selectedMovement, onSelectMovement]);

  // 4. Render Digital Twin Ghost Train Markers
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    // Clear old ghost markers
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
            width: 28px;
            height: 28px;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            color: #06b6d4;
            box-shadow: 0 0 12px rgba(6, 182, 212, 0.4);
            animation: pulse 2s infinite;
          ">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2c-4 0-8 .5-8 4v9.5C4 17.43 5.57 19 7.5 19L6 20.5v.5h12v-.5L16.5 19c1.93 0 3.5-1.57 3.5-3.5V6c0-3.5-4-4-8-4z"/>
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
        className: 'custom-ghost-marker',
        iconSize: [80, 50],
        iconAnchor: [40, 25],
      });

      const marker = L.marker([ghost.ghostLat, ghost.ghostLng], { icon: customGhostIcon }).addTo(map);
      marker.bindPopup(`
        <div class="p-2 text-xs font-sans text-slate-900">
          <div class="font-bold text-sm text-cyan-700">Digital Twin (Ghost Projection)</div>
          <div class="text-slate-600">Ideal Timetable Position</div>
          <div class="font-semibold mt-1" style="color: ${statusColor}">
            Status: ${ghost.status.toUpperCase()} (${ghost.deviationMinutes} min deviation)
          </div>
        </div>
      `);

      ghostMarkersRef.current.set(ghost.tripId, marker);
    });
  }, [ghostPositions]);

  // 5. Render and Update Live Real Train Markers
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    movements.forEach((mov) => {
      const live = liveTelemetry[mov.id];
      let lat = live?.lat;
      let lng = live?.lng;
      const speed = live?.speedKmh ?? (mov.status === 'in_transit' ? 75 : 0);

      // If no live telemetry yet, use origin station coordinates
      if (lat === undefined || lng === undefined) {
        if (mov.status === 'completed' && mov.destination_station?.lat) {
          lat = mov.destination_station.lat;
          lng = mov.destination_station.lng!;
        } else if (mov.origin_station?.lat) {
          lat = mov.origin_station.lat;
          lng = mov.origin_station.lng!;
        } else {
          return;
        }
      }

      const isSelected = selectedMovement?.id === mov.id || selectedTrainId === mov.train_id;

      const trainIconHtml = `
        <div class="relative flex flex-col items-center">
          <div class="flex items-center justify-center w-8 h-8 rounded-full shadow-xl ${
            mov.status === 'in_transit'
              ? 'bg-blue-600 border-2 border-blue-300 text-white animate-pulse'
              : mov.status === 'completed'
              ? 'bg-emerald-600 border-2 border-emerald-300 text-white'
              : 'bg-slate-800 border-2 border-slate-600 text-slate-300'
          }">
            <svg class="w-4 h-4 fill-current" viewBox="0 0 24 24">
              <path d="M12 2c-4 0-8 .5-8 4v9.5C4 17.43 5.57 19 7.5 19L6 20.5v.5h12v-.5L16.5 19c1.93 0 3.5-1.57 3.5-3.5V6c0-3.5-4-4-8-4zM7.5 17c-.83 0-1.5-.67-1.5-1.5S6.67 14 7.5 14s1.5.67 1.5 1.5S8.33 17 7.5 17zm9 0c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zm1.5-6H6V6h12v5z"/>
            </svg>
          </div>
          <div class="mt-1 px-1.5 py-0.5 rounded text-[10px] font-bold tracking-wider uppercase shadow-md ${
            isSelected ? 'bg-emerald-500 text-slate-950 font-extrabold' : 'bg-slate-900/90 text-white border border-slate-700'
          }">
            ${mov.train?.train_number || 'Train'} • ${speed} km/h
          </div>
        </div>
      `;

      const customIcon = L.divIcon({
        html: trainIconHtml,
        className: 'custom-train-marker',
        iconSize: [80, 50],
        iconAnchor: [40, 25],
      });

      let marker = trainMarkersRef.current.get(mov.id);
      if (marker) {
        marker.setLatLng([lat, lng]);
        marker.setIcon(customIcon);
      } else {
        marker = L.marker([lat, lng], { icon: customIcon }).addTo(map);
        if (onSelectMovement) {
          marker.on('click', () => onSelectMovement(mov.id));
        }
        trainMarkersRef.current.set(mov.id, marker);
      }
    });

    // Cleanup markers for removed movements
    trainMarkersRef.current.forEach((marker, movId) => {
      if (!movements.some((m) => m.id === movId)) {
        marker.remove();
        trainMarkersRef.current.delete(movId);
      }
    });
  }, [movements, liveTelemetry, selectedMovement, selectedTrainId, onSelectMovement]);

  return (
    <div className="relative w-full h-full bg-slate-950">
      <div ref={mapContainerRef} className="w-full h-full z-0" />

      {/* Map Overlay Badges & Controls */}
      <div className="absolute top-4 right-4 z-10 flex flex-col gap-2 pointer-events-none">
        <div className="bg-slate-900/90 border border-slate-800 backdrop-blur-md px-3 py-2 rounded-lg shadow-xl pointer-events-auto flex items-center gap-3 text-xs">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping" />
            <span className="font-semibold text-white">OpenRailwayMap Real Track Overlay</span>
          </div>
          <Badge variant="outline" className="text-[10px] bg-slate-950 border-slate-700 text-slate-300">
            Active
          </Badge>
        </div>

        {selectedMovement && (
          <div className="bg-slate-900/90 border border-slate-800 backdrop-blur-md p-3 rounded-lg shadow-xl pointer-events-auto text-xs space-y-1.5 max-w-xs">
            <div className="flex items-center justify-between">
              <span className="font-bold text-white flex items-center gap-1.5">
                <TrainFront className="w-4 h-4 text-emerald-400" />
                {selectedMovement.train?.train_number}
              </span>
              <Badge
                variant="outline"
                className={
                  selectedMovement.route_geometry?.routing_source === 'overpass'
                    ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                    : 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                }
              >
                {selectedMovement.route_geometry?.routing_source || 'overpass'}
              </Badge>
            </div>
            <p className="text-slate-400 text-[11px]">
              {selectedMovement.origin_station?.name} → {selectedMovement.destination_station?.name}
            </p>
            <div className="flex items-center justify-between text-slate-400 text-[11px] pt-1 border-t border-slate-800">
              <span>{selectedMovement.distance_km} km</span>
              <span>{selectedMovement.duration_minutes} min</span>
              <span className="text-emerald-400 font-medium">
                {liveTelemetry[selectedMovement.id]?.speedKmh ?? 75} km/h
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
