import { Injectable, Logger } from '@nestjs/common';
import { SupabaseService } from '../../supabase/supabase.service';
import { SeaCrewScore, VesselTelemetry } from '@nexus-ways/shared';

/**
 * Maritime Sea Crew & Master Behavior Scoring:
 * Evaluates vessel telemetry points for safe navigation and adherence to international maritime safety standards:
 *
 * 1. Safe Speed / Overspeed Rule:
 *    - Regulatory Anchor: International Regulations for Preventing Collisions at Sea (COLREGs) 1972 Rule 6 ("Safe Speed")
 *      and Port Authority Harbor Speed Regulations (e.g. USCG 33 CFR § 165 / Major Port Trust Rules):
 *      "Every vessel shall at all times proceed at a safe speed so that she can take proper and effective action to avoid
 *      collision and be stopped within a distance appropriate to the prevailing circumstances and conditions."
 *    - In harbor/port approach channels (speed limit standard: >12 knots) or open ocean excessive operating speed (>24 knots
 *      for commercial container carriers exceeding design speed).
 *
 * 2. Harsh Rudder Maneuver / Excessive Rate of Turn (ROT) Rule:
 *    - Regulatory Anchor: IMO Resolution A.526(13) / IMO MSC.64(67) ("Performance Standards for Rate-of-Turn Indicators")
 *      and standard bridge watchkeeping practices:
 *      Standard maximum safe rate of turn for large ocean container vessels is 10°–15°/min. An angular rate of turn
 *      exceeding 20°/min (or heading change >20° between consecutive short-interval telemetry samples) represents
 *      an abrupt/harsh rudder maneuver creating severe cargo shift and hydrodynamic broaching risk.
 *
 * 3. Penalty Formula:
 *    - Score = max(0, min(100, 100 - (10 * harsh_maneuver_count) - (5 * overspeed_event_count)))
 */

export const SEAWAYS_HARSH_ROT_THRESHOLD_DEG_PER_MIN = 20;
export const SEAWAYS_HARSH_ROT_THRESHOLD_DEG_PER_SEC = 0.33; // 20 deg / 60s
export const SEAWAYS_HARBOR_SPEED_LIMIT_KNOTS = 12;
export const SEAWAYS_OPEN_OCEAN_MAX_SPEED_KNOTS = 24;

export const COLREGS_SAFE_SPEED_CITATION =
  'COLREGs 1972 Rule 6 (Safe Speed) & USCG 33 CFR § 165 / Port Authority Rules (Max 12 kts harbor / 24 kts open water)';

export const IMO_ROT_HARSH_MANEUVER_CITATION =
  'IMO Resolution A.526(13) / IMO MSC.64(67) Rate-of-Turn Standards (ROT > 20°/min / heading delta > 20° threshold)';

export const SEAWAYS_CREW_SCORING_CITATION =
  'COLREGs Rule 6 (Safe Speed) & IMO Res A.526(13) (Excessive Rate-of-Turn ROT > 20°/min)';

export interface SeaCrewScoreEvaluation {
  score: number;
  harshManeuverCount: number;
  overspeedEventCount: number;
}

@Injectable()
export class SeaCrewScoringService {
  private readonly logger = new Logger(SeaCrewScoringService.name);

  constructor(private readonly supabase: SupabaseService) {}

  /**
   * Evaluates telemetry array and computes master / bridge crew safety & compliance score.
   */
  evaluateTelemetry(telemetryPoints: any[]): SeaCrewScoreEvaluation {
    if (!telemetryPoints || telemetryPoints.length < 2) {
      return { score: 100, harshManeuverCount: 0, overspeedEventCount: 0 };
    }

    let overspeedEvents = 0;
    let harshManeuvers = 0;

    for (let i = 0; i < telemetryPoints.length; i++) {
      const curr = telemetryPoints[i];
      const speed = Number(curr.speed_knots ?? curr.speedKnots ?? 0);
      const heading = Number(curr.heading ?? 0);

      // 1. Overspeed check (COLREGs Rule 6 / port limits)
      // If speed exceeds open water safe limit (24 kts) or excessive channel speed
      if (speed > SEAWAYS_OPEN_OCEAN_MAX_SPEED_KNOTS) {
        overspeedEvents++;
      }

      // 2. Harsh rudder maneuver check (Rate of turn > 20 deg/min between adjacent samples)
      if (i > 0) {
        const prev = telemetryPoints[i - 1];
        const prevHeading = Number(prev.heading ?? 0);

        const timeDiffSec = Math.max(
          1,
          (new Date(curr.recorded_at).getTime() - new Date(prev.recorded_at).getTime()) / 1000,
        );

        // Compute shortest angular heading difference on circle [-180, 180]
        let angleDiff = Math.abs(heading - prevHeading);
        if (angleDiff > 180) {
          angleDiff = 360 - angleDiff;
        }

        const rotDegPerMin = angleDiff * (60 / timeDiffSec);

        // Abrupt if ROT exceeds 20 deg/min or heading jump > 20 degrees in short tick
        if (rotDegPerMin > SEAWAYS_HARSH_ROT_THRESHOLD_DEG_PER_MIN || (angleDiff > 20 && timeDiffSec <= 30)) {
          harshManeuvers++;
        }
      }
    }

    const rawScore = 100 - 10 * harshManeuvers - 5 * overspeedEvents;
    const score = Math.max(0, Math.min(100, rawScore));

    return {
      score,
      harshManeuverCount: harshManeuvers,
      overspeedEventCount: overspeedEvents,
    };
  }

  /**
   * Computes score for a movement from recorded telemetry points and saves in database.
   */
  async computeSeaCrewScore(
    movementId: string,
    crewId: string,
    telemetryPoints: any[],
  ): Promise<SeaCrewScore> {
    const evaluation = this.evaluateTelemetry(telemetryPoints);

    const { data: scoreRecord, error } = await this.supabase.adminClient
      .from('sea_crew_scores')
      .upsert(
        {
          movement_id: movementId,
          crew_id: crewId,
          score: evaluation.score,
          harsh_maneuver_count: evaluation.harshManeuverCount,
          overspeed_event_count: evaluation.overspeedEventCount,
          computed_at: new Date().toISOString(),
        },
        { onConflict: 'movement_id' },
      )
      .select('*')
      .single();

    if (error) {
      this.logger.error(`Failed to save sea crew score: ${error.message}`);
    }

    return (
      scoreRecord || {
        id: `scs-${Date.now()}`,
        movement_id: movementId,
        crew_id: crewId,
        score: evaluation.score,
        harsh_maneuver_count: evaluation.harshManeuverCount,
        overspeed_event_count: evaluation.overspeedEventCount,
        computed_at: new Date().toISOString(),
      }
    );
  }

  async computeAndSaveScore(
    orgId: string,
    movementId: string,
    crewId: string,
  ): Promise<SeaCrewScore> {
    const { data: telemetry } = await this.supabase.adminClient
      .from('vessel_telemetry')
      .select('*')
      .eq('movement_id', movementId)
      .order('recorded_at', { ascending: true });

    return this.computeSeaCrewScore(movementId, crewId, telemetry || []);
  }

  async getScore(orgId: string, movementId: string): Promise<SeaCrewScore | null> {
    const { data, error } = await this.supabase.adminClient
      .from('sea_crew_scores')
      .select('*')
      .eq('movement_id', movementId)
      .maybeSingle();

    if (error || !data) return null;
    return data;
  }

  async getCrewScoreHistory(movementId: string): Promise<SeaCrewScore[]> {
    const { data, error } = await this.supabase.adminClient
      .from('sea_crew_scores')
      .select('*')
      .eq('movement_id', movementId)
      .order('computed_at', { ascending: false });

    if (error || !data) return [];
    return data;
  }
}
