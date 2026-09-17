import { ConvoyGroup, CreateConvoyDto } from '@nexus-ways/shared';

const BASE_URL = '/convoys';

export const convoysService = {
  async getConvoys(): Promise<ConvoyGroup[]> {
    const response = await fetch(BASE_URL, {
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
    });

    if (!response.ok) {
      return [];
    }

    return response.json();
  },

  async createConvoy(dto: CreateConvoyDto): Promise<ConvoyGroup> {
    const response = await fetch(BASE_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify(dto),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || `Failed to create convoy: ${response.statusText}`);
    }

    return response.json();
  },

  async addMember(convoyId: string, vehicleId: string): Promise<{ success: boolean }> {
    const response = await fetch(`${BASE_URL}/${convoyId}/members/${vehicleId}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || `Failed to add member to convoy: ${response.statusText}`);
    }

    return response.json();
  },

  async removeMember(convoyId: string, vehicleId: string): Promise<{ success: boolean }> {
    const response = await fetch(`${BASE_URL}/${convoyId}/members/${vehicleId}`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || `Failed to remove member from convoy: ${response.statusText}`);
    }

    return response.json();
  },
};
