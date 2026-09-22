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
import { apiFetch } from '../lib/api';

export const railwaysService = {
  // Stations
  async getStations(): Promise<Station[]> {
    return apiFetch<Station[]>('/stations');
  },

  async createStation(dto: CreateStationDto): Promise<Station> {
    return apiFetch<Station>('/stations', {
      method: 'POST',
      data: dto,
    });
  },

  async deleteStation(id: string): Promise<{ success: boolean }> {
    return apiFetch<{ success: boolean }>(`/stations/${id}`, {
      method: 'DELETE',
    });
  },

  // Locomotives
  async getLocomotives(): Promise<Locomotive[]> {
    return apiFetch<Locomotive[]>('/locomotives');
  },

  async createLocomotive(dto: CreateLocomotiveDto): Promise<Locomotive> {
    return apiFetch<Locomotive>('/locomotives', {
      method: 'POST',
      data: dto,
    });
  },

  async deleteLocomotive(id: string): Promise<{ success: boolean }> {
    return apiFetch<{ success: boolean }>(`/locomotives/${id}`, {
      method: 'DELETE',
    });
  },

  // Rakes
  async getRakes(): Promise<Rake[]> {
    return apiFetch<Rake[]>('/rakes');
  },

  async createRake(dto: CreateRakeDto): Promise<Rake> {
    return apiFetch<Rake>('/rakes', {
      method: 'POST',
      data: dto,
    });
  },

  async deleteRake(id: string): Promise<{ success: boolean }> {
    return apiFetch<{ success: boolean }>(`/rakes/${id}`, {
      method: 'DELETE',
    });
  },

  // Loco Pilots
  async getLocoPilots(): Promise<LocoPilot[]> {
    return apiFetch<LocoPilot[]>('/loco-pilots');
  },

  async createLocoPilot(dto: CreateLocoPilotDto): Promise<LocoPilot> {
    return apiFetch<LocoPilot>('/loco-pilots', {
      method: 'POST',
      data: dto,
    });
  },

  async deleteLocoPilot(id: string): Promise<{ success: boolean }> {
    return apiFetch<{ success: boolean }>(`/loco-pilots/${id}`, {
      method: 'DELETE',
    });
  },

  // Trains
  async getTrains(): Promise<Train[]> {
    return apiFetch<Train[]>('/trains');
  },

  async createTrain(dto: CreateTrainDto): Promise<Train> {
    return apiFetch<Train>('/trains', {
      method: 'POST',
      data: dto,
    });
  },

  async deleteTrain(id: string): Promise<{ success: boolean }> {
    return apiFetch<{ success: boolean }>(`/trains/${id}`, {
      method: 'DELETE',
    });
  },

  // Train Movements
  async getMovements(): Promise<TrainMovement[]> {
    return apiFetch<TrainMovement[]>('/train-movements');
  },

  async getMovement(id: string): Promise<TrainMovement> {
    return apiFetch<TrainMovement>(`/train-movements/${id}`);
  },

  async createMovement(dto: CreateTrainMovementDto): Promise<TrainMovement> {
    return apiFetch<TrainMovement>('/train-movements', {
      method: 'POST',
      data: dto,
    });
  },

  async updateMovementStatus(id: string, status: TrainMovementStatus): Promise<TrainMovement> {
    return apiFetch<TrainMovement>(`/train-movements/${id}/status`, {
      method: 'PATCH',
      data: { status },
    });
  },

  async getSavedRoutes(): Promise<SavedRailRoute[]> {
    return apiFetch<SavedRailRoute[]>('/train-movements/saved-routes');
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

    return apiFetch<RailSlotCheckResponse>(`/train-movements/slot-check?${params.toString()}`);
  },

  // ETA Confidence
  async getEta(movementId: string): Promise<TrainMovementEtaResponse> {
    return apiFetch<TrainMovementEtaResponse>(`/train-movements/${movementId}/eta`);
  },

  // Report signed URL
  async getReportUrl(movementId: string): Promise<TrainMovementReportUrlResponse> {
    return apiFetch<TrainMovementReportUrlResponse>(`/train-movements/${movementId}/report`);
  },

  // Admin reports listing
  async getAdminReports(): Promise<AdminRailReport[]> {
    return apiFetch<AdminRailReport[]>('/train-movements/reports');
  },

  // Crew behavior score
  async getCrewScore(locoPilotId: string): Promise<CrewBehaviorScore[]> {
    return apiFetch<CrewBehaviorScore[]>(`/train-movements/${locoPilotId}/crew-score`);
  },
};
