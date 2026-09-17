import { RoutingService } from './routing.service';
import { SupabaseService } from '../supabase/supabase.service';

describe('RoutingService', () => {
  let service: RoutingService;
  let mockSupabase: any;

  beforeEach(() => {
    mockSupabase = {
      adminClient: {
        from: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                eq: jest.fn().mockReturnValue({
                  maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
                }),
              }),
            }),
          }),
          upsert: jest.fn().mockResolvedValue({ error: null }),
          update: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                eq: jest.fn().mockResolvedValue({ error: null }),
              }),
            }),
          }),
        }),
      },
    };

    service = new RoutingService(mockSupabase as SupabaseService);
  });

  it('should calculate route between Mumbai and Pune with real OSRM (or valid straight-line fallback)', async () => {
    const waypoints = [
      { lat: 19.076, lng: 72.8777, label: 'Mumbai' },
      { lat: 18.5204, lng: 73.8567, label: 'Pune' },
    ];

    const result = await service.getRoute('test-org', waypoints, 'Mumbai', 'Pune');

    expect(result).toBeDefined();
    expect(result.distance_km).toBeGreaterThan(50);
    expect(result.duration_minutes).toBeGreaterThan(30);
    expect(Array.isArray(result.coordinates)).toBe(true);
    expect(result.coordinates.length).toBeGreaterThan(1);
    expect(['osrm', 'fallback-straight-line']).toContain(result.routing_source);
  });

  it('should reuse cached OSRM route from saved_routes if available', async () => {
    const cachedGeometry = {
      routing_source: 'osrm' as const,
      coordinates: [
        [72.8777, 19.076],
        [73.8567, 18.5204],
      ] as [number, number][],
      distance_km: 152.4,
      duration_minutes: 180,
    };

    mockSupabase.adminClient.from.mockReturnValue({
      select: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              maybeSingle: jest.fn().mockResolvedValue({
                data: { osrm_geometry: cachedGeometry, usage_count: 3 },
                error: null,
              }),
            }),
          }),
        }),
      }),
      update: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            eq: jest.fn().mockResolvedValue({ error: null }),
          }),
        }),
      }),
    });

    const result = await service.getRoute(
      'test-org',
      [
        { lat: 19.076, lng: 72.8777 },
        { lat: 18.5204, lng: 73.8567 },
      ],
      'Mumbai',
      'Pune',
    );

    expect(result.distance_km).toBe(152.4);
    expect(result.duration_minutes).toBe(180);
    expect(result.routing_source).toBe('osrm');
  });
});
