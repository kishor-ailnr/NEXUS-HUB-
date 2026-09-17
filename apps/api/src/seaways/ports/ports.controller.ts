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
import { PortsService } from './ports.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { CreatePortDto, Port } from '@nexus-ways/shared';

@Controller('ports')
@UseGuards(JwtAuthGuard, RolesGuard)
export class PortsController {
  constructor(private readonly portsService: PortsService) {}

  @Get()
  async findAll(@Req() req: any): Promise<Port[]> {
    const orgId = req.user.orgId || req.user.org_id;
    return this.portsService.findAll(orgId);
  }

  @Get(':id')
  async findOne(@Req() req: any, @Param('id') id: string): Promise<Port> {
    const orgId = req.user.orgId || req.user.org_id;
    return this.portsService.findOne(orgId, id);
  }

  @Post()
  @Roles('manager')
  async create(@Req() req: any, @Body() dto: CreatePortDto): Promise<Port> {
    const orgId = req.user.orgId || req.user.org_id;
    return this.portsService.create(orgId, dto);
  }

  @Patch(':id')
  @Roles('manager')
  async update(
    @Req() req: any,
    @Param('id') id: string,
    @Body() dto: Partial<CreatePortDto>,
  ): Promise<Port> {
    const orgId = req.user.orgId || req.user.org_id;
    return this.portsService.update(orgId, id, dto);
  }

  @Delete(':id')
  @Roles('manager')
  async delete(@Req() req: any, @Param('id') id: string): Promise<{ success: boolean }> {
    const orgId = req.user.orgId || req.user.org_id;
    return this.portsService.delete(orgId, id);
  }
}
