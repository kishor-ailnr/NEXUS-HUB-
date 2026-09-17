import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { SupabaseService } from '../../supabase/supabase.service';
import { Aircraft, CreateAircraftDto } from '@nexus-ways/shared';

@Injectable()
export class AircraftService {
  private readonly logger = new Logger(AircraftService.name);

  constructor(private readonly supabase: SupabaseService) {}

  async create(orgId: string, dto: CreateAircraftDto): Promise<Aircraft> {
    const tailNumber = dto.tail_number?.toUpperCase().trim();
    if (!tailNumber || !dto.aircraft_type) {
      throw new BadRequestException('tail_number and aircraft_type are required');
    }

    // Check if tail number already exists for this org
    const { data: existing } = await this.supabase.adminClient
      .from('aircraft')
      .select('id')
      .eq('org_id', orgId)
      .eq('tail_number', tailNumber)
      .maybeSingle();

    if (existing) {
      throw new ConflictException(`Aircraft with tail number ${tailNumber} already exists in this organization`);
    }

    const { data, error } = await this.supabase.adminClient
      .from('aircraft')
      .insert({
        org_id: orgId,
        tail_number: tailNumber,
        aircraft_type: dto.aircraft_type.trim(),
        cargo_capacity_kg: dto.cargo_capacity_kg ?? null,
        status: dto.status || 'idle',
      })
      .select()
      .single();

    if (error) {
      this.logger.error(`Failed to create aircraft: ${error.message}`);
      throw new BadRequestException(error.message || 'Failed to create aircraft');
    }

    return data;
  }

  async findAll(orgId: string): Promise<Aircraft[]> {
    const { data, error } = await this.supabase.adminClient
      .from('aircraft')
      .select('*')
      .eq('org_id', orgId)
      .order('tail_number', { ascending: true });

    if (error) {
      this.logger.error(`Failed to fetch aircraft: ${error.message}`);
      throw new BadRequestException('Failed to fetch aircraft');
    }

    return data || [];
  }

  async findOne(orgId: string, id: string): Promise<Aircraft> {
    const { data, error } = await this.supabase.adminClient
      .from('aircraft')
      .select('*')
      .eq('id', id)
      .eq('org_id', orgId)
      .maybeSingle();

    if (error || !data) {
      throw new NotFoundException(`Aircraft ${id} not found`);
    }

    return data;
  }

  async update(orgId: string, id: string, dto: Partial<CreateAircraftDto>): Promise<Aircraft> {
    const payload: any = {};
    if (dto.tail_number !== undefined) payload.tail_number = dto.tail_number.toUpperCase().trim();
    if (dto.aircraft_type !== undefined) payload.aircraft_type = dto.aircraft_type.trim();
    if (dto.cargo_capacity_kg !== undefined) payload.cargo_capacity_kg = dto.cargo_capacity_kg;
    if (dto.status !== undefined) payload.status = dto.status;

    const { data, error } = await this.supabase.adminClient
      .from('aircraft')
      .update(payload)
      .eq('id', id)
      .eq('org_id', orgId)
      .select()
      .single();

    if (error || !data) {
      this.logger.error(`Failed to update aircraft: ${error?.message}`);
      throw new NotFoundException(`Aircraft ${id} not found or update failed`);
    }

    return data;
  }

  async delete(orgId: string, id: string): Promise<{ success: boolean }> {
    const { error } = await this.supabase.adminClient
      .from('aircraft')
      .delete()
      .eq('id', id)
      .eq('org_id', orgId);

    if (error) {
      this.logger.error(`Failed to delete aircraft: ${error.message}`);
      throw new BadRequestException('Failed to delete aircraft');
    }

    return { success: true };
  }
}
