import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AircraftService } from './aircraft.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { Aircraft } from '@nexus-ways/shared';
import { CreateAircraftDto } from '../dto/aircraft.dto';

@Controller('aircraft')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AircraftController {
  constructor(private readonly aircraftService: AircraftService) {}

  @Post()
  @Roles('manager')
  async create(@Req() req: any, @Body() dto: CreateAircraftDto): Promise<Aircraft> {
    const orgId = req.user.orgId;
    return this.aircraftService.create(orgId, dto);
  }

  @Get()
  async findAll(@Req() req: any): Promise<Aircraft[]> {
    const orgId = req.user.orgId;
    return this.aircraftService.findAll(orgId);
  }

  @Get(':id')
  async findOne(@Req() req: any, @Param('id') id: string): Promise<Aircraft> {
    const orgId = req.user.orgId;
    return this.aircraftService.findOne(orgId, id);
  }

  @Patch(':id')
  @Roles('manager')
  async update(
    @Req() req: any,
    @Param('id') id: string,
    @Body() dto: Partial<CreateAircraftDto>,
  ): Promise<Aircraft> {
    const orgId = req.user.orgId;
    return this.aircraftService.update(orgId, id, dto);
  }

  @Delete(':id')
  @Roles('manager')
  async delete(@Req() req: any, @Param('id') id: string): Promise<{ success: boolean }> {
    const orgId = req.user.orgId;
    return this.aircraftService.delete(orgId, id);
  }
}
