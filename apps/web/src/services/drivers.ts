import { Driver, CreateDriverDto, UpdateDriverDto, DriverBehaviorScore } from '@nexus-ways/shared';
import { apiFetch } from '../lib/api';

export const driversService = {
  async getDrivers(): Promise<Driver[]> {
    return apiFetch<Driver[]>('/drivers', { method: 'GET' });
  },

  async getDriver(id: string): Promise<Driver> {
    return apiFetch<Driver>(`/drivers/${id}`, { method: 'GET' });
  },

  async getBehaviorHistory(id: string): Promise<DriverBehaviorScore[]> {
    return apiFetch<DriverBehaviorScore[]>(`/drivers/${id}/behavior-history`, { method: 'GET' }).catch(() => []);
  },

  async createDriver(dto: CreateDriverDto): Promise<Driver> {
    return apiFetch<Driver>('/drivers', {
      method: 'POST',
      data: dto,
    });
  },

  async updateDriver(id: string, dto: UpdateDriverDto): Promise<Driver> {
    return apiFetch<Driver>(`/drivers/${id}`, {
      method: 'PATCH',
      data: dto,
    });
  },
};

export const driversApi = driversService;


