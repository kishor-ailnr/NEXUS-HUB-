import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { SupabaseService } from '../../supabase/supabase.service';
import { Locomotive, CreateLocomotiveDto } from '@nexus-ways/shared';

@Injectable()
export class LocomotivesService {
  private readonly logger = new Logger(LocomotivesService.name);

  constructor(private readonly supabase: SupabaseService) {}

  async create(orgId: string, dto: CreateLocomotiveDto): Promise<Locomotive> {
    const { data, error } = await this.supabase.adminClient
      .from('locomotives')
      .insert({
        org_id: orgId,
        loco_number: dto.loco_number.trim(),
        loco_type: dto.loco_type.trim(),
        power_kw: dto.power_kw ?? null,
        fuel_type: dto.fuel_type || 'electric',
        status: dto.status || 'idle',
      })
      .select()
      .single();

    if (error) {
      this.logger.error(`Failed to create locomotive: ${error.message}`);
      throw new BadRequestException(error.message || 'Failed to create locomotive');
    }

    return data;
  }

  async findAll(orgId: string): Promise<Locomotive[]> {
    const { data, error } = await this.supabase.adminClient
      .from('locomotives')
      .select('*')
      .eq('org_id', orgId)
      .order('created_at', { ascending: false });

    if (error) {
      this.logger.error(`Failed to list locomotives: ${error.message}`);
      throw new BadRequestException('Failed to list locomotives');
    }

    return data || [];
  }

  async findOne(orgId: string, id: string): Promise<Locomotive> {
    const { data, error } = await this.supabase.adminClient
      .from('locomotives')
      .select('*')
      .eq('id', id)
      .eq('org_id', orgId)
      .maybeSingle();

    if (error || !data) {
      throw new NotFoundException(`Locomotive ${id} not found`);
    }

    return data;
  }

  async update(orgId: string, id: string, dto: Partial<CreateLocomotiveDto>): Promise<Locomotive> {
    const payload: any = {};
    if (dto.loco_number !== undefined) payload.loco_number = dto.loco_number.trim();
    if (dto.loco_type !== undefined) payload.loco_type = dto.loco_type.trim();
    if (dto.power_kw !== undefined) payload.power_kw = dto.power_kw;
    if (dto.fuel_type !== undefined) payload.fuel_type = dto.fuel_type;
    if (dto.status !== undefined) payload.status = dto.status;

    const { data, error } = await this.supabase.adminClient
      .from('locomotives')
      .update(payload)
      .eq('id', id)
      .eq('org_id', orgId)
      .select()
      .single();

    if (error || !data) {
      this.logger.error(`Failed to update locomotive: ${error?.message}`);
      throw new NotFoundException(`Locomotive ${id} not found or update failed`);
    }

    return data;
  }

  async delete(orgId: string, id: string): Promise<{ success: boolean }> {
    const { error } = await this.supabase.adminClient
      .from('locomotives')
      .delete()
      .eq('id', id)
      .eq('org_id', orgId);

    if (error) {
      this.logger.error(`Failed to delete locomotive: ${error.message}`);
      throw new BadRequestException('Failed to delete locomotive');
    }

    return { success: true };
  }
}
