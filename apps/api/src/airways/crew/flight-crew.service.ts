import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import * as crypto from 'crypto';
import { SupabaseService } from '../../supabase/supabase.service';
import { FlightCrew, CreateFlightCrewDto } from '@nexus-ways/shared';

@Injectable()
export class FlightCrewService {
  private readonly logger = new Logger(FlightCrewService.name);

  constructor(private readonly supabase: SupabaseService) {}

  async findAll(orgId: string): Promise<FlightCrew[]> {
    const { data: crewMembers, error } = await this.supabase.adminClient
      .from('flight_crew')
      .select('*, user:users(id, email, full_name)')
      .eq('org_id', orgId)
      .order('created_at', { ascending: false });

    if (error) {
      this.logger.error(`Failed to list flight crew: ${error.message}`);
      throw new BadRequestException('Failed to list flight crew');
    }

    return crewMembers || [];
  }

  async findOne(orgId: string, id: string): Promise<FlightCrew> {
    const { data: crewMember, error } = await this.supabase.adminClient
      .from('flight_crew')
      .select('*, user:users(id, email, full_name)')
      .eq('org_id', orgId)
      .eq('id', id)
      .maybeSingle();

    if (error || !crewMember) {
      throw new NotFoundException('Flight crew member not found');
    }

    return crewMember;
  }

  async create(orgId: string, dto: CreateFlightCrewDto): Promise<FlightCrew> {
    const email = dto.email?.toLowerCase().trim();
    const licenseNumber = (dto.licenseNumber || (dto as any).license_number)?.trim();
    const fullName = dto.fullName || (dto as any).full_name || 'Flight Crew';
    const crewRole = dto.crewRole || (dto as any).crew_role || 'pilot';
    const status = dto.status || 'available';

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
          role: 'driver', // Reuse generic operator/driver role for cockpit crew view
        })
        .select()
        .single();

      if (userError) {
        this.logger.error(`Failed to create flight crew user: ${userError.message}`);
        throw new BadRequestException('Failed to create flight crew user account');
      }
    }

    // 2. Check if flight_crew record already exists for this user/org
    const { data: existingCrew } = await this.supabase.adminClient
      .from('flight_crew')
      .select('id')
      .eq('org_id', orgId)
      .eq('user_id', userId)
      .maybeSingle();

    if (existingCrew) {
      throw new ConflictException('A flight crew record already exists for this user');
    }

    // 3. Create flight crew entry
    const { data: newCrew, error: crewError } = await this.supabase.adminClient
      .from('flight_crew')
      .insert({
        org_id: orgId,
        user_id: userId,
        license_number: licenseNumber,
        crew_role: crewRole,
        status: status,
      })
      .select('*, user:users(id, email, full_name)')
      .single();

    if (crewError) {
      this.logger.error(`Failed to create flight crew record: ${crewError.message}`);
      throw new BadRequestException(crewError.message || 'Failed to create flight crew record');
    }

    return newCrew;
  }

  async update(
    orgId: string,
    id: string,
    dto: Partial<CreateFlightCrewDto> & { status?: any; crewRole?: any },
  ): Promise<FlightCrew> {
    const crew = await this.findOne(orgId, id);

    if (dto.fullName) {
      await this.supabase.adminClient
        .from('users')
        .update({ full_name: dto.fullName.trim() })
        .eq('id', crew.user_id);
    }

    const payload: any = {};
    if (dto.licenseNumber) payload.license_number = dto.licenseNumber.trim();
    if (dto.crewRole || (dto as any).crew_role) payload.crew_role = dto.crewRole || (dto as any).crew_role;
    if (dto.status) payload.status = dto.status;

    const { data: updated, error } = await this.supabase.adminClient
      .from('flight_crew')
      .update(payload)
      .eq('id', id)
      .eq('org_id', orgId)
      .select('*, user:users(id, email, full_name)')
      .single();

    if (error) {
      throw new BadRequestException('Failed to update flight crew member');
    }

    return updated;
  }

  async delete(orgId: string, id: string): Promise<{ success: boolean }> {
    const { error } = await this.supabase.adminClient
      .from('flight_crew')
      .delete()
      .eq('id', id)
      .eq('org_id', orgId);

    if (error) {
      throw new BadRequestException('Failed to delete flight crew member');
    }

    return { success: true };
  }
}
