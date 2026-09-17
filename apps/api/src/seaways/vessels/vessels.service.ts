import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { SupabaseService } from '../../supabase/supabase.service';
import { Vessel, CreateVesselDto } from '@nexus-ways/shared';

@Injectable()
export class VesselsService {
  private readonly logger = new Logger(VesselsService.name);

  constructor(private readonly supabase: SupabaseService) {}

  async findAll(orgId: string): Promise<Vessel[]> {
    const { data, error } = await this.supabase.adminClient
      .from('vessels')
      .select('*')
      .eq('org_id', orgId)
      .order('vessel_name', { ascending: true });

    if (error) {
      this.logger.error(`Failed to fetch vessels: ${error.message}`);
      throw new BadRequestException('Failed to fetch vessels');
    }

    return data || [];
  }

  async findOne(orgId: string, id: string): Promise<Vessel> {
    const { data, error } = await this.supabase.adminClient
      .from('vessels')
      .select('*')
      .eq('id', id)
      .eq('org_id', orgId)
      .maybeSingle();

    if (error || !data) {
      throw new NotFoundException(`Vessel ${id} not found`);
    }

    return data;
  }

  async create(orgId: string, dto: CreateVesselDto): Promise<Vessel> {
    const vesselName = (dto.vessel_name || dto.vesselName)?.trim();
    const imoNumber = (dto.imo_number || dto.imoNumber)?.trim() || null;
    const vesselType = (dto.vessel_type || dto.vesselType)?.trim() || 'Container Ship';
    const dwtTonnes = dto.dwt_tonnes ?? dto.dwtTonnes ?? null;
    const status = dto.status || 'idle';

    if (!vesselName) {
      throw new BadRequestException('vessel_name is required');
    }

    const { data, error } = await this.supabase.adminClient
      .from('vessels')
      .insert({
        org_id: orgId,
        vessel_name: vesselName,
        imo_number: imoNumber,
        vessel_type: vesselType,
        dwt_tonnes: dwtTonnes,
        status,
      })
      .select()
      .single();

    if (error) {
      this.logger.error(`Failed to create vessel: ${error.message}`);
      throw new BadRequestException(error.message || 'Failed to create vessel');
    }

    return data;
  }

  async update(orgId: string, id: string, dto: Partial<CreateVesselDto>): Promise<Vessel> {
    const payload: any = {};
    if (dto.vessel_name !== undefined || dto.vesselName !== undefined) {
      payload.vessel_name = (dto.vessel_name || dto.vesselName)?.trim();
    }
    if (dto.imo_number !== undefined || dto.imoNumber !== undefined) {
      payload.imo_number = (dto.imo_number || dto.imoNumber)?.trim() || null;
    }
    if (dto.vessel_type !== undefined || dto.vesselType !== undefined) {
      payload.vessel_type = (dto.vessel_type || dto.vesselType)?.trim();
    }
    if (dto.dwt_tonnes !== undefined || dto.dwtTonnes !== undefined) {
      payload.dwt_tonnes = dto.dwt_tonnes ?? dto.dwtTonnes ?? null;
    }
    if (dto.status !== undefined) {
      payload.status = dto.status;
    }

    const { data, error } = await this.supabase.adminClient
      .from('vessels')
      .update(payload)
      .eq('id', id)
      .eq('org_id', orgId)
      .select()
      .single();

    if (error || !data) {
      this.logger.error(`Failed to update vessel: ${error?.message}`);
      throw new NotFoundException(`Vessel ${id} not found or update failed`);
    }

    return data;
  }

  async delete(orgId: string, id: string): Promise<{ success: boolean }> {
    const { error } = await this.supabase.adminClient
      .from('vessels')
      .delete()
      .eq('id', id)
      .eq('org_id', orgId);

    if (error) {
      this.logger.error(`Failed to delete vessel: ${error.message}`);
      throw new BadRequestException('Failed to delete vessel');
    }

    return { success: true };
  }
}
