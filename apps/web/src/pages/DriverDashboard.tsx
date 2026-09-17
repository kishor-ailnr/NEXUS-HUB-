import React, { useEffect, useState, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Vehicle,
  Trip,
  OrgMode,
  Train,
  TrainMovement,
  Aircraft,
  FlightMovement,
  Vessel,
  VoyageMovement,
} from '@nexus-ways/shared';
import { useAuthStore } from '../store/authStore';
import { vehiclesService } from '../services/vehicles';
import { tripsService } from '../services/trips';
import { railwaysService } from '../services/railways';
import { airwaysService } from '../services/airways';
import { seawaysService } from '../services/seaways';
import {
  socketService,
  LiveGpsPayload,
  LiveRailTelemetryPayload,
  LiveFlightTelemetryPayload,
  LiveVesselTelemetryPayload,
} from '../services/socket';
import { Button } from '../components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import {
  Truck,
  TrainFront,
  Plane,
  Ship,
  Anchor,
  LogOut,
  MapPin,
  Navigation,
  Radio,
  Clock,
  CheckCircle2,
  AlertTriangle,
  User,
  ShieldCheck,
  Home,
  Zap,
  Layers,
  Compass,
  Gauge,
  ArrowUpRight,
} from 'lucide-react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { toast } from 'sonner';

export const DriverDashboard: React.FC = () => {
  const { mode } = useParams<{ mode: string }>();
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();

  const currentMode = (mode || user?.organization?.mode || 'roadways') as OrgMode;
  const isRailways = currentMode === 'railways';
  const isAirways = currentMode === 'airways';
  const isSeaways = currentMode === 'seaways';

  // Roadways State
  const [assignedVehicle, setAssignedVehicle] = useState<Vehicle | null>(null);
  const [activeTrip, setActiveTrip] = useState<Trip | null>(null);
  const [liveGps, setLiveGps] = useState<LiveGpsPayload | null>(null);

  // Railways State
  const [assignedTrain, setAssignedTrain] = useState<Train | null>(null);
  const [activeMovement, setActiveMovement] = useState<TrainMovement | null>(null);
  const [liveRail, setLiveRail] = useState<LiveRailTelemetryPayload | null>(null);

  // Airways State
  const [assignedAircraft, setAssignedAircraft] = useState<Aircraft | null>(null);
  const [activeFlightMovement, setActiveFlightMovement] = useState<FlightMovement | null>(null);
  const [liveFlight, setLiveFlight] = useState<LiveFlightTelemetryPayload | null>(null);

  // Seaways State
  const [assignedVessel, setAssignedVessel] = useState<Vessel | null>(null);
  const [activeVoyageMovement, setActiveVoyageMovement] = useState<VoyageMovement | null>(null);
  const [liveSea, setLiveSea] = useState<LiveVesselTelemetryPayload | null>(null);

  const [isLoading, setIsLoading] = useState(true);

  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);
  const routeLayerRef = useRef<L.Polyline | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function loadDriverData() {
      try {
        setIsLoading(true);

        if (isSeaways) {
          const [vessels, movements] = await Promise.all([
            seawaysService.getVessels().catch(() => []),
            seawaysService.getMovements().catch(() => []),
          ]);

          if (!isMounted) return;

          // Find active voyage for this master/crew
          const myMovement =
            movements.find(
              (m) =>
                m.master?.user?.id === user?.id ||
                m.master?.user_id === user?.id,
            ) ||
            movements.find((m) => m.status === 'in_transit' || m.status === 'planned') ||
            movements[0] ||
            null;

          setActiveVoyageMovement(myMovement);

          if (myMovement) {
            setAssignedVessel(myMovement.vessel || null);
          } else if (vessels.length > 0) {
            setAssignedVessel(vessels[0]);
          }
        } else if (isAirways) {
          const [aircraftList, movements] = await Promise.all([
            airwaysService.getAircraft().catch(() => []),
            airwaysService.getMovements().catch(() => []),
          ]);

          if (!isMounted) return;

          // Find active flight for this pilot
          const myFlight =
            movements.find(
              (m) =>
                m.pilot?.user?.id === user?.id ||
                m.pilot?.user_id === user?.id,
            ) ||
            movements.find((m) => m.status === 'in_transit' || m.status === 'planned') ||
            movements[0] ||
            null;

          setActiveFlightMovement(myFlight);

          if (myFlight) {
            setAssignedAircraft(myFlight.aircraft || null);
          } else if (aircraftList.length > 0) {
            setAssignedAircraft(aircraftList[0]);
          }
        } else if (isRailways) {
          const [trains, movements] = await Promise.all([
            railwaysService.getTrains().catch(() => []),
            railwaysService.getMovements().catch(() => []),
          ]);

          if (!isMounted) return;

          // Find active movement for this loco pilot
          const myMovement =
            movements.find(
              (m) =>
                m.loco_pilot?.user?.id === user?.id ||
                m.loco_pilot?.user_id === user?.id,
            ) ||
            movements.find((m) => m.status === 'in_transit' || m.status === 'planned') ||
            movements[0] ||
            null;

          setActiveMovement(myMovement);

          if (myMovement) {
            setAssignedTrain(myMovement.train || null);
          } else if (trains.length > 0) {
            setAssignedTrain(trains[0]);
          }
        } else {
          // Roadways
          const [vehicles, trips] = await Promise.all([
            vehiclesService.getVehicles().catch(() => []),
            tripsService.getTrips().catch(() => []),
          ]);

          if (!isMounted) return;

          const myVehicle =
            vehicles.find(
              (v) => v.driver?.user?.id === user?.id || v.assigned_driver_id === user?.id,
            ) ||
            vehicles[0] ||
            null;

          setAssignedVehicle(myVehicle);

          if (myVehicle) {
            const trip = trips.find(
              (t) =>
                t.vehicle_id === myVehicle.id &&
                (t.status === 'in_transit' || t.status === 'planned'),
            );
            setActiveTrip(trip || null);
            if (myVehicle.latest_gps) {
              setLiveGps({
                tripId: trip?.id || '',
                vehicleId: myVehicle.id,
                driverId: user?.id || '',
                lat: myVehicle.latest_gps.lat,
                lng: myVehicle.latest_gps.lng,
                speed_kmh: Number(myVehicle.latest_gps.speed_kmh || 0),
                heading: myVehicle.latest_gps.heading || 0,
                recorded_at: myVehicle.latest_gps.recorded_at,
              });
            }
          }
        }
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }

    loadDriverData();

    // Connect to WebSocket for live telemetry
    socketService.connect(
      undefined,
      undefined,
      (gps) => {
        if (assignedVehicle && gps.vehicleId === assignedVehicle.id) {
          setLiveGps(gps);
        }
      },
      (status) => {
        if (assignedVehicle && status.vehicleId === assignedVehicle.id) {
          if (status.status === 'completed') {
            toast.success('Your trip has arrived at its destination!');
            setActiveTrip((prev) => (prev ? { ...prev, status: 'completed' } : null));
          }
        }
      },
    );

    if (isRailways) {
      socketService.onRailTelemetry((telemetry) => {
        if (activeMovement && telemetry.movementId === activeMovement.id) {
          setLiveRail(telemetry);
        }
      });

      socketService.onRailCompleted((completed) => {
        if (activeMovement && completed.movementId === activeMovement.id) {
          toast.success('Your train movement has completed destination arrival.');
          setActiveMovement((prev) => (prev ? { ...prev, status: 'completed' } : null));
        }
      });
    }

    if (isAirways) {
      socketService.onFlightTelemetry((telemetry) => {
        if (activeFlightMovement && telemetry.movementId === activeFlightMovement.id) {
          setLiveFlight(telemetry);
        }
      });

      socketService.onFlightCompleted((completed) => {
        if (activeFlightMovement && completed.movementId === activeFlightMovement.id) {
          toast.success('Your flight movement has touched down and completed.');
          setActiveFlightMovement((prev) => (prev ? { ...prev, status: 'completed' } : null));
        }
      });
    }

    if (isSeaways) {
      const handleSeaTel = (telemetry: LiveVesselTelemetryPayload) => {
        if (activeVoyageMovement && telemetry.movementId === activeVoyageMovement.id) {
          setLiveSea(telemetry);
        }
      };
      socketService.onSeaTelemetry(handleSeaTel);
    }

    return () => {
      isMounted = false;
      socketService.disconnect();
    };
  }, [user, isRailways, isAirways, isSeaways, assignedVehicle?.id, activeMovement?.id, activeFlightMovement?.id, activeVoyageMovement?.id]);

  // Leaflet Map for Console
  useEffect(() => {
    if (!mapContainerRef.current) return;

    if (!mapInstanceRef.current) {
      const defaultCenter: [number, number] = [15.0, 78.0];
      const map = L.map(mapContainerRef.current, {
        center: defaultCenter,
        zoom: isAirways || isSeaways ? 5 : 11,
        zoomControl: false,
      });

      // Dark base tiles
      L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; OpenStreetMap contributors &copy; CARTO',
        maxZoom: 19,
      }).addTo(map);

      // OpenRailwayMap overlay for Railways
      if (isRailways) {
        L.tileLayer('https://{s}.tiles.openrailwaymap.org/standard/{z}/{x}/{y}.png', {
          attribution: '&copy; OpenRailwayMap',
          maxZoom: 19,
          opacity: 0.85,
        }).addTo(map);
      }

      mapInstanceRef.current = map;
    }

    const map = mapInstanceRef.current;

    if (isSeaways) {
      // Seaways Map Display
      const originPort = activeVoyageMovement?.voyage?.origin_port;
      const destPort = activeVoyageMovement?.voyage?.destination_port;
      const currentLat = liveSea?.lat || originPort?.lat || undefined;
      const currentLng = liveSea?.lng || originPort?.lng || undefined;
      const heading = liveSea?.heading ?? 0;

      if (currentLat !== undefined && currentLng !== undefined) {
        map.setView([currentLat, currentLng], map.getZoom() || 6);

        const shipIcon = L.divIcon({
          html: `
            <div class="relative flex items-center justify-center w-8 h-8 rounded-full bg-blue-600 border-2 border-sky-300 shadow-xl text-white" style="transform: rotate(${heading}deg);">
              <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">
                <path d="M2 21c.6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1 .6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1"/>
                <path d="M19.38 20A11.6 11.6 0 0 0 21 14l-9-4-9 4c0 2.9.94 5.34 2.81 7.76"/>
                <path d="M19 13V7a2 2 0 0 0-2-2H7a2 2 0 0 0-2 2v6"/>
                <path d="M12 10v4"/>
                <path d="M12 2v3"/>
              </svg>
            </div>
          `,
          className: 'bridge-ship-marker',
          iconSize: [32, 32],
          iconAnchor: [16, 16],
        });

        if (markerRef.current) {
          markerRef.current.setLatLng([currentLat, currentLng]);
          markerRef.current.setIcon(shipIcon);
        } else {
          markerRef.current = L.marker([currentLat, currentLng], { icon: shipIcon }).addTo(map);
        }
      }

      if (activeVoyageMovement?.route_geometry?.coordinates?.length) {
        if (routeLayerRef.current) {
          routeLayerRef.current.remove();
        }
        const latLngs = activeVoyageMovement.route_geometry.coordinates.map(
          (c) => [c[1], c[0]] as [number, number],
        );
        routeLayerRef.current = L.polyline(latLngs, {
          color: '#38bdf8',
          weight: 4,
          opacity: 0.9,
        }).addTo(map);
      }
    } else if (isAirways) {
      // Airways Map Display
      const originAirport = activeFlightMovement?.flight?.origin_airport;
      const destAirport = activeFlightMovement?.flight?.destination_airport;
      const currentLat = liveFlight?.lat || originAirport?.lat || undefined;
      const currentLng = liveFlight?.lng || originAirport?.lng || undefined;
      const heading = liveFlight?.heading ?? 0;

      if (currentLat !== undefined && currentLng !== undefined) {
        map.setView([currentLat, currentLng], map.getZoom() || 6);

        const planeIcon = L.divIcon({
          html: `
            <div class="relative flex items-center justify-center w-8 h-8 rounded-full bg-cyan-600/90 border-2 border-white shadow-xl text-white" style="transform: rotate(${heading}deg);">
              <svg class="w-4 h-4 fill-current" viewBox="0 0 24 24"><path d="M21 16v-2l-8-5V3.5c0-.83-.67-1.5-1.5-1.5S10 2.67 10 3.5V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5l8 2.5z"/></svg>
            </div>
          `,
          className: 'pilot-plane-marker',
          iconSize: [32, 32],
          iconAnchor: [16, 16],
        });

        if (markerRef.current) {
          markerRef.current.setLatLng([currentLat, currentLng]);
          markerRef.current.setIcon(planeIcon);
        } else {
          markerRef.current = L.marker([currentLat, currentLng], { icon: planeIcon }).addTo(map);
        }
      }

      if (
        originAirport?.lat != null &&
        originAirport?.lng != null &&
        destAirport?.lat != null &&
        destAirport?.lng != null
      ) {
        if (routeLayerRef.current) {
          routeLayerRef.current.remove();
        }
        const arcPoints: [number, number][] = [];
        const numPoints = 25;
        const d2r = Math.PI / 180;
        const r2d = 180 / Math.PI;
        const φ1 = originAirport.lat * d2r;
        const λ1 = originAirport.lng * d2r;
        const φ2 = destAirport.lat * d2r;
        const λ2 = destAirport.lng * d2r;
        const sinΔφ2 = Math.sin((φ2 - φ1) / 2);
        const sinΔλ2 = Math.sin((λ2 - λ1) / 2);
        const a = sinΔφ2 * sinΔφ2 + Math.cos(φ1) * Math.cos(φ2) * sinΔλ2 * sinΔλ2;
        const δ = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

        if (δ > 0.0001) {
          for (let i = 0; i <= numPoints; i++) {
            const f = i / numPoints;
            const A = Math.sin((1 - f) * δ) / Math.sin(δ);
            const B = Math.sin(f * δ) / Math.sin(δ);
            const x = A * Math.cos(φ1) * Math.cos(λ1) + B * Math.cos(φ2) * Math.cos(λ2);
            const y = A * Math.cos(φ1) * Math.sin(λ1) + B * Math.cos(φ2) * Math.sin(λ2);
            const z = A * Math.sin(φ1) + B * Math.sin(φ2);
            const lat = Math.atan2(z, Math.sqrt(x * x + y * y)) * r2d;
            const lng = Math.atan2(y, x) * r2d;
            arcPoints.push([lat, lng]);
          }
        } else {
          arcPoints.push([originAirport.lat, originAirport.lng], [destAirport.lat, destAirport.lng]);
        }

        routeLayerRef.current = L.polyline(arcPoints, {
          color: '#06b6d4',
          weight: 4,
          opacity: 0.85,
          dashArray: '6, 6',
        }).addTo(map);
      }
    } else if (isRailways) {
      // Railways Map Display
      const currentLat = liveRail?.lat || activeMovement?.origin_station?.lat;
      const currentLng = liveRail?.lng || activeMovement?.origin_station?.lng;

      if (currentLat && currentLng) {
        map.setView([currentLat, currentLng], map.getZoom() || 11);

        const customIcon = L.divIcon({
          html: `
            <div class="flex items-center justify-center w-8 h-8 rounded-full bg-emerald-600 border-2 border-white shadow-xl text-white animate-pulse">
              <svg class="w-4 h-4 fill-current" viewBox="0 0 24 24"><path d="M12 2c-4 0-8 .5-8 4v9.5C4 17.43 5.57 19 7.5 19L6 20.5v.5h12v-.5L16.5 19c1.93 0 3.5-1.57 3.5-3.5V6c0-3.5-4-4-8-4zM7.5 17c-.83 0-1.5-.67-1.5-1.5S6.67 14 7.5 14s1.5.67 1.5 1.5S8.33 17 7.5 17zm9 0c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zm1.5-6H6V6h12v5z"/></svg>
            </div>
          `,
          className: 'pilot-marker',
          iconSize: [32, 32],
          iconAnchor: [16, 16],
        });

        if (markerRef.current) {
          markerRef.current.setLatLng([currentLat, currentLng]);
        } else {
          markerRef.current = L.marker([currentLat, currentLng], { icon: customIcon }).addTo(map);
        }
      }

      if (activeMovement?.route_geometry?.coordinates?.length) {
        if (routeLayerRef.current) {
          routeLayerRef.current.remove();
        }
        const latLngs = activeMovement.route_geometry.coordinates.map(
          (c) => [c[1], c[0]] as [number, number],
        );
        routeLayerRef.current = L.polyline(latLngs, {
          color: '#10b981',
          weight: 4,
          opacity: 0.85,
        }).addTo(map);
      }
    } else {
      // Roadways Map Display
      if (liveGps) {
        const { lat, lng } = liveGps;
        map.setView([lat, lng], map.getZoom() || 12);

        const customIcon = L.divIcon({
          html: `
            <div class="flex items-center justify-center w-7 h-7 rounded-full bg-status-informational border-2 border-white shadow-xl text-white">
              <svg class="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24"><path d="M18.92 6.01C18.72 5.42 18.16 5 17.5 5h-11c-.66 0-1.22.42-1.42 1.01L3 12v8c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1h12v1c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-8l-2.08-5.99zM6.5 16c-.83 0-1.5-.67-1.5-1.5S5.67 13 6.5 13s1.5.67 1.5 1.5S7.33 16 6.5 16zm11 0c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zM5 11l1.5-4.5h11L19 11H5z"/></svg>
            </div>
          `,
          className: 'driver-marker',
          iconSize: [28, 28],
          iconAnchor: [14, 14],
        });

        if (markerRef.current) {
          markerRef.current.setLatLng([lat, lng]);
        } else {
          markerRef.current = L.marker([lat, lng], { icon: customIcon }).addTo(map);
        }
      }

      if (activeTrip?.route_geometry?.coordinates?.length) {
        if (routeLayerRef.current) {
          routeLayerRef.current.remove();
        }
        const latLngs = activeTrip.route_geometry.coordinates.map(
          (c) => [c[1], c[0]] as [number, number],
        );
        routeLayerRef.current = L.polyline(latLngs, {
          color: '#3b82f6',
          weight: 4,
          opacity: 0.8,
        }).addTo(map);
      }
    }
  }, [liveGps, liveRail, liveFlight, liveSea, activeTrip, activeMovement, activeFlightMovement, activeVoyageMovement, isRailways, isAirways, isSeaways]);

  return (
    <div
      className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans"
      data-testid="driver-dashboard"
    >
      {/* Mobile-First Header */}
      <header className="bg-slate-900 border-b border-slate-800 px-4 py-3 flex items-center justify-between shadow-md sticky top-0 z-40">
        <div className="flex items-center gap-2">
          <div
            className={`p-2 rounded-lg border ${
              isSeaways
                ? 'bg-blue-500/10 text-blue-400 border-blue-500/20'
                : isAirways
                ? 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20'
                : isRailways
                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                : 'bg-blue-500/10 text-blue-400 border-blue-500/20'
            }`}
          >
            {isSeaways ? (
              <Ship className="w-5 h-5" />
            ) : isAirways ? (
              <Plane className="w-5 h-5" />
            ) : isRailways ? (
              <TrainFront className="w-5 h-5" />
            ) : (
              <Truck className="w-5 h-5" />
            )}
          </div>
          <div>
            <h1 className="text-sm font-bold text-white tracking-wide">
              {isSeaways
                ? 'Bridge Master & Helm Console'
                : isAirways
                ? 'Flight Crew Cockpit Console'
                : isRailways
                ? 'Loco Pilot Console'
                : 'NEXUS WAYS • Driver Console'}
            </h1>
            <p className="text-[11px] text-slate-400">
              {user?.fullName || 'Crew Member'} &bull; {user?.organization?.name || 'NEXUS WAYS'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate('/')}
            className="border-slate-700 bg-slate-900 text-slate-300 hover:text-white h-8 text-xs gap-1"
          >
            <Home className="w-3.5 h-3.5" />
            Hub
          </Button>
          <Button
            variant="destructive"
            size="sm"
            onClick={() => logout().then(() => navigate(`/${currentMode}/login`))}
            className="h-8 text-xs bg-rose-600 hover:bg-rose-500 text-white gap-1"
          >
            <LogOut className="w-3.5 h-3.5" />
            Logout
          </Button>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 p-4 max-w-4xl mx-auto w-full space-y-4">
        {/* SEAWAYS BRIDGE MASTER VIEW */}
        {isSeaways && (
          <>
            <Card className="bg-slate-900 border-slate-800 shadow-xl overflow-hidden">
              <CardHeader className="p-4 border-b border-slate-800 flex flex-row items-center justify-between">
                <div className="flex items-center gap-2">
                  <Ship className="w-5 h-5 text-sky-400" />
                  <div>
                    <CardTitle className="text-sm font-bold text-white">
                      Voyage: {activeVoyageMovement?.voyage?.voyage_number || 'Unscheduled'}
                    </CardTitle>
                    <p className="text-xs text-slate-400">
                      Vessel: {assignedVessel?.vessel_name || 'N/A'} ({assignedVessel?.vessel_type || 'Cargo Ship'})
                    </p>
                  </div>
                </div>
                <Badge
                  variant="outline"
                  className={
                    activeVoyageMovement?.status === 'in_transit'
                      ? 'bg-sky-500/10 text-sky-400 border-sky-500/30 animate-pulse text-xs'
                      : activeVoyageMovement?.status === 'completed'
                      ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30 text-xs'
                      : 'bg-slate-800 text-slate-400 border-slate-700 text-xs'
                  }
                >
                  {activeVoyageMovement?.status || 'No Active Voyage'}
                </Badge>
              </CardHeader>

              <CardContent className="p-4 space-y-3 text-xs">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
                  <div className="p-2.5 bg-slate-950/60 rounded-lg border border-slate-800/80">
                    <span className="text-[11px] text-slate-500">Speed (Knots)</span>
                    <p className="font-bold text-sky-400 text-base flex items-center justify-center gap-1 mt-0.5">
                      <Gauge className="w-3.5 h-3.5" />
                      {liveSea?.speedKnots ?? (activeVoyageMovement?.status === 'in_transit' ? 18.5 : 0)} kts
                    </p>
                  </div>
                  <div className="p-2.5 bg-slate-950/60 rounded-lg border border-slate-800/80">
                    <span className="text-[11px] text-slate-500">Sea Distance</span>
                    <p className="font-bold text-white text-base mt-0.5">
                      {activeVoyageMovement?.distance_km || 0} km
                    </p>
                  </div>
                  <div className="p-2.5 bg-slate-950/60 rounded-lg border border-slate-800/80">
                    <span className="text-[11px] text-slate-500">True Heading</span>
                    <p className="font-bold text-amber-400 text-sm mt-0.5 flex items-center justify-center gap-1">
                      <Compass className="w-3.5 h-3.5" />
                      {liveSea?.heading != null ? `${Math.round(liveSea.heading)}°` : '000°'}
                    </p>
                  </div>
                  <div className="p-2.5 bg-slate-950/60 rounded-lg border border-slate-800/80">
                    <span className="text-[11px] text-slate-500">Est. Duration</span>
                    <p className="font-bold text-blue-400 text-sm mt-0.5 truncate">
                      {activeVoyageMovement?.duration_minutes || 0} min
                    </p>
                  </div>
                </div>

                {/* Ports path */}
                {activeVoyageMovement?.voyage && (
                  <div className="p-3 bg-slate-950/40 rounded-lg border border-slate-800 space-y-2">
                    <div className="flex items-center gap-2 text-slate-200">
                      <Anchor className="w-4 h-4 text-sky-400 shrink-0" />
                      <span className="text-slate-400">Origin Port:</span>
                      <span className="font-semibold text-white">
                        {activeVoyageMovement.voyage.origin_port?.name} ({activeVoyageMovement.voyage.origin_port?.unlocode || 'PORT'})
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-slate-200">
                      <Anchor className="w-4 h-4 text-amber-400 shrink-0" />
                      <span className="text-slate-400">Destination Port:</span>
                      <span className="font-semibold text-white">
                        {activeVoyageMovement.voyage.destination_port?.name} ({activeVoyageMovement.voyage.destination_port?.unlocode || 'PORT'})
                      </span>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Live Land-Avoiding Marine Navigation Window */}
            <Card className="bg-slate-900 border-slate-800 shadow-xl overflow-hidden">
              <CardHeader className="p-3 border-b border-slate-800 flex flex-row items-center justify-between">
                <CardTitle className="text-xs font-semibold text-slate-300 flex items-center gap-2">
                  <Navigation className="w-4 h-4 text-sky-400" />
                  Live Land-Avoiding Sea Navigation Track
                </CardTitle>
                <Badge variant="outline" className="text-[10px] bg-slate-950 text-slate-400 border-slate-700">
                  Open-Water Searoute
                </Badge>
              </CardHeader>
              <div ref={mapContainerRef} className="h-72 w-full bg-slate-950" />
            </Card>
          </>
        )}

        {/* AIRWAYS FLIGHT CREW VIEW */}
        {isAirways && (
          <>
            <Card className="bg-slate-900 border-slate-800 shadow-xl overflow-hidden">
              <CardHeader className="p-4 border-b border-slate-800 flex flex-row items-center justify-between">
                <div className="flex items-center gap-2">
                  <Plane className="w-5 h-5 text-cyan-400" />
                  <div>
                    <CardTitle className="text-sm font-bold text-white">
                      Flight: {activeFlightMovement?.flight?.flight_number || 'Unscheduled'}
                    </CardTitle>
                    <p className="text-xs text-slate-400">
                      Aircraft: {assignedAircraft?.tail_number || 'N/A'} ({assignedAircraft?.aircraft_type || 'Cargo Jet'})
                    </p>
                  </div>
                </div>
                <Badge
                  variant="outline"
                  className={
                    activeFlightMovement?.status === 'in_transit'
                      ? 'bg-cyan-500/10 text-cyan-400 border-cyan-500/30 animate-pulse text-xs'
                      : activeFlightMovement?.status === 'completed'
                      ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30 text-xs'
                      : 'bg-slate-800 text-slate-400 border-slate-700 text-xs'
                  }
                >
                  {activeFlightMovement?.status || 'No Active Flight'}
                </Badge>
              </CardHeader>

              <CardContent className="p-4 space-y-3 text-xs">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
                  <div className="p-2.5 bg-slate-950/60 rounded-lg border border-slate-800/80">
                    <span className="text-[11px] text-slate-500">Airspeed</span>
                    <p className="font-bold text-cyan-400 text-base flex items-center justify-center gap-1 mt-0.5">
                      <Gauge className="w-3.5 h-3.5" />
                      {liveFlight?.speedKts ?? (activeFlightMovement?.status === 'in_transit' ? 450 : 0)} kts
                    </p>
                  </div>
                  <div className="p-2.5 bg-slate-950/60 rounded-lg border border-slate-800/80">
                    <span className="text-[11px] text-slate-500">Altitude</span>
                    <p className="font-bold text-white text-base mt-0.5">
                      {liveFlight?.altitudeFt != null
                        ? `${liveFlight.altitudeFt.toLocaleString()} ft`
                        : activeFlightMovement?.status === 'in_transit'
                        ? '33,000 ft'
                        : '0 ft'}
                    </p>
                  </div>
                  <div className="p-2.5 bg-slate-950/60 rounded-lg border border-slate-800/80">
                    <span className="text-[11px] text-slate-500">Heading</span>
                    <p className="font-bold text-amber-400 text-sm mt-0.5 flex items-center justify-center gap-1">
                      <Compass className="w-3.5 h-3.5" />
                      {liveFlight?.heading != null ? `${Math.round(liveFlight.heading)}°` : '000°'}
                    </p>
                  </div>
                  <div className="p-2.5 bg-slate-950/60 rounded-lg border border-slate-800/80">
                    <span className="text-[11px] text-slate-500">Great-Circle Dist</span>
                    <p className="font-bold text-blue-400 text-sm mt-0.5 truncate">
                      {activeFlightMovement?.distance_km || 0} km
                    </p>
                  </div>
                </div>

                {/* Airports path */}
                {activeFlightMovement?.flight && (
                  <div className="p-3 bg-slate-950/40 rounded-lg border border-slate-800 space-y-2">
                    <div className="flex items-center gap-2 text-slate-200">
                      <MapPin className="w-4 h-4 text-cyan-400 shrink-0" />
                      <span className="text-slate-400">Origin:</span>
                      <span className="font-semibold text-white">
                        {activeFlightMovement.flight.origin_airport?.name} ({activeFlightMovement.flight.origin_airport?.iata_code || activeFlightMovement.flight.origin_airport?.icao_code || 'ORIG'})
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-slate-200">
                      <MapPin className="w-4 h-4 text-amber-400 shrink-0" />
                      <span className="text-slate-400">Destination:</span>
                      <span className="font-semibold text-white">
                        {activeFlightMovement.flight.destination_airport?.name} ({activeFlightMovement.flight.destination_airport?.iata_code || activeFlightMovement.flight.destination_airport?.icao_code || 'DEST'})
                      </span>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Live Great-Circle Navigation Window */}
            <Card className="bg-slate-900 border-slate-800 shadow-xl overflow-hidden">
              <CardHeader className="p-3 border-b border-slate-800 flex flex-row items-center justify-between">
                <CardTitle className="text-xs font-semibold text-slate-300 flex items-center gap-2">
                  <Navigation className="w-4 h-4 text-cyan-400" />
                  Live Great-Circle Flight Path
                </CardTitle>
                <Badge variant="outline" className="text-[10px] bg-slate-950 text-slate-400 border-slate-700">
                  Exact Arc Geometry
                </Badge>
              </CardHeader>
              <div ref={mapContainerRef} className="h-72 w-full bg-slate-950" />
            </Card>
          </>
        )}

        {/* RAILWAYS LOCO PILOT VIEW */}
        {isRailways && (
          <>
            {/* Active Train Movement Card */}
            <Card className="bg-slate-900 border-slate-800 shadow-xl overflow-hidden">
              <CardHeader className="p-4 border-b border-slate-800 flex flex-row items-center justify-between">
                <div className="flex items-center gap-2">
                  <TrainFront className="w-5 h-5 text-emerald-400" />
                  <div>
                    <CardTitle className="text-sm font-bold text-white">
                      Train Service: {assignedTrain?.train_number || 'Unassigned'}
                    </CardTitle>
                    <p className="text-xs text-slate-400">
                      {assignedTrain?.train_name || 'Scheduled Service'}
                    </p>
                  </div>
                </div>
                <Badge
                  variant="outline"
                  className={
                    activeMovement?.status === 'in_transit'
                      ? 'bg-blue-500/10 text-blue-400 border-blue-500/30 animate-pulse text-xs'
                      : activeMovement?.status === 'completed'
                      ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30 text-xs'
                      : 'bg-slate-800 text-slate-400 border-slate-700 text-xs'
                  }
                >
                  {activeMovement?.status || 'No Active Movement'}
                </Badge>
              </CardHeader>

              <CardContent className="p-4 space-y-3 text-xs">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
                  <div className="p-2.5 bg-slate-950/60 rounded-lg border border-slate-800/80">
                    <span className="text-[11px] text-slate-500">Speed</span>
                    <p className="font-bold text-emerald-400 text-base flex items-center justify-center gap-1 mt-0.5">
                      <Radio className="w-3.5 h-3.5" />
                      {liveRail?.speedKmh ?? (activeMovement?.status === 'in_transit' ? 75 : 0)} km/h
                    </p>
                  </div>
                  <div className="p-2.5 bg-slate-950/60 rounded-lg border border-slate-800/80">
                    <span className="text-[11px] text-slate-500">Track Distance</span>
                    <p className="font-bold text-white text-base mt-0.5">
                      {activeMovement?.distance_km || 0} km
                    </p>
                  </div>
                  <div className="p-2.5 bg-slate-950/60 rounded-lg border border-slate-800/80">
                    <span className="text-[11px] text-slate-500">Locomotive</span>
                    <p className="font-bold text-amber-400 text-sm mt-0.5 truncate">
                      {assignedTrain?.locomotive?.loco_number || 'Electric'}
                    </p>
                  </div>
                  <div className="p-2.5 bg-slate-950/60 rounded-lg border border-slate-800/80">
                    <span className="text-[11px] text-slate-500">Rake Co.</span>
                    <p className="font-bold text-blue-400 text-sm mt-0.5 truncate">
                      {assignedTrain?.rake?.rake_id || '16 Coaches'}
                    </p>
                  </div>
                </div>

                {/* Stations path */}
                {activeMovement && (
                  <div className="p-3 bg-slate-950/40 rounded-lg border border-slate-800 space-y-2">
                    <div className="flex items-center gap-2 text-slate-200">
                      <MapPin className="w-4 h-4 text-emerald-400 shrink-0" />
                      <span className="text-slate-400">Origin:</span>
                      <span className="font-semibold text-white">{activeMovement.origin_station?.name}</span>
                    </div>
                    <div className="flex items-center gap-2 text-slate-200">
                      <MapPin className="w-4 h-4 text-amber-400 shrink-0" />
                      <span className="text-slate-400">Destination:</span>
                      <span className="font-semibold text-white">{activeMovement.destination_station?.name}</span>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Live OpenRailwayMap Window */}
            <Card className="bg-slate-900 border-slate-800 shadow-xl overflow-hidden">
              <CardHeader className="p-3 border-b border-slate-800 flex flex-row items-center justify-between">
                <CardTitle className="text-xs font-semibold text-slate-300 flex items-center gap-2">
                  <Navigation className="w-4 h-4 text-emerald-400" />
                  Live OpenRailwayMap Track Position
                </CardTitle>
                <Badge variant="outline" className="text-[10px] bg-slate-950 text-slate-400 border-slate-700">
                  Real Rail Geometry
                </Badge>
              </CardHeader>
              <div ref={mapContainerRef} className="h-72 w-full bg-slate-950" />
            </Card>
          </>
        )}

        {/* ROADWAYS DRIVER VIEW */}
        {!isRailways && !isAirways && !isSeaways && (
          <>
            <Card className="bg-slate-900 border-slate-800 shadow-xl overflow-hidden">
              <CardHeader className="p-4 border-b border-slate-800 flex flex-row items-center justify-between">
                <div className="flex items-center gap-2">
                  <Truck className="w-5 h-5 text-status-informational" />
                  <div>
                    <CardTitle className="text-sm font-bold text-white">
                      Vehicle: {assignedVehicle?.registration_number || 'Unassigned'}
                    </CardTitle>
                    <p className="text-xs text-slate-400">
                      {assignedVehicle?.vehicle_type || 'Assigned Commercial Unit'}
                    </p>
                  </div>
                </div>
                <Badge
                  variant="outline"
                  className={
                    activeTrip?.status === 'in_transit'
                      ? 'bg-blue-500/10 text-blue-400 border-blue-500/30 animate-pulse text-xs'
                      : activeTrip?.status === 'completed'
                      ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30 text-xs'
                      : 'bg-slate-800 text-slate-400 border-slate-700 text-xs'
                  }
                >
                  {activeTrip?.status || 'Idle'}
                </Badge>
              </CardHeader>

              <CardContent className="p-4 space-y-3 text-xs">
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-center">
                  <div className="p-2.5 bg-slate-950/60 rounded-lg border border-slate-800/80">
                    <span className="text-[11px] text-slate-500">Live Speed</span>
                    <p className="font-bold text-status-informational text-base mt-0.5">
                      {liveGps?.speed_kmh || 0} km/h
                    </p>
                  </div>
                  <div className="p-2.5 bg-slate-950/60 rounded-lg border border-slate-800/80">
                    <span className="text-[11px] text-slate-500">Trip Distance</span>
                    <p className="font-bold text-white text-base mt-0.5">
                      {activeTrip?.distance_km || 0} km
                    </p>
                  </div>
                  <div className="p-2.5 bg-slate-950/60 rounded-lg border border-slate-800/80">
                    <span className="text-[11px] text-slate-500">Est. Duration</span>
                    <p className="font-bold text-white text-base mt-0.5">
                      {activeTrip?.duration_minutes || 0} min
                    </p>
                  </div>
                </div>

                {activeTrip && (
                  <div className="p-3 bg-slate-950/40 rounded-lg border border-slate-800 space-y-2">
                    <div className="flex items-center gap-2 text-slate-200">
                      <MapPin className="w-4 h-4 text-emerald-400 shrink-0" />
                      <span className="text-slate-400">Origin:</span>
                      <span className="font-semibold text-white">{activeTrip.origin_label}</span>
                    </div>
                    <div className="flex items-center gap-2 text-slate-200">
                      <MapPin className="w-4 h-4 text-amber-400 shrink-0" />
                      <span className="text-slate-400">Destination:</span>
                      <span className="font-semibold text-white">{activeTrip.destination_label}</span>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="bg-slate-900 border-slate-800 shadow-xl overflow-hidden">
              <CardHeader className="p-3 border-b border-slate-800 flex flex-row items-center justify-between">
                <CardTitle className="text-xs font-semibold text-slate-300 flex items-center gap-2">
                  <Navigation className="w-4 h-4 text-status-informational" />
                  Live Navigation Route
                </CardTitle>
              </CardHeader>
              <div ref={mapContainerRef} className="h-72 w-full bg-slate-950" />
            </Card>
          </>
        )}
      </main>
    </div>
  );
};

export default DriverDashboard;
