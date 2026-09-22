import { OrgMode, RegisterRequest, UserProfile } from '@nexus-ways/shared';
import { supabase } from '../lib/supabase';
import { apiFetch, setStoredAuthToken, clearStoredAuthToken } from '../lib/api';

export const authService = {
  /**
   * Register a new user and organization through NestJS API
   */
  async register(data: RegisterRequest): Promise<UserProfile> {
    const res = await apiFetch<{ user: UserProfile; accessToken?: string }>('/auth/register', {
      method: 'POST',
      data,
    });
    if (res.accessToken) {
      setStoredAuthToken(res.accessToken);
    }
    return res.user;
  },

  /**
   * Sign in with email and password via Supabase, then exchange session with NestJS API
   */
  async signInWithPassword(email: string, password: string, mode?: OrgMode): Promise<UserProfile> {
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (authError || !authData.session) {
      throw new Error(authError?.message || 'Invalid email or password');
    }

    const { access_token, refresh_token } = authData.session;

    // Exchange session with API, passing division mode
    try {
      const res = await apiFetch<{ user: UserProfile; accessToken?: string }>('/auth/session', {
        method: 'POST',
        headers: mode ? { 'X-NW-Mode': mode } : undefined,
        data: {
          access_token,
          refresh_token,
          mode,
        },
      });
      if (res.accessToken) {
        setStoredAuthToken(res.accessToken);
      }
      return res.user;
    } catch (apiErr) {
      console.warn('API session exchange failed, falling back to direct Supabase profile:', apiErr);
      const { data: dbUser, error: userErr } = await supabase
        .from('users')
        .select('id, email, full_name, role, org_id, organization:organizations(*)')
        .eq('id', authData.user.id)
        .single();

      if (userErr || !dbUser) {
        throw new Error(userErr?.message || 'Could not load user profile from database');
      }

      const org = dbUser.organization as any;
      return {
        id: dbUser.id,
        email: dbUser.email,
        fullName: dbUser.full_name,
        role: dbUser.role,
        orgId: dbUser.org_id,
        organization: {
          id: org.id,
          name: org.name,
          mode: org.mode || mode || 'roadways',
          country: org.country,
          state: org.state,
          district: org.district,
          address: org.address,
          latitude: org.latitude,
          longitude: org.longitude,
        },
      };
    }
  },

  /**
   * Initiate Google OAuth redirect flow
   */
  async signInWithGoogle(mode?: OrgMode): Promise<void> {
    const targetMode = mode || 'roadways';
    const redirectTo = `${window.location.origin}/${targetMode}/login`;

    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo,
        queryParams: {
          access_type: 'offline',
          prompt: 'consent',
        },
      },
    });

    if (error) {
      throw new Error(error.message);
    }
  },

  /**
   * Exchange Supabase access and refresh token with backend
   */
  async exchangeSession(accessToken: string, refreshToken: string, mode?: OrgMode): Promise<UserProfile> {
    try {
      const res = await apiFetch<{ user: UserProfile; accessToken?: string }>('/auth/session', {
        method: 'POST',
        headers: mode ? { 'X-NW-Mode': mode } : undefined,
        data: {
          access_token: accessToken,
          refresh_token: refreshToken,
          mode,
        },
      });
      if (res.accessToken) {
        setStoredAuthToken(res.accessToken);
      }
      return res.user;
    } catch (apiErr) {
      console.warn('API exchangeSession failed, falling back to direct Supabase profile:', apiErr);
      const { data: authData } = await supabase.auth.getUser(accessToken);
      if (!authData?.user) {
        throw new Error('Unable to authenticate with Supabase');
      }

      const { data: dbUser, error: userErr } = await supabase
        .from('users')
        .select('id, email, full_name, role, org_id, organization:organizations(*)')
        .eq('id', authData.user.id)
        .single();

      if (userErr || !dbUser) {
        throw new Error(userErr?.message || 'Could not load user profile from database');
      }

      const org = dbUser.organization as any;
      return {
        id: dbUser.id,
        email: dbUser.email,
        fullName: dbUser.full_name,
        role: dbUser.role,
        orgId: dbUser.org_id,
        organization: {
          id: org.id,
          name: org.name,
          mode: org.mode || mode || 'roadways',
          country: org.country,
          state: org.state,
          district: org.district,
          address: org.address,
          latitude: org.latitude,
          longitude: org.longitude,
        },
      };
    }
  },

  /**
   * Fetch current authenticated user profile using cookie or active Supabase session.
   * Gracefully attempts token refresh if initial access token expired.
   */
  async getMe(): Promise<UserProfile | null> {
    try {
      const res = await apiFetch<{ user: UserProfile }>('/auth/me', {
        method: 'GET',
      });
      return res.user;
    } catch {
      // Attempt Supabase active session fallback
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user) {
          const { data: dbUser } = await supabase
            .from('users')
            .select('id, email, full_name, role, org_id, organization:organizations(*)')
            .eq('id', session.user.id)
            .maybeSingle();

          if (dbUser) {
            const org = dbUser.organization as any;
            return {
              id: dbUser.id,
              email: dbUser.email,
              fullName: dbUser.full_name,
              role: dbUser.role,
              orgId: dbUser.org_id,
              organization: {
                id: org.id,
                name: org.name,
                mode: org.mode || 'roadways',
                country: org.country,
                state: org.state,
                district: org.district,
                address: org.address,
                latitude: org.latitude,
                longitude: org.longitude,
              },
            };
          }
        }
      } catch (err) {
        console.warn('Direct Supabase session restore failed:', err);
      }

      // Attempt token refresh if initial getMe returned 401
      try {
        const refreshRes = await this.refreshSession();
        return refreshRes;
      } catch {
        return null;
      }
    }
    return null;
  },

  /**
   * Refresh session using refresh cookie
   */
  async refreshSession(): Promise<UserProfile> {
    const res = await apiFetch<{ user: UserProfile; accessToken?: string }>('/auth/refresh', {
      method: 'POST',
    });
    if (res.accessToken) {
      setStoredAuthToken(res.accessToken);
    }
    return res.user;
  },

  /**
   * Log out: clears cookies on backend and signs out from Supabase
   */
  async signOut(): Promise<void> {
    clearStoredAuthToken();
    try {
      await apiFetch('/auth/logout', { method: 'POST' });
    } catch {
      // Ignore backend cookie clear error if offline
    }
    try {
      await supabase.auth.signOut();
    } catch {
      // Ignore Supabase signout error
    }
  },
};
