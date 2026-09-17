import { Test, TestingModule } from '@nestjs/testing';
import { PlatformController } from './platform.controller';
import { PlatformService } from './platform.service';
import { SupabaseService } from '../supabase/supabase.service';

describe('PlatformController (Phase 8 Hub Stats)', () => {
  let controller: PlatformController;
  let service: PlatformService;

  const mockSupabaseService = {
    adminClient: {
      from: jest.fn((table: string) => {
        const counts: Record<string, number> = {
          trips: 12,
          train_movements: 5,
          flight_movements: 8,
          voyage_movements: 3,
        };
        return {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockResolvedValue({
            count: counts[table] ?? 0,
            data: null,
            error: null,
          }),
        };
      }),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [PlatformController],
      providers: [
        PlatformService,
        {
          provide: SupabaseService,
          useValue: mockSupabaseService,
        },
      ],
    }).compile();

    controller = module.get<PlatformController>(PlatformController);
    service = module.get<PlatformService>(PlatformService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
    expect(service).toBeDefined();
  });

  it('GET /platform/hub-stats should return cross-mode aggregate counts without org-identifying data', async () => {
    const result = await controller.getHubStats();

    expect(result).toEqual({
      roadways: { activeMovements: 12 },
      railways: { activeMovements: 5 },
      airways: { activeMovements: 8 },
      seaways: { activeMovements: 3 },
    });

    // Explicit test asserting the response shape contains ONLY mode counts and ZERO org-identifying data
    const allowedKeys = ['roadways', 'railways', 'airways', 'seaways'];
    expect(Object.keys(result).sort()).toEqual(allowedKeys.sort());

    for (const mode of allowedKeys) {
      const modeData = (result as any)[mode];
      expect(Object.keys(modeData)).toEqual(['activeMovements']);
      expect(typeof modeData.activeMovements).toBe('number');
      // Assert no org or user leaks
      expect((modeData as any).orgId).toBeUndefined();
      expect((modeData as any).org_id).toBeUndefined();
      expect((modeData as any).orgName).toBeUndefined();
      expect((modeData as any).userId).toBeUndefined();
      expect((modeData as any).user).toBeUndefined();
    }
  });

  it('should handle database exceptions gracefully and return 0 counts', async () => {
    const errorSupabase = {
      adminClient: {
        from: jest.fn(() => {
          throw new Error('Supabase unreachable');
        }),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [PlatformController],
      providers: [
        PlatformService,
        {
          provide: SupabaseService,
          useValue: errorSupabase,
        },
      ],
    }).compile();

    const errController = module.get<PlatformController>(PlatformController);
    const result = await errController.getHubStats();

    expect(result).toEqual({
      roadways: { activeMovements: 0 },
      railways: { activeMovements: 0 },
      airways: { activeMovements: 0 },
      seaways: { activeMovements: 0 },
    });
  });
});
