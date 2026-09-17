import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  isValidOrgMode,
  OrgMode,
  DashboardStats,
  SystemStatus,
  NotificationItem,
  Vehicle,
  Driver,
  Trip,
  Geofence,
  ConvoyGroup,
  GhostPositionPayload,
  Station,
  Train,
  Locomotive,
  Rake,
  LocoPilot,
  TrainMovement,
  SavedRailRoute,
  Airport,
  Aircraft,
  FlightCrew,
  Flight,
  FlightMovement,
  Port,
  Vessel,
  SeaCrew,
  Voyage,
  VoyageMovement,
  SeaConvoyGroup,
  LiveVesselTelemetryPayload,
} from '@nexus-ways/shared';
import { useAuthStore } from '../store/authStore';
import { dashboardService } from '../services/dashboard';
import { notificationsService } from '../services/notifications';
import { socketService, LiveRailTelemetryPayload, LiveFlightTelemetryPayload } from '../services/socket';
import { vehiclesService } from '../services/vehicles';
import { driversService } from '../services/drivers';
import { tripsService } from '../services/trips';
import { geofencesService } from '../services/geofences';
import { convoysService } from '../services/convoys';
import { railwaysService } from '../services/railways';
import { airwaysService } from '../services/airways';
import { seawaysService } from '../services/seaways';
import { NotFound } from './NotFound';
import { DriverDashboard } from './DriverDashboard';
import { MiniMap } from '../components/MiniMap';
import { StatsRow } from '../components/StatsRow';
import { SystemStatusRow } from '../components/SystemStatusRow';
import { NotificationDrawer } from '../components/NotificationDrawer';
import { AdminPanelModal } from '../components/AdminPanelModal';
import { VehicleSidebar } from '../components/VehicleSidebar';
import { VehicleSidebarPlaceholder } from '../components/VehicleSidebarPlaceholder';
import { RoadwaysMap } from '../components/RoadwaysMap';
import { CreateTripModal } from '../components/CreateTripModal';
import { TripDetailsPanel } from '../components/TripDetailsPanel';
import { AiAssistantWidget } from '../components/AiAssistantWidget';
import { RailwaysSidebar } from '../components/RailwaysSidebar';
import { RailwaysMap } from '../components/RailwaysMap';
import { CreateMovementModal } from '../components/CreateMovementModal';
import { MovementDetailsPanel } from '../components/MovementDetailsPanel';
import { AirwaysSidebar } from '../components/AirwaysSidebar';
import { AirwaysMap } from '../components/AirwaysMap';
import { CreateFlightMovementModal } from '../components/CreateFlightMovementModal';
import { FlightMovementDetailsPanel } from '../components/FlightMovementDetailsPanel';
import { SeawaysSidebar } from '../components/SeawaysSidebar';
import { SeawaysMap } from '../components/SeawaysMap';
import { CreateVoyageMovementModal } from '../components/CreateVoyageMovementModal';
import { VoyageMovementDetailsPanel } from '../components/VoyageMovementDetailsPanel';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import {
  LogOut,
  Building,
  User,
  MapPin,
  ShieldCheck,
  Truck,
  TrainFront,
  Plane,
  Ship,
  Home,
  Navigation,
  Plus,
} from 'lucide-react';
import { toast } from 'sonner';

const MODE_ICONS: Record<OrgMode, React.ComponentType<{ className?: string }>> = {
  roadways: Truck,
  railways: TrainFront,
  airways: Plane,
  seaways: Ship,
};

export const Dashboard: React.FC = () => {
  const { mode } = useParams<{ mode: string }>();
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();

  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [isLoadingStats, setIsLoadingStats] = useState(true);
  const [systemStatus, setSystemStatus] = useState<SystemStatus | null>(null);
  const [isWsConnected, setIsWsConnected] = useState(false);
  const [networkLatency, setNetworkLatency] = useState<{
    latencyMs: number;
    quality: 'Good' | 'Fair' | 'Poor';
  } | null>(null);

  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  // Phase 4 & Phase 5 Roadways Operational & Intelligence State
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [trips, setTrips] = useState<Trip[]>([]);
  const [geofences, setGeofences] = useState<Geofence[]>([]);
  const [convoys, setConvoys] = useState<ConvoyGroup[]>([]);
  const [selectedVehicleId, setSelectedVehicleId] = useState<string | null>(null);
  const [selectedTrip, setSelectedTrip] = useState<Trip | null>(null);
  const [ghostPositions, setGhostPositions] = useState<Record<string, GhostPositionPayload>>({});

  // Trip Creation Modal State
  const [isTripModalOpen, setIsTripModalOpen] = useState(false);
  const [preselectedVehicleForTrip, setPreselectedVehicleForTrip] = useState<Vehicle | null>(null);

  // Phase 7A-1 Railways Operational State
  const [stations, setStations] = useState<Station[]>([]);
  const [trains, setTrains] = useState<Train[]>([]);
  const [locomotives, setLocomotives] = useState<Locomotive[]>([]);
  const [rakes, setRakes] = useState<Rake[]>([]);
  const [locoPilots, setLocoPilots] = useState<LocoPilot[]>([]);
  const [movements, setMovements] = useState<TrainMovement[]>([]);
  const [savedRailRoutes, setSavedRailRoutes] = useState<SavedRailRoute[]>([]);
  const [selectedTrainId, setSelectedTrainId] = useState<string | null>(null);
  const [selectedMovementId, setSelectedMovementId] = useState<string | null>(null);
  const [isMovementModalOpen, setIsMovementModalOpen] = useState(false);
  const [railTelemetry, setRailTelemetry] = useState<Record<string, LiveRailTelemetryPayload>>({});

  // Phase 7B-1 Airways Operational State
  const [airports, setAirports] = useState<Airport[]>([]);
  const [aircraftList, setAircraftList] = useState<Aircraft[]>([]);
  const [flightCrewList, setFlightCrewList] = useState<FlightCrew[]>([]);
  const [flightsList, setFlightsList] = useState<Flight[]>([]);
  const [flightMovementsList, setFlightMovementsList] = useState<FlightMovement[]>([]);
  const [selectedAircraftId, setSelectedAircraftId] = useState<string | null>(null);
  const [selectedFlightMovementId, setSelectedFlightMovementId] = useState<string | null>(null);
  const [isFlightModalOpen, setIsFlightModalOpen] = useState(false);
  const [flightTelemetry, setFlightTelemetry] = useState<Record<string, LiveFlightTelemetryPayload>>({});

  // Phase 7C-1 Seaways Operational State
  const [portsList, setPortsList] = useState<Port[]>([]);
  const [vesselsList, setVesselsList] = useState<Vessel[]>([]);
  const [seaCrewList, setSeaCrewList] = useState<SeaCrew[]>([]);
  const [voyagesList, setVoyagesList] = useState<Voyage[]>([]);
  const [voyageMovementsList, setVoyageMovementsList] = useState<VoyageMovement[]>([]);
  const [seaConvoysList, setSeaConvoysList] = useState<SeaConvoyGroup[]>([]);
  const [selectedVesselId, setSelectedVesselId] = useState<string | null>(null);
  const [selectedVoyageMovementId, setSelectedVoyageMovementId] = useState<string | null>(null);
  const [isVoyageModalOpen, setIsVoyageModalOpen] = useState(false);
  const [seaTelemetry, setSeaTelemetry] = useState<Record<string, LiveVesselTelemetryPayload>>({});

  if (!isValidOrgMode(mode)) {
    return <NotFound />;
  }

  // If logged-in user is driver/loco-pilot/flight-crew/sea-master, render simplified operator view
  if (user?.role === 'driver') {
    return <DriverDashboard />;
  }

  const currentMode = mode as OrgMode;
  const isRoadways = currentMode === 'roadways';
  const isRailways = currentMode === 'railways';
  const isAirways = currentMode === 'airways';
  const isSeaways = currentMode === 'seaways';
  const modeTitle = currentMode.charAt(0).toUpperCase() + currentMode.slice(1);
  const ModeIcon = MODE_ICONS[currentMode] || Truck;

  // 1. Fetch dashboard data & fleet operational data
  const loadDashboardData = useCallback(async () => {
    try {
      setIsLoadingStats(true);
      const [statsData, statusData, notifsData, countData, latency] = await Promise.all([
        dashboardService.getStats().catch(() => null),
        dashboardService.getSystemStatus().catch(() => null),
        notificationsService.getNotifications().catch(() => []),
        notificationsService.getUnreadCount().catch(() => 0),
        dashboardService.measureClientLatency(),
      ]);

      if (statsData) setStats(statsData);
      if (statusData) setSystemStatus(statusData);
      setNotifications(notifsData);
      setUnreadCount(countData);
      setNetworkLatency(latency);

      // Load Roadways operational fleet data
      if (isRoadways) {
        const [vList, dList, tList, gList, cList] = await Promise.all([
          vehiclesService.getVehicles().catch(() => []),
          driversService.getDrivers().catch(() => []),
          tripsService.getTrips().catch(() => []),
          geofencesService.getGeofences().catch(() => []),
          convoysService.getConvoys().catch(() => []),
        ]);

        setVehicles(vList);
        setDrivers(dList);
        setTrips(tList);
        setGeofences(gList);
        setConvoys(cList);
      }

      // Load Railways operational data
      if (isRailways) {
        const [stList, trList, lcList, rkList, lpList, mvList, srList] = await Promise.all([
          railwaysService.getStations().catch(() => []),
          railwaysService.getTrains().catch(() => []),
          railwaysService.getLocomotives().catch(() => []),
          railwaysService.getRakes().catch(() => []),
          railwaysService.getLocoPilots().catch(() => []),
          railwaysService.getMovements().catch(() => []),
          railwaysService.getSavedRoutes().catch(() => []),
        ]);

        setStations(stList);
        setTrains(trList);
        setLocomotives(lcList);
        setRakes(rkList);
        setLocoPilots(lpList);
        setMovements(mvList);
        setSavedRailRoutes(srList);
      }

      // Load Airways operational data
      if (isAirways) {
        const [apList, acList, fcList, flList, fmList] = await Promise.all([
          airwaysService.getAirports().catch(() => []),
          airwaysService.getAircraft().catch(() => []),
          airwaysService.getFlightCrew().catch(() => []),
          airwaysService.getFlights().catch(() => []),
          airwaysService.getMovements().catch(() => []),
        ]);

        setAirports(apList);
        setAircraftList(acList);
        setFlightCrewList(fcList);
        setFlightsList(flList);
        setFlightMovementsList(fmList);
      }

      // Load Seaways operational data
      if (isSeaways) {
        const [pList, vList, cList, vyList, vmList, scList, gfList] = await Promise.all([
          seawaysService.getPorts().catch(() => []),
          seawaysService.getVessels().catch(() => []),
          seawaysService.getSeaCrew().catch(() => []),
          seawaysService.getVoyages().catch(() => []),
          seawaysService.getMovements().catch(() => []),
          seawaysService.getConvoys().catch(() => []),
          geofencesService.getGeofences().catch(() => []),
        ]);

        setPortsList(pList);
        setVesselsList(vList);
        setSeaCrewList(cList);
        setVoyagesList(vyList);
        setVoyageMovementsList(vmList);
        setSeaConvoysList(scList);
        setGeofences(gfList);
      }
    } finally {
      setIsLoadingStats(false);
    }
  }, [isRoadways, isRailways, isAirways, isSeaways]);

  // 2. Lifecycle & Realtime WebSocket connection
  useEffect(() => {
    loadDashboardData();

    socketService.connect(
      (newNotification) => {
        setNotifications((prev) => [newNotification, ...prev]);
        setUnreadCount((prev) => prev + 1);
        toast.info(`New alert: ${newNotification.title}`);
      },
      (connected) => {
        setIsWsConnected(connected);
      },
      (gps) => {
        // Live GPS point broadcast from Roadways simulation engine
        setVehicles((prev) =>
          prev.map((v) => {
            if (v.id === gps.vehicleId) {
              return {
                ...v,
                status: 'active',
                latest_gps: {
                  id: 'live-' + Date.now(),
                  trip_id: gps.tripId,
                  vehicle_id: gps.vehicleId,
                  lat: gps.lat,
                  lng: gps.lng,
                  speed_kmh: gps.speed_kmh,
                  heading: gps.heading || 0,
                  recorded_at: gps.recorded_at,
                },
              };
            }
            return v;
          }),
        );
      },
      (statusUpdate) => {
        setTrips((prev) =>
          prev.map((t) => {
            if (t.id === statusUpdate.tripId) {
              return {
                ...t,
                status: statusUpdate.status as any,
                started_at: statusUpdate.startedAt || t.started_at,
                completed_at: statusUpdate.completedAt || t.completed_at,
              };
            }
            return t;
          }),
        );
      },
      (geofenceEvent) => {
        toast.info(
          `Geofence ${geofenceEvent.eventType.toUpperCase()}: ${geofenceEvent.geofenceName}`,
        );
      },
      (ghost) => {
        setGhostPositions((prev) => ({
          ...prev,
          [ghost.tripId]: ghost,
        }));
      },
    );

    // Railways live telemetry socket listeners
    socketService.onRailTelemetry((telemetry) => {
      setRailTelemetry((prev) => ({
        ...prev,
        [telemetry.movementId]: telemetry,
      }));
    });

    socketService.onRailCompleted((completed) => {
      toast.success(`Train movement ${completed.movementId} completed destination arrival.`);
      loadDashboardData();
    });

    // Airways live telemetry socket listeners
    socketService.onFlightTelemetry((telemetry) => {
      setFlightTelemetry((prev) => ({
        ...prev,
        [telemetry.movementId]: telemetry,
      }));
    });

    socketService.onFlightCompleted((completed) => {
      toast.success(`Flight ${completed.flightNumber} (${completed.tailNumber}) completed destination arrival.`);
      loadDashboardData();
    });

    // Seaways live telemetry socket listeners
    const handleSeaTelemetry = (telemetry: LiveVesselTelemetryPayload) => {
      setSeaTelemetry((prev) => ({
        ...prev,
        [telemetry.movementId]: telemetry,
      }));
    };
    socketService.onSeaTelemetry(handleSeaTelemetry);

    const handleSeaGhost = (ghost: GhostPositionPayload) => {
      setGhostPositions((prev) => ({
        ...prev,
        [ghost.tripId]: ghost,
      }));
    };
    socketService.onSeaGhost(handleSeaGhost);

    const handleSeaCompleted = (completed: any) => {
      toast.success(`Voyage movement ${completed.movementId} completed destination arrival.`);
      loadDashboardData();
    };
    socketService.onSeaCompleted(handleSeaCompleted);

    return () => {
      socketService.offSeaTelemetry(handleSeaTelemetry);
      socketService.offSeaGhost(handleSeaGhost);
      socketService.offSeaCompleted(handleSeaCompleted);
      socketService.disconnect();
    };
  }, [loadDashboardData]);

  // Roadways handlers
  const handleSelectVehicle = (vehicle: Vehicle) => {
    setSelectedVehicleId((prev) => (prev === vehicle.id ? null : vehicle.id));
    const vehicleTrip = trips.find(
      (t) => t.vehicle_id === vehicle.id && (t.status === 'in_transit' || t.status === 'planned'),
    );
    setSelectedTrip(vehicleTrip || null);
  };

  const handleMarkNotificationAsRead = async (id: string) => {
    await notificationsService.markAsRead(id);
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, is_read: true } : n)),
    );
    setUnreadCount((c) => Math.max(0, c - 1));
  };

  const handleVehicleCreated = (newVehicle: Vehicle) => {
    setVehicles((prev) => [newVehicle, ...prev]);
    toast.success(`Vehicle ${newVehicle.registration_number} added successfully.`);
  };

  const handleOpenTripModalForVehicle = (vehicle: Vehicle) => {
    setPreselectedVehicleForTrip(vehicle);
    setIsTripModalOpen(true);
  };

  const handleTripCreated = (newTrip: Trip) => {
    setTrips((prev) => [newTrip, ...prev]);
    setSelectedTrip(newTrip);
    setSelectedVehicleId(newTrip.vehicle_id);
    loadDashboardData();
  };

  // Railways handlers
  const handleSelectTrain = (trainId: string) => {
    setSelectedTrainId((prev) => (prev === trainId ? null : trainId));
    const activeMovement = movements.find(
      (m) => m.train_id === trainId && (m.status === 'in_transit' || m.status === 'planned'),
    );
    setSelectedMovementId(activeMovement?.id || null);
  };

  const handleSelectMovement = (movementId: string) => {
    setSelectedMovementId((prev) => (prev === movementId ? null : movementId));
    const mov = movements.find((m) => m.id === movementId);
    if (mov) {
      setSelectedTrainId(mov.train_id);
    }
  };

  const selectedMovement = movements.find((m) => m.id === selectedMovementId) || null;

  // Airways handlers
  const handleSelectAircraft = (aircraftId: string) => {
    setSelectedAircraftId((prev) => (prev === aircraftId ? null : aircraftId));
    const activeFlight = flightMovementsList.find(
      (m) => m.aircraft_id === aircraftId && (m.status === 'in_transit' || m.status === 'planned'),
    );
    setSelectedFlightMovementId(activeFlight?.id || null);
  };

  const handleSelectFlightMovement = (movementId: string) => {
    setSelectedFlightMovementId((prev) => (prev === movementId ? null : movementId));
    const mov = flightMovementsList.find((m) => m.id === movementId);
    if (mov) {
      setSelectedAircraftId(mov.aircraft_id);
    }
  };

  const selectedFlightMovement =
    flightMovementsList.find((m) => m.id === selectedFlightMovementId) || null;

  // Seaways handlers
  const handleSelectVessel = (vesselId: string) => {
    setSelectedVesselId((prev) => (prev === vesselId ? null : vesselId));
    const activeMovement = voyageMovementsList.find(
      (m) => m.vessel_id === vesselId && (m.status === 'in_transit' || m.status === 'planned'),
    );
    setSelectedVoyageMovementId(activeMovement?.id || null);
  };

  const handleSelectVoyageMovement = (movementId: string) => {
    setSelectedVoyageMovementId((prev) => (prev === movementId ? null : movementId));
    const mov = voyageMovementsList.find((m) => m.id === movementId);
    if (mov) {
      setSelectedVesselId(mov.vessel_id);
    }
  };

  const selectedVoyageMovement =
    voyageMovementsList.find((m) => m.id === selectedVoyageMovementId) || null;

  return (
    <div className="flex flex-col min-h-screen bg-slate-950 text-slate-100 antialiased font-sans">
      {/* Universal Top Header */}
      <header className="border-b border-slate-800 bg-slate-900/80 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-[1920px] mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2.5">
              <img
                src="/images/nexus_ways_emblem.png"
                alt="NEXUS WAYS Logo"
                className="h-8 w-auto object-contain select-none"
              />
              <span className="font-bold text-base tracking-tight text-white flex items-center gap-1.5">
                NEXUS WAYS

                <Badge
                  variant="outline"
                  className="bg-blue-500/10 text-blue-400 border-blue-500/30 text-[10px] uppercase font-mono tracking-wider ml-1"
                >
                  {modeTitle}
                </Badge>
              </span>
            </div>

            <div className="hidden md:flex items-center gap-3 pl-3 border-l border-slate-800 text-xs text-slate-400">
              <Building className="w-3.5 h-3.5 text-slate-500" />
              <span className="text-slate-200 font-medium">
                {user?.organization?.name || 'Organization'}
              </span>
              <MiniMap
                latitude={user?.organization?.latitude}
                longitude={user?.organization?.longitude}
                orgName={user?.organization?.name}
                className="hidden xl:flex w-36 h-10"
              />
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* System Status Indicators */}
            <SystemStatusRow
              systemStatus={systemStatus}
              isWsConnected={isWsConnected}
              networkLatency={networkLatency}
            />

            {/* Notification Drawer Button */}
            <NotificationDrawer
              notifications={notifications}
              unreadCount={unreadCount}
              onMarkAsRead={handleMarkNotificationAsRead}
            />

            {/* Admin Panel Modal (Managers only) */}
            {user?.role === 'manager' && (
              <AdminPanelModal currentUserRole={user?.role} />
            )}

            {/* User Profile Pill */}
            <div className="flex items-center gap-2 pl-2 border-l border-slate-800">
              <div className="w-7 h-7 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-300 font-semibold text-xs">
                {user?.fullName?.charAt(0) || <User className="w-4 h-4" />}
              </div>
              <div className="hidden sm:block text-left">
                <div className="text-xs font-semibold text-slate-200 leading-tight">
                  {user?.fullName}
                </div>
                <div className="text-[10px] text-slate-400 uppercase tracking-wider font-mono">
                  {user?.role}
                </div>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-slate-400 hover:text-red-400 hover:bg-slate-800"
                onClick={() => {
                  logout();
                  navigate('/');
                }}
                data-testid="hub-button"
                title="Return to Hub / Sign Out"
              >
                <LogOut className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Workspace Body */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {/* ROADWAYS WORKSPACE */}
        {isRoadways && (
          <div className="flex-1 p-4 space-y-4 max-w-[1920px] w-full mx-auto flex flex-col">
            <StatsRow stats={stats} isLoading={isLoadingStats} />

            <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 flex-1 min-h-[550px]">
              <aside className="lg:col-span-1 h-[550px]">
                <VehicleSidebar
                  vehicles={vehicles}
                  drivers={drivers}
                  selectedVehicleId={selectedVehicleId}
                  onSelectVehicle={handleSelectVehicle}
                  onVehicleCreated={handleVehicleCreated}
                  onCreateTrip={handleOpenTripModalForVehicle}
                  currentUserRole={user?.role}
                />
              </aside>

              <div className="lg:col-span-3 h-[550px] rounded-xl overflow-hidden border border-slate-800 shadow-xl relative">
                <RoadwaysMap
                  vehicles={vehicles}
                  activeTrips={trips}
                  geofences={geofences}
                  ghostPositions={ghostPositions}
                  selectedVehicleId={selectedVehicleId}
                  onSelectVehicle={handleSelectVehicle}
                />
              </div>
            </div>
          </div>
        )}

        {/* RAILWAYS WORKSPACE */}
        {isRailways && (
          <div className="flex-1 flex flex-col h-[calc(100vh-57px)] overflow-hidden">
            <div className="p-3 pb-1">
              <StatsRow stats={stats} isLoading={isLoadingStats} />
            </div>

            <div className="flex-1 flex overflow-hidden">
              {/* Left Rail Sidebar */}
              <RailwaysSidebar
                trains={trains}
                stations={stations}
                locomotives={locomotives}
                rakes={rakes}
                locoPilots={locoPilots}
                movements={movements}
                selectedTrainId={selectedTrainId}
                onSelectTrain={handleSelectTrain}
                selectedMovementId={selectedMovementId}
                onSelectMovement={handleSelectMovement}
                userRole={user?.role}
                onRefresh={loadDashboardData}
                onOpenCreateMovement={() => setIsMovementModalOpen(true)}
              />

              {/* Center Live OpenRailwayMap */}
              <div className="flex-1 h-full relative">
                <RailwaysMap
                  stations={stations}
                  trains={trains}
                  movements={movements}
                  selectedMovement={selectedMovement}
                  selectedTrainId={selectedTrainId}
                  liveTelemetry={railTelemetry}
                  onSelectMovement={handleSelectMovement}
                />
              </div>

              {/* Right Movement Details Panel (when movement selected) */}
              {selectedMovement && (
                <MovementDetailsPanel
                  movement={selectedMovement}
                  liveTelemetry={railTelemetry[selectedMovement.id]}
                  onClose={() => setSelectedMovementId(null)}
                  onRefresh={loadDashboardData}
                  userRole={user?.role}
                />
              )}
            </div>
          </div>
        )}

        {/* AIRWAYS WORKSPACE */}
        {isAirways && (
          <div className="flex-1 flex flex-col h-[calc(100vh-57px)] overflow-hidden">
            <div className="p-3 pb-1">
              <StatsRow stats={stats} isLoading={isLoadingStats} />
            </div>

            <div className="flex-1 flex overflow-hidden">
              {/* Left Airways Sidebar */}
              <AirwaysSidebar
                aircraft={aircraftList}
                airports={airports}
                crew={flightCrewList}
                flights={flightsList}
                movements={flightMovementsList}
                selectedAircraftId={selectedAircraftId}
                onSelectAircraft={handleSelectAircraft}
                selectedMovementId={selectedFlightMovementId}
                onSelectMovement={handleSelectFlightMovement}
                userRole={user?.role}
                onRefresh={loadDashboardData}
                onOpenCreateMovement={() => setIsFlightModalOpen(true)}
              />

              {/* Center Live Great-Circle Airways Map */}
              <div className="flex-1 h-full relative">
                <AirwaysMap
                  airports={airports}
                  aircraft={aircraftList}
                  movements={flightMovementsList}
                  selectedMovement={selectedFlightMovement}
                  selectedAircraftId={selectedAircraftId}
                  liveTelemetry={flightTelemetry}
                  ghostPositions={ghostPositions}
                  onSelectMovement={handleSelectFlightMovement}
                />
              </div>

              {/* Right Flight Movement Details Panel */}
              {selectedFlightMovement && (
                <FlightMovementDetailsPanel
                  movement={selectedFlightMovement}
                  liveTelemetry={flightTelemetry[selectedFlightMovement.id]}
                  onClose={() => setSelectedFlightMovementId(null)}
                  onRefresh={loadDashboardData}
                  userRole={user?.role}
                />
              )}
            </div>
          </div>
        )}

        {/* SEAWAYS WORKSPACE */}
        {isSeaways && (
          <div className="flex-1 flex flex-col h-[calc(100vh-57px)] overflow-hidden">
            <div className="p-3 pb-1">
              <StatsRow stats={stats} isLoading={isLoadingStats} />
            </div>

            <div className="flex-1 flex overflow-hidden">
              {/* Left Seaways Sidebar */}
              <SeawaysSidebar
                vessels={vesselsList}
                ports={portsList}
                crew={seaCrewList}
                voyages={voyagesList}
                movements={voyageMovementsList}
                convoys={seaConvoysList}
                selectedVesselId={selectedVesselId}
                onSelectVessel={handleSelectVessel}
                selectedMovementId={selectedVoyageMovementId}
                onSelectMovement={handleSelectVoyageMovement}
                userRole={user?.role}
                onRefresh={loadDashboardData}
                onOpenCreateMovement={() => setIsVoyageModalOpen(true)}
              />

              {/* Center Live Land-Avoiding Seaways Map */}
              <div className="flex-1 h-full relative">
                <SeawaysMap
                  ports={portsList}
                  vessels={vesselsList}
                  movements={voyageMovementsList}
                  selectedMovement={selectedVoyageMovement}
                  selectedVesselId={selectedVesselId}
                  liveTelemetry={seaTelemetry}
                  convoys={seaConvoysList}
                  geofences={geofences}
                  ghostPositions={ghostPositions}
                  onSelectMovement={handleSelectVoyageMovement}
                />
              </div>

              {/* Right Voyage Movement Details Panel */}
              {selectedVoyageMovement && (
                <VoyageMovementDetailsPanel
                  movement={selectedVoyageMovement}
                  liveTelemetry={seaTelemetry[selectedVoyageMovement.id]}
                  onClose={() => setSelectedVoyageMovementId(null)}
                  onRefresh={loadDashboardData}
                  userRole={user?.role}
                />
              )}
            </div>
          </div>
        )}

        {/* OTHER MODES PLACEHOLDER */}
        {!isRoadways && !isRailways && !isAirways && !isSeaways && (
          <div className="flex-1 p-6 space-y-6">
            <StatsRow stats={stats} isLoading={isLoadingStats} />
            <VehicleSidebarPlaceholder modeName={modeTitle} />
          </div>
        )}
      </main>

      {/* Roadways Trip Modal */}
      {isRoadways && isTripModalOpen && (
        <CreateTripModal
          isOpen={isTripModalOpen}
          onClose={() => setIsTripModalOpen(false)}
          vehicles={vehicles}
          drivers={drivers}
          preselectedVehicle={preselectedVehicleForTrip}
          onTripCreated={handleTripCreated}
        />
      )}

      {/* Roadways Trip Details Panel */}
      {isRoadways && selectedTrip && (
        <TripDetailsPanel trip={selectedTrip} onClose={() => setSelectedTrip(null)} />
      )}

      {/* Railways Movement Creation Modal */}
      {isRailways && isMovementModalOpen && (
        <CreateMovementModal
          isOpen={isMovementModalOpen}
          onClose={() => setIsMovementModalOpen(false)}
          stations={stations}
          trains={trains}
          locoPilots={locoPilots}
          savedRoutes={savedRailRoutes}
          onMovementCreated={loadDashboardData}
        />
      )}

      {/* Airways Flight Movement Creation Modal */}
      {isAirways && isFlightModalOpen && (
        <CreateFlightMovementModal
          isOpen={isFlightModalOpen}
          onClose={() => setIsFlightModalOpen(false)}
          airports={airports}
          aircraft={aircraftList}
          crew={flightCrewList}
          flights={flightsList}
          onMovementCreated={loadDashboardData}
        />
      )}

      {/* Seaways Voyage Movement Creation Modal */}
      {isSeaways && isVoyageModalOpen && (
        <CreateVoyageMovementModal
          isOpen={isVoyageModalOpen}
          onClose={() => setIsVoyageModalOpen(false)}
          ports={portsList}
          vessels={vesselsList}
          crew={seaCrewList}
          voyages={voyagesList}
          onMovementCreated={loadDashboardData}
        />
      )}

      {/* AI Assistant Widget */}
      <AiAssistantWidget />
    </div>
  );
};

export default Dashboard;
