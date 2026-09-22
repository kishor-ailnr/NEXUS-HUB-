import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import * as crypto from 'crypto';
import { SupabaseService } from '../../supabase/supabase.service';
import { LocoPilot, CreateLocoPilotDto } from '@nexus-ways/shared';

@Injectable()
export class LocoPilotsService {
  private readonly logger = new Logger(LocoPilotsService.name);

  constructor(private readonly supabase: SupabaseService) {}

  async findAll(orgId: string): Promise<LocoPilot[]> {
    const { data: locoPilots, error } = await this.supabase.adminClient
      .from('loco_pilots')
      .select('*, user:users(id, email, full_name)')
      .eq('org_id', orgId)
      .order('created_at', { ascending: false });

    if (error) {
      this.logger.error(`Failed to list loco pilots: ${error.message}`);
      throw new BadRequestException('Failed to list loco pilots');
    }

    return locoPilots || [];
  }

  async findOne(orgId: string, id: string): Promise<LocoPilot> {
    const { data: locoPilot, error } = await this.supabase.adminClient
      .from('loco_pilots')
      .select('*, user:users(id, email, full_name)')
      .eq('org_id', orgId)
      .eq('id', id)
      .maybeSingle();

    if (error || !locoPilot) {
      throw new NotFoundException('Loco pilot not found');
    }

    return locoPilot;
  }

  async create(orgId: string, dto: CreateLocoPilotDto): Promise<LocoPilot> {
    const email = dto.email?.toLowerCase().trim();
    const licenseNumber = (dto.licenseNumber || (dto as any).license_number)?.trim();
    const fullName = dto.fullName || (dto as any).full_name || 'Loco Pilot';
    const phone = dto.phone || (dto as any).phone || null;

    if (!email || !licenseNumber) {
      throw new BadRequestException('Email and license number are required');
    }

    // 1. Check if user already exists
    let userId: string;
    const { data: existingUser } = await this.supabase.adminClient
      .from('users')
      .select('id, org_id, role')
      .eq('email', email)
      .maybeSingle();

    if (existingUser) {
      if (existingUser.org_id !== orgId) {
        throw new ConflictException('User with this email belongs to a different organization');
      }
      userId = existingUser.id;
    } else {
      const defaultPassword = dto.password || 'Pilot@Nexus123';

      try {
        const { data: authUser, error: authError } =
          await this.supabase.adminClient.auth.admin.createUser({
            email,
            password: defaultPassword,
            email_confirm: true,
            user_metadata: { full_name: dto.fullName || 'Loco Pilot' },
          });

        if (!authError && authUser?.user?.id) {
          userId = authUser.user.id;
        } else {
          userId = crypto.randomUUID();
        }
      } catch {
        userId = crypto.randomUUID();
      }

      const { data: newUser, error: userError } = await this.supabase.adminClient
        .from('users')
        .insert({
          id: userId,
          org_id: orgId,
          email,
          full_name: dto.fullName || 'Loco Pilot',
          role: 'driver',
        })
        .select()
        .single();

      if (userError) {
        this.logger.error(`Failed to create loco pilot user: ${userError.message}`);
        throw new BadRequestException('Failed to create loco pilot user account');
      }
    }

    // 2. Check if loco_pilot record already exists for this user/org
    const { data: existingPilot } = await this.supabase.adminClient
      .from('loco_pilots')
      .select('id')
      .eq('org_id', orgId)
      .eq('user_id', userId)
      .maybeSingle();

    if (existingPilot) {
      throw new ConflictException('A loco pilot record already exists for this user');
    }

    // 3. Create loco pilot entry
    const { data: newPilot, error: pilotError } = await this.supabase.adminClient
      .from('loco_pilots')
      .insert({
        org_id: orgId,
        user_id: userId,
        license_number: licenseNumber,
        phone: phone,
        status: 'available',
      })
      .select('*, user:users(id, email, full_name)')
      .single();

    if (pilotError) {
      this.logger.error(`Failed to create loco pilot record: ${pilotError.message}`);
      throw new BadRequestException(pilotError.message || 'Failed to create loco pilot record');
    }

    return newPilot;
  }

  async update(orgId: string, id: string, dto: Partial<CreateLocoPilotDto> & { status?: any }): Promise<LocoPilot> {
    const pilot = await this.findOne(orgId, id);

    if (dto.fullName) {
      await this.supabase.adminClient
        .from('users')
        .update({ full_name: dto.fullName.trim() })
        .eq('id', pilot.user_id);
    }

    const payload: any = {};
    if (dto.licenseNumber) payload.license_number = dto.licenseNumber.trim();
    if (dto.phone !== undefined) payload.phone = dto.phone?.trim() || null;
    if (dto.status) payload.status = dto.status;

    const { data: updated, error } = await this.supabase.adminClient
      .from('loco_pilots')
      .update(payload)
      .eq('id', id)
      .eq('org_id', orgId)
      .select('*, user:users(id, email, full_name)')
      .single();

    if (error) {
      throw new BadRequestException('Failed to update loco pilot');
    }

    return updated;
  }

  async delete(orgId: string, id: string): Promise<{ success: boolean }> {
    const { error } = await this.supabase.adminClient
      .from('loco_pilots')
      .delete()
      .eq('id', id)
      .eq('org_id', orgId);

    if (error) {
      throw new BadRequestException('Failed to delete loco pilot');
    }

    return { success: true };
  }
}
