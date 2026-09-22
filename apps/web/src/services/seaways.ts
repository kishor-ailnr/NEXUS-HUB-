import {
  Port,
  CreatePortDto,
  Vessel,
  CreateVesselDto,
  SeaCrew,
  CreateSeaCrewDto,
  Voyage,
  CreateVoyageDto,
  VoyageMovement,
  CreateVoyageMovementDto,
  VoyageMovementStatus,
  VesselTelemetry,
  SeaConvoyGroup,
  CreateSeaConvoyDto,
  AddVesselToConvoyDto,
  VoyageMovementEtaResponse,
  PortSlotCheckResponse,
  VoyageMovementReportUrlResponse,
  AdminSeaReport,
  SeaCrewScore,
  WatchkeepingLog,
} from '@nexus-ways/shared';
import { apiFetch } from '../lib/api';

export const seawaysService = {
  // Ports
  async getPorts(): Promise<Port[]> {
    return apiFetch<Port[]>('/ports');
  },

  async createPort(dto: CreatePortDto): Promise<Port> {
    return apiFetch<Port>('/ports', {
      method: 'POST',
      data: dto,
    });
  },

  async deletePort(id: string): Promise<{ success: boolean }> {
    return apiFetch<{ success: boolean }>(`/ports/${id}`, {
      method: 'DELETE',
    });
  },

  // Vessels
  async getVessels(): Promise<Vessel[]> {
    return apiFetch<Vessel[]>('/vessels');
  },

  async createVessel(dto: CreateVesselDto): Promise<Vessel> {
    return apiFetch<Vessel>('/vessels', {
      method: 'POST',
      data: dto,
    });
  },

  async deleteVessel(id: string): Promise<{ success: boolean }> {
    return apiFetch<{ success: boolean }>(`/vessels/${id}`, {
      method: 'DELETE',
    });
  },

  // Sea Crew
  async getSeaCrew(): Promise<SeaCrew[]> {
    return apiFetch<SeaCrew[]>('/sea-crew');
  },

  async createSeaCrew(dto: CreateSeaCrewDto): Promise<SeaCrew> {
    return apiFetch<SeaCrew>('/sea-crew', {
      method: 'POST',
      data: dto,
    });
  },

  async deleteSeaCrew(id: string): Promise<{ success: boolean }> {
    return apiFetch<{ success: boolean }>(`/sea-crew/${id}`, {
      method: 'DELETE',
    });
  },

  // Voyages
  async getVoyages(): Promise<Voyage[]> {
    return apiFetch<Voyage[]>('/voyages');
  },

  async createVoyage(dto: CreateVoyageDto): Promise<Voyage> {
    return apiFetch<Voyage>('/voyages', {
      method: 'POST',
      data: dto,
    });
  },

  async deleteVoyage(id: string): Promise<{ success: boolean }> {
    return apiFetch<{ success: boolean }>(`/voyages/${id}`, {
      method: 'DELETE',
    });
  },

  // Voyage Movements
  async getMovements(): Promise<VoyageMovement[]> {
    return apiFetch<VoyageMovement[]>('/voyage-movements');
  },

  async getMovement(id: string): Promise<VoyageMovement> {
    return apiFetch<VoyageMovement>(`/voyage-movements/${id}`);
  },

  async createMovement(dto: CreateVoyageMovementDto): Promise<VoyageMovement> {
    return apiFetch<VoyageMovement>('/voyage-movements', {
      method: 'POST',
      data: dto,
    });
  },

  async updateMovementStatus(id: string, status: VoyageMovementStatus): Promise<VoyageMovement> {
    return apiFetch<VoyageMovement>(`/voyage-movements/${id}/status`, {
      method: 'PATCH',
      data: { status },
    });
  },

  async getTelemetry(id: string): Promise<VesselTelemetry[]> {
    return apiFetch<VesselTelemetry[]>(`/voyage-movements/${id}/telemetry`);
  },

  // Intelligence & Reports
  async getEta(id: string): Promise<VoyageMovementEtaResponse> {
    return apiFetch<VoyageMovementEtaResponse>(`/voyage-movements/${id}/eta`);
  },

  async getCrewScore(id: string): Promise<SeaCrewScore[]> {
    return apiFetch<SeaCrewScore[]>(`/voyage-movements/${id}/crew-score`).catch(() => []);
  },

  async getWatchkeepingLogs(crewId: string): Promise<WatchkeepingLog[]> {
    return apiFetch<WatchkeepingLog[]>(`/voyage-movements/watchkeeping-logs/${crewId}`).catch(() => []);
  },

  async checkPortSlots(
    originPortId: string,
    destinationPortId: string,
    proposedDeparture?: string,
  ): Promise<PortSlotCheckResponse> {
    const params = new URLSearchParams();
    if (originPortId) params.append('originPortId', originPortId);
    if (destinationPortId) params.append('destinationPortId', destinationPortId);
    if (proposedDeparture) params.append('proposedDeparture', proposedDeparture);

    return apiFetch<PortSlotCheckResponse>(`/voyage-movements/slot-check?${params.toString()}`);
  },

  async getReportUrl(id: string): Promise<VoyageMovementReportUrlResponse> {
    return apiFetch<VoyageMovementReportUrlResponse>(`/voyage-movements/${id}/report`);
  },

  async getAdminReports(): Promise<AdminSeaReport[]> {
    return apiFetch<AdminSeaReport[]>('/voyage-movements/reports');
  },

  // Sea Convoys
  async getConvoys(): Promise<SeaConvoyGroup[]> {
    return apiFetch<SeaConvoyGroup[]>('/sea-convoys');
  },

  async getConvoy(id: string): Promise<SeaConvoyGroup> {
    return apiFetch<SeaConvoyGroup>(`/sea-convoys/${id}`);
  },

  async createConvoy(dto: CreateSeaConvoyDto): Promise<SeaConvoyGroup> {
    return apiFetch<SeaConvoyGroup>('/sea-convoys', {
      method: 'POST',
      data: dto,
    });
  },

  async addVesselToConvoy(convoyId: string, dto: AddVesselToConvoyDto): Promise<SeaConvoyGroup> {
    return apiFetch<SeaConvoyGroup>(`/sea-convoys/${convoyId}/vessels`, {
      method: 'POST',
      data: dto,
    });
  },

  async removeVesselFromConvoy(convoyId: string, vesselId: string): Promise<void> {
    return apiFetch<void>(`/sea-convoys/${convoyId}/vessels/${vesselId}`, {
      method: 'DELETE',
    });
  },

  async disbandConvoy(id: string): Promise<void> {
    return apiFetch<void>(`/sea-convoys/${id}`, {
      method: 'DELETE',
    });
  },
};
