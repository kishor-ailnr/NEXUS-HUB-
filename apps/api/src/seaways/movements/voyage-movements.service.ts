import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { SupabaseService } from '../../supabase/supabase.service';
import { SeaRoutingService } from '../routing/sea-routing.service';
import { VoyageSimulationService } from './voyage-simulation.service';
import { PortsService } from '../ports/ports.service';
import { VesselsService } from '../vessels/vessels.service';
import { SeaCrewService } from '../crew/sea-crew.service';
import { VoyagesService } from '../voyages/voyages.service';
import { SeaEtaService } from '../intelligence/sea-eta.service';
import { SeaCarbonService } from '../intelligence/sea-carbon.service';
import { SeaCrewScoringService } from '../intelligence/sea-crew-scoring.service';
import { PortSlotService } from '../intelligence/port-slot.service';
import { WatchkeepingService } from '../intelligence/watchkeeping.service';
import { SeawaysPdfReportService } from '../reports/seaways-pdf-report.service';
import {
  VoyageMovement,
  CreateVoyageMovementDto,
  VoyageMovementStatus,
  VesselTelemetry,
  VoyageMovementEtaResponse,
  VoyageMovementReportUrlResponse,
  AdminSeaReport,
  PortSlotCheckResponse,
  SeaCrewScore,
  WatchkeepingLog,
} from '@nexus-ways/shared';

@Injectable()
export class VoyageMovementsService {
  private readonly logger = new Logger(VoyageMovementsService.name);

  constructor(
    private readonly supabase: SupabaseService,
    private readonly seaRoutingService: SeaRoutingService,
    private readonly voyageSimulationService: VoyageSimulationService,
    private readonly portsService: PortsService,
    private readonly vesselsService: VesselsService,
    private readonly seaCrewService: SeaCrewService,
    private readonly voyagesService: VoyagesService,
    private readonly seaEtaService: SeaEtaService,
    private readonly seaCarbonService: SeaCarbonService,
    private readonly seaCrewScoringService: SeaCrewScoringService,
    private readonly portSlotService: PortSlotService,
    private readonly watchkeepingService: WatchkeepingService,
    private readonly seawaysPdfReportService: SeawaysPdfReportService,
  ) {}

  async findAll(orgId: string): Promise<VoyageMovement[]> {
    const { data: movements, error } = await this.supabase.adminClient
      .from('voyage_movements')
      .select(
        `
        *,
        voyage:voyages(
          *,
          origin_port:ports!origin_port_id(*),
          destination_port:ports!destination_port_id(*)
        ),
        vessel:vessels(*),
        master:sea_crew(
          *,
          user:users(id, email, full_name)
        )
      `,
      )
      .eq('org_id', orgId)
      .order('created_at', { ascending: false });

    if (error) {
      this.logger.error(`Failed to list voyage movements: ${error.message}`);
      throw new BadRequestException('Failed to list voyage movements');
    }

    // Attach latest telemetry & saved sea route geometry & crew score for each movement
    const enhancedMovements = await Promise.all(
      (movements || []).map(async (m: any) => {
        const { data: latestTel } = await this.supabase.adminClient
          .from('vessel_telemetry')
          .select('*')
          .eq('movement_id', m.id)
          .order('recorded_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        const { data: crewScore } = await this.supabase.adminClient
          .from('sea_crew_scores')
          .select('*')
          .eq('movement_id', m.id)
          .maybeSingle();

        let routeGeometry = null;
        if (m.voyage?.origin_port_id && m.voyage?.destination_port_id) {
          const { data: savedRoute } = await this.supabase.adminClient
            .from('saved_sea_routes')
            .select('route_geometry, routing_source')
            .eq('org_id', orgId)
            .eq('origin_port_id', m.voyage.origin_port_id)
            .eq('destination_port_id', m.voyage.destination_port_id)
            .maybeSingle();

          if (savedRoute?.route_geometry) {
            routeGeometry = savedRoute.route_geometry;
          }
        }

        return {
          ...m,
          latest_telemetry: latestTel || null,
          crew_score: crewScore || null,
          route_geometry: routeGeometry,
        };
      }),
    );

    return enhancedMovements;
  }

  async findOne(orgId: string, id: string): Promise<VoyageMovement> {
    const { data: movement, error } = await this.supabase.adminClient
      .from('voyage_movements')
      .select(
        `
        *,
        voyage:voyages(
          *,
          origin_port:ports!origin_port_id(*),
          destination_port:ports!destination_port_id(*)
        ),
        vessel:vessels(*),
        master:sea_crew(
          *,
          user:users(id, email, full_name)
        )
      `,
      )
      .eq('id', id)
      .eq('org_id', orgId)
      .maybeSingle();

    if (error || !movement) {
      throw new NotFoundException(`Voyage movement ${id} not found`);
    }

    const { data: latestTel } = await this.supabase.adminClient
      .from('vessel_telemetry')
      .select('*')
      .eq('movement_id', id)
      .order('recorded_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    const { data: crewScore } = await this.supabase.adminClient
      .from('sea_crew_scores')
      .select('*')
      .eq('movement_id', id)
      .maybeSingle();

    let routeGeometry = null;
    if (movement.voyage?.origin_port_id && movement.voyage?.destination_port_id) {
      const { data: savedRoute } = await this.supabase.adminClient
        .from('saved_sea_routes')
        .select('route_geometry, routing_source')
        .eq('org_id', orgId)
        .eq('origin_port_id', movement.voyage.origin_port_id)
        .eq('destination_port_id', movement.voyage.destination_port_id)
        .maybeSingle();

      if (savedRoute?.route_geometry) {
        routeGeometry = savedRoute.route_geometry;
      }
    }

    return {
      ...movement,
      latest_telemetry: latestTel || null,
      crew_score: crewScore || null,
      route_geometry: routeGeometry,
    };
  }

  async create(orgId: string, dto: CreateVoyageMovementDto): Promise<VoyageMovement> {
    const vesselId = dto.vesselId || dto.vessel_id;
    const masterId = dto.masterId || dto.master_id;
    let voyageId = dto.voyageId || dto.voyage_id;
    const originPortId = dto.originPortId || dto.origin_port_id;
    const destinationPortId = dto.destinationPortId || dto.destination_port_id;
    const voyageNumber = (dto.voyageNumber || dto.voyage_number)?.trim();
    const speedMultiplier = dto.simulationSpeedMultiplier ?? dto.simulation_speed_multiplier ?? 60;

    if (!vesselId || !masterId) {
      throw new BadRequestException('vessel_id and master_id are required');
    }

    // 1. Resolve or create voyage
    let voyage: any;
    if (voyageId) {
      voyage = await this.voyagesService.findOne(orgId, voyageId);
    } else if (originPortId && destinationPortId) {
      const vNum = voyageNumber || `VOY-${Date.now().toString().slice(-6)}`;
      voyage = await this.voyagesService.create(orgId, {
        voyage_number: vNum,
        origin_port_id: originPortId,
        destination_port_id: destinationPortId,
      });
      voyageId = voyage.id;
    } else {
      throw new BadRequestException('Either voyage_id or (origin_port_id and destination_port_id) is required');
    }

    // 2. Validate vessel and master
    const vessel = await this.vesselsService.findOne(orgId, vesselId);
    const master = await this.seaCrewService.findOne(orgId, masterId);

    // 3. Compute or fetch cached land-avoiding sea route
    const originPort = await this.portsService.findOne(orgId, voyage.origin_port_id);
    const destPort = await this.portsService.findOne(orgId, voyage.destination_port_id);

    const seaRoute = await this.seaRoutingService.getOrComputeRoute(orgId, originPort, destPort);

    // 4. Create voyage movement
    const { data: newMovement, error: movError } = await this.supabase.adminClient
      .from('voyage_movements')
      .insert({
        org_id: orgId,
        voyage_id: voyageId,
        vessel_id: vesselId,
        master_id: masterId,
        status: 'planned',
        distance_km: seaRoute.distance_km,
        duration_minutes: seaRoute.duration_minutes,
        predicted_duration_minutes: seaRoute.duration_minutes,
        simulation_speed_multiplier: speedMultiplier,
      })
      .select(
        `
        *,
        voyage:voyages(
          *,
          origin_port:ports!origin_port_id(*),
          destination_port:ports!destination_port_id(*)
        ),
        vessel:vessels(*),
        master:sea_crew(
          *,
          user:users(id, email, full_name)
        )
      `,
      )
      .single();

    if (movError) {
      this.logger.error(`Failed to create voyage movement: ${movError.message}`);
      throw new BadRequestException(movError.message || 'Failed to create voyage movement');
    }

    // 5. Update vessel & master status to active / on_duty
    await this.supabase.adminClient
      .from('vessels')
      .update({ status: 'active' })
      .eq('id', vesselId);

    await this.supabase.adminClient
      .from('sea_crew')
      .update({ status: 'on_duty' })
      .eq('id', masterId);

    return {
      ...newMovement,
      route_geometry: seaRoute,
    };
  }

  async updateStatus(
    orgId: string,
    id: string,
    status: VoyageMovementStatus,
  ): Promise<VoyageMovement> {
    const movement = await this.findOne(orgId, id);

    if (status === 'in_transit') {
      const startedAt = new Date().toISOString();

      const { error } = await this.supabase.adminClient
        .from('voyage_movements')
        .update({
          status: 'in_transit',
          started_at: startedAt,
        })
        .eq('id', id)
        .eq('org_id', orgId);

      if (error) {
        throw new BadRequestException(`Failed to dispatch voyage movement: ${error.message}`);
      }

      // Start in-process land-avoiding simulation
      const routeGeometry = movement.route_geometry || {
        coordinates: [
          [movement.voyage?.origin_port?.lng || 72.8, movement.voyage?.origin_port?.lat || 18.9],
          [movement.voyage?.destination_port?.lng || 80.2, movement.voyage?.destination_port?.lat || 13.0],
        ],
        distance_km: movement.distance_km || 100,
        duration_minutes: movement.duration_minutes || 60,
      };

      this.voyageSimulationService.startSimulation(
        orgId,
        id,
        routeGeometry as any,
        movement.simulation_speed_multiplier || 60,
      );
    } else if (status === 'completed' || status === 'cancelled') {
      this.voyageSimulationService.stopSimulation(id);

      await this.supabase.adminClient
        .from('voyage_movements')
        .update({
          status,
          completed_at: new Date().toISOString(),
        })
        .eq('id', id)
        .eq('org_id', orgId);

      // Release vessel and master
      await this.supabase.adminClient
        .from('vessels')
        .update({ status: 'idle' })
        .eq('id', movement.vessel_id);

      await this.supabase.adminClient
        .from('sea_crew')
        .update({ status: 'available' })
        .eq('id', movement.master_id);
    }

    return this.findOne(orgId, id);
  }

  async getEtaConfidence(orgId: string, id: string): Promise<VoyageMovementEtaResponse> {
    return this.seaEtaService.calculateVoyageEta(orgId, id);
  }

  async getCrewScore(id: string): Promise<SeaCrewScore[]> {
    return this.seaCrewScoringService.getCrewScoreHistory(id);
  }

  async getWatchkeepingLogs(crewId: string): Promise<WatchkeepingLog[]> {
    return this.watchkeepingService.getCrewWatchkeepingLogs(crewId);
  }

  async checkSlots(
    orgId: string,
    originPortId: string,
    destinationPortId: string,
    proposedDeparture?: string,
  ): Promise<PortSlotCheckResponse> {
    return this.portSlotService.checkPortSlots(
      orgId,
      originPortId,
      destinationPortId,
      proposedDeparture || new Date().toISOString(),
    );
  }

  async getMovementReport(orgId: string, id: string): Promise<VoyageMovementReportUrlResponse> {
    return this.seawaysPdfReportService.getSignedReportUrl(orgId, id);
  }

  async getAdminReports(orgId: string): Promise<AdminSeaReport[]> {
    return this.seawaysPdfReportService.getAdminReports(orgId);
  }

  async getTelemetry(orgId: string, movementId: string): Promise<VesselTelemetry[]> {
    const { data: telemetry, error } = await this.supabase.adminClient
      .from('vessel_telemetry')
      .select('*')
      .eq('movement_id', movementId)
      .order('recorded_at', { ascending: true });

    if (error) {
      this.logger.error(`Failed to fetch vessel telemetry: ${error.message}`);
      return [];
    }

    return telemetry || [];
  }
}
