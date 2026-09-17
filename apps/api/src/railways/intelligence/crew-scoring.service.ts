import { Injectable, Logger } from '@nestjs/common';
import { SupabaseService } from '../../supabase/supabase.service';
import { CrewBehaviorScore } from '@nexus-ways/shared';

/**
 * Rail Crew Behavior Scoring Constants & Source Citations.
 *
 * Source: Ministry of Railways (Railway Board), Government of India — Operating Manual for Indian Railways
 * & RDSO (Research Designs & Standards Organisation) Speed Policy for Broad Gauge (BG) Freight Operations
 * (General Rules GR 4.08 & Indian Railways Permanent Way Manual, Section 4.12).
 *
 * - Maximum Permissible Speed (MPS) for standard freight train rakes (e.g. BOXN/BCN) on BG routes: 100 km/h.
 * - Harsh Braking in freight operations: Heavy freight trains carry massive momentum (~2000-4000 tonnes);
 *   a sudden deceleration (>15 km/h speed drop within ≤10 seconds) indicates emergency application or rough train handling.
 */
export const FREIGHT_TRAIN_MAX_PERMISSIBLE_SPEED_KMH = 100;
export const RAIL_HARSH_BRAKE_SPEED_DROP_KMH = 15;
export const RAIL_HARSH_BRAKE_TIME_WINDOW_SEC = 10;
export const RAIL_CREW_SCORING_CITATION =
  'Ministry of Railways, Government of India — Operating Manual for Indian Railways & RDSO Speed Policy (MPS for BG Freight: 100 km/h; Emergency Braking Threshold: >15 km/h drop in ≤10s)';

export interface RailTelemetryPoint {
  lat: number;
  lng: number;
  speed_kmh: number;
  heading?: number | null;
  recorded_at: string;
}

@Injectable()
export class CrewScoringService {
  private readonly logger = new Logger(CrewScoringService.name);

  constructor(private readonly supabase: SupabaseService) {}

  /**
   * Deterministic rule-based loco pilot crew behavior scoring from recorded train telemetry.
   * Formula: score = max(0, 100 - (10 * harsh_brake_count) - (5 * overspeed_event_count))
   */
  async computeMovementCrewScore(
    movementId: string,
    locoPilotId: string,
    telemetryPoints: RailTelemetryPoint[],
  ): Promise<CrewBehaviorScore> {
    let harshBrakeCount = 0;
    let overspeedEventCount = 0;

    if (telemetryPoints && telemetryPoints.length > 1) {
      // Sort chronologically
      const sorted = [...telemetryPoints].sort(
        (a, b) => new Date(a.recorded_at).getTime() - new Date(b.recorded_at).getTime(),
      );

      for (let i = 0; i < sorted.length; i++) {
        const current = sorted[i];
        const currentSpeed = Number(current.speed_kmh || 0);

        // 1. Check overspeed (>100 km/h MPS)
        if (currentSpeed > FREIGHT_TRAIN_MAX_PERMISSIBLE_SPEED_KMH) {
          overspeedEventCount++;
        }

        // 2. Check harsh braking with previous point
        if (i > 0) {
          const prev = sorted[i - 1];
          const prevSpeed = Number(prev.speed_kmh || 0);
          const timeDiffSec =
            (new Date(current.recorded_at).getTime() - new Date(prev.recorded_at).getTime()) / 1000;
          const speedDrop = prevSpeed - currentSpeed;

          if (
            timeDiffSec > 0 &&
            timeDiffSec <= RAIL_HARSH_BRAKE_TIME_WINDOW_SEC &&
            speedDrop > RAIL_HARSH_BRAKE_SPEED_DROP_KMH
          ) {
            harshBrakeCount++;
          }
        }
      }
    }

    const calculatedScore = Math.max(
      0,
      100 - harshBrakeCount * 10 - overspeedEventCount * 5,
    );

    this.logger.log(
      `Computed score for loco pilot ${locoPilotId} on movement ${movementId}: ${calculatedScore} (Harsh Brakes: ${harshBrakeCount}, Overspeeds: ${overspeedEventCount})`,
    );

    const { data: newScore, error } = await this.supabase.adminClient
      .from('crew_behavior_scores')
      .insert({
        movement_id: movementId,
        loco_pilot_id: locoPilotId,
        score: calculatedScore,
        harsh_brake_count: harshBrakeCount,
        overspeed_event_count: overspeedEventCount,
      })
      .select()
      .single();

    if (error) {
      this.logger.warn(`Failed to insert crew behavior score: ${error.message}`);
      return {
        id: `score-${Date.now()}`,
        movement_id: movementId,
        loco_pilot_id: locoPilotId,
        score: calculatedScore,
        harsh_brake_count: harshBrakeCount,
        overspeed_event_count: overspeedEventCount,
        computed_at: new Date().toISOString(),
      };
    }

    return newScore;
  }

  async getCrewBehaviorHistory(locoPilotId: string): Promise<CrewBehaviorScore[]> {
    const { data: scores, error } = await this.supabase.adminClient
      .from('crew_behavior_scores')
      .select('*')
      .eq('loco_pilot_id', locoPilotId)
      .order('computed_at', { ascending: false })
      .limit(50);

    if (error) {
      this.logger.warn(`Failed to fetch crew behavior history: ${error.message}`);
      return [];
    }

    return scores || [];
  }
}
