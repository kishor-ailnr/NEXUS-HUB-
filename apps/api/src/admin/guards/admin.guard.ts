import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { SupabaseService } from '../../supabase/supabase.service';

@Injectable()
export class AdminGuard implements CanActivate {
  constructor(private readonly supabaseService: SupabaseService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest();

    const adminToken = req.cookies?.['nw_admin'] || req.headers['x-nw-admin'];

    if (!adminToken) {
      throw new ForbiddenException('Admin session required. Please verify your password.');
    }

    try {
      const decoded = await this.supabaseService.verifyJwt(adminToken);
      if (decoded.scope !== 'admin') {
        throw new ForbiddenException('Invalid admin token scope');
      }

      // Check that the admin token matches the authenticated user
      const authenticatedUserId = req.user?.id || req.user?.sub;
      if (authenticatedUserId && decoded.sub !== authenticatedUserId) {
        throw new ForbiddenException('Admin token does not match authenticated user');
      }

      req.adminSession = decoded;
      return true;
    } catch {
      throw new ForbiddenException('Invalid or expired admin verification session');
    }
  }
}
