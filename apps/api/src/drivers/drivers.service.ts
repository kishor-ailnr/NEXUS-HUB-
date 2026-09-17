import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { DriverScoringService } from '../intelligence/driver-scoring.service';
import { CreateDriverDto, UpdateDriverDto, Driver, DriverBehaviorScore } from '@nexus-ways/shared';

@Injectable()
export class DriversService {
  private readonly logger = new Logger(DriversService.name);

  constructor(
    private readonly supabase: SupabaseService,
    private readonly driverScoringService: DriverScoringService,
  ) {}

  async findAll(orgId: string): Promise<Driver[]> {
    const { data: drivers, error } = await this.supabase.adminClient
      .from('drivers')
      .select('*, user:users(id, email, full_name)')
      .eq('org_id', orgId)
      .order('created_at', { ascending: false });

    if (error) {
      this.logger.error(`Failed to list drivers: ${error.message}`);
      throw new BadRequestException('Failed to list drivers');
    }

    if (!drivers || drivers.length === 0) {
      return [];
    }

    const driverIds = drivers.map((d) => d.id);
    const { data: scores } = await this.supabase.adminClient
      .from('driver_behavior_scores')
      .select('*')
      .in('driver_id', driverIds)
      .order('computed_at', { ascending: false });

    const latestScoreByDriver = new Map<string, any>();
    (scores || []).forEach((sc) => {
      if (!latestScoreByDriver.has(sc.driver_id)) {
        latestScoreByDriver.set(sc.driver_id, sc);
      }
    });

    return drivers.map((d) => ({
      ...d,
      latest_score: latestScoreByDriver.get(d.id) || null,
    }));
  }

  async findOne(orgId: string, id: string): Promise<Driver> {
    const { data: driver, error } = await this.supabase.adminClient
      .from('drivers')
      .select('*, user:users(id, email, full_name)')
      .eq('org_id', orgId)
      .eq('id', id)
      .maybeSingle();

    if (error || !driver) {
      throw new NotFoundException('Driver not found');
    }

    const { data: score } = await this.supabase.adminClient
      .from('driver_behavior_scores')
      .select('*')
      .eq('driver_id', id)
      .order('computed_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    return {
      ...driver,
      latest_score: score || null,
    };
  }

  async getBehaviorHistory(orgId: string, driverId: string): Promise<DriverBehaviorScore[]> {
    await this.findOne(orgId, driverId);
    return this.driverScoringService.getDriverBehaviorHistory(driverId);
  }

  async create(orgId: string, dto: CreateDriverDto): Promise<Driver> {
    if (!dto.email || !dto.licenseNumber) {
      throw new BadRequestException('Email and license number are required');
    }

    const email = dto.email.toLowerCase().trim();

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
      const defaultPassword = dto.password || 'Driver@Nexus123';

      try {
        const { data: authUser, error: authError } =
          await this.supabase.adminClient.auth.admin.createUser({
            email,
            password: defaultPassword,
            email_confirm: true,
            user_metadata: { full_name: dto.fullName || 'Driver' },
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
          full_name: dto.fullName || 'Driver',
          role: 'driver',
        })
        .select()
        .single();

      if (userError) {
        this.logger.error(`Failed to create driver user: ${userError.message}`);
        throw new BadRequestException('Failed to create driver account');
      }
    }

    // 2. Check if driver record already exists for this user/org
    const { data: existingDriver } = await this.supabase.adminClient
      .from('drivers')
      .select('id')
      .eq('org_id', orgId)
      .eq('user_id', userId)
      .maybeSingle();

    if (existingDriver) {
      throw new ConflictException('A driver record already exists for this user');
    }

    // 3. Create driver record
    const { data: newDriver, error: driverError } = await this.supabase.adminClient
      .from('drivers')
      .insert({
        org_id: orgId,
        user_id: userId,
        license_number: dto.licenseNumber.trim().toUpperCase(),
        phone: dto.phone || null,
        status: 'available',
      })
      .select('*, user:users(id, email, full_name)')
      .single();

    if (driverError) {
      this.logger.error(`Failed to create driver record: ${driverError.message}`);
      throw new BadRequestException('Failed to create driver record');
    }

    return newDriver;
  }

  async update(orgId: string, id: string, dto: UpdateDriverDto): Promise<Driver> {
    await this.findOne(orgId, id);

    const updateData: any = {};
    if (dto.licenseNumber !== undefined) updateData.license_number = dto.licenseNumber.trim().toUpperCase();
    if (dto.phone !== undefined) updateData.phone = dto.phone;
    if (dto.status !== undefined) updateData.status = dto.status;

    const { data: updated, error } = await this.supabase.adminClient
      .from('drivers')
      .update(updateData)
      .eq('org_id', orgId)
      .eq('id', id)
      .select('*, user:users(id, email, full_name)')
      .single();

    if (error) {
      throw new BadRequestException('Failed to update driver');
    }

    return updated;
  }

  async remove(orgId: string, id: string): Promise<{ success: boolean }> {
    await this.findOne(orgId, id);

    const { error } = await this.supabase.adminClient
      .from('drivers')
      .delete()
      .eq('org_id', orgId)
      .eq('id', id);

    if (error) {
      throw new BadRequestException('Failed to delete driver');
    }

    return { success: true };
  }
}
