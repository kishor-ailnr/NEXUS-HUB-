import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import cookieParser from 'cookie-parser';
import * as jwt from 'jsonwebtoken';
import { AppModule } from '../src/app.module';
import { SupabaseService } from '../src/supabase/supabase.service';

describe('Security & Infrastructure Hardening (e2e)', () => {
  jest.setTimeout(45000);
  let app: INestApplication;
  const JWT_SECRET = 'test-security-hardening-jwt-secret-999999999999';

  const orgId = 'org-sec-001';
  const managerUserId = 'user-sec-mgr-001';

  let managerToken: string;

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
          const queryBuilder: any = {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            order: jest.fn().mockReturnThis(),
            limit: jest.fn().mockReturnThis(),
            single: jest.fn().mockImplementation(async () => ({ data: null, error: null })),
            maybeSingle: jest.fn().mockImplementation(async () => ({ data: null, error: null })),
            insert: jest.fn().mockImplementation((payload: any) => ({
              select: () => ({
                single: async () => ({
                  data: { id: 'mock-id-123', org_id: orgId, ...payload },
                  error: null,
                }),
              }),
            })),
            update: jest.fn().mockImplementation(() => ({
              select: () => ({
                single: async () => ({ data: { id: 'mock-id-123' }, error: null }),
              }),
            })),
            then: (resolve: any) => resolve({ data: [], count: 0, error: null }),
          };
          return queryBuilder;
        },
        auth: {
          admin: {
            createUser: jest.fn().mockImplementation(async (d: any) => ({
              data: { user: { id: 'auth-user-id', email: d.email } },
              error: null,
            })),
          },
        },
      };
    },
  };

  beforeAll(async () => {
    managerToken = jwt.sign(
      { sub: managerUserId, id: managerUserId, email: 'mgr@security.com', role: 'manager', orgId },
      JWT_SECRET,
    );

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(SupabaseService)
      .useValue(mockSupabaseService)
      .compile();

    app = moduleFixture.createNestApplication();
    app.use(cookieParser());

    const allowedOrigins = [
      'http://localhost:5173',
      'http://localhost:3000',
      'http://127.0.0.1:5173',
      'http://127.0.0.1:3000',
    ];

    app.enableCors({
      origin: (origin, callback) => {
        if (!origin) return callback(null, true);
        if (allowedOrigins.includes(origin)) {
          return callback(null, true);
        }
        return callback(new Error(`Origin ${origin} not allowed by CORS`));
      },
      credentials: true,
    });

    // Mirror exact main.ts configuration
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        transform: true,
        forbidNonWhitelisted: true,
      }),
    );
    await app.init();
  });

  afterAll(async () => {
    if (app) await app.close();
  });

  describe('1. Rate Limiting Sweep', () => {
    it('GET /platform/hub-stats should enforce rate limiting after 30 requests within 60s window', async () => {
      // Limit is 30 requests / 60 seconds
      const requests = [];
      for (let i = 0; i < 30; i++) {
        requests.push(request(app.getHttpServer()).get('/platform/hub-stats'));
      }

      const responses = await Promise.all(requests);
      // All 30 initial requests should be accepted
      for (let i = 0; i < 30; i++) {
        expect(responses[i].status).toBe(200);
      }

      // The 31st request should exceed limit and be rejected with 429 Too Many Requests
      const exceededRes = await request(app.getHttpServer()).get('/platform/hub-stats');
      expect(exceededRes.status).toBe(429);
      expect(exceededRes.body.message).toMatch(/Too Many Requests/i);
    });

    it('POST /auth/session should enforce strict limit (10 req/min)', async () => {
      // Hit /auth/session 10 times
      for (let i = 0; i < 10; i++) {
        await request(app.getHttpServer())
          .post('/auth/session')
          .send({ access_token: 'dummy', refresh_token: 'dummy' });
      }

      // The 11th request must be throttled with 429
      const res = await request(app.getHttpServer())
        .post('/auth/session')
        .send({ access_token: 'dummy', refresh_token: 'dummy' });

      expect(res.status).toBe(429);
      expect(res.body.message).toMatch(/Too Many Requests/i);
    });
  });

  describe('2. Input Validation Sweep (class-validator & forbidNonWhitelisted)', () => {
    it('POST /vehicles should reject empty body with 400 and validation error messages', async () => {
      const res = await request(app.getHttpServer())
        .post('/vehicles')
        .set('Authorization', `Bearer ${managerToken}`)
        .send({});

      expect(res.status).toBe(400);
      expect(Array.isArray(res.body.message)).toBe(true);
      const messages = res.body.message.join('; ');
      expect(messages).toContain('registrationNumber');
      expect(messages).toContain('vehicleType');
    });

    it('POST /vehicles should reject payload with forbidden unwhitelisted fields (forbidNonWhitelisted)', async () => {
      const res = await request(app.getHttpServer())
        .post('/vehicles')
        .set('Authorization', `Bearer ${managerToken}`)
        .send({
          registrationNumber: 'MH-12-AB-1234',
          vehicleType: 'truck',
          unauthorized_injected_column: 'exploit_value',
        });

      expect(res.status).toBe(400);
      expect(Array.isArray(res.body.message)).toBe(true);
      const messages = res.body.message.join('; ');
      expect(messages).toContain('property unauthorized_injected_column should not exist');
    });

    it('POST /trips should reject empty body with 400 and required field validation', async () => {
      const res = await request(app.getHttpServer())
        .post('/trips')
        .set('Authorization', `Bearer ${managerToken}`)
        .send({});

      expect(res.status).toBe(400);
      expect(Array.isArray(res.body.message)).toBe(true);
      const messages = res.body.message.join('; ');
      expect(messages).toContain('vehicleId');
      expect(messages).toContain('driverId');
      expect(messages).toContain('originAddress');
      expect(messages).toContain('destinationAddress');
    });

    it('POST /trains should reject invalid body with 400', async () => {
      const res = await request(app.getHttpServer())
        .post('/trains')
        .set('Authorization', `Bearer ${managerToken}`)
        .send({
          invalid_field: 'bad',
        });

      expect(res.status).toBe(400);
      expect(Array.isArray(res.body.message)).toBe(true);
      const messages = res.body.message.join('; ');
      expect(messages).toContain('train_number');
    });

    it('POST /aircraft should reject invalid body with 400', async () => {
      const res = await request(app.getHttpServer())
        .post('/aircraft')
        .set('Authorization', `Bearer ${managerToken}`)
        .send({});

      expect(res.status).toBe(400);
      expect(Array.isArray(res.body.message)).toBe(true);
      const messages = res.body.message.join('; ');
      expect(messages).toContain('tail_number');
      expect(messages).toContain('aircraft_type');
    });

    it('POST /vessels should reject invalid body with 400', async () => {
      const res = await request(app.getHttpServer())
        .post('/vessels')
        .set('Authorization', `Bearer ${managerToken}`)
        .send({});

      expect(res.status).toBe(400);
      expect(Array.isArray(res.body.message)).toBe(true);
      const messages = res.body.message.join('; ');
      expect(messages).toContain('vessel_name');
      expect(messages).toContain('vessel_type');
    });
  });

  describe('3. CORS Tightening Inspection', () => {
    it('should allow whitelisted origin with credentials', async () => {
      const res = await request(app.getHttpServer())
        .get('/platform/hub-stats')
        .set('Origin', 'http://localhost:5173');

      expect(res.headers['access-control-allow-origin']).toBe('http://localhost:5173');
      expect(res.headers['access-control-allow-credentials']).toBe('true');
    });

    it('should block unauthorized origin without setting access-control-allow-origin', async () => {
      const res = await request(app.getHttpServer())
        .get('/platform/hub-stats')
        .set('Origin', 'https://unauthorized-malicious-site.com');

      expect(res.headers['access-control-allow-origin']).toBeUndefined();
    });
  });
});
