import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { TripsService } from './trips.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import {
  Trip,
  SavedRoute,
  TripEtaResponse,
  TripReportUrlResponse,
} from '@nexus-ways/shared';
import { CreateTripDto, UpdateTripStatusDto, AddCheckpointDto } from './dto/trip.dto';

@Controller('trips')
@UseGuards(JwtAuthGuard, RolesGuard)
export class TripsController {
  constructor(private readonly tripsService: TripsService) {}

  @Get()
  async findAll(@CurrentUser() user: any): Promise<Trip[]> {
    return this.tripsService.findAll(user.orgId);
  }

  @Get('saved-routes')
  async findSavedRoutes(
    @CurrentUser() user: any,
    @Query('origin') origin?: string,
    @Query('destination') destination?: string,
  ): Promise<SavedRoute[]> {
    return this.tripsService.findSavedRoutes(user.orgId, origin, destination);
  }

  @Get(':id/eta')
  async getEta(
    @CurrentUser() user: any,
    @Param('id') id: string,
  ): Promise<TripEtaResponse> {
    return this.tripsService.getEta(user.orgId, id);
  }

  @Get(':id/report')
  async getReport(
    @CurrentUser() user: any,
    @Param('id') id: string,
  ): Promise<TripReportUrlResponse> {
    return this.tripsService.getTripReport(user.orgId, id);
  }

  @Get(':id')
  async findOne(
    @CurrentUser() user: any,
    @Param('id') id: string,
  ): Promise<Trip> {
    return this.tripsService.findOne(user.orgId, id);
  }

  @Post()
  @Roles('manager')
  async create(
    @CurrentUser() user: any,
    @Body() dto: CreateTripDto,
  ): Promise<Trip> {
    return this.tripsService.create(user.orgId, dto);
  }

  @Patch(':id/checkpoints')
  @Roles('manager')
  async addCheckpoint(
    @CurrentUser() user: any,
    @Param('id') id: string,
    @Body() dto: AddCheckpointDto,
  ): Promise<Trip> {
    return this.tripsService.addCheckpoint(user.orgId, id, dto);
  }

  @Patch(':id/status')
  async updateStatus(
    @CurrentUser() user: any,
    @Param('id') id: string,
    @Body() dto: UpdateTripStatusDto,
  ): Promise<Trip> {
    return this.tripsService.updateStatus(user.orgId, id, dto);
  }
}
