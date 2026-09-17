import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { SupabaseService } from '../../supabase/supabase.service';
import { StationsService } from '../stations/stations.service';
import { RailRoutingService } from '../routing/rail-routing.service';
import { RailSimulationService } from './rail-simulation.service';
import { SlotIntelligenceService } from '../intelligence/slot-intelligence.service';
import { RailEtaService } from '../intelligence/rail-eta.service';
import { RailPdfReportService } from '../reports/rail-pdf-report.service';
import { CrewScoringService } from '../intelligence/crew-scoring.service';
import {
  TrainMovement,
  CreateTrainMovementDto,
  TrainMovementStatus,
  SavedRailRoute,
  RailSlotCheckResponse,
  TrainMovementEtaResponse,
  TrainMovementReportUrlResponse,
  AdminRailReport,
  CrewBehaviorScore,
} from '@nexus-ways/shared';

@Injectable()
export class TrainMovementsService {
  private readonly logger = new Logger(TrainMovementsService.name);

  constructor(
    private readonly supabase: SupabaseService,
    private readonly stationsService: StationsService,
    private readonly railRoutingService: RailRoutingService,
    private readonly simulationService: RailSimulationService,
    private readonly slotIntelligenceService: SlotIntelligenceService,
    private readonly railEtaService: RailEtaService,
    private readonly railPdfReportService: RailPdfReportService,
    private readonly crewScoringService: CrewScoringService,
  ) {}

  async create(orgId: string, dto: CreateTrainMovementDto): Promise<TrainMovement> {
    const trainId = dto.trainId || (dto as any).train_id;
    const locoPilotId = dto.locoPilotId || (dto as any).loco_pilot_id;
    const originStationId = dto.originStationId || (dto as any).origin_station_id;
    const destinationStationId = dto.destinationStationId || (dto as any).destination_station_id;
    const simulationSpeedMultiplier =
      dto.simulationSpeedMultiplier || (dto as any).simulation_speed_multiplier || 60;
    const intermediateStationIds =
      dto.intermediateStationIds || (dto as any).intermediate_station_ids || [];

    if (!trainId || !locoPilotId || !originStationId || !destinationStationId) {
      throw new BadRequestException('trainId, locoPilotId, originStationId, and destinationStationId are required');
    }

    if (originStationId === destinationStationId) {
      throw new BadRequestException('Origin and destination stations must be distinct');
    }

    // 1. Fetch stations
    const originStation = await this.stationsService.findOne(orgId, originStationId);
    const destStation = await this.stationsService.findOne(orgId, destinationStationId);

    const intermediateStations = [];
    if (intermediateStationIds && intermediateStationIds.length > 0) {
      for (const stId of intermediateStationIds) {
        const st = await this.stationsService.findOne(orgId, stId);
        intermediateStations.push(st);
      }
    }

    // 2. Compute or retrieve rail route
    const routeGeometry = await this.railRoutingService.getOrComputeRoute(
      orgId,
      originStation,
      destStation,
      intermediateStations,
    );

    // 3. Create movement record with predicted_duration_minutes
    const { data: movement, error } = await this.supabase.adminClient
      .from('train_movements')
      .insert({
        org_id: orgId,
        train_id: trainId,
        loco_pilot_id: locoPilotId,
        origin_station_id: originStationId,
        destination_station_id: destinationStationId,
        status: 'planned' as TrainMovementStatus,
        distance_km: routeGeometry.distance_km,
        duration_minutes: routeGeometry.duration_minutes,
        predicted_duration_minutes: routeGeometry.duration_minutes,
        simulation_speed_multiplier: simulationSpeedMultiplier,
      })
      .select(`
        *,
        train:trains(*, locomotive:locomotives(*), rake:rakes(*)),
        loco_pilot:loco_pilots(*, user:users(id, email, full_name)),
        origin_station:stations!origin_station_id(*),
        destination_station:stations!destination_station_id(*)
      `)
      .single();

    if (error || !movement) {
      this.logger.error(`Failed to create train movement: ${error?.message}`);
      throw new BadRequestException(error?.message || 'Failed to create train movement');
    }

    // 4. Create movement stops
    const stopsPayload = [];
    stopsPayload.push({
      movement_id: movement.id,
      station_id: originStation.id,
      sequence: 1,
    });

    intermediateStations.forEach((st, idx) => {
      stopsPayload.push({
        movement_id: movement.id,
        station_id: st.id,
        sequence: idx + 2,
      });
    });

    stopsPayload.push({
      movement_id: movement.id,
      station_id: destStation.id,
      sequence: stopsPayload.length + 1,
    });

    await this.supabase.adminClient.from('train_movement_stops').insert(stopsPayload);

    // 5. Update train status to active and loco pilot to on_duty
    await this.supabase.adminClient
      .from('trains')
      .update({ status: 'active' })
      .eq('id', trainId);

    await this.supabase.adminClient
      .from('loco_pilots')
      .update({ status: 'on_duty' })
      .eq('id', locoPilotId);

    return {
      ...movement,
      route_geometry: routeGeometry,
      stops: stopsPayload,
    };
  }

  async findAll(orgId: string): Promise<TrainMovement[]> {
    const { data: movements, error } = await this.supabase.adminClient
      .from('train_movements')
      .select(`
        *,
        train:trains(*, locomotive:locomotives(*), rake:rakes(*)),
        loco_pilot:loco_pilots(*, user:users(id, email, full_name)),
        origin_station:stations!origin_station_id(*),
        destination_station:stations!destination_station_id(*)
      `)
      .eq('org_id', orgId)
      .order('created_at', { ascending: false });

    if (error) {
      this.logger.error(`Failed to list train movements: ${error.message}`);
      throw new BadRequestException('Failed to list train movements');
    }

    if (!movements || movements.length === 0) return [];

    const movementIds = movements.map((m) => m.id);
    const { data: allStops } = await this.supabase.adminClient
      .from('train_movement_stops')
      .select('*, station:stations(*)')
      .in('movement_id', movementIds)
      .order('sequence', { ascending: true });

    const stopsByMovement = new Map<string, any[]>();
    (allStops || []).forEach((st) => {
      const list = stopsByMovement.get(st.movement_id) || [];
      list.push(st);
      stopsByMovement.set(st.movement_id, list);
    });

    // Also fetch route geometries from saved_rail_routes
    const { data: savedRoutes } = await this.supabase.adminClient
      .from('saved_rail_routes')
      .select('*')
      .eq('org_id', orgId);

    const routeMap = new Map<string, any>();
    (savedRoutes || []).forEach((r) => {
      routeMap.set(`${r.origin_station_id}-${r.destination_station_id}`, r.route_geometry);
    });

    return movements.map((m) => {
      const key = `${m.origin_station_id}-${m.destination_station_id}`;
      return {
        ...m,
        stops: stopsByMovement.get(m.id) || [],
        route_geometry: routeMap.get(key) || null,
      };
    });
  }

  async findOne(orgId: string, id: string): Promise<TrainMovement> {
    const { data: movement, error } = await this.supabase.adminClient
      .from('train_movements')
      .select(`
        *,
        train:trains(*, locomotive:locomotives(*), rake:rakes(*)),
        loco_pilot:loco_pilots(*, user:users(id, email, full_name)),
        origin_station:stations!origin_station_id(*),
        destination_station:stations!destination_station_id(*)
      `)
      .eq('org_id', orgId)
      .eq('id', id)
      .maybeSingle();

    if (error || !movement) {
      throw new NotFoundException(`Train movement ${id} not found`);
    }

    const { data: stops } = await this.supabase.adminClient
      .from('train_movement_stops')
      .select('*, station:stations(*)')
      .eq('movement_id', id)
      .order('sequence', { ascending: true });

    const { data: savedRoute } = await this.supabase.adminClient
      .from('saved_rail_routes')
      .select('*')
      .eq('org_id', orgId)
      .eq('origin_station_id', movement.origin_station_id)
      .eq('destination_station_id', movement.destination_station_id)
      .maybeSingle();

    const { data: crewScore } = await this.supabase.adminClient
      .from('crew_behavior_scores')
      .select('*')
      .eq('movement_id', id)
      .maybeSingle();

    return {
      ...movement,
      stops: stops || [],
      crew_score: crewScore || null,
      route_geometry: savedRoute?.route_geometry || null,
    };
  }

  async findSavedRoutes(orgId: string): Promise<SavedRailRoute[]> {
    const { data, error } = await this.supabase.adminClient
      .from('saved_rail_routes')
      .select(`
        *,
        origin_station:stations!origin_station_id(*),
        destination_station:stations!destination_station_id(*)
      `)
      .eq('org_id', orgId)
      .order('usage_count', { ascending: false });

    if (error) {
      this.logger.error(`Failed to list saved rail routes: ${error.message}`);
      throw new BadRequestException('Failed to list saved rail routes');
    }

    return data || [];
  }

  async updateStatus(orgId: string, id: string, status: TrainMovementStatus): Promise<TrainMovement> {
    const movement = await this.findOne(orgId, id);

    const payload: any = { status };
    if (status === 'in_transit' && !movement.started_at) {
      payload.started_at = new Date().toISOString();
    }
    if (status === 'completed' && !movement.completed_at) {
      payload.completed_at = new Date().toISOString();
    }

    const { error } = await this.supabase.adminClient
      .from('train_movements')
      .update(payload)
      .eq('id', id)
      .eq('org_id', orgId);

    if (error) {
      throw new BadRequestException(`Failed to update train movement status: ${error.message}`);
    }

    if (status === 'in_transit') {
      let routeGeom = movement.route_geometry;
      if (!routeGeom || !routeGeom.coordinates || routeGeom.coordinates.length < 2) {
        routeGeom = await this.railRoutingService.getOrComputeRoute(
          orgId,
          movement.origin_station!,
          movement.destination_station!,
        );
      }

      await this.simulationService.startMovementSimulation(
        id,
        orgId,
        movement.train_id,
        movement.loco_pilot_id,
        {
          type: routeGeom.type || 'LineString',
          coordinates: routeGeom.coordinates,
          distance_km: routeGeom.distance_km || 0,
          duration_minutes: routeGeom.duration_minutes || 0,
          routing_source: routeGeom.routing_source || 'overpass',
        },
        movement.simulation_speed_multiplier || 60,
        movement.origin_station?.name,
        movement.destination_station?.name,
      );
    } else if (status === 'completed' || status === 'cancelled') {
      this.simulationService.stopSimulation(id);

      await this.supabase.adminClient
        .from('trains')
        .update({ status: 'idle' })
        .eq('id', movement.train_id);

      await this.supabase.adminClient
        .from('loco_pilots')
        .update({ status: 'available' })
        .eq('id', movement.loco_pilot_id);

      if (status === 'completed') {
        this.railPdfReportService
          .generateAndStoreMovementReport(orgId, id)
          .catch((e) => this.logger.warn(`Report generation failed for ${id}: ${e.message}`));
      }
    }

    return this.findOne(orgId, id);
  }

  async getTelemetry(orgId: string, movementId: string): Promise<any[]> {
    await this.findOne(orgId, movementId);

    const { data, error } = await this.supabase.adminClient
      .from('train_telemetry')
      .select('*')
      .eq('movement_id', movementId)
      .order('recorded_at', { ascending: true });

    if (error) {
      throw new BadRequestException('Failed to retrieve train telemetry');
    }

    return data || [];
  }

  async checkSlot(
    orgId: string,
    originStationId: string,
    destinationStationId: string,
    proposedDeparture?: string,
  ): Promise<RailSlotCheckResponse> {
    return this.slotIntelligenceService.checkSlot(
      orgId,
      originStationId,
      destinationStationId,
      proposedDeparture,
    );
  }

  async getEtaConfidence(orgId: string, movementId: string): Promise<TrainMovementEtaResponse> {
    return this.railEtaService.calculateMovementEtaConfidence(orgId, movementId);
  }

  async getMovementReport(orgId: string, movementId: string): Promise<TrainMovementReportUrlResponse> {
    return this.railPdfReportService.getSignedReportUrl(orgId, movementId);
  }

  async getAdminReports(orgId: string): Promise<AdminRailReport[]> {
    return this.railPdfReportService.getAdminReports(orgId);
  }

  async getCrewScoreHistory(locoPilotId: string): Promise<CrewBehaviorScore[]> {
    return this.crewScoringService.getCrewBehaviorHistory(locoPilotId);
  }
}
