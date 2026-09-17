import { IsIn, IsOptional, IsString } from 'class-validator';
import { UserRole } from '@nexus-ways/shared';

export class UpdateUserDto {
  @IsOptional()
  @IsString()
  fullName?: string;

  @IsOptional()
  @IsIn(['manager', 'operator', 'driver', 'crew'])
  role?: UserRole;
}
