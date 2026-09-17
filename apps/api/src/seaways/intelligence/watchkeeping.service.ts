import { Injectable, Logger } from '@nestjs/common';
import { SupabaseService } from '../../supabase/supabase.service';
import { NotificationsService } from '../../notifications/notifications.service';
import { WatchkeepingLog } from '@nexus-ways/shared';

/**
 * International Maritime Organization (IMO) STCW Watchkeeping Hours of Rest:
 * Reference: International Convention on Standards of Training, Certification and Watchkeeping for Seafarers (STCW 1978/1995/2010 Manila Amendments),
 * Regulation VIII/1 & STCW Code Section A-VIII/1 ("Fitness for Duty") and Maritime Labour Convention (MLC 2006) Regulation 2.3 ("Hours of work and hours of rest").
 *
 * Mandatory Minimum Rest Requirements:
 * 1. Minimum 10 hours (600 minutes) of rest in any 24-hour period (equivalent to maximum 14 hours / 840 minutes duty period).
 * 2. Minimum 77 hours of rest in any 7-day period.
 * 3. Daily rest periods must not be divided into more than two periods, one of which must be at least 6 hours in length.
 *
 * Cumulative rolling 24-hour window checks flag watchkeeping violations and trigger maritime safety non-compliance alerts.
 */
export const STCW_WATCHKEEPING_CITATION =
  'STCW Convention Regulation VIII/1, Code Section A-VIII/1 & MLC 2006 Reg 2.3 (Min 10 hrs / 600 min rest, Max 14 hrs / 840 min duty in 24h)';

export const STCW_MIN_REST_MINUTES_24H = 600; // 10 hours
export const STCW_MAX_DUTY_MINUTES_24H = 840; // 14 hours (1440 - 600)

@Injectable()
export class WatchkeepingService {
  private readonly logger = new Logger(WatchkeepingService.name);

  constructor(
    private readonly supabase: SupabaseService,
    private readonly notificationsService: NotificationsService,
  ) {}

  /**
   * Records a watchkeeping duty entry upon voyage completion and evaluates rolling 24-hour STCW Section A-VIII/1 compliance.
   */
  async recordWatchkeepingDuty(
    orgId: string,
    movementId: string,
    crewId: string,
    dutyMinutes: number,
    startTime?: Date,
    endTime?: Date,
  ): Promise<{ watchkeepingLog: WatchkeepingLog; totalRollingDutyMinutes: number; violation: boolean }> {
    const now = endTime || new Date();
    const windowStart = new Date(now.getTime() - 24 * 60 * 60 * 1000); // 24-hour rolling window

    // 1. Fetch past duty logs for this master/crew member within the rolling 24-hour window
    const { data: pastLogs } = await this.supabase.adminClient
      .from('watchkeeping_logs')
      .select('duty_minutes, created_at, window_started_at')
      .eq('crew_id', crewId)
      .gte('window_started_at', windowStart.toISOString());

    const pastDutySum = (pastLogs || []).reduce(
      (acc: number, item: any) => acc + (Number(item.duty_minutes) || 0),
      0,
    );

    const totalRollingDutyMinutes = pastDutySum + dutyMinutes;
    // STCW violation if total duty in 24h exceeds 14 hours (840 minutes) or rest < 10 hours (600 minutes)
    const isViolation = totalRollingDutyMinutes > STCW_MAX_DUTY_MINUTES_24H;
    const restMinutes = Math.max(0, 1440 - totalRollingDutyMinutes);

    // 2. Insert new watchkeeping log
    const { data: logRecord, error } = await this.supabase.adminClient
      .from('watchkeeping_logs')
      .insert({
        crew_id: crewId,
        movement_id: movementId,
        duty_minutes: dutyMinutes,
        rest_minutes: Math.max(0, 1440 - dutyMinutes),
        window_started_at: windowStart.toISOString(),
        window_ended_at: now.toISOString(),
        violation: isViolation,
      })
      .select('*')
      .single();

    if (error) {
      this.logger.error(`Failed to insert watchkeeping log: ${error.message}`);
    }

    // 3. Trigger alert and notification if STCW rest-hour limit breached
    if (isViolation) {
      this.logger.warn(
        `STCW Watchkeeping Violation detected for crew/master ${crewId}: total rolling duty ${totalRollingDutyMinutes} min exceeds ${STCW_MAX_DUTY_MINUTES_24H} min limit`,
      );

      try {
        await this.supabase.adminClient.from('alerts').insert({
          org_id: orgId,
          type: 'compliance',
          severity: 'critical',
          message: `[STCW Code Section A-VIII/1 Violation] Master/Crew ${crewId} logged ${totalRollingDutyMinutes} min on-duty in 24h window (maximum allowable duty is 840 min / 14h; minimum required rest is 600 min / 10h under STCW Reg VIII/1 & MLC 2006).`,
          created_at: new Date().toISOString(),
        });
      } catch (err: any) {
        this.logger.error(`Alert creation failed: ${err.message}`);
      }

      if (this.notificationsService?.createNotification) {
        await this.notificationsService.createNotification(orgId, {
          type: 'alert',
          title: 'STCW Watchkeeping Rest-Hour Breach',
          body: `Voyage movement ${movementId} duty resulted in 24h duty time of ${totalRollingDutyMinutes} min violating STCW Section A-VIII/1 rest hours.`,
        }).catch((e) => this.logger.error(`Notification creation failed: ${e.message}`));
      }
    }

    const watchkeepingLog: WatchkeepingLog = logRecord || {
      id: `wkl-${Date.now()}`,
      crew_id: crewId,
      movement_id: movementId,
      duty_minutes: dutyMinutes,
      rest_minutes: restMinutes,
      window_started_at: windowStart.toISOString(),
      window_ended_at: now.toISOString(),
      violation: isViolation,
      created_at: now.toISOString(),
    };

    return { watchkeepingLog, totalRollingDutyMinutes, violation: isViolation };
  }

  async recordMovementDuty(
    orgId: string,
    crewId: string,
    movementId: string,
    dutyMinutes: number,
  ): Promise<WatchkeepingLog> {
    const res = await this.recordWatchkeepingDuty(orgId, movementId, crewId, dutyMinutes);
    return res.watchkeepingLog;
  }

  /**
   * Fetches watchkeeping logs for a sea crew member or master.
   */
  async getCrewWatchkeepingLogs(crewId: string): Promise<WatchkeepingLog[]> {
    const { data, error } = await this.supabase.adminClient
      .from('watchkeeping_logs')
      .select('*')
      .eq('crew_id', crewId)
      .order('created_at', { ascending: false });

    if (error) {
      this.logger.error(`Failed to fetch watchkeeping logs: ${error.message}`);
      return [];
    }

    return data || [];
  }

  async getWatchkeepingLogs(orgId: string, crewId: string): Promise<WatchkeepingLog[]> {
    return this.getCrewWatchkeepingLogs(crewId);
  }
}
