import {
  Trip,
  CreateTripDto,
  AddCheckpointDto,
  SavedRoute,
  TripEtaResponse,
} from '@nexus-ways/shared';
import { apiFetch } from '../lib/api';

export const tripsService = {
  async getTrips(): Promise<Trip[]> {
    return apiFetch<Trip[]>('/trips', { method: 'GET' });
  },

  async getTrip(id: string): Promise<Trip> {
    return apiFetch<Trip>(`/trips/${id}`, { method: 'GET' });
  },

  async getTripEta(id: string): Promise<TripEtaResponse> {
    return apiFetch<TripEtaResponse>(`/trips/${id}/eta`, { method: 'GET' });
  },

  async getSavedRoutes(origin?: string, destination?: string): Promise<SavedRoute[]> {
    const params = new URLSearchParams();
    if (origin) params.append('origin', origin);
    if (destination) params.append('destination', destination);

    const query = params.toString();
    const endpoint = query ? `/trips/saved-routes?${query}` : '/trips/saved-routes';
    return apiFetch<SavedRoute[]>(endpoint, { method: 'GET' }).catch(() => []);
  },

  async createTrip(dto: CreateTripDto): Promise<Trip> {
    return apiFetch<Trip>('/trips', {
      method: 'POST',
      data: dto,
    });
  },

  async addCheckpoint(tripId: string, dto: AddCheckpointDto): Promise<Trip> {
    return apiFetch<Trip>(`/trips/${tripId}/checkpoints`, {
      method: 'PATCH',
      data: dto,
    });
  },

  async updateStatus(tripId: string, status: 'planned' | 'in_transit' | 'completed' | 'cancelled'): Promise<Trip> {
    return apiFetch<Trip>(`/trips/${tripId}/status`, {
      method: 'PATCH',
      data: { status },
    });
  },

  async getTripReport(tripId: string): Promise<{ tripId: string; signedUrl: string; storagePath: string; fileSizeBytes?: number; generatedAt: string }> {
    return apiFetch<{ tripId: string; signedUrl: string; storagePath: string; fileSizeBytes?: number; generatedAt: string }>(`/trips/${tripId}/report`, {
      method: 'GET',
    });
  },
};

export const tripsApi = tripsService;


