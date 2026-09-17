import { Controller, Get, UseGuards, Req } from '@nestjs/common';
import { DashboardService } from './dashboard.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('dashboard')
@UseGuards(JwtAuthGuard)
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('stats')
  async getStats(@Req() req: any) {
    const orgId = req.user.orgId || req.user.org_id;
    const stats = await this.dashboardService.getStats(orgId);
    return { stats };
  }

  @Get('system-status')
  async getSystemStatus() {
    const status = await this.dashboardService.getSystemStatus();
    return { status };
  }
}
