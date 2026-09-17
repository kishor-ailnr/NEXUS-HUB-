import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { TripEtaResponse } from '@nexus-ways/shared';

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
export class EtaService {
  private readonly logger = new Logger(EtaService.name);

  constructor(private readonly supabase: SupabaseService) {}

  async calculateTripEtaConfidence(orgId: string, tripId: string): Promise<TripEtaResponse> {
    // 1. Fetch trip details
    const { data: trip, error: tripError } = await this.supabase.adminClient
      .from('trips')
      .select('*')
      .eq('org_id', orgId)
      .eq('id', tripId)
      .maybeSingle();

    if (tripError || !trip) {
      throw new NotFoundException('Trip not found');
    }

    // 2. Fetch latest GPS point for vehicle to determine remaining position
    const { data: latestGps } = await this.supabase.adminClient
      .from('gps_points')
      .select('lat, lng, speed_kmh')
      .eq('trip_id', tripId)
      .order('recorded_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    const destLat = trip.destination_lat || 18.5204;
    const destLng = trip.destination_lng || 73.8567;
    const currentLat = latestGps?.lat || trip.origin_lat || 19.076;
    const currentLng = latestGps?.lng || trip.origin_lng || 72.8777;

    const remainingDistanceKm = Math.round(
      (getDistanceMeters(currentLat, currentLng, destLat, destLng) / 1000) * 100,
    ) / 100;

    const totalDistanceKm = Number(trip.distance_km) || remainingDistanceKm || 100;
    const predictedDurationMin = Number(trip.predicted_duration_minutes) || Number(trip.duration_minutes) || 120;

    // Remaining duration proportional to remaining distance
    const progressFraction = Math.max(0, Math.min(1, 1 - remainingDistanceKm / Math.max(1, totalDistanceKm)));
    const remainingBaseDurationMin = Math.max(
      1,
      Math.round(predictedDurationMin * (1 - progressFraction)),
    );

    // 3. Query historical completed trips on the same origin/destination pair
    const { data: historicalTrips } = await this.supabase.adminClient
      .from('trips')
      .select('actual_duration_minutes, predicted_duration_minutes, duration_minutes')
      .eq('org_id', orgId)
      .eq('origin_label', trip.origin_label)
      .eq('destination_label', trip.destination_label)
      .eq('status', 'completed')
      .neq('id', tripId);

    const validHistory = (historicalTrips || []).filter(
      (t: any) =>
        t.actual_duration_minutes !== null &&
        t.actual_duration_minutes !== undefined &&
        (t.predicted_duration_minutes !== null || t.duration_minutes !== null),
    );

    const sampleSize = validHistory.length;

    let confidenceBasis: 'historical' | 'default' = 'default';
    let bandMinutes = Math.max(1, Math.round(remainingBaseDurationMin * 0.15)); // default ±15%

    if (sampleSize >= 3) {
      // Compute sample deviations: (actual - predicted)
      const deviations = validHistory.map((t: any) => {
        const pred = Number(t.predicted_duration_minutes || t.duration_minutes || 0);
        const act = Number(t.actual_duration_minutes || 0);
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
      trip_id: tripId,
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
