import { AdminUser, AdminReport, AdminUpdateUserDto } from '@nexus-ways/shared';
import { apiFetch } from '../lib/api';

export const adminService = {
  async verifyPassword(password: string): Promise<{ status: string; expiresInMinutes: number }> {
    return apiFetch<{ status: string; expiresInMinutes: number }>('/admin/verify-password', {
      method: 'POST',
      data: { password },
    });
  },

  async getUsers(): Promise<AdminUser[]> {
    const res = await apiFetch<{ users: AdminUser[] }>('/admin/users', {
      method: 'GET',
    });
    return res.users || [];
  },

  async updateUser(userId: string, dto: AdminUpdateUserDto): Promise<AdminUser> {
    const res = await apiFetch<{ user: AdminUser }>(`/admin/users/${userId}`, {
      method: 'PATCH',
      data: dto,
    });
    return res.user;
  },

  async getReports(): Promise<AdminReport[]> {
    const res = await apiFetch<{ reports: AdminReport[] }>('/admin/reports', {
      method: 'GET',
    });
    return res.reports || [];
  },
};

export const adminApi = adminService;
