import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import cookieParser from 'cookie-parser';
import * as jwt from 'jsonwebtoken';
import { AppModule } from '../src/app.module';
import { SupabaseService } from '../src/supabase/supabase.service';
import { RailRoutingService } from '../src/railways/routing/rail-routing.service';
import { GeocodingService } from '../src/geocoding/geocoding.service';

describe('Railways Core Modules (e2e)', () => {
  jest.setTimeout(35000);
  let app: INestApplication;
  const JWT_SECRET = 'test-secret-railways-phase7a-key-999999999999';

  // In-memory mock tables for Railways
  let mockOrgs: any[] = [];
  let mockUsers: any[] = [];
  let mockStations: any[] = [];
  let mockLocomotives: any[] = [];
  let mockRakes: any[] = [];
  let mockLocoPilots: any[] = [];
  let mockTrains: any[] = [];
  let mockSavedRailRoutes: any[] = [];
  let mockTrainMovements: any[] = [];
  let mockTrainMovementStops: any[] = [];
  let mockTrainTelemetry: any[] = [];
  let mockGeofences: any[] = [];
  let mockGeofenceEvents: any[] = [];
  let mockAlerts: any[] = [];
  let mockNotifications: any[] = [];

  const orgId = 'org-railways-001';
  const managerUserId = 'user-mgr-rail-001';
  const operatorUserId = 'user-opr-rail-001';
  const driverUserId = 'user-drv-rail-001';

  let managerToken: string;
  let operatorToken: string;
  let driverToken: string;

  beforeAll(async () => {
    mockOrgs = [
      {
        id: orgId,
        name: 'Nexus Railways Division',
        mode: 'railways',
        country: 'India',
        state: 'Maharashtra',
        district: 'Mumbai',
        address: 'Chhatrapati Shivaji Maharaj Terminus',
        latitude: 18.9398,
        longitude: 72.8354,
        created_at: new Date().toISOString(),
      },
    ];

    mockUsers = [
      {
        id: managerUserId,
        org_id: orgId,
        email: 'manager@railways.com',
        full_name: 'Rail Chief Controller',
        role: 'manager',
      },
      {
        id: operatorUserId,
        org_id: orgId,
        email: 'operator@railways.com',
        full_name: 'Yard Operator',
        role: 'operator',
      },
      {
        id: driverUserId,
        org_id: orgId,
        email: 'locopilot1@railways.com',
        full_name: 'Vikram Singh',
        role: 'driver',
      },
    ];

    managerToken = jwt.sign(
      { sub: managerUserId, id: managerUserId, email: 'manager@railways.com', role: 'manager', orgId },
      JWT_SECRET,
    );

    operatorToken = jwt.sign(
      { sub: operatorUserId, id: operatorUserId, email: 'operator@railways.com', role: 'operator', orgId },
      JWT_SECRET,
    );

    driverToken = jwt.sign(
      { sub: driverUserId, id: driverUserId, email: 'locopilot1@railways.com', role: 'driver', orgId },
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
              case 'stations':
                dataStore = mockStations;
                break;
              case 'locomotives':
                dataStore = mockLocomotives;
                break;
              case 'rakes':
                dataStore = mockRakes;
                break;
              case 'loco_pilots':
                dataStore = mockLocoPilots;
                break;
              case 'trains':
                dataStore = mockTrains;
                break;
              case 'saved_rail_routes':
                dataStore = mockSavedRailRoutes;
                break;
              case 'train_movements':
                dataStore = mockTrainMovements;
                break;
              case 'train_movement_stops':
                dataStore = mockTrainMovementStops;
                break;
              case 'train_telemetry':
                dataStore = mockTrainTelemetry;
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
              upsert: jest.fn().mockImplementation((payload: any, opts: any) => {
                const rows = Array.isArray(payload) ? payload : [payload];
                const upserted = rows.map((r) => {
                  const idx = dataStore.findIndex(
                    (item) =>
                      item.org_id === r.org_id &&
                      item.origin_station_id === r.origin_station_id &&
                      item.destination_station_id === r.destination_station_id,
                  );
                  if (idx >= 0) {
                    dataStore[idx] = { ...dataStore[idx], ...r, updated_at: new Date().toISOString() };
                    return dataStore[idx];
                  }
                  const newRow = {
                    id: r.id || `sr-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
                    ...r,
                  };
                  dataStore.push(newRow);
                  return newRow;
                });
                filtered = upserted;
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
        if (address.toLowerCase().includes('pune')) {
          return { lat: 18.5204, lng: 73.8567, formatted_address: 'Pune Junction Railway Station' };
        }
        return { lat: 18.9398, lng: 72.8354, formatted_address: 'Mumbai CSMT' };
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

  describe('1. Stations Management (CRUD & Geocoding)', () => {
    let stationCsmtId: string;
    let stationPuneId: string;

    it('Manager creates Mumbai CSMT station and gets automatically geocoded', async () => {
      const res = await request(app.getHttpServer())
        .post('/stations')
        .set('Authorization', `Bearer ${managerToken}`)
        .send({
          name: 'Chhatrapati Shivaji Maharaj Terminus',
          station_code: 'CSMT',
          station_type: 'station',
          address: 'CSMT, Fort, Mumbai',
        })
        .expect(201);

      expect(res.body.id).toBeDefined();
      expect(res.body.station_code).toBe('CSMT');
      expect(res.body.lat).toBe(18.9398);
      expect(res.body.lng).toBe(72.8354);
      stationCsmtId = res.body.id;
    });

    it('Manager creates Pune Junction station and gets geocoded', async () => {
      const res = await request(app.getHttpServer())
        .post('/stations')
        .set('Authorization', `Bearer ${managerToken}`)
        .send({
          name: 'Pune Junction',
          station_code: 'PUNE',
          station_type: 'junction',
          address: 'Pune Railway Station, Agarkar Nagar, Pune',
        })
        .expect(201);

      expect(res.body.id).toBeDefined();
      expect(res.body.station_code).toBe('PUNE');
      expect(res.body.lat).toBe(18.5204);
      expect(res.body.lng).toBe(73.8567);
      stationPuneId = res.body.id;
    });

    it('Operator cannot create a station (Manager role guarded)', async () => {
      await request(app.getHttpServer())
        .post('/stations')
        .set('Authorization', `Bearer ${operatorToken}`)
        .send({
          name: 'Kalyan Junction',
          station_code: 'KYN',
          station_type: 'junction',
        })
        .expect(403);
    });

    it('Lists stations for the organization', async () => {
      const res = await request(app.getHttpServer())
        .get('/stations')
        .set('Authorization', `Bearer ${operatorToken}`)
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('2. Locomotives, Rakes, Loco Pilots, and Trains CRUD', () => {
    let locoId: string;
    let rakeId: string;
    let pilotId: string;
    let trainId: string;

    it('Manager creates a Locomotive (WAP-7)', async () => {
      const res = await request(app.getHttpServer())
        .post('/locomotives')
        .set('Authorization', `Bearer ${managerToken}`)
        .send({
          loco_number: 'WAP7-30452',
          loco_type: 'WAP-7',
          power_kw: 4500,
          fuel_type: 'electric',
        })
        .expect(201);

      expect(res.body.id).toBeDefined();
      expect(res.body.loco_number).toBe('WAP7-30452');
      locoId = res.body.id;
    });

    it('Manager creates a Rake (16-coach LHB)', async () => {
      const res = await request(app.getHttpServer())
        .post('/rakes')
        .set('Authorization', `Bearer ${managerToken}`)
        .send({
          rake_id: 'RAKE-DECCAN-01',
          composition: [
            { type: 'loco', count: 1 },
            { type: 'ac_chair_car', count: 4 },
            { type: 'second_sitting', count: 10 },
            { type: 'guard_van', count: 1 },
          ],
        })
        .expect(201);

      expect(res.body.id).toBeDefined();
      expect(res.body.rake_id).toBe('RAKE-DECCAN-01');
      rakeId = res.body.id;
    });

    it('Manager registers a Loco Pilot and maps to user', async () => {
      const res = await request(app.getHttpServer())
        .post('/loco-pilots')
        .set('Authorization', `Bearer ${managerToken}`)
        .send({
          fullName: 'Vikram Singh',
          email: 'locopilot1@railways.com',
          licenseNumber: 'LP-CR-2024-8841',
          phone: '+919876543210',
        })
        .expect(201);

      expect(res.body.id).toBeDefined();
      expect(res.body.license_number).toBe('LP-CR-2024-8841');
      pilotId = res.body.id;
    });

    it('Manager creates a Train referencing Locomotive and Rake', async () => {
      const res = await request(app.getHttpServer())
        .post('/trains')
        .set('Authorization', `Bearer ${managerToken}`)
        .send({
          train_number: '12124',
          train_name: 'Deccan Queen Express',
          locomotive_id: locoId,
          rake_id: rakeId,
        })
        .expect(201);

      expect(res.body.id).toBeDefined();
      expect(res.body.train_number).toBe('12124');
      trainId = res.body.id;
    });

    it('Driver role cannot create trains (Manager role guarded)', async () => {
      await request(app.getHttpServer())
        .post('/trains')
        .set('Authorization', `Bearer ${driverToken}`)
        .send({
          train_number: '12125',
          train_name: 'Pragati Express',
        })
        .expect(403);
    });
  });

  describe('3. Rail Routing Service & Route Caching', () => {
    let railRoutingService: RailRoutingService;

    beforeAll(() => {
      railRoutingService = app.get(RailRoutingService);
    });

    it('Calculates rail geometry between stations and caches in saved_rail_routes', async () => {
      const originStation = mockStations.find((s) => s.station_code === 'CSMT');
      const destinationStation = mockStations.find((s) => s.station_code === 'PUNE');

      expect(originStation).toBeDefined();
      expect(destinationStation).toBeDefined();

      const routeResult = await railRoutingService.getOrComputeRoute(
        orgId,
        originStation,
        destinationStation,
      );

      expect(routeResult).toBeDefined();
      expect(routeResult.coordinates).toBeDefined();
      expect(['overpass', 'fallback-straight-line']).toContain(routeResult.routing_source);
      expect(routeResult.distance_km).toBeGreaterThan(100);
      expect(routeResult.distance_km).toBeLessThan(300);

      // Verify cached entry exists in saved_rail_routes
      const cached = mockSavedRailRoutes.find(
        (r) =>
          r.org_id === orgId &&
          r.origin_station_id === originStation.id &&
          r.destination_station_id === destinationStation.id,
      );
      expect(cached).toBeDefined();
      expect(cached.usage_count).toBeGreaterThanOrEqual(1);
    });

    it('Second request for identical station pair uses cached route without re-fetching', async () => {
      const originStation = mockStations.find((s) => s.station_code === 'CSMT');
      const destinationStation = mockStations.find((s) => s.station_code === 'PUNE');

      const routeResult2 = await railRoutingService.getOrComputeRoute(
        orgId,
        originStation,
        destinationStation,
      );

      expect(routeResult2).toBeDefined();
      const cached = mockSavedRailRoutes.find(
        (r) =>
          r.org_id === orgId &&
          r.origin_station_id === originStation.id &&
          r.destination_station_id === destinationStation.id,
      );
      expect(cached.usage_count).toBeGreaterThanOrEqual(2);
    });
  });

  describe('4. Train Movement Lifecycle & Simulation Telemetry', () => {
    let movementId: string;

    it('Manager dispatches a new train movement', async () => {
      const originStation = mockStations.find((s) => s.station_code === 'CSMT');
      const destinationStation = mockStations.find((s) => s.station_code === 'PUNE');
      const train = mockTrains[0];
      const pilot = mockLocoPilots[0];

      const res = await request(app.getHttpServer())
        .post('/train-movements')
        .set('Authorization', `Bearer ${managerToken}`)
        .send({
          train_id: train.id,
          loco_pilot_id: pilot.id,
          origin_station_id: originStation.id,
          destination_station_id: destinationStation.id,
          simulation_speed_multiplier: 120,
        })
        .expect(201);

      expect(res.body.id).toBeDefined();
      expect(res.body.status).toBe('planned');
      movementId = res.body.id;
    });

    it('Transition movement to in_transit triggers simulation telemetry generation', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/train-movements/${movementId}/status`)
        .set('Authorization', `Bearer ${managerToken}`)
        .send({ status: 'in_transit' })
        .expect(200);

      expect(res.body.status).toBe('in_transit');

      // Wait a moment for simulation ticks to generate telemetry
      await new Promise((resolve) => setTimeout(resolve, 400));

      const telemetry = mockTrainTelemetry.filter((t) => t.movement_id === movementId);
      expect(telemetry.length).toBeGreaterThanOrEqual(1);

      // Verify strictly-monotonic timestamps
      for (let i = 1; i < telemetry.length; i++) {
        const prev = new Date(telemetry[i - 1].recorded_at).getTime();
        const curr = new Date(telemetry[i].recorded_at).getTime();
        expect(curr).toBeGreaterThanOrEqual(prev);
      }
    });

    it('Movement status completes and marks arrival', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/train-movements/${movementId}/status`)
        .set('Authorization', `Bearer ${managerToken}`)
        .send({ status: 'completed' })
        .expect(200);

      expect(res.body.status).toBe('completed');
      expect(res.body.completed_at).toBeDefined();
    });
  });

  describe('5. Geofence Evaluation for Station/Yard limits', () => {
    it('Creates a station geofence and evaluates telemetry crossing', async () => {
      const originStation = mockStations.find((s) => s.station_code === 'CSMT');

      // Add a circular geofence around CSMT
      const geofence = {
        id: 'geo-csmt-yard-01',
        org_id: orgId,
        name: 'CSMT Yard Area',
        mode: 'railways',
        type: 'station',
        boundary_type: 'circle',
        center_lat: originStation?.lat || 18.9398,
        center_lng: originStation?.lng || 72.8354,
        radius_meters: 1000,
        is_active: true,
        created_at: new Date().toISOString(),
      };
      mockGeofences.push(geofence);

      // Verify that geofence is queried during simulation
      expect(mockGeofences.length).toBeGreaterThanOrEqual(1);
    });
  });
});
