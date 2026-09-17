import {
  Airport,
  CreateAirportDto,
  Aircraft,
  CreateAircraftDto,
  FlightCrew,
  CreateFlightCrewDto,
  Flight,
  CreateFlightDto,
  FlightMovement,
  CreateFlightMovementDto,
  FlightMovementStatus,
  FlightTelemetry,
  FlightMovementEtaResponse,
  FlightMovementReportUrlResponse,
  AdminFlightReport,
  AirportSlotCheckResponse,
  CrewFlightScore,
  FlightDutyLog,
} from '@nexus-ways/shared';

const getHeaders = () => ({
  'Content-Type': 'application/json',
});

export const airwaysService = {
  // Airports
  async getAirports(): Promise<Airport[]> {
    const res = await fetch('/airports', { headers: getHeaders(), credentials: 'include' });
    if (!res.ok) throw new Error('Failed to fetch airports');
    return res.json();
  },

  async createAirport(dto: CreateAirportDto): Promise<Airport> {
    const res = await fetch('/airports', {
      method: 'POST',
      headers: getHeaders(),
      credentials: 'include',
      body: JSON.stringify(dto),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || 'Failed to create airport');
    }
    return res.json();
  },

  async deleteAirport(id: string): Promise<{ success: boolean }> {
    const res = await fetch(`/airports/${id}`, {
      method: 'DELETE',
      headers: getHeaders(),
      credentials: 'include',
    });
    if (!res.ok) throw new Error('Failed to delete airport');
    return res.json();
  },

  // Aircraft
  async getAircraft(): Promise<Aircraft[]> {
    const res = await fetch('/aircraft', { headers: getHeaders(), credentials: 'include' });
    if (!res.ok) throw new Error('Failed to fetch aircraft');
    return res.json();
  },

  async createAircraft(dto: CreateAircraftDto): Promise<Aircraft> {
    const res = await fetch('/aircraft', {
      method: 'POST',
      headers: getHeaders(),
      credentials: 'include',
      body: JSON.stringify(dto),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || 'Failed to create aircraft');
    }
    return res.json();
  },

  async deleteAircraft(id: string): Promise<{ success: boolean }> {
    const res = await fetch(`/aircraft/${id}`, {
      method: 'DELETE',
      headers: getHeaders(),
      credentials: 'include',
    });
    if (!res.ok) throw new Error('Failed to delete aircraft');
    return res.json();
  },

  // Flight Crew
  async getFlightCrew(): Promise<FlightCrew[]> {
    const res = await fetch('/flight-crew', { headers: getHeaders(), credentials: 'include' });
    if (!res.ok) throw new Error('Failed to fetch flight crew');
    return res.json();
  },

  async createFlightCrew(dto: CreateFlightCrewDto): Promise<FlightCrew> {
    const res = await fetch('/flight-crew', {
      method: 'POST',
      headers: getHeaders(),
      credentials: 'include',
      body: JSON.stringify(dto),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || 'Failed to create flight crew');
    }
    return res.json();
  },

  async deleteFlightCrew(id: string): Promise<{ success: boolean }> {
    const res = await fetch(`/flight-crew/${id}`, {
      method: 'DELETE',
      headers: getHeaders(),
      credentials: 'include',
    });
    if (!res.ok) throw new Error('Failed to delete flight crew');
    return res.json();
  },

  // Flights
  async getFlights(): Promise<Flight[]> {
    const res = await fetch('/flights', { headers: getHeaders(), credentials: 'include' });
    if (!res.ok) throw new Error('Failed to fetch flights');
    return res.json();
  },

  async createFlight(dto: CreateFlightDto): Promise<Flight> {
    const res = await fetch('/flights', {
      method: 'POST',
      headers: getHeaders(),
      credentials: 'include',
      body: JSON.stringify(dto),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || 'Failed to create flight route');
    }
    return res.json();
  },

  async deleteFlight(id: string): Promise<{ success: boolean }> {
    const res = await fetch(`/flights/${id}`, {
      method: 'DELETE',
      headers: getHeaders(),
      credentials: 'include',
    });
    if (!res.ok) throw new Error('Failed to delete flight');
    return res.json();
  },

  // Flight Movements
  async getMovements(): Promise<FlightMovement[]> {
    const res = await fetch('/flight-movements', { headers: getHeaders(), credentials: 'include' });
    if (!res.ok) throw new Error('Failed to fetch flight movements');
    return res.json();
  },

  async getMovement(id: string): Promise<FlightMovement> {
    const res = await fetch(`/flight-movements/${id}`, { headers: getHeaders(), credentials: 'include' });
    if (!res.ok) throw new Error('Failed to fetch flight movement details');
    return res.json();
  },

  async createMovement(dto: CreateFlightMovementDto): Promise<FlightMovement> {
    const res = await fetch('/flight-movements', {
      method: 'POST',
      headers: getHeaders(),
      credentials: 'include',
      body: JSON.stringify(dto),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || 'Failed to create flight movement');
    }
    return res.json();
  },

  async updateMovementStatus(id: string, status: FlightMovementStatus): Promise<FlightMovement> {
    const res = await fetch(`/flight-movements/${id}/status`, {
      method: 'PATCH',
      headers: getHeaders(),
      credentials: 'include',
      body: JSON.stringify({ status }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || 'Failed to update flight status');
    }
    return res.json();
  },

  async getTelemetry(id: string): Promise<FlightTelemetry[]> {
    const res = await fetch(`/flight-movements/${id}/telemetry`, {
      headers: getHeaders(),
      credentials: 'include',
    });
    if (!res.ok) throw new Error('Failed to fetch flight telemetry');
    return res.json();
  },

  // Intelligence & Reports
  async getEta(id: string): Promise<FlightMovementEtaResponse> {
    const res = await fetch(`/flight-movements/${id}/eta`, {
      headers: getHeaders(),
      credentials: 'include',
    });
    if (!res.ok) throw new Error('Failed to fetch flight ETA confidence');
    return res.json();
  },

  async getCrewScore(id: string): Promise<CrewFlightScore[]> {
    const res = await fetch(`/flight-movements/${id}/crew-score`, {
      headers: getHeaders(),
      credentials: 'include',
    });
    if (!res.ok) return [];
    return res.json();
  },

  async getDutyLogs(pilotId: string): Promise<FlightDutyLog[]> {
    const res = await fetch(`/flight-movements/duty-logs/${pilotId}`, {
      headers: getHeaders(),
      credentials: 'include',
    });
    if (!res.ok) return [];
    return res.json();
  },

  async checkAirportSlots(
    originAirportId: string,
    destinationAirportId: string,
    proposedDeparture?: string,
  ): Promise<AirportSlotCheckResponse> {
    const params = new URLSearchParams();
    if (originAirportId) params.append('originAirportId', originAirportId);
    if (destinationAirportId) params.append('destinationAirportId', destinationAirportId);
    if (proposedDeparture) params.append('proposedDeparture', proposedDeparture);

    const res = await fetch(`/flight-movements/slot-check?${params.toString()}`, {
      headers: getHeaders(),
      credentials: 'include',
    });
    if (!res.ok) throw new Error('Failed to check airport slot capacity');
    return res.json();
  },

  async getReportUrl(id: string): Promise<FlightMovementReportUrlResponse> {
    const res = await fetch(`/flight-movements/${id}/report`, {
      headers: getHeaders(),
      credentials: 'include',
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || 'Failed to fetch flight report URL');
    }
    return res.json();
  },

  async getAdminReports(): Promise<AdminFlightReport[]> {
    const res = await fetch('/flight-movements/reports', {
      headers: getHeaders(),
      credentials: 'include',
    });
    if (!res.ok) throw new Error('Failed to fetch airways admin reports');
    return res.json();
  },
};
