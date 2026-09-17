import {
  ConflictException,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { OrgMode, RegisterRequest, UserProfile, UserRole } from '@nexus-ways/shared';
import { SupabaseService } from '../supabase/supabase.service';
import { GeocodingService } from '../geocoding/geocoding.service';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly supabaseService: SupabaseService,
    private readonly geocodingService: GeocodingService,
  ) {}

  /**
   * Register a new user and organization.
   * Rollback cleanly if any stage fails.
   */
  async register(dto: RegisterRequest): Promise<{
    user: UserProfile;
    accessToken: string;
    refreshToken: string;
  }> {
    const client = this.supabaseService.adminClient;

    // Check if email already exists in public.users
    const { data: existingUser } = await client
      .from('users')
      .select('id, email')
      .eq('email', dto.email.toLowerCase().trim())
      .maybeSingle();

    if (existingUser) {
      throw new ConflictException('An account with this email already exists.');
    }

    let createdAuthUserId: string | null = null;
    let createdOrgId: string | null = null;

    try {
      // 1. Create Supabase Auth User
      const { data: authData, error: authError } = await client.auth.admin.createUser({
        email: dto.email.toLowerCase().trim(),
        password: dto.password,
        email_confirm: true,
        user_metadata: {
          full_name: dto.fullName,
        },
      });

      if (authError || !authData.user) {
        if (
          authError?.message?.toLowerCase().includes('already registered') ||
          authError?.message?.toLowerCase().includes('already exists') ||
          authError?.status === 422
        ) {
          throw new ConflictException('An account with this email already exists.');
        }
        throw new InternalServerErrorException(
          authError?.message || 'Failed to create auth user in Supabase',
        );
      }

      createdAuthUserId = authData.user.id;

      // Geocode organization address asynchronously/safely
      const addressQuery = `${dto.address}, ${dto.district}, ${dto.state}, ${dto.country || 'India'}`;
      let coords: { latitude: number; longitude: number } | null = null;
      try {
        coords = await this.geocodingService.geocodeAddress(addressQuery);
      } catch (geoErr: any) {
        this.logger.warn(`Geocoding failed for ${addressQuery}: ${geoErr.message}`);
      }

      // 2. Create Organization with specified mode and coordinates
      const orgInsertPayload: any = {
        name: dto.orgName.trim(),
        country: dto.country || 'India',
        state: dto.state.trim(),
        district: dto.district.trim(),
        address: dto.address.trim(),
        mode: dto.mode || 'roadways',
        latitude: coords?.latitude || null,
        longitude: coords?.longitude || null,
      };

      const { data: orgData, error: orgError } = await client
        .from('organizations')
        .insert(orgInsertPayload)
        .select()
        .single();

      if (orgError || !orgData) {
        throw new InternalServerErrorException(
          orgError?.message || 'Failed to create organization record',
        );
      }

      createdOrgId = orgData.id;

      // 3. Create public.users entry linking to organization
      const { data: userData, error: userError } = await client
        .from('users')
        .insert({
          id: createdAuthUserId,
          org_id: createdOrgId,
          full_name: dto.fullName.trim(),
          email: dto.email.toLowerCase().trim(),
          role: 'manager' as UserRole,
        })
        .select()
        .single();

      if (userError || !userData) {
        throw new InternalServerErrorException(
          userError?.message || 'Failed to create public user record',
        );
      }

      const orgMode = (orgData.mode || dto.mode || 'roadways') as OrgMode;

      // Generate tokens
      const accessToken = this.supabaseService.signToken(
        {
          sub: createdAuthUserId,
          id: createdAuthUserId,
          email: userData.email,
          fullName: userData.full_name,
          orgId: createdOrgId,
          role: userData.role,
          mode: orgMode,
        },
        '1h',
      );

      const refreshToken = this.supabaseService.signToken(
        {
          sub: createdAuthUserId,
          id: createdAuthUserId,
          token_type: 'refresh',
        },
        '7d',
      );

      const profile: UserProfile = {
        id: userData.id,
        email: userData.email,
        fullName: userData.full_name,
        role: userData.role,
        orgId: createdOrgId,
        organization: {
          id: orgData.id,
          name: orgData.name,
          mode: orgMode,
          country: orgData.country,
          state: orgData.state,
          district: orgData.district,
          address: orgData.address,
          latitude: orgData.latitude || coords?.latitude || null,
          longitude: orgData.longitude || coords?.longitude || null,
        },
      };

      return {
        user: profile,
        accessToken,
        refreshToken,
      };
    } catch (err) {
      // Rollback any partially created resources
      this.logger.error(`Registration failed. Rolling back resources. Error: ${err.message}`);

      if (createdOrgId) {
        try {
          await client.from('organizations').delete().eq('id', createdOrgId);
        } catch (rollbackErr) {
          this.logger.error(`Failed to rollback organization ${createdOrgId}:`, rollbackErr);
        }
      }

      if (createdAuthUserId) {
        try {
          await client.auth.admin.deleteUser(createdAuthUserId);
        } catch (rollbackErr) {
          this.logger.error(`Failed to rollback auth user ${createdAuthUserId}:`, rollbackErr);
        }
      }

      if (err instanceof ConflictException || err instanceof UnauthorizedException) {
        throw err;
      }
      throw new InternalServerErrorException(err.message || 'Registration failed');
    }
  }

  /**
   * Exchange Supabase tokens for session cookies and public profile.
   * Validates requestedMode against organization mode to enforce mode isolation.
   */
  async exchangeSession(
    accessToken: string,
    refreshToken: string,
    requestedMode?: OrgMode,
  ): Promise<{
    user: UserProfile;
    nwAccessToken: string;
    nwRefreshToken: string;
  }> {
    if (!accessToken) {
      throw new UnauthorizedException('Access token is missing');
    }

    let decoded: any;
    try {
      decoded = await this.supabaseService.verifyJwt(accessToken);
    } catch (err) {
      throw new UnauthorizedException('Invalid or tampered access token');
    }

    const userId = decoded.sub || decoded.id;
    if (!userId) {
      throw new UnauthorizedException('Invalid token payload: missing user identifier');
    }

    const client = this.supabaseService.adminClient;

    // Fetch user & organization from database
    let { data: userRow } = await client
      .from('users')
      .select('id, org_id, full_name, email, role, organizations(*)')
      .eq('id', userId)
      .maybeSingle();

    // If user record doesn't exist yet (e.g. First Google OAuth sign-in)
    if (!userRow) {
      const email = decoded.email || decoded.user_metadata?.email;
      const fullName =
        decoded.user_metadata?.full_name ||
        decoded.user_metadata?.name ||
        email?.split('@')[0] ||
        'User';

      if (!email) {
        throw new UnauthorizedException('Token payload does not contain user email');
      }

      const defaultMode = requestedMode || 'roadways';

      // Create default organization
      const { data: orgData, error: orgErr } = await client
        .from('organizations')
        .insert({
          name: `${fullName}'s Organization`,
          country: 'India',
          state: 'Maharashtra',
          district: 'Mumbai City',
          address: 'Main Office',
          mode: defaultMode,
        })
        .select()
        .single();

      if (orgErr || !orgData) {
        throw new InternalServerErrorException('Failed to provision organization for user');
      }

      const { data: newUser, error: userErr } = await client
        .from('users')
        .insert({
          id: userId,
          org_id: orgData.id,
          full_name: fullName,
          email: email.toLowerCase(),
          role: 'manager' as UserRole,
        })
        .select('id, org_id, full_name, email, role, organizations(*)')
        .single();

      if (userErr || !newUser) {
        throw new InternalServerErrorException('Failed to provision public user row');
      }

      userRow = newUser;
    }

    const org = (userRow as any).organizations;
    const orgMode = (org?.mode || 'roadways') as OrgMode;

    // Enforce mode isolation: 403 Forbidden if requested mode does not match user organization mode
    if (requestedMode && orgMode !== requestedMode) {
      throw new ForbiddenException(
        `Access denied: Organization mode mismatch. User belongs to '${orgMode}', cannot access '${requestedMode}'.`,
      );
    }

    // Mint internal application tokens
    const nwAccessToken = this.supabaseService.signToken(
      {
        sub: userRow.id,
        id: userRow.id,
        email: userRow.email,
        fullName: userRow.full_name,
        orgId: userRow.org_id,
        role: userRow.role,
        mode: orgMode,
      },
      '1h',
    );

    const nwRefreshToken =
      refreshToken && refreshToken.length > 20
        ? refreshToken
        : this.supabaseService.signToken(
            {
              sub: userRow.id,
              id: userRow.id,
              token_type: 'refresh',
            },
            '7d',
          );

    const profile: UserProfile = {
      id: userRow.id,
      email: userRow.email,
      fullName: userRow.full_name,
      role: userRow.role,
      orgId: userRow.org_id,
      organization: {
        id: org?.id || userRow.org_id,
        name: org?.name || 'Default Organization',
        mode: orgMode,
        country: org?.country || 'India',
        state: org?.state || '',
        district: org?.district || '',
        address: org?.address || '',
        latitude: org?.latitude || null,
        longitude: org?.longitude || null,
      },
    };

    return {
      user: profile,
      nwAccessToken,
      nwRefreshToken,
    };
  }

  /**
   * Refresh session using refresh token cookie.
   */
  async refresh(refreshToken: string): Promise<{
    user: UserProfile;
    newAccessToken: string;
    newRefreshToken: string;
  }> {
    if (!refreshToken) {
      throw new UnauthorizedException('Refresh token is required');
    }

    let decoded: any;
    try {
      decoded = await this.supabaseService.verifyJwt(refreshToken);
    } catch (err) {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    const userId = decoded.sub || decoded.id;
    if (!userId) {
      throw new UnauthorizedException('Invalid refresh token payload');
    }

    const client = this.supabaseService.adminClient;
    const { data: userRow, error } = await client
      .from('users')
      .select('id, org_id, full_name, email, role, organizations(*)')
      .eq('id', userId)
      .single();

    if (error || !userRow) {
      throw new UnauthorizedException('User account no longer exists');
    }

    const org = (userRow as any).organizations;
    const orgMode = (org?.mode || 'roadways') as OrgMode;

    const newAccessToken = this.supabaseService.signToken(
      {
        sub: userRow.id,
        id: userRow.id,
        email: userRow.email,
        fullName: userRow.full_name,
        orgId: userRow.org_id,
        role: userRow.role,
        mode: orgMode,
      },
      '1h',
    );

    const newRefreshToken = this.supabaseService.signToken(
      {
        sub: userRow.id,
        id: userRow.id,
        token_type: 'refresh',
      },
      '7d',
    );

    const profile: UserProfile = {
      id: userRow.id,
      email: userRow.email,
      fullName: userRow.full_name,
      role: userRow.role,
      orgId: userRow.org_id,
      organization: {
        id: org?.id || userRow.org_id,
        name: org?.name || 'Default Organization',
        mode: orgMode,
        country: org?.country || 'India',
        state: org?.state || '',
        district: org?.district || '',
        address: org?.address || '',
        latitude: org?.latitude || null,
        longitude: org?.longitude || null,
      },
    };

    return {
      user: profile,
      newAccessToken,
      newRefreshToken,
    };
  }

  /**
   * Get user profile by userId.
   */
  async getMe(userId: string): Promise<UserProfile> {
    const client = this.supabaseService.adminClient;
    const { data: userRow, error } = await client
      .from('users')
      .select('id, org_id, full_name, email, role, organizations(*)')
      .eq('id', userId)
      .single();

    if (error || !userRow) {
      throw new NotFoundException('User profile not found');
    }

    const org = (userRow as any).organizations;
    const orgMode = (org?.mode || 'roadways') as OrgMode;

    return {
      id: userRow.id,
      email: userRow.email,
      fullName: userRow.full_name,
      role: userRow.role,
      orgId: userRow.org_id,
      organization: {
        id: org?.id || userRow.org_id,
        name: org?.name || 'Default Organization',
        mode: orgMode,
        country: org?.country || 'India',
        state: org?.state || '',
        district: org?.district || '',
        address: org?.address || '',
        latitude: org?.latitude || null,
        longitude: org?.longitude || null,
      },
    };
  }
}
