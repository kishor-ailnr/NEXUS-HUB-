import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { SupabaseService } from '../../supabase/supabase.service';
import { FlightMovementEtaResponse } from '@nexus-ways/shared';

@Injectable()
export class FlightEtaService {
  private readonly logger = new Logger(FlightEtaService.name);

  constructor(private readonly supabase: SupabaseService) {}

  /**
   * Calculates ETA confidence band for a flight movement.
   * Groups historical movements by flight_id directly (Airways has no route cache).
   * - If >= 3 completed movements exist on the flight: historical mean duration + stddev (confidence_basis: 'historical')
   * - If < 3 completed movements: default +/- 15% band (confidence_basis: 'default')
   */
  async calculateFlightEta(
    orgId: string,
    movementId: string,
  ): Promise<FlightMovementEtaResponse> {
    return this.calculateMovementEta(orgId, movementId);
  }

  async calculateMovementEta(
    orgId: string,
    movementId: string,
  ): Promise<FlightMovementEtaResponse> {
    // 1. Fetch the target flight movement
    const { data: movement, error: movErr } = await this.supabase.adminClient
      .from('flight_movements')
      .select('*')
      .eq('id', movementId)
      .eq('org_id', orgId)
      .single();

    if (movErr || !movement) {
      throw new NotFoundException(`Flight movement ${movementId} not found`);
    }

    const flightId = movement.flight_id;
    const baseDuration = Number(movement.duration_minutes || movement.predicted_duration_minutes || 110);
    const distanceKm = Number(movement.distance_km || 1137);

    // 2. Query completed historical movements for the exact same flight_id
    const { data: historicalMovements } = await this.supabase.adminClient
      .from('flight_movements')
      .select('id, actual_duration_minutes, duration_minutes, started_at, completed_at')
      .eq('org_id', orgId)
      .eq('flight_id', flightId)
      .eq('status', 'completed')
      .neq('id', movementId);

    const completedList = (historicalMovements || []).filter((m: any) => {
      if (m.actual_duration_minutes != null && Number(m.actual_duration_minutes) > 0) return true;
      if (m.started_at && m.completed_at) return true;
      return false;
    });

    const sampleSize = completedList.length;

    // 3. Historical vs Default logic
    if (sampleSize >= 3) {
      const durations = completedList.map((m: any) => {
        if (m.actual_duration_minutes != null && Number(m.actual_duration_minutes) > 0) {
          return Number(m.actual_duration_minutes);
        }
        const diffMs = new Date(m.completed_at).getTime() - new Date(m.started_at).getTime();
        return Math.max(10, Math.round(diffMs / (1000 * 60)));
      });

      const sum = durations.reduce((acc: number, val: number) => acc + val, 0);
      const mean = sum / durations.length;

      const variance =
        durations.reduce((acc: number, val: number) => acc + Math.pow(val - mean, 2), 0) /
        durations.length;
      const stddev = Math.sqrt(variance);

      // 95% Confidence Interval: 1.96 * sigma
      const confidenceBand = Math.max(5, Math.round(1.96 * stddev));
      const minEta = Math.max(10, Math.round(mean - confidenceBand));
      const maxEta = Math.round(mean + confidenceBand);

      return {
        movement_id: movementId,
        remaining_distance_km: distanceKm,
        base_eta_minutes: Math.round(mean),
        min_eta_minutes: minEta,
        max_eta_minutes: maxEta,
        confidence_band_minutes: confidenceBand,
        confidence_basis: 'historical',
        sample_size: sampleSize,
        calculated_at: new Date().toISOString(),
      };
    }

    // Default basis: +/- 15%
    const defaultBand = Math.max(5, Math.round(baseDuration * 0.15));
    const minEta = Math.max(10, Math.round(baseDuration * 0.85));
    const maxEta = Math.round(baseDuration * 1.15);

    return {
      movement_id: movementId,
      remaining_distance_km: distanceKm,
      base_eta_minutes: Math.round(baseDuration),
      min_eta_minutes: minEta,
      max_eta_minutes: maxEta,
      confidence_band_minutes: defaultBand,
      confidence_basis: 'default',
      sample_size: sampleSize,
      calculated_at: new Date().toISOString(),
    };
  }
}
