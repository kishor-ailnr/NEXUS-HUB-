import { Injectable, Logger } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { PlatformHubStatsResponse } from '@nexus-ways/shared';

@Injectable()
export class PlatformService {
  private readonly logger = new Logger(PlatformService.name);

  constructor(private readonly supabase: SupabaseService) {}

  async getHubStats(): Promise<PlatformHubStatsResponse> {
    try {
      const client = this.supabase.adminClient;

      const [roadwaysRes, railwaysRes, airwaysRes, seawaysRes] = await Promise.all([
        client
          .from('trips')
          .select('id', { count: 'exact', head: true })
          .eq('status', 'in_transit'),
        client
          .from('train_movements')
          .select('id', { count: 'exact', head: true })
          .eq('status', 'in_transit'),
        client
          .from('flight_movements')
          .select('id', { count: 'exact', head: true })
          .eq('status', 'in_transit'),
        client
          .from('voyage_movements')
          .select('id', { count: 'exact', head: true })
          .eq('status', 'in_transit'),
      ]);

      return {
        roadways: {
          activeMovements: roadwaysRes.count ?? 0,
        },
        railways: {
          activeMovements: railwaysRes.count ?? 0,
        },
        airways: {
          activeMovements: airwaysRes.count ?? 0,
        },
        seaways: {
          activeMovements: seawaysRes.count ?? 0,
        },
      };
    } catch (err: any) {
      this.logger.warn(`Failed to retrieve platform hub stats: ${err.message}. Returning zero fallback.`);
      return {
        roadways: { activeMovements: 0 },
        railways: { activeMovements: 0 },
        airways: { activeMovements: 0 },
        seaways: { activeMovements: 0 },
      };
    }
  }
}
