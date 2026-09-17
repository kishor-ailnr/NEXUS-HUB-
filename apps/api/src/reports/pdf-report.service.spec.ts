import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import * as zlib from 'zlib';
import { PdfReportService, TripReportData } from './pdf-report.service';
import { SupabaseService } from '../supabase/supabase.service';
import { NotificationsService } from '../notifications/notifications.service';

describe('PdfReportService (Unit & Binary Verification)', () => {
  let service: PdfReportService;
  let mockSupabase: any;
  let mockNotifications: any;

  const mockTripReportData: TripReportData = {
    tripId: 'trip-pdf-001',
    orgId: 'org-001',
    orgName: 'NEXUS Logistics Ltd',
    vehicleRegistration: 'MH-04-AX-5555',
    vehicleType: 'Heavy Commercial Vehicle (3-Axle)',
    driverName: 'Rajesh Kumar',
    originLabel: 'Mumbai Central Port',
    originLat: 19.076,
    originLng: 72.8777,
    destLabel: 'Pune Chakan Hub',
    destLat: 18.5204,
    destLng: 73.8567,
    dispatchedAt: '2026-09-07T10:00:00.000Z',
    completedAt: '2026-09-07T13:00:00.000Z',
    predictedDurationMinutes: 180,
    actualDurationMinutes: 180,
    distanceKm: 150,
    avgSpeedKmh: 54,
    etaConfidenceBasis: 'historical',
    etaConfidenceBandMinutes: 10,
    etaSampleSize: 4,
    driverSafetyScore: 85,
    harshBrakeCount: 1,
    speedingEventCount: 1,
    carbonKg: 227.25,
    cargoTonnes: 15,
    tollEstimateInr: 825,
    checkpoints: [
      { sequence: 1, label: 'Lonavala Expressway Toll Plaza', lat: 18.755, lng: 73.409 },
    ],
    alerts: [
      { type: 'congestion', severity: 'medium', message: 'Low speed congestion detected (12 km/h)', createdAt: '2026-09-07T11:30:00Z' },
    ],
    geofenceEvents: [
      { geofenceName: 'JNPT Freight Gateway', eventType: 'exit', occurredAt: '2026-09-07T10:15:00Z' },
    ],
  };

  beforeEach(async () => {
    mockSupabase = {
      adminClient: {
        from: jest.fn().mockImplementation((table: string) => {
          const createQueryChain = (defaultData: any = null) => {
            const chain: any = {
              select: jest.fn().mockImplementation(() => chain),
              eq: jest.fn().mockImplementation(() => chain),
              order: jest.fn().mockImplementation(() => chain),
              limit: jest.fn().mockImplementation(() => chain),
              single: jest.fn().mockResolvedValue({ data: defaultData, error: null }),
              maybeSingle: jest.fn().mockResolvedValue({ data: defaultData, error: null }),
              then: jest.fn().mockImplementation((resolve) =>
                resolve({ data: Array.isArray(defaultData) ? defaultData : (defaultData ? [defaultData] : []), error: null }),
              ),
            };
            return chain;
          };

          if (table === 'trips') {
            const tripData = {
              id: 'trip-pdf-001',
              org_id: 'org-001',
              vehicle_id: 'v-01',
              driver_id: 'd-01',
              origin_label: 'Mumbai Central Port',
              destination_label: 'Pune Chakan Hub',
              origin_lat: 19.076,
              origin_lng: 72.8777,
              destination_lat: 18.5204,
              destination_lng: 73.8567,
              status: 'completed',
              distance_km: 150,
              predicted_duration_minutes: 180,
              actual_duration_minutes: 180,
              carbon_kg: 227.25,
              toll_estimate_inr: 825,
              completed_at: '2026-09-07T13:00:00Z',
            };
            return createQueryChain(tripData);
          }

          if (table === 'trip_reports') {
            const reportData = {
              id: 'report-001',
              trip_id: 'trip-pdf-001',
              org_id: 'org-001',
              storage_path: 'org-001/trip-pdf-001.pdf',
              file_size_bytes: 25400,
              generated_at: '2026-09-07T13:01:00Z',
            };
            const chain = createQueryChain([reportData]);
            chain.maybeSingle = jest.fn().mockResolvedValue({ data: reportData, error: null });
            chain.single = jest.fn().mockResolvedValue({ data: reportData, error: null });
            chain.upsert = jest.fn().mockReturnValue({
              select: jest.fn().mockReturnValue({
                single: jest.fn().mockResolvedValue({ data: reportData, error: null }),
              }),
            });
            return chain;
          }

          if (table === 'vehicles') {
            return createQueryChain({ registration_number: 'MH-04-AX-5555' });
          }

          if (table === 'drivers') {
            return createQueryChain({ user: { full_name: 'Rajesh Kumar' } });
          }

          return createQueryChain(null);
        }),
        storage: {
          from: jest.fn().mockReturnValue({
            upload: jest.fn().mockResolvedValue({ data: { path: 'org-001/trip-pdf-001.pdf' }, error: null }),
            createSignedUrl: jest.fn().mockResolvedValue({
              data: { signedUrl: 'https://supabase.co/storage/v1/object/sign/trip-pdfs/org-001/trip-pdf-001.pdf?token=valid-token' },
              error: null,
            }),
          }),
        },
      },
    };

    mockNotifications = {
      createNotification: jest.fn().mockResolvedValue({ id: 'notif-001' }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PdfReportService,
        { provide: SupabaseService, useValue: mockSupabase },
        { provide: NotificationsService, useValue: mockNotifications },
      ],
    }).compile();

    service = module.get<PdfReportService>(PdfReportService);
  });

  describe('1. Pure JS PDF Document Generation & Binary Verification', () => {
    it('generates a real, valid PDF buffer matching PDF magic bytes (%PDF-)', async () => {
      const pdfBuffer = await service.buildTripPdfBuffer(mockTripReportData);

      expect(Buffer.isBuffer(pdfBuffer)).toBe(true);
      expect(pdfBuffer.length).toBeGreaterThan(1000);

      // Verify PDF Magic Bytes Signature: %PDF- (ASCII: 0x25 0x50 0x44 0x46 0x2D)
      const magicBytes = pdfBuffer.subarray(0, 5).toString('ascii');
      expect(magicBytes).toBe('%PDF-');

      // Verify PDF Version Header
      const headerLine = pdfBuffer.subarray(0, 8).toString('ascii');
      expect(headerLine).toMatch(/%PDF-1\.[3-7]/);
    });

    it('contains full trip intelligence layer data inside the generated document', async () => {
      const pdfBuffer = await service.buildTripPdfBuffer(mockTripReportData);
      const rawPdf = pdfBuffer.toString('latin1');

      // 1. Verify uncompressed PDF metadata dictionary entries
      expect(rawPdf).toContain('NEXUS WAYS Trip Audit Report - MH-04-AX-5555');
      expect(rawPdf).toContain('NEXUS WAYS Logistics Intelligence');
      expect(rawPdf).toContain('Trip Report trip-pdf-001');

      // 2. Extract and decompress flate stream content to verify render text
      const streamStart = pdfBuffer.indexOf(Buffer.from('stream\n'));
      const streamEnd = pdfBuffer.indexOf(Buffer.from('\nendstream'));
      expect(streamStart).toBeGreaterThan(0);
      expect(streamEnd).toBeGreaterThan(streamStart);

      const streamContent = pdfBuffer.subarray(streamStart + 7, streamEnd);
      const decompressed = zlib.inflateSync(streamContent).toString('latin1');

      // Decode all hex string literals inside PDF text operators and join without separators
      const extractedChunks: string[] = [];
      const hexRegex = /<([0-9a-fA-F]+)>/g;
      let match;
      while ((match = hexRegex.exec(decompressed)) !== null) {
        extractedChunks.push(Buffer.from(match[1], 'hex').toString('latin1'));
      }
      const fullRenderedText = extractedChunks.join('');

      // Assert key intelligence indicators are present in the decompressed page stream
      expect(fullRenderedText).toContain('NEXUS WAYS');
      expect(fullRenderedText).toContain('MH-04-AX-5555');
      expect(fullRenderedText).toContain('Rajesh Kumar');
      expect(fullRenderedText).toContain('Mumbai Central Port');
      expect(fullRenderedText).toContain('Pune Chakan Hub');
      expect(fullRenderedText).toContain('SAFETY SCORE');
      expect(fullRenderedText).toContain('85 / 100');
      expect(fullRenderedText).toContain('227.25 kg CO');
      expect(fullRenderedText).toContain('825 INR');
      expect(fullRenderedText).toContain('JNPT Freight Gateway');
    });
  });

  describe('2. Report Persistence & Storage Upload', () => {
    it('generates and stores trip report in Supabase storage and trip_reports table', async () => {
      const result = await service.generateAndStoreTripReport('org-001', 'trip-pdf-001');

      expect(result.storagePath).toBe('org-001/trip-pdf-001.pdf');
      expect(result.fileSizeBytes).toBeGreaterThan(1000);
      expect(mockNotifications.createNotification).toHaveBeenCalled();
    });

    it('throws NotFoundException when trip does not exist', async () => {
      mockSupabase.adminClient.from = jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
            }),
          }),
        }),
      });

      await expect(service.generateAndStoreTripReport('org-001', 'nonexistent-trip')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('3. Signed Download URLs & 404 Guardrails', () => {
    it('returns a time-limited signed download URL for an existing completed trip report', async () => {
      const res = await service.getSignedReportUrl('org-001', 'trip-pdf-001');

      expect(res.tripId).toBe('trip-pdf-001');
      expect(res.signedUrl).toContain('https://supabase.co/storage/v1/object/sign/trip-pdfs');
      expect(res.storagePath).toBe('org-001/trip-pdf-001.pdf');
      expect(res.fileSizeBytes).toBe(25400);
    });

    it('throws NotFoundException when trip has no report and is not completed', async () => {
      mockSupabase.adminClient.from = jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
            }),
          }),
        }),
      });

      await expect(service.getSignedReportUrl('org-001', 'uncompleted-trip')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('4. Admin Ledger Reports Listing', () => {
    it('returns completed trip reports with vehicle, driver, and route metadata', async () => {
      const reports = await service.getAdminReports('org-001');

      expect(Array.isArray(reports)).toBe(true);
      expect(reports.length).toBeGreaterThan(0);
      expect(reports[0].tripId).toBe('trip-pdf-001');
    });
  });
});
