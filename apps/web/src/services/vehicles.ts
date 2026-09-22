import { Vehicle, CreateVehicleDto, UpdateVehicleDto } from '@nexus-ways/shared';
import { apiFetch } from '../lib/api';

export const vehiclesService = {
  async getVehicles(search?: string): Promise<Vehicle[]> {
    const endpoint = search ? `/vehicles?search=${encodeURIComponent(search)}` : '/vehicles';
    return apiFetch<Vehicle[]>(endpoint, { method: 'GET' });
  },

  async getVehicle(id: string): Promise<Vehicle> {
    return apiFetch<Vehicle>(`/vehicles/${id}`, { method: 'GET' });
  },

  async createVehicle(dto: CreateVehicleDto): Promise<Vehicle> {
    return apiFetch<Vehicle>('/vehicles', {
      method: 'POST',
      data: dto,
    });
  },

  async updateVehicle(id: string, dto: UpdateVehicleDto): Promise<Vehicle> {
    return apiFetch<Vehicle>(`/vehicles/${id}`, {
      method: 'PATCH',
      data: dto,
    });
  },

  async deleteVehicle(id: string): Promise<{ success: boolean }> {
    return apiFetch<{ success: boolean }>(`/vehicles/${id}`, {
      method: 'DELETE',
    });
  },
};

