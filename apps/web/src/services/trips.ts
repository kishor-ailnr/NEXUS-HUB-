import {
  Trip,
  CreateTripDto,
  UpdateTripStatusDto,
  AddCheckpointDto,
  SavedRoute,
  TripEtaResponse,
} from '@nexus-ways/shared';

const BASE_URL = '/trips';

export const tripsService = {
  async getTrips(): Promise<Trip[]> {
    const response = await fetch(BASE_URL, {
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch trips: ${response.statusText}`);
    }

    return response.json();
  },

  async getTrip(id: string): Promise<Trip> {
    const response = await fetch(`${BASE_URL}/${id}`, {
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch trip: ${response.statusText}`);
    }

    return response.json();
  },

  async getTripEta(id: string): Promise<TripEtaResponse> {
    const response = await fetch(`${BASE_URL}/${id}/eta`, {
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch ETA: ${response.statusText}`);
    }

    return response.json();
  },

  async getSavedRoutes(origin?: string, destination?: string): Promise<SavedRoute[]> {
    const params = new URLSearchParams();
    if (origin) params.append('origin', origin);
    if (destination) params.append('destination', destination);

    const url = `${BASE_URL}/saved-routes?${params.toString()}`;
    const response = await fetch(url, {
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

  async createTrip(dto: CreateTripDto): Promise<Trip> {
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
      throw new Error(errorData.message || `Failed to create trip: ${response.statusText}`);
    }

    return response.json();
  },

  async addCheckpoint(tripId: string, dto: AddCheckpointDto): Promise<Trip> {
    const response = await fetch(`${BASE_URL}/${tripId}/checkpoints`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify(dto),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || `Failed to add checkpoint: ${response.statusText}`);
    }

    return response.json();
  },

  async updateStatus(tripId: string, status: 'planned' | 'in_transit' | 'completed' | 'cancelled'): Promise<Trip> {
    const response = await fetch(`${BASE_URL}/${tripId}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify({ status }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || `Failed to update trip status: ${response.statusText}`);
    }

    return response.json();
  },

  async getTripReport(tripId: string): Promise<{ tripId: string; signedUrl: string; storagePath: string; fileSizeBytes?: number; generatedAt: string }> {
    const response = await fetch(`${BASE_URL}/${tripId}/report`, {
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || `Failed to fetch trip report: ${response.statusText}`);
    }

    return response.json();
  },
};

export const tripsApi = tripsService;

