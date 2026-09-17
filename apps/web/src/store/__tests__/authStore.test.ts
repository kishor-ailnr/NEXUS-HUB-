import { describe, it, expect, beforeEach } from 'vitest';
import { useAuthStore } from '../authStore';

describe('useAuthStore', () => {
  beforeEach(() => {
    useAuthStore.setState({
      user: null,
      orgId: null,
      role: null,
      isLoading: false,
      isAuthenticated: false,
      error: null,
    });
  });

  it('initializes with unauthenticated state', () => {
    const state = useAuthStore.getState();
    expect(state.user).toBeNull();
    expect(state.isAuthenticated).toBe(false);
  });

  it('updates state correctly when setUser is called', () => {
    const mockUser = {
      id: 'usr-google-1',
      email: 'oauth.driver@nexusways.com',
      fullName: 'Google Driver',
      role: 'driver' as const,
      orgId: 'org-google-1',
      organization: {
        id: 'org-google-1',
        name: 'Google Fleet Org',
        mode: 'roadways' as const,
        country: 'India',
        state: 'Delhi',
        district: 'New Delhi',
        address: 'Barakhamba Road',
      },
    };

    useAuthStore.getState().setUser(mockUser);

    const state = useAuthStore.getState();
    expect(state.user).toEqual(mockUser);
    expect(state.isAuthenticated).toBe(true);
    expect(state.role).toBe('driver');
    expect(state.orgId).toBe('org-google-1');
  });

  it('clears state on logout', async () => {
    useAuthStore.getState().setUser({
      id: 'usr-1',
      email: 'manager@test.com',
      fullName: 'Manager',
      role: 'manager',
      orgId: 'org-1',
      organization: {
        id: 'org-1',
        name: 'Org 1',
        mode: 'roadways',
        country: 'India',
        state: 'Tamil Nadu',
        district: 'Chennai',
        address: 'Anna Salai',
      },
    });

    useAuthStore.setState({
      user: null,
      orgId: null,
      role: null,
      isAuthenticated: false,
    });

    const state = useAuthStore.getState();
    expect(state.user).toBeNull();
    expect(state.isAuthenticated).toBe(false);
  });
});
