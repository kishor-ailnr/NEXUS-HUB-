import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  UseGuards,
  Req,
} from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { CreateNotificationDto } from './dto/create-notification.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

@Controller('notifications')
@UseGuards(JwtAuthGuard)
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  async getNotifications(@Req() req: any) {
    const orgId = req.user.orgId || req.user.org_id;
    const userId = req.user.id || req.user.sub;
    const notifications = await this.notificationsService.getNotifications(orgId, userId);
    return { notifications };
  }

  @Get('unread-count')
  async getUnreadCount(@Req() req: any) {
    const orgId = req.user.orgId || req.user.org_id;
    const userId = req.user.id || req.user.sub;
    const count = await this.notificationsService.getUnreadCount(orgId, userId);
    return { count };
  }

  @Patch(':id/read')
  async markAsRead(@Param('id') id: string, @Req() req: any) {
    const orgId = req.user.orgId || req.user.org_id;
    const userId = req.user.id || req.user.sub;
    const notification = await this.notificationsService.markAsRead(id, orgId, userId);
    return { notification };
  }

  @Post()
  @UseGuards(RolesGuard)
  @Roles('manager')
  async createNotification(@Body() dto: CreateNotificationDto, @Req() req: any) {
    const orgId = req.user.orgId || req.user.org_id;
    const notification = await this.notificationsService.createNotification(orgId, dto);
    return { notification };
  }
}
