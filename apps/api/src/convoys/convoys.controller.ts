import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  UseGuards,
} from '@nestjs/common';
import { ConvoysService } from './convoys.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { ConvoyGroup, CreateConvoyDto } from '@nexus-ways/shared';

@Controller('convoys')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ConvoysController {
  constructor(private readonly convoysService: ConvoysService) {}

  @Get()
  async findAll(@CurrentUser() user: any): Promise<ConvoyGroup[]> {
    return this.convoysService.findAll(user.orgId);
  }

  @Get(':id')
  async findOne(
    @CurrentUser() user: any,
    @Param('id') id: string,
  ): Promise<ConvoyGroup> {
    return this.convoysService.findOne(user.orgId, id);
  }

  @Post()
  @Roles('manager')
  async create(
    @CurrentUser() user: any,
    @Body() dto: CreateConvoyDto,
  ): Promise<ConvoyGroup> {
    return this.convoysService.create(user.orgId, dto);
  }

  @Post(':id/members/:vehicleId')
  @Roles('manager')
  async addMember(
    @CurrentUser() user: any,
    @Param('id') id: string,
    @Param('vehicleId') vehicleId: string,
  ): Promise<{ success: boolean }> {
    return this.convoysService.addMember(user.orgId, id, vehicleId);
  }

  @Delete(':id/members/:vehicleId')
  @Roles('manager')
  async removeMember(
    @CurrentUser() user: any,
    @Param('id') id: string,
    @Param('vehicleId') vehicleId: string,
  ): Promise<{ success: boolean }> {
    return this.convoysService.removeMember(user.orgId, id, vehicleId);
  }

  @Delete(':id')
  @Roles('manager')
  async remove(
    @CurrentUser() user: any,
    @Param('id') id: string,
  ): Promise<{ success: boolean }> {
    return this.convoysService.remove(user.orgId, id);
  }
}
