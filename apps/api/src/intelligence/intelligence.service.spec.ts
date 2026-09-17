import { CarbonService, GLEC_INDIAN_ROAD_FREIGHT_EMISSION_FACTOR, GLEC_CITATION } from './carbon.service';
import { TollService, NHAI_COMMERCIAL_TRUCK_TOLL_RATE_PER_KM, NHAI_TOLL_CITATION } from './toll.service';
import { DriverScoringService, HARSH_BRAKE_SPEED_DROP_KMH, HIGHWAY_SPEED_LIMIT_KMH } from './driver-scoring.service';
import { EtaService } from './eta.service';

describe('Phase 5 Intelligence Services (Unit)', () => {
  describe('CarbonService', () => {
    let carbonService: CarbonService;

    beforeEach(() => {
      carbonService = new CarbonService();
    });

    it('calculates carbon footprint according to GLEC Framework factor (0.101 kg CO2e / tonne-km)', () => {
      // 100 km, 15000 kg (15 tonnes) truck -> 100 * 15 * 0.101 = 151.5 kg CO2e
      const distanceKm = 100;
      const capacityKg = 15000;
      const result = carbonService.calculateTripCarbon(distanceKm, capacityKg);

      expect(result.emissionFactor).toBe(0.101);
      expect(result.carbonKg).toBe(151.5);
      expect(result.citation).toContain('GLEC Framework');
    });

    it('handles default capacity when capacity is not provided', () => {
      // 50 km, default 15000 kg (15 tonnes) -> 50 * 15 * 0.101 = 75.75 kg CO2e
      const result = carbonService.calculateTripCarbon(50);
      expect(result.carbonKg).toBe(75.75);
    });
  });

  describe('TollService', () => {
    let tollService: TollService;

    beforeEach(() => {
      tollService = new TollService();
    });

    it('estimates highway toll using approximate commercial vehicle rate (~₹5.50 / km) and includes explicit approximation label', () => {
      // 200 km -> 200 * 5.50 = 1100 INR
      const distanceKm = 200;
      const result = tollService.calculateTripToll(distanceKm);

      expect(result.perKmRate).toBe(5.50);
      expect(result.tollEstimateInr).toBe(1100);
      expect(result.isEstimate).toBe(true);
      expect(result.estimateNote).toContain('approximate; not sourced from a verified current NHAI rate table');
      expect(result.citation).toContain('approximate estimate, not a statutory calculation');
    });
  });

  describe('DriverScoringService', () => {
    let scoringService: DriverScoringService;
    let mockSupabase: any;

    beforeEach(() => {
      mockSupabase = {
        adminClient: {
          from: jest.fn().mockReturnValue({
            insert: jest.fn().mockImplementation((payload) => ({
              select: jest.fn().mockReturnValue({
                single: jest.fn().mockResolvedValue({
                  data: {
                    id: 'score-1',
                    ...payload,
                    computed_at: new Date().toISOString(),
                  },
                  error: null,
                }),
              }),
            })),
          }),
        },
      };
      scoringService = new DriverScoringService(mockSupabase);
    });

    it('returns perfect 100 for clean driving sequence', async () => {
      const cleanGps = [
        { id: '1', trip_id: 't-1', vehicle_id: 'v-1', lat: 19.0, lng: 72.0, speed_kmh: 40, recorded_at: '2026-09-06T00:00:00Z' },
        { id: '2', trip_id: 't-1', vehicle_id: 'v-1', lat: 19.01, lng: 72.01, speed_kmh: 45, recorded_at: '2026-09-06T00:00:05Z' },
        { id: '3', trip_id: 't-1', vehicle_id: 'v-1', lat: 19.02, lng: 72.02, speed_kmh: 50, recorded_at: '2026-09-06T00:00:10Z' },
      ];

      const score = await scoringService.computeTripDriverScore('t-1', 'd-1', cleanGps as any);
      expect(score.score).toBe(100);
      expect(score.harsh_brake_count).toBe(0);
      expect(score.speeding_event_count).toBe(0);
    });

    it('detects harsh brake events (speed drop > 20 km/h in <= 10s) and applies exact formula 100 - (10 * brakes) - (5 * speedings)', async () => {
      const gpsWithBrakes = [
        { id: '1', trip_id: 't-1', vehicle_id: 'v-1', lat: 19.0, lng: 72.0, speed_kmh: 65, recorded_at: '2026-09-06T00:00:00Z' },
        // Speed drops from 65 to 35 (drop of 30 km/h in 5s) -> 1 harsh brake
        { id: '2', trip_id: 't-1', vehicle_id: 'v-1', lat: 19.01, lng: 72.01, speed_kmh: 35, recorded_at: '2026-09-06T00:00:05Z' },
        // Steady driving
        { id: '3', trip_id: 't-1', vehicle_id: 'v-1', lat: 19.02, lng: 72.02, speed_kmh: 40, recorded_at: '2026-09-06T00:00:15Z' },
        // Speed drops from 40 to 10 (drop of 30 km/h in 4s) -> 2nd harsh brake
        { id: '4', trip_id: 't-1', vehicle_id: 'v-1', lat: 19.03, lng: 72.03, speed_kmh: 10, recorded_at: '2026-09-06T00:00:19Z' },
      ];

      const result = await scoringService.computeTripDriverScore('t-1', 'd-1', gpsWithBrakes as any);
      expect(result.harsh_brake_count).toBe(2);
      expect(result.speeding_event_count).toBe(0);
      // Score: 100 - (10 * 2) = 80
      expect(result.score).toBe(80);
    });

    it('detects speeding events (> 80 km/h) and deducts 5 points each', async () => {
      const gpsWithSpeeding = [
        { id: '1', trip_id: 't-1', vehicle_id: 'v-1', lat: 19.0, lng: 72.0, speed_kmh: 70, recorded_at: '2026-09-06T00:00:00Z' },
        { id: '2', trip_id: 't-1', vehicle_id: 'v-1', lat: 19.01, lng: 72.01, speed_kmh: 85, recorded_at: '2026-09-06T00:00:05Z' }, // speeding 1
        { id: '3', trip_id: 't-1', vehicle_id: 'v-1', lat: 19.02, lng: 72.02, speed_kmh: 90, recorded_at: '2026-09-06T00:00:10Z' }, // speeding 2
        { id: '4', trip_id: 't-1', vehicle_id: 'v-1', lat: 19.03, lng: 72.03, speed_kmh: 75, recorded_at: '2026-09-06T00:00:15Z' },
      ];

      const result = await scoringService.computeTripDriverScore('t-1', 'd-1', gpsWithSpeeding as any);
      expect(result.speeding_event_count).toBe(2);
      expect(result.harsh_brake_count).toBe(0);
      // Score: 100 - (5 * 2) = 90
      expect(result.score).toBe(90);
    });
  });

  describe('EtaService Variance Logic', () => {
    let etaService: EtaService;
    let mockSupabase: any;

    beforeEach(() => {
      const queryBuilder: any = {};
      queryBuilder.select = jest.fn().mockReturnValue(queryBuilder);
      queryBuilder.eq = jest.fn().mockReturnValue(queryBuilder);
      queryBuilder.neq = jest.fn().mockResolvedValue({
        data: [{ actual_duration_minutes: 65, predicted_duration_minutes: 60 }],
        error: null,
      });
      queryBuilder.order = jest.fn().mockReturnValue(queryBuilder);
      queryBuilder.limit = jest.fn().mockReturnValue(queryBuilder);
      queryBuilder.maybeSingle = jest.fn().mockResolvedValue({
        data: {
          id: 'trip-1',
          org_id: 'org-1',
          origin_lat: 19.0,
          origin_lng: 72.0,
          destination_lat: 19.5,
          destination_lng: 72.5,
          duration_minutes: 60,
          predicted_duration_minutes: 60,
          distance_km: 100,
          origin_label: 'Mumbai',
          destination_label: 'Pune',
          status: 'in_transit',
        },
        error: null,
      });

      mockSupabase = {
        adminClient: {
          from: jest.fn().mockReturnValue(queryBuilder),
        },
      };
      etaService = new EtaService(mockSupabase);
    });

    it('uses default ±15% band when fewer than 3 historical completed trips exist', async () => {
      const eta = await etaService.calculateTripEtaConfidence('org-1', 'trip-1');
      expect(eta.confidence_basis).toBe('default');
      expect(eta.sample_size).toBe(1);
      expect(eta.confidence_band_minutes).toBe(Math.round(eta.base_eta_minutes * 0.15));
    });
  });
});
