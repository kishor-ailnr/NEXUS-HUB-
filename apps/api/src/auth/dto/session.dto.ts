import { IsIn, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { OrgMode, ORG_MODES } from '@nexus-ways/shared';

export class SessionDto {
  @IsString()
  @IsNotEmpty()
  access_token: string;

  @IsString()
  @IsNotEmpty()
  refresh_token: string;

  @IsOptional()
  @IsIn(ORG_MODES as unknown as string[])
  mode?: OrgMode;
}
