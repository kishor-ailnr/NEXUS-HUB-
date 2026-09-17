import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  Req,
  UseGuards,
} from '@nestjs/common';
import { SeaConvoysService } from './sea-convoys.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { CreateSeaConvoyDto, AddVesselToConvoyDto, SeaConvoyGroup } from '@nexus-ways/shared';

@Controller('sea-convoys')
@UseGuards(JwtAuthGuard, RolesGuard)
export class SeaConvoysController {
  constructor(private readonly convoysService: SeaConvoysService) {}

  @Get()
  async findAll(@Req() req: any): Promise<SeaConvoyGroup[]> {
    const orgId = req.user.orgId || req.user.org_id;
    return this.convoysService.findAll(orgId);
  }

  @Get(':id')
  async findOne(@Req() req: any, @Param('id') id: string): Promise<SeaConvoyGroup> {
    const orgId = req.user.orgId || req.user.org_id;
    return this.convoysService.findOne(orgId, id);
  }

  @Post()
  @Roles('manager')
  async create(@Req() req: any, @Body() dto: CreateSeaConvoyDto): Promise<SeaConvoyGroup> {
    const orgId = req.user.orgId || req.user.org_id;
    return this.convoysService.create(orgId, dto);
  }

  @Post(':id/vessels')
  @Roles('manager')
  async addVessel(
    @Req() req: any,
    @Param('id') id: string,
    @Body() dto: AddVesselToConvoyDto,
  ) {
    const orgId = req.user.orgId || req.user.org_id;
    return this.convoysService.addVessel(orgId, id, dto);
  }

  @Post(':id/members')
  @Roles('manager')
  async addMember(
    @Req() req: any,
    @Param('id') id: string,
    @Body() dto: AddVesselToConvoyDto,
  ) {
    const orgId = req.user.orgId || req.user.org_id;
    return this.convoysService.addVessel(orgId, id, dto);
  }

  @Delete(':id/vessels/:vesselId')
  @Roles('manager')
  async removeVessel(
    @Req() req: any,
    @Param('id') id: string,
    @Param('vesselId') vesselId: string,
  ) {
    const orgId = req.user.orgId || req.user.org_id;
    return this.convoysService.removeVessel(orgId, id, vesselId);
  }

  @Delete(':id/members/:vesselId')
  @Roles('manager')
  async removeMember(
    @Req() req: any,
    @Param('id') id: string,
    @Param('vesselId') vesselId: string,
  ) {
    const orgId = req.user.orgId || req.user.org_id;
    return this.convoysService.removeVessel(orgId, id, vesselId);
  }

  @Delete(':id')
  @Roles('manager')
  async delete(@Req() req: any, @Param('id') id: string): Promise<{ success: boolean }> {
    const orgId = req.user.orgId || req.user.org_id;
    return this.convoysService.delete(orgId, id);
  }
}
