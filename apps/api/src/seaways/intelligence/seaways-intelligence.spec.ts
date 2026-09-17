import {
  SeaCarbonService,
  CONTAINER_SHIP_PANAMAX_NEOPANAMAX_KG_PER_TONNE_KM,
  CONTAINER_SHIP_ULCV_KG_PER_TONNE_KM,
  CONTAINER_SHIP_TEU_THRESHOLD,
  CONTAINER_SHIP_FEEDER_TEU_THRESHOLD,
  SEAWAYS_PANAMAX_CARBON_FACTOR_KG_PER_TONNE_KM,
  SEAWAYS_CARBON_CITATION,
  selectSeaCarbonFactor,
  getDwtBucketInfo,
} from './sea-carbon.service';
import {
  SeaCrewScoringService,
  SEAWAYS_HARSH_ROT_THRESHOLD_DEG_PER_MIN,
  SEAWAYS_HARBOR_SPEED_LIMIT_KNOTS,
  SEAWAYS_OPEN_OCEAN_MAX_SPEED_KNOTS,
  SEAWAYS_CREW_SCORING_CITATION,
} from './sea-crew-scoring.service';
import { SeaEtaService } from './sea-eta.service';
import { PortSlotService } from './port-slot.service';
import {
  WatchkeepingService,
  STCW_MIN_REST_MINUTES_24H,
  STCW_MAX_DUTY_MINUTES_24H,
  STCW_WATCHKEEPING_CITATION,
} from './watchkeeping.service';
import { SeawaysPdfReportService, VoyageMovementReportData } from '../reports/seaways-pdf-report.service';

describe('Phase 7C-2 Seaways Intelligence Services (Unit)', () => {
  describe('SeaCarbonService & GLEC Framework v3.2 §5.3 Container Ship Carbon Intelligence', () => {
    let carbonService: SeaCarbonService;
    const ROAD_FACTOR = 0.101; // Roadways Phase 5 factor (GLEC v3.0 Table 2.1)
    const RAIL_FACTOR = 0.0106; // Railways Phase 7A-2 factor (Smart Freight Centre / TCI-IIMB 2025)
    const AIR_LONG_HAUL_FACTOR = 0.608; // Airways Phase 7B-2 long-haul factor

    beforeEach(() => {
      carbonService = new SeaCarbonService();
    });

    it('1. A vessel with TEU capacity ≥ 8,000 selects the ULCV factor (0.0076)', () => {
      const selection = selectSeaCarbonFactor(10000);
      expect(selection.factor).toBe(0.0076);
      expect(selection.bucket).toBe('ulcv');
      expect(selection.note).toBeUndefined();

      const result = carbonService.calculateVoyageCarbon(1000, 50000, 12000);
      expect(result.emissionFactor).toBe(0.0076);
      expect(result.bucket).toBe('ulcv');
      expect(result.carbonKg).toBe(380000); // 1000 * 50000 * 0.0076 = 380,000 kg CO2e
    });

    it('2. A vessel with TEU capacity in the 3,000–7,999 range selects the panamax/neo-panamax factor (0.0091)', () => {
      const selection = selectSeaCarbonFactor(5000);
      expect(selection.factor).toBe(0.0091);
      expect(selection.bucket).toBe('panamax-neopanamax');
      expect(selection.note).toBeUndefined();

      // MV Ocean Titan Panamax: 2,808 km marine route, 45,000 tonnes payload, 5,000 TEU (65,000 DWT)
      const result = carbonService.calculateVoyageCarbon(2808, 45000, 5000);
      expect(result.emissionFactor).toBe(0.0091);
      expect(result.bucket).toBe('panamax-neopanamax');
      // Arithmetic: 2808 km * 45000 t * 0.0091 kg/t-km = 1,149,876 kg CO2e
      expect(result.carbonKg).toBe(1149876);
    });

    it('3. A vessel under 3,000 TEU selects the panamax/neo-panamax factor via documented fallback, and includes the fallback note', () => {
      const selection = selectSeaCarbonFactor(1500);
      expect(selection.factor).toBe(0.0091);
      expect(selection.bucket).toBe('panamax-neopanamax');
      expect(selection.note).toBeDefined();
      expect(selection.note).toContain('Sub-3,000 TEU feeder vessel has no dedicated GLEC v3.2 default');
      expect(selection.note).toContain('conservative fallback');

      const result = carbonService.calculateVoyageCarbon(1000, 10000, 1500);
      expect(result.emissionFactor).toBe(0.0091);
      expect(result.bucket).toBe('panamax-neopanamax');
      expect(result.carbonKg).toBe(91000); // 1000 * 10000 * 0.0091 = 91,000 kg CO2e
      expect(result.note).toContain('Sub-3,000 TEU feeder');
    });

    it('4. Directional sanity check: Ocean freight (0.0091 / 0.0076) is lower than Rail (0.0106), Road (0.101), and Air (0.608)', () => {
      const panamaxFactor = CONTAINER_SHIP_PANAMAX_NEOPANAMAX_KG_PER_TONNE_KM; // 0.0091
      const ulcvFactor = CONTAINER_SHIP_ULCV_KG_PER_TONNE_KM; // 0.0076

      // Recomputed percentages:
      // Panamax vs Rail: (0.0106 - 0.0091) / 0.0106 = 14.15% savings
      const panamaxRailSavings = ((RAIL_FACTOR - panamaxFactor) / RAIL_FACTOR) * 100;
      expect(panamaxRailSavings).toBeCloseTo(14.15, 1);

      // ULCV vs Rail: (0.0106 - 0.0076) / 0.0106 = 28.30% savings
      const ulcvRailSavings = ((RAIL_FACTOR - ulcvFactor) / RAIL_FACTOR) * 100;
      expect(ulcvRailSavings).toBeCloseTo(28.30, 1);

      // Both ocean container factors are lower than all other modes
      expect(panamaxFactor).toBeLessThan(RAIL_FACTOR); // 0.0091 < 0.0106
      expect(panamaxFactor).toBeLessThan(ROAD_FACTOR); // 0.0091 < 0.101 (~11.1x lower)
      expect(panamaxFactor).toBeLessThan(AIR_LONG_HAUL_FACTOR); // 0.0091 < 0.608 (~66.8x lower)

      expect(ulcvFactor).toBeLessThan(RAIL_FACTOR); // 0.0076 < 0.0106
      expect(ulcvFactor).toBeLessThan(ROAD_FACTOR); // 0.0076 < 0.101 (~13.3x lower)
      expect(ulcvFactor).toBeLessThan(AIR_LONG_HAUL_FACTOR); // 0.0076 < 0.608 (~80x lower)

      const result = carbonService.calculateVoyageCarbon(2808, 45000, 5000);
      expect(result.directionalCheckPassed).toBe(true);
      expect(result.savingsVsRailPercent).toBeCloseTo(14.2, 0);
      expect(result.savingsVsRoadPercent).toBeGreaterThan(90);
      expect(result.savingsVsAirPercent).toBeGreaterThan(98);
    });
  });

  describe('SeaCrewScoringService (Vessel Master Telemetry Scoring)', () => {
    let scoringService: SeaCrewScoringService;
    let mockSupabase: any;

    beforeEach(() => {
      const qb: any = {};
      qb.insert = jest.fn().mockImplementation((payload) => ({
        select: jest.fn().mockReturnValue({
          single: jest.fn().mockResolvedValue({
            data: {
              id: 'score-sea-1',
              ...payload,
              computed_at: new Date().toISOString(),
            },
            error: null,
          }),
        }),
      }));
      qb.upsert = jest.fn().mockImplementation((payload) => ({
        select: jest.fn().mockReturnValue({
          single: jest.fn().mockResolvedValue({
            data: {
              id: 'score-sea-1',
              ...payload,
              computed_at: new Date().toISOString(),
            },
            error: null,
          }),
        }),
      }));
      qb.select = jest.fn().mockReturnValue(qb);
      qb.eq = jest.fn().mockReturnValue(qb);
      qb.order = jest.fn().mockReturnValue(qb);
      qb.limit = jest.fn().mockResolvedValue({
        data: [],
        error: null,
      });

      mockSupabase = {
        adminClient: {
          from: jest.fn().mockReturnValue(qb),
        },
      };
      scoringService = new SeaCrewScoringService(mockSupabase);
    });

    it('returns perfect 100 for compliant voyage telemetry obeying heading and speed thresholds', async () => {
      const cleanTelemetry = [
        { lat: 18.95, lng: 72.85, heading: 180, speed_knots: 10, recorded_at: '2026-09-12T10:00:00Z' },
        { lat: 18.50, lng: 72.80, heading: 182, speed_knots: 18, recorded_at: '2026-09-12T10:10:00Z' },
        { lat: 18.00, lng: 72.75, heading: 183, speed_knots: 19, recorded_at: '2026-09-12T10:20:00Z' },
      ];

      const score = await scoringService.computeSeaCrewScore('vmov-1', 'crew-1', cleanTelemetry);
      expect(score.score).toBe(100);
      expect(score.harsh_maneuver_count).toBe(0);
      expect(score.overspeed_event_count).toBe(0);
    });

    it('detects harsh Rate-of-Turn (>20°/min per IMO Res A.526(13)) and deducts 10 pts per event', async () => {
      const abruptTelemetry = [
        { lat: 18.95, lng: 72.85, heading: 180, speed_knots: 16, recorded_at: '2026-09-12T10:00:00Z' },
        // In 60 seconds (1 min), heading changes 45 degrees -> 45°/min (>20°/min limit)
        { lat: 18.90, lng: 72.86, heading: 225, speed_knots: 16, recorded_at: '2026-09-12T10:01:00Z' },
      ];

      const score = await scoringService.computeSeaCrewScore('vmov-1', 'crew-1', abruptTelemetry);
      expect(score.harsh_maneuver_count).toBe(1);
      // Score: 100 - (10 * 1) = 90
      expect(score.score).toBe(90);
    });

    it('detects overspeeding (>24 kts open water / >12 kts harbor per COLREGs Rule 6) and deducts 5 pts per event', async () => {
      const overspeedTelemetry = [
        // Excessive speed in open water (27.5 knots > 24 knots threshold)
        { lat: 15.00, lng: 73.00, heading: 180, speed_knots: 27.5, recorded_at: '2026-09-12T10:00:00Z' },
        { lat: 14.50, lng: 73.10, heading: 180, speed_knots: 28.0, recorded_at: '2026-09-12T10:15:00Z' },
      ];

      const score = await scoringService.computeSeaCrewScore('vmov-1', 'crew-1', overspeedTelemetry);
      expect(score.overspeed_event_count).toBe(2);
      expect(score.harsh_maneuver_count).toBe(0);
      // Score: 100 - (5 * 2) = 90
      expect(score.score).toBe(90);
    });

    it('floors score at 0 for extreme violation counts', async () => {
      const extremeTelemetry: any[] = [];
      for (let i = 0; i < 15; i++) {
        extremeTelemetry.push({
          lat: 18.0 + i * 0.1,
          lng: 72.0 + i * 0.1,
          heading: (i * 60) % 360,
          speed_knots: 30, // overspeed
          recorded_at: new Date(Date.now() + i * 60000).toISOString(),
        });
      }

      const score = await scoringService.computeSeaCrewScore('vmov-1', 'crew-1', extremeTelemetry);
      expect(score.score).toBe(0);
    });
  });

  describe('SeaEtaService Historical vs Default Confidence Bands', () => {
    let etaService: SeaEtaService;

    it('uses default ±15% band when sample size is fewer than 3 completed movements on voyage_id', async () => {
      const mockMovement = {
        id: 'vmov-1',
        org_id: 'org-1',
        voyage_id: 'vy-1',
        duration_minutes: 3600,
        predicted_duration_minutes: 3600,
        distance_km: 1530,
        status: 'in_transit',
      };

      const mockSupabase: any = {
        adminClient: {
          from: jest.fn().mockImplementation((table) => {
            if (table === 'voyage_movements') {
              const qb: any = {};
              qb.select = jest.fn().mockReturnValue(qb);
              qb.eq = jest.fn().mockReturnValue(qb);
              qb.neq = jest.fn().mockResolvedValue({
                data: [{ actual_duration_minutes: 3500, duration_minutes: 3600, started_at: '2026-09-01T00:00:00Z', completed_at: '2026-09-03T11:00:00Z' }],
                error: null,
              });
              qb.single = jest.fn().mockResolvedValue({
                data: mockMovement,
                error: null,
              });
              return qb;
            }
          }),
        },
      };

      etaService = new SeaEtaService(mockSupabase);
      const eta = await etaService.calculateMovementEta('org-1', 'vmov-1');

      expect(eta.confidence_basis).toBe('default');
      expect(eta.sample_size).toBe(1);
      // Default ±15% on 3600 minutes -> min: 3060, max: 4140
      expect(eta.base_eta_minutes).toBe(3600);
      expect(eta.min_eta_minutes).toBe(3060);
      expect(eta.max_eta_minutes).toBe(4140);
      expect(eta.confidence_band_minutes).toBe(540);
    });

    it('uses historical mean and standard deviation band when ≥3 completed movements exist', async () => {
      const mockMovement = {
        id: 'vmov-1',
        org_id: 'org-1',
        voyage_id: 'vy-1',
        duration_minutes: 3600,
        predicted_duration_minutes: 3600,
        distance_km: 1530,
        status: 'in_transit',
      };

      const mockSupabase: any = {
        adminClient: {
          from: jest.fn().mockImplementation((table) => {
            if (table === 'voyage_movements') {
              const qb: any = {};
              qb.select = jest.fn().mockReturnValue(qb);
              qb.eq = jest.fn().mockReturnValue(qb);
              qb.neq = jest.fn().mockResolvedValue({
                data: [
                  { actual_duration_minutes: 3550, started_at: '2026-09-01T00:00:00Z', completed_at: '2026-09-03T11:00:00Z' },
                  { actual_duration_minutes: 3620, started_at: '2026-09-01T00:00:00Z', completed_at: '2026-09-03T12:00:00Z' },
                  { actual_duration_minutes: 3580, started_at: '2026-09-01T00:00:00Z', completed_at: '2026-09-03T11:30:00Z' },
                  { actual_duration_minutes: 3650, started_at: '2026-09-01T00:00:00Z', completed_at: '2026-09-03T12:30:00Z' },
                ],
                error: null,
              });
              qb.single = jest.fn().mockResolvedValue({
                data: mockMovement,
                error: null,
              });
              return qb;
            }
          }),
        },
      };

      etaService = new SeaEtaService(mockSupabase);
      const eta = await etaService.calculateMovementEta('org-1', 'vmov-1');

      expect(eta.confidence_basis).toBe('historical');
      expect(eta.sample_size).toBe(4);
      expect(eta.min_eta_minutes).toBeLessThan(eta.base_eta_minutes);
      expect(eta.max_eta_minutes).toBeGreaterThan(eta.base_eta_minutes);
    });
  });

  describe('PortSlotService Berth & Fairway Slot Intelligence', () => {
    let slotService: PortSlotService;

    it('approves departure and arrival slots when berth and fairway traffic is clear', async () => {
      const mockSupabase: any = {
        adminClient: {
          from: jest.fn().mockImplementation((table) => {
            if (table === 'voyage_movements') {
              const qb: any = {};
              qb.select = jest.fn().mockReturnValue(qb);
              qb.eq = jest.fn().mockReturnValue(qb);
              qb.in = jest.fn().mockResolvedValue({
                data: [],
                error: null,
              });
              return qb;
            }
          }),
        },
      };

      slotService = new PortSlotService(mockSupabase);
      const result = await slotService.checkPortSlots(
        'org-1',
        'port-mumbai',
        'port-chennai',
        new Date().toISOString(),
      );

      expect(result.congested).toBe(false);
      expect(result.originSlotCount).toBe(0);
      expect(result.destinationSlotCount).toBe(0);
      expect(result.reason).toBeUndefined();
    });

    it('flags congestion and recommends alternative slot when berth window has concurrent vessels exceeding threshold', async () => {
      const now = new Date();
      const mockSupabase: any = {
        adminClient: {
          from: jest.fn().mockImplementation((table) => {
            if (table === 'voyage_movements') {
              const qb: any = {};
              qb.select = jest.fn().mockReturnValue(qb);
              qb.eq = jest.fn().mockReturnValue(qb);
              qb.in = jest.fn().mockResolvedValue({
                data: [
                  {
                    id: 'vm-1',
                    started_at: new Date(now.getTime() + 10 * 60000).toISOString(),
                    voyage: { origin_port_id: 'port-mumbai', destination_port_id: 'port-chennai' },
                  },
                  {
                    id: 'vm-2',
                    started_at: new Date(now.getTime() - 20 * 60000).toISOString(),
                    voyage: { origin_port_id: 'port-mumbai', destination_port_id: 'port-cochin' },
                  },
                ],
                error: null,
              });
              return qb;
            }
          }),
        },
      };

      slotService = new PortSlotService(mockSupabase);
      const result = await slotService.checkPortSlots(
        'org-1',
        'port-mumbai',
        'port-chennai',
        now.toISOString(),
        180,
        2, // threshold 2
      );

      expect(result.congested).toBe(true);
      expect(result.originSlotCount).toBe(2);
      expect(result.reason).toContain('Origin Port berth allocation window');
      expect(result.suggestedDeparture).toBeDefined();
    });
  });

  describe('WatchkeepingService (IMO STCW Regulation VIII/1 Rest-Hour Compliance)', () => {
    let watchkeepingService: WatchkeepingService;
    let mockSupabase: any;
    let mockNotifications: any;

    beforeEach(() => {
      mockNotifications = {
        createNotification: jest.fn().mockResolvedValue(true),
      };
    });

    it('approves compliant duty when master rest hours satisfy minimum 10 hours / 600 min in 24h window', async () => {
      const now = new Date();
      mockSupabase = {
        adminClient: {
          from: jest.fn().mockImplementation((table) => {
            const qb: any = {};
            qb.select = jest.fn().mockReturnValue(qb);
            qb.eq = jest.fn().mockReturnValue(qb);
            qb.gte = jest.fn().mockResolvedValue({
              data: [
                { duty_minutes: 300, rest_minutes: 400, window_started_at: new Date(now.getTime() - 12 * 3600000).toISOString() },
              ],
              error: null,
            });
            qb.insert = jest.fn().mockImplementation((payload) => ({
              select: jest.fn().mockReturnValue({
                single: jest.fn().mockResolvedValue({
                  data: { id: 'wk-log-1', ...payload },
                  error: null,
                }),
              }),
            }));
            return qb;
          }),
        },
      };

      watchkeepingService = new WatchkeepingService(mockSupabase, mockNotifications);
      const result = await watchkeepingService.recordWatchkeepingDuty(
        'org-1',
        'vmov-1',
        'crew-master-1',
        360, // 6 hours duty
        new Date(now.getTime() - 6 * 3600000),
        now,
      );

      expect(result.watchkeepingLog.violation).toBe(false);
      expect(result.totalRollingDutyMinutes).toBe(660); // 300 + 360 = 660 min <= 840 min (14h)
      expect(result.violation).toBe(false);
      expect(mockNotifications.createNotification).not.toHaveBeenCalled();
    });

    it('detects STCW rest-hour violation (>14h duty / <10h rest in 24h rolling window) and raises alert', async () => {
      const now = new Date();
      mockSupabase = {
        adminClient: {
          from: jest.fn().mockImplementation((table) => {
            const qb: any = {};
            qb.select = jest.fn().mockReturnValue(qb);
            qb.eq = jest.fn().mockReturnValue(qb);
            qb.gte = jest.fn().mockResolvedValue({
              data: [
                { duty_minutes: 720, rest_minutes: 300, window_started_at: new Date(now.getTime() - 15 * 3600000).toISOString() },
              ],
              error: null,
            });
            qb.insert = jest.fn().mockImplementation((payload) => ({
              select: jest.fn().mockReturnValue({
                single: jest.fn().mockResolvedValue({
                  data: { id: 'wk-log-1', ...payload },
                  error: null,
                }),
              }),
            }));
            return qb;
          }),
        },
      };

      watchkeepingService = new WatchkeepingService(mockSupabase, mockNotifications);
      const result = await watchkeepingService.recordWatchkeepingDuty(
        'org-1',
        'vmov-1',
        'crew-master-1',
        200, // 720 + 200 = 920 min duty (>840 min max -> <600 min rest)
        new Date(now.getTime() - 3.5 * 3600000),
        now,
      );

      expect(result.watchkeepingLog.violation).toBe(true);
      expect(result.totalRollingDutyMinutes).toBe(920);
      expect(result.violation).toBe(true);
      expect(mockNotifications.createNotification).toHaveBeenCalled();
    });
  });

  describe('SeawaysPdfReportService Real Binary PDF Generation & Verification', () => {
    let pdfService: SeawaysPdfReportService;
    let mockSupabase: any;
    let mockNotifications: any;

    beforeEach(() => {
      const sampleMovement = {
        id: 'vmov-1',
        org_id: 'org-1',
        voyage_id: 'vy-1',
        vessel_id: 'vessel-1',
        crew_id: 'crew-1',
        origin_port_id: 'port-1',
        destination_port_id: 'port-2',
        distance_km: 1530,
        duration_minutes: 3600,
        predicted_duration_minutes: 3600,
        actual_duration_minutes: 3540,
        carbon_kg: 578340,
        status: 'completed',
        completed_at: new Date().toISOString(),
        voyage: { voyage_number: 'VY-901' },
        vessel: { name: 'MV Ocean Titan', imo_number: 'IMO9234567', vessel_type: 'Container Ship', dwt_tonnes: 65000 },
        crew: {
          master_license: 'M-STCW-991',
          user: { full_name: 'Capt. Rajiv Sharma' },
        },
        origin_port: { name: 'Jawaharlal Nehru Port', code: 'INNSA', lat: 18.95, lng: 72.95 },
        destination_port: { name: 'Chennai Port', code: 'INMAA', lat: 13.08, lng: 80.30 },
      };

      const sampleReport = {
        id: 'report-sea-1',
        org_id: 'org-1',
        movement_id: 'vmov-1',
        storage_path: 'org_org-1/voyage_vmov-1_12345.pdf',
        file_size_bytes: 9800,
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

            if (table === 'voyage_movements') {
              chain.maybeSingle = jest.fn().mockResolvedValue({ data: sampleMovement, error: null });
              chain.single = jest.fn().mockResolvedValue({ data: sampleMovement, error: null });
            } else if (table === 'voyage_movement_reports') {
              chain.maybeSingle = jest.fn().mockResolvedValue({ data: sampleReport, error: null });
              chain.single = jest.fn().mockResolvedValue({ data: sampleReport, error: null });
            } else if (table === 'sea_crew_scores') {
              chain.maybeSingle = jest.fn().mockResolvedValue({
                data: { score: 95, harsh_maneuver_count: 0, overspeed_event_count: 1 },
                error: null,
              });
            } else if (table === 'watchkeeping_logs') {
              chain.maybeSingle = jest.fn().mockResolvedValue({
                data: { duty_minutes: 600, rest_minutes: 840, violation: false },
                error: null,
              });
            } else {
              chain.maybeSingle = jest.fn().mockResolvedValue({ data: null, error: null });
              chain.single = jest.fn().mockResolvedValue({ data: null, error: null });
              chain.limit = jest.fn().mockResolvedValue({ data: [], error: null });
            }

            return chain;
          }),
          storage: {
            from: jest.fn().mockReturnValue({
              upload: jest.fn().mockResolvedValue({ data: { path: 'seaways/org-1/vmov-1.pdf' }, error: null }),
              createSignedUrl: jest.fn().mockResolvedValue({
                data: { signedUrl: 'https://storage.supabase.co/seaways/org-1/vmov-1.pdf?token=valid' },
                error: null,
              }),
            }),
          },
        },
      };

      mockNotifications = {
        createNotification: jest.fn().mockResolvedValue(true),
      };

      pdfService = new SeawaysPdfReportService(mockSupabase, mockNotifications);
    });

    it('generates a valid, pure JS binary PDF with correct "%PDF-" magic bytes', async () => {
      const reportData: VoyageMovementReportData = {
        movementId: 'vmov-test-101',
        orgId: 'org-test',
        voyageNumber: 'VY-901',
        vesselName: 'MV Ocean Titan',
        imoNumber: 'IMO9234567',
        vesselType: 'Container Ship',
        dwtTonnes: 65000,
        masterName: 'Capt. Rajiv Sharma',
        masterCertificate: 'M-STCW-991',
        originPortName: 'Jawaharlal Nehru Port',
        originUnlocode: 'INNSA',
        originLat: 18.95,
        originLng: 72.95,
        destPortName: 'Chennai Port',
        destUnlocode: 'INMAA',
        destLat: 13.08,
        destLng: 80.30,
        completedAt: new Date().toISOString(),
        predictedDurationMinutes: 3600,
        actualDurationMinutes: 3540,
        distanceKm: 1530,
        avgSpeedKnots: 16.5,
        etaConfidenceBasis: 'historical',
        etaConfidenceBandMinutes: 90,
        etaSampleSize: 5,
        crewScore: 95,
        harshManeuverCount: 0,
        overspeedEventCount: 1,
        carbonKg: 1149876,
        dwtBucket: 'Panamax / Neo-Panamax (3,000–8,000 TEU)',
        emissionFactor: 0.0091,
        cargoTonnes: 45000,
        slotCongestionStatus: 'Port Berth & Fairway Slots Approved',
        watchkeepingStatus: 'STCW Rest-Hour Compliant',
        watchkeepingDutyMinutes: 600,
        watchkeepingViolation: false,
      };

      const pdfBuffer = await pdfService.buildVoyageMovementPdfBuffer(reportData);

      expect(Buffer.isBuffer(pdfBuffer)).toBe(true);
      expect(pdfBuffer.length).toBeGreaterThan(1000);

      // Verify %PDF- magic bytes
      const header = pdfBuffer.slice(0, 5).toString('ascii');
      expect(header).toBe('%PDF-');
    });

    it('generates and stores report row in Supabase and issues notification', async () => {
      const result = await pdfService.generateAndStoreMovementReport('org-1', 'vmov-1');

      expect(result.storagePath).toContain('org_org-1/voyage_vmov-1_');
      expect(result.fileSizeBytes).toBeGreaterThan(1000);
      expect(mockNotifications.createNotification).toHaveBeenCalled();
    });

    it('returns signed URL for completed voyage movement report', async () => {
      const result = await pdfService.getSignedReportUrl('org-1', 'vmov-1');

      expect(result.movementId).toBe('vmov-1');
      expect(result.signedUrl).toContain('https://');
      expect(result.storagePath).toContain('org_org-1/voyage_vmov-1_');
    });
  });
});
