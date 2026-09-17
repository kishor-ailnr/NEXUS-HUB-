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
import { FlightCrewService } from './flight-crew.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { CreateFlightCrewDto, FlightCrew } from '@nexus-ways/shared';

@Controller('flight-crew')
@UseGuards(JwtAuthGuard, RolesGuard)
export class FlightCrewController {
  constructor(private readonly flightCrewService: FlightCrewService) {}

  @Post()
  @Roles('manager')
  async create(@Req() req: any, @Body() dto: CreateFlightCrewDto): Promise<FlightCrew> {
    const orgId = req.user.orgId;
    return this.flightCrewService.create(orgId, dto);
  }

  @Get()
  async findAll(@Req() req: any): Promise<FlightCrew[]> {
    const orgId = req.user.orgId;
    return this.flightCrewService.findAll(orgId);
  }

  @Get(':id')
  async findOne(@Req() req: any, @Param('id') id: string): Promise<FlightCrew> {
    const orgId = req.user.orgId;
    return this.flightCrewService.findOne(orgId, id);
  }

  @Patch(':id')
  @Roles('manager')
  async update(
    @Req() req: any,
    @Param('id') id: string,
    @Body() dto: Partial<CreateFlightCrewDto>,
  ): Promise<FlightCrew> {
    const orgId = req.user.orgId;
    return this.flightCrewService.update(orgId, id, dto);
  }

  @Delete(':id')
  @Roles('manager')
  async delete(@Req() req: any, @Param('id') id: string): Promise<{ success: boolean }> {
    const orgId = req.user.orgId;
    return this.flightCrewService.delete(orgId, id);
  }
}
