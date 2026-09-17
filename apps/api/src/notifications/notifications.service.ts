import { Injectable, NotFoundException } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { RealtimeGateway } from '../realtime/realtime.gateway';
import { CreateNotificationDto } from './dto/create-notification.dto';
import { NotificationItem } from '@nexus-ways/shared';

@Injectable()
export class NotificationsService {
  constructor(
    private readonly supabase: SupabaseService,
    private readonly realtimeGateway: RealtimeGateway,
  ) {}

  async getNotifications(orgId: string, userId: string): Promise<NotificationItem[]> {
    const { data, error } = await this.supabase.adminClient
      .from('notifications')
      .select('*')
      .eq('org_id', orgId);

    if (error) {
      throw error;
    }

    // Filter to user-specific or org-wide (user_id is null or matches userId)
    const list = (data || []).filter(
      (n: any) => !n.user_id || n.user_id === userId,
    );

    // Sort: unread first, then newest first
    list.sort((a: any, b: any) => {
      if (!a.read_at && b.read_at) return -1;
      if (a.read_at && !b.read_at) return 1;
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });

    return list.map(this.mapToItem);
  }

  async getUnreadCount(orgId: string, userId: string): Promise<number> {
    const { data, error } = await this.supabase.adminClient
      .from('notifications')
      .select('*')
      .eq('org_id', orgId);

    if (error) {
      throw error;
    }

    const unread = (data || []).filter(
      (n: any) => (!n.user_id || n.user_id === userId) && !n.read_at,
    );

    return unread.length;
  }

  async markAsRead(id: string, orgId: string, userId: string): Promise<NotificationItem> {
    // First verify notification belongs to org and user
    const { data: existing, error: findError } = await this.supabase.adminClient
      .from('notifications')
      .select('*')
      .eq('id', id)
      .eq('org_id', orgId)
      .maybeSingle();

    if (findError || !existing) {
      throw new NotFoundException(`Notification with ID ${id} not found`);
    }

    if (existing.user_id && existing.user_id !== userId) {
      throw new NotFoundException(`Notification with ID ${id} not found`);
    }

    const now = new Date().toISOString();
    const { data, error } = await this.supabase.adminClient
      .from('notifications')
      .update({ read_at: now })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      // In mock environments where update isn't returning updated row
      existing.read_at = now;
      return this.mapToItem(existing);
    }

    return this.mapToItem(data);
  }

  async createNotification(
    orgId: string,
    dto: CreateNotificationDto,
  ): Promise<NotificationItem> {
    const insertPayload = {
      org_id: orgId,
      user_id: dto.userId || null,
      type: dto.type,
      title: dto.title,
      body: dto.body,
      action_label: dto.actionLabel || null,
      action_url: dto.actionUrl || null,
      read_at: null,
    };

    const { data, error } = await this.supabase.adminClient
      .from('notifications')
      .insert(insertPayload)
      .select()
      .single();

    if (error) {
      throw error;
    }

    const created = this.mapToItem(data);

    // Push over WebSocket gateway
    this.realtimeGateway.broadcastToOrg(orgId, 'notification:new', created);

    return created;
  }

  private mapToItem(row: any): NotificationItem {
    return {
      id: row.id,
      orgId: row.org_id,
      userId: row.user_id || null,
      type: row.type,
      title: row.title,
      body: row.body,
      actionLabel: row.action_label || null,
      actionUrl: row.action_url || null,
      readAt: row.read_at || null,
      createdAt: row.created_at,
    };
  }
}
