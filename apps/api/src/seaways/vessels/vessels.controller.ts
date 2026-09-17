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
import { VesselsService } from './vessels.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { Vessel } from '@nexus-ways/shared';
import { CreateVesselDto } from '../dto/vessel.dto';

@Controller('vessels')
@UseGuards(JwtAuthGuard, RolesGuard)
export class VesselsController {
  constructor(private readonly vesselsService: VesselsService) {}

  @Get()
  async findAll(@Req() req: any): Promise<Vessel[]> {
    const orgId = req.user.orgId || req.user.org_id;
    return this.vesselsService.findAll(orgId);
  }

  @Get(':id')
  async findOne(@Req() req: any, @Param('id') id: string): Promise<Vessel> {
    const orgId = req.user.orgId || req.user.org_id;
    return this.vesselsService.findOne(orgId, id);
  }

  @Post()
  @Roles('manager')
  async create(@Req() req: any, @Body() dto: CreateVesselDto): Promise<Vessel> {
    const orgId = req.user.orgId || req.user.org_id;
    return this.vesselsService.create(orgId, dto);
  }

  @Patch(':id')
  @Roles('manager')
  async update(
    @Req() req: any,
    @Param('id') id: string,
    @Body() dto: Partial<CreateVesselDto>,
  ): Promise<Vessel> {
    const orgId = req.user.orgId || req.user.org_id;
    return this.vesselsService.update(orgId, id, dto);
  }

  @Delete(':id')
  @Roles('manager')
  async delete(@Req() req: any, @Param('id') id: string): Promise<{ success: boolean }> {
    const orgId = req.user.orgId || req.user.org_id;
    return this.vesselsService.delete(orgId, id);
  }
}
