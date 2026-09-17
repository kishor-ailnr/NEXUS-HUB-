import {
  RailCarbonService,
  RAIL_CARBON_FACTOR_KG_PER_TONNE_KM,
  RAIL_CARBON_CITATION,
} from './rail-carbon.service';
import {
  CrewScoringService,
  FREIGHT_TRAIN_MAX_PERMISSIBLE_SPEED_KMH,
  RAIL_HARSH_BRAKE_SPEED_DROP_KMH,
  RAIL_CREW_SCORING_CITATION,
} from './crew-scoring.service';
import { RailEtaService } from './rail-eta.service';
import { SlotIntelligenceService } from './slot-intelligence.service';
import { RailPdfReportService, TrainMovementReportData } from '../reports/rail-pdf-report.service';

describe('Phase 7A-2 Railways Intelligence Services (Unit)', () => {
  describe('RailCarbonService & Directional Sanity Check', () => {
    let carbonService: RailCarbonService;
    const ROAD_FACTOR = 0.101; // Roadways Phase 5 factor

    beforeEach(() => {
      carbonService = new RailCarbonService();
    });

    it('calculates carbon for rail freight using blended national factor (0.0106 kg CO2e / tonne-km)', () => {
      // 300 km, 1500 tonnes -> 300 * 1500 * 0.0106 = 4770 kg CO2e
      const distanceKm = 300;
      const cargoTonnes = 1500;
      const result = carbonService.calculateMovementCarbon(distanceKm, 'electric', cargoTonnes);

      expect(result.emissionFactor).toBe(0.0106);
      expect(result.carbonKg).toBe(4770);
      expect(result.fuelType).toBe('electric');
      expect(result.citation).toContain('Smart Freight Centre & TCI-IIMB');
      expect(result.citation).toContain('0.0106');
    });

    it('calculates carbon consistently regardless of traction type using blended factor', () => {
      // 300 km, 1500 tonnes -> 300 * 1500 * 0.0106 = 4770 kg CO2e
      const distanceKm = 300;
      const cargoTonnes = 1500;
      const result = carbonService.calculateMovementCarbon(distanceKm, 'diesel', cargoTonnes);

      expect(result.emissionFactor).toBe(0.0106);
      expect(result.carbonKg).toBe(4770);
      expect(result.fuelType).toBe('diesel');
    });

    it('satisfies directional sanity check: rail freight is ~89.5% cleaner than road freight (~9.5x more carbon-efficient)', () => {
      // Rail emission factor (0.0106) must be substantially lower than road factor (0.101)
      expect(RAIL_CARBON_FACTOR_KG_PER_TONNE_KM).toBeLessThan(ROAD_FACTOR);
      
      // 0.101 / 0.0106 = 9.528x
      const efficiencyMultiple = ROAD_FACTOR / RAIL_CARBON_FACTOR_KG_PER_TONNE_KM;
      expect(efficiencyMultiple).toBeGreaterThan(9.0);
      expect(efficiencyMultiple).toBeCloseTo(9.53, 1);

      // Percentage reduction vs road: (0.101 - 0.0106) / 0.101 = 89.50% -> rounded to 90%
      const electricResult = carbonService.calculateMovementCarbon(100, 'electric', 1000);
      expect(electricResult.percentReductionVsRoad).toBe(90);
      expect(electricResult.savedVsRoadKg).toBe(9040); // 10100 - 1060 = 9040 kg
    });
  });

  describe('CrewScoringService', () => {
    let scoringService: CrewScoringService;
    let mockSupabase: any;

    beforeEach(() => {
      mockSupabase = {
        adminClient: {
          from: jest.fn().mockReturnValue({
            insert: jest.fn().mockImplementation((payload) => ({
              select: jest.fn().mockReturnValue({
                single: jest.fn().mockResolvedValue({
                  data: {
                    id: 'score-rail-1',
                    ...payload,
                    computed_at: new Date().toISOString(),
                  },
                  error: null,
                }),
              }),
            })),
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                order: jest.fn().mockReturnValue({
                  limit: jest.fn().mockResolvedValue({
                    data: [],
                    error: null,
                  }),
                }),
              }),
            }),
          }),
        },
      };
      scoringService = new CrewScoringService(mockSupabase);
    });

    it('returns perfect 100 for clean train movement within MPS speed limit', async () => {
      const cleanTelemetry = [
        { lat: 18.9, lng: 72.8, speed_kmh: 65, recorded_at: '2026-09-11T10:00:00Z' },
        { lat: 18.91, lng: 72.81, speed_kmh: 75, recorded_at: '2026-09-11T10:00:05Z' },
        { lat: 18.92, lng: 72.82, speed_kmh: 80, recorded_at: '2026-09-11T10:00:10Z' },
      ];

      const score = await scoringService.computeMovementCrewScore('mov-1', 'pilot-1', cleanTelemetry);
      expect(score.score).toBe(100);
      expect(score.harsh_brake_count).toBe(0);
      expect(score.overspeed_event_count).toBe(0);
    });

    it('detects harsh braking (>15 km/h drop in <=10s) and deducts 10 points per event', async () => {
      const telemetryWithHarshBrakes = [
        { lat: 18.9, lng: 72.8, speed_kmh: 80, recorded_at: '2026-09-11T10:00:00Z' },
        // Speed drops from 80 to 55 (drop of 25 km/h in 5s) -> 1 harsh brake
        { lat: 18.91, lng: 72.81, speed_kmh: 55, recorded_at: '2026-09-11T10:00:05Z' },
        { lat: 18.92, lng: 72.82, speed_kmh: 60, recorded_at: '2026-09-11T10:00:15Z' },
        // Speed drops from 60 to 40 (drop of 20 km/h in 4s) -> 2nd harsh brake
        { lat: 18.93, lng: 72.83, speed_kmh: 40, recorded_at: '2026-09-11T10:00:19Z' },
      ];

      const score = await scoringService.computeMovementCrewScore('mov-1', 'pilot-1', telemetryWithHarshBrakes);
      expect(score.harsh_brake_count).toBe(2);
      expect(score.overspeed_event_count).toBe(0);
      // Score: 100 - (10 * 2) = 80
      expect(score.score).toBe(80);
    });

    it('detects overspeeding above rail MPS (>100 km/h) and deducts 5 points per event', async () => {
      const telemetryWithOverspeed = [
        { lat: 18.9, lng: 72.8, speed_kmh: 90, recorded_at: '2026-09-11T10:00:00Z' },
        { lat: 18.91, lng: 72.81, speed_kmh: 108, recorded_at: '2026-09-11T10:00:05Z' }, // overspeed 1
        { lat: 18.92, lng: 72.82, speed_kmh: 112, recorded_at: '2026-09-11T10:00:10Z' }, // overspeed 2
        { lat: 18.93, lng: 72.83, speed_kmh: 88, recorded_at: '2026-09-11T10:00:30Z' }, // 20s later (>10s window, <=100 km/h)
      ];

      const score = await scoringService.computeMovementCrewScore('mov-1', 'pilot-1', telemetryWithOverspeed);
      expect(score.overspeed_event_count).toBe(2);
      expect(score.harsh_brake_count).toBe(0);
      // Score: 100 - (5 * 2) = 90
      expect(score.score).toBe(90);
    });
  });

  describe('RailEtaService Historical vs Default Bands', () => {
    let etaService: RailEtaService;

    it('uses default ±15% band when sample size is fewer than 3 completed movements', async () => {
      const mockSupabase: any = {
        adminClient: {
          from: jest.fn().mockImplementation((table) => {
            if (table === 'train_movements') {
              const qb: any = {};
              qb.select = jest.fn().mockReturnValue(qb);
              qb.eq = jest.fn().mockReturnValue(qb);
              qb.neq = jest.fn().mockResolvedValue({
                data: [{ actual_duration_minutes: 180, predicted_duration_minutes: 180 }],
                error: null,
              });
              qb.maybeSingle = jest.fn().mockResolvedValue({
                data: {
                  id: 'mov-1',
                  org_id: 'org-1',
                  origin_station_id: 'st-1',
                  destination_station_id: 'st-2',
                  duration_minutes: 200,
                  predicted_duration_minutes: 200,
                  distance_km: 250,
                  status: 'in_transit',
                  origin_station: { lat: 28.6139, lng: 77.209 },
                  destination_station: { lat: 18.9696, lng: 72.8193 },
                },
                error: null,
              });
              return qb;
            }
            if (table === 'train_telemetry') {
              const qb: any = {};
              qb.select = jest.fn().mockReturnValue(qb);
              qb.eq = jest.fn().mockReturnValue(qb);
              qb.order = jest.fn().mockReturnValue(qb);
              qb.limit = jest.fn().mockReturnValue(qb);
              qb.maybeSingle = jest.fn().mockResolvedValue({
                data: { lat: 28.6, lng: 77.2, speed_kmh: 75 },
                error: null,
              });
              return qb;
            }
          }),
        },
      };

      etaService = new RailEtaService(mockSupabase);
      const eta = await etaService.calculateMovementEtaConfidence('org-1', 'mov-1');

      expect(eta.confidence_basis).toBe('default');
      expect(eta.sample_size).toBe(1);
      expect(eta.confidence_band_minutes).toBe(Math.round(eta.base_eta_minutes * 0.15));
    });

    it('computes historical sample standard deviation band when >=3 completed movements exist', async () => {
      const mockSupabase: any = {
        adminClient: {
          from: jest.fn().mockImplementation((table) => {
            if (table === 'train_movements') {
              const qb: any = {};
              qb.select = jest.fn().mockReturnValue(qb);
              qb.eq = jest.fn().mockReturnValue(qb);
              qb.neq = jest.fn().mockResolvedValue({
                data: [
                  { actual_duration_minutes: 210, predicted_duration_minutes: 200 }, // dev: +10
                  { actual_duration_minutes: 195, predicted_duration_minutes: 200 }, // dev: -5
                  { actual_duration_minutes: 205, predicted_duration_minutes: 200 }, // dev: +5
                  { actual_duration_minutes: 200, predicted_duration_minutes: 200 }, // dev: 0
                ],
                error: null,
              });
              qb.maybeSingle = jest.fn().mockResolvedValue({
                data: {
                  id: 'mov-1',
                  org_id: 'org-1',
                  origin_station_id: 'st-1',
                  destination_station_id: 'st-2',
                  duration_minutes: 200,
                  predicted_duration_minutes: 200,
                  distance_km: 250,
                  status: 'in_transit',
                  origin_station: { lat: 28.6139, lng: 77.209 },
                  destination_station: { lat: 18.9696, lng: 72.8193 },
                },
                error: null,
              });
              return qb;
            }
            if (table === 'train_telemetry') {
              const qb: any = {};
              qb.select = jest.fn().mockReturnValue(qb);
              qb.eq = jest.fn().mockReturnValue(qb);
              qb.order = jest.fn().mockReturnValue(qb);
              qb.limit = jest.fn().mockReturnValue(qb);
              qb.maybeSingle = jest.fn().mockResolvedValue({
                data: { lat: 28.6, lng: 77.2, speed_kmh: 75 },
                error: null,
              });
              return qb;
            }
          }),
        },
      };

      etaService = new RailEtaService(mockSupabase);
      const eta = await etaService.calculateMovementEtaConfidence('org-1', 'mov-1');

      expect(eta.confidence_basis).toBe('historical');
      expect(eta.sample_size).toBe(4);
      expect(eta.confidence_band_minutes).toBeGreaterThan(0);
      expect(eta.min_eta_minutes).toBe(eta.base_eta_minutes - eta.confidence_band_minutes);
      expect(eta.max_eta_minutes).toBe(eta.base_eta_minutes + eta.confidence_band_minutes);
    });

  });

  describe('SlotIntelligenceService', () => {
    let slotService: SlotIntelligenceService;

    it('detects corridor congestion when overlapping movements exceed threshold and suggests alternative slot', async () => {
      const now = new Date();
      const mockSupabase: any = {
        adminClient: {
          from: jest.fn().mockReturnValue({
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                in: jest.fn().mockReturnValue({
                  or: jest.fn().mockResolvedValue({
                    data: [
                      {
                        id: 'm-overlap-1',
                        origin_station_id: 'st-mumbai',
                        destination_station_id: 'st-delhi',
                        status: 'in_transit',
                        started_at: new Date(now.getTime() - 30 * 60000).toISOString(), // 30 min ago
                      },
                      {
                        id: 'm-overlap-2',
                        origin_station_id: 'st-mumbai',
                        destination_station_id: 'st-delhi',
                        status: 'planned',
                        created_at: new Date(now.getTime() + 45 * 60000).toISOString(), // in 45 min
                      },
                    ],
                    error: null,
                  }),
                }),
              }),
            }),
          }),
        },
      };

      slotService = new SlotIntelligenceService(mockSupabase);
      const result = await slotService.checkSlot(
        'org-1',
        'st-mumbai',
        'st-delhi',
        now.toISOString(),
        2, // 2 hour window
        1, // threshold = 1
      );

      expect(result.congested).toBe(true);
      expect(result.overlapCount).toBe(2);
      expect(result.suggestedDeparture).toBeDefined();
      expect(result.reason).toContain('High line occupancy');
    });

    it('approves departure slot when no overlapping movements exist on corridor', async () => {
      const mockSupabase: any = {
        adminClient: {
          from: jest.fn().mockReturnValue({
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                in: jest.fn().mockReturnValue({
                  or: jest.fn().mockResolvedValue({
                    data: [],
                    error: null,
                  }),
                }),
              }),
            }),
          }),
        },
      };

      slotService = new SlotIntelligenceService(mockSupabase);
      const result = await slotService.checkSlot(
        'org-1',
        'st-mumbai',
        'st-delhi',
        new Date().toISOString(),
      );

      expect(result.congested).toBe(false);
      expect(result.overlapCount).toBe(0);
      expect(result.reason).toContain('Track section clear');
    });
  });

  describe('RailPdfReportService Real PDF Verification', () => {
    let pdfService: RailPdfReportService;
    let mockSupabase: any;
    let mockNotifications: any;

    beforeEach(() => {
      const sampleMovement = {
        id: 'mov-1',
        org_id: 'org-1',
        train_id: 'tr-1',
        loco_pilot_id: 'lp-1',
        origin_station_id: 'st-1',
        destination_station_id: 'st-2',
        distance_km: 450,
        duration_minutes: 360,
        predicted_duration_minutes: 360,
        actual_duration_minutes: 350,
        carbon_kg: 14175,
        status: 'completed',
        completed_at: new Date().toISOString(),
        train: {
          train_number: '12951',
          train_name: 'Mumbai Rajdhani Freight',
          locomotive: { loco_number: 'WAP-7-30201', loco_type: 'WAP-7', fuel_type: 'electric', power_kw: 6000 },
          rake: { rake_id: 'RAKE-BOXN-99', composition: [{ type: 'BOXN', count: 45 }] },
        },
        loco_pilot: {
          license_number: 'LP-IND-4001',
          user: { full_name: 'Rajesh Sharma' },
        },
        origin_station: { name: 'Mumbai CSMT', station_code: 'CSMT', lat: 18.9402, lng: 72.8357 },
        destination_station: { name: 'New Delhi', station_code: 'NDLS', lat: 28.6143, lng: 77.2104 },
      };

      const sampleReport = {
        id: 'report-rail-1',
        org_id: 'org-1',
        movement_id: 'mov-1',
        storage_path: 'railways/org-1/mov-1.pdf',
        file_size_bytes: 8500,
        generated_at: new Date().toISOString(),
      };

      mockSupabase = {
        adminClient: {
          from: jest.fn().mockImplementation((table: string) => {
            const chain: any = {};
            chain.select = jest.fn().mockReturnValue(chain);
            chain.eq = jest.fn().mockReturnValue(chain);
            chain.order = jest.fn().mockReturnValue(chain);
            chain.limit = jest.fn().mockReturnValue(chain);
            chain.upsert = jest.fn().mockReturnValue(chain);
            chain.insert = jest.fn().mockReturnValue(chain);

            if (table === 'train_movements') {
              chain.maybeSingle = jest.fn().mockResolvedValue({ data: sampleMovement, error: null });
              chain.single = jest.fn().mockResolvedValue({ data: sampleMovement, error: null });
            } else if (table === 'train_movement_reports') {
              chain.maybeSingle = jest.fn().mockResolvedValue({ data: sampleReport, error: null });
              chain.single = jest.fn().mockResolvedValue({ data: sampleReport, error: null });
            } else if (table === 'crew_behavior_scores') {
              chain.maybeSingle = jest.fn().mockResolvedValue({
                data: { score: 95, harsh_brake_count: 0, overspeed_event_count: 1 },
                error: null,
              });
              chain.single = jest.fn().mockResolvedValue({
                data: { score: 95, harsh_brake_count: 0, overspeed_event_count: 1 },
                error: null,
              });
            } else if (table === 'train_movement_stops') {
              chain.order = jest.fn().mockResolvedValue({ data: [], error: null });
            } else {
              chain.maybeSingle = jest.fn().mockResolvedValue({ data: null, error: null });
              chain.single = jest.fn().mockResolvedValue({ data: null, error: null });
              chain.limit = jest.fn().mockResolvedValue({ data: [], error: null });
            }

            return chain;
          }),
          storage: {
            from: jest.fn().mockReturnValue({
              upload: jest.fn().mockResolvedValue({ data: { path: 'railways/org-1/mov-1.pdf' }, error: null }),
              createSignedUrl: jest.fn().mockResolvedValue({
                data: { signedUrl: 'https://storage.supabase.co/railways/org-1/mov-1.pdf?token=valid' },
                error: null,
              }),
            }),
          },
        },
      };

      mockNotifications = {
        createNotification: jest.fn().mockResolvedValue(true),
      };

      pdfService = new RailPdfReportService(mockSupabase, mockNotifications);
    });

    it('generates a valid, pure JS binary PDF with correct "%PDF-" magic bytes', async () => {
      const reportData: TrainMovementReportData = {
        movementId: 'mov-test-99',
        orgId: 'org-test',
        trainNumber: '12951',
        trainName: 'Mumbai Rajdhani Freight',
        locoNumber: 'WAP-7-30201',
        locoType: 'WAP-7',
        locoFuelType: 'electric',
        locoPowerKw: 6000,
        rakeId: 'RAKE-BOXN-99',
        rakeComposition: '45 Heavy Haul Wagons',
        locoPilotName: 'Rajesh Sharma',
        locoPilotLicense: 'LP-IND-4001',
        originStationName: 'Mumbai CSMT',
        originStationCode: 'CSMT',
        originLat: 18.9402,
        originLng: 72.8357,
        destStationName: 'New Delhi',
        destStationCode: 'NDLS',
        destLat: 28.6143,
        destLng: 77.2104,
        completedAt: new Date().toISOString(),
        predictedDurationMinutes: 360,
        actualDurationMinutes: 350,
        distanceKm: 450,
        avgSpeedKmh: 78,
        etaConfidenceBasis: 'historical',
        etaConfidenceBandMinutes: 12,
        etaSampleSize: 5,
        crewScore: 95,
        harshBrakeCount: 0,
        overspeedEventCount: 1,
        carbonKg: 14175,
        cargoTonnes: 1500,
        slotCongestionStatus: 'Line Slot Approved (Clear Track Capacity)',
      };

      const pdfBuffer = await pdfService.buildTrainMovementPdfBuffer(reportData);

      expect(Buffer.isBuffer(pdfBuffer)).toBe(true);
      expect(pdfBuffer.length).toBeGreaterThan(1000);

      // Verify %PDF- magic bytes
      const header = pdfBuffer.slice(0, 5).toString('ascii');
      expect(header).toBe('%PDF-');
    });

    it('generates and stores report row in Supabase and issues notification', async () => {
      const result = await pdfService.generateAndStoreMovementReport('org-1', 'mov-1');

      expect(result.storagePath).toContain('railways/org-1/mov-1.pdf');
      expect(result.fileSizeBytes).toBeGreaterThan(1000);
      expect(mockNotifications.createNotification).toHaveBeenCalled();
    });

    it('returns signed URL for completed movement report', async () => {
      const result = await pdfService.getSignedReportUrl('org-1', 'mov-1');

      expect(result.movementId).toBe('mov-1');
      expect(result.signedUrl).toContain('https://');
      expect(result.storagePath).toContain('railways/org-1/mov-1.pdf');
    });
  });
});
