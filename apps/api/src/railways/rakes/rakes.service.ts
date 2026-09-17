import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { SupabaseService } from '../../supabase/supabase.service';
import { Rake, CreateRakeDto } from '@nexus-ways/shared';

@Injectable()
export class RakesService {
  private readonly logger = new Logger(RakesService.name);

  constructor(private readonly supabase: SupabaseService) {}

  async create(orgId: string, dto: CreateRakeDto): Promise<Rake> {
    const { data, error } = await this.supabase.adminClient
      .from('rakes')
      .insert({
        org_id: orgId,
        rake_id: dto.rake_id.trim(),
        composition: dto.composition || [],
      })
      .select()
      .single();

    if (error) {
      this.logger.error(`Failed to create rake: ${error.message}`);
      throw new BadRequestException(error.message || 'Failed to create rake');
    }

    return data;
  }

  async findAll(orgId: string): Promise<Rake[]> {
    const { data, error } = await this.supabase.adminClient
      .from('rakes')
      .select('*')
      .eq('org_id', orgId)
      .order('created_at', { ascending: false });

    if (error) {
      this.logger.error(`Failed to list rakes: ${error.message}`);
      throw new BadRequestException('Failed to list rakes');
    }

    return data || [];
  }

  async findOne(orgId: string, id: string): Promise<Rake> {
    const { data, error } = await this.supabase.adminClient
      .from('rakes')
      .select('*')
      .eq('id', id)
      .eq('org_id', orgId)
      .maybeSingle();

    if (error || !data) {
      throw new NotFoundException(`Rake ${id} not found`);
    }

    return data;
  }

  async update(orgId: string, id: string, dto: Partial<CreateRakeDto>): Promise<Rake> {
    const payload: any = {};
    if (dto.rake_id !== undefined) payload.rake_id = dto.rake_id.trim();
    if (dto.composition !== undefined) payload.composition = dto.composition;

    const { data, error } = await this.supabase.adminClient
      .from('rakes')
      .update(payload)
      .eq('id', id)
      .eq('org_id', orgId)
      .select()
      .single();

    if (error || !data) {
      this.logger.error(`Failed to update rake: ${error?.message}`);
      throw new NotFoundException(`Rake ${id} not found or update failed`);
    }

    return data;
  }

  async delete(orgId: string, id: string): Promise<{ success: boolean }> {
    const { error } = await this.supabase.adminClient
      .from('rakes')
      .delete()
      .eq('id', id)
      .eq('org_id', orgId);

    if (error) {
      this.logger.error(`Failed to delete rake: ${error.message}`);
      throw new BadRequestException('Failed to delete rake');
    }

    return { success: true };
  }
}
