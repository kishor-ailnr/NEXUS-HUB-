import { SeaRoutingService, haversineDistKm } from './sea-routing.service';
import { SupabaseService } from '../../supabase/supabase.service';
import { Port } from '@nexus-ways/shared';

describe('SeaRoutingService (Land-Avoiding Sea Routing)', () => {
  let routingService: SeaRoutingService;
  let mockSupabase: any;
  let mockSavedRoutes: any[] = [];

  const mumbaiPort: Port = {
    id: 'port-mumbai-01',
    org_id: 'org-001',
    name: 'Jawaharlal Nehru Port (JNPT / Mumbai)',
    unlocode: 'INBOM',
    lat: 18.95,
    lng: 72.95,
    created_at: new Date().toISOString(),
  };

  const chennaiPort: Port = {
    id: 'port-chennai-01',
    org_id: 'org-001',
    name: 'Chennai Port',
    unlocode: 'INMAA',
    lat: 13.08,
    lng: 80.29,
    created_at: new Date().toISOString(),
  };

  const cochinPort: Port = {
    id: 'port-cochin-01',
    org_id: 'org-001',
    name: 'Cochin Port',
    unlocode: 'INCOK',
    lat: 9.96,
    lng: 76.26,
    created_at: new Date().toISOString(),
  };

  beforeEach(() => {
    mockSavedRoutes = [];

    mockSupabase = {
      adminClient: {
        from: jest.fn((table: string) => {
          if (table === 'saved_sea_routes') {
            return {
              select: jest.fn().mockReturnThis(),
              eq: jest.fn(function (this: any, col: string, val: any) {
                this._filters = this._filters || {};
                this._filters[col] = val;
                return this;
              }),
              maybeSingle: jest.fn(function (this: any) {
                const found = mockSavedRoutes.find(
                  (r) =>
                    r.org_id === this._filters?.org_id &&
                    r.origin_port_id === this._filters?.origin_port_id &&
                    r.destination_port_id === this._filters?.destination_port_id,
                );
                return Promise.resolve({ data: found || null, error: null });
              }),
              upsert: jest.fn((record: any) => {
                const idx = mockSavedRoutes.findIndex(
                  (r) =>
                    r.org_id === record.org_id &&
                    r.origin_port_id === record.origin_port_id &&
                    r.destination_port_id === record.destination_port_id,
                );
                if (idx >= 0) {
                  mockSavedRoutes[idx] = { ...mockSavedRoutes[idx], ...record };
                } else {
                  mockSavedRoutes.push({ id: `saved-route-${mockSavedRoutes.length + 1}`, ...record });
                }
                return Promise.resolve({ data: record, error: null });
              }),
              update: jest.fn((updateData: any) => {
                return {
                  eq: jest.fn(function (this: any, col: string, val: any) {
                    const found = mockSavedRoutes.find((r) => r.id === val);
                    if (found) {
                      Object.assign(found, updateData);
                    }
                    return Promise.resolve({ data: found, error: null });
                  }),
                };
              }),
            };
          }
          return {};
        }),
      },
    };

    routingService = new SeaRoutingService(mockSupabase as SupabaseService);
  });

  describe('1. Real Land-Avoiding Maritime Navigation', () => {
    it('accurately computes land-avoiding sea route between Mumbai and Chennai rounding Cape Comorin / Sri Lanka', () => {
      // Raw straight line distance directly crosses the Indian subcontinent
      const rawStraightDist = haversineDistKm(mumbaiPort.lat!, mumbaiPort.lng!, chennaiPort.lat!, chennaiPort.lng!);
      expect(rawStraightDist).toBeGreaterThan(1000);
      expect(rawStraightDist).toBeLessThan(1060); // ~1,030 km overland

      const route = routingService.computeSeaRoute(mumbaiPort, chennaiPort);

      // 1. Maritime route must be marked 'searoute'
      expect(route.routing_source).toBe('searoute');

      // 2. Maritime distance around the peninsula is > 2,000 km (real navigation is ~1,500 NM = ~2,780 km)
      expect(route.distance_km).toBeGreaterThan(2000);
      expect(route.distance_km).toBeLessThan(3000);

      // 3. Meaningful deviation assertion: the sea route must dip south of India (< 8.0°N latitude)
      // to round Cape Comorin and Dondra Head, whereas a land-crossing straight line never goes below 13.0°N
      const latitudes = route.coordinates.map((coord) => coord[1]);
      const minLatitude = Math.min(...latitudes);
      expect(minLatitude).toBeLessThan(8.0); // Dips into Southern Ocean / Sri Lanka TSS

      // 4. Coordinates start at Mumbai and end at Chennai
      expect(route.coordinates[0][0]).toBeCloseTo(mumbaiPort.lng!, 1);
      expect(route.coordinates[0][1]).toBeCloseTo(mumbaiPort.lat!, 1);
      const lastCoord = route.coordinates[route.coordinates.length - 1];
      expect(lastCoord[0]).toBeCloseTo(chennaiPort.lng!, 1);
      expect(lastCoord[1]).toBeCloseTo(chennaiPort.lat!, 1);
    });

    it('computes west-coast sea route between Mumbai and Cochin along the Arabian Sea fairway', () => {
      const route = routingService.computeSeaRoute(mumbaiPort, cochinPort);

      expect(route.routing_source).toBe('searoute');
      expect(route.distance_km).toBeGreaterThan(1000);
      expect(route.distance_km).toBeLessThan(1400);

      // All points should stay west of 77°E in the Arabian Sea
      for (const [lng] of route.coordinates) {
        expect(lng).toBeLessThanOrEqual(77.0);
      }
    });
  });

  describe('2. Saved Sea Routes Caching Discipline', () => {
    it('caches computed route on first call and reuses saved route on subsequent calls with incremented usage_count', async () => {
      const orgId = 'org-001';

      // First query: computed and saved
      const firstResult = await routingService.getOrComputeRoute(orgId, mumbaiPort, chennaiPort);
      expect(firstResult.routing_source).toBe('searoute');
      expect(mockSavedRoutes.length).toBe(1);
      expect(mockSavedRoutes[0].usage_count).toBe(1);

      // Second query: retrieved from cache, usage_count updated
      const secondResult = await routingService.getOrComputeRoute(orgId, mumbaiPort, chennaiPort);
      expect(secondResult.distance_km).toBe(firstResult.distance_km);
      expect(mockSavedRoutes[0].usage_count).toBe(2);
    });
  });

  describe('3. Fallback Chokepoint Steering', () => {
    it('computes fallback-chokepoint route when ports are off-network, still steering around Cape Comorin without crossing land', () => {
      // Create off-grid coastal points
      const westPointLat = 17.5;
      const westPointLng = 73.0;
      const eastPointLat = 15.5;
      const eastPointLng = 81.5;

      const fallback = routingService.computeChokepointFallback(
        westPointLat,
        westPointLng,
        eastPointLat,
        eastPointLng,
      );

      expect(fallback.routing_source).toBe('fallback-chokepoint');
      expect(fallback.distance_km).toBeGreaterThan(1800);

      // Assert that it routes through southern chokepoints (< 8.0° latitude)
      const minLat = Math.min(...fallback.coordinates.map((c) => c[1]));
      expect(minLat).toBeLessThan(8.0);
    });
  });
});
