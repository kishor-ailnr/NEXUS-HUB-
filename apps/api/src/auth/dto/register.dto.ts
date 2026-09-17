import { IsEmail, IsIn, IsNotEmpty, IsString, MinLength } from 'class-validator';
import { OrgMode, ORG_MODES } from '@nexus-ways/shared';

export class RegisterDto {
  @IsString()
  @IsNotEmpty()
  fullName: string;

  @IsEmail()
  @IsNotEmpty()
  email: string;

  @IsString()
  @MinLength(6)
  password: string;

  @IsString()
  @IsNotEmpty()
  orgName: string;

  @IsIn(ORG_MODES as unknown as string[])
  @IsNotEmpty()
  mode: OrgMode;

  @IsString()
  @IsNotEmpty()
  country: string;

  @IsString()
  @IsNotEmpty()
  state: string;

  @IsString()
  @IsNotEmpty()
  district: string;

  @IsString()
  @IsNotEmpty()
  address: string;
}
