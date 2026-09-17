import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { SupabaseService } from '../../supabase/supabase.service';
import { RealtimeGateway } from '../../realtime/realtime.gateway';
import { NotificationsService } from '../../notifications/notifications.service';
import { RailRouteGeometry } from '../routing/rail-routing.service';
import { RailCarbonService } from '../intelligence/rail-carbon.service';
import { CrewScoringService } from '../intelligence/crew-scoring.service';
import { RailPdfReportService } from '../reports/rail-pdf-report.service';
import { Geofence, GhostPositionPayload } from '@nexus-ways/shared';

export interface ActiveRailSimulationState {
  movementId: string;
  orgId: string;
  trainId: string;
  locoPilotId: string;
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
  originName?: string;
  destName?: string;
  simulatedAlertSent: boolean;
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
export class RailSimulationService implements OnModuleDestroy {
  private readonly logger = new Logger(RailSimulationService.name);
  private activeSimulations = new Map<string, ActiveRailSimulationState>();

  constructor(
    private readonly supabase: SupabaseService,
    private readonly realtimeGateway: RealtimeGateway,
    private readonly notificationsService: NotificationsService,
    private readonly railCarbonService: RailCarbonService,
    private readonly crewScoringService: CrewScoringService,
    private readonly railPdfReportService: RailPdfReportService,
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
      this.logger.log(`Simulation stopped for movement ${movementId}`);
    }
  }

  async startMovementSimulation(
    movementId: string,
    orgId: string,
    trainId: string,
    locoPilotId: string,
    routeGeometry: RailRouteGeometry,
    speedMultiplier = 60,
    originName = 'Origin Station',
    destName = 'Destination Station',
  ) {
    this.stopSimulation(movementId);

    const coordinates = routeGeometry?.coordinates || [];
    if (coordinates.length < 2) {
      this.logger.warn(`Movement ${movementId} has insufficient coordinates for simulation.`);
      return;
    }

    const startCoord = coordinates[0];
    const predictedDurationMinutes = routeGeometry.duration_minutes || 240;
    const distanceKm = routeGeometry.distance_km || 300;

    const state: ActiveRailSimulationState = {
      movementId,
      orgId,
      trainId,
      locoPilotId,
      coordinates,
      currentIndex: 0,
      totalPoints: coordinates.length,
      speedMultiplier,
      predictedDurationMinutes,
      distanceKm,
      lastLat: startCoord[1],
      lastLng: startCoord[0],
      insideGeofenceIds: new Set<string>(),
      startTime: new Date(),
      originName,
      destName,
      simulatedAlertSent: false,
    };

    // Calculate tick step interval (e.g. 1000ms tick)
    const tickIntervalMs = 1000;
    const stepSize = Math.max(1, Math.floor((coordinates.length / 30) * (speedMultiplier / 60)));

    state.timer = setInterval(async () => {
      await this.processSimulationTick(state, stepSize);
    }, tickIntervalMs);

    this.activeSimulations.set(movementId, state);
    this.logger.log(`Started simulation for train movement ${movementId} (${coordinates.length} pts, speed ${speedMultiplier}x)`);

    // Process initial tick and ghost projection immediately
    await this.processSimulationTick(state, 0);
  }

  private async processSimulationTick(state: ActiveRailSimulationState, stepSize: number) {
    const { movementId, orgId, trainId, coordinates, totalPoints } = state;

    state.currentIndex = Math.min(state.currentIndex + stepSize, totalPoints - 1);
    const curr = coordinates[state.currentIndex];
    const currentLng = curr[0];
    const currentLat = curr[1];

    let speedKmh = 75; // Average train cruise speed
    let heading = 0;

    if (state.currentIndex > 0) {
      const prev = coordinates[Math.max(0, state.currentIndex - 1)];
      heading = calculateHeading(prev[1], prev[0], currentLat, currentLng);
      // Fluctuate speed between 65 and 85 km/h for realism
      speedKmh = Math.round(75 + (Math.sin(state.currentIndex) * 10));
    }

    const recordedAt = new Date().toISOString();

    // 1. Insert train telemetry record
    try {
      await this.supabase.adminClient.from('train_telemetry').insert({
        movement_id: movementId,
        train_id: trainId,
        lat: currentLat,
        lng: currentLng,
        speed_kmh: speedKmh,
        heading,
        recorded_at: recordedAt,
      });
    } catch (err: any) {
      this.logger.debug(`Telemetry insert error for movement ${movementId}: ${err.message}`);
    }

    const progressPercent = Math.round(((state.currentIndex + 1) / totalPoints) * 100);

    // 2. Broadcast on realtime WebSocket gateway (distinct 'railways:telemetry' event)
    const telemetryPayload = {
      movementId,
      trainId,
      lat: currentLat,
      lng: currentLng,
      speedKmh,
      heading,
      progressPercent,
      recordedAt,
    };

    if (this.realtimeGateway.server) {
      this.realtimeGateway.server.to(`org:${orgId}`).emit('railways:telemetry', telemetryPayload);
    }

    // 3. Digital Twin Ghost Projection Broadcast
    this.broadcastGhostProjection(state);

    // 4. Check station/yard geofence crossings
    await this.checkGeofenceCrossings(state, currentLat, currentLng);

    // 5. Rule-based simulated alert (e.g. intermediate signal hold / speed restriction at 45-65% progress)
    if (!state.simulatedAlertSent && progressPercent >= 45 && progressPercent <= 65) {
      state.simulatedAlertSent = true;
      try {
        await this.supabase.adminClient.from('alerts').insert({
          org_id: orgId,
          type: 'congestion',
          severity: 'low',
          message: `[Simulated Alert] Signal Caution: Speed restriction (45 km/h) approaching yard junction for train.`,
          acknowledged: false,
        });

        await this.notificationsService.createNotification(orgId, {
          type: 'alert',
          title: 'Train Signal Advisory',
          body: `[Simulated Alert] Signal Caution: Train operating under automatic speed control near junction.`,
        });
      } catch (alertErr: any) {
        this.logger.debug(`Failed to emit simulated alert: ${alertErr.message}`);
      }
    }

    // 6. Completion check
    if (state.currentIndex >= totalPoints - 1) {
      this.stopSimulation(movementId);
      await this.completeMovement(state);
    }
  }

  /**
   * Calculates digital twin ghost position along scheduled rail polyline and broadcasts deviation.
   */
  private broadcastGhostProjection(state: ActiveRailSimulationState) {
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
      vehicleId: state.trainId,
      ghostLat,
      ghostLng,
      deviationMinutes,
      status,
    };

    if (this.realtimeGateway.server) {
      this.realtimeGateway.server.to(`org:${state.orgId}`).emit('railways:ghost_position', payload);
      this.realtimeGateway.server.to(`org:${state.orgId}`).emit('tracking:ghost_position', payload);
    }
  }

  private async checkGeofenceCrossings(state: ActiveRailSimulationState, lat: number, lng: number) {
    const { orgId, movementId, insideGeofenceIds } = state;

    try {
      const { data: geofences } = await this.supabase.adminClient
        .from('geofences')
        .select('*')
        .eq('org_id', orgId);

      if (!geofences || geofences.length === 0) return;

      for (const gf of geofences as Geofence[]) {
        if (!gf.center_lat || !gf.center_lng || !gf.radius_m) continue;

        const dist = calculateDistanceMeters(lat, lng, gf.center_lat, gf.center_lng);
        const isInside = dist <= gf.radius_m;
        const wasInside = insideGeofenceIds.has(gf.id);

        if (isInside && !wasInside) {
          insideGeofenceIds.add(gf.id);
          this.logger.log(`Train in movement ${movementId} entered geofence ${gf.name}`);

          await this.supabase.adminClient.from('geofence_events').insert({
            geofence_id: gf.id,
            vehicle_id: null,
            event_type: 'entry',
          });

          await this.notificationsService.createNotification(orgId, {
            type: 'info',
            title: `Station Geofence Entry`,
            body: `Train entered boundary: ${gf.name}`,
          });
        } else if (!isInside && wasInside) {
          insideGeofenceIds.delete(gf.id);
          this.logger.log(`Train in movement ${movementId} exited geofence ${gf.name}`);

          await this.supabase.adminClient.from('geofence_events').insert({
            geofence_id: gf.id,
            vehicle_id: null,
            event_type: 'exit',
          });
        }
      }
    } catch (err: any) {
      this.logger.debug(`Geofence check error for movement ${movementId}: ${err.message}`);
    }
  }

  private async completeMovement(state: ActiveRailSimulationState) {
    const { movementId, orgId, trainId, locoPilotId, startTime, distanceKm } = state;
    const completedAt = new Date();
    const durationMinutes = Math.max(1, Math.round(((completedAt.getTime() - startTime.getTime()) / 1000) * (state.speedMultiplier / 60)));

    this.logger.log(`Train movement ${movementId} reached destination and completed.`);

    try {
      // 1. Fetch train details for locomotive fuel type & rake capacity
      const { data: train } = await this.supabase.adminClient
        .from('trains')
        .select('*, locomotive:locomotives(*), rake:rakes(*)')
        .eq('id', trainId)
        .maybeSingle();

      const fuelType: 'electric' | 'diesel' =
        (train?.locomotive?.fuel_type as 'electric' | 'diesel') || 'electric';

      // 2. Compute rail carbon footprint
      const carbonResult = this.railCarbonService.calculateMovementCarbon(
        distanceKm,
        fuelType,
        1500,
      );

      // 3. Compute crew behavior score from recorded telemetry
      const { data: recordedTelemetry } = await this.supabase.adminClient
        .from('train_telemetry')
        .select('*')
        .eq('movement_id', movementId)
        .order('recorded_at', { ascending: true });

      let crewScore = null;
      if (recordedTelemetry && recordedTelemetry.length > 0) {
        crewScore = await this.crewScoringService.computeMovementCrewScore(
          movementId,
          locoPilotId,
          recordedTelemetry,
        );
      }

      // 4. Update movement record
      await this.supabase.adminClient
        .from('train_movements')
        .update({
          status: 'completed',
          completed_at: completedAt.toISOString(),
          actual_duration_minutes: durationMinutes,
          duration_minutes: durationMinutes,
          carbon_kg: carbonResult.carbonKg,
        })
        .eq('id', movementId)
        .eq('org_id', orgId);

      // 5. Update train status to idle
      await this.supabase.adminClient
        .from('trains')
        .update({ status: 'idle' })
        .eq('id', trainId);

      // 6. Update loco pilot status to available
      await this.supabase.adminClient
        .from('loco_pilots')
        .update({ status: 'available' })
        .eq('id', locoPilotId);

      // 7. Emit completed event on WebSocket
      if (this.realtimeGateway.server) {
        const completionPayload = {
          movementId,
          movement_id: movementId,
          trainId,
          train_id: trainId,
          completedAt: completedAt.toISOString(),
          completed_at: completedAt.toISOString(),
          actualDurationMinutes: durationMinutes,
          carbonKg: carbonResult.carbonKg,
          crewScore: crewScore?.score ?? 100,
        };
        this.realtimeGateway.server.to(`org:${orgId}`).emit('railways:completed', completionPayload);
        this.realtimeGateway.server.to(`org:${orgId}`).emit('railways:movement_completed', completionPayload);
      }

      // 8. Auto-generate PDF movement report
      this.railPdfReportService
        .generateAndStoreMovementReport(orgId, movementId)
        .catch((err) =>
          this.logger.warn(`Failed to auto-generate PDF report for movement ${movementId}: ${err.message}`),
        );

      // 9. Notify manager
      await this.notificationsService.createNotification(orgId, {
        type: 'info',
        title: 'Train Movement Completed',
        body: `Train movement from ${state.originName} to ${state.destName} completed successfully. Crew Score: ${crewScore?.score ?? 100}/100. Carbon: ${carbonResult.carbonKg} kg CO₂e.`,
        actionLabel: 'View Movements',
        actionUrl: '/railways/dashboard',
      });
    } catch (err: any) {
      this.logger.error(`Error completing train movement ${movementId}: ${err.message}`);
    }
  }
}

