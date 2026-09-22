import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Throttle } from '@nestjs/throttler';
import { Request, Response } from 'express';
import { OrgMode } from '@nexus-ways/shared';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { SessionDto } from './dto/session.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { RolesGuard } from './guards/roles.guard';
import { Roles } from './decorators/roles.decorator';
import { CurrentUser, RequestUser } from './decorators/current-user.decorator';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly configService: ConfigService,
  ) {}

  private setCookies(res: Response, accessToken: string, refreshToken: string) {
    const isProd = this.configService.get<string>('NODE_ENV') === 'production';
    const domain = this.configService.get<string>('COOKIE_DOMAIN');

    const cookieOptions: any = {
      httpOnly: true,
      secure: isProd,
      sameSite: isProd ? 'none' : 'lax',
      path: '/',
    };

    if (domain && domain !== 'localhost') {
      cookieOptions.domain = domain;
    }

    // nw_access: 1 hour
    res.cookie('nw_access', accessToken, {
      ...cookieOptions,
      maxAge: 60 * 60 * 1000,
    });

    // nw_refresh: 7 days
    res.cookie('nw_refresh', refreshToken, {
      ...cookieOptions,
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });
  }

  private clearCookies(res: Response) {
    const isProd = this.configService.get<string>('NODE_ENV') === 'production';
    const domain = this.configService.get<string>('COOKIE_DOMAIN');
    const cookieOptions: any = {
      httpOnly: true,
      secure: isProd,
      sameSite: isProd ? 'none' : 'lax',
      path: '/',
    };

    if (domain && domain !== 'localhost') {
      cookieOptions.domain = domain;
    }

    res.clearCookie('nw_access', cookieOptions);
    res.clearCookie('nw_refresh', cookieOptions);
  }

  @Post('register')
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @HttpCode(HttpStatus.CREATED)
  async register(
    @Body() dto: RegisterDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { user, accessToken, refreshToken } = await this.authService.register(dto);
    this.setCookies(res, accessToken, refreshToken);
    return {
      user,
      accessToken,
      refreshToken,
      message: 'Registration successful',
    };
  }

  @Post('session')
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @HttpCode(HttpStatus.OK)
  async session(
    @Body() dto: SessionDto,
    @Headers('x-nw-mode') headerMode: string | undefined,
    @Res({ passthrough: true }) res: Response,
  ) {
    const requestedMode = (dto.mode || headerMode) as OrgMode | undefined;
    const { user, nwAccessToken, nwRefreshToken } = await this.authService.exchangeSession(
      dto.access_token,
      dto.refresh_token,
      requestedMode,
    );
    this.setCookies(res, nwAccessToken, nwRefreshToken);
    return {
      user,
      accessToken: nwAccessToken,
      refreshToken: nwRefreshToken,
      message: 'Session exchanged successfully',
    };
  }

  @Post('refresh')
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @HttpCode(HttpStatus.OK)
  async refresh(
    @Req() req: Request,
    @Body() body: { refreshToken?: string },
    @Res({ passthrough: true }) res: Response,
  ) {
    const refreshToken = req.cookies?.['nw_refresh'] || body?.refreshToken;
    const { user, newAccessToken, newRefreshToken } = await this.authService.refresh(refreshToken);
    this.setCookies(res, newAccessToken, newRefreshToken);
    return {
      user,
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
      message: 'Session refreshed',
    };
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  async logout(@Res({ passthrough: true }) res: Response) {
    this.clearCookies(res);
    return { message: 'Logged out successfully' };
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  async getMe(@CurrentUser() user: RequestUser) {
    const profile = await this.authService.getMe(user.id);
    return { user: profile };
  }

  @Get('manager-only')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('manager')
  async managerOnly(@CurrentUser() user: RequestUser) {
    return { status: 'ok', message: 'Welcome manager', user };
  }
}
