import { Injectable, Logger } from '@nestjs/common';
import { SupabaseService } from '../../supabase/supabase.service';
import { NotificationsService } from '../../notifications/notifications.service';
import { FlightDutyLog } from '@nexus-ways/shared';

/**
 * DGCA India Flight Duty Time Limitations (FDTL):
 * Reference: DGCA Civil Aviation Requirements (CAR) Section 7 — Flight Crew Standards,
 * Series J Part III Issue III: "Flight Duty Time and Flight Time Limitations - Two-Pilot Operations".
 *
 * Mandatory Limits for Domestic Commercial Operations:
 * 1. Maximum Flight Duty Period (FDP): 13 hours (780 minutes) per 24-hour rolling window.
 * 2. Maximum Flight Time (FT): 8 hours (480 minutes) per 24-hour rolling window.
 *
 * Cumulative rolling window checks flag violations and generate automatic safety compliance alerts.
 */
export const DGCA_FDTL_CITATION =
  'DGCA India CAR Section 7 Series J Part III Issue III (Max 13 hrs / 780 min FDP, Max 8 hrs / 480 min Flight Time per 24h)';

export const DGCA_MAX_FDP_MINUTES_24H = 780; // 13 hours
export const MAX_DAILY_DUTY_MINUTES = 780; // 13 hours
export const MAX_DAILY_FLIGHT_MINUTES = 480; // 8 hours

@Injectable()
export class FlightDutyService {
  private readonly logger = new Logger(FlightDutyService.name);

  constructor(
    private readonly supabase: SupabaseService,
    private readonly notificationsService: NotificationsService,
  ) {}

  /**
   * Records a flight duty entry upon movement completion and checks rolling 24-hour FDTL compliance.
   */
  async recordFlightDuty(
    orgId: string,
    movementId: string,
    pilotId: string,
    dutyMinutes: number,
    startTime?: Date,
    endTime?: Date,
  ): Promise<{ dutyLog: FlightDutyLog; totalRollingDutyMinutes: number; violation: boolean }> {
    const now = endTime || new Date();
    const windowStart = new Date(now.getTime() - 24 * 60 * 60 * 1000); // 24-hour rolling window

    // 1. Fetch past duty logs for this pilot within the last 24 hours
    const { data: pastLogs } = await this.supabase.adminClient
      .from('flight_duty_logs')
      .select('duty_minutes, created_at, window_started_at')
      .eq('pilot_id', pilotId)
      .gte('window_started_at', windowStart.toISOString());

    const pastDutySum = (pastLogs || []).reduce(
      (acc: number, item: any) => acc + (Number(item.duty_minutes) || 0),
      0,
    );

    const totalRollingDutyMinutes = pastDutySum + dutyMinutes;
    const isViolation = totalRollingDutyMinutes > DGCA_MAX_FDP_MINUTES_24H;

    // 2. Insert new flight duty log
    const { data: logRecord, error } = await this.supabase.adminClient
      .from('flight_duty_logs')
      .insert({
        pilot_id: pilotId,
        movement_id: movementId,
        duty_minutes: dutyMinutes,
        window_started_at: windowStart.toISOString(),
        window_ended_at: now.toISOString(),
        violation: isViolation,
      })
      .select('*')
      .single();

    if (error) {
      this.logger.error(`Failed to insert flight duty log: ${error.message}`);
    }

    // 3. Trigger alert and notification if violation occurs
    if (isViolation) {
      this.logger.warn(
        `FDTL Violation detected for pilot ${pilotId}: total rolling duty ${totalRollingDutyMinutes} min exceeds ${DGCA_MAX_FDP_MINUTES_24H} min limit`,
      );

      try {
        await this.supabase.adminClient.from('alerts').insert({
          org_id: orgId,
          type: 'compliance',
          severity: 'critical',
          message: `[DGCA FDTL Violation] Pilot ${pilotId} logged ${totalRollingDutyMinutes} min in 24h window (maximum allowable FDP is 780 min / 13h under CAR Section 7 Series J).`,
          created_at: new Date().toISOString(),
        });
      } catch (err: any) {
        this.logger.error(`Alert creation failed: ${err.message}`);
      }

      if (this.notificationsService?.createNotification) {
        await this.notificationsService.createNotification(orgId, {
          type: 'alert',
          title: 'FDTL Pilot Duty Overrun Alert',
          body: `Flight movement ${movementId} duty resulted in 24h duty time of ${totalRollingDutyMinutes} min exceeding DGCA FDTL threshold.`,
        }).catch((e) => this.logger.error(`Notification creation failed: ${e.message}`));
      }
    }

    const dutyLog: FlightDutyLog = logRecord || {
      id: `fdl-${Date.now()}`,
      pilot_id: pilotId,
      movement_id: movementId,
      duty_minutes: dutyMinutes,
      window_started_at: windowStart.toISOString(),
      window_ended_at: now.toISOString(),
      violation: isViolation,
      created_at: now.toISOString(),
    };

    return { dutyLog, totalRollingDutyMinutes, violation: isViolation };
  }

  async recordMovementDuty(
    orgId: string,
    pilotId: string,
    movementId: string,
    dutyMinutes: number,
  ): Promise<FlightDutyLog> {
    const res = await this.recordFlightDuty(orgId, movementId, pilotId, dutyMinutes);
    return res.dutyLog;
  }

  /**
   * Fetches duty logs for a flight crew pilot.
   */
  async getPilotDutyLogs(pilotId: string): Promise<FlightDutyLog[]> {
    const { data, error } = await this.supabase.adminClient
      .from('flight_duty_logs')
      .select('*')
      .eq('pilot_id', pilotId)
      .order('created_at', { ascending: false });

    if (error) {
      this.logger.error(`Failed to fetch flight duty logs: ${error.message}`);
      return [];
    }

    return data || [];
  }

  async getDutyLogs(orgId: string, pilotId: string): Promise<FlightDutyLog[]> {
    return this.getPilotDutyLogs(pilotId);
  }
}
