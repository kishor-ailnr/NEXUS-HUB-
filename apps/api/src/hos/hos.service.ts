import { Injectable, Logger } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { NotificationsService } from '../notifications/notifications.service';
import { HosLog } from '@nexus-ways/shared';

export const HOS_DAILY_LIMIT_MINUTES = 480; // 8 hours per Indian Motor Transport Workers Act, 1961 & CMVR

@Injectable()
export class HosService {
  private readonly logger = new Logger(HosService.name);

  constructor(
    private readonly supabase: SupabaseService,
    private readonly notificationsService: NotificationsService,
  ) {}

  async logTripDriveTime(
    driverId: string,
    tripId: string,
    driveMinutes: number,
    startedAt: Date,
    endedAt: Date,
    orgId: string,
  ): Promise<HosLog> {
    const windowStart = new Date(endedAt.getTime() - 24 * 60 * 60 * 1000);

    // 1. Insert preliminary HOS log
    const { data: newLog, error: insertError } = await this.supabase.adminClient
      .from('hos_logs')
      .insert({
        driver_id: driverId,
        trip_id: tripId,
        drive_minutes: driveMinutes,
        window_started_at: windowStart.toISOString(),
        window_ended_at: endedAt.toISOString(),
        violation: false,
      })
      .select()
      .single();

    if (insertError) {
      this.logger.error(`Failed to insert HOS log: ${insertError.message}`);
      throw new Error(`Failed to insert HOS log: ${insertError.message}`);
    }

    // 2. Compute rolling 24-hour total for this driver
    const { data: pastLogs } = await this.supabase.adminClient
      .from('hos_logs')
      .select('drive_minutes')
      .eq('driver_id', driverId)
      .gte('window_ended_at', windowStart.toISOString());

    const totalDriveMinutes = (pastLogs || []).reduce(
      (sum, l) => sum + Number(l.drive_minutes || 0),
      0,
    );

    let isViolation = false;
    if (totalDriveMinutes > HOS_DAILY_LIMIT_MINUTES) {
      isViolation = true;
      // Mark violation in hos_logs
      await this.supabase.adminClient
        .from('hos_logs')
        .update({ violation: true })
        .eq('id', newLog.id);

      // Fetch driver details
      const { data: driver } = await this.supabase.adminClient
        .from('drivers')
        .select('*, user:users(full_name, email)')
        .eq('id', driverId)
        .maybeSingle();

      const driverName = driver?.user?.full_name || driver?.license_number || driverId;
      const message = `[Simulated Alert] Driver ${driverName} exceeded Hours of Service limit: ${Math.round(totalDriveMinutes)}m driven in 24h window (limit: ${HOS_DAILY_LIMIT_MINUTES}m / 8h)`;

      this.logger.warn(`HOS Violation detected for driver ${driverId}: ${message}`);

      // Insert into alerts table
      try {
        await this.supabase.adminClient.from('alerts').insert({
          org_id: orgId,
          type: 'hos_violation',
          severity: 'high',
          message,
        });
      } catch (alertErr: any) {
        this.logger.warn(`Failed to insert HOS alert: ${alertErr.message}`);
      }

      // Push notification
      try {
        await this.notificationsService.createNotification(orgId, {
          type: 'alert',
          title: 'HOS Violation Warning',
          body: message,
          actionLabel: 'View Drivers',
          actionUrl: '/roadways/dashboard',
        });
      } catch (notifErr: any) {
        this.logger.warn(`Failed to dispatch HOS notification: ${notifErr.message}`);
      }
    }

    return {
      ...newLog,
      violation: isViolation,
    };
  }

  async getLogsForOrg(orgId: string, driverId?: string): Promise<HosLog[]> {
    const { data: drivers } = await this.supabase.adminClient
      .from('drivers')
      .select('id')
      .eq('org_id', orgId);

    if (!drivers || drivers.length === 0) {
      return [];
    }

    const driverIds = driverId ? [driverId] : drivers.map((d) => d.id);

    const { data: logs, error } = await this.supabase.adminClient
      .from('hos_logs')
      .select('*, driver:drivers(*, user:users(full_name, email))')
      .in('driver_id', driverIds)
      .order('window_ended_at', { ascending: false })
      .limit(100);

    if (error) {
      this.logger.error(`Failed to get HOS logs: ${error.message}`);
      return [];
    }

    return logs || [];
  }
}
