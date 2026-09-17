import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { SupabaseService } from '../../supabase/supabase.service';
import { TrainMovementEtaResponse } from '@nexus-ways/shared';

function getDistanceMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371e3;
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

@Injectable()
export class RailEtaService {
  private readonly logger = new Logger(RailEtaService.name);

  constructor(private readonly supabase: SupabaseService) {}

  async calculateMovementEtaConfidence(orgId: string, movementId: string): Promise<TrainMovementEtaResponse> {
    // 1. Fetch train movement details
    const { data: movement, error: movementError } = await this.supabase.adminClient
      .from('train_movements')
      .select(`
        *,
        origin_station:stations!origin_station_id(*),
        destination_station:stations!destination_station_id(*)
      `)
      .eq('org_id', orgId)
      .eq('id', movementId)
      .maybeSingle();

    if (movementError || !movement) {
      throw new NotFoundException(`Train movement ${movementId} not found`);
    }

    // 2. Fetch latest telemetry point for the train movement
    const { data: latestTelemetry } = await this.supabase.adminClient
      .from('train_telemetry')
      .select('lat, lng, speed_kmh')
      .eq('movement_id', movementId)
      .order('recorded_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    const destLat = movement.destination_station?.lat || 28.6139;
    const destLng = movement.destination_station?.lng || 77.209;
    const currentLat = latestTelemetry?.lat || movement.origin_station?.lat || 19.076;
    const currentLng = latestTelemetry?.lng || movement.origin_station?.lng || 72.8777;

    const remainingDistanceKm =
      Math.round((getDistanceMeters(currentLat, currentLng, destLat, destLng) / 1000) * 100) / 100;

    const totalDistanceKm = Number(movement.distance_km) || remainingDistanceKm || 100;
    const predictedDurationMin =
      Number(movement.predicted_duration_minutes) || Number(movement.duration_minutes) || 120;

    // Remaining duration proportional to remaining distance
    const progressFraction = Math.max(
      0,
      Math.min(1, 1 - remainingDistanceKm / Math.max(1, totalDistanceKm)),
    );
    const remainingBaseDurationMin = Math.max(
      1,
      Math.round(predictedDurationMin * (1 - progressFraction)),
    );

    // 3. Query historical completed movements on the same origin/destination station pair
    const { data: historicalMovements } = await this.supabase.adminClient
      .from('train_movements')
      .select('actual_duration_minutes, predicted_duration_minutes, duration_minutes')
      .eq('org_id', orgId)
      .eq('origin_station_id', movement.origin_station_id)
      .eq('destination_station_id', movement.destination_station_id)
      .eq('status', 'completed')
      .neq('id', movementId);

    const validHistory = (historicalMovements || []).filter(
      (m: any) =>
        m.actual_duration_minutes !== null &&
        m.actual_duration_minutes !== undefined &&
        (m.predicted_duration_minutes !== null || m.duration_minutes !== null),
    );

    const sampleSize = validHistory.length;
    let confidenceBasis: 'historical' | 'default' = 'default';
    let bandMinutes = Math.max(1, Math.round(remainingBaseDurationMin * 0.15)); // default ±15%

    if (sampleSize >= 3) {
      // Compute sample deviations: (actual - predicted)
      const deviations = validHistory.map((m: any) => {
        const pred = Number(m.predicted_duration_minutes || m.duration_minutes || 0);
        const act = Number(m.actual_duration_minutes || 0);
        return act - pred;
      });

      const meanDev = deviations.reduce((sum, d) => sum + d, 0) / sampleSize;
      const variance =
        deviations.reduce((sum, d) => sum + Math.pow(d - meanDev, 2), 0) / (sampleSize - 1);
      const stdDev = Math.sqrt(variance);

      bandMinutes = Math.max(1, Math.round(stdDev));
      confidenceBasis = 'historical';
    }

    const minEtaMinutes = Math.max(0, remainingBaseDurationMin - bandMinutes);
    const maxEtaMinutes = remainingBaseDurationMin + bandMinutes;

    return {
      movement_id: movementId,
      remaining_distance_km: remainingDistanceKm,
      base_eta_minutes: remainingBaseDurationMin,
      min_eta_minutes: minEtaMinutes,
      max_eta_minutes: maxEtaMinutes,
      confidence_band_minutes: bandMinutes,
      confidence_basis: confidenceBasis,
      sample_size: sampleSize,
      calculated_at: new Date().toISOString(),
    };
  }
}
