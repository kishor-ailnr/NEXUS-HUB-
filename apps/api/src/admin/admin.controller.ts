import {
  Controller,
  Post,
  Get,
  Patch,
  Param,
  Body,
  UseGuards,
  Req,
  Res,
} from '@nestjs/common';
import { Response } from 'express';
import { AdminService } from './admin.service';
import { VerifyPasswordDto } from './dto/verify-password.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminGuard } from './guards/admin.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

@Controller('admin')
@UseGuards(JwtAuthGuard)
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Post('verify-password')
  async verifyPassword(
    @Body() dto: VerifyPasswordDto,
    @Req() req: any,
    @Res({ passthrough: true }) res: Response,
  ) {
    const userEmail = req.user.email;
    const userId = req.user.id || req.user.sub;
    const orgId = req.user.orgId || req.user.org_id;

    const adminToken = await this.adminService.verifyPassword(
      userEmail,
      userId,
      orgId,
      dto.password,
    );

    // Set short-lived (15 min) httpOnly nw_admin cookie
    res.cookie('nw_admin', adminToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 15 * 60 * 1000, // 15 minutes
    });

    return {
      status: 'verified',
      expiresInMinutes: 15,
    };
  }

  @Get('users')
  @UseGuards(JwtAuthGuard, AdminGuard)
  async getUsers(@Req() req: any) {
    const orgId = req.user?.orgId || req.adminSession?.orgId || req.user?.org_id;
    const users = await this.adminService.getOrgUsers(orgId);
    return { users };
  }

  @Patch('users/:id')
  @UseGuards(JwtAuthGuard, AdminGuard, RolesGuard)
  @Roles('manager')
  async updateUser(
    @Param('id') id: string,
    @Body() dto: UpdateUserDto,
    @Req() req: any,
  ) {
    const orgId = req.user?.orgId || req.adminSession?.orgId || req.user?.org_id;
    const user = await this.adminService.updateUser(id, orgId, dto);
    return { user };
  }

  @Get('reports')
  @UseGuards(JwtAuthGuard, AdminGuard)
  async getReports(@Req() req: any) {
    const orgId = req.user?.orgId || req.adminSession?.orgId || req.user?.org_id || req.adminSession?.org_id;
    console.log('[AdminController.getReports] orgId resolved:', orgId, 'req.user:', req.user, 'req.adminSession:', req.adminSession);
    const reports = await this.adminService.getReports(orgId);
    return { reports };
  }
}
