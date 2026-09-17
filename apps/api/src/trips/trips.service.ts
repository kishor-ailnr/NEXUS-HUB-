import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { GeocodingService } from '../geocoding/geocoding.service';
import { RoutingService, RouteWaypoint } from '../routing/routing.service';
import { RealtimeGateway } from '../realtime/realtime.gateway';
import { SimulationService } from '../tracking/simulation.service';
import { EtaService } from '../intelligence/eta.service';
import { TollService } from '../intelligence/toll.service';
import { PdfReportService } from '../reports/pdf-report.service';
import {
  CreateTripDto,
  UpdateTripStatusDto,
  AddCheckpointDto,
  Trip,
  SavedRoute,
  OsrmRouteGeometry,
  TripEtaResponse,
  TripReportUrlResponse,
} from '@nexus-ways/shared';

@Injectable()
export class TripsService {
  private readonly logger = new Logger(TripsService.name);

  constructor(
    private readonly supabase: SupabaseService,
    private readonly geocodingService: GeocodingService,
    private readonly routingService: RoutingService,
    private readonly simulationService: SimulationService,
    private readonly realtimeGateway: RealtimeGateway,
    private readonly etaService: EtaService,
    private readonly tollService: TollService,
    private readonly pdfReportService: PdfReportService,
  ) {}

  async findAll(orgId: string): Promise<Trip[]> {
    const { data: trips, error } = await this.supabase.adminClient
      .from('trips')
      .select(`
        *,
        vehicle:vehicles(*),
        driver:drivers(*, user:users(id, email, full_name))
      `)
      .eq('org_id', orgId)
      .order('created_at', { ascending: false });

    if (error) {
      this.logger.error(`Failed to list trips: ${error.message}`);
      throw new BadRequestException('Failed to list trips');
    }

    if (!trips || trips.length === 0) {
      return [];
    }

    const tripIds = trips.map((t) => t.id);

    // Fetch checkpoints
    const { data: allCheckpoints } = await this.supabase.adminClient
      .from('trip_checkpoints')
      .select('*')
      .in('trip_id', tripIds)
      .order('sequence', { ascending: true });

    // Fetch driver behavior scores
    const { data: allScores } = await this.supabase.adminClient
      .from('driver_behavior_scores')
      .select('*')
      .in('trip_id', tripIds);

    const cpByTrip = new Map<string, any[]>();
    (allCheckpoints || []).forEach((cp) => {
      const list = cpByTrip.get(cp.trip_id) || [];
      list.push(cp);
      cpByTrip.set(cp.trip_id, list);
    });

    const scoreByTrip = new Map<string, any>();
    (allScores || []).forEach((sc) => {
      scoreByTrip.set(sc.trip_id, sc);
    });

    return trips.map((t) => ({
      ...t,
      checkpoints: cpByTrip.get(t.id) || t.checkpoints || [],
      driver_score: scoreByTrip.get(t.id) || null,
    }));
  }

  async findSavedRoutes(orgId: string, origin?: string, destination?: string): Promise<SavedRoute[]> {
    let query = this.supabase.adminClient
      .from('saved_routes')
      .select('*')
      .eq('org_id', orgId);

    if (origin && origin.trim()) {
      query = query.ilike('origin_label', `%${origin.trim()}%`);
    }
    if (destination && destination.trim()) {
      query = query.ilike('destination_label', `%${destination.trim()}%`);
    }

    const { data, error } = await query.order('usage_count', { ascending: false });

    if (error) {
      this.logger.warn(`Failed to list saved routes: ${error.message}`);
      return [];
    }

    return data || [];
  }

  async getEta(orgId: string, id: string): Promise<TripEtaResponse> {
    return this.etaService.calculateTripEtaConfidence(orgId, id);
  }

  async findOne(orgId: string, id: string): Promise<Trip> {
    const { data: trip, error } = await this.supabase.adminClient
      .from('trips')
      .select(`
        *,
        vehicle:vehicles(*),
        driver:drivers(*, user:users(id, email, full_name))
      `)
      .eq('org_id', orgId)
      .eq('id', id)
      .maybeSingle();

    if (error || !trip) {
      throw new NotFoundException('Trip not found');
    }

    // Fetch checkpoints
    const { data: checkpoints } = await this.supabase.adminClient
      .from('trip_checkpoints')
      .select('*')
      .eq('trip_id', id)
      .order('sequence', { ascending: true });

    trip.checkpoints = checkpoints || trip.checkpoints || [];

    // Fetch driver score
    const { data: driverScore } = await this.supabase.adminClient
      .from('driver_behavior_scores')
      .select('*')
      .eq('trip_id', id)
      .maybeSingle();

    trip.driver_score = driverScore || null;

    // Try to load cached geometry for the trip's origin & destination
    if (trip.origin_label && trip.destination_label) {
      const { data: savedRoute } = await this.supabase.adminClient
        .from('saved_routes')
        .select('osrm_geometry')
        .eq('org_id', orgId)
        .eq('origin_label', trip.origin_label)
        .eq('destination_label', trip.destination_label)
        .maybeSingle();

      if (savedRoute?.osrm_geometry) {
        trip.route_geometry = savedRoute.osrm_geometry;
      }
    }

    return trip;
  }

  async create(orgId: string, dto: CreateTripDto): Promise<Trip> {
    if (!dto.vehicleId || !dto.driverId || !dto.originAddress || !dto.destinationAddress) {
      throw new BadRequestException('Vehicle, driver, origin address, and destination address are required');
    }

    const originLabel = dto.originAddress.trim();
    const destLabel = dto.destinationAddress.trim();

    // 1. Geocode origin and destination
    let originCoords = await this.geocodingService.geocodeAddress(originLabel);
    let destCoords = await this.geocodingService.geocodeAddress(destLabel);

    // Fallbacks if geocoder returns null
    if (!originCoords) {
      this.logger.warn(`Could not geocode origin "${originLabel}", using default hub origin`);
      originCoords = { latitude: 19.076, longitude: 72.8777 }; // Mumbai default
    }
    if (!destCoords) {
      this.logger.warn(`Could not geocode destination "${destLabel}", using default hub destination`);
      destCoords = { latitude: 18.5204, longitude: 73.8567 }; // Pune default
    }

    // 2. Check saved_routes for checkpoint memory and cached route geometry
    let checkpointsToUse = dto.checkpoints || [];
    const { data: existingSavedRoute } = await this.supabase.adminClient
      .from('saved_routes')
      .select('*')
      .eq('org_id', orgId)
      .eq('origin_label', originLabel)
      .eq('destination_label', destLabel)
      .maybeSingle();

    if (existingSavedRoute && (!dto.checkpoints || dto.checkpoints.length === 0)) {
      if (Array.isArray(existingSavedRoute.checkpoints) && existingSavedRoute.checkpoints.length > 0) {
        this.logger.log(`Recalling ${existingSavedRoute.checkpoints.length} saved checkpoints from checkpoint memory for ${originLabel} -> ${destLabel}`);
        checkpointsToUse = existingSavedRoute.checkpoints;
      }
    }

    // 3. Assemble all waypoints for routing
    const waypoints: RouteWaypoint[] = [
      { lat: originCoords.latitude, lng: originCoords.longitude, label: originLabel },
      ...checkpointsToUse.map((cp) => ({ lat: cp.lat, lng: cp.lng, label: cp.label })),
      { lat: destCoords.latitude, lng: destCoords.longitude, label: destLabel },
    ];

    // 4. Calculate route (via OSRM with caching in saved_routes)
    const routeGeometry: OsrmRouteGeometry = await this.routingService.getRoute(
      orgId,
      waypoints,
      originLabel,
      destLabel,
    );

    const tollEstimate = this.tollService.calculateTripToll(routeGeometry.distance_km);
    const speedMultiplier = dto.simulationSpeedMultiplier || 60;

    // 5. Insert trip with Phase 5 intelligence columns: predicted_duration_minutes & toll_estimate_inr
    const { data: newTrip, error: tripError } = await this.supabase.adminClient
      .from('trips')
      .insert({
        org_id: orgId,
        vehicle_id: dto.vehicleId,
        driver_id: dto.driverId,
        origin_label: originLabel,
        origin_lat: originCoords.latitude,
        origin_lng: originCoords.longitude,
        destination_label: destLabel,
        destination_lat: destCoords.latitude,
        destination_lng: destCoords.longitude,
        status: 'planned',
        distance_km: routeGeometry.distance_km,
        duration_minutes: routeGeometry.duration_minutes,
        predicted_duration_minutes: routeGeometry.duration_minutes,
        toll_estimate_inr: tollEstimate.tollEstimateInr,
        simulation_speed_multiplier: speedMultiplier,
      })
      .select()
      .single();

    if (tripError) {
      this.logger.error(`Failed to create trip: ${tripError.message}`);
      throw new BadRequestException('Failed to create trip');
    }

    // 6. Insert trip checkpoints if any
    if (checkpointsToUse.length > 0) {
      const checkpointInserts = checkpointsToUse.map((cp, idx) => ({
        trip_id: newTrip.id,
        sequence: idx + 1,
        label: cp.label,
        lat: cp.lat,
        lng: cp.lng,
      }));

      await this.supabase.adminClient
        .from('trip_checkpoints')
        .insert(checkpointInserts);
    }

    return this.findOne(orgId, newTrip.id);
  }

  async addCheckpoint(orgId: string, tripId: string, dto: AddCheckpointDto): Promise<Trip> {
    const trip = await this.findOne(orgId, tripId);

    if (trip.status === 'completed' || trip.status === 'cancelled') {
      throw new BadRequestException('Cannot add checkpoint to a completed or cancelled trip');
    }

    const currentCheckpoints = trip.checkpoints || [];
    const nextSeq = currentCheckpoints.length + 1;

    const { error } = await this.supabase.adminClient
      .from('trip_checkpoints')
      .insert({
        trip_id: tripId,
        sequence: nextSeq,
        label: dto.label,
        lat: dto.lat,
        lng: dto.lng,
      });

    if (error) {
      throw new BadRequestException('Failed to add checkpoint');
    }

    // Recalculate route with new checkpoint
    const updatedTrip = await this.findOne(orgId, tripId);
    const waypoints: RouteWaypoint[] = [
      { lat: updatedTrip.origin_lat || 0, lng: updatedTrip.origin_lng || 0, label: updatedTrip.origin_label },
      ...(updatedTrip.checkpoints || []).map((cp) => ({ lat: cp.lat, lng: cp.lng, label: cp.label })),
      { lat: updatedTrip.destination_lat || 0, lng: updatedTrip.destination_lng || 0, label: updatedTrip.destination_label },
    ];

    const newGeometry = await this.routingService.getRoute(
      orgId,
      waypoints,
      updatedTrip.origin_label,
      updatedTrip.destination_label,
    );

    const tollEstimate = this.tollService.calculateTripToll(newGeometry.distance_km);

    // Update trip distance/duration & intelligence metrics
    await this.supabase.adminClient
      .from('trips')
      .update({
        distance_km: newGeometry.distance_km,
        duration_minutes: newGeometry.duration_minutes,
        predicted_duration_minutes: newGeometry.duration_minutes,
        toll_estimate_inr: tollEstimate.tollEstimateInr,
      })
      .eq('id', tripId);

    // If currently simulating, restart simulation with new geometry
    if (this.simulationService.isSimulating(tripId)) {
      this.simulationService.startTripSimulation(
        tripId,
        orgId,
        updatedTrip.vehicle_id,
        updatedTrip.driver_id,
        newGeometry,
        updatedTrip.simulation_speed_multiplier,
        updatedTrip.origin_label,
        updatedTrip.destination_label,
      );
    }

    return this.findOne(orgId, tripId);
  }

  async updateStatus(orgId: string, tripId: string, dto: UpdateTripStatusDto): Promise<Trip> {
    const trip = await this.findOne(orgId, tripId);
    const newStatus = dto.status;

    if (newStatus === 'in_transit') {
      if (trip.status === 'in_transit') {
        return trip;
      }

      const startedAt = new Date().toISOString();

      // Update trip to in_transit
      await this.supabase.adminClient
        .from('trips')
        .update({
          status: 'in_transit',
          started_at: startedAt,
        })
        .eq('id', tripId);

      // Update vehicle to active
      await this.supabase.adminClient
        .from('vehicles')
        .update({ status: 'active' })
        .eq('id', trip.vehicle_id);

      // Update driver to on_trip
      await this.supabase.adminClient
        .from('drivers')
        .update({ status: 'on_trip' })
        .eq('id', trip.driver_id);

      // Fetch or compute route geometry
      const waypoints: RouteWaypoint[] = [
        { lat: trip.origin_lat || 0, lng: trip.origin_lng || 0, label: trip.origin_label },
        ...(trip.checkpoints || []).map((cp) => ({ lat: cp.lat, lng: cp.lng, label: cp.label })),
        { lat: trip.destination_lat || 0, lng: trip.destination_lng || 0, label: trip.destination_label },
      ];

      const routeGeometry = await this.routingService.getRoute(
        orgId,
        waypoints,
        trip.origin_label,
        trip.destination_label,
      );

      // Start live tracking simulation engine with digital twin projection
      this.simulationService.startTripSimulation(
        tripId,
        orgId,
        trip.vehicle_id,
        trip.driver_id,
        routeGeometry,
        trip.simulation_speed_multiplier,
        trip.origin_label,
        trip.destination_label,
      );

      this.realtimeGateway.broadcastToOrg(orgId, 'tracking:trip_status', {
        tripId,
        vehicleId: trip.vehicle_id,
        driverId: trip.driver_id,
        status: 'in_transit',
        startedAt,
      });
    } else if (newStatus === 'completed') {
      this.simulationService.stopSimulation(tripId);
      const completedAt = new Date().toISOString();

      await this.supabase.adminClient
        .from('trips')
        .update({
          status: 'completed',
          completed_at: completedAt,
        })
        .eq('id', tripId);

      await this.supabase.adminClient
        .from('vehicles')
        .update({ status: 'idle' })
        .eq('id', trip.vehicle_id);

      await this.supabase.adminClient
        .from('drivers')
        .update({ status: 'available' })
        .eq('id', trip.driver_id);

      this.realtimeGateway.broadcastToOrg(orgId, 'tracking:trip_status', {
        tripId,
        vehicleId: trip.vehicle_id,
        driverId: trip.driver_id,
        status: 'completed',
        completedAt,
      });

      // Generate trip audit PDF report asynchronously
      this.pdfReportService.generateAndStoreTripReport(orgId, tripId).catch((err) => {
        this.logger.warn(`Failed to auto-generate PDF report for trip ${tripId}: ${err.message}`);
      });
    } else if (newStatus === 'cancelled') {
      this.simulationService.stopSimulation(tripId);

      await this.supabase.adminClient
        .from('trips')
        .update({
          status: 'cancelled',
        })
        .eq('id', tripId);

      await this.supabase.adminClient
        .from('vehicles')
        .update({ status: 'idle' })
        .eq('id', trip.vehicle_id);

      await this.supabase.adminClient
        .from('drivers')
        .update({ status: 'available' })
        .eq('id', trip.driver_id);

      this.realtimeGateway.broadcastToOrg(orgId, 'tracking:trip_status', {
        tripId,
        vehicleId: trip.vehicle_id,
        driverId: trip.driver_id,
        status: 'cancelled',
      });
    }

    return this.findOne(orgId, tripId);
  }

  /**
   * Retrieves signed URL for trip PDF report.
   */
  async getTripReport(orgId: string, tripId: string): Promise<TripReportUrlResponse> {
    return this.pdfReportService.getSignedReportUrl(orgId, tripId);
  }
}
