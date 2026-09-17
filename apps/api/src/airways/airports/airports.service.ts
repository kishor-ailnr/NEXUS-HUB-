import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { SupabaseService } from '../../supabase/supabase.service';
import { GeocodingService } from '../../geocoding/geocoding.service';
import { Airport, CreateAirportDto } from '@nexus-ways/shared';

@Injectable()
export class AirportsService {
  private readonly logger = new Logger(AirportsService.name);

  constructor(
    private readonly supabase: SupabaseService,
    private readonly geocodingService: GeocodingService,
  ) {}

  async create(orgId: string, dto: CreateAirportDto): Promise<Airport> {
    let lat = dto.lat ?? null;
    let lng = dto.lng ?? null;

    // If coordinates are missing and address/name is provided, use GeocodingService
    if ((lat === null || lng === null) && (dto.address || dto.name)) {
      const query = dto.address || dto.name;
      try {
        let coords = await this.geocodingService.geocodeAddress(query);
        if (!coords && !dto.address) {
          coords = await this.geocodingService.geocodeAddress(`${dto.name}, India`);
        }
        if (coords) {
          lat = (coords as any).latitude ?? (coords as any).lat;
          lng = (coords as any).longitude ?? (coords as any).lng;
        }
      } catch (err: any) {
        this.logger.warn(`Geocoding failed for airport ${dto.name}: ${err.message}`);
      }
    }

    const { data, error } = await this.supabase.adminClient
      .from('airports')
      .insert({
        org_id: orgId,
        name: dto.name.trim(),
        iata_code: dto.iata_code?.toUpperCase().trim() || null,
        icao_code: dto.icao_code?.toUpperCase().trim() || null,
        lat,
        lng,
      })
      .select()
      .single();

    if (error) {
      this.logger.error(`Failed to create airport: ${error.message}`);
      throw new BadRequestException(error.message || 'Failed to create airport');
    }

    return data;
  }

  async findAll(orgId: string): Promise<Airport[]> {
    const { data, error } = await this.supabase.adminClient
      .from('airports')
      .select('*')
      .eq('org_id', orgId)
      .order('name', { ascending: true });

    if (error) {
      this.logger.error(`Failed to fetch airports: ${error.message}`);
      throw new BadRequestException('Failed to fetch airports');
    }

    return data || [];
  }

  async findOne(orgId: string, id: string): Promise<Airport> {
    const { data, error } = await this.supabase.adminClient
      .from('airports')
      .select('*')
      .eq('id', id)
      .eq('org_id', orgId)
      .maybeSingle();

    if (error || !data) {
      throw new NotFoundException(`Airport ${id} not found`);
    }

    return data;
  }

  async update(orgId: string, id: string, dto: Partial<CreateAirportDto>): Promise<Airport> {
    const payload: any = {};
    if (dto.name !== undefined) payload.name = dto.name.trim();
    if (dto.iata_code !== undefined) payload.iata_code = dto.iata_code?.toUpperCase().trim() || null;
    if (dto.icao_code !== undefined) payload.icao_code = dto.icao_code?.toUpperCase().trim() || null;
    if (dto.lat !== undefined) payload.lat = dto.lat;
    if (dto.lng !== undefined) payload.lng = dto.lng;

    const { data, error } = await this.supabase.adminClient
      .from('airports')
      .update(payload)
      .eq('id', id)
      .eq('org_id', orgId)
      .select()
      .single();

    if (error || !data) {
      this.logger.error(`Failed to update airport: ${error?.message}`);
      throw new NotFoundException(`Airport ${id} not found or update failed`);
    }

    return data;
  }

  async delete(orgId: string, id: string): Promise<{ success: boolean }> {
    const { error } = await this.supabase.adminClient
      .from('airports')
      .delete()
      .eq('id', id)
      .eq('org_id', orgId);

    if (error) {
      this.logger.error(`Failed to delete airport: ${error.message}`);
      throw new BadRequestException('Failed to delete airport');
    }

    return { success: true };
  }
}
