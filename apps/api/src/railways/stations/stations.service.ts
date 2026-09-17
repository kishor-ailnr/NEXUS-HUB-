import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { SupabaseService } from '../../supabase/supabase.service';
import { GeocodingService } from '../../geocoding/geocoding.service';
import { Station, CreateStationDto } from '@nexus-ways/shared';

@Injectable()
export class StationsService {
  private readonly logger = new Logger(StationsService.name);

  constructor(
    private readonly supabase: SupabaseService,
    private readonly geocodingService: GeocodingService,
  ) {}

  async create(orgId: string, dto: CreateStationDto): Promise<Station> {
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
        this.logger.warn(`Geocoding failed for station ${dto.name}: ${err.message}`);
      }
    }

    const { data, error } = await this.supabase.adminClient
      .from('stations')
      .insert({
        org_id: orgId,
        name: dto.name.trim(),
        station_code: dto.station_code?.toUpperCase().trim() || null,
        lat,
        lng,
        station_type: dto.station_type || 'station',
      })
      .select()
      .single();

    if (error) {
      this.logger.error(`Failed to create station: ${error.message}`);
      throw new BadRequestException(error.message || 'Failed to create station');
    }

    return data;
  }

  async findAll(orgId: string): Promise<Station[]> {
    const { data, error } = await this.supabase.adminClient
      .from('stations')
      .select('*')
      .eq('org_id', orgId)
      .order('name', { ascending: true });

    if (error) {
      this.logger.error(`Failed to fetch stations: ${error.message}`);
      throw new BadRequestException('Failed to fetch stations');
    }

    return data || [];
  }

  async findOne(orgId: string, id: string): Promise<Station> {
    const { data, error } = await this.supabase.adminClient
      .from('stations')
      .select('*')
      .eq('id', id)
      .eq('org_id', orgId)
      .maybeSingle();

    if (error || !data) {
      throw new NotFoundException(`Station ${id} not found`);
    }

    return data;
  }

  async update(orgId: string, id: string, dto: Partial<CreateStationDto>): Promise<Station> {
    const payload: any = {};
    if (dto.name !== undefined) payload.name = dto.name.trim();
    if (dto.station_code !== undefined) payload.station_code = dto.station_code?.toUpperCase().trim() || null;
    if (dto.station_type !== undefined) payload.station_type = dto.station_type;
    if (dto.lat !== undefined) payload.lat = dto.lat;
    if (dto.lng !== undefined) payload.lng = dto.lng;

    const { data, error } = await this.supabase.adminClient
      .from('stations')
      .update(payload)
      .eq('id', id)
      .eq('org_id', orgId)
      .select()
      .single();

    if (error || !data) {
      this.logger.error(`Failed to update station: ${error?.message}`);
      throw new NotFoundException(`Station ${id} not found or update failed`);
    }

    return data;
  }

  async delete(orgId: string, id: string): Promise<{ success: boolean }> {
    const { error } = await this.supabase.adminClient
      .from('stations')
      .delete()
      .eq('id', id)
      .eq('org_id', orgId);

    if (error) {
      this.logger.error(`Failed to delete station: ${error.message}`);
      throw new BadRequestException('Failed to delete station');
    }

    return { success: true };
  }
}
