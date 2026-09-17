import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import * as crypto from 'crypto';
import { SupabaseService } from '../../supabase/supabase.service';
import { SeaCrew, CreateSeaCrewDto } from '@nexus-ways/shared';

@Injectable()
export class SeaCrewService {
  private readonly logger = new Logger(SeaCrewService.name);

  constructor(private readonly supabase: SupabaseService) {}

  async findAll(orgId: string): Promise<SeaCrew[]> {
    const { data: crewMembers, error } = await this.supabase.adminClient
      .from('sea_crew')
      .select('*, user:users(id, email, full_name)')
      .eq('org_id', orgId)
      .order('created_at', { ascending: false });

    if (error) {
      this.logger.error(`Failed to list sea crew: ${error.message}`);
      throw new BadRequestException('Failed to list sea crew');
    }

    return crewMembers || [];
  }

  async findOne(orgId: string, id: string): Promise<SeaCrew> {
    const { data: crewMember, error } = await this.supabase.adminClient
      .from('sea_crew')
      .select('*, user:users(id, email, full_name)')
      .eq('org_id', orgId)
      .eq('id', id)
      .maybeSingle();

    if (error || !crewMember) {
      throw new NotFoundException('Sea crew member not found');
    }

    return crewMember;
  }

  async create(orgId: string, dto: CreateSeaCrewDto): Promise<SeaCrew> {
    const email = dto.email?.toLowerCase().trim();
    const certificateNumber = (dto.certificateNumber || (dto as any).certificate_number)?.trim();
    const fullName = dto.fullName || (dto as any).full_name || 'Sea Crew';
    const crewRole = dto.crewRole || (dto as any).crew_role || 'officer';
    const status = dto.status || 'available';

    if (!email || !certificateNumber) {
      throw new BadRequestException('Email and certificate number are required');
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
      const defaultPassword = 'Master@Nexus123';

      try {
        const { data: authUser, error: authError } =
          await this.supabase.adminClient.auth.admin.createUser({
            email,
            password: defaultPassword,
            email_confirm: true,
            user_metadata: { full_name: fullName },
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
          full_name: fullName,
          role: 'driver', // Reuse generic operator/driver role for bridge crew view
        })
        .select()
        .single();

      if (userError) {
        this.logger.error(`Failed to create sea crew user: ${userError.message}`);
        throw new BadRequestException('Failed to create sea crew user account');
      }
    }

    // 2. Check if sea_crew record already exists for this user/org
    const { data: existingCrew } = await this.supabase.adminClient
      .from('sea_crew')
      .select('id')
      .eq('org_id', orgId)
      .eq('user_id', userId)
      .maybeSingle();

    if (existingCrew) {
      throw new ConflictException('A sea crew record already exists for this user');
    }

    // 3. Create sea crew entry
    const { data: newCrew, error: crewError } = await this.supabase.adminClient
      .from('sea_crew')
      .insert({
        org_id: orgId,
        user_id: userId,
        certificate_number: certificateNumber,
        crew_role: crewRole,
        status: status,
      })
      .select('*, user:users(id, email, full_name)')
      .single();

    if (crewError) {
      this.logger.error(`Failed to create sea crew record: ${crewError.message}`);
      throw new BadRequestException(crewError.message || 'Failed to create sea crew record');
    }

    return newCrew;
  }

  async update(
    orgId: string,
    id: string,
    dto: Partial<CreateSeaCrewDto> & { status?: any; crewRole?: any },
  ): Promise<SeaCrew> {
    const crew = await this.findOne(orgId, id);

    if (dto.fullName) {
      await this.supabase.adminClient
        .from('users')
        .update({ full_name: dto.fullName.trim() })
        .eq('id', crew.user_id);
    }

    const payload: any = {};
    if (dto.certificateNumber) payload.certificate_number = dto.certificateNumber.trim();
    if (dto.crewRole || (dto as any).crew_role) payload.crew_role = dto.crewRole || (dto as any).crew_role;
    if (dto.status) payload.status = dto.status;

    const { data: updated, error } = await this.supabase.adminClient
      .from('sea_crew')
      .update(payload)
      .eq('id', id)
      .eq('org_id', orgId)
      .select('*, user:users(id, email, full_name)')
      .single();

    if (error) {
      throw new BadRequestException('Failed to update sea crew member');
    }

    return updated;
  }

  async delete(orgId: string, id: string): Promise<{ success: boolean }> {
    const { error } = await this.supabase.adminClient
      .from('sea_crew')
      .delete()
      .eq('id', id)
      .eq('org_id', orgId);

    if (error) {
      throw new BadRequestException('Failed to delete sea crew member');
    }

    return { success: true };
  }
}
