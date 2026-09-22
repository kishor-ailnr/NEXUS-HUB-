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
import { apiFetch } from '../lib/api';

export const airwaysService = {
  // Airports
  async getAirports(): Promise<Airport[]> {
    return apiFetch<Airport[]>('/airports');
  },

  async createAirport(dto: CreateAirportDto): Promise<Airport> {
    return apiFetch<Airport>('/airports', {
      method: 'POST',
      data: dto,
    });
  },

  async deleteAirport(id: string): Promise<{ success: boolean }> {
    return apiFetch<{ success: boolean }>(`/airports/${id}`, {
      method: 'DELETE',
    });
  },

  // Aircraft
  async getAircraft(): Promise<Aircraft[]> {
    return apiFetch<Aircraft[]>('/aircraft');
  },

  async createAircraft(dto: CreateAircraftDto): Promise<Aircraft> {
    return apiFetch<Aircraft>('/aircraft', {
      method: 'POST',
      data: dto,
    });
  },

  async deleteAircraft(id: string): Promise<{ success: boolean }> {
    return apiFetch<{ success: boolean }>(`/aircraft/${id}`, {
      method: 'DELETE',
    });
  },

  // Flight Crew
  async getFlightCrew(): Promise<FlightCrew[]> {
    return apiFetch<FlightCrew[]>('/flight-crew');
  },

  async createFlightCrew(dto: CreateFlightCrewDto): Promise<FlightCrew> {
    return apiFetch<FlightCrew>('/flight-crew', {
      method: 'POST',
      data: dto,
    });
  },

  async deleteFlightCrew(id: string): Promise<{ success: boolean }> {
    return apiFetch<{ success: boolean }>(`/flight-crew/${id}`, {
      method: 'DELETE',
    });
  },

  // Flights
  async getFlights(): Promise<Flight[]> {
    return apiFetch<Flight[]>('/flights');
  },

  async createFlight(dto: CreateFlightDto): Promise<Flight> {
    return apiFetch<Flight>('/flights', {
      method: 'POST',
      data: dto,
    });
  },

  async deleteFlight(id: string): Promise<{ success: boolean }> {
    return apiFetch<{ success: boolean }>(`/flights/${id}`, {
      method: 'DELETE',
    });
  },

  // Flight Movements
  async getMovements(): Promise<FlightMovement[]> {
    return apiFetch<FlightMovement[]>('/flight-movements');
  },

  async getMovement(id: string): Promise<FlightMovement> {
    return apiFetch<FlightMovement>(`/flight-movements/${id}`);
  },

  async createMovement(dto: CreateFlightMovementDto): Promise<FlightMovement> {
    return apiFetch<FlightMovement>('/flight-movements', {
      method: 'POST',
      data: dto,
    });
  },

  async updateMovementStatus(id: string, status: FlightMovementStatus): Promise<FlightMovement> {
    return apiFetch<FlightMovement>(`/flight-movements/${id}/status`, {
      method: 'PATCH',
      data: { status },
    });
  },

  async getTelemetry(id: string): Promise<FlightTelemetry[]> {
    return apiFetch<FlightTelemetry[]>(`/flight-movements/${id}/telemetry`);
  },

  // Intelligence & Reports
  async getEta(id: string): Promise<FlightMovementEtaResponse> {
    return apiFetch<FlightMovementEtaResponse>(`/flight-movements/${id}/eta`);
  },

  async getCrewScore(id: string): Promise<CrewFlightScore[]> {
    return apiFetch<CrewFlightScore[]>(`/flight-movements/${id}/crew-score`).catch(() => []);
  },

  async getDutyLogs(pilotId: string): Promise<FlightDutyLog[]> {
    return apiFetch<FlightDutyLog[]>(`/flight-movements/duty-logs/${pilotId}`).catch(() => []);
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

    return apiFetch<AirportSlotCheckResponse>(`/flight-movements/slot-check?${params.toString()}`);
  },

  async getReportUrl(id: string): Promise<FlightMovementReportUrlResponse> {
    return apiFetch<FlightMovementReportUrlResponse>(`/flight-movements/${id}/report`);
  },

  async getAdminReports(): Promise<AdminFlightReport[]> {
    return apiFetch<AdminFlightReport[]>('/flight-movements/reports');
  },
};
