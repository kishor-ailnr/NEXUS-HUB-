import { OrgMode, RegisterRequest, UserProfile } from '@nexus-ways/shared';
import { supabase } from '../lib/supabase';
import { apiFetch } from '../lib/api';

export const authService = {
  /**
   * Register a new user and organization through NestJS API
   */
  async register(data: RegisterRequest): Promise<UserProfile> {
    const res = await apiFetch<{ user: UserProfile }>('/auth/register', {
      method: 'POST',
      data,
    });
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
    const res = await apiFetch<{ user: UserProfile }>('/auth/session', {
      method: 'POST',
      headers: mode ? { 'X-NW-Mode': mode } : undefined,
      data: {
        access_token,
        refresh_token,
        mode,
      },
    });

    return res.user;
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
    const res = await apiFetch<{ user: UserProfile }>('/auth/session', {
      method: 'POST',
      headers: mode ? { 'X-NW-Mode': mode } : undefined,
      data: {
        access_token: accessToken,
        refresh_token: refreshToken,
        mode,
      },
    });
    return res.user;
  },

  /**
   * Fetch current authenticated user profile using cookie.
   * Gracefully attempts token refresh if initial access token expired.
   */
  async getMe(): Promise<UserProfile | null> {
    try {
      const res = await apiFetch<{ user: UserProfile }>('/auth/me', {
        method: 'GET',
      });
      return res.user;
    } catch {
      // Attempt token refresh if initial getMe returned 401
      try {
        const refreshRes = await this.refreshSession();
        return refreshRes;
      } catch {
        return null;
      }
    }
  },

  /**
   * Refresh session using refresh cookie
   */
  async refreshSession(): Promise<UserProfile> {
    const res = await apiFetch<{ user: UserProfile }>('/auth/refresh', {
      method: 'POST',
    });
    return res.user;
  },

  /**
   * Log out: clears cookies on backend and signs out from Supabase
   */
  async signOut(): Promise<void> {
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
