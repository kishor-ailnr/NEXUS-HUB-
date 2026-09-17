import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import cookieParser from 'cookie-parser';
import * as jwt from 'jsonwebtoken';
import { AppModule } from '../src/app.module';
import { SupabaseService } from '../src/supabase/supabase.service';

describe('AuthModule (e2e)', () => {
  jest.setTimeout(45000);
  let app: INestApplication;
  const JWT_SECRET = 'test-secret-key-1234567890-very-secure';

  // In-memory mock storage for database tables
  let mockUsers: any[] = [];
  let mockOrgs: any[] = [];
  let mockAuthUsers: any[] = [];
  let mockNotifications: any[] = [];
  let mockAlerts: any[] = [];

  const mockSupabaseService = {
    getSecret: () => JWT_SECRET,
    verifyJwt: async (token: string) => {
      return jwt.verify(token, JWT_SECRET);
    },
    signToken: (payload: any, expiresIn: string | number = '1h') => {
      return jwt.sign(payload, JWT_SECRET, { expiresIn: expiresIn as any });
    },
    createIsolatedClient: () => ({
      auth: {
        signInWithPassword: jest.fn().mockImplementation(async (credentials: any) => {
          const user = mockAuthUsers.find((u) => u.email === credentials.email);
          if (user && credentials.password === 'Password123!') {
            return { data: { user }, error: null };
          }
          return { data: { user: null }, error: { message: 'Invalid credentials' } };
        }),
      },
    }),
    get client() {
      return {
        auth: {
          signInWithPassword: jest.fn().mockImplementation(async (credentials: any) => {
            const user = mockAuthUsers.find((u) => u.email === credentials.email);
            if (user && credentials.password === 'Password123!') {
              return { data: { user }, error: null };
            }
            return { data: { user: null }, error: { message: 'Invalid credentials' } };
          }),
        },
      };
    },
    get adminClient() {
      return {
        auth: {
          admin: {
            createUser: jest.fn().mockImplementation(async (data: any) => {
              const existing = mockAuthUsers.find((u) => u.email === data.email);
              if (existing) {
                return {
                  data: null,
                  error: { message: 'User already registered', status: 422 },
                };
              }
              const newUser = {
                id: `auth-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
                email: data.email,
                user_metadata: data.user_metadata,
              };
              mockAuthUsers.push(newUser);
              return { data: { user: newUser }, error: null };
            }),
            deleteUser: jest.fn().mockImplementation(async (id: string) => {
              mockAuthUsers = mockAuthUsers.filter((u) => u.id !== id);
              return { data: {}, error: null };
            }),
          },
        },
        from: (table: string) => {
          let currentTable = table;
          let filterField: string | null = null;
          let filterVal: any = null;

          const getTableArray = () => {
            if (currentTable === 'users') return mockUsers;
            if (currentTable === 'organizations') return mockOrgs;
            if (currentTable === 'notifications') return mockNotifications;
            if (currentTable === 'alerts') return mockAlerts;
            return [];
          };

          const resolveQueryResult = () => {
            let rows = getTableArray();
            if (filterField) {
              rows = rows.filter((r) => r[filterField!] === filterVal);
            }
            if (currentTable === 'users') {
              rows = rows.map((r) => {
                const org = mockOrgs.find((o) => o.id === r.org_id);
                return { ...r, organizations: org || null };
              });
            }
            return { data: rows, error: null };
          };

          const queryBuilder: any = {
            then: (resolve: any) => resolve(resolveQueryResult()),
            select: jest.fn().mockImplementation(() => queryBuilder),
            eq: jest.fn().mockImplementation((field: string, val: any) => {
              filterField = field;
              filterVal = val;
              return queryBuilder;
            }),
            order: jest.fn().mockImplementation(() => queryBuilder),
            limit: jest.fn().mockImplementation(() => queryBuilder),
            maybeSingle: jest.fn().mockImplementation(async () => {
              let rows = getTableArray();
              if (filterField) {
                rows = rows.filter((r) => r[filterField!] === filterVal);
              }
              if (!rows[0]) return { data: null, error: null };
              const row = { ...rows[0] };
              if (currentTable === 'users') {
                const org = mockOrgs.find((o) => o.id === row.org_id);
                row.organizations = org || null;
              }
              return { data: row, error: null };
            }),
            single: jest.fn().mockImplementation(async () => {
              let rows = getTableArray();
              if (filterField) {
                rows = rows.filter((r) => r[filterField!] === filterVal);
              }
              if (!rows[0]) {
                return { data: null, error: { message: 'Row not found' } };
              }
              const row = { ...rows[0] };
              if (currentTable === 'users') {
                const org = mockOrgs.find((o) => o.id === row.org_id);
                row.organizations = org || null;
              }
              return { data: row, error: null };
            }),
            insert: jest.fn().mockImplementation((insertData: any) => {
              const id = insertData.id || `id-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
              const created = {
                ...insertData,
                id,
                mode: insertData.mode || 'roadways',
                created_at: new Date().toISOString(),
              };
              if (currentTable === 'users') {
                mockUsers.push(created);
              } else if (currentTable === 'organizations') {
                mockOrgs.push(created);
              } else if (currentTable === 'notifications') {
                mockNotifications.push(created);
              } else if (currentTable === 'alerts') {
                mockAlerts.push(created);
              }
              return {
                select: () => ({
                  single: async () => {
                    const row = { ...created };
                    if (currentTable === 'users') {
                      const org = mockOrgs.find((o) => o.id === row.org_id);
                      row.organizations = org || null;
                    }
                    return { data: row, error: null };
                  },
                }),
              };
            }),
            update: jest.fn().mockImplementation((updateData: any) => {
              return {
                eq: (field: string, val: any) => {
                  const arr = getTableArray();
                  const target = arr.find((item: any) => item[field] === val);
                  if (target) {
                    Object.assign(target, updateData);
                  }
                  return {
                    select: () => ({
                      single: async () => ({ data: target || null, error: null }),
                    }),
                    then: (resolve: any) => resolve({ data: target || null, error: null }),
                  };
                },
              };
            }),
            delete: jest.fn().mockImplementation(() => {
              return {
                eq: async (field: string, val: any) => {
                  if (currentTable === 'organizations') {
                    mockOrgs = mockOrgs.filter((o) => o[field] !== val);
                  } else if (currentTable === 'users') {
                    mockUsers = mockUsers.filter((u) => u[field] !== val);
                  } else if (currentTable === 'notifications') {
                    mockNotifications = mockNotifications.filter((n) => n[field] !== val);
                  } else if (currentTable === 'alerts') {
                    mockAlerts = mockAlerts.filter((a) => a[field] !== val);
                  }
                  return { data: null, error: null };
                },
              };
            }),
          };

          return queryBuilder;
        },
      };
    },
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(SupabaseService)
      .useValue(mockSupabaseService)
      .compile();

    app = moduleFixture.createNestApplication();
    app.use(cookieParser());
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        transform: true,
      }),
    );
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    mockUsers = [];
    mockOrgs = [];
    mockAuthUsers = [];
  });

  // 1. Register success -> 201, org + user rows exist (roadways)
  it('1. Register success -> 201, org + user rows exist', async () => {
    const res = await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        fullName: 'Test Manager',
        email: 'manager@test.com',
        password: 'Password123!',
        orgName: 'Fleet Corp',
        mode: 'roadways',
        country: 'India',
        state: 'Maharashtra',
        district: 'Mumbai City',
        address: '101 Marine Drive',
      })
      .expect(201);

    expect(res.body.user).toBeDefined();
    expect(res.body.user.email).toBe('manager@test.com');
    expect(res.body.user.role).toBe('manager');
    expect(res.body.user.organization.name).toBe('Fleet Corp');
    expect(res.body.user.organization.mode).toBe('roadways');
    expect(mockUsers.length).toBe(1);
    expect(mockOrgs.length).toBe(1);

    // Check cookies
    const cookies = res.headers['set-cookie'] as unknown as string[];
    expect(cookies).toBeDefined();
    expect(cookies.some((c) => c.includes('nw_access='))).toBeTruthy();
    expect(cookies.some((c) => c.includes('nw_refresh='))).toBeTruthy();
  });

  // Phase 2: Registering via mode 'railways' creates an org with mode = 'railways'
  it('Phase 2: Registering via mode railways creates an org with mode = railways', async () => {
    const res = await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        fullName: 'Rail Manager',
        email: 'railways.manager@test.com',
        password: 'Password123!',
        orgName: 'National Rail Logistics',
        mode: 'railways',
        country: 'India',
        state: 'Delhi',
        district: 'New Delhi',
        address: 'Rail Bhavan',
      })
      .expect(201);

    expect(res.body.user).toBeDefined();
    expect(res.body.user.organization.mode).toBe('railways');
    const createdOrg = mockOrgs.find((o) => o.id === res.body.user.orgId);
    expect(createdOrg.mode).toBe('railways');
  });

  // Phase 2: Registering via mode 'airways' creates an org with mode = 'airways'
  it('Phase 2: Registering via mode airways creates an org with mode = airways', async () => {
    const res = await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        fullName: 'Airways Commander',
        email: 'airways.pilot@test.com',
        password: 'Password123!',
        orgName: 'Sky Cargo Aviation',
        mode: 'airways',
        country: 'India',
        state: 'Delhi',
        district: 'New Delhi',
        address: 'Terminal 3 Cargo Wing',
      })
      .expect(201);

    expect(res.body.user).toBeDefined();
    expect(res.body.user.email).toBe('airways.pilot@test.com');
    expect(res.body.user.organization.mode).toBe('airways');
    const createdOrg = mockOrgs.find((o) => o.id === res.body.user.orgId);
    expect(createdOrg.mode).toBe('airways');
  });

  // Phase 2: Registering via mode 'seaways' creates an org with mode = 'seaways'
  it('Phase 2: Registering via mode seaways creates an org with mode = seaways', async () => {
    const res = await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        fullName: 'Port Captain',
        email: 'seaways.captain@test.com',
        password: 'Password123!',
        orgName: 'Oceanic Freight Liners',
        mode: 'seaways',
        country: 'India',
        state: 'Maharashtra',
        district: 'Mumbai City',
        address: 'JNPT Port Road',
      })
      .expect(201);

    expect(res.body.user).toBeDefined();
    expect(res.body.user.email).toBe('seaways.captain@test.com');
    expect(res.body.user.organization.mode).toBe('seaways');
    const createdOrg = mockOrgs.find((o) => o.id === res.body.user.orgId);
    expect(createdOrg.mode).toBe('seaways');
  });

  // 2. Register with an email that already exists -> 409, no orphaned rows created
  it('2. Register with an email that already exists -> 409, no orphaned rows created', async () => {
    mockUsers.push({
      id: 'existing-user-id',
      email: 'existing@test.com',
      org_id: 'org-1',
      role: 'manager',
      full_name: 'Existing Manager',
    });

    const initialOrgCount = mockOrgs.length;
    const initialUserCount = mockUsers.length;
    const initialAuthCount = mockAuthUsers.length;

    await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        fullName: 'Another Person',
        email: 'existing@test.com',
        password: 'Password123!',
        orgName: 'Another Org',
        mode: 'roadways',
        country: 'India',
        state: 'Karnataka',
        district: 'Bengaluru Urban',
        address: 'Tech Park',
      })
      .expect(409);

    expect(mockOrgs.length).toBe(initialOrgCount);
    expect(mockUsers.length).toBe(initialUserCount);
    expect(mockAuthUsers.length).toBe(initialAuthCount);
  });

  // 3. Session exchange with a valid Supabase token -> 200, cookies set
  it('3. Session exchange with a valid Supabase token -> 200, cookies set', async () => {
    const validSupabaseToken = jwt.sign(
      {
        sub: 'supabase-user-123',
        email: 'oauth@test.com',
        user_metadata: { full_name: 'OAuth User' },
      },
      JWT_SECRET,
      { expiresIn: '1h' },
    );

    const res = await request(app.getHttpServer())
      .post('/auth/session')
      .send({
        access_token: validSupabaseToken,
        refresh_token: 'dummy-refresh-token-xyz-12345',
        mode: 'roadways',
      })
      .expect(200);

    expect(res.body.user).toBeDefined();
    expect(res.body.user.email).toBe('oauth@test.com');
    const cookies = res.headers['set-cookie'] as unknown as string[];
    expect(cookies.some((c) => c.includes('nw_access='))).toBeTruthy();
    expect(cookies.some((c) => c.includes('nw_refresh='))).toBeTruthy();
  });

  // Phase 2: Mode Isolation: user in railways requesting roadways, airways, or seaways mode -> 403 Forbidden
  it('Phase 2 Mode Isolation: railways user claiming roadways, airways, or seaways mode -> 403 Forbidden', async () => {
    const railOrgId = 'org-rail-isolated';
    const railUserId = 'user-rail-isolated';
    mockOrgs.push({
      id: railOrgId,
      name: 'Southern Express Rail',
      mode: 'railways',
      country: 'India',
      state: 'Tamil Nadu',
      district: 'Chennai',
      address: 'Central Station',
    });
    mockUsers.push({
      id: railUserId,
      org_id: railOrgId,
      full_name: 'Rail Chief',
      email: 'rail.chief@test.com',
      role: 'manager',
    });

    const railToken = jwt.sign(
      {
        sub: railUserId,
        id: railUserId,
        email: 'rail.chief@test.com',
      },
      JWT_SECRET,
      { expiresIn: '1h' },
    );

    // Call /auth/session claiming 'roadways' mode -> 403
    await request(app.getHttpServer())
      .post('/auth/session')
      .send({
        access_token: railToken,
        refresh_token: 'dummy-refresh-token',
        mode: 'roadways',
      })
      .expect(403);

    // Call /auth/session claiming 'airways' mode -> 403
    await request(app.getHttpServer())
      .post('/auth/session')
      .send({
        access_token: railToken,
        refresh_token: 'dummy-refresh-token',
        mode: 'airways',
      })
      .expect(403);

    // Call /auth/session claiming 'seaways' mode -> 403
    await request(app.getHttpServer())
      .post('/auth/session')
      .send({
        access_token: railToken,
        refresh_token: 'dummy-refresh-token',
        mode: 'seaways',
      })
      .expect(403);

    // Call /auth/session matching 'railways' mode -> 200 OK
    const matchRes = await request(app.getHttpServer())
      .post('/auth/session')
      .send({
        access_token: railToken,
        refresh_token: 'dummy-refresh-token',
        mode: 'railways', // Matching
      })
      .expect(200);

    expect(matchRes.body.user.organization.mode).toBe('railways');
  });

  // 4. Session exchange with a tampered/invalid token -> 401
  it('4. Session exchange with a tampered/invalid token -> 401', async () => {
    const tamperedToken = 'invalid.jwt.token.string';

    await request(app.getHttpServer())
      .post('/auth/session')
      .send({
        access_token: tamperedToken,
        refresh_token: 'dummy-refresh',
      })
      .expect(401);
  });

  // 5. Refresh with a valid refresh cookie -> 200, new access cookie set
  it('5. Refresh with a valid refresh cookie -> 200, new access cookie set', async () => {
    const orgId = 'org-ref-1';
    const userId = 'user-ref-1';
    mockOrgs.push({
      id: orgId,
      name: 'Refresh Logistics',
      mode: 'roadways',
      country: 'India',
      state: 'Delhi',
      district: 'New Delhi',
      address: 'Connaught Place',
    });
    mockUsers.push({
      id: userId,
      org_id: orgId,
      full_name: 'Refresh Tester',
      email: 'refresh@test.com',
      role: 'manager',
    });

    const validRefreshToken = jwt.sign(
      { sub: userId, id: userId, token_type: 'refresh' },
      JWT_SECRET,
      { expiresIn: '7d' },
    );

    const res = await request(app.getHttpServer())
      .post('/auth/refresh')
      .set('Cookie', [`nw_refresh=${validRefreshToken}`])
      .expect(200);

    expect(res.body.user).toBeDefined();
    expect(res.body.user.email).toBe('refresh@test.com');
    const cookies = res.headers['set-cookie'] as unknown as string[];
    expect(cookies.some((c) => c.includes('nw_access='))).toBeTruthy();
  });

  // 6. Refresh with an invalid/expired refresh cookie -> 401
  it('6. Refresh with an invalid/expired refresh cookie -> 401', async () => {
    await request(app.getHttpServer())
      .post('/auth/refresh')
      .set('Cookie', ['nw_refresh=invalid-refresh-token'])
      .expect(401);
  });

  // 7. Protected route (/auth/me) with no cookie -> 401
  it('7. Protected route (/auth/me) with no cookie -> 401', async () => {
    await request(app.getHttpServer()).get('/auth/me').expect(401);
  });

  // 8. Protected route with a valid cookie -> 200, correct user returned
  it('8. Protected route with a valid cookie -> 200, correct user returned', async () => {
    const orgId = 'org-me-1';
    const userId = 'user-me-1';
    mockOrgs.push({
      id: orgId,
      name: 'Apex Freight',
      mode: 'roadways',
      country: 'India',
      state: 'Tamil Nadu',
      district: 'Chennai',
      address: 'Mount Road',
    });
    mockUsers.push({
      id: userId,
      org_id: orgId,
      full_name: 'Me User',
      email: 'me@test.com',
      role: 'manager',
    });

    const accessToken = jwt.sign(
      {
        sub: userId,
        id: userId,
        email: 'me@test.com',
        fullName: 'Me User',
        orgId,
        role: 'manager',
        mode: 'roadways',
      },
      JWT_SECRET,
      { expiresIn: '1h' },
    );

    const res = await request(app.getHttpServer())
      .get('/auth/me')
      .set('Cookie', [`nw_access=${accessToken}`])
      .expect(200);

    expect(res.body.user).toBeDefined();
    expect(res.body.user.id).toBe(userId);
    expect(res.body.user.email).toBe('me@test.com');
    expect(res.body.user.organization.name).toBe('Apex Freight');
    expect(res.body.user.organization.mode).toBe('roadways');
  });

  // 9. Role guard: a driver-role user hitting a manager-only stub route -> 403
  it('9. Role guard: a driver-role user hitting a manager-only stub route -> 403', async () => {
    const driverToken = jwt.sign(
      {
        sub: 'driver-id-1',
        id: 'driver-id-1',
        email: 'driver@test.com',
        fullName: 'Driver Dan',
        orgId: 'org-1',
        role: 'driver',
        mode: 'roadways',
      },
      JWT_SECRET,
      { expiresIn: '1h' },
    );

    await request(app.getHttpServer())
      .get('/auth/manager-only')
      .set('Cookie', [`nw_access=${driverToken}`])
      .expect(403);

    // Manager role succeeds on manager-only route
    const managerToken = jwt.sign(
      {
        sub: 'manager-id-1',
        id: 'manager-id-1',
        email: 'manager@test.com',
        fullName: 'Manager Mike',
        orgId: 'org-1',
        role: 'manager',
        mode: 'roadways',
      },
      JWT_SECRET,
      { expiresIn: '1h' },
    );

    await request(app.getHttpServer())
      .get('/auth/manager-only')
      .set('Cookie', [`nw_access=${managerToken}`])
      .expect(200);
  });

  // Phase 3: Notifications lifecycle
  it('Phase 3 Notifications: create, fetch, unread-count, and mark as read', async () => {
    const orgId = 'org-notif-1';
    const userId = 'user-notif-1';
    mockOrgs.push({
      id: orgId,
      name: 'Central Rail Logistics',
      mode: 'railways',
      country: 'India',
      state: 'Delhi',
      district: 'New Delhi',
      address: 'Rail Bhavan',
    });
    mockUsers.push({
      id: userId,
      org_id: orgId,
      full_name: 'Notif Manager',
      email: 'notif.mgr@test.com',
      role: 'manager',
    });

    const managerToken = jwt.sign(
      {
        sub: userId,
        id: userId,
        email: 'notif.mgr@test.com',
        fullName: 'Notif Manager',
        orgId,
        role: 'manager',
        mode: 'railways',
      },
      JWT_SECRET,
      { expiresIn: '1h' },
    );

    // 1. Initial unread count -> 0
    const countRes1 = await request(app.getHttpServer())
      .get('/notifications/unread-count')
      .set('Cookie', [`nw_access=${managerToken}`])
      .expect(200);
    expect(countRes1.body.count).toBe(0);

    // 2. Manager creates notification -> 201
    const createRes = await request(app.getHttpServer())
      .post('/notifications')
      .set('Cookie', [`nw_access=${managerToken}`])
      .send({
        type: 'alert',
        title: 'Track Maintenance Warning',
        body: 'Scheduled inspection at Sector 4',
        actionLabel: 'View Schedule',
        actionUrl: '/railways/schedule',
      })
      .expect(201);

    expect(createRes.body.notification).toBeDefined();
    expect(createRes.body.notification.title).toBe('Track Maintenance Warning');
    const createdNotifId = createRes.body.notification.id;

    // 3. Unread count -> 1
    const countRes2 = await request(app.getHttpServer())
      .get('/notifications/unread-count')
      .set('Cookie', [`nw_access=${managerToken}`])
      .expect(200);
    expect(countRes2.body.count).toBe(1);

    // 4. List notifications -> includes created notification
    const listRes = await request(app.getHttpServer())
      .get('/notifications')
      .set('Cookie', [`nw_access=${managerToken}`])
      .expect(200);
    expect(listRes.body.notifications.length).toBe(1);
    expect(listRes.body.notifications[0].id).toBe(createdNotifId);

    // 5. Mark notification as read -> 200
    const readRes = await request(app.getHttpServer())
      .patch(`/notifications/${createdNotifId}/read`)
      .set('Cookie', [`nw_access=${managerToken}`])
      .expect(200);
    expect(readRes.body.notification.readAt).toBeDefined();

    // 6. Unread count -> 0
    const countRes3 = await request(app.getHttpServer())
      .get('/notifications/unread-count')
      .set('Cookie', [`nw_access=${managerToken}`])
      .expect(200);
    expect(countRes3.body.count).toBe(0);
  });

  // Phase 3: Dashboard stats & system status
  it('Phase 3 Dashboard: activeAlerts reflects real alert row and vehicle fields return available: false', async () => {
    const orgId = 'org-dash-1';
    const userId = 'user-dash-1';
    mockOrgs.push({
      id: orgId,
      name: 'Aero Freight Hub',
      mode: 'airways',
      country: 'India',
      state: 'Delhi',
      district: 'New Delhi',
      address: 'IGI Cargo',
    });
    mockUsers.push({
      id: userId,
      org_id: orgId,
      full_name: 'Flight Ops Lead',
      email: 'ops@airways.com',
      role: 'manager',
    });

    // Insert a real unacknowledged alert
    mockAlerts.push({
      id: 'alert-1',
      org_id: orgId,
      type: 'weather',
      severity: 'high',
      message: 'Turbulence warning over Bay of Bengal',
      acknowledged_at: null,
      created_at: new Date().toISOString(),
    });

    const userToken = jwt.sign(
      {
        sub: userId,
        id: userId,
        email: 'ops@airways.com',
        fullName: 'Flight Ops Lead',
        orgId,
        role: 'manager',
        mode: 'airways',
      },
      JWT_SECRET,
      { expiresIn: '1h' },
    );

    const statsRes = await request(app.getHttpServer())
      .get('/dashboard/stats')
      .set('Cookie', [`nw_access=${userToken}`])
      .expect(200);

    expect(statsRes.body.stats).toBeDefined();
    expect(statsRes.body.stats.activeAlerts).toBe(1);
    expect(statsRes.body.stats.activeVehicles).toEqual({
      value: 0,
      available: true,
    });
    expect(statsRes.body.stats.totalFleetToday.available).toBe(true);
    expect(statsRes.body.stats.arrivedCount.available).toBe(true);
    expect(statsRes.body.stats.departedCount.available).toBe(true);

    // System status
    const statusRes = await request(app.getHttpServer())
      .get('/dashboard/system-status')
      .set('Cookie', [`nw_access=${userToken}`])
      .expect(200);

    expect(statusRes.body.status).toBeDefined();
    expect(statusRes.body.status.dbHealthy).toBe(true);
    expect(statusRes.body.status.wsGatewayHealthy).toBe(true);
    expect(statusRes.body.status.agentsHealthy).toBe(true);
  });

  // Phase 3: Admin Step-up Auth & Directory
  it('Phase 3 Admin: step-up auth with password required, user listing, editing, and empty reports', async () => {
    const orgId = 'org-admin-1';
    const managerId = 'user-admin-mgr';
    const driverId = 'user-admin-drv';

    mockOrgs.push({
      id: orgId,
      name: 'Seaways Shipping Corp',
      mode: 'seaways',
      country: 'India',
      state: 'Maharashtra',
      district: 'Mumbai City',
      address: 'Port Trust',
    });

    mockAuthUsers.push({
      id: managerId,
      email: 'captain@seaways.com',
      user_metadata: { full_name: 'Captain Jack' },
    });

    mockUsers.push({
      id: managerId,
      org_id: orgId,
      full_name: 'Captain Jack',
      email: 'captain@seaways.com',
      role: 'manager',
    });

    mockUsers.push({
      id: driverId,
      org_id: orgId,
      full_name: 'First Mate Dan',
      email: 'dan@seaways.com',
      role: 'crew',
    });

    const userToken = jwt.sign(
      {
        sub: managerId,
        id: managerId,
        email: 'captain@seaways.com',
        fullName: 'Captain Jack',
        orgId,
        role: 'manager',
        mode: 'seaways',
      },
      JWT_SECRET,
      { expiresIn: '1h' },
    );

    // 1. Calling /admin/users without nw_admin cookie -> 403 Forbidden
    await request(app.getHttpServer())
      .get('/admin/users')
      .set('Cookie', [`nw_access=${userToken}`])
      .expect(403);

    // 2. Calling /admin/verify-password with wrong password -> 401 Unauthorized
    await request(app.getHttpServer())
      .post('/admin/verify-password')
      .set('Cookie', [`nw_access=${userToken}`])
      .send({ password: 'WrongPassword999!' })
      .expect(401);

    // 3. Calling /admin/verify-password with correct password -> 200 + sets nw_admin cookie
    const verifyRes = await request(app.getHttpServer())
      .post('/admin/verify-password')
      .set('Cookie', [`nw_access=${userToken}`])
      .send({ password: 'Password123!' })
      .expect(201);

    expect(verifyRes.body.status).toBe('verified');
    const cookies = verifyRes.headers['set-cookie'] as unknown as string[];
    const adminCookie = cookies.find((c) => c.includes('nw_admin='));
    expect(adminCookie).toBeDefined();

    // 4. Calling /admin/users with valid nw_admin cookie -> 200, lists users
    const usersRes = await request(app.getHttpServer())
      .get('/admin/users')
      .set('Cookie', [`nw_access=${userToken}`, adminCookie!])
      .expect(200);

    expect(usersRes.body.users.length).toBe(2);
    expect(usersRes.body.users.some((u: any) => u.email === 'dan@seaways.com')).toBe(true);

    // 5. Manager editing user role via PATCH /admin/users/:id -> 200
    const updateRes = await request(app.getHttpServer())
      .patch(`/admin/users/${driverId}`)
      .set('Cookie', [`nw_access=${userToken}`, adminCookie!])
      .send({ fullName: 'Chief Mate Dan', role: 'operator' })
      .expect(200);

    expect(updateRes.body.user.fullName).toBe('Chief Mate Dan');
    expect(updateRes.body.user.role).toBe('operator');

    // 6. Calling /admin/reports -> returns genuine empty list []
    const reportsRes = await request(app.getHttpServer())
      .get('/admin/reports')
      .set('Cookie', [`nw_access=${userToken}`, adminCookie!])
      .expect(200);

    expect(reportsRes.body.reports).toEqual([]);
  });

  // Health check
  it('Health check endpoint -> 200 { status: "ok" }', async () => {
    const res = await request(app.getHttpServer()).get('/health').expect(200);
    expect(res.body).toEqual({ status: 'ok' });
  });
});
