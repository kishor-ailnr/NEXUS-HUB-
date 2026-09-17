import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  UseGuards,
} from '@nestjs/common';
import { GeofencesService } from './geofences.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { CreateGeofenceDto, Geofence, GeofenceEvent } from '@nexus-ways/shared';

@Controller('geofences')
@UseGuards(JwtAuthGuard, RolesGuard)
export class GeofencesController {
  constructor(private readonly geofencesService: GeofencesService) {}

  @Get()
  async findAll(@CurrentUser() user: any): Promise<Geofence[]> {
    return this.geofencesService.findAll(user.orgId);
  }

  @Get('events')
  async findRecentEvents(@CurrentUser() user: any): Promise<GeofenceEvent[]> {
    return this.geofencesService.findRecentEvents(user.orgId);
  }

  @Get(':id')
  async findOne(
    @CurrentUser() user: any,
    @Param('id') id: string,
  ): Promise<Geofence & { events?: GeofenceEvent[] }> {
    return this.geofencesService.findOne(user.orgId, id);
  }

  @Post()
  @Roles('manager')
  async create(
    @CurrentUser() user: any,
    @Body() dto: CreateGeofenceDto,
  ): Promise<Geofence> {
    return this.geofencesService.create(user.orgId, dto);
  }

  @Delete(':id')
  @Roles('manager')
  async remove(
    @CurrentUser() user: any,
    @Param('id') id: string,
  ): Promise<{ success: boolean }> {
    return this.geofencesService.remove(user.orgId, id);
  }
}
