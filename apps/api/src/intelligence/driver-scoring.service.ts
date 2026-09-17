import { Injectable, Logger } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { DriverBehaviorScore, GPSPoint } from '@nexus-ways/shared';

export const HARSH_BRAKE_SPEED_DROP_KMH = 20; // km/h drop threshold
export const HARSH_BRAKE_TIME_WINDOW_SEC = 10; // seconds threshold
export const HIGHWAY_SPEED_LIMIT_KMH = 80; // flat highway speed limit in km/h

@Injectable()
export class DriverScoringService {
  private readonly logger = new Logger(DriverScoringService.name);

  constructor(private readonly supabase: SupabaseService) {}

  /**
   * Deterministic rule-based driver behavior scoring from recorded trip telemetry.
   * Formula: score = max(0, 100 - (10 * harsh_brake_count) - (5 * speeding_event_count))
   */
  async computeTripDriverScore(
    tripId: string,
    driverId: string,
    gpsPoints: GPSPoint[],
  ): Promise<DriverBehaviorScore> {
    let harshBrakeCount = 0;
    let speedingEventCount = 0;

    if (gpsPoints && gpsPoints.length > 1) {
      // Sort chronologically by recorded_at
      const sorted = [...gpsPoints].sort(
        (a, b) => new Date(a.recorded_at).getTime() - new Date(b.recorded_at).getTime(),
      );

      for (let i = 0; i < sorted.length; i++) {
        const current = sorted[i];

        // 1. Check speeding
        if (current.speed_kmh > HIGHWAY_SPEED_LIMIT_KMH) {
          speedingEventCount++;
        }

        // 2. Check harsh braking with previous point
        if (i > 0) {
          const prev = sorted[i - 1];
          const timeDiffSec =
            (new Date(current.recorded_at).getTime() - new Date(prev.recorded_at).getTime()) / 1000;
          const speedDrop = Number(prev.speed_kmh) - Number(current.speed_kmh);

          if (
            timeDiffSec > 0 &&
            timeDiffSec <= HARSH_BRAKE_TIME_WINDOW_SEC &&
            speedDrop > HARSH_BRAKE_SPEED_DROP_KMH
          ) {
            harshBrakeCount++;
          }
        }
      }
    }

    const calculatedScore = Math.max(
      0,
      100 - harshBrakeCount * 10 - speedingEventCount * 5,
    );

    this.logger.log(
      `Computed score for driver ${driverId} on trip ${tripId}: ${calculatedScore} (Harsh Brakes: ${harshBrakeCount}, Speeding: ${speedingEventCount})`,
    );

    const { data: newScore, error } = await this.supabase.adminClient
      .from('driver_behavior_scores')
      .insert({
        trip_id: tripId,
        driver_id: driverId,
        score: calculatedScore,
        harsh_brake_count: harshBrakeCount,
        speeding_event_count: speedingEventCount,
      })
      .select()
      .single();

    if (error) {
      this.logger.warn(`Failed to insert driver behavior score: ${error.message}`);
      return {
        id: `score-${Date.now()}`,
        trip_id: tripId,
        driver_id: driverId,
        score: calculatedScore,
        harsh_brake_count: harshBrakeCount,
        speeding_event_count: speedingEventCount,
        computed_at: new Date().toISOString(),
      };
    }

    return newScore;
  }

  async getDriverBehaviorHistory(driverId: string): Promise<DriverBehaviorScore[]> {
    const { data: scores, error } = await this.supabase.adminClient
      .from('driver_behavior_scores')
      .select('*')
      .eq('driver_id', driverId)
      .order('computed_at', { ascending: false })
      .limit(50);

    if (error) {
      this.logger.warn(`Failed to fetch driver behavior history: ${error.message}`);
      return [];
    }

    return scores || [];
  }
}
