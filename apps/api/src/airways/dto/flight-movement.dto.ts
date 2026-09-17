import { IsIn, IsNotEmpty, IsNumber, IsOptional, IsPositive, IsString } from 'class-validator';
import { FlightMovementStatus } from '@nexus-ways/shared';

export class CreateFlightMovementDto {
  @IsOptional()
  @IsString()
  flightId?: string;

  @IsOptional()
  @IsString()
  flight_id?: string;

  @IsOptional()
  @IsString()
  flightNumber?: string;

  @IsOptional()
  @IsString()
  flight_number?: string;

  @IsOptional()
  @IsString()
  originAirportId?: string;

  @IsOptional()
  @IsString()
  origin_airport_id?: string;

  @IsOptional()
  @IsString()
  destinationAirportId?: string;

  @IsOptional()
  @IsString()
  destination_airport_id?: string;

  @IsOptional()
  @IsString()
  aircraftId?: string;

  @IsOptional()
  @IsString()
  aircraft_id?: string;

  @IsOptional()
  @IsString()
  pilotId?: string;

  @IsOptional()
  @IsString()
  pilot_id?: string;

  @IsOptional()
  @IsNumber()
  @IsPositive()
  simulationSpeedMultiplier?: number;

  @IsOptional()
  @IsNumber()
  @IsPositive()
  simulation_speed_multiplier?: number;

  @IsOptional()
  @IsString()
  proposedDeparture?: string;

  @IsOptional()
  @IsString()
  proposed_departure?: string;
}

export class UpdateFlightMovementStatusDto {
  @IsNotEmpty()
  @IsIn(['planned', 'in_transit', 'completed', 'cancelled'])
  status: FlightMovementStatus;
}
