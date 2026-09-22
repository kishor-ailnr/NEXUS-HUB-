export type UserRole = 'manager' | 'operator' | 'driver' | 'crew';

export type OrgMode = 'roadways' | 'railways' | 'airways' | 'seaways';

export const ORG_MODES: readonly OrgMode[] = ['roadways', 'railways', 'airways', 'seaways'] as const;

export function isValidOrgMode(mode: unknown): mode is OrgMode {
  return typeof mode === 'string' && ORG_MODES.includes(mode as OrgMode);
}

export interface Organization {
  id: string;
  name: string;
  mode: OrgMode;
  country: string;
  state: string;
  district: string;
  address: string;
  latitude?: number | null;
  longitude?: number | null;
  created_at: string;
}

export interface User {
  id: string;
  org_id: string;
  full_name: string;
  email: string;
  role: UserRole;
  created_at: string;
}

export interface UserProfile {
  id: string;
  email: string;
  fullName: string;
  role: UserRole;
  orgId: string;
  organization: {
    id: string;
    name: string;
    mode: OrgMode;
    country: string;
    state: string;
    district: string;
    address: string;
    latitude?: number | null;
    longitude?: number | null;
  };
}

export interface AuthSessionRequest {
  access_token: string;
  refresh_token: string;
  mode?: OrgMode;
}

export interface RegisterRequest {
  fullName: string;
  email: string;
  password: string;
  orgName: string;
  mode: OrgMode;
  country: string;
  state: string;
  district: string;
  address: string;
}

export interface AuthResponse {
  user: UserProfile;
  message?: string;
}

export interface StateDistricts {
  state: string;
  districts: string[];
}

// --- Notifications ---
export type NotificationType = 'system' | 'alert' | 'info';

export interface NotificationItem {
  id: string;
  orgId: string;
  userId?: string | null;
  type: NotificationType;
  title: string;
  body: string;
  actionLabel?: string | null;
  actionUrl?: string | null;
  readAt?: string | null;
  createdAt: string;
}

export interface CreateNotificationDto {
  userId?: string | null;
  type: NotificationType;
  title: string;
  body: string;
  actionLabel?: string | null;
  actionUrl?: string | null;
}

// --- Alerts ---
export type AlertSeverity = 'low' | 'medium' | 'high' | 'critical';

export interface AlertItem {
  id: string;
  orgId: string;
  type: string;
  severity: AlertSeverity;
  message: string;
  acknowledgedAt?: string | null;
  createdAt: string;
}

// --- Dashboard Stats & System Status ---
export interface StatField<T = number> {
  value: T;
  available: boolean;
  note?: string;
}

export interface DashboardStats {
  activeAlerts: number;
  activeVehicles: StatField<number>;
  totalFleetToday: StatField<number>;
  avgSpeedKmh: StatField<number>;
  arrivedCount: StatField<number>;
  departedCount: StatField<number>;
}

export interface SystemStatus {
  dbHealthy: boolean;
  wsGatewayHealthy: boolean;
  agentsHealthy: boolean;
  connectionCount?: number;
}

// --- Admin Module ---
export interface AdminUser {
  id: string;
  email: string;
  fullName: string;
  role: UserRole;
  createdAt?: string;
}

export interface AdminUpdateUserDto {
  fullName?: string;
  role?: UserRole;
}

export interface AdminReport {
  id: string;
  tripId: string;
  vehicleRegistration: string;
  driverName: string;
  originLabel: string;
  destinationLabel: string;
  completedAt: string;
  fileSizeBytes?: number;
  storagePath: string;
}

export interface TripReport {
  id: string;
  org_id: string;
  trip_id: string;
  storage_path: string;
  file_size_bytes?: number;
  generated_at: string;
}

export interface TripReportUrlResponse {
  tripId: string;
  signedUrl: string;
  storagePath: string;
  fileSizeBytes?: number;
  generatedAt: string;
}

// ==========================================
// Phase 4: Roadways Core Operational Models
// ==========================================

export type DriverStatus = 'available' | 'on_trip' | 'off_duty';

export interface DriverBehaviorScore {
  id: string;
  trip_id: string;
  driver_id: string;
  score: number;
  harsh_brake_count: number;
  speeding_event_count: number;
  computed_at: string;
}

export interface Driver {
  id: string;
  org_id: string;
  user_id: string;
  license_number: string;
  phone?: string | null;
  status: DriverStatus;
  created_at: string;
  user?: {
    id: string;
    email: string;
    full_name: string;
  };
  latest_score?: DriverBehaviorScore | null;
}

export interface CreateDriverDto {
  email: string;
  fullName: string;
  licenseNumber: string;
  phone?: string;
  password?: string;
}

export interface UpdateDriverDto {
  licenseNumber?: string;
  phone?: string;
  status?: DriverStatus;
}

export type VehicleStatus = 'idle' | 'active' | 'maintenance';

export interface Vehicle {
  id: string;
  org_id: string;
  registration_number: string;
  vehicle_type: string;
  capacity_kg?: number | null;
  status: VehicleStatus;
  assigned_driver_id?: string | null;
  created_at: string;
  driver?: Driver | null;
  latest_gps?: GPSPoint | null;
  active_trip?: Trip | null;
  convoy_id?: string | null;
  convoy_name?: string | null;
}

export interface CreateVehicleDto {
  registrationNumber: string;
  vehicleType: string;
  capacityKg?: number;
  assignedDriverId?: string;
}

export interface UpdateVehicleDto {
  registrationNumber?: string;
  vehicleType?: string;
  capacityKg?: number;
  status?: VehicleStatus;
  assignedDriverId?: string | null;
}

export interface CheckpointItem {
  label: string;
  lat: number;
  lng: number;
}

export interface SavedRoute {
  id: string;
  org_id: string;
  origin_label: string;
  destination_label: string;
  checkpoints: CheckpointItem[];
  osrm_geometry?: OsrmRouteGeometry | null;
  usage_count: number;
  updated_at: string;
}

export interface OsrmRouteGeometry {
  routing_source: 'osrm' | 'fallback-straight-line';
  coordinates: [number, number][]; // [lng, lat]
  distance_km: number;
  duration_minutes: number;
}

export type TripStatus = 'planned' | 'in_transit' | 'completed' | 'cancelled';

export interface TripCheckpoint {
  id: string;
  trip_id: string;
  sequence: number;
  label: string;
  lat: number;
  lng: number;
  eta?: string | null;
  arrived_at?: string | null;
}

export interface GhostPositionPayload {
  tripId: string;
  vehicleId: string;
  ghostLat: number;
  ghostLng: number;
  deviationMinutes: number;
  status: 'ahead' | 'behind' | 'on_schedule';
}

export interface Trip {
  id: string;
  org_id: string;
  vehicle_id: string;
  driver_id: string;
  origin_label: string;
  origin_lat?: number | null;
  origin_lng?: number | null;
  destination_label: string;
  destination_lat?: number | null;
  destination_lng?: number | null;
  status: TripStatus;
  distance_km?: number | null;
  duration_minutes?: number | null;
  predicted_duration_minutes?: number | null;
  actual_duration_minutes?: number | null;
  carbon_kg?: number | null;
  toll_estimate_inr?: number | null;
  simulation_speed_multiplier: number;
  started_at?: string | null;
  completed_at?: string | null;
  created_at: string;
  vehicle?: Vehicle;
  driver?: Driver;
  checkpoints?: TripCheckpoint[];
  route_geometry?: OsrmRouteGeometry | null;
  driver_score?: DriverBehaviorScore | null;
  ghost_position?: GhostPositionPayload | null;
}

export interface CreateTripDto {
  vehicleId: string;
  driverId: string;
  originAddress: string;
  destinationAddress: string;
  checkpoints?: CheckpointItem[];
  simulationSpeedMultiplier?: number;
}

export interface UpdateTripStatusDto {
  status: TripStatus;
}

export interface AddCheckpointDto {
  label: string;
  lat: number;
  lng: number;
}

export interface GPSPoint {
  id: string;
  trip_id: string;
  vehicle_id: string;
  lat: number;
  lng: number;
  speed_kmh: number;
  heading?: number | null;
  recorded_at: string;
}

export interface Geofence {
  id: string;
  org_id: string;
  name: string;
  type: string;
  center_lat: number;
  center_lng: number;
  radius_m: number;
  created_at: string;
}

export interface CreateGeofenceDto {
  name: string;
  type: string;
  centerLat: number;
  centerLng: number;
  radiusM: number;
}

export type GeofenceEventType = 'enter' | 'exit';

export interface GeofenceEvent {
  id: string;
  geofence_id: string;
  vehicle_id: string;
  event_type: GeofenceEventType;
  occurred_at: string;
  geofence?: Geofence;
  vehicle?: Vehicle;
}

export interface ConvoyGroup {
  id: string;
  org_id: string;
  name: string;
  created_at: string;
  members?: {
    id: string;
    convoy_id: string;
    vehicle_id: string;
    joined_at: string;
    vehicle?: Vehicle;
  }[];
}

export interface CreateConvoyDto {
  name: string;
  vehicleIds?: string[];
}

export interface HosLog {
  id: string;
  driver_id: string;
  trip_id?: string | null;
  drive_minutes: number;
  window_started_at: string;
  window_ended_at: string;
  violation: boolean;
}

// ==========================================
// Phase 5: Intelligence Layer Models
// ==========================================

export interface TripEtaResponse {
  trip_id: string;
  remaining_distance_km: number;
  base_eta_minutes: number;
  min_eta_minutes: number;
  max_eta_minutes: number;
  confidence_band_minutes: number;
  confidence_basis: 'historical' | 'default';
  sample_size: number;
  calculated_at: string;
}

export interface AiToolCall {
  name: string;
  args: any;
  result?: any;
}

export interface AiProposedAction {
  id: string;
  actionType: 'acknowledge_alert';
  description: string;
  payload: any;
  status: 'pending' | 'confirmed' | 'rejected';
}

export interface AiChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  toolCalls?: AiToolCall[];
  proposedAction?: AiProposedAction | null;
  isFallback?: boolean;
  createdAt: string;
}

export interface AiChatRequest {
  message: string;
  conversationHistory?: { role: 'user' | 'assistant'; content: string }[];
}

export interface AiConfirmActionRequest {
  actionId: string;
  actionType: 'acknowledge_alert';
  payload: any;
  confirmed: boolean;
}

// ==========================================
// Phase 7A-1: Railways Core Operational Models
// ==========================================

export type StationType = 'station' | 'yard' | 'junction';

export interface Station {
  id: string;
  org_id: string;
  name: string;
  station_code?: string | null;
  lat: number | null;
  lng: number | null;
  station_type: StationType;
  created_at: string;
}

export interface CreateStationDto {
  name: string;
  station_code?: string;
  address?: string; // used by GeocodingService if lat/lng not provided
  lat?: number;
  lng?: number;
  station_type?: StationType;
}

export type LocoFuelType = 'electric' | 'diesel';
export type LocoStatus = 'idle' | 'active' | 'maintenance';

export interface Locomotive {
  id: string;
  org_id: string;
  loco_number: string;
  loco_type: string;
  power_kw?: number | null;
  fuel_type: LocoFuelType;
  status: LocoStatus;
  created_at: string;
}

export interface CreateLocomotiveDto {
  loco_number: string;
  loco_type: string;
  power_kw?: number;
  fuel_type: LocoFuelType;
  status?: LocoStatus;
}

export interface RakeCompositionItem {
  type: string;
  count: number;
}

export interface Rake {
  id: string;
  org_id: string;
  rake_id: string;
  composition: RakeCompositionItem[];
  created_at: string;
}

export interface CreateRakeDto {
  rake_id: string;
  composition?: RakeCompositionItem[];
}

export type LocoPilotStatus = 'available' | 'on_duty' | 'off_duty';

export interface LocoPilot {
  id: string;
  org_id: string;
  user_id: string;
  license_number: string;
  phone?: string | null;
  status: LocoPilotStatus;
  created_at: string;
  user?: {
    id: string;
    email: string;
    full_name: string;
  } | null;
}

export interface CreateLocoPilotDto {
  fullName: string;
  email: string;
  licenseNumber: string;
  phone?: string;
  password?: string;
}

export type TrainStatus = 'idle' | 'active' | 'maintenance';

export interface Train {
  id: string;
  org_id: string;
  train_number: string;
  train_name?: string | null;
  locomotive_id?: string | null;
  rake_id?: string | null;
  status: TrainStatus;
  created_at: string;
  locomotive?: Locomotive | null;
  rake?: Rake | null;
}

export interface CreateTrainDto {
  train_number: string;
  train_name?: string;
  locomotive_id?: string;
  rake_id?: string;
  status?: TrainStatus;
}

export type RailRoutingSource = 'overpass' | 'fallback-straight-line' | 'pending';

export interface SavedRailRoute {
  id: string;
  org_id: string;
  origin_station_id: string;
  destination_station_id: string;
  intermediate_stations: { station_id: string; sequence: number }[];
  route_geometry: {
    type: string;
    coordinates: [number, number][]; // [lng, lat]
    distance_km?: number;
    duration_minutes?: number;
    routing_source?: RailRoutingSource;
  } | null;
  routing_source: RailRoutingSource;
  usage_count: number;
  updated_at: string;
  origin_station?: Station;
  destination_station?: Station;
}

export type TrainMovementStatus = 'planned' | 'in_transit' | 'completed' | 'cancelled';

export interface TrainMovementStop {
  id: string;
  movement_id: string;
  station_id: string;
  sequence: number;
  eta?: string | null;
  arrived_at?: string | null;
  departed_at?: string | null;
  station?: Station;
}

export interface TrainMovement {
  id: string;
  org_id: string;
  train_id: string;
  loco_pilot_id: string;
  origin_station_id: string;
  destination_station_id: string;
  status: TrainMovementStatus;
  distance_km?: number | null;
  duration_minutes?: number | null;
  predicted_duration_minutes?: number | null;
  actual_duration_minutes?: number | null;
  carbon_kg?: number | null;
  simulation_speed_multiplier: number;
  started_at?: string | null;
  completed_at?: string | null;
  created_at: string;
  train?: Train;
  loco_pilot?: LocoPilot;
  origin_station?: Station;
  destination_station?: Station;
  stops?: TrainMovementStop[];
  crew_score?: CrewBehaviorScore | null;
  ghost_position?: GhostPositionPayload | null;
  route_geometry?: {
    type: string;
    coordinates: [number, number][];
    distance_km?: number;
    duration_minutes?: number;
    routing_source?: RailRoutingSource;
  } | null;
}

export interface CreateTrainMovementDto {
  trainId: string;
  locoPilotId: string;
  originStationId: string;
  destinationStationId: string;
  intermediateStationIds?: string[];
  simulationSpeedMultiplier?: number;
  proposedDeparture?: string;
}

export interface TrainTelemetry {
  id: string;
  movement_id: string;
  train_id: string;
  lat: number;
  lng: number;
  speed_kmh: number;
  heading?: number | null;
  recorded_at: string;
}

export interface LiveRailTelemetryPayload {
  movementId: string;
  trainId: string;
  lat: number;
  lng: number;
  speedKmh?: number;
  heading?: number;
  progressPercent?: number;
  recordedAt?: string;
  speed_kmh?: number;
  recorded_at?: string;
  trainNumber?: string;
  trainName?: string;
  simulated?: boolean;
}

// ==========================================
// Phase 7A-2: Railways Intelligence Layer Models
// ==========================================

export interface CrewBehaviorScore {
  id: string;
  movement_id: string;
  loco_pilot_id: string;
  score: number;
  harsh_brake_count: number;
  overspeed_event_count: number;
  computed_at: string;
}

export interface TrainMovementEtaResponse {
  movement_id: string;
  remaining_distance_km: number;
  base_eta_minutes: number;
  min_eta_minutes: number;
  max_eta_minutes: number;
  confidence_band_minutes: number;
  confidence_basis: 'historical' | 'default';
  sample_size: number;
  calculated_at: string;
}

export interface RailSlotCheckResponse {
  originStationId: string;
  destinationStationId: string;
  proposedDeparture: string;
  congested: boolean;
  overlapCount: number;
  threshold: number;
  reason?: string;
  suggestedDeparture?: string;
  alternativeSlots?: string[];
}

export interface TrainMovementReportUrlResponse {
  movementId: string;
  signedUrl: string;
  storagePath: string;
  fileSizeBytes: number;
  generatedAt: string;
}

export interface AdminRailReport {
  id: string;
  movementId: string;
  trainNumber: string;
  trainName?: string;
  locoPilotName: string;
  originStationName: string;
  destinationStationName: string;
  completedAt: string;
  fileSizeBytes?: number;
  storagePath: string;
  carbonKg?: number;
  crewScore?: number;
}

// ==========================================
// Phase 7B-1: Airways Core Operational Models
// ==========================================

export interface Airport {
  id: string;
  org_id: string;
  name: string;
  iata_code?: string | null;
  icao_code?: string | null;
  lat: number | null;
  lng: number | null;
  created_at: string;
}

export interface CreateAirportDto {
  name: string;
  iata_code?: string;
  icao_code?: string;
  address?: string; // used by GeocodingService if lat/lng not provided
  lat?: number;
  lng?: number;
}

export type AircraftStatus = 'idle' | 'active' | 'maintenance';

export interface Aircraft {
  id: string;
  org_id: string;
  tail_number: string;
  aircraft_type: string;
  cargo_capacity_kg?: number | null;
  status: AircraftStatus;
  created_at: string;
}

export interface CreateAircraftDto {
  tail_number: string;
  aircraft_type: string;
  cargo_capacity_kg?: number;
  status?: AircraftStatus;
}

export type FlightCrewRole = 'pilot' | 'cabin';
export type FlightCrewStatus = 'available' | 'on_duty' | 'off_duty';

export interface FlightCrew {
  id: string;
  org_id: string;
  user_id: string;
  license_number: string;
  crew_role: FlightCrewRole;
  status: FlightCrewStatus;
  created_at: string;
  user?: {
    id: string;
    email: string;
    full_name: string;
  } | null;
}

export interface CreateFlightCrewDto {
  fullName: string;
  email: string;
  licenseNumber: string;
  phone?: string;
  crewRole?: FlightCrewRole;
  status?: FlightCrewStatus;
  password?: string;
}

export interface Flight {
  id: string;
  org_id: string;
  flight_number: string;
  origin_airport_id: string;
  destination_airport_id: string;
  created_at: string;
  origin_airport?: Airport | null;
  destination_airport?: Airport | null;
}

export interface CreateFlightDto {
  flight_number: string;
  origin_airport_id: string;
  destination_airport_id: string;
}

export type FlightMovementStatus = 'planned' | 'in_transit' | 'completed' | 'cancelled';
export type FlightRoutingMethod = 'great-circle';

export interface FlightMovement {
  id: string;
  org_id: string;
  flight_id: string;
  aircraft_id: string;
  pilot_id: string;
  status: FlightMovementStatus;
  routing_method: FlightRoutingMethod;
  distance_km?: number | null;
  duration_minutes?: number | null;
  predicted_duration_minutes?: number | null;
  actual_duration_minutes?: number | null;
  carbon_kg?: number | null;
  simulation_speed_multiplier: number;
  started_at?: string | null;
  completed_at?: string | null;
  created_at: string;
  flight?: Flight | null;
  aircraft?: Aircraft | null;
  pilot?: FlightCrew | null;
  latest_telemetry?: FlightTelemetry | null;
  crew_score?: CrewFlightScore | null;
  duty_log?: FlightDutyLog | null;
  ghost_position?: GhostPositionPayload | null;
}

export interface CreateFlightMovementDto {
  flightId?: string;
  flight_id?: string;
  flightNumber?: string;
  flight_number?: string;
  originAirportId?: string;
  origin_airport_id?: string;
  destinationAirportId?: string;
  destination_airport_id?: string;
  aircraftId?: string;
  aircraft_id?: string;
  pilotId?: string;
  pilot_id?: string;
  simulationSpeedMultiplier?: number;
  simulation_speed_multiplier?: number;
  proposedDeparture?: string;
}

export interface FlightTelemetry {
  id: string;
  movement_id: string;
  aircraft_id: string;
  lat: number;
  lng: number;
  altitude_ft?: number | null;
  speed_kts: number;
  heading?: number | null;
  recorded_at: string;
}

export interface LiveFlightTelemetryPayload {
  movementId: string;
  flightId: string;
  aircraftId: string;
  pilotId: string;
  flightNumber: string;
  tailNumber: string;
  aircraftType: string;
  pilotName: string;
  originAirportName: string;
  destinationAirportName: string;
  lat: number;
  lng: number;
  altitudeFt: number;
  speedKts: number;
  heading: number;
  status: FlightMovementStatus;
  progressPercent: number;
  distanceKm: number;
  durationMinutes: number;
  timestamp: string;
}

// ==========================================
// Phase 7B-2: Airways Intelligence Layer Models
// ==========================================

export interface CrewFlightScore {
  id: string;
  movement_id: string;
  pilot_id: string;
  score: number;
  abrupt_maneuver_count: number;
  overspeed_event_count: number;
  computed_at: string;
}

export interface FlightDutyLog {
  id: string;
  pilot_id: string;
  movement_id?: string | null;
  duty_minutes: number;
  window_started_at: string;
  window_ended_at: string;
  violation: boolean;
  created_at?: string;
}

export interface FlightMovementEtaResponse {
  movement_id: string;
  remaining_distance_km: number;
  base_eta_minutes: number;
  min_eta_minutes: number;
  max_eta_minutes: number;
  confidence_band_minutes: number;
  confidence_basis: 'historical' | 'default';
  sample_size: number;
  calculated_at: string;
}

export interface AirportSlotCheckResponse {
  departureAirportId: string;
  arrivalAirportId: string;
  proposedDeparture: string;
  congested: boolean;
  departureSlotCount: number;
  arrivalSlotCount: number;
  threshold: number;
  departureSlotCongested?: boolean;
  arrivalSlotCongested?: boolean;
  departureMovementsCount?: number;
  advisoryMessage?: string;
  reason?: string;
  suggestedDeparture?: string;
  suggestedDepartureTime?: string;
  suggestedArrival?: string;
  alternativeSlots?: string[];
}

export interface FlightMovementReportUrlResponse {
  movementId: string;
  signedUrl: string;
  storagePath: string;
  fileSizeBytes: number;
  generatedAt: string;
}

export interface AdminFlightReport {
  id: string;
  movementId: string;
  flightNumber: string;
  aircraftTail?: string;
  pilotName: string;
  originAirportName: string;
  originIataCode?: string;
  destinationAirportName: string;
  destIataCode?: string;
  completedAt: string;
  fileSizeBytes?: number;
  storagePath: string;
  carbonKg?: number;
  crewScore?: number;
}

// ==========================================
// Phase 7C-1: Seaways Core Operational Models
// ==========================================

export interface Port {
  id: string;
  org_id: string;
  name: string;
  unlocode?: string | null;
  lat: number | null;
  lng: number | null;
  created_at: string;
}

export interface CreatePortDto {
  name: string;
  unlocode?: string;
  address?: string; // used by GeocodingService if lat/lng not provided
  lat?: number;
  lng?: number;
}

export type VesselStatus = 'idle' | 'active' | 'maintenance';

export interface Vessel {
  id: string;
  org_id: string;
  vessel_name: string;
  imo_number?: string | null;
  vessel_type: string;
  dwt_tonnes?: number | null;
  teu_capacity?: number | null;
  status: VesselStatus;
  created_at: string;
}

export interface CreateVesselDto {
  vessel_name: string;
  vesselName?: string;
  imo_number?: string;
  imoNumber?: string;
  vessel_type: string;
  vesselType?: string;
  dwt_tonnes?: number;
  dwtTonnes?: number;
  teu_capacity?: number;
  teuCapacity?: number;
  status?: VesselStatus;
}

export type SeaCrewRole = 'master' | 'officer' | 'rating';
export type SeaCrewStatus = 'available' | 'on_duty' | 'off_duty';

export interface SeaCrew {
  id: string;
  org_id: string;
  user_id: string;
  certificate_number: string;
  crew_role: SeaCrewRole;
  status: SeaCrewStatus;
  created_at: string;
  user?: {
    id: string;
    email: string;
    full_name: string;
  } | null;
}

export interface CreateSeaCrewDto {
  fullName: string;
  email: string;
  certificateNumber: string;
  phone?: string;
  crewRole?: SeaCrewRole;
  status?: SeaCrewStatus;
  password?: string;
}

export interface Voyage {
  id: string;
  org_id: string;
  voyage_number: string;
  origin_port_id: string;
  destination_port_id: string;
  created_at: string;
  origin_port?: Port | null;
  destination_port?: Port | null;
}

export interface CreateVoyageDto {
  voyage_number: string;
  origin_port_id: string;
  destination_port_id: string;
}

export type SeaRoutingSource = 'searoute' | 'fallback-chokepoint' | 'pending';

export interface SavedSeaRoute {
  id: string;
  org_id: string;
  origin_port_id: string;
  destination_port_id: string;
  route_geometry: {
    type: string;
    coordinates: [number, number][]; // [lng, lat]
    distance_km?: number;
    duration_minutes?: number;
    routing_source?: SeaRoutingSource;
  } | null;
  routing_source: SeaRoutingSource;
  usage_count: number;
  updated_at: string;
  origin_port?: Port | null;
  destination_port?: Port | null;
}

export type VoyageMovementStatus = 'planned' | 'in_transit' | 'completed' | 'cancelled';

export interface VoyageMovement {
  id: string;
  org_id: string;
  voyage_id: string;
  vessel_id: string;
  master_id: string;
  status: VoyageMovementStatus;
  distance_km?: number | null;
  duration_minutes?: number | null;
  predicted_duration_minutes?: number | null;
  actual_duration_minutes?: number | null;
  carbon_kg?: number | null;
  simulation_speed_multiplier: number;
  started_at?: string | null;
  completed_at?: string | null;
  created_at: string;
  voyage?: Voyage | null;
  vessel?: Vessel | null;
  master?: SeaCrew | null;
  latest_telemetry?: VesselTelemetry | null;
  crew_score?: SeaCrewScore | null;
  watchkeeping_log?: WatchkeepingLog | null;
  ghost_position?: GhostPositionPayload | null;
  route_geometry?: {
    type: string;
    coordinates: [number, number][];
    distance_km?: number;
    duration_minutes?: number;
    routing_source?: SeaRoutingSource;
  } | null;
}

export interface CreateVoyageMovementDto {
  voyageId?: string;
  voyage_id?: string;
  voyageNumber?: string;
  voyage_number?: string;
  originPortId?: string;
  origin_port_id?: string;
  destinationPortId?: string;
  destination_port_id?: string;
  vesselId?: string;
  vessel_id?: string;
  masterId?: string;
  master_id?: string;
  simulationSpeedMultiplier?: number;
  simulation_speed_multiplier?: number;
  proposedDeparture?: string;
}

export interface VesselTelemetry {
  id: string;
  movement_id: string;
  vessel_id: string;
  lat: number;
  lng: number;
  speed_knots: number;
  heading?: number | null;
  recorded_at: string;
}

export interface LiveVesselTelemetryPayload {
  movementId: string;
  voyageId: string;
  vesselId: string;
  masterId: string;
  voyageNumber: string;
  vesselName: string;
  vesselType: string;
  imoNumber?: string;
  masterName: string;
  originPortName: string;
  destinationPortName: string;
  lat: number;
  lng: number;
  speedKnots: number;
  heading: number;
  status: VoyageMovementStatus;
  progressPercent: number;
  distanceKm: number;
  durationMinutes: number;
  timestamp: string;
  simulated?: boolean;
}

export interface SeaConvoyMember {
  id: string;
  convoy_id: string;
  vessel_id: string;
  joined_at: string;
  vessel?: Vessel | null;
}

export interface SeaConvoyGroup {
  id: string;
  org_id: string;
  name: string;
  created_at: string;
  members?: SeaConvoyMember[];
}

export interface CreateSeaConvoyDto {
  name: string;
  vessel_ids?: string[];
}

export interface AddVesselToConvoyDto {
  vessel_id: string;
}

// ==========================================
// Phase 7C-2: Seaways Intelligence Layer Models
// ==========================================

export interface SeaCrewScore {
  id: string;
  movement_id: string;
  crew_id: string;
  score: number;
  harsh_maneuver_count: number;
  overspeed_event_count: number;
  computed_at: string;
}

export interface WatchkeepingLog {
  id: string;
  crew_id: string;
  movement_id?: string | null;
  duty_minutes: number;
  rest_minutes: number;
  window_started_at: string;
  window_ended_at: string;
  violation: boolean;
  created_at?: string;
}

export interface VoyageMovementEtaResponse {
  movement_id: string;
  remaining_distance_km: number;
  base_eta_minutes: number;
  min_eta_minutes: number;
  max_eta_minutes: number;
  confidence_band_minutes: number;
  confidence_basis: 'historical' | 'default';
  sample_size: number;
  calculated_at: string;
}

export interface PortSlotCheckResponse {
  originPortId: string;
  destinationPortId: string;
  proposedDeparture: string;
  congested: boolean;
  originSlotCount: number;
  destinationSlotCount: number;
  threshold: number;
  originSlotCongested?: boolean;
  destinationSlotCongested?: boolean;
  reason?: string;
  suggestedDeparture?: string;
  suggestedDepartureTime?: string;
  suggestedArrival?: string;
  alternativeSlots?: string[];
}

export interface VoyageMovementReportUrlResponse {
  movementId: string;
  signedUrl: string;
  storagePath: string;
  fileSizeBytes: number;
  generatedAt: string;
}

export interface AdminSeaReport {
  id: string;
  movementId: string;
  voyageNumber: string;
  vesselName?: string;
  imoNumber?: string;
  vesselType?: string;
  masterName: string;
  originPortName: string;
  originPortCode?: string;
  originUnlocode?: string;
  destinationPortName?: string;
  destPortName?: string;
  destinationPortCode?: string;
  destPortCode?: string;
  destUnlocode?: string;
  completedAt: string;
  fileSizeBytes?: number;
  storagePath: string;
  carbonKg?: number;
  crewScore?: number;
}
// ==========================================
// Phase 8: Cross-Org Platform Hub Stats
// ==========================================

export interface ModeHubStats {
  activeMovements: number;
}

export interface PlatformHubStatsResponse {
  roadways: ModeHubStats;
  railways: ModeHubStats;
  airways: ModeHubStats;
  seaways: ModeHubStats;
}
