import { IsIn, IsNotEmpty, IsNumber, IsOptional, IsPositive, IsString } from 'class-validator';
import { VoyageMovementStatus } from '@nexus-ways/shared';

export class CreateVoyageMovementDto {
  @IsOptional()
  @IsString()
  voyageId?: string;

  @IsOptional()
  @IsString()
  voyage_id?: string;

  @IsOptional()
  @IsString()
  voyageNumber?: string;

  @IsOptional()
  @IsString()
  voyage_number?: string;

  @IsOptional()
  @IsString()
  originPortId?: string;

  @IsOptional()
  @IsString()
  origin_port_id?: string;

  @IsOptional()
  @IsString()
  destinationPortId?: string;

  @IsOptional()
  @IsString()
  destination_port_id?: string;

  @IsOptional()
  @IsString()
  vesselId?: string;

  @IsOptional()
  @IsString()
  vessel_id?: string;

  @IsOptional()
  @IsString()
  masterId?: string;

  @IsOptional()
  @IsString()
  master_id?: string;

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

export class UpdateVoyageMovementStatusDto {
  @IsNotEmpty()
  @IsIn(['planned', 'in_transit', 'completed', 'cancelled'])
  status: VoyageMovementStatus;
}
