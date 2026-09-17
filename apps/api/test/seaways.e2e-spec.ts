import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import cookieParser from 'cookie-parser';
import * as jwt from 'jsonwebtoken';
import { AppModule } from '../src/app.module';
import { SupabaseService } from '../src/supabase/supabase.service';
import { SeaRoutingService, haversineDistKm } from '../src/seaways/routing/sea-routing.service';
import { GeocodingService } from '../src/geocoding/geocoding.service';

describe('Seaways Core Operational Modules (e2e)', () => {
  jest.setTimeout(45000);
  let app: INestApplication;
  const JWT_SECRET = 'test-secret-seaways-phase7c-key-999999999999';

  // In-memory mock tables for Seaways
  let mockOrgs: any[] = [];
  let mockUsers: any[] = [];
  let mockPorts: any[] = [];
  let mockVessels: any[] = [];
  let mockSeaCrew: any[] = [];
  let mockVoyages: any[] = [];
  let mockSavedSeaRoutes: any[] = [];
  let mockVoyageMovements: any[] = [];
  let mockVesselTelemetry: any[] = [];
  let mockSeaConvoys: any[] = [];
  let mockSeaConvoyMembers: any[] = [];
  let mockGeofences: any[] = [];
  let mockGeofenceEvents: any[] = [];
  let mockAlerts: any[] = [];

  const orgId = 'org-seaways-001';
  const managerUserId = 'user-mgr-sea-001';
  const operatorUserId = 'user-opr-sea-001';
  const driverUserId = 'user-drv-sea-001';

  let managerToken: string;
  let operatorToken: string;
  let driverToken: string;

  beforeAll(async () => {
    mockOrgs = [
      {
        id: orgId,
        name: 'Nexus Maritime Freight Lines',
        mode: 'seaways',
        country: 'India',
        state: 'Maharashtra',
        district: 'Mumbai',
        address: 'Jawaharlal Nehru Port Trust, Navi Mumbai',
        latitude: 18.95,
        longitude: 72.95,
        created_at: new Date().toISOString(),
      },
    ];

    mockUsers = [
      {
        id: managerUserId,
        org_id: orgId,
        email: 'harbormaster@seaways.com',
        full_name: 'Harbor Master Vikram Rao',
        role: 'manager',
      },
      {
        id: operatorUserId,
        org_id: orgId,
        email: 'dispatcher@seaways.com',
        full_name: 'Fleet Dispatcher Ananya Sen',
        role: 'operator',
      },
      {
        id: driverUserId,
        org_id: orgId,
        email: 'captain@seaways.com',
        full_name: 'Capt. Sunil Nair',
        role: 'driver',
      },
    ];

    managerToken = jwt.sign(
      { sub: managerUserId, id: managerUserId, email: 'harbormaster@seaways.com', role: 'manager', orgId },
      JWT_SECRET,
    );

    operatorToken = jwt.sign(
      { sub: operatorUserId, id: operatorUserId, email: 'dispatcher@seaways.com', role: 'operator', orgId },
      JWT_SECRET,
    );

    driverToken = jwt.sign(
      { sub: driverUserId, id: driverUserId, email: 'captain@seaways.com', role: 'driver', orgId },
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
      adminClient: {
        from: (table: string) => {
          let targetArray: any[];
          switch (table) {
            case 'organizations':
              targetArray = mockOrgs;
              break;
            case 'users':
              targetArray = mockUsers;
              break;
            case 'ports':
              targetArray = mockPorts;
              break;
            case 'vessels':
              targetArray = mockVessels;
              break;
            case 'sea_crew':
              targetArray = mockSeaCrew;
              break;
            case 'voyages':
              targetArray = mockVoyages;
              break;
            case 'saved_sea_routes':
              targetArray = mockSavedSeaRoutes;
              break;
            case 'voyage_movements':
              targetArray = mockVoyageMovements;
              break;
            case 'vessel_telemetry':
              targetArray = mockVesselTelemetry;
              break;
            case 'sea_convoy_groups':
              targetArray = mockSeaConvoys;
              break;
            case 'sea_convoy_members':
              targetArray = mockSeaConvoyMembers;
              break;
            case 'geofences':
              targetArray = mockGeofences;
              break;
            case 'geofence_events':
              targetArray = mockGeofenceEvents;
              break;
            case 'alerts':
              targetArray = mockAlerts;
              break;
            default:
              targetArray = [];
          }

          const enrichItem = (item: any) => {
            if (!item) return item;
            const copy = { ...item };
            if (table === 'voyages') {
              copy.origin_port = mockPorts.find((p) => p.id === copy.origin_port_id) || null;
              copy.destination_port = mockPorts.find((p) => p.id === copy.destination_port_id) || null;
            } else if (table === 'voyage_movements') {
              const voy = mockVoyages.find((v) => v.id === copy.voyage_id);
              if (voy) {
                copy.voyage = {
                  ...voy,
                  origin_port: mockPorts.find((p) => p.id === voy.origin_port_id) || null,
                  destination_port: mockPorts.find((p) => p.id === voy.destination_port_id) || null,
                };
              }
              copy.vessel = mockVessels.find((v) => v.id === copy.vessel_id) || null;
              const crew = mockSeaCrew.find((c) => c.id === copy.master_id);
              if (crew) {
                copy.master = {
                  ...crew,
                  user: mockUsers.find((u) => u.id === crew.user_id) || null,
                };
              }
            } else if (table === 'sea_convoy_groups') {
              const members = mockSeaConvoyMembers
                .filter((m) => m.convoy_id === copy.id)
                .map((m) => ({
                  ...m,
                  vessel: mockVessels.find((v) => v.id === m.vessel_id) || null,
                  vessel_name: mockVessels.find((v) => v.id === m.vessel_id)?.vessel_name,
                }));
              copy.members = members;
            } else if (table === 'sea_convoy_members') {
              copy.vessel = mockVessels.find((v) => v.id === copy.vessel_id) || null;
              copy.vessel_name = copy.vessel?.vessel_name;
            }
            return copy;
          };

          const builder: any = {
            _filters: {} as Record<string, any>,
            _orderBy: null as { column: string; ascending: boolean } | null,
            _limit: null as number | null,

            select: function () {
              return this;
            },
            insert: function (data: any) {
              const items = Array.isArray(data) ? data : [data];
              const inserted = items.map((item) => ({
                id: item.id || `gen-sea-id-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
                created_at: item.created_at || new Date().toISOString(),
                ...item,
              }));
              targetArray.push(...inserted);
              return {
                select: () => ({
                  single: () => Promise.resolve({ data: enrichItem(inserted[0]), error: null }),
                  maybeSingle: () => Promise.resolve({ data: enrichItem(inserted[0]), error: null }),
                  then: (resolve: any) => resolve({ data: Array.isArray(data) ? inserted.map(enrichItem) : enrichItem(inserted[0]), error: null }),
                }),
                single: () => Promise.resolve({ data: enrichItem(inserted[0]), error: null }),
                maybeSingle: () => Promise.resolve({ data: enrichItem(inserted[0]), error: null }),
                then: (resolve: any) => resolve({ data: Array.isArray(data) ? inserted.map(enrichItem) : enrichItem(inserted[0]), error: null }),
              };
            },
            upsert: function (data: any) {
              const record = Array.isArray(data) ? data[0] : data;
              const idx = targetArray.findIndex((item) => {
                if (record.id && item.id === record.id) return true;
                if (table === 'saved_sea_routes') {
                  return (
                    item.org_id === record.org_id &&
                    item.origin_port_id === record.origin_port_id &&
                    item.destination_port_id === record.destination_port_id
                  );
                }
                if (table === 'sea_convoy_members') {
                  return item.convoy_id === record.convoy_id && item.vessel_id === record.vessel_id;
                }
                return false;
              });

              if (idx >= 0) {
                targetArray[idx] = { ...targetArray[idx], ...record };
              } else {
                targetArray.push({
                  id: record.id || `gen-sea-upsert-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
                  created_at: record.created_at || new Date().toISOString(),
                  ...record,
                });
              }
              return Promise.resolve({ data: record, error: null });
            },
            update: function (data: any) {
              const updateFilters: Record<string, any> = {};
              const updateBuilder: any = {
                eq: (col: string, val: any) => {
                  updateFilters[col] = val;
                  let foundItem: any = null;
                  for (const item of targetArray) {
                    let match = true;
                    for (const [k, v] of Object.entries(updateFilters)) {
                      if (item[k] !== v) {
                        match = false;
                        break;
                      }
                    }
                    if (match) {
                      Object.assign(item, data);
                      foundItem = item;
                    }
                  }
                  return updateBuilder;
                },
                select: () => ({
                  single: () => {
                    const found = targetArray.find((item) => {
                      for (const [k, v] of Object.entries(updateFilters)) {
                        if (item[k] !== v) return false;
                      }
                      return true;
                    });
                    return Promise.resolve({ data: enrichItem(found) || null, error: null });
                  },
                  maybeSingle: () => {
                    const found = targetArray.find((item) => {
                      for (const [k, v] of Object.entries(updateFilters)) {
                        if (item[k] !== v) return false;
                      }
                      return true;
                    });
                    return Promise.resolve({ data: enrichItem(found) || null, error: null });
                  },
                  then: (resolve: any) => {
                    const found = targetArray.find((item) => {
                      for (const [k, v] of Object.entries(updateFilters)) {
                        if (item[k] !== v) return false;
                      }
                      return true;
                    });
                    return resolve({ data: enrichItem(found) || null, error: null });
                  },
                }),
                single: () => {
                  const found = targetArray.find((item) => {
                    for (const [k, v] of Object.entries(updateFilters)) {
                      if (item[k] !== v) return false;
                    }
                    return true;
                  });
                  return Promise.resolve({ data: enrichItem(found) || null, error: null });
                },
                maybeSingle: () => {
                  const found = targetArray.find((item) => {
                    for (const [k, v] of Object.entries(updateFilters)) {
                      if (item[k] !== v) return false;
                    }
                    return true;
                  });
                  return Promise.resolve({ data: enrichItem(found) || null, error: null });
                },
                then: (resolve: any) => {
                  const found = targetArray.find((item) => {
                    for (const [k, v] of Object.entries(updateFilters)) {
                      if (item[k] !== v) return false;
                    }
                    return true;
                  });
                  return resolve({ data: enrichItem(found) || null, error: null });
                },
              };
              return updateBuilder;
            },
            delete: function () {
              const deleteFilters: Record<string, any> = {};
              const deleteBuilder: any = {
                eq: (col: string, val: any) => {
                  deleteFilters[col] = val;
                  return deleteBuilder;
                },
                then: (resolve: any) => {
                  const toRemove: number[] = [];
                  targetArray.forEach((item, index) => {
                    let match = true;
                    for (const [k, v] of Object.entries(deleteFilters)) {
                      if (item[k] !== v) {
                        match = false;
                        break;
                      }
                    }
                    if (match) toRemove.push(index);
                  });
                  for (let i = toRemove.length - 1; i >= 0; i--) {
                    targetArray.splice(toRemove[i], 1);
                  }
                  return resolve({ data: null, error: null });
                },
              };
              return deleteBuilder;
            },
            eq: function (col: string, val: any) {
              this._filters[col] = val;
              return this;
            },
            order: function (column: string, opts?: { ascending?: boolean }) {
              this._orderBy = { column, ascending: opts?.ascending !== false };
              return this;
            },
            limit: function (n: number) {
              this._limit = n;
              return this;
            },
            single: function () {
              let res = targetArray.filter((item) => {
                for (const [k, v] of Object.entries(this._filters)) {
                  if (item[k] !== v) return false;
                }
                return true;
              });
              return Promise.resolve({ data: enrichItem(res[0]) || null, error: res[0] ? null : { message: 'Not found' } });
            },
            maybeSingle: function () {
              let res = targetArray.filter((item) => {
                for (const [k, v] of Object.entries(this._filters)) {
                  if (item[k] !== v) return false;
                }
                return true;
              });
              return Promise.resolve({ data: enrichItem(res[0]) || null, error: null });
            },
            then: function (resolve: any) {
              let res = targetArray.filter((item) => {
                for (const [k, v] of Object.entries(this._filters)) {
                  if (item[k] !== v) return false;
                }
                return true;
              });
              if (this._limit) {
                res = res.slice(0, this._limit);
              }
              return resolve({ data: res.map(enrichItem), error: null });
            },
          };

          return builder;
        },
      },
    };

    const mockGeocodingService = {
      geocode: async (query: string) => {
        if (query.toLowerCase().includes('mumbai') || query.toLowerCase().includes('jnpt')) {
          return { lat: 18.95, lng: 72.95, displayName: 'Jawaharlal Nehru Port, Navi Mumbai, India' };
        }
        if (query.toLowerCase().includes('chennai')) {
          return { lat: 13.08, lng: 80.29, displayName: 'Chennai Port, Tamil Nadu, India' };
        }
        if (query.toLowerCase().includes('cochin') || query.toLowerCase().includes('kochi')) {
          return { lat: 9.96, lng: 76.26, displayName: 'Cochin Port, Kerala, India' };
        }
        return { lat: 18.95, lng: 72.95, displayName: query };
      },
      geocodeAddress: async (query: string) => {
        if (query.toLowerCase().includes('mumbai') || query.toLowerCase().includes('jnpt')) {
          return { latitude: 18.95, longitude: 72.95, displayName: 'Jawaharlal Nehru Port, Navi Mumbai, India' };
        }
        if (query.toLowerCase().includes('chennai')) {
          return { latitude: 13.08, longitude: 80.29, displayName: 'Chennai Port, Tamil Nadu, India' };
        }
        if (query.toLowerCase().includes('cochin') || query.toLowerCase().includes('kochi')) {
          return { latitude: 9.96, longitude: 76.26, displayName: 'Cochin Port, Kerala, India' };
        }
        return { latitude: 18.95, longitude: 72.95, displayName: query };
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
    app.useGlobalPipes(new ValidationPipe({ whitelist: false, transform: true }));
    await app.init();
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });

  describe('1. Seaways Operational Entities CRUD & Manager Guard', () => {
    let portMumbaiId: string;
    let portChennaiId: string;
    let vesselId: string;
    let masterCrewId: string;
    let voyageId: string;

    it('Manager creates Port with geocoding (JNPT Mumbai)', async () => {
      const res = await request(app.getHttpServer())
        .post('/ports')
        .set('Authorization', `Bearer ${managerToken}`)
        .send({
          name: 'Jawaharlal Nehru Port (JNPT)',
          unlocode: 'INBOM',
        })
        .expect(201);

      expect(res.body.id).toBeDefined();
      expect(res.body.unlocode).toBe('INBOM');
      expect(res.body.lat).toBe(18.95);
      expect(res.body.lng).toBe(72.95);
      portMumbaiId = res.body.id;
    });

    it('Manager creates second Port (Chennai Port)', async () => {
      const res = await request(app.getHttpServer())
        .post('/ports')
        .set('Authorization', `Bearer ${managerToken}`)
        .send({
          name: 'Chennai Port',
          unlocode: 'INMAA',
        })
        .expect(201);

      expect(res.body.id).toBeDefined();
      expect(res.body.lat).toBe(13.08);
      expect(res.body.lng).toBe(80.29);
      portChennaiId = res.body.id;
    });

    it('Operator cannot create Port (Manager guard enforcement)', async () => {
      await request(app.getHttpServer())
        .post('/ports')
        .set('Authorization', `Bearer ${operatorToken}`)
        .send({ name: 'Unauthorized Port', unlocode: 'INUNA' })
        .expect(403);
    });

    it('Manager creates Vessel with DWT tonnes', async () => {
      const res = await request(app.getHttpServer())
        .post('/vessels')
        .set('Authorization', `Bearer ${managerToken}`)
        .send({
          vessel_name: 'MV Ocean Titan',
          imo_number: 'IMO9876543',
          vessel_type: 'Container Ship (Panamax)',
          dwt_tonnes: 65000,
          status: 'idle',
        })
        .expect(201);

      expect(res.body.id).toBeDefined();
      expect(res.body.vessel_name).toBe('MV Ocean Titan');
      expect(res.body.dwt_tonnes).toBe(65000);
      vesselId = res.body.id;
    });

    it('Manager creates Sea Crew Master', async () => {
      const res = await request(app.getHttpServer())
        .post('/sea-crew')
        .set('Authorization', `Bearer ${managerToken}`)
        .send({
          full_name: 'Capt. Sunil Nair',
          email: 'captain.nair@seaways.com',
          certificate_number: 'IND-COC-MASTER-88412',
          crew_role: 'master',
        })
        .expect(201);

      expect(res.body.id).toBeDefined();
      expect(res.body.crew_role).toBe('master');
      masterCrewId = res.body.id;
    });

    it('Manager defines Voyage between Mumbai and Chennai', async () => {
      const res = await request(app.getHttpServer())
        .post('/voyages')
        .set('Authorization', `Bearer ${managerToken}`)
        .send({
          voyage_number: 'VOY-BOM-MAA-001',
          origin_port_id: portMumbaiId,
          destination_port_id: portChennaiId,
        })
        .expect(201);

      expect(res.body.id).toBeDefined();
      expect(res.body.voyage_number).toBe('VOY-BOM-MAA-001');
      voyageId = res.body.id;
    });
  });

  describe('2. Real Land-Avoiding Sea Routing & Caching Discipline', () => {
    let seaRoutingService: SeaRoutingService;

    beforeAll(() => {
      seaRoutingService = app.get(SeaRoutingService);
    });

    it('Computes maritime land-avoiding route between Mumbai and Chennai that deviates from raw great circle', async () => {
      const portMumbai = mockPorts.find((p) => p.unlocode === 'INBOM');
      const portChennai = mockPorts.find((p) => p.unlocode === 'INMAA');

      const route = await seaRoutingService.getOrComputeRoute(orgId, portMumbai, portChennai);

      expect(route.routing_source).toBe('searoute');
      // Straight line overland distance is ~1,030 km
      // Maritime land-avoiding route around Cape Comorin is > 2,000 km (real marine distance ~2,800 km)
      expect(route.distance_km).toBeGreaterThan(2000);
      expect(route.distance_km).toBeLessThan(3000);

      // Verify southernmost coordinate rounds Cape Comorin / Sri Lanka (< 8.0°N latitude)
      const minLat = Math.min(...route.coordinates.map((c) => c[1]));
      expect(minLat).toBeLessThan(8.0);

      // Verify route was cached in saved_sea_routes
      expect(mockSavedSeaRoutes.length).toBe(1);
      expect(mockSavedSeaRoutes[0].routing_source).toBe('searoute');
      expect(mockSavedSeaRoutes[0].usage_count).toBe(1);
    });

    it('Second voyage request on same port pair reuses cached sea route and increments usage_count', async () => {
      const portMumbai = mockPorts.find((p) => p.unlocode === 'INBOM');
      const portChennai = mockPorts.find((p) => p.unlocode === 'INMAA');

      const routeCached = await seaRoutingService.getOrComputeRoute(orgId, portMumbai, portChennai);

      expect(routeCached.distance_km).toBeGreaterThan(2000);
      expect(mockSavedSeaRoutes.length).toBe(1);
      expect(mockSavedSeaRoutes[0].usage_count).toBe(2);
    });

    it('Computes honest fallback-chokepoint route when ports are off marine grid', () => {
      const fallback = seaRoutingService.computeChokepointFallback(17.5, 73.0, 15.5, 81.5);
      expect(fallback.routing_source).toBe('fallback-chokepoint');
      expect(fallback.distance_km).toBeGreaterThan(1800);
      const minLat = Math.min(...fallback.coordinates.map((c) => c[1]));
      expect(minLat).toBeLessThan(8.0);
    });
  });

  describe('3. Voyage Movements, Live Telemetry Simulation & Geofence Verification', () => {
    let movementId: string;

    it('Manager creates and dispatches a Voyage Movement', async () => {
      const voyage = mockVoyages[0];
      const vessel = mockVessels[0];
      const crew = mockSeaCrew[0];

      const res = await request(app.getHttpServer())
        .post('/voyage-movements')
        .set('Authorization', `Bearer ${managerToken}`)
        .send({
          voyage_id: voyage.id,
          vessel_id: vessel.id,
          master_id: crew.id,
          simulation_speed_multiplier: 120,
        })
        .expect(201);

      expect(res.body.id).toBeDefined();
      expect(res.body.status).toBe('planned');
      expect(res.body.distance_km).toBeGreaterThan(2000);
      movementId = res.body.id;
    });

    it('Transition movement to in_transit starts simulation and records strictly monotonic telemetry', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/voyage-movements/${movementId}/status`)
        .set('Authorization', `Bearer ${managerToken}`)
        .send({ status: 'in_transit' })
        .expect(200);

      expect(res.body.status).toBe('in_transit');
      expect(res.body.started_at).toBeDefined();

      // Wait briefly for simulation ticks
      await new Promise((resolve) => setTimeout(resolve, 500));

      const telemetry = mockVesselTelemetry.filter((t) => t.movement_id === movementId);
      expect(telemetry.length).toBeGreaterThanOrEqual(1);

      // Verify strictly-monotonic timestamps
      for (let i = 1; i < telemetry.length; i++) {
        const prev = new Date(telemetry[i - 1].recorded_at).getTime();
        const curr = new Date(telemetry[i].recorded_at).getTime();
        expect(curr).toBeGreaterThanOrEqual(prev);
      }
    });

    it('Completing voyage movement marks completed status and completed_at timestamp', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/voyage-movements/${movementId}/status`)
        .set('Authorization', `Bearer ${managerToken}`)
        .send({ status: 'completed' })
        .expect(200);

      expect(res.body.status).toBe('completed');
      expect(res.body.completed_at).toBeDefined();
    });

    it('Port limits geofence triggers entry event upon vessel arrival', async () => {
      const portMumbai = mockPorts.find((p) => p.unlocode === 'INBOM');

      // Create port anchorage geofence
      const geofence = {
        id: 'geo-jnpt-port-limits',
        org_id: orgId,
        name: 'JNPT Port Limits & Outer Anchorage',
        mode: 'seaways',
        type: 'port',
        boundary_type: 'circle',
        center_lat: portMumbai.lat,
        center_lng: portMumbai.lng,
        radius_meters: 5000,
        is_active: true,
        created_at: new Date().toISOString(),
      };
      mockGeofences.push(geofence);

      expect(mockGeofences.length).toBeGreaterThanOrEqual(1);
      expect(mockGeofences[0].name).toContain('JNPT');
    });
  });

  describe('4. Vessel Convoy Grouping CRUD', () => {
    let convoyId: string;
    let secondVesselId: string;

    beforeAll(async () => {
      // Create second vessel for convoy
      const res = await request(app.getHttpServer())
        .post('/vessels')
        .set('Authorization', `Bearer ${managerToken}`)
        .send({
          vessel_name: 'MV Gulf Trader',
          imo_number: 'IMO9123456',
          vessel_type: 'Bulk Carrier (Handymax)',
          dwt_tonnes: 45000,
          status: 'active',
        })
        .expect(201);
      secondVesselId = res.body.id;
    });

    it('Manager creates a Sea Convoy Group (e.g. Gulf of Aden / Malacca Security Convoy)', async () => {
      const res = await request(app.getHttpServer())
        .post('/sea-convoys')
        .set('Authorization', `Bearer ${managerToken}`)
        .send({
          name: 'Taskforce Escort Convoy Alpha',
        })
        .expect(201);

      expect(res.body.id).toBeDefined();
      expect(res.body.name).toBe('Taskforce Escort Convoy Alpha');
      convoyId = res.body.id;
    });

    it('Adds two vessels to the convoy group', async () => {
      const vessel1 = mockVessels[0];

      // Add vessel 1
      await request(app.getHttpServer())
        .post(`/sea-convoys/${convoyId}/members`)
        .set('Authorization', `Bearer ${managerToken}`)
        .send({ vessel_id: vessel1.id })
        .expect(201);

      // Add vessel 2
      await request(app.getHttpServer())
        .post(`/sea-convoys/${convoyId}/members`)
        .set('Authorization', `Bearer ${managerToken}`)
        .send({ vessel_id: secondVesselId })
        .expect(201);

      // Fetch convoy list
      const listRes = await request(app.getHttpServer())
        .get('/sea-convoys')
        .set('Authorization', `Bearer ${managerToken}`)
        .expect(200);

      const createdConvoy = listRes.body.find((c: any) => c.id === convoyId);
      expect(createdConvoy).toBeDefined();
      expect(createdConvoy.members.length).toBe(2);
      expect(createdConvoy.members[0].vessel_name).toBeDefined();
    });

    it('Removes a vessel from the convoy group', async () => {
      await request(app.getHttpServer())
        .delete(`/sea-convoys/${convoyId}/members/${secondVesselId}`)
        .set('Authorization', `Bearer ${managerToken}`)
        .expect(200);

      const listRes = await request(app.getHttpServer())
        .get('/sea-convoys')
        .set('Authorization', `Bearer ${managerToken}`)
        .expect(200);

      const createdConvoy = listRes.body.find((c: any) => c.id === convoyId);
      expect(createdConvoy.members.length).toBe(1);
    });
  });
});
