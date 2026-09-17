import { create } from 'zustand';
import { OrgMode, RegisterRequest, UserProfile, UserRole } from '@nexus-ways/shared';
import { authService } from '../services/auth';

interface AuthState {
  user: UserProfile | null;
  orgId: string | null;
  role: UserRole | null;
  mode: OrgMode | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  error: string | null;

  // Actions
  initAuth: () => Promise<void>;
  login: (email: string, pass: string, mode?: OrgMode) => Promise<UserProfile>;
  loginWithGoogle: (mode?: OrgMode) => Promise<void>;
  handleOAuthCallback: (accessToken: string, refreshToken: string, mode?: OrgMode) => Promise<UserProfile>;
  register: (data: RegisterRequest) => Promise<UserProfile>;
  logout: () => Promise<void>;
  setUser: (user: UserProfile | null) => void;
  clearError: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  orgId: null,
  role: null,
  mode: null,
  isLoading: true,
  isAuthenticated: false,
  error: null,

  initAuth: async () => {
    set({ isLoading: true, error: null });
    try {
      const user = await authService.getMe();
      if (user) {
        set({
          user,
          orgId: user.orgId,
          role: user.role,
          mode: user.organization.mode,
          isAuthenticated: true,
          isLoading: false,
          error: null,
        });
      } else {
        set({
          user: null,
          orgId: null,
          role: null,
          mode: null,
          isAuthenticated: false,
          isLoading: false,
        });
      }
    } catch {
      set({
        user: null,
        orgId: null,
        role: null,
        mode: null,
        isAuthenticated: false,
        isLoading: false,
      });
    }
  },

  login: async (email, password, mode) => {
    set({ isLoading: true, error: null });
    try {
      const user = await authService.signInWithPassword(email, password, mode);
      set({
        user,
        orgId: user.orgId,
        role: user.role,
        mode: user.organization.mode,
        isAuthenticated: true,
        isLoading: false,
        error: null,
      });
      return user;
    } catch (err: any) {
      const msg = err.message || 'Login failed';
      set({ error: msg, isLoading: false });
      throw err;
    }
  },

  loginWithGoogle: async (mode) => {
    set({ isLoading: true, error: null });
    try {
      await authService.signInWithGoogle(mode);
    } catch (err: any) {
      set({ error: err.message || 'Google sign-in failed', isLoading: false });
      throw err;
    }
  },

  handleOAuthCallback: async (accessToken, refreshToken, mode) => {
    set({ isLoading: true, error: null });
    try {
      const user = await authService.exchangeSession(accessToken, refreshToken, mode);
      set({
        user,
        orgId: user.orgId,
        role: user.role,
        mode: user.organization.mode,
        isAuthenticated: true,
        isLoading: false,
        error: null,
      });
      return user;
    } catch (err: any) {
      set({ error: err.message || 'OAuth exchange failed', isLoading: false });
      throw err;
    }
  },

  register: async (data) => {
    set({ isLoading: true, error: null });
    try {
      const user = await authService.register(data);
      set({
        user,
        orgId: user.orgId,
        role: user.role,
        mode: user.organization.mode,
        isAuthenticated: true,
        isLoading: false,
        error: null,
      });
      return user;
    } catch (err: any) {
      const msg = err.message || 'Registration failed';
      set({ error: msg, isLoading: false });
      throw err;
    }
  },

  logout: async () => {
    set({ isLoading: true });
    try {
      await authService.signOut();
    } finally {
      set({
        user: null,
        orgId: null,
        role: null,
        mode: null,
        isAuthenticated: false,
        isLoading: false,
        error: null,
      });
    }
  },

  setUser: (user) => {
    set({
      user,
      orgId: user?.orgId || null,
      role: user?.role || null,
      mode: user?.organization.mode || null,
      isAuthenticated: !!user,
      isLoading: false,
    });
  },

  clearError: () => set({ error: null }),
}));
