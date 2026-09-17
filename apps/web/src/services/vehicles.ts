import { Vehicle, CreateVehicleDto, UpdateVehicleDto } from '@nexus-ways/shared';

const BASE_URL = '/vehicles';

export const vehiclesService = {
  async getVehicles(search?: string): Promise<Vehicle[]> {
    const url = search ? `${BASE_URL}?search=${encodeURIComponent(search)}` : BASE_URL;
    const response = await fetch(url, {
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch vehicles: ${response.statusText}`);
    }

    return response.json();
  },

  async getVehicle(id: string): Promise<Vehicle> {
    const response = await fetch(`${BASE_URL}/${id}`, {
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch vehicle: ${response.statusText}`);
    }

    return response.json();
  },

  async createVehicle(dto: CreateVehicleDto): Promise<Vehicle> {
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
      throw new Error(errorData.message || `Failed to create vehicle: ${response.statusText}`);
    }

    return response.json();
  },

  async updateVehicle(id: string, dto: UpdateVehicleDto): Promise<Vehicle> {
    const response = await fetch(`${BASE_URL}/${id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify(dto),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || `Failed to update vehicle: ${response.statusText}`);
    }

    return response.json();
  },

  async deleteVehicle(id: string): Promise<{ success: boolean }> {
    const response = await fetch(`${BASE_URL}/${id}`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || `Failed to delete vehicle: ${response.statusText}`);
    }

    return response.json();
  },
};
