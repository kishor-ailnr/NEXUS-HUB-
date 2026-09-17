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
import { RakesService } from './rakes.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { Rake, CreateRakeDto } from '@nexus-ways/shared';

@Controller('rakes')
@UseGuards(JwtAuthGuard, RolesGuard)
export class RakesController {
  constructor(private readonly rakesService: RakesService) {}

  @Post()
  @Roles('manager')
  async create(@Req() req: any, @Body() dto: CreateRakeDto): Promise<Rake> {
    const orgId = req.user.orgId;
    return this.rakesService.create(orgId, dto);
  }

  @Get()
  async findAll(@Req() req: any): Promise<Rake[]> {
    const orgId = req.user.orgId;
    return this.rakesService.findAll(orgId);
  }

  @Get(':id')
  async findOne(@Req() req: any, @Param('id') id: string): Promise<Rake> {
    const orgId = req.user.orgId;
    return this.rakesService.findOne(orgId, id);
  }

  @Patch(':id')
  @Roles('manager')
  async update(
    @Req() req: any,
    @Param('id') id: string,
    @Body() dto: Partial<CreateRakeDto>,
  ): Promise<Rake> {
    const orgId = req.user.orgId;
    return this.rakesService.update(orgId, id, dto);
  }

  @Delete(':id')
  @Roles('manager')
  async delete(@Req() req: any, @Param('id') id: string): Promise<{ success: boolean }> {
    const orgId = req.user.orgId;
    return this.rakesService.delete(orgId, id);
  }
}
