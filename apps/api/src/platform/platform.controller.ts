import { Controller, Get } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { PlatformService } from './platform.service';
import { PlatformHubStatsResponse } from '@nexus-ways/shared';

@Controller('platform')
export class PlatformController {
  constructor(private readonly platformService: PlatformService) {}

  /**
   * GET /platform/hub-stats
   * Public / unauthenticated endpoint powering the pre-login and post-login Hub page.
   * Returns aggregate active movement counts per mode with zero org-identifying data.
   */
  @Get('hub-stats')
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  async getHubStats(): Promise<PlatformHubStatsResponse> {
    return this.platformService.getHubStats();
  }
}
