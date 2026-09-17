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
import { FlightMovementsService } from './flight-movements.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import {
  FlightMovement,
  FlightMovementStatus,
  FlightTelemetry,
  FlightMovementEtaResponse,
  FlightMovementReportUrlResponse,
  AdminFlightReport,
  AirportSlotCheckResponse,
  CrewFlightScore,
  FlightDutyLog,
} from '@nexus-ways/shared';
import { CreateFlightMovementDto, UpdateFlightMovementStatusDto } from '../dto/flight-movement.dto';

@Controller('flight-movements')
@UseGuards(JwtAuthGuard, RolesGuard)
export class FlightMovementsController {
  constructor(private readonly flightMovementsService: FlightMovementsService) {}

  @Post()
  @Roles('manager')
  async create(
    @Req() req: any,
    @Body() dto: CreateFlightMovementDto,
  ): Promise<FlightMovement> {
    const orgId = req.user.orgId;
    return this.flightMovementsService.create(orgId, dto);
  }

  @Get('slot-check')
  async checkSlot(
    @Req() req: any,
    @Query('originAirportId') originAirportId?: string,
    @Query('destinationAirportId') destinationAirportId?: string,
    @Query('proposedDeparture') proposedDeparture?: string,
  ): Promise<AirportSlotCheckResponse> {
    const orgId = req.user.orgId;
    return this.flightMovementsService.checkSlots(
      orgId,
      originAirportId || '',
      destinationAirportId || '',
      proposedDeparture,
    );
  }

  @Get('reports')
  async getAdminReports(@Req() req: any): Promise<AdminFlightReport[]> {
    const orgId = req.user.orgId;
    return this.flightMovementsService.getAdminReports(orgId);
  }

  @Get()
  async findAll(@Req() req: any): Promise<FlightMovement[]> {
    const orgId = req.user.orgId;
    return this.flightMovementsService.findAll(orgId);
  }

  @Get(':id/eta')
  async getEta(@Req() req: any, @Param('id') id: string): Promise<FlightMovementEtaResponse> {
    const orgId = req.user.orgId;
    return this.flightMovementsService.getEtaConfidence(orgId, id);
  }

  @Get(':id/report')
  async getReport(@Req() req: any, @Param('id') id: string): Promise<FlightMovementReportUrlResponse> {
    const orgId = req.user.orgId;
    return this.flightMovementsService.getMovementReport(orgId, id);
  }

  @Get(':id/crew-score')
  async getCrewScore(@Param('id') id: string): Promise<CrewFlightScore[]> {
    return this.flightMovementsService.getCrewScore(id);
  }

  @Get('duty-logs/:pilotId')
  async getDutyLogs(@Param('pilotId') pilotId: string): Promise<FlightDutyLog[]> {
    return this.flightMovementsService.getDutyLogs(pilotId);
  }

  @Get(':id/telemetry')
  async getTelemetry(
    @Req() req: any,
    @Param('id') id: string,
  ): Promise<FlightTelemetry[]> {
    const orgId = req.user.orgId;
    return this.flightMovementsService.getTelemetry(orgId, id);
  }

  @Get(':id')
  async findOne(@Req() req: any, @Param('id') id: string): Promise<FlightMovement> {
    const orgId = req.user.orgId;
    return this.flightMovementsService.findOne(orgId, id);
  }

  @Patch(':id/status')
  @Roles('manager')
  async updateStatus(
    @Req() req: any,
    @Param('id') id: string,
    @Body() dto: UpdateFlightMovementStatusDto,
  ): Promise<FlightMovement> {
    const orgId = req.user.orgId;
    return this.flightMovementsService.updateStatus(orgId, id, dto.status);
  }
}
