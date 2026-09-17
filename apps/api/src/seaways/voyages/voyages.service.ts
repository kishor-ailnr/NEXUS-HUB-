import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { SupabaseService } from '../../supabase/supabase.service';
import { Voyage, CreateVoyageDto } from '@nexus-ways/shared';

@Injectable()
export class VoyagesService {
  private readonly logger = new Logger(VoyagesService.name);

  constructor(private readonly supabase: SupabaseService) {}

  async findAll(orgId: string): Promise<Voyage[]> {
    const { data, error } = await this.supabase.adminClient
      .from('voyages')
      .select('*, origin_port:ports!origin_port_id(*), destination_port:ports!destination_port_id(*)')
      .eq('org_id', orgId)
      .order('created_at', { ascending: false });

    if (error) {
      this.logger.error(`Failed to fetch voyages: ${error.message}`);
      throw new BadRequestException('Failed to fetch voyages');
    }

    return data || [];
  }

  async findOne(orgId: string, id: string): Promise<Voyage> {
    const { data, error } = await this.supabase.adminClient
      .from('voyages')
      .select('*, origin_port:ports!origin_port_id(*), destination_port:ports!destination_port_id(*)')
      .eq('id', id)
      .eq('org_id', orgId)
      .maybeSingle();

    if (error || !data) {
      throw new NotFoundException(`Voyage ${id} not found`);
    }

    return data;
  }

  async create(orgId: string, dto: CreateVoyageDto): Promise<Voyage> {
    const voyageNumber = dto.voyage_number?.trim();
    const originPortId = dto.origin_port_id;
    const destinationPortId = dto.destination_port_id;

    if (!voyageNumber || !originPortId || !destinationPortId) {
      throw new BadRequestException('voyage_number, origin_port_id, and destination_port_id are required');
    }

    if (originPortId === destinationPortId) {
      throw new BadRequestException('Origin and destination ports cannot be the same');
    }

    const { data, error } = await this.supabase.adminClient
      .from('voyages')
      .insert({
        org_id: orgId,
        voyage_number: voyageNumber,
        origin_port_id: originPortId,
        destination_port_id: destinationPortId,
      })
      .select('*, origin_port:ports!origin_port_id(*), destination_port:ports!destination_port_id(*)')
      .single();

    if (error) {
      this.logger.error(`Failed to create voyage: ${error.message}`);
      throw new BadRequestException(error.message || 'Failed to create voyage');
    }

    return data;
  }

  async update(orgId: string, id: string, dto: Partial<CreateVoyageDto>): Promise<Voyage> {
    const payload: any = {};
    if (dto.voyage_number !== undefined) payload.voyage_number = dto.voyage_number.trim();
    if (dto.origin_port_id !== undefined) payload.origin_port_id = dto.origin_port_id;
    if (dto.destination_port_id !== undefined) payload.destination_port_id = dto.destination_port_id;

    const { data, error } = await this.supabase.adminClient
      .from('voyages')
      .update(payload)
      .eq('id', id)
      .eq('org_id', orgId)
      .select('*, origin_port:ports!origin_port_id(*), destination_port:ports!destination_port_id(*)')
      .single();

    if (error || !data) {
      this.logger.error(`Failed to update voyage: ${error?.message}`);
      throw new NotFoundException(`Voyage ${id} not found or update failed`);
    }

    return data;
  }

  async delete(orgId: string, id: string): Promise<{ success: boolean }> {
    const { error } = await this.supabase.adminClient
      .from('voyages')
      .delete()
      .eq('id', id)
      .eq('org_id', orgId);

    if (error) {
      this.logger.error(`Failed to delete voyage: ${error.message}`);
      throw new BadRequestException('Failed to delete voyage');
    }

    return { success: true };
  }
}
