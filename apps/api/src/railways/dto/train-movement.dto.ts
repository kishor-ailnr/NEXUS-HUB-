import { IsArray, IsIn, IsNotEmpty, IsNumber, IsOptional, IsPositive, IsString } from 'class-validator';
import { TrainMovementStatus } from '@nexus-ways/shared';

export class CreateTrainMovementDto {
  @IsOptional()
  @IsString()
  trainId?: string;

  @IsOptional()
  @IsString()
  train_id?: string;

  @IsOptional()
  @IsString()
  locoPilotId?: string;

  @IsOptional()
  @IsString()
  loco_pilot_id?: string;

  @IsOptional()
  @IsString()
  originStationId?: string;

  @IsOptional()
  @IsString()
  origin_station_id?: string;

  @IsOptional()
  @IsString()
  destinationStationId?: string;

  @IsOptional()
  @IsString()
  destination_station_id?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  intermediateStationIds?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  intermediate_station_ids?: string[];

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

export class UpdateTrainMovementStatusDto {
  @IsNotEmpty()
  @IsIn(['planned', 'in_transit', 'completed', 'cancelled'])
  status: TrainMovementStatus;
}
