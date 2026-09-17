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
import { TrainsService } from './trains.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { Train } from '@nexus-ways/shared';
import { CreateTrainDto } from '../dto/train.dto';

@Controller('trains')
@UseGuards(JwtAuthGuard, RolesGuard)
export class TrainsController {
  constructor(private readonly trainsService: TrainsService) {}

  @Post()
  @Roles('manager')
  async create(@Req() req: any, @Body() dto: CreateTrainDto): Promise<Train> {
    const orgId = req.user.orgId;
    return this.trainsService.create(orgId, dto);
  }

  @Get()
  async findAll(@Req() req: any): Promise<Train[]> {
    const orgId = req.user.orgId;
    return this.trainsService.findAll(orgId);
  }

  @Get(':id')
  async findOne(@Req() req: any, @Param('id') id: string): Promise<Train> {
    const orgId = req.user.orgId;
    return this.trainsService.findOne(orgId, id);
  }

  @Patch(':id')
  @Roles('manager')
  async update(
    @Req() req: any,
    @Param('id') id: string,
    @Body() dto: Partial<CreateTrainDto>,
  ): Promise<Train> {
    const orgId = req.user.orgId;
    return this.trainsService.update(orgId, id, dto);
  }

  @Delete(':id')
  @Roles('manager')
  async delete(@Req() req: any, @Param('id') id: string): Promise<{ success: boolean }> {
    const orgId = req.user.orgId;
    return this.trainsService.delete(orgId, id);
  }
}
