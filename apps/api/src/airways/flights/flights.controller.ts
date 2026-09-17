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
import { FlightsService } from './flights.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { CreateFlightDto, Flight } from '@nexus-ways/shared';

@Controller('flights')
@UseGuards(JwtAuthGuard, RolesGuard)
export class FlightsController {
  constructor(private readonly flightsService: FlightsService) {}

  @Post()
  @Roles('manager')
  async create(@Req() req: any, @Body() dto: CreateFlightDto): Promise<Flight> {
    const orgId = req.user.orgId;
    return this.flightsService.create(orgId, dto);
  }

  @Get()
  async findAll(@Req() req: any): Promise<Flight[]> {
    const orgId = req.user.orgId;
    return this.flightsService.findAll(orgId);
  }

  @Get(':id')
  async findOne(@Req() req: any, @Param('id') id: string): Promise<Flight> {
    const orgId = req.user.orgId;
    return this.flightsService.findOne(orgId, id);
  }

  @Patch(':id')
  @Roles('manager')
  async update(
    @Req() req: any,
    @Param('id') id: string,
    @Body() dto: Partial<CreateFlightDto>,
  ): Promise<Flight> {
    const orgId = req.user.orgId;
    return this.flightsService.update(orgId, id, dto);
  }

  @Delete(':id')
  @Roles('manager')
  async delete(@Req() req: any, @Param('id') id: string): Promise<{ success: boolean }> {
    const orgId = req.user.orgId;
    return this.flightsService.delete(orgId, id);
  }
}
