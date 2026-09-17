import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  UseGuards,
} from '@nestjs/common';
import { DriversService } from './drivers.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { CreateDriverDto, UpdateDriverDto, Driver, DriverBehaviorScore } from '@nexus-ways/shared';

@Controller('drivers')
@UseGuards(JwtAuthGuard, RolesGuard)
export class DriversController {
  constructor(private readonly driversService: DriversService) {}

  @Get()
  async findAll(@CurrentUser() user: any): Promise<Driver[]> {
    return this.driversService.findAll(user.orgId);
  }

  @Get(':id/behavior-history')
  async getBehaviorHistory(
    @CurrentUser() user: any,
    @Param('id') id: string,
  ): Promise<DriverBehaviorScore[]> {
    return this.driversService.getBehaviorHistory(user.orgId, id);
  }

  @Get(':id')
  async findOne(@CurrentUser() user: any, @Param('id') id: string): Promise<Driver> {
    return this.driversService.findOne(user.orgId, id);
  }

  @Post()
  @Roles('manager')
  async create(
    @CurrentUser() user: any,
    @Body() dto: CreateDriverDto,
  ): Promise<Driver> {
    return this.driversService.create(user.orgId, dto);
  }

  @Patch(':id')
  @Roles('manager')
  async update(
    @CurrentUser() user: any,
    @Param('id') id: string,
    @Body() dto: UpdateDriverDto,
  ): Promise<Driver> {
    return this.driversService.update(user.orgId, id, dto);
  }

  @Delete(':id')
  @Roles('manager')
  async remove(
    @CurrentUser() user: any,
    @Param('id') id: string,
  ): Promise<{ success: boolean }> {
    return this.driversService.remove(user.orgId, id);
  }
}
