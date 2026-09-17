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
import { LocoPilotsService } from './loco-pilots.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { LocoPilot, CreateLocoPilotDto } from '@nexus-ways/shared';

@Controller('loco-pilots')
@UseGuards(JwtAuthGuard, RolesGuard)
export class LocoPilotsController {
  constructor(private readonly locoPilotsService: LocoPilotsService) {}

  @Post()
  @Roles('manager')
  async create(@Req() req: any, @Body() dto: CreateLocoPilotDto): Promise<LocoPilot> {
    const orgId = req.user.orgId;
    return this.locoPilotsService.create(orgId, dto);
  }

  @Get()
  async findAll(@Req() req: any): Promise<LocoPilot[]> {
    const orgId = req.user.orgId;
    return this.locoPilotsService.findAll(orgId);
  }

  @Get(':id')
  async findOne(@Req() req: any, @Param('id') id: string): Promise<LocoPilot> {
    const orgId = req.user.orgId;
    return this.locoPilotsService.findOne(orgId, id);
  }

  @Patch(':id')
  @Roles('manager')
  async update(
    @Req() req: any,
    @Param('id') id: string,
    @Body() dto: Partial<CreateLocoPilotDto> & { status?: any },
  ): Promise<LocoPilot> {
    const orgId = req.user.orgId;
    return this.locoPilotsService.update(orgId, id, dto);
  }

  @Delete(':id')
  @Roles('manager')
  async delete(@Req() req: any, @Param('id') id: string): Promise<{ success: boolean }> {
    const orgId = req.user.orgId;
    return this.locoPilotsService.delete(orgId, id);
  }
}
