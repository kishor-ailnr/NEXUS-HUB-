import { Geofence, CreateGeofenceDto, GeofenceEvent } from '@nexus-ways/shared';
import { apiFetch } from '../lib/api';

export const geofencesService = {
  async getGeofences(): Promise<Geofence[]> {
    return apiFetch<Geofence[]>('/geofences', { method: 'GET' }).catch(() => []);
  },

  async createGeofence(dto: CreateGeofenceDto): Promise<Geofence> {
    return apiFetch<Geofence>('/geofences', {
      method: 'POST',
      data: dto,
    });
  },

  async getRecentEvents(): Promise<GeofenceEvent[]> {
    return apiFetch<GeofenceEvent[]>('/geofences/events', { method: 'GET' }).catch(() => []);
  },
};

