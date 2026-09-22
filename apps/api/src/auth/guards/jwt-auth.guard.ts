import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { SupabaseService } from '../../supabase/supabase.service';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private readonly supabaseService: SupabaseService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const token = this.extractToken(request);

    if (!token) {
      throw new UnauthorizedException('Authentication token required');
    }

    try {
      const decoded: any = await this.supabaseService.verifyJwt(token);
      const userId = decoded.sub || decoded.id;

      if (!userId) {
        throw new UnauthorizedException('Invalid token payload');
      }

      // If user profile is already in token (our minted access token), use it
      if (decoded.orgId && decoded.role) {
        request.user = {
          id: userId,
          email: decoded.email,
          orgId: decoded.orgId,
          role: decoded.role,
          fullName: decoded.fullName || decoded.full_name || '',
        };
        return true;
      }

      // Otherwise fetch from database
      const client = this.supabaseService.adminClient;
      let { data: userRow } = await client
        .from('users')
        .select('id, org_id, full_name, email, role')
        .eq('id', userId)
        .maybeSingle();

      if (!userRow) {
        const email = decoded.email || decoded.user_metadata?.email;
        if (email) {
          const fullName =
            decoded.user_metadata?.full_name ||
            decoded.user_metadata?.name ||
            email.split('@')[0] ||
            'User';

          const { data: orgData } = await client
            .from('organizations')
            .insert({
              name: `${fullName}'s Organization`,
              country: 'India',
              state: 'Maharashtra',
              district: 'Mumbai City',
              address: 'Headquarters',
              mode: 'roadways',
            })
            .select()
            .single();

          if (orgData) {
            const { data: newUser } = await client
              .from('users')
              .insert({
                id: userId,
                org_id: orgData.id,
                full_name: fullName,
                email: email.toLowerCase(),
                role: 'manager',
              })
              .select('id, org_id, full_name, email, role')
              .single();

            userRow = newUser;
          }
        }
      }

      if (!userRow) {
        throw new UnauthorizedException('User account not found');
      }

      request.user = {
        id: userRow.id,
        email: userRow.email,
        orgId: userRow.org_id,
        role: userRow.role,
        fullName: userRow.full_name,
      };

      return true;
    } catch (err: any) {
      if (err instanceof UnauthorizedException) {
        throw err;
      }
      throw new UnauthorizedException(err.message || 'Invalid or expired token');
    }
  }

  private extractToken(request: any): string | null {
    if (request.cookies && request.cookies['nw_access']) {
      return request.cookies['nw_access'];
    }
    const authHeader = request.headers?.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      return authHeader.substring(7);
    }
    return null;
  }
}
