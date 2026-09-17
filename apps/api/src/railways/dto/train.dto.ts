import { IsIn, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { TrainStatus } from '@nexus-ways/shared';

export class CreateTrainDto {
  @IsString()
  @IsNotEmpty()
  train_number: string;

  @IsOptional()
  @IsString()
  train_name?: string;

  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  locomotive_id?: string;

  @IsOptional()
  @IsString()
  locomotiveId?: string;

  @IsOptional()
  @IsString()
  rake_id?: string;

  @IsOptional()
  @IsString()
  rakeId?: string;

  @IsOptional()
  @IsIn(['idle', 'assigned', 'in_transit', 'maintenance'])
  status?: TrainStatus;
}

export class UpdateTrainDto {
  @IsOptional()
  @IsString()
  train_number?: string;

  @IsOptional()
  @IsString()
  train_name?: string;

  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  locomotive_id?: string;

  @IsOptional()
  @IsString()
  locomotiveId?: string;

  @IsOptional()
  @IsString()
  rake_id?: string;

  @IsOptional()
  @IsString()
  rakeId?: string;

  @IsOptional()
  @IsIn(['idle', 'assigned', 'in_transit', 'maintenance'])
  status?: TrainStatus;
}
