import {
  Station,
  CreateStationDto,
  Locomotive,
  CreateLocomotiveDto,
  Rake,
  CreateRakeDto,
  LocoPilot,
  CreateLocoPilotDto,
  Train,
  CreateTrainDto,
  TrainMovement,
  CreateTrainMovementDto,
  TrainMovementStatus,
  SavedRailRoute,
  RailSlotCheckResponse,
  TrainMovementEtaResponse,
  TrainMovementReportUrlResponse,
  AdminRailReport,
  CrewBehaviorScore,
} from '@nexus-ways/shared';

const getHeaders = () => ({
  'Content-Type': 'application/json',
});

export const railwaysService = {
  // Stations
  async getStations(): Promise<Station[]> {
    const res = await fetch('/stations', { headers: getHeaders(), credentials: 'include' });
    if (!res.ok) throw new Error('Failed to fetch stations');
    return res.json();
  },

  async createStation(dto: CreateStationDto): Promise<Station> {
    const res = await fetch('/stations', {
      method: 'POST',
      headers: getHeaders(),
      credentials: 'include',
      body: JSON.stringify(dto),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || 'Failed to create station');
    }
    return res.json();
  },

  async deleteStation(id: string): Promise<{ success: boolean }> {
    const res = await fetch(`/stations/${id}`, {
      method: 'DELETE',
      headers: getHeaders(),
      credentials: 'include',
    });
    if (!res.ok) throw new Error('Failed to delete station');
    return res.json();
  },

  // Locomotives
  async getLocomotives(): Promise<Locomotive[]> {
    const res = await fetch('/locomotives', { headers: getHeaders(), credentials: 'include' });
    if (!res.ok) throw new Error('Failed to fetch locomotives');
    return res.json();
  },

  async createLocomotive(dto: CreateLocomotiveDto): Promise<Locomotive> {
    const res = await fetch('/locomotives', {
      method: 'POST',
      headers: getHeaders(),
      credentials: 'include',
      body: JSON.stringify(dto),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || 'Failed to create locomotive');
    }
    return res.json();
  },

  async deleteLocomotive(id: string): Promise<{ success: boolean }> {
    const res = await fetch(`/locomotives/${id}`, {
      method: 'DELETE',
      headers: getHeaders(),
      credentials: 'include',
    });
    if (!res.ok) throw new Error('Failed to delete locomotive');
    return res.json();
  },

  // Rakes
  async getRakes(): Promise<Rake[]> {
    const res = await fetch('/rakes', { headers: getHeaders(), credentials: 'include' });
    if (!res.ok) throw new Error('Failed to fetch rakes');
    return res.json();
  },

  async createRake(dto: CreateRakeDto): Promise<Rake> {
    const res = await fetch('/rakes', {
      method: 'POST',
      headers: getHeaders(),
      credentials: 'include',
      body: JSON.stringify(dto),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || 'Failed to create rake');
    }
    return res.json();
  },

  async deleteRake(id: string): Promise<{ success: boolean }> {
    const res = await fetch(`/rakes/${id}`, {
      method: 'DELETE',
      headers: getHeaders(),
      credentials: 'include',
    });
    if (!res.ok) throw new Error('Failed to delete rake');
    return res.json();
  },

  // Loco Pilots
  async getLocoPilots(): Promise<LocoPilot[]> {
    const res = await fetch('/loco-pilots', { headers: getHeaders(), credentials: 'include' });
    if (!res.ok) throw new Error('Failed to fetch loco pilots');
    return res.json();
  },

  async createLocoPilot(dto: CreateLocoPilotDto): Promise<LocoPilot> {
    const res = await fetch('/loco-pilots', {
      method: 'POST',
      headers: getHeaders(),
      credentials: 'include',
      body: JSON.stringify(dto),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || 'Failed to create loco pilot');
    }
    return res.json();
  },

  async deleteLocoPilot(id: string): Promise<{ success: boolean }> {
    const res = await fetch(`/loco-pilots/${id}`, {
      method: 'DELETE',
      headers: getHeaders(),
      credentials: 'include',
    });
    if (!res.ok) throw new Error('Failed to delete loco pilot');
    return res.json();
  },

  // Trains
  async getTrains(): Promise<Train[]> {
    const res = await fetch('/trains', { headers: getHeaders(), credentials: 'include' });
    if (!res.ok) throw new Error('Failed to fetch trains');
    return res.json();
  },

  async createTrain(dto: CreateTrainDto): Promise<Train> {
    const res = await fetch('/trains', {
      method: 'POST',
      headers: getHeaders(),
      credentials: 'include',
      body: JSON.stringify(dto),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || 'Failed to create train');
    }
    return res.json();
  },

  async deleteTrain(id: string): Promise<{ success: boolean }> {
    const res = await fetch(`/trains/${id}`, {
      method: 'DELETE',
      headers: getHeaders(),
      credentials: 'include',
    });
    if (!res.ok) throw new Error('Failed to delete train');
    return res.json();
  },

  // Train Movements
  async getMovements(): Promise<TrainMovement[]> {
    const res = await fetch('/train-movements', { headers: getHeaders(), credentials: 'include' });
    if (!res.ok) throw new Error('Failed to fetch train movements');
    return res.json();
  },

  async getMovement(id: string): Promise<TrainMovement> {
    const res = await fetch(`/train-movements/${id}`, { headers: getHeaders(), credentials: 'include' });
    if (!res.ok) throw new Error('Failed to fetch train movement');
    return res.json();
  },

  async createMovement(dto: CreateTrainMovementDto): Promise<TrainMovement> {
    const res = await fetch('/train-movements', {
      method: 'POST',
      headers: getHeaders(),
      credentials: 'include',
      body: JSON.stringify(dto),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || 'Failed to create train movement');
    }
    return res.json();
  },

  async updateMovementStatus(id: string, status: TrainMovementStatus): Promise<TrainMovement> {
    const res = await fetch(`/train-movements/${id}/status`, {
      method: 'PATCH',
      headers: getHeaders(),
      credentials: 'include',
      body: JSON.stringify({ status }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || 'Failed to update movement status');
    }
    return res.json();
  },

  async getSavedRoutes(): Promise<SavedRailRoute[]> {
    const res = await fetch('/train-movements/saved-routes', { headers: getHeaders(), credentials: 'include' });
    if (!res.ok) throw new Error('Failed to fetch saved rail routes');
    return res.json();
  },

  // Slot Intelligence Check
  async checkSlot(
    originStationId: string,
    destinationStationId: string,
    proposedDeparture?: string,
    routeId?: string,
  ): Promise<RailSlotCheckResponse> {
    const params = new URLSearchParams();
    if (originStationId) params.append('originStationId', originStationId);
    if (destinationStationId) params.append('destinationStationId', destinationStationId);
    if (routeId) params.append('routeId', routeId);
    if (proposedDeparture) params.append('proposedDeparture', proposedDeparture);

    const res = await fetch(`/train-movements/slot-check?${params.toString()}`, {
      headers: getHeaders(),
      credentials: 'include',
    });
    if (!res.ok) throw new Error('Failed to check rail slot');
    return res.json();
  },

  // ETA Confidence
  async getEta(movementId: string): Promise<TrainMovementEtaResponse> {
    const res = await fetch(`/train-movements/${movementId}/eta`, {
      headers: getHeaders(),
      credentials: 'include',
    });
    if (!res.ok) throw new Error('Failed to fetch ETA confidence');
    return res.json();
  },

  // Report signed URL
  async getReportUrl(movementId: string): Promise<TrainMovementReportUrlResponse> {
    const res = await fetch(`/train-movements/${movementId}/report`, {
      headers: getHeaders(),
      credentials: 'include',
    });
    if (!res.ok) throw new Error('Failed to fetch train movement report');
    return res.json();
  },

  // Admin reports listing
  async getAdminReports(): Promise<AdminRailReport[]> {
    const res = await fetch('/train-movements/reports', {
      headers: getHeaders(),
      credentials: 'include',
    });
    if (!res.ok) throw new Error('Failed to fetch train reports');
    return res.json();
  },

  // Crew behavior score
  async getCrewScore(locoPilotId: string): Promise<CrewBehaviorScore[]> {
    const res = await fetch(`/train-movements/${locoPilotId}/crew-score`, {
      headers: getHeaders(),
      credentials: 'include',
    });
    if (!res.ok) throw new Error('Failed to fetch crew score');
    return res.json();
  },
};
