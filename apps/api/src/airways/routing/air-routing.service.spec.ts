import { AirRoutingService } from './air-routing.service';

describe('AirRoutingService (Unit — Great-Circle Engine)', () => {
  let routingService: AirRoutingService;

  beforeEach(() => {
    routingService = new AirRoutingService();
  });

  it('calculates accurate great-circle distance for known Mumbai (BOM) to Delhi (DEL) flight corridor (~1150 km)', () => {
    // Chhatrapati Shivaji Maharaj International Airport, Mumbai (BOM)
    const bom = { lat: 19.0896, lon: 72.8656 };
    // Indira Gandhi International Airport, Delhi (DEL)
    const del = { lat: 28.5562, lon: 77.1000 };

    const distanceKm = routingService.calculateGreatCircleDistance(
      bom.lat,
      bom.lon,
      del.lat,
      del.lon,
    );

    // Real spherical great-circle distance between BOM and DEL airport coordinates is ~1137 km (~614 NM)
    expect(distanceKm).toBeGreaterThan(1130);
    expect(distanceKm).toBeLessThan(1155);
    expect(Math.abs(distanceKm - 1137.05)).toBeLessThan(5);
  });

  it('calculates accurate initial bearing for northbound flight from BOM to DEL', () => {
    const bom = { lat: 19.0896, lon: 72.8656 };
    const del = { lat: 28.5562, lon: 77.1000 };

    const bearing = routingService.calculateInitialBearing(
      bom.lat,
      bom.lon,
      del.lat,
      del.lon,
    );

    // Bearing from Mumbai (west coast, 19°N) to Delhi (north-northeast, 28°N) is approx 20°-25° NNE
    expect(bearing).toBeGreaterThan(18);
    expect(bearing).toBeLessThan(26);
  });

  it('interpolates great-circle waypoints starting at origin and ending at destination', () => {
    const bom = { lat: 19.0896, lon: 72.8656 };
    const del = { lat: 28.5562, lon: 77.1000 };

    const waypoints = routingService.interpolateGreatCircleArc(
      bom.lat,
      bom.lon,
      del.lat,
      del.lon,
      50,
    );

    expect(waypoints.length).toBe(51); // 0 to 50 inclusive
    // First point should be origin [lng, lat]
    expect(waypoints[0][0]).toBeCloseTo(bom.lon, 2);
    expect(waypoints[0][1]).toBeCloseTo(bom.lat, 2);

    // Last point should be destination [lng, lat]
    expect(waypoints[waypoints.length - 1][0]).toBeCloseTo(del.lon, 2);
    expect(waypoints[waypoints.length - 1][1]).toBeCloseTo(del.lat, 2);

    // Intermediate latitudes must strictly increase from BOM (19°) to DEL (28°)
    for (let i = 1; i < waypoints.length; i++) {
      expect(waypoints[i][1]).toBeGreaterThanOrEqual(waypoints[i - 1][1]);
    }
  });

  it('computes complete flight route geometry labeled plainly with routing_method: great-circle', () => {
    const origin = { lat: 19.0896, lng: 72.8656, name: 'Mumbai Airport (BOM)' };
    const destination = { lat: 28.5562, lng: 77.1000, name: 'Delhi Airport (DEL)' };

    const route = routingService.computeFlightRoute(origin, destination);

    expect(route.routing_method).toBe('great-circle');
    expect(route.distance_km).toBeGreaterThan(1130);
    expect(route.duration_minutes).toBeGreaterThan(60);
    expect(route.duration_minutes).toBeLessThan(180);
    expect(route.coordinates.length).toBeGreaterThan(20);
  });
});
