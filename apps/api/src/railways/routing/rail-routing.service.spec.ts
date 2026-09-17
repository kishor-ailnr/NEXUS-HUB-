import { Test, TestingModule } from '@nestjs/testing';
import { RailRoutingService, haversineDistKm } from './rail-routing.service';
import { SupabaseService } from '../../supabase/supabase.service';
import { Station } from '@nexus-ways/shared';

describe('RailRoutingService', () => {
  let service: RailRoutingService;
  let mockSupabaseService: any;

  const csmtStation: Station = {
    id: 'stn-csmt-001',
    org_id: 'org-001',
    name: 'Chhatrapati Shivaji Maharaj Terminus',
    station_code: 'CSMT',
    lat: 18.9398,
    lng: 72.8354,
    station_type: 'station',
    created_at: new Date().toISOString(),
  };

  const puneStation: Station = {
    id: 'stn-pune-002',
    org_id: 'org-001',
    name: 'Pune Junction',
    station_code: 'PUNE',
    lat: 18.5289,
    lng: 73.8744,
    station_type: 'junction',
    created_at: new Date().toISOString(),
  };

  beforeEach(async () => {
    mockSupabaseService = {
      adminClient: {
        from: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                eq: jest.fn().mockReturnValue({
                  maybeSingle: jest.fn().mockResolvedValue({ data: null }),
                }),
              }),
            }),
          }),
          upsert: jest.fn().mockResolvedValue({ data: null, error: null }),
          update: jest.fn().mockReturnValue({
            eq: jest.fn().mockResolvedValue({ data: null, error: null }),
          }),
        }),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RailRoutingService,
        { provide: SupabaseService, useValue: mockSupabaseService },
      ],
    }).compile();

    service = module.get<RailRoutingService>(RailRoutingService);
  });

  describe('1. Real Station Pair Realistic Distance', () => {
    it('calculates a realistic distance (120-220 km) for CSMT to Pune Junction and not order-of-magnitude wrong', async () => {
      // Mock Overpass returning a connected 4-segment railway corridor along Mumbai-Pune
      const mockOverpassElements = [
        {
          type: 'way',
          id: 101,
          geometry: [
            { lat: 18.94, lon: 72.84 },
            { lat: 19.02, lon: 72.90 },
            { lat: 19.20, lon: 73.10 },
          ],
        },
        {
          type: 'way',
          id: 102,
          geometry: [
            { lat: 19.20, lon: 73.10 },
            { lat: 19.00, lon: 73.35 },
            { lat: 18.75, lon: 73.50 },
          ],
        },
        {
          type: 'way',
          id: 103,
          geometry: [
            { lat: 18.75, lon: 73.50 },
            { lat: 18.60, lon: 73.70 },
            { lat: 18.53, lon: 73.87 },
          ],
        },
      ];

      jest.spyOn(service, 'queryOverpassApi').mockResolvedValue(mockOverpassElements);

      const result = await service.getOrComputeRoute('org-001', csmtStation, puneStation);

      expect(result.routing_source).toBe('overpass');
      expect(result.distance_km).toBeGreaterThan(120);
      expect(result.distance_km).toBeLessThan(250);
      // Ensure not tens of thousands of kilometers
      expect(result.distance_km).toBeLessThan(1000);
      expect(result.duration_minutes).toBeGreaterThan(60);
      expect(result.coordinates.length).toBeGreaterThanOrEqual(4);
    });
  });

  describe('2. Disconnected Graph Handling', () => {
    it('correctly falls back to fallback-straight-line when Overpass returns disconnected track clusters', async () => {
      // Two disjoint track clusters with no connecting railway way
      const disconnectedElements = [
        {
          type: 'way',
          id: 201,
          geometry: [
            { lat: 18.94, lon: 72.84 },
            { lat: 18.96, lon: 72.86 },
          ],
        },
        {
          type: 'way',
          id: 202,
          geometry: [
            { lat: 18.52, lon: 73.86 },
            { lat: 18.53, lon: 73.87 },
          ],
        },
      ];

      jest.spyOn(service, 'queryOverpassApi').mockResolvedValue(disconnectedElements);

      const result = await service.getOrComputeRoute('org-001', csmtStation, puneStation);

      expect(result.routing_source).toBe('fallback-straight-line');
      const geodesic = haversineDistKm(csmtStation.lat!, csmtStation.lng!, puneStation.lat!, puneStation.lng!);
      expect(result.distance_km).toBeCloseTo(geodesic, 0);
      expect(result.coordinates.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('3. Sanity Check Threshold Guard', () => {
    it('rejects a deliberately-implausible path (> 3x geodesic distance) and falls back to straight-line', async () => {
      // Deliberately construct a 1,000 km zigzag track in the mock response
      const crazyLongElements = [
        {
          type: 'way',
          id: 301,
          geometry: [
            { lat: 18.94, lon: 72.84 },
            { lat: 22.00, lon: 75.00 }, // Far detour to Madhya Pradesh
            { lat: 18.53, lon: 73.87 },
          ],
        },
      ];

      jest.spyOn(service, 'queryOverpassApi').mockResolvedValue(crazyLongElements);

      const result = await service.getOrComputeRoute('org-001', csmtStation, puneStation);

      // Geodesic CSMT-Pune is ~119 km. The detour is > 700 km (> 3x), so sanity guard triggers.
      expect(result.routing_source).toBe('fallback-straight-line');
      const geodesic = haversineDistKm(csmtStation.lat!, csmtStation.lng!, puneStation.lat!, puneStation.lng!);
      expect(result.distance_km).toBeCloseTo(geodesic, 0);
    });
  });

  describe('4. Straight-line Fallback Calculation', () => {
    it('produces valid interpolated coordinates and accurate geodesic distance when Overpass fails', async () => {
      jest.spyOn(service, 'queryOverpassApi').mockResolvedValue([]);

      const result = await service.getOrComputeRoute('org-001', csmtStation, puneStation);

      expect(result.routing_source).toBe('fallback-straight-line');
      const geodesic = haversineDistKm(csmtStation.lat!, csmtStation.lng!, puneStation.lat!, puneStation.lng!);
      expect(result.distance_km).toBeCloseTo(geodesic, 0);
      expect(result.coordinates.length).toBeGreaterThanOrEqual(16);
      expect(result.coordinates[0]).toEqual([csmtStation.lng, csmtStation.lat]);
      expect(result.coordinates[result.coordinates.length - 1]).toEqual([puneStation.lng, puneStation.lat]);
    });
  });
});
