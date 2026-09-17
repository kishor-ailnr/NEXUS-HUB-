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
import { StationsService } from './stations.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { CreateStationDto, Station } from '@nexus-ways/shared';

@Controller('stations')
@UseGuards(JwtAuthGuard, RolesGuard)
export class StationsController {
  constructor(private readonly stationsService: StationsService) {}

  @Post()
  @Roles('manager')
  async create(@Req() req: any, @Body() dto: CreateStationDto): Promise<Station> {
    const orgId = req.user.orgId;
    return this.stationsService.create(orgId, dto);
  }

  @Get()
  async findAll(@Req() req: any): Promise<Station[]> {
    const orgId = req.user.orgId;
    return this.stationsService.findAll(orgId);
  }

  @Get(':id')
  async findOne(@Req() req: any, @Param('id') id: string): Promise<Station> {
    const orgId = req.user.orgId;
    return this.stationsService.findOne(orgId, id);
  }

  @Patch(':id')
  @Roles('manager')
  async update(
    @Req() req: any,
    @Param('id') id: string,
    @Body() dto: Partial<CreateStationDto>,
  ): Promise<Station> {
    const orgId = req.user.orgId;
    return this.stationsService.update(orgId, id, dto);
  }

  @Delete(':id')
  @Roles('manager')
  async delete(@Req() req: any, @Param('id') id: string): Promise<{ success: boolean }> {
    const orgId = req.user.orgId;
    return this.stationsService.delete(orgId, id);
  }
}
