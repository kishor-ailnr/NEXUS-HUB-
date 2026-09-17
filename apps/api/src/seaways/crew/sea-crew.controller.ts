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
import { SeaCrewService } from './sea-crew.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { CreateSeaCrewDto, SeaCrew } from '@nexus-ways/shared';

@Controller('sea-crew')
@UseGuards(JwtAuthGuard, RolesGuard)
export class SeaCrewController {
  constructor(private readonly seaCrewService: SeaCrewService) {}

  @Get()
  async findAll(@Req() req: any): Promise<SeaCrew[]> {
    const orgId = req.user.orgId || req.user.org_id;
    return this.seaCrewService.findAll(orgId);
  }

  @Get(':id')
  async findOne(@Req() req: any, @Param('id') id: string): Promise<SeaCrew> {
    const orgId = req.user.orgId || req.user.org_id;
    return this.seaCrewService.findOne(orgId, id);
  }

  @Post()
  @Roles('manager')
  async create(@Req() req: any, @Body() dto: CreateSeaCrewDto): Promise<SeaCrew> {
    const orgId = req.user.orgId || req.user.org_id;
    return this.seaCrewService.create(orgId, dto);
  }

  @Patch(':id')
  @Roles('manager')
  async update(
    @Req() req: any,
    @Param('id') id: string,
    @Body() dto: Partial<CreateSeaCrewDto>,
  ): Promise<SeaCrew> {
    const orgId = req.user.orgId || req.user.org_id;
    return this.seaCrewService.update(orgId, id, dto);
  }

  @Delete(':id')
  @Roles('manager')
  async delete(@Req() req: any, @Param('id') id: string): Promise<{ success: boolean }> {
    const orgId = req.user.orgId || req.user.org_id;
    return this.seaCrewService.delete(orgId, id);
  }
}
