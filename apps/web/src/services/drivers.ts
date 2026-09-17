import { Driver, CreateDriverDto, UpdateDriverDto, DriverBehaviorScore } from '@nexus-ways/shared';

const BASE_URL = '/drivers';

export const driversService = {
  async getDrivers(): Promise<Driver[]> {
    const response = await fetch(BASE_URL, {
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch drivers: ${response.statusText}`);
    }

    return response.json();
  },

  async getDriver(id: string): Promise<Driver> {
    const response = await fetch(`${BASE_URL}/${id}`, {
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch driver: ${response.statusText}`);
    }

    return response.json();
  },

  async getBehaviorHistory(id: string): Promise<DriverBehaviorScore[]> {
    const response = await fetch(`${BASE_URL}/${id}/behavior-history`, {
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

  async createDriver(dto: CreateDriverDto): Promise<Driver> {
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
      throw new Error(errorData.message || `Failed to create driver: ${response.statusText}`);
    }

    return response.json();
  },

  async updateDriver(id: string, dto: UpdateDriverDto): Promise<Driver> {
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
      throw new Error(errorData.message || `Failed to update driver: ${response.statusText}`);
    }

    return response.json();
  },
};

export const driversApi = driversService;

