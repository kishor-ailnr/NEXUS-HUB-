import { IsIn, IsNotEmpty, IsOptional, IsString, IsUUID } from 'class-validator';
import { NotificationType } from '@nexus-ways/shared';

export class CreateNotificationDto {
  @IsOptional()
  @IsUUID()
  userId?: string | null;

  @IsNotEmpty()
  @IsIn(['system', 'alert', 'info'])
  type: NotificationType;

  @IsNotEmpty()
  @IsString()
  title: string;

  @IsNotEmpty()
  @IsString()
  body: string;

  @IsOptional()
  @IsString()
  actionLabel?: string | null;

  @IsOptional()
  @IsString()
  actionUrl?: string | null;
}
