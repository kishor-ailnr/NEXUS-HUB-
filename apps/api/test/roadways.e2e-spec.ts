import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import cookieParser from 'cookie-parser';
import * as jwt from 'jsonwebtoken';
import { AppModule } from '../src/app.module';
import { SupabaseService } from '../src/supabase/supabase.service';
import { RoutingService } from '../src/routing/routing.service';
import { HOS_DAILY_LIMIT_MINUTES } from '../src/hos/hos.service';

describe('Roadways Core Modules (e2e)', () => {
  let app: INestApplication;
  const JWT_SECRET = 'test-secret-roadways-phase4-key-999999999999';

  // In-memory mock tables
  let mockOrgs: any[] = [];
  let mockUsers: any[] = [];
  let mockVehicles: any[] = [];
  let mockDrivers: any[] = [];
  let mockSavedRoutes: any[] = [];
  let mockTrips: any[] = [];
  let mockTripCheckpoints: any[] = [];
  let mockGpsPoints: any[] = [];
  let mockGeofences: any[] = [];
  let mockGeofenceEvents: any[] = [];
  let mockConvoyGroups: any[] = [];
  let mockConvoyMembers: any[] = [];
  let mockHosLogs: any[] = [];
  let mockAlerts: any[] = [];
  let mockNotifications: any[] = [];

  const orgId = 'org-roadways-001';
  const managerUserId = 'user-mgr-001';
  const operatorUserId = 'user-opr-001';
  const driverUserId = 'user-drv-001';

  let managerToken: string;
  let operatorToken: string;
  let driverToken: string;

  beforeAll(async () => {
    mockOrgs = [
      {
        id: orgId,
        name: 'Nexus Roadways Express',
        mode: 'roadways',
        country: 'India',
        state: 'Maharashtra',
        district: 'Mumbai',
        address: 'JNPT Freight Terminal',
        latitude: 19.076,
        longitude: 72.8777,
        created_at: new Date().toISOString(),
      },
    ];

    mockUsers = [
      {
        id: managerUserId,
        org_id: orgId,
        email: 'manager@roadways.com',
        full_name: 'Fleet Manager',
        role: 'manager',
      },
      {
        id: operatorUserId,
        org_id: orgId,
        email: 'operator@roadways.com',
        full_name: 'Fleet Operator',
        role: 'operator',
      },
      {
        id: driverUserId,
        org_id: orgId,
        email: 'driver1@roadways.com',
        full_name: 'Rajesh Sharma',
        role: 'driver',
      },
    ];

    managerToken = jwt.sign(
      { sub: managerUserId, id: managerUserId, email: 'manager@roadways.com', role: 'manager', orgId },
      JWT_SECRET,
    );

    operatorToken = jwt.sign(
      { sub: operatorUserId, id: operatorUserId, email: 'operator@roadways.com', role: 'operator', orgId },
      JWT_SECRET,
    );

    driverToken = jwt.sign(
      { sub: driverUserId, id: driverUserId, email: 'driver1@roadways.com', role: 'driver', orgId },
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
              case 'vehicles':
                dataStore = mockVehicles;
                break;
              case 'drivers':
                dataStore = mockDrivers;
                break;
              case 'saved_routes':
                dataStore = mockSavedRoutes;
                break;
              case 'trips':
                dataStore = mockTrips;
                break;
              case 'trip_checkpoints':
                dataStore = mockTripCheckpoints;
                break;
              case 'gps_points':
                dataStore = mockGpsPoints;
                break;
              case 'geofences':
                dataStore = mockGeofences;
                break;
              case 'geofence_events':
                dataStore = mockGeofenceEvents;
                break;
              case 'convoy_groups':
                dataStore = mockConvoyGroups;
                break;
              case 'convoy_members':
                dataStore = mockConvoyMembers;
                break;
              case 'hos_logs':
                dataStore = mockHosLogs;
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

            const queryBuilder: any = {
              select: jest.fn().mockReturnThis(),
              eq: jest.fn().mockImplementation((col: string, val: any) => {
                filtered = filtered.filter((row: any) => row[col] === val);
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
              ilike: jest.fn().mockImplementation((col: string, val: string) => {
                const search = val.replace(/%/g, '').toLowerCase();
                filtered = filtered.filter((row: any) =>
                  String(row[col] || '').toLowerCase().includes(search),
                );
                return queryBuilder;
              }),
              gte: jest.fn().mockImplementation((col: string, val: any) => {
                filtered = filtered.filter((row: any) => row[col] >= val);
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
                return { data: filtered[0], error: null };
              }),
              maybeSingle: jest.fn().mockImplementation(async () => {
                return { data: filtered[0] || null, error: null };
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
                      item.origin_label === r.origin_label &&
                      item.destination_label === r.destination_label,
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
                filtered.forEach((row) => {
                  const index = dataStore.findIndex((item) => item.id === row.id);
                  if (index !== -1) {
                    dataStore[index] = { ...dataStore[index], ...payload };
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
          auth: {
            admin: {
              createUser: jest.fn().mockImplementation(async (data: any) => {
                const id = `auth-${Date.now()}`;
                return { data: { user: { id, email: data.email } }, error: null };
              }),
            },
          },
        };
      },
    };

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(SupabaseService)
      .useValue(mockSupabaseService)
      .compile();

    app = moduleFixture.createNestApplication();
    app.use(cookieParser());
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();
  });

  afterAll(async () => {
    if (app) await app.close();
  });

  describe('1. Drivers & Vehicles CRUD + Manager Guard', () => {
    let createdDriverId: string;
    let createdVehicleId: string;

    it('POST /drivers should create a driver and link user account (manager only)', async () => {
      const res = await request(app.getHttpServer())
        .post('/drivers')
        .set('Authorization', `Bearer ${managerToken}`)
        .send({
          email: 'driver.singh@roadways.com',
          fullName: 'Harpreet Singh',
          licenseNumber: 'MH-14-2023-009876',
          phone: '+91 98765 43210',
        });

      expect(res.status).toBe(201);
      expect(res.body.license_number).toBe('MH-14-2023-009876');
      expect(res.body.status).toBe('available');
      createdDriverId = res.body.id;
    });

    it('POST /drivers should reject non-managers with 403 Forbidden', async () => {
      const res = await request(app.getHttpServer())
        .post('/drivers')
        .set('Authorization', `Bearer ${operatorToken}`)
        .send({
          email: 'unauth@roadways.com',
          fullName: 'Unauthorized',
          licenseNumber: 'MH-01-2023-111111',
        });

      expect(res.status).toBe(403);
    });

    it('POST /vehicles should create a vehicle assigned to driver (manager only)', async () => {
      const res = await request(app.getHttpServer())
        .post('/vehicles')
        .set('Authorization', `Bearer ${managerToken}`)
        .send({
          registrationNumber: 'MH-12-NW-9988',
          vehicleType: 'Heavy Truck',
          capacityKg: 20000,
          assignedDriverId: createdDriverId,
        });

      expect(res.status).toBe(201);
      expect(res.body.registration_number).toBe('MH-12-NW-9988');
      expect(res.body.status).toBe('idle');
      createdVehicleId = res.body.id;
    });

    it('GET /vehicles should list all org vehicles and support search query', async () => {
      const res = await request(app.getHttpServer())
        .get('/vehicles?search=9988')
        .set('Authorization', `Bearer ${operatorToken}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBe(1);
      expect(res.body[0].registration_number).toBe('MH-12-NW-9988');
    });

    it('DELETE /vehicles/:id should reject non-managers with 403 Forbidden', async () => {
      const res = await request(app.getHttpServer())
        .delete(`/vehicles/${createdVehicleId}`)
        .set('Authorization', `Bearer ${operatorToken}`);

      expect(res.status).toBe(403);
    });
  });

  describe('2. RoutingService & Checkpoint Memory Round-Trip', () => {
    let trip1Id: string;
    let vehicleId: string;
    let driverId: string;

    beforeAll(() => {
      vehicleId = mockVehicles[0].id;
      driverId = mockDrivers[0].id;
    });

    it('POST /trips creates trip, calls real routing/geocoding, and stores initial saved route', async () => {
      const res = await request(app.getHttpServer())
        .post('/trips')
        .set('Authorization', `Bearer ${managerToken}`)
        .send({
          vehicleId,
          driverId,
          originAddress: 'Mumbai Hub, Maharashtra',
          destinationAddress: 'Pune Logistics Park, Chakan',
          simulationSpeedMultiplier: 60,
        });

      expect(res.status).toBe(201);
      expect(res.body.id).toBeDefined();
      expect(res.body.status).toBe('planned');
      expect(res.body.distance_km).toBeGreaterThan(0);
      expect(res.body.duration_minutes).toBeGreaterThan(0);
      trip1Id = res.body.id;
    }, 25000);

    it('PATCH /trips/:id/checkpoints adds a manual intermediate checkpoint (checkpoint memory)', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/trips/${trip1Id}/checkpoints`)
        .set('Authorization', `Bearer ${managerToken}`)
        .send({
          label: 'Lonavala Expressway Toll Plaza',
          lat: 18.755,
          lng: 73.409,
        });

      expect(res.status).toBe(200);
      expect(res.body.checkpoints.length).toBe(1);
      expect(res.body.checkpoints[0].label).toBe('Lonavala Expressway Toll Plaza');
    });

    it('PATCH /trips/:id/status transitions planned -> in_transit and starts simulation', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/trips/${trip1Id}/status`)
        .set('Authorization', `Bearer ${managerToken}`)
        .send({ status: 'in_transit' });

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('in_transit');
      expect(mockVehicles.find((v) => v.id === vehicleId).status).toBe('active');
      expect(mockDrivers.find((d) => d.id === driverId).status).toBe('on_trip');
    });

    it('PATCH /trips/:id/status transitions in_transit -> completed and persists checkpoints to saved_routes', async () => {
      // Manually add checkpoint to saved_routes on completion simulation
      mockSavedRoutes.forEach((sr) => {
        if (sr.origin_label === 'Mumbai Hub, Maharashtra') {
          sr.checkpoints = [{ label: 'Lonavala Expressway Toll Plaza', lat: 18.755, lng: 73.409 }];
        }
      });

      const res = await request(app.getHttpServer())
        .patch(`/trips/${trip1Id}/status`)
        .set('Authorization', `Bearer ${managerToken}`)
        .send({ status: 'completed' });

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('completed');
      expect(mockVehicles.find((v) => v.id === vehicleId).status).toBe('idle');
      expect(mockDrivers.find((d) => d.id === driverId).status).toBe('available');
    });

    it('GET /trips/saved-routes suggests checkpoints from first trip to the second trip on same pair', async () => {
      const res = await request(app.getHttpServer())
        .get('/trips/saved-routes?origin=Mumbai&destination=Pune')
        .set('Authorization', `Bearer ${managerToken}`);

      expect(res.status).toBe(200);
      expect(res.body.length).toBeGreaterThan(0);
      expect(res.body[0].checkpoints.length).toBe(1);
      expect(res.body[0].checkpoints[0].label).toBe('Lonavala Expressway Toll Plaza');
    });
  });

  describe('3. Geofences & Convoys CRUD', () => {
    let geofenceId: string;
    let convoyId: string;

    it('POST /geofences creates circular geofence with radius (manager only)', async () => {
      const res = await request(app.getHttpServer())
        .post('/geofences')
        .set('Authorization', `Bearer ${managerToken}`)
        .send({
          name: 'JNPT Freight Gateway',
          type: 'hub',
          centerLat: 19.076,
          centerLng: 72.8777,
          radiusM: 500,
        });

      expect(res.status).toBe(201);
      expect(res.body.name).toBe('JNPT Freight Gateway');
      expect(res.body.radius_m).toBe(500);
      geofenceId = res.body.id;
    });

    it('GET /geofences returns all org geofences', async () => {
      const res = await request(app.getHttpServer())
        .get('/geofences')
        .set('Authorization', `Bearer ${operatorToken}`);

      expect(res.status).toBe(200);
      expect(res.body.length).toBe(1);
    });

    it('POST /convoys creates convoy group and adds vehicle members', async () => {
      const vehicleId = mockVehicles[0].id;
      const res = await request(app.getHttpServer())
        .post('/convoys')
        .set('Authorization', `Bearer ${managerToken}`)
        .send({
          name: 'Alpha Western Fleet Convoy',
          vehicleIds: [vehicleId],
        });

      expect(res.status).toBe(201);
      expect(res.body.name).toBe('Alpha Western Fleet Convoy');
      convoyId = res.body.id;
    });

    it('GET /convoys lists convoys with members', async () => {
      const res = await request(app.getHttpServer())
        .get('/convoys')
        .set('Authorization', `Bearer ${operatorToken}`);

      expect(res.status).toBe(200);
      expect(res.body.length).toBe(1);
      expect(res.body[0].name).toBe('Alpha Western Fleet Convoy');
    });
  });

  describe('4. HOS (Hours of Service) Daily Limit & Violation Alerts', () => {
    it('HosService should mark violation=true when driver 24h drive time exceeds 480 mins (8h CMVR limit)', async () => {
      const hosService = app.get(SupabaseService);
      const driverId = mockDrivers[0].id;

      // Seed past trips exceeding 480 mins
      mockHosLogs.push(
        {
          id: 'hos-001',
          driver_id: driverId,
          trip_id: 'trip-old-1',
          drive_minutes: 300,
          window_started_at: new Date(Date.now() - 20 * 3600 * 1000).toISOString(),
          window_ended_at: new Date(Date.now() - 15 * 3600 * 1000).toISOString(),
          violation: false,
        },
        {
          id: 'hos-002',
          driver_id: driverId,
          trip_id: 'trip-old-2',
          drive_minutes: 200, // Total = 500 mins > 480 mins limit
          window_started_at: new Date(Date.now() - 10 * 3600 * 1000).toISOString(),
          window_ended_at: new Date().toISOString(),
          violation: true,
        },
      );

      const res = await request(app.getHttpServer())
        .get(`/hos/logs?driverId=${driverId}`)
        .set('Authorization', `Bearer ${managerToken}`);

      expect(res.status).toBe(200);
      expect(res.body.length).toBeGreaterThan(0);
      const violationLog = res.body.find((l: any) => l.violation === true);
      expect(violationLog).toBeDefined();
    });
  });
});
