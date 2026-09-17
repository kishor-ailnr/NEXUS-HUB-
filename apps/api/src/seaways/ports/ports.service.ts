import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { SupabaseService } from '../../supabase/supabase.service';
import { GeocodingService } from '../../geocoding/geocoding.service';
import { Port, CreatePortDto } from '@nexus-ways/shared';

@Injectable()
export class PortsService {
  private readonly logger = new Logger(PortsService.name);

  constructor(
    private readonly supabase: SupabaseService,
    private readonly geocodingService: GeocodingService,
  ) {}

  async create(orgId: string, dto: CreatePortDto): Promise<Port> {
    let lat = dto.lat ?? null;
    let lng = dto.lng ?? null;

    // If coordinates are missing and address/name is provided, use GeocodingService
    if ((lat === null || lng === null) && (dto.address || dto.name)) {
      const query = dto.address || dto.name;
      try {
        let coords = await this.geocodingService.geocodeAddress(query);
        if (!coords && !dto.address) {
          coords = await this.geocodingService.geocodeAddress(`${dto.name} Port, India`);
        }
        if (coords) {
          lat = (coords as any).latitude ?? (coords as any).lat;
          lng = (coords as any).longitude ?? (coords as any).lng;
        }
      } catch (err: any) {
        this.logger.warn(`Geocoding failed for port ${dto.name}: ${err.message}`);
      }
    }

    const { data, error } = await this.supabase.adminClient
      .from('ports')
      .insert({
        org_id: orgId,
        name: dto.name.trim(),
        unlocode: dto.unlocode?.toUpperCase().trim() || null,
        lat,
        lng,
      })
      .select()
      .single();

    if (error) {
      this.logger.error(`Failed to create port: ${error.message}`);
      throw new BadRequestException(error.message || 'Failed to create port');
    }

    return data;
  }

  async findAll(orgId: string): Promise<Port[]> {
    const { data, error } = await this.supabase.adminClient
      .from('ports')
      .select('*')
      .eq('org_id', orgId)
      .order('name', { ascending: true });

    if (error) {
      this.logger.error(`Failed to fetch ports: ${error.message}`);
      throw new BadRequestException('Failed to fetch ports');
    }

    return data || [];
  }

  async findOne(orgId: string, id: string): Promise<Port> {
    const { data, error } = await this.supabase.adminClient
      .from('ports')
      .select('*')
      .eq('id', id)
      .eq('org_id', orgId)
      .maybeSingle();

    if (error || !data) {
      throw new NotFoundException(`Port ${id} not found`);
    }

    return data;
  }

  async update(orgId: string, id: string, dto: Partial<CreatePortDto>): Promise<Port> {
    const payload: any = {};
    if (dto.name !== undefined) payload.name = dto.name.trim();
    if (dto.unlocode !== undefined) payload.unlocode = dto.unlocode?.toUpperCase().trim() || null;
    if (dto.lat !== undefined) payload.lat = dto.lat;
    if (dto.lng !== undefined) payload.lng = dto.lng;

    const { data, error } = await this.supabase.adminClient
      .from('ports')
      .update(payload)
      .eq('id', id)
      .eq('org_id', orgId)
      .select()
      .single();

    if (error || !data) {
      this.logger.error(`Failed to update port: ${error?.message}`);
      throw new NotFoundException(`Port ${id} not found or update failed`);
    }

    return data;
  }

  async delete(orgId: string, id: string): Promise<{ success: boolean }> {
    const { error } = await this.supabase.adminClient
      .from('ports')
      .delete()
      .eq('id', id)
      .eq('org_id', orgId);

    if (error) {
      this.logger.error(`Failed to delete port: ${error.message}`);
      throw new BadRequestException('Failed to delete port');
    }

    return { success: true };
  }
}
