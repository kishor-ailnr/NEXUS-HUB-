import { Geofence, CreateGeofenceDto, GeofenceEvent } from '@nexus-ways/shared';

const BASE_URL = '/geofences';

export const geofencesService = {
  async getGeofences(): Promise<Geofence[]> {
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

  async createGeofence(dto: CreateGeofenceDto): Promise<Geofence> {
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
      throw new Error(errorData.message || `Failed to create geofence: ${response.statusText}`);
    }

    return response.json();
  },

  async getRecentEvents(): Promise<GeofenceEvent[]> {
    const response = await fetch(`${BASE_URL}/events`, {
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
};
