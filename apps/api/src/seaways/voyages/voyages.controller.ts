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
import { VoyagesService } from './voyages.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { CreateVoyageDto, Voyage } from '@nexus-ways/shared';

@Controller('voyages')
@UseGuards(JwtAuthGuard, RolesGuard)
export class VoyagesController {
  constructor(private readonly voyagesService: VoyagesService) {}

  @Get()
  async findAll(@Req() req: any): Promise<Voyage[]> {
    const orgId = req.user.orgId || req.user.org_id;
    return this.voyagesService.findAll(orgId);
  }

  @Get(':id')
  async findOne(@Req() req: any, @Param('id') id: string): Promise<Voyage> {
    const orgId = req.user.orgId || req.user.org_id;
    return this.voyagesService.findOne(orgId, id);
  }

  @Post()
  @Roles('manager')
  async create(@Req() req: any, @Body() dto: CreateVoyageDto): Promise<Voyage> {
    const orgId = req.user.orgId || req.user.org_id;
    return this.voyagesService.create(orgId, dto);
  }

  @Patch(':id')
  @Roles('manager')
  async update(
    @Req() req: any,
    @Param('id') id: string,
    @Body() dto: Partial<CreateVoyageDto>,
  ): Promise<Voyage> {
    const orgId = req.user.orgId || req.user.org_id;
    return this.voyagesService.update(orgId, id, dto);
  }

  @Delete(':id')
  @Roles('manager')
  async delete(@Req() req: any, @Param('id') id: string): Promise<{ success: boolean }> {
    const orgId = req.user.orgId || req.user.org_id;
    return this.voyagesService.delete(orgId, id);
  }
}
