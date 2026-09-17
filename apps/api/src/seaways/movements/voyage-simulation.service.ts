import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { SupabaseService } from '../../supabase/supabase.service';
import { RealtimeGateway } from '../../realtime/realtime.gateway';
import { NotificationsService } from '../../notifications/notifications.service';
import { SeaRouteGeometry } from '../routing/sea-routing.service';
import { SeaCarbonService } from '../intelligence/sea-carbon.service';
import { SeaCrewScoringService } from '../intelligence/sea-crew-scoring.service';
import { WatchkeepingService } from '../intelligence/watchkeeping.service';
import { SeawaysPdfReportService } from '../reports/seaways-pdf-report.service';
import { Geofence, GhostPositionPayload } from '@nexus-ways/shared';

export interface ActiveVoyageSimulationState {
  movementId: string;
  orgId: string;
  voyageId: string;
  vesselId: string;
  masterId: string;
  voyageNumber: string;
  vesselName: string;
  vesselType: string;
  dwtTonnes: number;
  teuCapacity?: number;
  masterName: string;
  originPortName: string;
  destinationPortName: string;
  coordinates: [number, number][]; // [lng, lat]
  currentIndex: number;
  totalPoints: number;
  speedMultiplier: number;
  predictedDurationMinutes: number;
  distanceKm: number;
  timer?: NodeJS.Timeout;
  lastLat: number;
  lastLng: number;
  insideGeofenceIds: Set<string>;
  startTime: Date;
  simulatedAlertSent: boolean;
}

function calculateDistanceMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371e3;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const phi1 = toRad(lat1);
  const phi2 = toRad(lat2);
  const deltaPhi = toRad(lat2 - lat1);
  const deltaLambda = toRad(lon2 - lon1);
  const a =
    Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
    Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function calculateBearing(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const toDeg = (rad: number) => (rad * 180) / Math.PI;
  const phi1 = toRad(lat1);
  const phi2 = toRad(lat2);
  const deltaLambda = toRad(lon2 - lon1);
  const y = Math.sin(deltaLambda) * Math.cos(phi2);
  const x =
    Math.cos(phi1) * Math.sin(phi2) -
    Math.sin(phi1) * Math.cos(phi2) * Math.cos(deltaLambda);
  const brng = (toDeg(Math.atan2(y, x)) + 360) % 360;
  return Math.round(brng);
}

@Injectable()
export class VoyageSimulationService implements OnModuleDestroy {
  private readonly logger = new Logger(VoyageSimulationService.name);
  private activeSimulations = new Map<string, ActiveVoyageSimulationState>();

  constructor(
    private readonly supabase: SupabaseService,
    private readonly realtimeGateway: RealtimeGateway,
    private readonly notificationsService: NotificationsService,
    private readonly seaCarbonService: SeaCarbonService,
    private readonly seaCrewScoringService: SeaCrewScoringService,
    private readonly watchkeepingService: WatchkeepingService,
    private readonly seawaysPdfReportService: SeawaysPdfReportService,
  ) {}

  onModuleDestroy() {
    for (const [, state] of this.activeSimulations.entries()) {
      if (state.timer) clearInterval(state.timer);
    }
    this.activeSimulations.clear();
  }

  isSimulating(movementId: string): boolean {
    return this.activeSimulations.has(movementId);
  }

  stopSimulation(movementId: string) {
    const state = this.activeSimulations.get(movementId);
    if (state) {
      if (state.timer) clearInterval(state.timer);
      this.activeSimulations.delete(movementId);
      this.logger.log(`Simulation stopped for voyage movement ${movementId}`);
    }
  }

  /**
   * Starts live in-process simulation for a voyage movement.
   * Steps along the precomputed land-avoiding route polyline, emitting real-time telemetry ticks.
   */
  async startSimulation(
    orgId: string,
    movementId: string,
    routeGeometry: SeaRouteGeometry,
    speedMultiplier = 60,
  ) {
    if (this.activeSimulations.has(movementId)) {
      this.logger.warn(`Simulation for voyage movement ${movementId} already running.`);
      return;
    }

    // Fetch full movement details
    const { data: movement, error } = await this.supabase.adminClient
      .from('voyage_movements')
      .select(`
        *,
        voyage:voyages(
          voyage_number,
          origin_port:ports!voyages_origin_port_id_fkey(name),
          destination_port:ports!voyages_destination_port_id_fkey(name)
        ),
        vessel:vessels(vessel_name, vessel_type, dwt_tonnes),
        master:sea_crew(user:users(full_name))
      `)
      .eq('id', movementId)
      .eq('org_id', orgId)
      .single();

    if (error || !movement) {
      this.logger.error(`Could not find voyage movement ${movementId} for simulation: ${error?.message}`);
      return;
    }

    const coords = routeGeometry.coordinates;
    if (!coords || coords.length === 0) {
      this.logger.error(`No coordinates available to simulate voyage movement ${movementId}`);
      return;
    }

    const state: ActiveVoyageSimulationState = {
      movementId,
      orgId,
      voyageId: movement.voyage_id,
      vesselId: movement.vessel_id,
      masterId: movement.master_id,
      voyageNumber: movement.voyage?.voyage_number || 'VOY-UNKNOWN',
      vesselName: movement.vessel?.vessel_name || 'Vessel',
      vesselType: movement.vessel?.vessel_type || 'Cargo Ship',
      dwtTonnes: Number(movement.vessel?.dwt_tonnes || 65000),
      teuCapacity: Number(movement.vessel?.teu_capacity || Math.round((movement.vessel?.dwt_tonnes || 65000) / 13)),
      masterName: movement.master?.user?.full_name || 'Master',
      originPortName: movement.voyage?.origin_port?.name || 'Origin Port',
      destinationPortName: movement.voyage?.destination_port?.name || 'Destination Port',
      coordinates: coords,
      currentIndex: 0,
      totalPoints: coords.length,
      speedMultiplier: Math.max(1, speedMultiplier),
      predictedDurationMinutes: routeGeometry.duration_minutes || 180,
      distanceKm: routeGeometry.distance_km || 450,
      lastLat: coords[0][1],
      lastLng: coords[0][0],
      insideGeofenceIds: new Set<string>(),
      startTime: new Date(),
      simulatedAlertSent: false,
    };

    // Calculate tick interval in ms (target ~ 25-40 steps across simulation duration)
    const simDurationMs = (state.predictedDurationMinutes * 60 * 1000) / state.speedMultiplier;
    const tickIntervalMs = Math.max(1000, Math.min(4000, Math.floor(simDurationMs / state.totalPoints)));

    this.logger.log(
      `Starting live simulation for voyage movement ${movementId} (${state.voyageNumber}): ` +
        `${state.totalPoints} waypoints, tick interval ${tickIntervalMs}ms at ${state.speedMultiplier}x speed`,
    );

    // Initial tick
    await this.stepSimulation(state);

    // Setup periodic scheduler
    state.timer = setInterval(async () => {
      try {
        state.currentIndex++;
        if (state.currentIndex >= state.totalPoints) {
          if (state.timer) clearInterval(state.timer);
          this.activeSimulations.delete(movementId);
          await this.completeVoyageMovement(state);
        } else {
          await this.stepSimulation(state);
        }
      } catch (tickErr: any) {
        this.logger.error(`Simulation tick error for voyage movement ${movementId}: ${tickErr.message}`);
      }
    }, tickIntervalMs);

    this.activeSimulations.set(movementId, state);
  }

  private async stepSimulation(state: ActiveVoyageSimulationState) {
    const currentCoord = state.coordinates[state.currentIndex];
    const lon = currentCoord[0];
    const lat = currentCoord[1];

    let heading = 0;
    if (state.currentIndex < state.totalPoints - 1) {
      const nextCoord = state.coordinates[state.currentIndex + 1];
      heading = calculateBearing(lat, lon, nextCoord[1], nextCoord[0]);
    } else {
      heading = calculateBearing(state.lastLat, state.lastLng, lat, lon);
    }

    state.lastLat = lat;
    state.lastLng = lon;

    // Normal maritime cruising speed ~18-22 knots (~33-40 km/h) with subtle realistic wave jitter
    const speedKnots = Math.round((18.5 + (Math.random() * 2.5 - 1.2)) * 10) / 10;
    const recordedAt = new Date().toISOString();

    // 1. Insert telemetry record in database
    try {
      await this.supabase.adminClient.from('vessel_telemetry').insert({
        movement_id: state.movementId,
        vessel_id: state.vesselId,
        lat,
        lng: lon,
        speed_knots: speedKnots,
        heading,
        recorded_at: recordedAt,
      });
    } catch (dbErr: any) {
      this.logger.warn(`Failed to insert vessel telemetry: ${dbErr.message}`);
    }

    // 2. Broadcast live telemetry via WebSocket
    const progressPercent = Math.min(100, Math.round((state.currentIndex / (state.totalPoints - 1 || 1)) * 100));

    const telemetryPayload = {
      movement_id: state.movementId,
      movementId: state.movementId,
      vessel_id: state.vesselId,
      vesselId: state.vesselId,
      vessel_name: state.vesselName,
      vesselName: state.vesselName,
      vessel_type: state.vesselType,
      vesselType: state.vesselType,
      master_name: state.masterName,
      masterName: state.masterName,
      voyage_number: state.voyageNumber,
      voyageNumber: state.voyageNumber,
      origin_port_name: state.originPortName,
      originPortName: state.originPortName,
      destination_port_name: state.destinationPortName,
      destinationPortName: state.destinationPortName,
      lat,
      lng: lon,
      speed_knots: speedKnots,
      speedKnots: speedKnots,
      heading,
      progress_percent: progressPercent,
      progressPercent: progressPercent,
      distance_km: state.distanceKm,
      distanceKm: state.distanceKm,
      duration_minutes: state.predictedDurationMinutes,
      durationMinutes: state.predictedDurationMinutes,
      recorded_at: recordedAt,
      timestamp: recordedAt,
      status: 'in_transit',
      simulated: true,
    };

    if (this.realtimeGateway.server) {
      this.realtimeGateway.server.to(`org:${state.orgId}`).emit(`seaways:telemetry`, telemetryPayload);
      this.realtimeGateway.server.to(`org:${state.orgId}`).emit(`vessel:telemetry:${state.vesselId}`, telemetryPayload);
      this.realtimeGateway.server.to(`org:${state.orgId}`).emit(`movement:telemetry:${state.movementId}`, telemetryPayload);
      this.realtimeGateway.server.emit(`seaways:telemetry`, telemetryPayload);
    }

    // 3. Digital Twin Ghost Projection Broadcast
    this.broadcastGhostProjection(state);

    // 4. Simulated Marine Weather / Heavy-Seas Advisory Alert (Rule-based, at ~50% voyage progress)
    if (!state.simulatedAlertSent && progressPercent >= 45 && progressPercent <= 55) {
      state.simulatedAlertSent = true;
      this.generateSimulatedMarineAlert(state, lat, lon);
    }

    // 5. Geofence Crossing Check (Port Limits & Coastal Zones)
    this.checkGeofenceCrossings(state, lat, lon);
  }

  /**
   * Calculates digital twin ghost position along scheduled sea route polyline and broadcasts deviation.
   */
  private broadcastGhostProjection(state: ActiveVoyageSimulationState) {
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
      tripId: state.movementId,
      vehicleId: state.vesselId,
      ghostLat,
      ghostLng,
      deviationMinutes,
      status,
    };

    if (this.realtimeGateway.server) {
      this.realtimeGateway.server.to(`org:${state.orgId}`).emit('seaways:ghost_position', payload);
      this.realtimeGateway.server.to(`org:${state.orgId}`).emit('tracking:ghost_position', payload);
    }
  }

  private async generateSimulatedMarineAlert(
    state: ActiveVoyageSimulationState,
    lat: number,
    lng: number,
  ) {
    try {
      const alertMsg = `[SIMULATED] Swell Warning: Vessel ${state.vesselName} encountered Beaufort Force 6 rough seas along maritime fairway. Master advised to maintain safe sea lane course.`;

      const { data: alert } = await this.supabase.adminClient
        .from('alerts')
        .insert({
          org_id: state.orgId,
          type: 'weather_warning',
          severity: 'warning',
          message: alertMsg,
          metadata: {
            movementId: state.movementId,
            vesselId: state.vesselId,
            vesselName: state.vesselName,
            lat,
            lng,
            simulated: true,
          },
        })
        .select()
        .single();

      if (alert) {
        this.notificationsService.createNotification(state.orgId, {
          type: 'alert',
          title: `Marine Weather Advisory (${state.vesselName})`,
          body: alertMsg,
          actionUrl: `/seaways/dashboard`,
        });
      }
    } catch (e: any) {
      this.logger.warn(`Failed to generate simulated marine alert: ${e.message}`);
    }
  }

  private async checkGeofenceCrossings(
    state: ActiveVoyageSimulationState,
    lat: number,
    lng: number,
  ) {
    try {
      const { data: geofences } = await this.supabase.adminClient
        .from('geofences')
        .select('*')
        .eq('org_id', state.orgId);

      if (!geofences || geofences.length === 0) return;

      for (const gf of geofences as Geofence[]) {
        const centerLat = gf.center_lat;
        const centerLng = gf.center_lng;
        const radiusMeters = gf.radius_m || 3000;
        if (centerLat === undefined || centerLng === undefined) continue;

        const dist = calculateDistanceMeters(lat, lng, centerLat, centerLng);
        const isInside = dist <= radiusMeters;
        const wasInside = state.insideGeofenceIds.has(gf.id);

        if (isInside && !wasInside) {
          state.insideGeofenceIds.add(gf.id);
          this.recordGeofenceEvent(state, gf, 'entered', dist);
        } else if (!isInside && wasInside) {
          state.insideGeofenceIds.delete(gf.id);
          this.recordGeofenceEvent(state, gf, 'exited', dist);
        }
      }
    } catch {
      // Ignore geofence check transient failures
    }
  }

  private async recordGeofenceEvent(
    state: ActiveVoyageSimulationState,
    geofence: Geofence,
    action: 'entered' | 'exited',
    distanceMeters: number,
  ) {
    const eventType = action === 'entered' ? 'geofence_entry' : 'geofence_exit';
    const msg = `Vessel ${state.vesselName} ${action} port geofence "${geofence.name}" (${Math.round(distanceMeters)}m from center)`;

    try {
      await this.supabase.adminClient.from('alerts').insert({
        org_id: state.orgId,
        type: eventType,
        severity: 'info',
        message: msg,
        metadata: {
          movementId: state.movementId,
          vesselId: state.vesselId,
          geofenceId: geofence.id,
          geofenceName: geofence.name,
          action,
        },
      });

      this.notificationsService.createNotification(state.orgId, {
        type: 'info',
        title: `Port Geofence Event: ${geofence.name}`,
        body: msg,
        actionUrl: `/seaways/dashboard`,
      });
    } catch (err: any) {
      this.logger.warn(`Failed to record port geofence event: ${err.message}`);
    }
  }

  private async completeVoyageMovement(state: ActiveVoyageSimulationState) {
    const completedAt = new Date();
    const completedAtIso = completedAt.toISOString();
    const actualDurationMinutes = Math.max(
      1,
      Math.round(((completedAt.getTime() - state.startTime.getTime()) / 1000) * (state.speedMultiplier / 60)),
    );

    this.logger.log(
      `Voyage movement ${state.movementId} (${state.voyageNumber}) successfully completed at ${state.destinationPortName}`,
    );

    try {
      // 1. Compute Maritime Carbon Footprint
      const carbonResult = this.seaCarbonService.calculateVoyageCarbon(
        state.distanceKm,
        45000, // 45,000 tonnes standard container payload for 65k DWT Panamax
        state.teuCapacity || state.dwtTonnes,
      );

      // 2. Fetch recorded telemetry & compute Master / Crew Behavior Score
      const { data: recordedTelemetry } = await this.supabase.adminClient
        .from('vessel_telemetry')
        .select('*')
        .eq('movement_id', state.movementId)
        .order('recorded_at', { ascending: true });

      let crewScore = null;
      if (recordedTelemetry && recordedTelemetry.length > 0) {
        crewScore = await this.seaCrewScoringService.computeSeaCrewScore(
          state.movementId,
          state.masterId,
          recordedTelemetry,
        );
      }

      // 3. Log STCW Watchkeeping Rest-Hour Entry
      await this.watchkeepingService.recordWatchkeepingDuty(
        state.orgId,
        state.movementId,
        state.masterId,
        actualDurationMinutes,
        state.startTime,
        completedAt,
      );

      // 4. Update voyage_movements table with intelligence columns
      await this.supabase.adminClient
        .from('voyage_movements')
        .update({
          status: 'completed',
          completed_at: completedAtIso,
          distance_km: state.distanceKm,
          duration_minutes: state.predictedDurationMinutes,
          predicted_duration_minutes: state.predictedDurationMinutes,
          actual_duration_minutes: actualDurationMinutes,
          carbon_kg: carbonResult.carbonKg,
        })
        .eq('id', state.movementId);

      // 5. Set vessel status back to idle
      await this.supabase.adminClient
        .from('vessels')
        .update({ status: 'idle' })
        .eq('id', state.vesselId);

      // 6. Set master crew status back to available
      await this.supabase.adminClient
        .from('sea_crew')
        .update({ status: 'available' })
        .eq('id', state.masterId);

      // 7. Send arrival notification
      this.notificationsService.createNotification(state.orgId, {
        type: 'info',
        title: `Voyage Completed: ${state.voyageNumber}`,
        body: `Vessel ${state.vesselName} safely docked at ${state.destinationPortName}. Distance: ${state.distanceKm} km. Master Score: ${crewScore?.score ?? 100}/100. Carbon: ${carbonResult.carbonKg} kg CO₂e.`,
        actionLabel: 'View Voyage',
        actionUrl: `/seaways/dashboard?movementId=${state.movementId}`,
      });

      // 8. Broadcast completion event
      if (this.realtimeGateway.server) {
        const payload = {
          movement_id: state.movementId,
          movementId: state.movementId,
          vessel_id: state.vesselId,
          vesselId: state.vesselId,
          voyage_number: state.voyageNumber,
          voyageNumber: state.voyageNumber,
          status: 'completed',
          progress_percent: 100,
          actualDurationMinutes,
          carbonKg: carbonResult.carbonKg,
          crewScore: crewScore?.score ?? 100,
          timestamp: completedAtIso,
        };
        this.realtimeGateway.server.to(`org:${state.orgId}`).emit(`seaways:telemetry`, payload);
        this.realtimeGateway.server.to(`org:${state.orgId}`).emit(`seaways:completed`, payload);
        this.realtimeGateway.server.to(`org:${state.orgId}`).emit(`seaways:voyage_completed`, payload);
        this.realtimeGateway.server.emit(`seaways:telemetry`, payload);
      }

      // 9. Auto-generate PDF voyage movement report
      this.seawaysPdfReportService
        .generateAndStoreMovementReport(state.orgId, state.movementId)
        .catch((err) =>
          this.logger.warn(`Failed to auto-generate PDF report for voyage ${state.movementId}: ${err.message}`),
        );
    } catch (completionErr: any) {
      this.logger.error(`Error completing voyage movement ${state.movementId}: ${completionErr.message}`);
    }
  }
}
