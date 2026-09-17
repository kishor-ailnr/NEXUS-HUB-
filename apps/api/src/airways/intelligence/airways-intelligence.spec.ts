import {
  AirCarbonService,
  AIR_FREIGHT_CARBON_SHORT_HAUL_KG_PER_TONNE_KM,
  AIR_FREIGHT_CARBON_LONG_HAUL_KG_PER_TONNE_KM,
  AIR_FREIGHT_HAUL_THRESHOLD_KM,
  AIR_CARBON_CITATION,
  selectAirCarbonFactor,
  selectAirHaulCategory,
} from './air-carbon.service';
import {
  CrewFlightScoringService,
  ICAO_OVERSPEED_BELOW_10K_KTS,
  AIRWAYS_ABRUPT_VS_FPM,
  AIRWAYS_CREW_SCORING_CITATION,
} from './crew-flight-scoring.service';
import { FlightEtaService } from './flight-eta.service';
import { AirportSlotService } from './airport-slot.service';
import {
  FlightDutyService,
  DGCA_MAX_FDP_MINUTES_24H,
  DGCA_FDTL_CITATION,
} from './flight-duty.service';
import { FlightPdfReportService, FlightMovementReportData } from '../reports/flight-pdf-report.service';

describe('Phase 7B-2 Airways Intelligence Services (Unit)', () => {
  describe('AirCarbonService & Directional Sanity Check (GLEC Framework v3.2)', () => {
    let carbonService: AirCarbonService;
    const ROAD_FACTOR = 0.101; // Roadways Phase 5 factor (GLEC v3.0 Table 2.1)
    const RAIL_FACTOR = 0.0106; // Railways Phase 7A-2 factor (Smart Freight Centre / TCI-IIMB 2025)

    beforeEach(() => {
      carbonService = new AirCarbonService();
    });

    it('selects short-haul factor (1.516 kg CO2e / tonne-km) for flights under 1,500 km (e.g. BOM -> DEL 1,137 km)', () => {
      const distanceKm = 1137.05; // BOM -> DEL Great-Circle distance
      const cargoTonnes = 42.5; // Dedicated B777F cargo load

      const result = carbonService.calculateFlightCarbon(distanceKm, cargoTonnes);

      expect(result.haulCategory).toBe('short');
      expect(result.emissionFactor).toBe(1.516);
      expect(result.distanceKm).toBe(1137.05);
      expect(result.cargoTonnes).toBe(42.5);

      // Arithmetic: 1137.05 * 42.5 * 1.516 = 73,260.126 -> 73,260.13 kg CO2e
      const expectedCarbon = Math.round(1137.05 * 42.5 * 1.516 * 100) / 100;
      expect(result.carbonKg).toBe(expectedCarbon);
      expect(result.carbonKg).toBe(73260.13);
      expect(result.citation).toContain('Short-Haul <1,500 km: 1.516');
    });

    it('selects long-haul factor (0.608 kg CO2e / tonne-km) for flights over 1,500 km (e.g. 2,500 km international freighter)', () => {
      const distanceKm = 2500;
      const cargoTonnes = 40;

      const result = carbonService.calculateFlightCarbon(distanceKm, cargoTonnes);

      expect(result.haulCategory).toBe('long');
      expect(result.emissionFactor).toBe(0.608);
      expect(result.distanceKm).toBe(2500);
      expect(result.cargoTonnes).toBe(40);

      // Arithmetic: 2500 * 40 * 0.608 = 60,800 kg CO2e
      expect(result.carbonKg).toBe(60800);
      expect(result.citation).toContain('Long-Haul ≥1,500 km: 0.608');
    });

    it('evaluates exact boundary condition at 1,500 km: strictly < 1500 km is short-haul, >= 1500 km is long-haul', () => {
      // Just below boundary: 1499.9 km -> short-haul (1.516)
      const justBelow = carbonService.calculateFlightCarbon(1499.9, 10);
      expect(justBelow.haulCategory).toBe('short');
      expect(justBelow.emissionFactor).toBe(1.516);

      // Exactly at boundary: 1500.0 km -> long-haul (0.608)
      const exactlyAt = carbonService.calculateFlightCarbon(1500, 10);
      expect(exactlyAt.haulCategory).toBe('long');
      expect(exactlyAt.emissionFactor).toBe(0.608);

      // Just above boundary: 1500.1 km -> long-haul (0.608)
      const justAbove = carbonService.calculateFlightCarbon(1500.1, 10);
      expect(justAbove.haulCategory).toBe('long');
      expect(justAbove.emissionFactor).toBe(0.608);

      // Direct helper function assertions
      expect(selectAirCarbonFactor(1499)).toBe(AIR_FREIGHT_CARBON_SHORT_HAUL_KG_PER_TONNE_KM);
      expect(selectAirCarbonFactor(1500)).toBe(AIR_FREIGHT_CARBON_LONG_HAUL_KG_PER_TONNE_KM);
      expect(selectAirHaulCategory(1499)).toBe('short');
      expect(selectAirHaulCategory(1500)).toBe('long');
    });

    it('satisfies inverted directional sanity check for BOTH short-haul and long-haul buckets vs Road and Rail', () => {
      // 1. Short-Haul Bucket (1.516 kg CO2e/t-km)
      expect(AIR_FREIGHT_CARBON_SHORT_HAUL_KG_PER_TONNE_KM).toBeGreaterThan(ROAD_FACTOR);
      expect(AIR_FREIGHT_CARBON_SHORT_HAUL_KG_PER_TONNE_KM).toBeGreaterThan(RAIL_FACTOR);

      const shortHaulResult = carbonService.calculateFlightCarbon(1000, 20);
      expect(shortHaulResult.directionalCheckPassed).toBe(true);
      // Multiplier vs Road (0.101): 1.516 / 0.101 = 15.01x (1,401% higher)
      expect(shortHaulResult.multiplierVsRoad).toBe(15.0);
      // Multiplier vs Rail (0.0106): 1.516 / 0.0106 = 143.02x (14,202% higher)
      expect(shortHaulResult.multiplierVsRail).toBe(143.0);

      // 2. Long-Haul Bucket (0.608 kg CO2e/t-km)
      expect(AIR_FREIGHT_CARBON_LONG_HAUL_KG_PER_TONNE_KM).toBeGreaterThan(ROAD_FACTOR);
      expect(AIR_FREIGHT_CARBON_LONG_HAUL_KG_PER_TONNE_KM).toBeGreaterThan(RAIL_FACTOR);

      const longHaulResult = carbonService.calculateFlightCarbon(2000, 20);
      expect(longHaulResult.directionalCheckPassed).toBe(true);
      // Multiplier vs Road (0.101): 0.608 / 0.101 = 6.02x (502% higher)
      expect(longHaulResult.multiplierVsRoad).toBe(6.0);
      // Multiplier vs Rail (0.0106): 0.608 / 0.0106 = 57.36x (5,636% higher)
      expect(longHaulResult.multiplierVsRail).toBe(57.4);
    });
  });

  describe('CrewFlightScoringService (Pilot Telemetry Scoring)', () => {
    let scoringService: CrewFlightScoringService;
    let mockSupabase: any;

    beforeEach(() => {
      const qb: any = {};
      qb.insert = jest.fn().mockImplementation((payload) => ({
        select: jest.fn().mockReturnValue({
          single: jest.fn().mockResolvedValue({
            data: {
              id: 'score-air-1',
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
              id: 'score-air-1',
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
      scoringService = new CrewFlightScoringService(mockSupabase);
    });

    it('returns perfect 100 for clean flight movement obeying speed and vertical rate limits', async () => {
      const cleanTelemetry = [
        { lat: 19.0, lng: 72.8, altitude_ft: 1500, speed_kts: 220, recorded_at: '2026-09-12T10:00:00Z' },
        { lat: 19.5, lng: 73.5, altitude_ft: 12000, speed_kts: 320, recorded_at: '2026-09-12T10:05:00Z' },
        { lat: 21.0, lng: 75.0, altitude_ft: 36000, speed_kts: 460, recorded_at: '2026-09-12T10:20:00Z' },
      ];

      const score = await scoringService.computeFlightCrewScore('mov-1', 'pilot-1', cleanTelemetry);
      expect(score.score).toBe(100);
      expect(score.abrupt_maneuver_count).toBe(0);
      expect(score.overspeed_event_count).toBe(0);
    });

    it('detects overspeeding below 10,000 ft (>250 kts IAS per ICAO Annex 2 / DGCA CAR Sec 9) and deducts 5 pts per event', async () => {
      const overspeedTelemetry = [
        // Low altitude takeoff (2,500 ft) exceeding 250 kts limit (285 kts) -> event 1
        { lat: 19.0, lng: 72.8, altitude_ft: 2500, speed_kts: 285, recorded_at: '2026-09-12T10:00:00Z' },
        // Low altitude climb (8,000 ft) exceeding 250 kts limit (290 kts) -> event 2
        { lat: 19.5, lng: 73.5, altitude_ft: 8000, speed_kts: 290, recorded_at: '2026-09-12T10:05:00Z' },
        // High altitude cruise (36,000 ft) at 470 kts -> valid cruise speed
        { lat: 21.0, lng: 75.0, altitude_ft: 36000, speed_kts: 470, recorded_at: '2026-09-12T10:20:00Z' },
      ];

      const score = await scoringService.computeFlightCrewScore('mov-1', 'pilot-1', overspeedTelemetry);
      expect(score.overspeed_event_count).toBe(2);
      expect(score.abrupt_maneuver_count).toBe(0);
      // Score: 100 - (5 * 2) = 90
      expect(score.score).toBe(90);
    });

    it('detects abrupt maneuvers (>3000 fpm vertical rate or >50 kts delta) and deducts 10 pts per event', async () => {
      const abruptTelemetry = [
        { lat: 19.0, lng: 72.8, altitude_ft: 10000, speed_kts: 300, recorded_at: '2026-09-12T10:00:00Z' },
        // In 10 seconds, climbs 8,000 ft -> 48,000 fpm (>3,000 fpm threshold)
        { lat: 19.1, lng: 72.9, altitude_ft: 18000, speed_kts: 300, recorded_at: '2026-09-12T10:00:10Z' },
      ];

      const score = await scoringService.computeFlightCrewScore('mov-1', 'pilot-1', abruptTelemetry);
      expect(score.abrupt_maneuver_count).toBe(1);
      // Score: 100 - (10 * 1) = 90
      expect(score.score).toBe(90);
    });
  });

  describe('FlightEtaService Historical vs Default Bands', () => {
    let etaService: FlightEtaService;

    it('uses default ±15% band when sample size is fewer than 3 completed flights on flight_id', async () => {
      const mockMovement = {
        id: 'fmov-1',
        org_id: 'org-1',
        flight_id: 'fl-1',
        duration_minutes: 135,
        predicted_duration_minutes: 135,
        distance_km: 1150,
        status: 'in_transit',
        flight: {
          origin_airport: { lat: 28.5562, lng: 77.1000 },
          destination_airport: { lat: 19.0896, lng: 72.8656 },
        },
      };

      const mockSupabase: any = {
        adminClient: {
          from: jest.fn().mockImplementation((table) => {
            if (table === 'flight_movements') {
              const qb: any = {};
              qb.select = jest.fn().mockReturnValue(qb);
              qb.eq = jest.fn().mockReturnValue(qb);
              qb.neq = jest.fn().mockResolvedValue({
                data: [{ actual_duration_minutes: 120, predicted_duration_minutes: 120 }],
                error: null,
              });
              qb.single = jest.fn().mockResolvedValue({
                data: mockMovement,
                error: null,
              });
              qb.maybeSingle = jest.fn().mockResolvedValue({
                data: mockMovement,
                error: null,
              });
              return qb;
            }
            if (table === 'flight_telemetry') {
              const qb: any = {};
              qb.select = jest.fn().mockReturnValue(qb);
              qb.eq = jest.fn().mockReturnValue(qb);
              qb.order = jest.fn().mockReturnValue(qb);
              qb.limit = jest.fn().mockReturnValue(qb);
              qb.single = jest.fn().mockResolvedValue({
                data: { lat: 25.0, lng: 75.0, speed_kts: 450 },
                error: null,
              });
              qb.maybeSingle = jest.fn().mockResolvedValue({
                data: { lat: 25.0, lng: 75.0, speed_kts: 450 },
                error: null,
              });
              return qb;
            }
          }),
        },
      };

      etaService = new FlightEtaService(mockSupabase);
      const eta = await etaService.calculateMovementEta('org-1', 'fmov-1');

      expect(eta.confidence_basis).toBe('default');
      expect(eta.sample_size).toBe(1);
      expect(eta.confidence_band_minutes).toBe(Math.round(eta.base_eta_minutes * 0.15));
    });

    it('computes historical sample standard deviation band when >=3 completed movements exist on flight_id directly', async () => {
      const mockMovement = {
        id: 'fmov-1',
        org_id: 'org-1',
        flight_id: 'fl-1',
        duration_minutes: 135,
        predicted_duration_minutes: 135,
        distance_km: 1150,
        status: 'in_transit',
        flight: {
          origin_airport: { lat: 28.5562, lng: 77.1000 },
          destination_airport: { lat: 19.0896, lng: 72.8656 },
        },
      };

      const mockSupabase: any = {
        adminClient: {
          from: jest.fn().mockImplementation((table) => {
            if (table === 'flight_movements') {
              const qb: any = {};
              qb.select = jest.fn().mockReturnValue(qb);
              qb.eq = jest.fn().mockReturnValue(qb);
              qb.neq = jest.fn().mockResolvedValue({
                data: [
                  { actual_duration_minutes: 140, predicted_duration_minutes: 135 }, // dev: +5
                  { actual_duration_minutes: 130, predicted_duration_minutes: 135 }, // dev: -5
                  { actual_duration_minutes: 138, predicted_duration_minutes: 135 }, // dev: +3
                  { actual_duration_minutes: 135, predicted_duration_minutes: 135 }, // dev: 0
                ],
                error: null,
              });
              qb.single = jest.fn().mockResolvedValue({
                data: mockMovement,
                error: null,
              });
              qb.maybeSingle = jest.fn().mockResolvedValue({
                data: mockMovement,
                error: null,
              });
              return qb;
            }
            if (table === 'flight_telemetry') {
              const qb: any = {};
              qb.select = jest.fn().mockReturnValue(qb);
              qb.eq = jest.fn().mockReturnValue(qb);
              qb.order = jest.fn().mockReturnValue(qb);
              qb.limit = jest.fn().mockReturnValue(qb);
              qb.single = jest.fn().mockResolvedValue({
                data: { lat: 25.0, lng: 75.0, speed_kts: 450 },
                error: null,
              });
              qb.maybeSingle = jest.fn().mockResolvedValue({
                data: { lat: 25.0, lng: 75.0, speed_kts: 450 },
                error: null,
              });
              return qb;
            }
          }),
        },
      };

      etaService = new FlightEtaService(mockSupabase);
      const eta = await etaService.calculateMovementEta('org-1', 'fmov-1');

      expect(eta.confidence_basis).toBe('historical');
      expect(eta.sample_size).toBe(4);
      expect(eta.confidence_band_minutes).toBeGreaterThan(0);
      expect(eta.min_eta_minutes).toBe(eta.base_eta_minutes - eta.confidence_band_minutes);
      expect(eta.max_eta_minutes).toBe(eta.base_eta_minutes + eta.confidence_band_minutes);
    });
  });

  describe('AirportSlotService (Per-Airport Capacity)', () => {
    let slotService: AirportSlotService;

    it('detects per-airport slot congestion when departure or arrival airport traffic exceeds threshold in ±60m window', async () => {
      const now = new Date();
      const mockSupabase: any = {
        adminClient: {
          from: jest.fn().mockImplementation((table) => {
            if (table === 'flight_movements') {
              const qb: any = {};
              qb.select = jest.fn().mockReturnValue(qb);
              qb.eq = jest.fn().mockReturnValue(qb);
              qb.in = jest.fn().mockResolvedValue({
                data: [
                  {
                    id: 'fmov-del-1',
                    flight: { origin_airport_id: 'ap-delhi', destination_airport_id: 'ap-mumbai' },
                    started_at: new Date(now.getTime() - 20 * 60000).toISOString(),
                  },
                  {
                    id: 'fmov-del-2',
                    flight: { origin_airport_id: 'ap-delhi', destination_airport_id: 'ap-bengaluru' },
                    created_at: new Date(now.getTime() + 15 * 60000).toISOString(),
                  },
                  {
                    id: 'fmov-del-3',
                    flight: { origin_airport_id: 'ap-kolkata', destination_airport_id: 'ap-delhi' },
                    created_at: new Date(now.getTime() + 30 * 60000).toISOString(),
                  },
                ],
                error: null,
              });
              return qb;
            }
          }),
        },
      };

      slotService = new AirportSlotService(mockSupabase);
      const result = await slotService.checkAirportSlots(
        'org-1',
        'ap-delhi',
        'ap-mumbai',
        now.toISOString(),
        60, // 60 min duration
        2, // threshold = 2
      );

      expect(result.congested).toBe(true);
      expect(result.departureSlotCount).toBe(3);
      expect(result.suggestedDeparture).toBeDefined();
      expect(result.reason).toContain('Departure Airport slot window has 3 scheduled operations');
    });

    it('approves departure and arrival slots when airport runway/apron traffic is below threshold', async () => {
      const mockSupabase: any = {
        adminClient: {
          from: jest.fn().mockImplementation((table) => {
            if (table === 'flight_movements') {
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

      slotService = new AirportSlotService(mockSupabase);
      const result = await slotService.checkAirportSlots(
        'org-1',
        'ap-delhi',
        'ap-mumbai',
        new Date().toISOString(),
      );

      expect(result.congested).toBe(false);
      expect(result.departureSlotCount).toBe(0);
      expect(result.arrivalSlotCount).toBe(0);
      expect(result.reason).toBeUndefined();
    });
  });

  describe('FlightDutyService (DGCA FDTL Compliance)', () => {
    let dutyService: FlightDutyService;
    let mockSupabase: any;
    let mockAlerts: any;
    let mockNotifications: any;

    beforeEach(() => {
      mockAlerts = {
        createAlert: jest.fn().mockResolvedValue(true),
      };
      mockNotifications = {
        createNotification: jest.fn().mockResolvedValue(true),
      };
    });

    it('approves compliant duty when pilot total 24h duty is within 780 minutes limit', async () => {
      const now = new Date();
      mockSupabase = {
        adminClient: {
          from: jest.fn().mockImplementation((table) => {
            const qb: any = {};
            qb.select = jest.fn().mockReturnValue(qb);
            qb.eq = jest.fn().mockReturnValue(qb);
            qb.gte = jest.fn().mockResolvedValue({
              data: [
                { duty_minutes: 240, window_started_at: new Date(now.getTime() - 6 * 3600000).toISOString() },
              ],
              error: null,
            });
            qb.insert = jest.fn().mockImplementation((payload) => ({
              select: jest.fn().mockReturnValue({
                single: jest.fn().mockResolvedValue({
                  data: { id: 'duty-log-1', ...payload },
                  error: null,
                }),
              }),
            }));
            return qb;
          }),
        },
      };

      dutyService = new FlightDutyService(mockSupabase, mockNotifications);
      const result = await dutyService.recordFlightDuty(
        'org-1',
        'mov-1',
        'pilot-1',
        180, // 3 hours
        new Date(now.getTime() - 3 * 3600000),
        now,
      );

      expect(result.dutyLog.violation).toBe(false);
      expect(result.totalRollingDutyMinutes).toBe(420); // 240 + 180 = 420 <= 780
      expect(mockNotifications.createNotification).not.toHaveBeenCalled();
    });

    it('detects FDTL violation (>780 min / 13h FDP in 24h window) and raises critical alert', async () => {
      const now = new Date();
      mockSupabase = {
        adminClient: {
          from: jest.fn().mockImplementation((table) => {
            const qb: any = {};
            qb.select = jest.fn().mockReturnValue(qb);
            qb.eq = jest.fn().mockReturnValue(qb);
            qb.gte = jest.fn().mockResolvedValue({
              data: [
                { duty_minutes: 650, window_started_at: new Date(now.getTime() - 10 * 3600000).toISOString() },
              ],
              error: null,
            });
            qb.insert = jest.fn().mockImplementation((payload) => ({
              select: jest.fn().mockReturnValue({
                single: jest.fn().mockResolvedValue({
                  data: { id: 'duty-log-1', ...payload },
                  error: null,
                }),
              }),
            }));
            return qb;
          }),
        },
      };

      dutyService = new FlightDutyService(mockSupabase, mockNotifications);
      const result = await dutyService.recordFlightDuty(
        'org-1',
        'mov-1',
        'pilot-1',
        150, // 650 + 150 = 800 > 780 limit
        new Date(now.getTime() - 2.5 * 3600000),
        now,
      );

      expect(result.dutyLog.violation).toBe(true);
      expect(result.totalRollingDutyMinutes).toBe(800);
      expect(mockNotifications.createNotification).toHaveBeenCalled();
    });
  });

  describe('FlightPdfReportService Real PDF Verification', () => {
    let pdfService: FlightPdfReportService;
    let mockSupabase: any;
    let mockNotifications: any;

    beforeEach(() => {
      const sampleMovement = {
        id: 'fmov-1',
        org_id: 'org-1',
        flight_id: 'fl-1',
        aircraft_id: 'ac-1',
        pilot_id: 'pilot-1',
        origin_airport_id: 'ap-1',
        destination_airport_id: 'ap-2',
        distance_km: 1148,
        duration_minutes: 135,
        predicted_duration_minutes: 135,
        actual_duration_minutes: 130,
        carbon_kg: 27643.84,
        status: 'completed',
        completed_at: new Date().toISOString(),
        flight: { flight_number: 'AI-701' },
        aircraft: { tail_number: 'VT-NWX', model: 'Boeing 777F', aircraft_type: 'Freighter' },
        pilot: {
          license_number: 'ATPL-IND-1001',
          user: { full_name: 'Capt. Vikram Batra' },
        },
        origin_airport: { name: 'Indira Gandhi Intl Airport', iata_code: 'DEL', lat: 28.5562, lng: 77.1000 },
        destination_airport: { name: 'Chhatrapati Shivaji Maharaj Intl Airport', iata_code: 'BOM', lat: 19.0896, lng: 72.8656 },
      };

      const sampleReport = {
        id: 'report-air-1',
        org_id: 'org-1',
        movement_id: 'fmov-1',
        storage_path: 'airways/org-1/fmov-1.pdf',
        file_size_bytes: 9200,
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

            if (table === 'flight_movements') {
              chain.maybeSingle = jest.fn().mockResolvedValue({ data: sampleMovement, error: null });
              chain.single = jest.fn().mockResolvedValue({ data: sampleMovement, error: null });
            } else if (table === 'flight_movement_reports') {
              chain.maybeSingle = jest.fn().mockResolvedValue({ data: sampleReport, error: null });
              chain.single = jest.fn().mockResolvedValue({ data: sampleReport, error: null });
            } else if (table === 'crew_flight_scores') {
              chain.maybeSingle = jest.fn().mockResolvedValue({
                data: { score: 95, abrupt_maneuver_count: 0, overspeed_event_count: 1 },
                error: null,
              });
            } else if (table === 'flight_duty_logs') {
              chain.maybeSingle = jest.fn().mockResolvedValue({
                data: { duty_minutes: 130, violation: false },
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
              upload: jest.fn().mockResolvedValue({ data: { path: 'airways/org-1/fmov-1.pdf' }, error: null }),
              createSignedUrl: jest.fn().mockResolvedValue({
                data: { signedUrl: 'https://storage.supabase.co/airways/org-1/fmov-1.pdf?token=valid' },
                error: null,
              }),
            }),
          },
        },
      };

      mockNotifications = {
        createNotification: jest.fn().mockResolvedValue(true),
      };

      pdfService = new FlightPdfReportService(mockSupabase, mockNotifications);
    });

    it('generates a valid, pure JS binary PDF with correct "%PDF-" magic bytes', async () => {
      const reportData: FlightMovementReportData = {
        movementId: 'fmov-test-101',
        orgId: 'org-test',
        flightNumber: 'AI-701',
        tailNumber: 'VT-NWX',
        aircraftModel: 'Boeing 777F',
        pilotName: 'Capt. Vikram Batra',
        pilotLicense: 'ATPL-IND-1001',
        originAirportName: 'Indira Gandhi Intl Airport',
        originIataCode: 'DEL',
        originLat: 28.5562,
        originLng: 77.1000,
        destAirportName: 'Chhatrapati Shivaji Maharaj Intl Airport',
        destIataCode: 'BOM',
        destLat: 19.0896,
        destLng: 72.8656,
        completedAt: new Date().toISOString(),
        predictedDurationMinutes: 135,
        actualDurationMinutes: 130,
        distanceKm: 1148,
        avgSpeedKts: 450,
        etaConfidenceBasis: 'historical',
        etaConfidenceBandMinutes: 10,
        etaSampleSize: 4,
        crewScore: 95,
        abruptManeuverCount: 0,
        overspeedEventCount: 1,
        carbonKg: 69614.72,
        haulCategory: 'short',
        emissionFactor: 1.516,
        cargoTonnes: 40,
        slotCongestionStatus: 'Airport Runway & Apron Slots Approved',
        fdtlStatus: 'FDTL Compliant',
        fdtlDutyMinutes: 130,
        fdtlViolation: false,
      };

      const pdfBuffer = await pdfService.buildFlightMovementPdfBuffer(reportData);

      expect(Buffer.isBuffer(pdfBuffer)).toBe(true);
      expect(pdfBuffer.length).toBeGreaterThan(1000);

      // Verify %PDF- magic bytes
      const header = pdfBuffer.slice(0, 5).toString('ascii');
      expect(header).toBe('%PDF-');
    });

    it('generates and stores report row in Supabase and issues notification', async () => {
      const result = await pdfService.generateAndStoreMovementReport('org-1', 'fmov-1');

      expect(result.storagePath).toContain('airways/org-1/fmov-1.pdf');
      expect(result.fileSizeBytes).toBeGreaterThan(1000);
      expect(mockNotifications.createNotification).toHaveBeenCalled();
    });

    it('returns signed URL for completed flight movement report', async () => {
      const result = await pdfService.getSignedReportUrl('org-1', 'fmov-1');

      expect(result.movementId).toBe('fmov-1');
      expect(result.signedUrl).toContain('https://');
      expect(result.storagePath).toContain('airways/org-1/fmov-1.pdf');
    });
  });
});
