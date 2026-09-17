import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { SupabaseService } from '../../supabase/supabase.service';
import { AirportsService } from '../airports/airports.service';
import { AircraftService } from '../aircraft/aircraft.service';
import { FlightCrewService } from '../crew/flight-crew.service';
import { FlightsService } from '../flights/flights.service';
import { AirRoutingService } from '../routing/air-routing.service';
import { FlightSimulationService } from './flight-simulation.service';
import { FlightEtaService } from '../intelligence/flight-eta.service';
import { AirCarbonService } from '../intelligence/air-carbon.service';
import { CrewFlightScoringService } from '../intelligence/crew-flight-scoring.service';
import { AirportSlotService } from '../intelligence/airport-slot.service';
import { FlightDutyService } from '../intelligence/flight-duty.service';
import { FlightPdfReportService } from '../reports/flight-pdf-report.service';
import {
  FlightMovement,
  CreateFlightMovementDto,
  FlightMovementStatus,
  FlightTelemetry,
  FlightMovementEtaResponse,
  FlightMovementReportUrlResponse,
  AdminFlightReport,
  AirportSlotCheckResponse,
  CrewFlightScore,
  FlightDutyLog,
} from '@nexus-ways/shared';

@Injectable()
export class FlightMovementsService {
  private readonly logger = new Logger(FlightMovementsService.name);

  constructor(
    private readonly supabase: SupabaseService,
    private readonly airportsService: AirportsService,
    private readonly aircraftService: AircraftService,
    private readonly flightCrewService: FlightCrewService,
    private readonly flightsService: FlightsService,
    private readonly airRoutingService: AirRoutingService,
    private readonly flightSimulationService: FlightSimulationService,
    private readonly flightEtaService: FlightEtaService,
    private readonly airCarbonService: AirCarbonService,
    private readonly crewFlightScoringService: CrewFlightScoringService,
    private readonly airportSlotService: AirportSlotService,
    private readonly flightDutyService: FlightDutyService,
    private readonly flightPdfReportService: FlightPdfReportService,
  ) {}

  async create(orgId: string, dto: CreateFlightMovementDto): Promise<FlightMovement> {
    let flightId = dto.flightId || dto.flight_id;
    const aircraftId = dto.aircraftId || dto.aircraft_id;
    const pilotId = dto.pilotId || dto.pilot_id;
    const simulationSpeedMultiplier =
      dto.simulationSpeedMultiplier || dto.simulation_speed_multiplier || 60;

    if (!aircraftId || !pilotId) {
      throw new BadRequestException('aircraftId and pilotId are required');
    }

    // 1. If flightId is not given directly, check if originAirportId & destinationAirportId are provided
    if (!flightId) {
      const originAirportId = dto.originAirportId || dto.origin_airport_id;
      const destAirportId = dto.destinationAirportId || dto.destination_airport_id;
      const flightNumber =
        dto.flightNumber ||
        dto.flight_number ||
        `NW-${Math.floor(100 + Math.random() * 899)}`;

      if (!originAirportId || !destAirportId) {
        throw new BadRequestException('Either flightId or (originAirportId and destinationAirportId) must be provided');
      }

      // Check if flight already exists
      const { data: existingFlight } = await this.supabase.adminClient
        .from('flights')
        .select('*')
        .eq('org_id', orgId)
        .eq('origin_airport_id', originAirportId)
        .eq('destination_airport_id', destAirportId)
        .maybeSingle();

      if (existingFlight) {
        flightId = existingFlight.id;
      } else {
        const newFlight = await this.flightsService.create(orgId, {
          flight_number: flightNumber,
          origin_airport_id: originAirportId,
          destination_airport_id: destAirportId,
        });
        flightId = newFlight.id;
      }
    }

    // 2. Fetch full flight with origin/destination airports
    const flight = await this.flightsService.findOne(orgId, flightId!);
    const aircraft = await this.aircraftService.findOne(orgId, aircraftId);
    const pilot = await this.flightCrewService.findOne(orgId, pilotId);

    let originAirport = flight.origin_airport;
    let destAirport = flight.destination_airport;

    if (!originAirport && flight.origin_airport_id) {
      originAirport = await this.airportsService.findOne(orgId, flight.origin_airport_id);
    }
    if (!destAirport && flight.destination_airport_id) {
      destAirport = await this.airportsService.findOne(orgId, flight.destination_airport_id);
    }

    if (!originAirport || !destAirport) {
      throw new BadRequestException('Origin or Destination airport missing coordinates');
    }

    const originLat = originAirport.lat ?? 19.0896;
    const originLng = originAirport.lng ?? 72.8656;
    const destLat = destAirport.lat ?? 28.5562;
    const destLng = destAirport.lng ?? 77.1000;

    // 3. Compute Great-Circle flight route directly
    const routeGeometry = this.airRoutingService.computeFlightRoute(
      { lat: originLat, lng: originLng, name: originAirport.name },
      { lat: destLat, lng: destLng, name: destAirport.name },
    );

    // 4. Initial Carbon estimate
    const carbonEst = this.airCarbonService.calculateFlightCarbon(routeGeometry.distance_km, 40);

    // 5. Create flight movement record
    const { data: movement, error } = await this.supabase.adminClient
      .from('flight_movements')
      .insert({
        org_id: orgId,
        flight_id: flightId,
        aircraft_id: aircraftId,
        pilot_id: pilotId,
        status: 'planned' as FlightMovementStatus,
        routing_method: 'great-circle',
        distance_km: routeGeometry.distance_km,
        duration_minutes: routeGeometry.duration_minutes,
        predicted_duration_minutes: routeGeometry.duration_minutes,
        carbon_kg: carbonEst.carbonKg,
        simulation_speed_multiplier: simulationSpeedMultiplier,
      })
      .select(`
        *,
        flight:flights(*, origin_airport:airports!origin_airport_id(*), destination_airport:airports!destination_airport_id(*)),
        aircraft:aircraft(*),
        pilot:flight_crew(*, user:users(id, email, full_name))
      `)
      .single();

    if (error) {
      this.logger.error(`Failed to create flight movement: ${error.message}`);
      throw new BadRequestException(error.message || 'Failed to create flight movement');
    }

    return movement;
  }

  async findAll(orgId: string): Promise<FlightMovement[]> {
    const { data: movements, error } = await this.supabase.adminClient
      .from('flight_movements')
      .select(`
        *,
        flight:flights(*, origin_airport:airports!origin_airport_id(*), destination_airport:airports!destination_airport_id(*)),
        aircraft:aircraft(*),
        pilot:flight_crew(*, user:users(id, email, full_name))
      `)
      .eq('org_id', orgId)
      .order('created_at', { ascending: false });

    if (error) {
      this.logger.error(`Failed to list flight movements: ${error.message}`);
      throw new BadRequestException('Failed to list flight movements');
    }

    return movements || [];
  }

  async findOne(orgId: string, id: string): Promise<FlightMovement> {
    const { data: movement, error } = await this.supabase.adminClient
      .from('flight_movements')
      .select(`
        *,
        flight:flights(*, origin_airport:airports!origin_airport_id(*), destination_airport:airports!destination_airport_id(*)),
        aircraft:aircraft(*),
        pilot:flight_crew(*, user:users(id, email, full_name))
      `)
      .eq('id', id)
      .eq('org_id', orgId)
      .maybeSingle();

    if (error || !movement) {
      throw new NotFoundException(`Flight movement ${id} not found`);
    }

    return movement;
  }

  async updateStatus(
    orgId: string,
    id: string,
    status: FlightMovementStatus,
  ): Promise<FlightMovement> {
    const movement = await this.findOne(orgId, id);

    if (status === 'in_transit' && movement.status !== 'in_transit') {
      const startedAt = new Date().toISOString();

      await this.supabase.adminClient
        .from('flight_movements')
        .update({ status: 'in_transit', started_at: startedAt })
        .eq('id', id);

      // Update aircraft & crew status
      await this.supabase.adminClient
        .from('aircraft')
        .update({ status: 'active' })
        .eq('id', movement.aircraft_id);

      await this.supabase.adminClient
        .from('flight_crew')
        .update({ status: 'on_duty' })
        .eq('id', movement.pilot_id);

      // Compute route geometry
      let flight = movement.flight;
      if (!flight && movement.flight_id) {
        flight = await this.flightsService.findOne(orgId, movement.flight_id).catch(() => null);
      }
      let originAirport = flight?.origin_airport;
      let destAirport = flight?.destination_airport;
      if (!originAirport && flight?.origin_airport_id) {
        originAirport = await this.airportsService.findOne(orgId, flight.origin_airport_id).catch(() => null);
      }
      if (!destAirport && flight?.destination_airport_id) {
        destAirport = await this.airportsService.findOne(orgId, flight.destination_airport_id).catch(() => null);
      }

      const originLat = originAirport?.lat ?? 19.0896;
      const originLng = originAirport?.lng ?? 72.8656;
      const destLat = destAirport?.lat ?? 28.5562;
      const destLng = destAirport?.lng ?? 77.1000;

      const routeGeometry = this.airRoutingService.computeFlightRoute(
        { lat: originLat, lng: originLng, name: originAirport?.name || 'Origin' },
        { lat: destLat, lng: destLng, name: destAirport?.name || 'Destination' },
      );

      // Start simulation
      await this.flightSimulationService.startFlightSimulation(
        id,
        orgId,
        movement.flight_id,
        movement.aircraft_id,
        movement.pilot_id,
        routeGeometry,
        movement.simulation_speed_multiplier || 60,
        flight?.flight_number || movement.flight?.flight_number || 'NW-701',
        movement.aircraft?.tail_number || 'VT-NEX',
        movement.aircraft?.aircraft_type || 'Boeing 777F',
        movement.pilot?.user?.full_name || 'Pilot',
        originAirport?.name || movement.flight?.origin_airport?.name || 'Origin',
        destAirport?.name || movement.flight?.destination_airport?.name || 'Destination',
      );
    } else if (status === 'cancelled') {
      this.flightSimulationService.stopSimulation(id);

      await this.supabase.adminClient
        .from('flight_movements')
        .update({ status: 'cancelled' })
        .eq('id', id);

      await this.supabase.adminClient
        .from('aircraft')
        .update({ status: 'idle' })
        .eq('id', movement.aircraft_id);

      await this.supabase.adminClient
        .from('flight_crew')
        .update({ status: 'available' })
        .eq('id', movement.pilot_id);
    } else if (status === 'completed') {
      this.flightSimulationService.stopSimulation(id);

      await this.supabase.adminClient
        .from('flight_movements')
        .update({ status: 'completed', completed_at: new Date().toISOString() })
        .eq('id', id);

      await this.supabase.adminClient
        .from('aircraft')
        .update({ status: 'idle' })
        .eq('id', movement.aircraft_id);

      await this.supabase.adminClient
        .from('flight_crew')
        .update({ status: 'available' })
        .eq('id', movement.pilot_id);
    }

    return this.findOne(orgId, id);
  }

  async getTelemetry(orgId: string, id: string): Promise<FlightTelemetry[]> {
    await this.findOne(orgId, id);

    const { data: telemetry, error } = await this.supabase.adminClient
      .from('flight_telemetry')
      .select('*')
      .eq('movement_id', id)
      .order('recorded_at', { ascending: true });

    if (error) {
      this.logger.error(`Failed to fetch flight telemetry: ${error.message}`);
      throw new BadRequestException('Failed to fetch flight telemetry');
    }

    return telemetry || [];
  }

  async getEtaConfidence(orgId: string, movementId: string): Promise<FlightMovementEtaResponse> {
    return this.flightEtaService.calculateMovementEta(orgId, movementId);
  }

  async getCrewScore(movementId: string): Promise<CrewFlightScore[]> {
    return this.crewFlightScoringService.getCrewScoreHistory(movementId);
  }

  async checkSlots(
    orgId: string,
    originAirportId: string,
    destAirportId: string,
    proposedDeparture?: string,
  ): Promise<AirportSlotCheckResponse> {
    return this.airportSlotService.checkAirportSlots(
      orgId,
      originAirportId,
      destAirportId,
      proposedDeparture,
    );
  }

  async getDutyLogs(pilotId: string): Promise<FlightDutyLog[]> {
    return this.flightDutyService.getPilotDutyLogs(pilotId);
  }

  async getMovementReport(orgId: string, movementId: string): Promise<FlightMovementReportUrlResponse> {
    return this.flightPdfReportService.getSignedReportUrl(orgId, movementId);
  }

  async getAdminReports(orgId: string): Promise<AdminFlightReport[]> {
    return this.flightPdfReportService.getAdminReports(orgId);
  }
}
