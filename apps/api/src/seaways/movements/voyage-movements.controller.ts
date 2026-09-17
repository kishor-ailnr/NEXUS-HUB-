import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { VoyageMovementsService } from './voyage-movements.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import {
  VoyageMovementStatus,
  VoyageMovement,
  VesselTelemetry,
  VoyageMovementEtaResponse,
  VoyageMovementReportUrlResponse,
  AdminSeaReport,
  PortSlotCheckResponse,
  SeaCrewScore,
  WatchkeepingLog,
} from '@nexus-ways/shared';
import { CreateVoyageMovementDto, UpdateVoyageMovementStatusDto } from '../dto/voyage-movement.dto';

@Controller('voyage-movements')
@UseGuards(JwtAuthGuard, RolesGuard)
export class VoyageMovementsController {
  constructor(private readonly voyageMovementsService: VoyageMovementsService) {}

  @Post()
  @Roles('manager')
  async create(
    @Req() req: any,
    @Body() dto: CreateVoyageMovementDto,
  ): Promise<VoyageMovement> {
    const orgId = req.user.orgId || req.user.org_id;
    return this.voyageMovementsService.create(orgId, dto);
  }

  @Get('slot-check')
  async checkSlot(
    @Req() req: any,
    @Query('originPortId') originPortId?: string,
    @Query('destinationPortId') destinationPortId?: string,
    @Query('proposedDeparture') proposedDeparture?: string,
  ): Promise<PortSlotCheckResponse> {
    const orgId = req.user.orgId || req.user.org_id;
    return this.voyageMovementsService.checkSlots(
      orgId,
      originPortId || '',
      destinationPortId || '',
      proposedDeparture,
    );
  }

  @Get('reports')
  async getAdminReports(@Req() req: any): Promise<AdminSeaReport[]> {
    const orgId = req.user.orgId || req.user.org_id;
    return this.voyageMovementsService.getAdminReports(orgId);
  }

  @Get()
  async findAll(@Req() req: any): Promise<VoyageMovement[]> {
    const orgId = req.user.orgId || req.user.org_id;
    return this.voyageMovementsService.findAll(orgId);
  }

  @Get(':id/eta')
  async getEta(@Req() req: any, @Param('id') id: string): Promise<VoyageMovementEtaResponse> {
    const orgId = req.user.orgId || req.user.org_id;
    return this.voyageMovementsService.getEtaConfidence(orgId, id);
  }

  @Get(':id/report')
  async getReport(@Req() req: any, @Param('id') id: string): Promise<VoyageMovementReportUrlResponse> {
    const orgId = req.user.orgId || req.user.org_id;
    return this.voyageMovementsService.getMovementReport(orgId, id);
  }

  @Get(':id/crew-score')
  async getCrewScore(@Param('id') id: string): Promise<SeaCrewScore[]> {
    return this.voyageMovementsService.getCrewScore(id);
  }

  @Get('watchkeeping-logs/:crewId')
  async getWatchkeepingLogs(@Param('crewId') crewId: string): Promise<WatchkeepingLog[]> {
    return this.voyageMovementsService.getWatchkeepingLogs(crewId);
  }

  @Get(':id/telemetry')
  async getTelemetry(
    @Req() req: any,
    @Param('id') id: string,
  ): Promise<VesselTelemetry[]> {
    const orgId = req.user.orgId || req.user.org_id;
    return this.voyageMovementsService.getTelemetry(orgId, id);
  }

  @Get(':id')
  async findOne(@Req() req: any, @Param('id') id: string): Promise<VoyageMovement> {
    const orgId = req.user.orgId || req.user.org_id;
    return this.voyageMovementsService.findOne(orgId, id);
  }

  @Patch(':id/status')
  @Roles('manager')
  async updateStatus(
    @Req() req: any,
    @Param('id') id: string,
    @Body() dto: UpdateVoyageMovementStatusDto,
  ): Promise<VoyageMovement> {
    const orgId = req.user.orgId || req.user.org_id;
    return this.voyageMovementsService.updateStatus(orgId, id, dto.status);
  }
}
