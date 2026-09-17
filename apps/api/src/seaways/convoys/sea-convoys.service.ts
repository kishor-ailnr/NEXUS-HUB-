import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { SupabaseService } from '../../supabase/supabase.service';
import {
  SeaConvoyGroup,
  SeaConvoyMember,
  CreateSeaConvoyDto,
  AddVesselToConvoyDto,
} from '@nexus-ways/shared';

@Injectable()
export class SeaConvoysService {
  private readonly logger = new Logger(SeaConvoysService.name);

  constructor(private readonly supabase: SupabaseService) {}

  async findAll(orgId: string): Promise<SeaConvoyGroup[]> {
    const { data: groups, error } = await this.supabase.adminClient
      .from('sea_convoy_groups')
      .select('*, members:sea_convoy_members(*, vessel:vessels(*))')
      .eq('org_id', orgId)
      .order('created_at', { ascending: false });

    if (error) {
      this.logger.error(`Failed to list convoy groups: ${error.message}`);
      throw new BadRequestException('Failed to list convoy groups');
    }

    return groups || [];
  }

  async findOne(orgId: string, id: string): Promise<SeaConvoyGroup> {
    const { data: group, error } = await this.supabase.adminClient
      .from('sea_convoy_groups')
      .select('*, members:sea_convoy_members(*, vessel:vessels(*))')
      .eq('id', id)
      .eq('org_id', orgId)
      .maybeSingle();

    if (error || !group) {
      throw new NotFoundException(`Convoy group ${id} not found`);
    }

    return group;
  }

  async create(orgId: string, dto: CreateSeaConvoyDto): Promise<SeaConvoyGroup> {
    const name = dto.name?.trim();
    if (!name) {
      throw new BadRequestException('Convoy group name is required');
    }

    const { data: group, error } = await this.supabase.adminClient
      .from('sea_convoy_groups')
      .insert({
        org_id: orgId,
        name,
      })
      .select()
      .single();

    if (error) {
      this.logger.error(`Failed to create convoy group: ${error.message}`);
      throw new BadRequestException(error.message || 'Failed to create convoy group');
    }

    // Add initial vessels if provided
    if (dto.vessel_ids && Array.isArray(dto.vessel_ids) && dto.vessel_ids.length > 0) {
      const memberInserts = dto.vessel_ids.map((vId) => ({
        convoy_id: group.id,
        vessel_id: vId,
      }));

      await this.supabase.adminClient
        .from('sea_convoy_members')
        .insert(memberInserts);
    }

    return this.findOne(orgId, group.id);
  }

  async addVessel(orgId: string, convoyId: string, dto: AddVesselToConvoyDto): Promise<SeaConvoyMember> {
    // Validate convoy exists in org
    await this.findOne(orgId, convoyId);

    const { data: member, error } = await this.supabase.adminClient
      .from('sea_convoy_members')
      .insert({
        convoy_id: convoyId,
        vessel_id: dto.vessel_id,
      })
      .select('*, vessel:vessels(*)')
      .single();

    if (error) {
      this.logger.error(`Failed to add vessel to convoy: ${error.message}`);
      throw new BadRequestException(error.message || 'Failed to add vessel to convoy');
    }

    return member;
  }

  async removeVessel(orgId: string, convoyId: string, vesselId: string): Promise<{ success: boolean }> {
    // Validate convoy exists in org
    await this.findOne(orgId, convoyId);

    const { error } = await this.supabase.adminClient
      .from('sea_convoy_members')
      .delete()
      .eq('convoy_id', convoyId)
      .eq('vessel_id', vesselId);

    if (error) {
      this.logger.error(`Failed to remove vessel from convoy: ${error.message}`);
      throw new BadRequestException('Failed to remove vessel from convoy');
    }

    return { success: true };
  }

  async delete(orgId: string, id: string): Promise<{ success: boolean }> {
    const { error } = await this.supabase.adminClient
      .from('sea_convoy_groups')
      .delete()
      .eq('id', id)
      .eq('org_id', orgId);

    if (error) {
      this.logger.error(`Failed to delete convoy group: ${error.message}`);
      throw new BadRequestException('Failed to delete convoy group');
    }

    return { success: true };
  }
}
