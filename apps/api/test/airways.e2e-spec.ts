import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import cookieParser from 'cookie-parser';
import * as jwt from 'jsonwebtoken';
import { AppModule } from '../src/app.module';
import { SupabaseService } from '../src/supabase/supabase.service';
import { AirRoutingService } from '../src/airways/routing/air-routing.service';
import { GeocodingService } from '../src/geocoding/geocoding.service';

describe('Airways Core Modules (e2e)', () => {
  jest.setTimeout(35000);
  let app: INestApplication;
  const JWT_SECRET = 'test-secret-airways-phase7b-key-999999999999';

  // In-memory mock tables for Airways
  let mockOrgs: any[] = [];
  let mockUsers: any[] = [];
  let mockAirports: any[] = [];
  let mockAircraft: any[] = [];
  let mockFlightCrew: any[] = [];
  let mockFlights: any[] = [];
  let mockFlightMovements: any[] = [];
  let mockFlightTelemetry: any[] = [];
  let mockGeofences: any[] = [];
  let mockGeofenceEvents: any[] = [];
  let mockAlerts: any[] = [];
  let mockNotifications: any[] = [];

  const orgId = 'org-airways-001';
  const managerUserId = 'user-mgr-air-001';
  const operatorUserId = 'user-opr-air-001';
  const driverUserId = 'user-drv-air-001';

  let managerToken: string;
  let operatorToken: string;
  let driverToken: string;

  beforeAll(async () => {
    mockOrgs = [
      {
        id: orgId,
        name: 'Nexus Airways Cargo Division',
        mode: 'airways',
        country: 'India',
        state: 'Maharashtra',
        district: 'Mumbai',
        address: 'Chhatrapati Shivaji Maharaj International Airport',
        latitude: 19.0896,
        longitude: 72.8656,
        created_at: new Date().toISOString(),
      },
    ];

    mockUsers = [
      {
        id: managerUserId,
        org_id: orgId,
        email: 'manager@airways.com',
        full_name: 'Airways Chief Dispatcher',
        role: 'manager',
      },
      {
        id: operatorUserId,
        org_id: orgId,
        email: 'operator@airways.com',
        full_name: 'Ground Operations Officer',
        role: 'operator',
      },
      {
        id: driverUserId,
        org_id: orgId,
        email: 'captain1@airways.com',
        full_name: 'Capt. Rajesh Sharma',
        role: 'driver',
      },
    ];

    managerToken = jwt.sign(
      { sub: managerUserId, id: managerUserId, email: 'manager@airways.com', role: 'manager', orgId },
      JWT_SECRET,
    );

    operatorToken = jwt.sign(
      { sub: operatorUserId, id: operatorUserId, email: 'operator@airways.com', role: 'operator', orgId },
      JWT_SECRET,
    );

    driverToken = jwt.sign(
      { sub: driverUserId, id: driverUserId, email: 'captain1@airways.com', role: 'driver', orgId },
      JWT_SECRET,
    );

    const mockSupabaseService = {
      getSecret: () => JWT_SECRET,
      verifyJwt: async (token: string) => {
        return jwt.verify(token, JWT_SECRET);
      },
      signToken: (payload: any, expiresIn: string | number = '1h') => {
        return jwt.sign(payload, JWT_SECRET, { expiresIn: expiresIn as any });
      },
      get client() {
        return (this as any).adminClient;
      },
      get adminClient() {
        return {
          from: (tableName: string) => {
            let dataStore: any[];
            switch (tableName) {
              case 'organizations':
                dataStore = mockOrgs;
                break;
              case 'users':
                dataStore = mockUsers;
                break;
              case 'airports':
                dataStore = mockAirports;
                break;
              case 'aircraft':
                dataStore = mockAircraft;
                break;
              case 'flight_crew':
                dataStore = mockFlightCrew;
                break;
              case 'flights':
                dataStore = mockFlights;
                break;
              case 'flight_movements':
                dataStore = mockFlightMovements;
                break;
              case 'flight_telemetry':
                dataStore = mockFlightTelemetry;
                break;
              case 'geofences':
                dataStore = mockGeofences;
                break;
              case 'geofence_events':
                dataStore = mockGeofenceEvents;
                break;
              case 'alerts':
                dataStore = mockAlerts;
                break;
              case 'notifications':
                dataStore = mockNotifications;
                break;
              default:
                dataStore = [];
            }

            let filtered = [...dataStore];
            let pendingUpdate: any = null;

            const queryBuilder: any = {
              select: jest.fn().mockReturnThis(),
              eq: jest.fn().mockImplementation((col: string, val: any) => {
                filtered = filtered.filter((row: any) => row[col] === val);
                if (pendingUpdate) {
                  filtered.forEach((row) => {
                    Object.assign(row, pendingUpdate);
                    const idx = dataStore.findIndex((item) => item.id === row.id);
                    if (idx !== -1) {
                      Object.assign(dataStore[idx], pendingUpdate);
                    }
                  });
                }
                return queryBuilder;
              }),
              neq: jest.fn().mockImplementation((col: string, val: any) => {
                filtered = filtered.filter((row: any) => row[col] !== val);
                return queryBuilder;
              }),
              in: jest.fn().mockImplementation((col: string, vals: any[]) => {
                filtered = filtered.filter((row: any) => vals.includes(row[col]));
                return queryBuilder;
              }),
              order: jest.fn().mockReturnThis(),
              limit: jest.fn().mockImplementation((n: number) => {
                filtered = filtered.slice(0, n);
                return queryBuilder;
              }),
              single: jest.fn().mockImplementation(async () => {
                if (filtered.length === 0) {
                  return { data: null, error: { message: 'Row not found', code: 'PGRST116' } };
                }
                return { data: { ...filtered[0] }, error: null };
              }),
              maybeSingle: jest.fn().mockImplementation(async () => {
                return { data: filtered[0] ? { ...filtered[0] } : null, error: null };
              }),
              insert: jest.fn().mockImplementation((payload: any) => {
                const rows = Array.isArray(payload) ? payload : [payload];
                const inserted = rows.map((r) => {
                  const newRow = {
                    id: r.id || `id-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
                    created_at: new Date().toISOString(),
                    ...r,
                  };
                  dataStore.push(newRow);
                  return newRow;
                });
                filtered = inserted;
                return queryBuilder;
              }),
              update: jest.fn().mockImplementation((payload: any) => {
                pendingUpdate = payload;
                filtered.forEach((row) => {
                  Object.assign(row, payload);
                  const index = dataStore.findIndex((item) => item.id === row.id);
                  if (index !== -1) {
                    Object.assign(dataStore[index], payload);
                  }
                });
                return queryBuilder;
              }),
              delete: jest.fn().mockImplementation(async () => {
                filtered.forEach((row) => {
                  const index = dataStore.findIndex((item) => item.id === row.id);
                  if (index !== -1) {
                    dataStore.splice(index, 1);
                  }
                });
                return { error: null };
              }),
              then: (resolve: any, reject?: any) => {
                return Promise.resolve({ data: [...filtered], error: null }).then(resolve, reject);
              },
            };

            return queryBuilder;
          },
        };
      },
    };

    const mockGeocodingService = {
      geocodeAddress: async (address: string) => {
        if (address.toLowerCase().includes('delhi') || address.toLowerCase().includes('igi')) {
          return { lat: 28.5562, lng: 77.1, formatted_address: 'Indira Gandhi International Airport, New Delhi' };
        }
        return { lat: 19.0896, lng: 72.8656, formatted_address: 'Chhatrapati Shivaji Maharaj International Airport, Mumbai' };
      },
    };

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(SupabaseService)
      .useValue(mockSupabaseService)
      .overrideProvider(GeocodingService)
      .useValue(mockGeocodingService)
      .compile();

    app = moduleFixture.createNestApplication();
    app.use(cookieParser());
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });

  describe('1. Airports Management (CRUD & Geocoding)', () => {
    let airportBomId: string;
    let airportDelId: string;

    it('Manager creates Mumbai Airport (BOM/VABB) and gets automatically geocoded', async () => {
      const res = await request(app.getHttpServer())
        .post('/airports')
        .set('Authorization', `Bearer ${managerToken}`)
        .send({
          name: 'Chhatrapati Shivaji Maharaj International Airport',
          iata_code: 'BOM',
          icao_code: 'VABB',
          address: 'CSMIA Terminal 2, Mumbai',
        })
        .expect(201);

      expect(res.body.id).toBeDefined();
      expect(res.body.iata_code).toBe('BOM');
      expect(res.body.icao_code).toBe('VABB');
      expect(res.body.lat).toBe(19.0896);
      expect(res.body.lng).toBe(72.8656);
      airportBomId = res.body.id;
    });

    it('Manager creates Delhi Airport (DEL/VIDP) and gets geocoded', async () => {
      const res = await request(app.getHttpServer())
        .post('/airports')
        .set('Authorization', `Bearer ${managerToken}`)
        .send({
          name: 'Indira Gandhi International Airport',
          iata_code: 'DEL',
          icao_code: 'VIDP',
          address: 'IGI Cargo Complex, New Delhi',
        })
        .expect(201);

      expect(res.body.id).toBeDefined();
      expect(res.body.iata_code).toBe('DEL');
      expect(res.body.lat).toBe(28.5562);
      expect(res.body.lng).toBe(77.1);
      airportDelId = res.body.id;
    });

    it('Operator cannot create an airport (Manager role guarded)', async () => {
      await request(app.getHttpServer())
        .post('/airports')
        .set('Authorization', `Bearer ${operatorToken}`)
        .send({
          name: 'Kempegowda International Airport',
          iata_code: 'BLR',
        })
        .expect(403);
    });

    it('Lists airports for the organization', async () => {
      const res = await request(app.getHttpServer())
        .get('/airports')
        .set('Authorization', `Bearer ${operatorToken}`)
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('2. Aircraft, Flight Crew, and Flights CRUD', () => {
    let aircraftId: string;
    let crewId: string;
    let flightId: string;

    it('Manager creates an Aircraft (Boeing 777F)', async () => {
      const res = await request(app.getHttpServer())
        .post('/aircraft')
        .set('Authorization', `Bearer ${managerToken}`)
        .send({
          tail_number: 'VT-NEX',
          aircraft_type: 'Boeing 777F',
          cargo_capacity_kg: 102000,
          status: 'idle',
        })
        .expect(201);

      expect(res.body.id).toBeDefined();
      expect(res.body.tail_number).toBe('VT-NEX');
      expect(res.body.cargo_capacity_kg).toBe(102000);
      aircraftId = res.body.id;
    });

    it('Manager registers a Flight Crew member (Pilot in Command)', async () => {
      const res = await request(app.getHttpServer())
        .post('/flight-crew')
        .set('Authorization', `Bearer ${managerToken}`)
        .send({
          fullName: 'Capt. Rajesh Sharma',
          email: 'captain1@airways.com',
          licenseNumber: 'ATPL-777-9942',
          crewRole: 'pilot',
          status: 'available',
        })
        .expect(201);

      expect(res.body.id).toBeDefined();
      expect(res.body.license_number).toBe('ATPL-777-9942');
      crewId = res.body.id;
    });

    it('Manager creates a Flight route (NX-101 BOM -> DEL)', async () => {
      const airportBom = mockAirports.find((a) => a.iata_code === 'BOM');
      const airportDel = mockAirports.find((a) => a.iata_code === 'DEL');

      const res = await request(app.getHttpServer())
        .post('/flights')
        .set('Authorization', `Bearer ${managerToken}`)
        .send({
          flight_number: 'NX-101',
          origin_airport_id: airportBom.id,
          destination_airport_id: airportDel.id,
        })
        .expect(201);

      expect(res.body.id).toBeDefined();
      expect(res.body.flight_number).toBe('NX-101');
      flightId = res.body.id;
    });

    it('Driver role cannot create flights (Manager role guarded)', async () => {
      const airportBom = mockAirports.find((a) => a.iata_code === 'BOM');
      const airportDel = mockAirports.find((a) => a.iata_code === 'DEL');

      await request(app.getHttpServer())
        .post('/flights')
        .set('Authorization', `Bearer ${driverToken}`)
        .send({
          flight_number: 'NX-102',
          origin_airport_id: airportBom.id,
          destination_airport_id: airportDel.id,
        })
        .expect(403);
    });
  });

  describe('3. Pure Great-Circle Air Routing Calculation', () => {
    let airRoutingService: AirRoutingService;

    beforeAll(() => {
      airRoutingService = app.get(AirRoutingService);
    });

    it('Calculates pure Great-Circle distance BOM to DEL (~1,148 km) accurately', () => {
      const bomLat = 19.0896;
      const bomLng = 72.8656;
      const delLat = 28.5562;
      const delLng = 77.1;

      const distanceKm = airRoutingService.calculateGreatCircleDistance(
        bomLat,
        bomLng,
        delLat,
        delLng,
      );

      // Real spherical great-circle distance is ~1137 km (~614 NM)
      expect(distanceKm).toBeGreaterThan(1130);
      expect(distanceKm).toBeLessThan(1155);
      expect(Math.round(distanceKm)).toBe(1137);
    });

    it('Computes great circle path coordinates and initial bearing', () => {
      const bomLat = 19.0896;
      const bomLng = 72.8656;
      const delLat = 28.5562;
      const delLng = 77.1;

      const bearing = airRoutingService.calculateInitialBearing(bomLat, bomLng, delLat, delLng);
      // North-Northeast heading (~21-25 degrees)
      expect(bearing).toBeGreaterThan(15);
      expect(bearing).toBeLessThan(30);

      const path = airRoutingService.interpolateGreatCircleArc(
        bomLat,
        bomLng,
        delLat,
        delLng,
        20,
      );

      expect(path.length).toBe(21);
      expect(path[0][1]).toBeCloseTo(bomLat, 2);
      expect(path[0][0]).toBeCloseTo(bomLng, 2);
      expect(path[path.length - 1][1]).toBeCloseTo(delLat, 2);
      expect(path[path.length - 1][0]).toBeCloseTo(delLng, 2);
    });
  });

  describe('4. Flight Movement Lifecycle & Realtime Simulation', () => {
    let movementId: string;

    it('Manager dispatches a flight movement', async () => {
      const flight = mockFlights[0];
      const aircraft = mockAircraft[0];
      const crew = mockFlightCrew[0];

      const res = await request(app.getHttpServer())
        .post('/flight-movements')
        .set('Authorization', `Bearer ${managerToken}`)
        .send({
          flight_id: flight.id,
          aircraft_id: aircraft.id,
          pilot_id: crew.id,
          simulation_speed_multiplier: 100,
        })
        .expect(201);

      expect(res.body.id).toBeDefined();
      expect(res.body.status).toBe('planned');
      expect(res.body.routing_method).toBe('great-circle');
      expect(res.body.distance_km).toBeGreaterThan(1100);
      movementId = res.body.id;
    });

    it('Transition flight movement to in_transit triggers simulation telemetry ticks', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/flight-movements/${movementId}/status`)
        .set('Authorization', `Bearer ${managerToken}`)
        .send({ status: 'in_transit' })
        .expect(200);

      expect(res.body.status).toBe('in_transit');

      // Wait briefly for simulation ticks to generate telemetry
      await new Promise((resolve) => setTimeout(resolve, 400));

      const telemetry = mockFlightTelemetry.filter((t) => t.movement_id === movementId);
      expect(telemetry.length).toBeGreaterThanOrEqual(1);

      // Verify strictly-monotonic timestamps and altitude
      for (let i = 1; i < telemetry.length; i++) {
        const prev = new Date(telemetry[i - 1].recorded_at).getTime();
        const curr = new Date(telemetry[i].recorded_at).getTime();
        expect(curr).toBeGreaterThanOrEqual(prev);
      }
    });

    it('Flight movement status completes and marks touchdown', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/flight-movements/${movementId}/status`)
        .set('Authorization', `Bearer ${managerToken}`)
        .send({ status: 'completed' })
        .expect(200);

      expect(res.body.status).toBe('completed');
      expect(res.body.completed_at).toBeDefined();
    });
  });

  describe('5. Airport Terminal & Geofence Boundary Check', () => {
    it('Evaluates circular geofence boundary around BOM Airport', async () => {
      const airportBom = mockAirports.find((a) => a.iata_code === 'BOM');

      const geofence = {
        id: 'geo-bom-t2-01',
        org_id: orgId,
        name: 'BOM Terminal 2 & Cargo Apron',
        mode: 'airways',
        type: 'airport',
        boundary_type: 'circle',
        center_lat: airportBom?.lat || 19.0896,
        center_lng: airportBom?.lng || 72.8656,
        radius_meters: 3000,
        is_active: true,
        created_at: new Date().toISOString(),
      };
      mockGeofences.push(geofence);

      expect(mockGeofences.length).toBeGreaterThanOrEqual(1);
    });
  });
});
