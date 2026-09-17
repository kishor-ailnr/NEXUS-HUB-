import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { ConvoyGroup, CreateConvoyDto } from '@nexus-ways/shared';

@Injectable()
export class ConvoysService {
  private readonly logger = new Logger(ConvoysService.name);

  constructor(private readonly supabase: SupabaseService) {}

  async findAll(orgId: string): Promise<ConvoyGroup[]> {
    const { data: convoys, error } = await this.supabase.adminClient
      .from('convoy_groups')
      .select(`
        *,
        members:convoy_members(
          id,
          convoy_id,
          vehicle_id,
          joined_at,
          vehicle:vehicles(id, registration_number, vehicle_type, status)
        )
      `)
      .eq('org_id', orgId)
      .order('created_at', { ascending: false });

    if (error) {
      this.logger.error(`Failed to list convoys: ${error.message}`);
      throw new BadRequestException('Failed to list convoys');
    }

    return convoys || [];
  }

  async findOne(orgId: string, id: string): Promise<ConvoyGroup> {
    const { data: convoy, error } = await this.supabase.adminClient
      .from('convoy_groups')
      .select(`
        *,
        members:convoy_members(
          id,
          convoy_id,
          vehicle_id,
          joined_at,
          vehicle:vehicles(id, registration_number, vehicle_type, status)
        )
      `)
      .eq('org_id', orgId)
      .eq('id', id)
      .maybeSingle();

    if (error || !convoy) {
      throw new NotFoundException('Convoy not found');
    }

    return convoy;
  }

  async create(orgId: string, dto: CreateConvoyDto): Promise<ConvoyGroup> {
    if (!dto.name || !dto.name.trim()) {
      throw new BadRequestException('Convoy name is required');
    }

    const { data: newConvoy, error } = await this.supabase.adminClient
      .from('convoy_groups')
      .insert({
        org_id: orgId,
        name: dto.name.trim(),
      })
      .select()
      .single();

    if (error) {
      this.logger.error(`Failed to create convoy: ${error.message}`);
      throw new BadRequestException('Failed to create convoy');
    }

    if (dto.vehicleIds && dto.vehicleIds.length > 0) {
      const memberInserts = dto.vehicleIds.map((vId) => ({
        convoy_id: newConvoy.id,
        vehicle_id: vId,
      }));

      await this.supabase.adminClient
        .from('convoy_members')
        .insert(memberInserts);
    }

    return this.findOne(orgId, newConvoy.id);
  }

  async addMember(orgId: string, convoyId: string, vehicleId: string): Promise<{ success: boolean }> {
    await this.findOne(orgId, convoyId);

    // Verify vehicle belongs to org
    const { data: vehicle } = await this.supabase.adminClient
      .from('vehicles')
      .select('id')
      .eq('org_id', orgId)
      .eq('id', vehicleId)
      .maybeSingle();

    if (!vehicle) {
      throw new NotFoundException('Vehicle not found in organization');
    }

    const { error } = await this.supabase.adminClient
      .from('convoy_members')
      .insert({
        convoy_id: convoyId,
        vehicle_id: vehicleId,
      });

    if (error) {
      if (error.code === '23505') {
        throw new ConflictException('Vehicle is already in this convoy');
      }
      throw new BadRequestException('Failed to add vehicle to convoy');
    }

    return { success: true };
  }

  async removeMember(orgId: string, convoyId: string, vehicleId: string): Promise<{ success: boolean }> {
    await this.findOne(orgId, convoyId);

    const { error } = await this.supabase.adminClient
      .from('convoy_members')
      .delete()
      .eq('convoy_id', convoyId)
      .eq('vehicle_id', vehicleId);

    if (error) {
      throw new BadRequestException('Failed to remove vehicle from convoy');
    }

    return { success: true };
  }

  async remove(orgId: string, id: string): Promise<{ success: boolean }> {
    await this.findOne(orgId, id);

    const { error } = await this.supabase.adminClient
      .from('convoy_groups')
      .delete()
      .eq('org_id', orgId)
      .eq('id', id);

    if (error) {
      throw new BadRequestException('Failed to delete convoy');
    }

    return { success: true };
  }
}
