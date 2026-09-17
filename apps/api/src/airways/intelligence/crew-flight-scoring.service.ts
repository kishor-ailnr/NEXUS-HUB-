import { Injectable, Logger } from '@nestjs/common';
import { SupabaseService } from '../../supabase/supabase.service';
import { CrewFlightScore, FlightTelemetry } from '@nexus-ways/shared';

/**
 * Aviation Flight Crew Behavior Scoring:
 * Evaluates flight telemetry for pilot compliance with international aviation regulations:
 *
 * 1. Overspeed Rule:
 *    - Regulatory Anchor: ICAO Annex 2 (Rules of the Air) Section 3.1.2, DGCA India CAR Section 9 (Air Traffic Management),
 *      and FAA 14 CFR § 91.117(a): "No person may operate an aircraft below 10,000 feet MSL at an indicated airspeed
 *      of more than 250 knots (288 mph)."
 *    - In terminal/climb/descent phase (altitude < 10,000 ft): speed > 250 kts flags an overspeed event.
 *    - In cruise phase (altitude >= 10,000 ft): speed exceeding Vmo maximum operating limit (> 520 kts groundspeed).
 *
 * 2. Abrupt Maneuver Rule:
 *    - Excessive vertical rate of climb/descent exceeding +/- 3,000 feet per minute (fpm) between consecutive telemetry samples,
 *      or abrupt airspeed deceleration > 50 kts/tick indicating hard pitch/stall recovery.
 *
 * 3. Penalty Formula:
 *    - Score = max(0, min(100, 100 - (10 * abrupt_maneuvers) - (5 * overspeed_events)))
 */
export const ICAO_OVERSPEED_BELOW_10K_KTS = 250;
export const AIRWAYS_ABRUPT_VS_FPM = 3000;
export const AVIATION_OVERSPEED_RULE_CITATION =
  'ICAO Annex 2 (Rules of the Air) & DGCA India CAR Section 9 / FAA 14 CFR § 91.117(a) (Max 250 kts below 10,000 ft MSL)';
export const AIRWAYS_CREW_SCORING_CITATION =
  'ICAO Annex 2 (250 kts below 10,000 ft limit) & Flight Telemetry Abrupt Maneuver Thresholds (VS > ±3,000 fpm / dSpd > 50 kts)';

@Injectable()
export class CrewFlightScoringService {
  private readonly logger = new Logger(CrewFlightScoringService.name);

  constructor(private readonly supabase: SupabaseService) {}

  /**
   * Evaluates telemetry array and computes pilot safety/compliance score.
   */
  evaluateTelemetry(telemetryPoints: any[]): {
    score: number;
    abruptManeuverCount: number;
    overspeedEventCount: number;
  } {
    if (!telemetryPoints || telemetryPoints.length < 2) {
      return { score: 100, abruptManeuverCount: 0, overspeedEventCount: 0 };
    }

    let overspeedEvents = 0;
    let abruptManeuvers = 0;

    for (let i = 0; i < telemetryPoints.length; i++) {
      const curr = telemetryPoints[i];
      const altitude = curr.altitude_ft ?? 0;
      const speed = curr.speed_kts || 0;

      // 1. Overspeed check (ICAO / DGCA 250 kts limit below 10,000 ft MSL)
      if (altitude < 10000 && speed > ICAO_OVERSPEED_BELOW_10K_KTS) {
        overspeedEvents++;
      } else if (altitude >= 10000 && speed > 520) {
        overspeedEvents++;
      }

      // 2. Abrupt maneuver check (vertical rate > +/- 3,000 fpm or sudden delta speed > 50 kts)
      if (i > 0) {
        const prev = telemetryPoints[i - 1];
        const prevAlt = prev.altitude_ft ?? 0;
        const prevSpeed = prev.speed_kts || 0;

        const timeDiffSec = Math.max(
          1,
          (new Date(curr.recorded_at).getTime() - new Date(prev.recorded_at).getTime()) / 1000,
        );

        const verticalRateFpm = Math.abs(altitude - prevAlt) * (60 / timeDiffSec);
        const deltaSpeed = Math.abs(speed - prevSpeed);
        const speedRateKtsPerSec = deltaSpeed / timeDiffSec;

        // Abrupt if vertical climb/dive > 3000 fpm or sudden airspeed change > 5 kts/sec (e.g. >50 kts in 10s)
        if (verticalRateFpm > AIRWAYS_ABRUPT_VS_FPM || speedRateKtsPerSec > 5) {
          abruptManeuvers++;
        }
      }
    }

    const rawScore = 100 - 10 * abruptManeuvers - 5 * overspeedEvents;
    const score = Math.max(0, Math.min(100, rawScore));

    return {
      score,
      abruptManeuverCount: abruptManeuvers,
      overspeedEventCount: overspeedEvents,
    };
  }

  /**
   * Computes score for a movement from recorded telemetry points.
   */
  async computeFlightCrewScore(
    movementId: string,
    pilotId: string,
    telemetryPoints: any[],
  ): Promise<CrewFlightScore> {
    const evaluation = this.evaluateTelemetry(telemetryPoints);

    const { data: scoreRecord, error } = await this.supabase.adminClient
      .from('crew_flight_scores')
      .upsert(
        {
          movement_id: movementId,
          pilot_id: pilotId,
          score: evaluation.score,
          abrupt_maneuver_count: evaluation.abruptManeuverCount,
          overspeed_event_count: evaluation.overspeedEventCount,
          computed_at: new Date().toISOString(),
        },
        { onConflict: 'movement_id' },
      )
      .select('*')
      .single();

    if (error) {
      this.logger.error(`Failed to save crew flight score: ${error.message}`);
    }

    return (
      scoreRecord || {
        id: `cfs-${Date.now()}`,
        movement_id: movementId,
        pilot_id: pilotId,
        score: evaluation.score,
        abrupt_maneuver_count: evaluation.abruptManeuverCount,
        overspeed_event_count: evaluation.overspeedEventCount,
        computed_at: new Date().toISOString(),
      }
    );
  }

  async computeAndSaveScore(
    orgId: string,
    movementId: string,
    pilotId: string,
  ): Promise<CrewFlightScore> {
    const { data: telemetry } = await this.supabase.adminClient
      .from('flight_telemetry')
      .select('*')
      .eq('movement_id', movementId)
      .order('recorded_at', { ascending: true });

    return this.computeFlightCrewScore(movementId, pilotId, telemetry || []);
  }

  async getScore(orgId: string, movementId: string): Promise<CrewFlightScore | null> {
    const { data, error } = await this.supabase.adminClient
      .from('crew_flight_scores')
      .select('*')
      .eq('movement_id', movementId)
      .maybeSingle();

    if (error || !data) return null;
    return data;
  }

  async getCrewScoreHistory(movementId: string): Promise<CrewFlightScore[]> {
    const { data, error } = await this.supabase.adminClient
      .from('crew_flight_scores')
      .select('*')
      .eq('movement_id', movementId)
      .order('computed_at', { ascending: false });

    if (error || !data) return [];
    return data;
  }
}
