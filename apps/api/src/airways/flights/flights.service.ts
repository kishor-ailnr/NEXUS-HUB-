import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { SupabaseService } from '../../supabase/supabase.service';
import { Flight, CreateFlightDto } from '@nexus-ways/shared';

@Injectable()
export class FlightsService {
  private readonly logger = new Logger(FlightsService.name);

  constructor(private readonly supabase: SupabaseService) {}

  async create(orgId: string, dto: CreateFlightDto): Promise<Flight> {
    const flightNumber = (dto.flight_number || (dto as any).flightNumber)?.toUpperCase().trim();
    const originAirportId = dto.origin_airport_id || (dto as any).originAirportId;
    const destinationAirportId = dto.destination_airport_id || (dto as any).destinationAirportId;

    if (!flightNumber || !originAirportId || !destinationAirportId) {
      throw new BadRequestException('flight_number, origin_airport_id, and destination_airport_id are required');
    }

    if (originAirportId === destinationAirportId) {
      throw new BadRequestException('Origin and destination airports must be distinct');
    }

    // Check if flight number already exists for this org
    const { data: existing } = await this.supabase.adminClient
      .from('flights')
      .select('id')
      .eq('org_id', orgId)
      .eq('flight_number', flightNumber)
      .maybeSingle();

    if (existing) {
      throw new ConflictException(`Flight with number ${flightNumber} already exists in this organization`);
    }

    const { data, error } = await this.supabase.adminClient
      .from('flights')
      .insert({
        org_id: orgId,
        flight_number: flightNumber,
        origin_airport_id: originAirportId,
        destination_airport_id: destinationAirportId,
      })
      .select(`
        *,
        origin_airport:airports!origin_airport_id(*),
        destination_airport:airports!destination_airport_id(*)
      `)
      .single();

    if (error) {
      this.logger.error(`Failed to create flight: ${error.message}`);
      throw new BadRequestException(error.message || 'Failed to create flight');
    }

    return data;
  }

  async findAll(orgId: string): Promise<Flight[]> {
    const { data, error } = await this.supabase.adminClient
      .from('flights')
      .select(`
        *,
        origin_airport:airports!origin_airport_id(*),
        destination_airport:airports!destination_airport_id(*)
      `)
      .eq('org_id', orgId)
      .order('flight_number', { ascending: true });

    if (error) {
      this.logger.error(`Failed to fetch flights: ${error.message}`);
      throw new BadRequestException('Failed to fetch flights');
    }

    return data || [];
  }

  async findOne(orgId: string, id: string): Promise<Flight> {
    const { data, error } = await this.supabase.adminClient
      .from('flights')
      .select(`
        *,
        origin_airport:airports!origin_airport_id(*),
        destination_airport:airports!destination_airport_id(*)
      `)
      .eq('id', id)
      .eq('org_id', orgId)
      .maybeSingle();

    if (error || !data) {
      throw new NotFoundException(`Flight ${id} not found`);
    }

    return data;
  }

  async update(orgId: string, id: string, dto: Partial<CreateFlightDto>): Promise<Flight> {
    const payload: any = {};
    if (dto.flight_number !== undefined) payload.flight_number = dto.flight_number.toUpperCase().trim();
    if (dto.origin_airport_id !== undefined) payload.origin_airport_id = dto.origin_airport_id;
    if (dto.destination_airport_id !== undefined) payload.destination_airport_id = dto.destination_airport_id;

    const { data, error } = await this.supabase.adminClient
      .from('flights')
      .update(payload)
      .eq('id', id)
      .eq('org_id', orgId)
      .select(`
        *,
        origin_airport:airports!origin_airport_id(*),
        destination_airport:airports!destination_airport_id(*)
      `)
      .single();

    if (error || !data) {
      this.logger.error(`Failed to update flight: ${error?.message}`);
      throw new NotFoundException(`Flight ${id} not found or update failed`);
    }

    return data;
  }

  async delete(orgId: string, id: string): Promise<{ success: boolean }> {
    const { error } = await this.supabase.adminClient
      .from('flights')
      .delete()
      .eq('id', id)
      .eq('org_id', orgId);

    if (error) {
      this.logger.error(`Failed to delete flight: ${error.message}`);
      throw new BadRequestException('Failed to delete flight');
    }

    return { success: true };
  }
}
