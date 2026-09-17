import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { RealtimeGateway } from '../realtime/realtime.gateway';
import { NotificationsService } from '../notifications/notifications.service';
import { HosService } from '../hos/hos.service';
import { CarbonService } from '../intelligence/carbon.service';
import { TollService } from '../intelligence/toll.service';
import { DriverScoringService } from '../intelligence/driver-scoring.service';
import { PdfReportService } from '../reports/pdf-report.service';
import { OsrmRouteGeometry, GPSPoint, Geofence, GhostPositionPayload } from '@nexus-ways/shared';

export interface ActiveSimulationState {
  tripId: string;
  orgId: string;
  vehicleId: string;
  driverId: string;
  coordinates: [number, number][]; // [lng, lat]
  currentIndex: number;
  totalPoints: number;
  speedMultiplier: number;
  predictedDurationMinutes: number;
  timer?: NodeJS.Timeout;
  lowSpeedStreak: number;
  lastLat: number;
  lastLng: number;
  insideGeofenceIds: Set<string>;
  startTime: Date;
  originLabel?: string;
  destLabel?: string;
  distanceKm: number;
  vehicleCapacityKg: number;
}

function calculateDistanceMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371e3;
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function calculateHeading(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const y = Math.sin(((lon2 - lon1) * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180);
  const x =
    Math.cos((lat1 * Math.PI) / 180) * Math.sin((lat2 * Math.PI) / 180) -
    Math.sin((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.cos(((lon2 - lon1) * Math.PI) / 180);
  const brng = (Math.atan2(y, x) * 180) / Math.PI;
  return Math.round((brng + 360) % 360);
}

@Injectable()
export class SimulationService implements OnModuleDestroy {
  private readonly logger = new Logger(SimulationService.name);
  private activeSimulations = new Map<string, ActiveSimulationState>();

  constructor(
    private readonly supabase: SupabaseService,
    private readonly realtimeGateway: RealtimeGateway,
    private readonly notificationsService: NotificationsService,
    private readonly hosService: HosService,
    private readonly carbonService: CarbonService,
    private readonly tollService: TollService,
    private readonly driverScoringService: DriverScoringService,
    private readonly pdfReportService: PdfReportService,
  ) {}

  onModuleDestroy() {
    for (const [tripId, state] of this.activeSimulations.entries()) {
      if (state.timer) clearInterval(state.timer);
    }
    this.activeSimulations.clear();
  }

  isSimulating(tripId: string): boolean {
    return this.activeSimulations.has(tripId);
  }

  stopSimulation(tripId: string) {
    const state = this.activeSimulations.get(tripId);
    if (state) {
      if (state.timer) clearInterval(state.timer);
      this.activeSimulations.delete(tripId);
      this.logger.log(`Simulation stopped for trip ${tripId}`);
    }
  }

  async startTripSimulation(
    tripId: string,
    orgId: string,
    vehicleId: string,
    driverId: string,
    routeGeometry: OsrmRouteGeometry,
    speedMultiplier = 60,
    originLabel = '',
    destLabel = '',
  ) {
    this.stopSimulation(tripId);

    if (!routeGeometry || !routeGeometry.coordinates || routeGeometry.coordinates.length === 0) {
      this.logger.error(`Cannot start simulation for trip ${tripId}: missing coordinates`);
      return;
    }

    const coordinates = routeGeometry.coordinates;
    const firstPoint = coordinates[0];
    const predictedDurationMinutes = routeGeometry.duration_minutes || 60;
    const distanceKm = routeGeometry.distance_km || 100;

    // Fetch vehicle capacity
    const { data: vehicleData } = await this.supabase.adminClient
      .from('vehicles')
      .select('capacity_kg')
      .eq('id', vehicleId)
      .maybeSingle();

    const vehicleCapacityKg = vehicleData?.capacity_kg || 15000;
    const tollEstimate = this.tollService.calculateTripToll(distanceKm);

    // Save initial dispatch intelligence metrics
    await this.supabase.adminClient
      .from('trips')
      .update({
        predicted_duration_minutes: predictedDurationMinutes,
        toll_estimate_inr: tollEstimate.tollEstimateInr,
      })
      .eq('id', tripId);

    // Query org geofences initially
    const { data: orgGeofences } = await this.supabase.adminClient
      .from('geofences')
      .select('*')
      .eq('org_id', orgId);

    const geofenceList: Geofence[] = orgGeofences || [];
    const insideGeofenceIds = new Set<string>();

    // Check starting point inside geofences
    for (const gf of geofenceList) {
      const dist = calculateDistanceMeters(firstPoint[1], firstPoint[0], gf.center_lat, gf.center_lng);
      if (dist <= gf.radius_m) {
        insideGeofenceIds.add(gf.id);
      }
    }

    const state: ActiveSimulationState = {
      tripId,
      orgId,
      vehicleId,
      driverId,
      coordinates,
      currentIndex: 0,
      totalPoints: coordinates.length,
      speedMultiplier: Math.max(1, speedMultiplier),
      predictedDurationMinutes,
      lowSpeedStreak: 0,
      lastLat: firstPoint[1],
      lastLng: firstPoint[0],
      insideGeofenceIds,
      startTime: new Date(),
      originLabel,
      destLabel,
      distanceKm,
      vehicleCapacityKg,
    };

    const tickIntervalMs = 1000;
    const simTotalSeconds = Math.max(5, (predictedDurationMinutes * 60) / state.speedMultiplier);
    const stepsPerTick = Math.max(1, Math.ceil(coordinates.length / simTotalSeconds));

    this.logger.log(
      `Starting simulation for trip ${tripId} (Points: ${coordinates.length}, Speed: ${state.speedMultiplier}x, Steps/Tick: ${stepsPerTick})`,
    );

    // Initial GPS Point insert & Ghost projection
    await this.recordGpsTick(state, 0, 45, 0);
    this.broadcastGhostProjection(state);

    state.timer = setInterval(async () => {
      try {
        state.currentIndex += stepsPerTick;

        if (state.currentIndex >= state.totalPoints - 1) {
          state.currentIndex = state.totalPoints - 1;
          await this.processTick(state, geofenceList);
          await this.completeTrip(state);
        } else {
          await this.processTick(state, geofenceList);
        }
      } catch (err: any) {
        this.logger.error(`Error in simulation tick for trip ${tripId}: ${err.message}`);
      }
    }, tickIntervalMs);

    this.activeSimulations.set(tripId, state);
  }

  private async processTick(state: ActiveSimulationState, geofences: Geofence[]) {
    const point = state.coordinates[state.currentIndex];
    const lng = point[0];
    const lat = point[1];

    const heading = calculateHeading(state.lastLat, state.lastLng, lat, lng);

    // Simulated speed between 35 and 75 km/h with occasional slow spots
    let simulatedSpeedKmh = Math.round(40 + (state.currentIndex % 25) * 1.4);
    if (state.currentIndex > 5 && state.currentIndex < 10) {
      simulatedSpeedKmh = 12; // simulated congestion trigger
    }

    await this.recordGpsTick(state, state.currentIndex, simulatedSpeedKmh, heading);

    // 1. Digital Twin Ghost Projection Broadcast
    this.broadcastGhostProjection(state);

    // 2. Geofence checks
    for (const gf of geofences) {
      const dist = calculateDistanceMeters(lat, lng, gf.center_lat, gf.center_lng);
      const isInside = dist <= gf.radius_m;
      const wasInside = state.insideGeofenceIds.has(gf.id);

      if (isInside && !wasInside) {
        state.insideGeofenceIds.add(gf.id);
        await this.handleGeofenceEvent(state, gf, 'enter');
      } else if (!isInside && wasInside) {
        state.insideGeofenceIds.delete(gf.id);
        await this.handleGeofenceEvent(state, gf, 'exit');
      }
    }

    // 3. Rule-based simulated congestion alert
    if (simulatedSpeedKmh < 15) {
      state.lowSpeedStreak += 1;
      if (state.lowSpeedStreak === 3) {
        await this.triggerSimulatedAlert(
          state,
          'congestion',
          'medium',
          `[Simulated Alert] Low speed congestion detected (${simulatedSpeedKmh} km/h) for vehicle on route to ${state.destLabel || 'destination'}`,
        );
      }
    } else {
      state.lowSpeedStreak = 0;
    }

    state.lastLat = lat;
    state.lastLng = lng;
  }

  /**
   * Calculates digital twin ghost position along scheduled polyline and broadcasts deviation.
   */
  private broadcastGhostProjection(state: ActiveSimulationState) {
    const elapsedRealMs = Date.now() - state.startTime.getTime();
    const elapsedSimulatedSec = (elapsedRealMs / 1000) * state.speedMultiplier;
    const predictedTotalSec = Math.max(1, state.predictedDurationMinutes * 60);

    const ghostProgressFraction = Math.max(0, Math.min(1, elapsedSimulatedSec / predictedTotalSec));
    const ghostIndex = Math.min(
      state.totalPoints - 1,
      Math.floor(ghostProgressFraction * (state.totalPoints - 1)),
    );

    const ghostCoord = state.coordinates[ghostIndex];
    const ghostLng = ghostCoord[0];
    const ghostLat = ghostCoord[1];

    // Deviation: compare ghost progress vs actual progress
    const actualProgressFraction = state.currentIndex / Math.max(1, state.totalPoints - 1);
    const deviationMinutes = Math.round(
      (ghostProgressFraction - actualProgressFraction) * state.predictedDurationMinutes,
    );

    let status: 'ahead' | 'behind' | 'on_schedule' = 'on_schedule';
    if (deviationMinutes >= 2) {
      status = 'behind';
    } else if (deviationMinutes <= -2) {
      status = 'ahead';
    }

    const payload: GhostPositionPayload = {
      tripId: state.tripId,
      vehicleId: state.vehicleId,
      ghostLat,
      ghostLng,
      deviationMinutes,
      status,
    };

    this.realtimeGateway.broadcastToOrg(state.orgId, 'tracking:ghost_position', payload);
  }

  private async recordGpsTick(
    state: ActiveSimulationState,
    pointIndex: number,
    speedKmh: number,
    heading: number,
  ) {
    const point = state.coordinates[pointIndex];
    const lng = point[0];
    const lat = point[1];
    const recordedAt = new Date().toISOString();

    await this.supabase.adminClient
      .from('gps_points')
      .insert({
        trip_id: state.tripId,
        vehicle_id: state.vehicleId,
        lat,
        lng,
        speed_kmh: speedKmh,
        heading,
        recorded_at: recordedAt,
      });

    const progressPercent = Math.round((pointIndex / Math.max(1, state.totalPoints - 1)) * 100);

    this.realtimeGateway.broadcastToOrg(state.orgId, 'tracking:gps', {
      tripId: state.tripId,
      vehicleId: state.vehicleId,
      driverId: state.driverId,
      lat,
      lng,
      speed_kmh: speedKmh,
      heading,
      recorded_at: recordedAt,
      progressPercent,
      originLabel: state.originLabel,
      destinationLabel: state.destLabel,
    });
  }

  private async handleGeofenceEvent(
    state: ActiveSimulationState,
    geofence: Geofence,
    eventType: 'enter' | 'exit',
  ) {
    await this.supabase.adminClient.from('geofence_events').insert({
      geofence_id: geofence.id,
      vehicle_id: state.vehicleId,
      event_type: eventType,
      occurred_at: new Date().toISOString(),
    });

    const title = `Geofence ${eventType === 'enter' ? 'Entry' : 'Exit'}`;
    const body = `[Simulated Geofence] Vehicle ${eventType === 'enter' ? 'entered' : 'exited'} geofence "${geofence.name}"`;

    await this.notificationsService.createNotification(state.orgId, {
      type: 'info',
      title,
      body,
      actionLabel: 'View Map',
      actionUrl: '/roadways/dashboard',
    });

    this.realtimeGateway.broadcastToOrg(state.orgId, 'tracking:geofence_event', {
      tripId: state.tripId,
      vehicleId: state.vehicleId,
      geofenceId: geofence.id,
      geofenceName: geofence.name,
      eventType,
      occurredAt: new Date().toISOString(),
    });
  }

  private async triggerSimulatedAlert(
    state: ActiveSimulationState,
    type: string,
    severity: 'low' | 'medium' | 'high' | 'critical',
    message: string,
  ) {
    await this.supabase.adminClient.from('alerts').insert({
      org_id: state.orgId,
      type,
      severity,
      message,
    });

    await this.notificationsService.createNotification(state.orgId, {
      type: 'alert',
      title: `${type.toUpperCase()} Warning`,
      body: message,
      actionLabel: 'View Live Map',
      actionUrl: '/roadways/dashboard',
    });
  }

  private async completeTrip(state: ActiveSimulationState) {
    this.stopSimulation(state.tripId);
    const completedAt = new Date();

    this.logger.log(`Completing simulation for trip ${state.tripId}`);

    // Compute actual simulated elapsed duration in minutes
    const elapsedRealMs = completedAt.getTime() - state.startTime.getTime();
    const actualDurationMinutes = Math.max(
      1,
      Math.round(((elapsedRealMs / 1000) * state.speedMultiplier) / 60),
    );

    // Compute carbon emission (GLEC Framework)
    const carbonData = this.carbonService.calculateTripCarbon(
      state.distanceKm,
      state.vehicleCapacityKg,
    );

    // Compute driver behavior score from recorded telemetry
    const { data: recordedGps } = await this.supabase.adminClient
      .from('gps_points')
      .select('*')
      .eq('trip_id', state.tripId)
      .order('recorded_at', { ascending: true });

    let driverScore = null;
    if (recordedGps && recordedGps.length > 0) {
      driverScore = await this.driverScoringService.computeTripDriverScore(
        state.tripId,
        state.driverId,
        recordedGps,
      );
    }

    // Update trip record
    await this.supabase.adminClient
      .from('trips')
      .update({
        status: 'completed',
        completed_at: completedAt.toISOString(),
        actual_duration_minutes: actualDurationMinutes,
        carbon_kg: carbonData.carbonKg,
      })
      .eq('id', state.tripId);

    // Update vehicle & driver status
    await this.supabase.adminClient
      .from('vehicles')
      .update({ status: 'idle' })
      .eq('id', state.vehicleId);

    await this.supabase.adminClient
      .from('drivers')
      .update({ status: 'available' })
      .eq('id', state.driverId);

    // Checkpoint memory update
    try {
      const { data: checkpoints } = await this.supabase.adminClient
        .from('trip_checkpoints')
        .select('label, lat, lng')
        .eq('trip_id', state.tripId)
        .order('sequence', { ascending: true });

      if (checkpoints && checkpoints.length > 0 && state.originLabel && state.destLabel) {
        await this.supabase.adminClient
          .from('saved_routes')
          .update({
            checkpoints,
            updated_at: new Date().toISOString(),
          })
          .eq('org_id', state.orgId)
          .eq('origin_label', state.originLabel)
          .eq('destination_label', state.destLabel);
      }
    } catch (saveErr: any) {
      this.logger.warn(`Failed to update saved_routes: ${saveErr.message}`);
    }

    // Log HOS
    try {
      await this.hosService.logTripDriveTime(
        state.driverId,
        state.tripId,
        actualDurationMinutes,
        state.startTime,
        completedAt,
        state.orgId,
      );
    } catch (hosErr: any) {
      this.logger.warn(`Failed to log HOS: ${hosErr.message}`);
    }

    // Broadcast trip status update
    this.realtimeGateway.broadcastToOrg(state.orgId, 'tracking:trip_status', {
      tripId: state.tripId,
      vehicleId: state.vehicleId,
      driverId: state.driverId,
      status: 'completed',
      completedAt: completedAt.toISOString(),
      actualDurationMinutes,
      carbonKg: carbonData.carbonKg,
      driverScore: driverScore?.score,
    });

    await this.notificationsService.createNotification(state.orgId, {
      type: 'info',
      title: 'Trip Completed',
      body: `Trip from "${state.originLabel}" to "${state.destLabel}" completed. Driver Score: ${driverScore?.score ?? 100}/100.`,
      actionLabel: 'View Trips',
      actionUrl: '/roadways/dashboard',
    });

    // Generate trip audit PDF report asynchronously
    this.pdfReportService.generateAndStoreTripReport(state.orgId, state.tripId).catch((err) => {
      this.logger.warn(`Failed to auto-generate PDF report on simulation complete for trip ${state.tripId}: ${err.message}`);
    });
  }
}
