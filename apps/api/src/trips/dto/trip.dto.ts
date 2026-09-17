import {
  IsArray,
  IsIn,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  IsUUID,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { TripStatus } from '@nexus-ways/shared';

export class CheckpointItemDto {
  @IsString()
  @IsNotEmpty()
  label: string;

  @IsNumber()
  lat: number;

  @IsNumber()
  lng: number;
}

export class CreateTripDto {
  @IsString()
  @IsNotEmpty()
  vehicleId: string;

  @IsString()
  @IsNotEmpty()
  driverId: string;

  @IsString()
  @IsNotEmpty()
  originAddress: string;

  @IsString()
  @IsNotEmpty()
  destinationAddress: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CheckpointItemDto)
  checkpoints?: CheckpointItemDto[];

  @IsOptional()
  @IsNumber()
  @IsPositive()
  simulationSpeedMultiplier?: number;
}

export class UpdateTripStatusDto {
  @IsNotEmpty()
  @IsIn(['planned', 'in_transit', 'completed', 'cancelled'])
  status: TripStatus;
}

export class AddCheckpointDto {
  @IsString()
  @IsNotEmpty()
  label: string;

  @IsNumber()
  lat: number;

  @IsNumber()
  lng: number;
}
