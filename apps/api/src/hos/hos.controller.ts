import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { HosService } from './hos.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { HosLog } from '@nexus-ways/shared';

@Controller('hos')
@UseGuards(JwtAuthGuard, RolesGuard)
export class HosController {
  constructor(private readonly hosService: HosService) {}

  @Get('logs')
  async getLogs(
    @CurrentUser() user: any,
    @Query('driverId') driverId?: string,
  ): Promise<HosLog[]> {
    return this.hosService.getLogsForOrg(user.orgId, driverId);
  }
}
