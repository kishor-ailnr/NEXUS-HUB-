import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { SupabaseService } from '../../supabase/supabase.service';
import { RealtimeGateway } from '../../realtime/realtime.gateway';
import { NotificationsService } from '../../notifications/notifications.service';
import { AirRouteGeometry } from '../routing/air-routing.service';
import { AirCarbonService } from '../intelligence/air-carbon.service';
import { CrewFlightScoringService } from '../intelligence/crew-flight-scoring.service';
import { FlightDutyService } from '../intelligence/flight-duty.service';
import { FlightPdfReportService } from '../reports/flight-pdf-report.service';
import { Geofence, GhostPositionPayload } from '@nexus-ways/shared';

export interface ActiveFlightSimulationState {
  movementId: string;
  orgId: string;
  flightId: string;
  aircraftId: string;
  pilotId: string;
  flightNumber: string;
  tailNumber: string;
  aircraftType: string;
  pilotName: string;
  originAirportName: string;
  destinationAirportName: string;
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
export class FlightSimulationService implements OnModuleDestroy {
  private readonly logger = new Logger(FlightSimulationService.name);
  private activeSimulations = new Map<string, ActiveFlightSimulationState>();

  constructor(
    private readonly supabase: SupabaseService,
    private readonly realtimeGateway: RealtimeGateway,
    private readonly notificationsService: NotificationsService,
    private readonly airCarbonService: AirCarbonService,
    private readonly crewFlightScoringService: CrewFlightScoringService,
    private readonly flightDutyService: FlightDutyService,
    private readonly flightPdfReportService: FlightPdfReportService,
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
      this.logger.log(`Simulation stopped for flight movement ${movementId}`);
    }
  }

  async startFlightSimulation(
    movementId: string,
    orgId: string,
    flightId: string,
    aircraftId: string,
    pilotId: string,
    routeGeometry: AirRouteGeometry,
    speedMultiplier = 60,
    flightNumber = 'NW-701',
    tailNumber = 'VT-NEX',
    aircraftType = 'Boeing 777F',
    pilotName = 'Capt. Pilot',
    originAirportName = 'Origin Airport',
    destinationAirportName = 'Destination Airport',
  ) {
    this.stopSimulation(movementId);

    const coords = routeGeometry.coordinates;
    if (!coords || coords.length === 0) {
      this.logger.error(`Cannot simulate flight movement ${movementId}: no coordinates`);
      return;
    }

    const state: ActiveFlightSimulationState = {
      movementId,
      orgId,
      flightId,
      aircraftId,
      pilotId,
      flightNumber,
      tailNumber,
      aircraftType,
      pilotName,
      originAirportName,
      destinationAirportName,
      coordinates: coords,
      currentIndex: 0,
      totalPoints: coords.length,
      speedMultiplier: Math.max(1, speedMultiplier),
      predictedDurationMinutes: routeGeometry.duration_minutes || 120,
      distanceKm: routeGeometry.distance_km || 1000,
      lastLat: coords[0][1],
      lastLng: coords[0][0],
      insideGeofenceIds: new Set<string>(),
      startTime: new Date(),
      simulatedAlertSent: false,
    };

    this.logger.log(
      `Starting Airways simulation for movement ${movementId} (${flightNumber} | ${tailNumber}) | ${coords.length} waypoints at ${speedMultiplier}x speed`,
    );

    // Initial broadcast
    await this.tickSimulation(state);

    // Run tick every 1000ms
    state.timer = setInterval(() => {
      this.tickSimulation(state).catch((err) => {
        this.logger.error(`Error in flight simulation tick: ${err.message}`);
      });
    }, 1000);

    this.activeSimulations.set(movementId, state);
  }

  private async tickSimulation(state: ActiveFlightSimulationState) {
    const { coordinates, currentIndex, totalPoints, movementId, orgId, aircraftId } = state;

    if (currentIndex >= totalPoints) {
      await this.completeFlightMovement(state);
      return;
    }

    const currentCoord = coordinates[currentIndex];
    const lng = currentCoord[0];
    const lat = currentCoord[1];

    // Compute altitude & speed profile
    // 0..0.2: Climb (0 to 36,000 ft, 160 -> 460 kts)
    // 0.2..0.8: Cruise (36,000 ft, 460-480 kts)
    // 0.8..1.0: Descent (36,000 ft down to 0 ft, 460 -> 150 kts)
    const progressFraction = totalPoints > 1 ? currentIndex / (totalPoints - 1) : 1;
    let altitudeFt = 0;
    let speedKts = 460;

    if (progressFraction <= 0.2) {
      const climbFrac = progressFraction / 0.2;
      altitudeFt = Math.round(climbFrac * 36000);
      speedKts = Math.round(160 + climbFrac * 300);
    } else if (progressFraction >= 0.8) {
      const descFrac = (1 - progressFraction) / 0.2;
      altitudeFt = Math.round(descFrac * 36000);
      speedKts = Math.round(150 + descFrac * 310);
    } else {
      altitudeFt = 36000;
      speedKts = Math.round(460 + (currentIndex % 5) * 4); // minor cruise variance
    }

    let heading = 0;
    if (currentIndex < totalPoints - 1) {
      const nextCoord = coordinates[currentIndex + 1];
      heading = calculateBearing(lat, lng, nextCoord[1], nextCoord[0]);
    } else if (currentIndex > 0) {
      const prevCoord = coordinates[currentIndex - 1];
      heading = calculateBearing(prevCoord[1], prevCoord[0], lat, lng);
    }

    const recordedAt = new Date().toISOString();

    // 1. Insert telemetry record into DB
    try {
      await this.supabase.adminClient.from('flight_telemetry').insert({
        movement_id: movementId,
        aircraft_id: aircraftId,
        lat,
        lng,
        altitude_ft: altitudeFt,
        speed_kts: speedKts,
        heading,
        recorded_at: recordedAt,
      });
    } catch (err: any) {
      this.logger.warn(`Failed to insert flight telemetry: ${err.message}`);
    }

    // 2. Broadcast on /realtime socket room
    const progressPercent = Math.round(progressFraction * 100);
    const telemetryPayload = {
      movementId: state.movementId,
      flightId: state.flightId,
      aircraftId: state.aircraftId,
      pilotId: state.pilotId,
      flightNumber: state.flightNumber,
      tailNumber: state.tailNumber,
      aircraftType: state.aircraftType,
      pilotName: state.pilotName,
      originAirportName: state.originAirportName,
      destinationAirportName: state.destinationAirportName,
      lat,
      lng,
      altitudeFt,
      speedKts,
      heading,
      status: 'in_transit',
      progressPercent,
      distanceKm: state.distanceKm,
      durationMinutes: state.predictedDurationMinutes,
      timestamp: recordedAt,
    };

    if (this.realtimeGateway.server) {
      this.realtimeGateway.server
        .to(`org:${orgId}`)
        .emit('airways:telemetry', telemetryPayload);
    }

    // 3. Digital Twin Ghost Projection Broadcast
    this.broadcastGhostProjection(state);

    // 4. Geofence evaluation
    await this.checkGeofences(state, lat, lng);

    // 5. Simulated rule-based weather / turbulence advisory event at ~50%
    if (!state.simulatedAlertSent && progressFraction >= 0.45 && progressFraction <= 0.6) {
      state.simulatedAlertSent = true;
      try {
        await this.supabase.adminClient.from('alerts').insert({
          org_id: orgId,
          type: 'weather',
          severity: 'medium',
          message: `[Simulated Alert] Clear-air turbulence advisory encountered along Great-Circle flight corridor for ${state.flightNumber} at FL360. Seatbelt sign illuminated.`,
          created_at: new Date().toISOString(),
        });

        await this.notificationsService.createNotification(orgId, {
          type: 'alert',
          title: `Turbulence Advisory`,
          body: `Flight ${state.flightNumber} at FL360 reported clear-air turbulence`,
        });
      } catch (err: any) {
        this.logger.warn(`Failed to generate simulated weather alert: ${err.message}`);
      }
    }

    // Advance index based on speedMultiplier
    const stepSize = Math.max(1, Math.round(state.speedMultiplier / 15));
    state.currentIndex += stepSize;
    state.lastLat = lat;
    state.lastLng = lng;
  }

  /**
   * Calculates digital twin ghost position along scheduled flight Great-Circle path and broadcasts deviation.
   */
  private broadcastGhostProjection(state: ActiveFlightSimulationState) {
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
      vehicleId: state.aircraftId,
      ghostLat,
      ghostLng,
      deviationMinutes,
      status,
    };

    if (this.realtimeGateway.server) {
      this.realtimeGateway.server.to(`org:${state.orgId}`).emit('airways:ghost_position', payload);
      this.realtimeGateway.server.to(`org:${state.orgId}`).emit('tracking:ghost_position', payload);
    }
  }

  private async checkGeofences(
    state: ActiveFlightSimulationState,
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
        if (!gf.center_lat || !gf.center_lng || !gf.radius_m) continue;
        const distM = calculateDistanceMeters(lat, lng, gf.center_lat, gf.center_lng);
        const isInside = distM <= gf.radius_m;
        const wasInside = state.insideGeofenceIds.has(gf.id);

        if (isInside && !wasInside) {
          state.insideGeofenceIds.add(gf.id);
          // Geofence Entry Event
          await this.supabase.adminClient.from('geofence_events').insert({
            geofence_id: gf.id,
            movement_id: state.movementId,
            event_type: 'entry',
            occurred_at: new Date().toISOString(),
          });

          await this.notificationsService.createNotification(state.orgId, {
            type: 'info',
            title: `Airspace Geofence Entry`,
            body: `Aircraft ${state.tailNumber} (Flight ${state.flightNumber}) entered airspace geofence: ${gf.name}`,
          });
        } else if (!isInside && wasInside) {
          state.insideGeofenceIds.delete(gf.id);
          // Geofence Exit Event
          await this.supabase.adminClient.from('geofence_events').insert({
            geofence_id: gf.id,
            movement_id: state.movementId,
            event_type: 'exit',
            occurred_at: new Date().toISOString(),
          });

          await this.notificationsService.createNotification(state.orgId, {
            type: 'info',
            title: `Airspace Geofence Departure`,
            body: `Aircraft ${state.tailNumber} (Flight ${state.flightNumber}) departed airspace geofence: ${gf.name}`,
          });
        }
      }
    } catch (err: any) {
      this.logger.warn(`Airways geofence evaluation failed: ${err.message}`);
    }
  }

  private async completeFlightMovement(state: ActiveFlightSimulationState) {
    this.stopSimulation(state.movementId);
    const completedAt = new Date();
    const completedAtIso = completedAt.toISOString();
    const durationMinutes = Math.max(
      1,
      Math.round(((completedAt.getTime() - state.startTime.getTime()) / 1000) * (state.speedMultiplier / 60)),
    );

    this.logger.log(
      `Flight movement ${state.movementId} (${state.flightNumber}) completed at ${state.destinationAirportName}`,
    );

    try {
      // 1. Compute Aviation Carbon Footprint
      const carbonResult = this.airCarbonService.calculateFlightCarbon(
        state.distanceKm,
        40, // 40 tonnes standard freighter cargo
      );

      // 2. Fetch recorded telemetry & compute Pilot Flight Score
      const { data: recordedTelemetry } = await this.supabase.adminClient
        .from('flight_telemetry')
        .select('*')
        .eq('movement_id', state.movementId)
        .order('recorded_at', { ascending: true });

      let crewScore = null;
      if (recordedTelemetry && recordedTelemetry.length > 0) {
        crewScore = await this.crewFlightScoringService.computeFlightCrewScore(
          state.movementId,
          state.pilotId,
          recordedTelemetry,
        );
      }

      // 3. Log Pilot FDTL Duty Record
      await this.flightDutyService.recordFlightDuty(
        state.orgId,
        state.movementId,
        state.pilotId,
        durationMinutes,
        state.startTime,
        completedAt,
      );

      // 4. Update movement record with intelligence results
      await this.supabase.adminClient
        .from('flight_movements')
        .update({
          status: 'completed',
          completed_at: completedAtIso,
          actual_duration_minutes: durationMinutes,
          carbon_kg: carbonResult.carbonKg,
        })
        .eq('id', state.movementId)
        .eq('org_id', state.orgId);

      // 5. Free aircraft and crew status
      await this.supabase.adminClient
        .from('aircraft')
        .update({ status: 'idle' })
        .eq('id', state.aircraftId);

      await this.supabase.adminClient
        .from('flight_crew')
        .update({ status: 'available' })
        .eq('id', state.pilotId);

      // 6. Emit completion socket event
      if (this.realtimeGateway.server) {
        const completionPayload = {
          movementId: state.movementId,
          flightId: state.flightId,
          flightNumber: state.flightNumber,
          tailNumber: state.tailNumber,
          completedAt: completedAtIso,
          actualDurationMinutes: durationMinutes,
          carbonKg: carbonResult.carbonKg,
          crewScore: crewScore?.score ?? 100,
        };
        this.realtimeGateway.server.to(`org:${state.orgId}`).emit('airways:completed', completionPayload);
        this.realtimeGateway.server.to(`org:${state.orgId}`).emit('airways:flight_completed', completionPayload);
      }

      // 7. Auto-generate PDF flight movement report
      this.flightPdfReportService
        .generateAndStoreMovementReport(state.orgId, state.movementId)
        .catch((err) =>
          this.logger.warn(`Failed to auto-generate PDF report for flight ${state.movementId}: ${err.message}`),
        );

      // 8. Notification
      await this.notificationsService.createNotification(state.orgId, {
        type: 'info',
        title: `Flight Landed`,
        body: `Flight ${state.flightNumber} (${state.tailNumber}) has landed at ${state.destinationAirportName}. Pilot Score: ${crewScore?.score ?? 100}/100. Carbon: ${carbonResult.carbonKg} kg CO₂e.`,
        actionLabel: 'View Flight',
        actionUrl: `/airways/dashboard?movementId=${state.movementId}`,
      });
    } catch (err: any) {
      this.logger.error(`Error completing flight movement ${state.movementId}: ${err.message}`);
    }
  }
}
