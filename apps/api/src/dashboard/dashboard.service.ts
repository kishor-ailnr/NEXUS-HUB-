import { Injectable, Logger } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { RealtimeGateway } from '../realtime/realtime.gateway';
import { DashboardStats, SystemStatus } from '@nexus-ways/shared';

@Injectable()
export class DashboardService {
  private readonly logger = new Logger(DashboardService.name);

  constructor(
    private readonly supabase: SupabaseService,
    private readonly realtimeGateway: RealtimeGateway,
  ) {}

  async getStats(orgId: string): Promise<DashboardStats> {
    let activeAlerts = 0;
    let activeVehiclesCount = 0;
    let totalFleetCount = 0;
    let avgSpeed = 0;
    let arrivedCount = 0;
    let departedCount = 0;

    try {
      // 1. Query active alerts
      const { data: alertsData } = await this.supabase.adminClient
        .from('alerts')
        .select('acknowledged_at')
        .eq('org_id', orgId);

      if (Array.isArray(alertsData)) {
        activeAlerts = alertsData.filter((a: any) => !a.acknowledged_at).length;
      }
    } catch (e: any) {
      this.logger.warn(`Failed to fetch alerts stats: ${e.message}`);
    }

    try {
      // 2. Query vehicles count and active status
      const { data: vehicles } = await this.supabase.adminClient
        .from('vehicles')
        .select('id, status')
        .eq('org_id', orgId);

      if (Array.isArray(vehicles)) {
        totalFleetCount = vehicles.length;
        activeVehiclesCount = vehicles.filter((v: any) => v.status === 'active').length;
      }
    } catch (e: any) {
      this.logger.warn(`Failed to fetch vehicles stats: ${e.message}`);
    }

    try {
      // 3. Query trips for today
      const startOfDay = new Date();
      startOfDay.setHours(0, 0, 0, 0);

      const { data: trips } = await this.supabase.adminClient
        .from('trips')
        .select('id, status, started_at, completed_at')
        .eq('org_id', orgId)
        .gte('created_at', startOfDay.toISOString());

      if (Array.isArray(trips)) {
        arrivedCount = trips.filter((t: any) => t.status === 'completed').length;
        departedCount = trips.filter(
          (t: any) => t.status === 'in_transit' || t.status === 'completed',
        ).length;
      }
    } catch (e: any) {
      this.logger.warn(`Failed to fetch trip counts: ${e.message}`);
    }

    try {
      // 4. Query average speed across recent active GPS points
      const { data: recentGps } = await this.supabase.adminClient
        .from('gps_points')
        .select('speed_kmh')
        .order('recorded_at', { ascending: false })
        .limit(20);

      if (Array.isArray(recentGps) && recentGps.length > 0) {
        const totalSpeed = recentGps.reduce((sum, pt) => sum + Number(pt.speed_kmh || 0), 0);
        avgSpeed = Math.round(totalSpeed / recentGps.length);
      }
    } catch (e: any) {
      this.logger.warn(`Failed to fetch GPS speed stats: ${e.message}`);
    }

    return {
      activeAlerts,
      activeVehicles: {
        value: activeVehiclesCount,
        available: true,
      },
      totalFleetToday: {
        value: totalFleetCount,
        available: true,
      },
      avgSpeedKmh: {
        value: avgSpeed,
        available: totalFleetCount > 0,
        note: totalFleetCount === 0 ? 'No active vehicle telemetry' : undefined,
      },
      arrivedCount: {
        value: arrivedCount,
        available: true,
      },
      departedCount: {
        value: departedCount,
        available: true,
      },
    };
  }

  async getSystemStatus(): Promise<SystemStatus> {
    let dbHealthy = false;
    try {
      const { error } = await this.supabase.adminClient
        .from('organizations')
        .select('id')
        .limit(1);
      dbHealthy = !error;
    } catch {
      dbHealthy = false;
    }

    const wsGatewayHealthy = this.realtimeGateway.isHealthy();
    const connectionCount = this.realtimeGateway.getConnectionCount();
    const agentsHealthy = dbHealthy && wsGatewayHealthy;

    return {
      dbHealthy,
      wsGatewayHealthy,
      agentsHealthy,
      connectionCount,
    };
  }
}
