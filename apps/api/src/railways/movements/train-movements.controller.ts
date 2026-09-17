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
import { TrainMovementsService } from './train-movements.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import {
  TrainMovement,
  TrainMovementStatus,
  SavedRailRoute,
  RailSlotCheckResponse,
  TrainMovementEtaResponse,
  TrainMovementReportUrlResponse,
  AdminRailReport,
  CrewBehaviorScore,
} from '@nexus-ways/shared';
import { CreateTrainMovementDto, UpdateTrainMovementStatusDto } from '../dto/train-movement.dto';

@Controller('train-movements')
@UseGuards(JwtAuthGuard, RolesGuard)
export class TrainMovementsController {
  constructor(private readonly movementsService: TrainMovementsService) {}

  @Post()
  @Roles('manager')
  async create(@Req() req: any, @Body() dto: CreateTrainMovementDto): Promise<TrainMovement> {
    const orgId = req.user.orgId;
    return this.movementsService.create(orgId, dto as any);
  }

  @Get('slot-check')
  async checkSlot(
    @Req() req: any,
    @Query('originStationId') originStationId?: string,
    @Query('destinationStationId') destinationStationId?: string,
    @Query('routeId') routeId?: string,
    @Query('proposedDeparture') proposedDeparture?: string,
  ): Promise<RailSlotCheckResponse> {
    const orgId = req.user.orgId;
    // If routeId is provided (format "originId-destId" or saved_route id), parse it
    let origId = originStationId || '';
    let destId = destinationStationId || '';

    if (routeId && (!origId || !destId)) {
      if (routeId.includes('-')) {
        const parts = routeId.split('-');
        origId = parts[0];
        destId = parts[1];
      } else {
        origId = routeId;
      }
    }

    return this.movementsService.checkSlot(orgId, origId, destId, proposedDeparture);
  }

  @Get('reports')
  async getAdminReports(@Req() req: any): Promise<AdminRailReport[]> {
    const orgId = req.user.orgId;
    return this.movementsService.getAdminReports(orgId);
  }

  @Get('saved-routes')
  async findSavedRoutes(@Req() req: any): Promise<SavedRailRoute[]> {
    const orgId = req.user.orgId;
    return this.movementsService.findSavedRoutes(orgId);
  }

  @Get()
  async findAll(@Req() req: any): Promise<TrainMovement[]> {
    const orgId = req.user.orgId;
    return this.movementsService.findAll(orgId);
  }

  @Get(':id/eta')
  async getEta(@Req() req: any, @Param('id') id: string): Promise<TrainMovementEtaResponse> {
    const orgId = req.user.orgId;
    return this.movementsService.getEtaConfidence(orgId, id);
  }

  @Get(':id/report')
  async getReport(@Req() req: any, @Param('id') id: string): Promise<TrainMovementReportUrlResponse> {
    const orgId = req.user.orgId;
    return this.movementsService.getMovementReport(orgId, id);
  }

  @Get(':id/crew-score')
  async getCrewScore(@Req() req: any, @Param('id') id: string): Promise<CrewBehaviorScore[]> {
    return this.movementsService.getCrewScoreHistory(id);
  }

  @Get(':id/telemetry')
  async getTelemetry(@Req() req: any, @Param('id') id: string): Promise<any[]> {
    const orgId = req.user.orgId;
    return this.movementsService.getTelemetry(orgId, id);
  }

  @Get(':id')
  async findOne(@Req() req: any, @Param('id') id: string): Promise<TrainMovement> {
    const orgId = req.user.orgId;
    return this.movementsService.findOne(orgId, id);
  }

  @Patch(':id/status')
  async updateStatus(
    @Req() req: any,
    @Param('id') id: string,
    @Body() dto: UpdateTrainMovementStatusDto,
  ): Promise<TrainMovement> {
    const orgId = req.user.orgId;
    return this.movementsService.updateStatus(orgId, id, dto.status);
  }
}
