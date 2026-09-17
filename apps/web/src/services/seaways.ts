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

const getHeaders = () => ({
  'Content-Type': 'application/json',
});

export const seawaysService = {
  // Ports
  async getPorts(): Promise<Port[]> {
    const res = await fetch('/ports', { headers: getHeaders(), credentials: 'include' });
    if (!res.ok) throw new Error('Failed to fetch ports');
    return res.json();
  },

  async createPort(dto: CreatePortDto): Promise<Port> {
    const res = await fetch('/ports', {
      method: 'POST',
      headers: getHeaders(),
      credentials: 'include',
      body: JSON.stringify(dto),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || 'Failed to create port');
    }
    return res.json();
  },

  async deletePort(id: string): Promise<{ success: boolean }> {
    const res = await fetch(`/ports/${id}`, {
      method: 'DELETE',
      headers: getHeaders(),
      credentials: 'include',
    });
    if (!res.ok) throw new Error('Failed to delete port');
    return res.json();
  },

  // Vessels
  async getVessels(): Promise<Vessel[]> {
    const res = await fetch('/vessels', { headers: getHeaders(), credentials: 'include' });
    if (!res.ok) throw new Error('Failed to fetch vessels');
    return res.json();
  },

  async createVessel(dto: CreateVesselDto): Promise<Vessel> {
    const res = await fetch('/vessels', {
      method: 'POST',
      headers: getHeaders(),
      credentials: 'include',
      body: JSON.stringify(dto),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || 'Failed to create vessel');
    }
    return res.json();
  },

  async deleteVessel(id: string): Promise<{ success: boolean }> {
    const res = await fetch(`/vessels/${id}`, {
      method: 'DELETE',
      headers: getHeaders(),
      credentials: 'include',
    });
    if (!res.ok) throw new Error('Failed to delete vessel');
    return res.json();
  },

  // Sea Crew
  async getSeaCrew(): Promise<SeaCrew[]> {
    const res = await fetch('/sea-crew', { headers: getHeaders(), credentials: 'include' });
    if (!res.ok) throw new Error('Failed to fetch sea crew');
    return res.json();
  },

  async createSeaCrew(dto: CreateSeaCrewDto): Promise<SeaCrew> {
    const res = await fetch('/sea-crew', {
      method: 'POST',
      headers: getHeaders(),
      credentials: 'include',
      body: JSON.stringify(dto),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || 'Failed to create sea crew member');
    }
    return res.json();
  },

  async deleteSeaCrew(id: string): Promise<{ success: boolean }> {
    const res = await fetch(`/sea-crew/${id}`, {
      method: 'DELETE',
      headers: getHeaders(),
      credentials: 'include',
    });
    if (!res.ok) throw new Error('Failed to delete sea crew member');
    return res.json();
  },

  // Voyages
  async getVoyages(): Promise<Voyage[]> {
    const res = await fetch('/voyages', { headers: getHeaders(), credentials: 'include' });
    if (!res.ok) throw new Error('Failed to fetch voyages');
    return res.json();
  },

  async createVoyage(dto: CreateVoyageDto): Promise<Voyage> {
    const res = await fetch('/voyages', {
      method: 'POST',
      headers: getHeaders(),
      credentials: 'include',
      body: JSON.stringify(dto),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || 'Failed to create voyage');
    }
    return res.json();
  },

  async deleteVoyage(id: string): Promise<{ success: boolean }> {
    const res = await fetch(`/voyages/${id}`, {
      method: 'DELETE',
      headers: getHeaders(),
      credentials: 'include',
    });
    if (!res.ok) throw new Error('Failed to delete voyage');
    return res.json();
  },

  // Voyage Movements
  async getMovements(): Promise<VoyageMovement[]> {
    const res = await fetch('/voyage-movements', { headers: getHeaders(), credentials: 'include' });
    if (!res.ok) throw new Error('Failed to fetch voyage movements');
    return res.json();
  },

  async getMovement(id: string): Promise<VoyageMovement> {
    const res = await fetch(`/voyage-movements/${id}`, { headers: getHeaders(), credentials: 'include' });
    if (!res.ok) throw new Error('Failed to fetch voyage movement');
    return res.json();
  },

  async createMovement(dto: CreateVoyageMovementDto): Promise<VoyageMovement> {
    const res = await fetch('/voyage-movements', {
      method: 'POST',
      headers: getHeaders(),
      credentials: 'include',
      body: JSON.stringify(dto),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || 'Failed to dispatch voyage movement');
    }
    return res.json();
  },

  async updateMovementStatus(id: string, status: VoyageMovementStatus): Promise<VoyageMovement> {
    const res = await fetch(`/voyage-movements/${id}/status`, {
      method: 'PATCH',
      headers: getHeaders(),
      credentials: 'include',
      body: JSON.stringify({ status }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || 'Failed to update voyage movement status');
    }
    return res.json();
  },

  // Intelligence: ETA Confidence
  async getEta(id: string): Promise<VoyageMovementEtaResponse> {
    const res = await fetch(`/voyage-movements/${id}/eta`, { headers: getHeaders(), credentials: 'include' });
    if (!res.ok) throw new Error('Failed to fetch voyage ETA confidence');
    return res.json();
  },

  // Intelligence: Crew Score
  async getCrewScore(id: string): Promise<SeaCrewScore[]> {
    const res = await fetch(`/voyage-movements/${id}/crew-score`, { headers: getHeaders(), credentials: 'include' });
    if (!res.ok) throw new Error('Failed to fetch sea crew score');
    return res.json();
  },

  // Intelligence: Watchkeeping Logs
  async getWatchkeepingLogs(crewId: string): Promise<WatchkeepingLog[]> {
    const res = await fetch(`/voyage-movements/watchkeeping-logs/${crewId}`, { headers: getHeaders(), credentials: 'include' });
    if (!res.ok) throw new Error('Failed to fetch watchkeeping logs');
    return res.json();
  },

  // Intelligence: Port Berth & Fairway Slot Check
  async checkPortSlots(
    originPortId: string,
    destinationPortId: string,
    proposedDeparture?: string,
  ): Promise<PortSlotCheckResponse> {
    const params = new URLSearchParams({
      originPortId,
      destinationPortId,
      ...(proposedDeparture ? { proposedDeparture } : {}),
    });
    const res = await fetch(`/voyage-movements/slot-check?${params.toString()}`, {
      headers: getHeaders(),
      credentials: 'include',
    });
    if (!res.ok) throw new Error('Failed to check port slot capacity');
    return res.json();
  },

  // Reports: PDF Report Signed Download URL
  async getReportUrl(movementId: string): Promise<VoyageMovementReportUrlResponse> {
    const res = await fetch(`/voyage-movements/${movementId}/report`, {
      headers: getHeaders(),
      credentials: 'include',
    });
    if (!res.ok) throw new Error('Failed to retrieve voyage PDF audit report URL');
    return res.json();
  },

  // Reports: Admin Report Directory
  async getAdminReports(): Promise<AdminSeaReport[]> {
    const res = await fetch('/voyage-movements/reports', {
      headers: getHeaders(),
      credentials: 'include',
    });
    if (!res.ok) throw new Error('Failed to fetch Seaways admin reports');
    return res.json();
  },

  // Sea Convoys
  async getConvoys(): Promise<SeaConvoyGroup[]> {
    const res = await fetch('/sea-convoys', { headers: getHeaders(), credentials: 'include' });
    if (!res.ok) throw new Error('Failed to fetch convoy groups');
    return res.json();
  },

  async getConvoy(id: string): Promise<SeaConvoyGroup> {
    const res = await fetch(`/sea-convoys/${id}`, { headers: getHeaders(), credentials: 'include' });
    if (!res.ok) throw new Error('Failed to fetch convoy group');
    return res.json();
  },

  async createConvoy(dto: CreateSeaConvoyDto): Promise<SeaConvoyGroup> {
    const res = await fetch('/sea-convoys', {
      method: 'POST',
      headers: getHeaders(),
      credentials: 'include',
      body: JSON.stringify(dto),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || 'Failed to create convoy group');
    }
    return res.json();
  },

  async addVesselToConvoy(convoyId: string, dto: AddVesselToConvoyDto) {
    const res = await fetch(`/sea-convoys/${convoyId}/vessels`, {
      method: 'POST',
      headers: getHeaders(),
      credentials: 'include',
      body: JSON.stringify(dto),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || 'Failed to add vessel to convoy');
    }
    return res.json();
  },

  async removeVesselFromConvoy(convoyId: string, vesselId: string) {
    const res = await fetch(`/sea-convoys/${convoyId}/vessels/${vesselId}`, {
      method: 'DELETE',
      headers: getHeaders(),
      credentials: 'include',
    });
    if (!res.ok) throw new Error('Failed to remove vessel from convoy');
    return res.json();
  },

  async deleteConvoy(id: string) {
    const res = await fetch(`/sea-convoys/${id}`, {
      method: 'DELETE',
      headers: getHeaders(),
      credentials: 'include',
    });
    if (!res.ok) throw new Error('Failed to delete convoy group');
    return res.json();
  },
};
