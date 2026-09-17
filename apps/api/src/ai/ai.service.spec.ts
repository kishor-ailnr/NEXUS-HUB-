import { AiService } from './ai.service';
import { ConfigService } from '@nestjs/config';

describe('AiService (Unit)', () => {
  let aiService: AiService;
  let mockSupabase: any;
  let mockConfigService: any;
  let mockDashboardService: any;
  let mockTripsService: any;
  let mockTrainMovementsService: any;

  beforeEach(() => {
    const alertQueryBuilder: any = {};
    alertQueryBuilder.select = jest.fn().mockReturnValue(alertQueryBuilder);
    alertQueryBuilder.eq = jest.fn().mockReturnValue(alertQueryBuilder);
    alertQueryBuilder.is = jest.fn().mockReturnValue(alertQueryBuilder);
    alertQueryBuilder.order = jest.fn().mockReturnValue(alertQueryBuilder);
    alertQueryBuilder.limit = jest.fn().mockResolvedValue({
      data: [
        { id: 'alert-1', type: 'speed_alert', message: 'Vehicle speed 95 km/h exceeds limit', severity: 'high' },
      ],
      error: null,
    });
    alertQueryBuilder.update = jest.fn().mockImplementation(() => alertQueryBuilder);

    mockSupabase = {
      adminClient: {
        from: jest.fn().mockImplementation((table: string) => {
          if (table === 'alerts') {
            return alertQueryBuilder;
          }
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockResolvedValue({ data: [], error: null }),
            }),
          };
        }),
      },
    };

    mockConfigService = {
      get: jest.fn().mockReturnValue(''), // Unset API key to test deterministic fallback
    };

    mockDashboardService = {
      getStats: jest.fn().mockResolvedValue({
        activeAlerts: 2,
        activeVehicles: { value: 5, label: 'Active Vehicles' },
        totalFleetToday: { value: 10, label: 'Fleet Size' },
        avgSpeedKmh: { value: 45, label: 'Avg Speed' },
        arrivedCount: { value: 3, label: 'Arrived' },
        departedCount: { value: 4, label: 'Departed' },
      }),
    };

    mockTripsService = {
      findAll: jest.fn().mockResolvedValue([
        {
          id: 't-101',
          vehicle: { registration_number: 'MH-01-AB-1234' },
          origin_label: 'Mumbai Port',
          destination_label: 'Pune Hub',
          status: 'in_transit',
          distance_km: 150,
          predicted_duration_minutes: 180,
        },
      ]),
      findOne: jest.fn().mockResolvedValue({
        id: 't-101',
        origin_label: 'Mumbai Port',
        destination_label: 'Pune Hub',
        status: 'in_transit',
      }),
      getEta: jest.fn().mockResolvedValue({
        base_eta_minutes: 120,
        min_eta_minutes: 105,
        max_eta_minutes: 135,
        confidence_basis: 'default',
        sample_size: 1,
      }),
    };

    mockTrainMovementsService = {
      findAll: jest.fn().mockResolvedValue([
        {
          id: 'mov-rail-101',
          train: { train_number: 'TR-7001', train_name: 'Freight Express', locomotive: { fuel_type: 'electric' } },
          origin_station: { name: 'Mumbai CSMT' },
          destination_station: { name: 'New Delhi' },
          loco_pilot: { user: { full_name: 'Vikram Singh' } },
          status: 'in_transit',
          distance_km: 450,
          duration_minutes: 360,
        },
      ]),
      findOne: jest.fn().mockResolvedValue({
        id: 'mov-rail-101',
        train: { train_number: 'TR-7001', train_name: 'Freight Express', locomotive: { loco_number: 'WAG-9', fuel_type: 'electric' } },
        origin_station: { name: 'Mumbai CSMT' },
        destination_station: { name: 'New Delhi' },
        status: 'in_transit',
        crew_score: { score: 95 },
        carbon_kg: 14175,
        stops: [{ id: 'stop-1' }, { id: 'stop-2' }],
      }),
      getEtaConfidence: jest.fn().mockResolvedValue({
        base_eta_minutes: 240,
        min_eta_minutes: 220,
        max_eta_minutes: 260,
        confidence_basis: 'historical',
        sample_size: 4,
      }),
      checkSlot: jest.fn().mockResolvedValue({
        originStationId: 'st-1',
        destinationStationId: 'st-2',
        proposedDeparture: new Date().toISOString(),
        congested: false,
        overlapCount: 0,
        threshold: 1,
        reason: 'Track section clear',
      }),
    };

    const mockFlightMovementsService: any = {
      findAll: jest.fn().mockResolvedValue([
        {
          id: 'fmov-1',
          status: 'in_transit',
          distance_km: 1148,
          duration_minutes: 135,
          flight: { flight_number: 'AI-701', origin_airport: { name: 'Delhi', iata_code: 'DEL' }, destination_airport: { name: 'Mumbai', iata_code: 'BOM' } },
          aircraft: { tail_number: 'VT-NWX', aircraft_type: 'Boeing 777F' },
          pilot: { user: { full_name: 'Capt. Vikram Batra' } },
        },
      ]),
      findOne: jest.fn().mockResolvedValue({
        id: 'fmov-1',
        status: 'in_transit',
        distance_km: 1148,
        flight: { flight_number: 'AI-701' },
      }),
      getEtaConfidence: jest.fn().mockResolvedValue({
        movement_id: 'fmov-1',
        base_eta_minutes: 135,
        min_eta_minutes: 125,
        max_eta_minutes: 145,
        confidence_basis: 'default',
        sample_size: 1,
      }),
    };

    const mockVoyageMovementsService: any = {
      findAll: jest.fn().mockResolvedValue([
        {
          id: 'vmov-1',
          status: 'in_transit',
          distance_km: 1530,
          duration_minutes: 3600,
          voyage: { voyage_number: 'VY-901', origin_port: { name: 'Jawaharlal Nehru Port', code: 'INNSA' }, destination_port: { name: 'Chennai Port', code: 'INMAA' } },
          vessel: { name: 'MV Ocean Titan', imo_number: 'IMO9234567', dwt_tonnes: 65000 },
          crew: { master_license: 'M-STCW-991', user: { full_name: 'Capt. Rajiv Sharma' } },
        },
      ]),
      findOne: jest.fn().mockResolvedValue({
        id: 'vmov-1',
        status: 'in_transit',
        distance_km: 1530,
        voyage: { voyage_number: 'VY-901' },
      }),
      getEtaConfidence: jest.fn().mockResolvedValue({
        movement_id: 'vmov-1',
        base_eta_minutes: 3600,
        min_eta_minutes: 3060,
        max_eta_minutes: 4140,
        confidence_basis: 'default',
        sample_size: 1,
      }),
    };

    aiService = new AiService(
      mockConfigService as ConfigService,
      mockSupabase,
      mockDashboardService,
      mockTripsService,
      mockTrainMovementsService,
      mockFlightMovementsService,
      mockVoyageMovementsService,
    );
  });

  describe('Deterministic Fallback Responder', () => {
    it('plainly identifies fallback mode in response when GEMINI_API_KEY is unset', async () => {
      const response = await aiService.processChat('org-123', {
        message: 'What is the overall fleet status?',
      });

      expect(response.isFallback).toBe(true);
      expect(response.role).toBe('assistant');
      expect(response.content).toContain('Rule-Based Assistant Fallback Mode');
      expect(response.toolCalls).toBeDefined();
      expect(response.toolCalls!.length).toBeGreaterThan(0);
      expect(response.toolCalls![0].name).toBe('get_dashboard_stats');
    });

    it('answers active alerts query in fallback mode with visible tool call', async () => {
      const response = await aiService.processChat('org-123', {
        message: 'Show active alerts',
      });

      expect(response.isFallback).toBe(true);
      expect(response.toolCalls).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ name: 'list_unacknowledged_alerts' }),
        ])
      );
      expect(response.content).toContain('Vehicle speed 95 km/h exceeds limit');
    });

    it('answers active train movements query using Railways tools', async () => {
      const response = await aiService.processChat('org-123', {
        message: 'List all active train movements',
      });

      expect(response.isFallback).toBe(true);
      expect(response.toolCalls).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ name: 'list_active_train_movements' }),
        ])
      );
      expect(response.content).toContain('TR-7001');
      expect(response.content).toContain('Mumbai CSMT');
    });

    it('executes list_active_flight_movements tool for airways flight inquiries', async () => {
      const response = await aiService.processChat('org-123', {
        message: 'Show active flight movements in airways',
      });

      expect(response.isFallback).toBe(true);
      expect(response.toolCalls).toBeDefined();
      expect(response.toolCalls!.some((tc) => tc.name === 'list_active_flight_movements')).toBe(
        true,
      );
      expect(response.content).toContain('AI-701');
      expect(response.content).toContain('VT-NWX');
    });

    it('executes list_active_voyage_movements tool for seaways voyage inquiries', async () => {
      const response = await aiService.processChat('org-123', {
        message: 'Show active voyage movements at sea',
      });

      expect(response.isFallback).toBe(true);
      expect(response.toolCalls).toBeDefined();
      expect(response.toolCalls!.some((tc) => tc.name === 'list_active_voyage_movements')).toBe(
        true,
      );
      expect(response.content).toContain('MV Ocean Titan');
      expect(response.content).toContain('INNSA');
      expect(response.content).toContain('INMAA');
    });

    it('proposes acknowledge_alert action without immediately modifying database', async () => {
      const response = await aiService.processChat('org-123', {
        message: 'Acknowledge alert #alert-1',
      });

      expect(response.proposedAction).toBeDefined();
      expect(response.proposedAction?.actionType).toBe('acknowledge_alert');
      expect(response.proposedAction?.payload).toEqual({ alertId: 'alert-1' });
      expect(response.proposedAction?.status).toBe('pending');
      expect(response.content).toContain('proposed action');
    });
  });

  describe('Action Confirmation (Write Operations)', () => {
    it('executes database update only when user confirms action', async () => {
      const mockUpdate = jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          eq: jest.fn().mockResolvedValue({ error: null }),
        }),
      });

      mockSupabase.adminClient.from.mockImplementation((table: string) => {
        if (table === 'alerts') {
          return { update: mockUpdate };
        }
      });

      const result = await aiService.confirmAction('org-123', {
        actionId: 'action-123',
        actionType: 'acknowledge_alert',
        payload: { alertId: 'alert-456' },
        confirmed: true,
      });

      expect(result.success).toBe(true);
      expect(result.message).toContain('successfully acknowledged');
      expect(mockUpdate).toHaveBeenCalled();
    });

    it('cancels action when user rejects without modifying database', async () => {
      const mockUpdate = jest.fn();
      mockSupabase.adminClient.from.mockImplementation(() => ({ update: mockUpdate }));

      const result = await aiService.confirmAction('org-123', {
        actionId: 'action-123',
        actionType: 'acknowledge_alert',
        payload: { alertId: 'alert-456' },
        confirmed: false,
      });

      expect(result.success).toBe(true);
      expect(result.message).toContain('rejected and cancelled');
      expect(mockUpdate).not.toHaveBeenCalled();
    });
  });
});
