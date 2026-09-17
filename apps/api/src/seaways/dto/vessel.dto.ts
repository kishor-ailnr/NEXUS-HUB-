import { IsIn, IsNotEmpty, IsNumber, IsOptional, IsPositive, IsString } from 'class-validator';
import { VesselStatus } from '@nexus-ways/shared';

export class CreateVesselDto {
  @IsString()
  @IsNotEmpty()
  vessel_name: string;

  @IsOptional()
  @IsString()
  vesselName?: string;

  @IsOptional()
  @IsString()
  imo_number?: string;

  @IsOptional()
  @IsString()
  imoNumber?: string;

  @IsString()
  @IsNotEmpty()
  vessel_type: string;

  @IsOptional()
  @IsString()
  vesselType?: string;

  @IsOptional()
  @IsNumber()
  @IsPositive()
  dwt_tonnes?: number;

  @IsOptional()
  @IsNumber()
  @IsPositive()
  dwtTonnes?: number;

  @IsOptional()
  @IsNumber()
  @IsPositive()
  teu_capacity?: number;

  @IsOptional()
  @IsNumber()
  @IsPositive()
  teuCapacity?: number;

  @IsOptional()
  @IsIn(['idle', 'active', 'maintenance'])
  status?: VesselStatus;
}

export class UpdateVesselDto {
  @IsOptional()
  @IsString()
  vessel_name?: string;

  @IsOptional()
  @IsString()
  vesselName?: string;

  @IsOptional()
  @IsString()
  imo_number?: string;

  @IsOptional()
  @IsString()
  imoNumber?: string;

  @IsOptional()
  @IsString()
  vessel_type?: string;

  @IsOptional()
  @IsString()
  vesselType?: string;

  @IsOptional()
  @IsNumber()
  @IsPositive()
  dwt_tonnes?: number;

  @IsOptional()
  @IsNumber()
  @IsPositive()
  dwtTonnes?: number;

  @IsOptional()
  @IsNumber()
  @IsPositive()
  teu_capacity?: number;

  @IsOptional()
  @IsNumber()
  @IsPositive()
  teuCapacity?: number;

  @IsOptional()
  @IsIn(['idle', 'active', 'maintenance'])
  status?: VesselStatus;
}
