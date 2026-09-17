import {
  IsIn,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
} from 'class-validator';
import { VehicleStatus } from '@nexus-ways/shared';

export class CreateVehicleDto {
  @IsString()
  @IsNotEmpty()
  registrationNumber: string;

  @IsString()
  @IsNotEmpty()
  vehicleType: string;

  @IsOptional()
  @IsNumber()
  @IsPositive()
  capacityKg?: number;

  @IsOptional()
  @IsString()
  assignedDriverId?: string;
}

export class UpdateVehicleDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  registrationNumber?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  vehicleType?: string;

  @IsOptional()
  @IsNumber()
  @IsPositive()
  capacityKg?: number;

  @IsOptional()
  @IsIn(['available', 'in_transit', 'maintenance'])
  status?: VehicleStatus;

  @IsOptional()
  @IsString()
  assignedDriverId?: string | null;
}
