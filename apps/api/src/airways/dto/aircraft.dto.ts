import { IsIn, IsNotEmpty, IsNumber, IsOptional, IsPositive, IsString } from 'class-validator';

export class CreateAircraftDto {
  @IsString()
  @IsNotEmpty()
  tail_number: string;

  @IsString()
  @IsNotEmpty()
  aircraft_type: string;

  @IsOptional()
  @IsNumber()
  @IsPositive()
  cargo_capacity_kg?: number;

  @IsOptional()
  @IsIn(['idle', 'active', 'maintenance'])
  status?: 'idle' | 'active' | 'maintenance';
}

export class UpdateAircraftDto {
  @IsOptional()
  @IsString()
  tail_number?: string;

  @IsOptional()
  @IsString()
  aircraft_type?: string;

  @IsOptional()
  @IsNumber()
  @IsPositive()
  cargo_capacity_kg?: number;

  @IsOptional()
  @IsIn(['idle', 'active', 'maintenance'])
  status?: 'idle' | 'active' | 'maintenance';
}
