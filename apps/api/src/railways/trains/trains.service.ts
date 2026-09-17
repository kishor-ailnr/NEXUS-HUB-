import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { SupabaseService } from '../../supabase/supabase.service';
import { Train, CreateTrainDto } from '@nexus-ways/shared';

@Injectable()
export class TrainsService {
  private readonly logger = new Logger(TrainsService.name);

  constructor(private readonly supabase: SupabaseService) {}

  async create(orgId: string, dto: CreateTrainDto): Promise<Train> {
    const { data, error } = await this.supabase.adminClient
      .from('trains')
      .insert({
        org_id: orgId,
        train_number: dto.train_number.trim(),
        train_name: dto.train_name?.trim() || null,
        locomotive_id: dto.locomotive_id || null,
        rake_id: dto.rake_id || null,
        status: dto.status || 'idle',
      })
      .select('*, locomotive:locomotives(*), rake:rakes(*)')
      .single();

    if (error) {
      this.logger.error(`Failed to create train: ${error.message}`);
      throw new BadRequestException(error.message || 'Failed to create train');
    }

    return data;
  }

  async findAll(orgId: string): Promise<Train[]> {
    const { data: trains, error } = await this.supabase.adminClient
      .from('trains')
      .select('*, locomotive:locomotives(*), rake:rakes(*)')
      .eq('org_id', orgId)
      .order('created_at', { ascending: false });

    if (error) {
      this.logger.error(`Failed to list trains: ${error.message}`);
      throw new BadRequestException('Failed to list trains');
    }

    return trains || [];
  }

  async findOne(orgId: string, id: string): Promise<Train> {
    const { data: train, error } = await this.supabase.adminClient
      .from('trains')
      .select('*, locomotive:locomotives(*), rake:rakes(*)')
      .eq('org_id', orgId)
      .eq('id', id)
      .maybeSingle();

    if (error || !train) {
      throw new NotFoundException(`Train ${id} not found`);
    }

    return train;
  }

  async update(orgId: string, id: string, dto: Partial<CreateTrainDto>): Promise<Train> {
    const payload: any = {};
    if (dto.train_number !== undefined) payload.train_number = dto.train_number.trim();
    if (dto.train_name !== undefined) payload.train_name = dto.train_name?.trim() || null;
    if (dto.locomotive_id !== undefined) payload.locomotive_id = dto.locomotive_id || null;
    if (dto.rake_id !== undefined) payload.rake_id = dto.rake_id || null;
    if (dto.status !== undefined) payload.status = dto.status;

    const { data, error } = await this.supabase.adminClient
      .from('trains')
      .update(payload)
      .eq('id', id)
      .eq('org_id', orgId)
      .select('*, locomotive:locomotives(*), rake:rakes(*)')
      .single();

    if (error || !data) {
      this.logger.error(`Failed to update train: ${error?.message}`);
      throw new NotFoundException(`Train ${id} not found or update failed`);
    }

    return data;
  }

  async delete(orgId: string, id: string): Promise<{ success: boolean }> {
    const { error } = await this.supabase.adminClient
      .from('trains')
      .delete()
      .eq('id', id)
      .eq('org_id', orgId);

    if (error) {
      this.logger.error(`Failed to delete train: ${error.message}`);
      throw new BadRequestException('Failed to delete train');
    }

    return { success: true };
  }
}
