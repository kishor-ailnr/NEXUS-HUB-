import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { VehiclesService } from './vehicles.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Vehicle } from '@nexus-ways/shared';
import { CreateVehicleDto, UpdateVehicleDto } from './dto/vehicle.dto';

@Controller('vehicles')
@UseGuards(JwtAuthGuard, RolesGuard)
export class VehiclesController {
  constructor(private readonly vehiclesService: VehiclesService) {}

  @Get()
  async findAll(
    @CurrentUser() user: any,
    @Query('search') search?: string,
  ): Promise<Vehicle[]> {
    return this.vehiclesService.findAll(user.orgId, search);
  }

  @Get(':id')
  async findOne(
    @CurrentUser() user: any,
    @Param('id') id: string,
  ): Promise<Vehicle> {
    return this.vehiclesService.findOne(user.orgId, id);
  }

  @Post()
  @Roles('manager')
  async create(
    @CurrentUser() user: any,
    @Body() dto: CreateVehicleDto,
  ): Promise<Vehicle> {
    return this.vehiclesService.create(user.orgId, dto);
  }

  @Patch(':id')
  @Roles('manager')
  async update(
    @CurrentUser() user: any,
    @Param('id') id: string,
    @Body() dto: UpdateVehicleDto,
  ): Promise<Vehicle> {
    return this.vehiclesService.update(user.orgId, id, dto);
  }

  @Delete(':id')
  @Roles('manager')
  async remove(
    @CurrentUser() user: any,
    @Param('id') id: string,
  ): Promise<{ success: boolean }> {
    return this.vehiclesService.remove(user.orgId, id);
  }
}
