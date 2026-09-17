import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { CreateGeofenceDto, Geofence, GeofenceEvent } from '@nexus-ways/shared';

@Injectable()
export class GeofencesService {
  private readonly logger = new Logger(GeofencesService.name);

  constructor(private readonly supabase: SupabaseService) {}

  async findAll(orgId: string): Promise<Geofence[]> {
    const { data, error } = await this.supabase.adminClient
      .from('geofences')
      .select('*')
      .eq('org_id', orgId)
      .order('created_at', { ascending: false });

    if (error) {
      this.logger.error(`Failed to list geofences: ${error.message}`);
      throw new BadRequestException('Failed to list geofences');
    }

    return data || [];
  }

  async findOne(orgId: string, id: string): Promise<Geofence & { events?: GeofenceEvent[] }> {
    const { data: geofence, error } = await this.supabase.adminClient
      .from('geofences')
      .select('*')
      .eq('org_id', orgId)
      .eq('id', id)
      .maybeSingle();

    if (error || !geofence) {
      throw new NotFoundException('Geofence not found');
    }

    const { data: events } = await this.supabase.adminClient
      .from('geofence_events')
      .select('*, vehicle:vehicles(id, registration_number)')
      .eq('geofence_id', id)
      .order('occurred_at', { ascending: false })
      .limit(50);

    return {
      ...geofence,
      events: events || [],
    };
  }

  async create(orgId: string, dto: CreateGeofenceDto): Promise<Geofence> {
    if (!dto.name || dto.centerLat === undefined || dto.centerLng === undefined || !dto.radiusM) {
      throw new BadRequestException('Name, center coordinates, and radius are required');
    }

    const { data, error } = await this.supabase.adminClient
      .from('geofences')
      .insert({
        org_id: orgId,
        name: dto.name,
        type: dto.type || 'hub',
        center_lat: dto.centerLat,
        center_lng: dto.centerLng,
        radius_m: dto.radiusM,
      })
      .select()
      .single();

    if (error) {
      this.logger.error(`Failed to create geofence: ${error.message}`);
      throw new BadRequestException('Failed to create geofence');
    }

    return data;
  }

  async remove(orgId: string, id: string): Promise<{ success: boolean }> {
    await this.findOne(orgId, id);

    const { error } = await this.supabase.adminClient
      .from('geofences')
      .delete()
      .eq('org_id', orgId)
      .eq('id', id);

    if (error) {
      throw new BadRequestException('Failed to delete geofence');
    }

    return { success: true };
  }

  async findRecentEvents(orgId: string): Promise<GeofenceEvent[]> {
    const { data: orgGeofences } = await this.supabase.adminClient
      .from('geofences')
      .select('id')
      .eq('org_id', orgId);

    if (!orgGeofences || orgGeofences.length === 0) {
      return [];
    }

    const geofenceIds = orgGeofences.map((g) => g.id);

    const { data: events, error } = await this.supabase.adminClient
      .from('geofence_events')
      .select('*, geofence:geofences(id, name, type), vehicle:vehicles(id, registration_number)')
      .in('geofence_id', geofenceIds)
      .order('occurred_at', { ascending: false })
      .limit(50);

    if (error) {
      this.logger.error(`Failed to list geofence events: ${error.message}`);
      return [];
    }

    return events || [];
  }
}
