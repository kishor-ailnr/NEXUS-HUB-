import { ConvoyGroup, CreateConvoyDto } from '@nexus-ways/shared';
import { apiFetch } from '../lib/api';

export const convoysService = {
  async getConvoys(): Promise<ConvoyGroup[]> {
    return apiFetch<ConvoyGroup[]>('/convoys', { method: 'GET' }).catch(() => []);
  },

  async createConvoy(dto: CreateConvoyDto): Promise<ConvoyGroup> {
    return apiFetch<ConvoyGroup>('/convoys', {
      method: 'POST',
      data: dto,
    });
  },

  async addMember(convoyId: string, vehicleId: string): Promise<{ success: boolean }> {
    return apiFetch<{ success: boolean }>(`/convoys/${convoyId}/members/${vehicleId}`, {
      method: 'POST',
    });
  },

  async removeMember(convoyId: string, vehicleId: string): Promise<{ success: boolean }> {
    return apiFetch<{ success: boolean }>(`/convoys/${convoyId}/members/${vehicleId}`, {
      method: 'DELETE',
    });
  },
};

