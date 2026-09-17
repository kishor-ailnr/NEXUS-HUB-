import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { CreateVehicleDto, UpdateVehicleDto, Vehicle } from '@nexus-ways/shared';

@Injectable()
export class VehiclesService {
  private readonly logger = new Logger(VehiclesService.name);

  constructor(private readonly supabase: SupabaseService) {}

  async findAll(orgId: string, search?: string): Promise<Vehicle[]> {
    let query = this.supabase.adminClient
      .from('vehicles')
      .select(`
        *,
        driver:drivers(*, user:users(id, email, full_name))
      `)
      .eq('org_id', orgId);

    if (search && search.trim()) {
      query = query.ilike('registration_number', `%${search.trim()}%`);
    }

    const { data: vehicles, error } = await query.order('created_at', { ascending: false });

    if (error) {
      this.logger.error(`Failed to list vehicles: ${error.message}`);
      throw new BadRequestException('Failed to list vehicles');
    }

    if (!vehicles || vehicles.length === 0) {
      return [];
    }

    const vehicleIds = vehicles.map((v) => v.id);

    // Fetch latest GPS points for each vehicle
    const { data: gpsPoints } = await this.supabase.adminClient
      .from('gps_points')
      .select('*')
      .in('vehicle_id', vehicleIds)
      .order('recorded_at', { ascending: false });

    // Fetch active trips (in_transit or planned)
    const { data: activeTrips } = await this.supabase.adminClient
      .from('trips')
      .select('*')
      .eq('org_id', orgId)
      .in('vehicle_id', vehicleIds)
      .in('status', ['in_transit', 'planned'])
      .order('created_at', { ascending: false });

    // Fetch convoy memberships
    const { data: convoyMembers } = await this.supabase.adminClient
      .from('convoy_members')
      .select('vehicle_id, convoy:convoy_groups(id, name)')
      .in('vehicle_id', vehicleIds);

    const latestGpsByVehicle = new Map<string, any>();
    if (gpsPoints) {
      for (const pt of gpsPoints) {
        if (!latestGpsByVehicle.has(pt.vehicle_id)) {
          latestGpsByVehicle.set(pt.vehicle_id, pt);
        }
      }
    }

    const activeTripByVehicle = new Map<string, any>();
    if (activeTrips) {
      for (const tr of activeTrips) {
        if (!activeTripByVehicle.has(tr.vehicle_id)) {
          activeTripByVehicle.set(tr.vehicle_id, tr);
        }
      }
    }

    const convoyByVehicle = new Map<string, any>();
    if (convoyMembers) {
      for (const cm of convoyMembers) {
        if (cm.convoy) {
          convoyByVehicle.set(cm.vehicle_id, cm.convoy);
        }
      }
    }

    return vehicles.map((v) => {
      const convoy = convoyByVehicle.get(v.id);
      return {
        ...v,
        latest_gps: latestGpsByVehicle.get(v.id) || null,
        active_trip: activeTripByVehicle.get(v.id) || null,
        convoy_id: convoy?.id || null,
        convoy_name: convoy?.name || null,
      };
    });
  }

  async findOne(orgId: string, id: string): Promise<Vehicle> {
    const { data: vehicle, error } = await this.supabase.adminClient
      .from('vehicles')
      .select(`
        *,
        driver:drivers(*, user:users(id, email, full_name))
      `)
      .eq('org_id', orgId)
      .eq('id', id)
      .maybeSingle();

    if (error || !vehicle) {
      throw new NotFoundException('Vehicle not found');
    }

    // Latest GPS
    const { data: latestGps } = await this.supabase.adminClient
      .from('gps_points')
      .select('*')
      .eq('vehicle_id', id)
      .order('recorded_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    // Active trip
    const { data: activeTrip } = await this.supabase.adminClient
      .from('trips')
      .select('*')
      .eq('vehicle_id', id)
      .in('status', ['in_transit', 'planned'])
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    // Convoy
    const { data: convoyMember } = await this.supabase.adminClient
      .from('convoy_members')
      .select('convoy:convoy_groups(id, name)')
      .eq('vehicle_id', id)
      .maybeSingle();

    return {
      ...vehicle,
      latest_gps: latestGps || null,
      active_trip: activeTrip || null,
      convoy_id: (convoyMember as any)?.convoy?.id || null,
      convoy_name: (convoyMember as any)?.convoy?.name || null,
    };
  }

  async create(orgId: string, dto: CreateVehicleDto): Promise<Vehicle> {
    if (!dto.registrationNumber || !dto.vehicleType) {
      throw new BadRequestException('Registration number and vehicle type are required');
    }

    const regNumber = dto.registrationNumber.trim().toUpperCase();

    // Check if registration number already exists in this org
    const { data: existing } = await this.supabase.adminClient
      .from('vehicles')
      .select('id')
      .eq('org_id', orgId)
      .eq('registration_number', regNumber)
      .maybeSingle();

    if (existing) {
      throw new ConflictException(`Vehicle with registration "${regNumber}" already exists in this organization`);
    }

    const { data: newVehicle, error } = await this.supabase.adminClient
      .from('vehicles')
      .insert({
        org_id: orgId,
        registration_number: regNumber,
        vehicle_type: dto.vehicleType,
        capacity_kg: dto.capacityKg || null,
        assigned_driver_id: dto.assignedDriverId || null,
        status: 'idle',
      })
      .select(`
        *,
        driver:drivers(*, user:users(id, email, full_name))
      `)
      .single();

    if (error) {
      this.logger.error(`Failed to create vehicle: ${error.message}`);
      throw new BadRequestException('Failed to create vehicle');
    }

    return newVehicle;
  }

  async update(orgId: string, id: string, dto: UpdateVehicleDto): Promise<Vehicle> {
    await this.findOne(orgId, id);

    const updateData: any = {};
    if (dto.registrationNumber !== undefined) {
      updateData.registration_number = dto.registrationNumber.trim().toUpperCase();
    }
    if (dto.vehicleType !== undefined) updateData.vehicle_type = dto.vehicleType;
    if (dto.capacityKg !== undefined) updateData.capacity_kg = dto.capacityKg;
    if (dto.status !== undefined) updateData.status = dto.status;
    if (dto.assignedDriverId !== undefined) updateData.assigned_driver_id = dto.assignedDriverId;

    const { data: updated, error } = await this.supabase.adminClient
      .from('vehicles')
      .update(updateData)
      .eq('org_id', orgId)
      .eq('id', id)
      .select(`
        *,
        driver:drivers(*, user:users(id, email, full_name))
      `)
      .single();

    if (error) {
      throw new BadRequestException('Failed to update vehicle');
    }

    return updated;
  }

  async remove(orgId: string, id: string): Promise<{ success: boolean }> {
    await this.findOne(orgId, id);

    // Check if on an active trip
    const { data: activeTrips } = await this.supabase.adminClient
      .from('trips')
      .select('id, status')
      .eq('vehicle_id', id)
      .eq('status', 'in_transit');

    if (activeTrips && activeTrips.length > 0) {
      throw new BadRequestException('Cannot delete a vehicle that is currently on an active trip (in_transit)');
    }

    const { error } = await this.supabase.adminClient
      .from('vehicles')
      .delete()
      .eq('org_id', orgId)
      .eq('id', id);

    if (error) {
      throw new BadRequestException('Failed to delete vehicle');
    }

    return { success: true };
  }
}
