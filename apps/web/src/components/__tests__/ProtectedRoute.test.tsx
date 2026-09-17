import React from 'react';
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { ProtectedRoute } from '../ProtectedRoute';
import { useAuthStore } from '../../store/authStore';

describe('<ProtectedRoute />', () => {
  beforeEach(() => {
    useAuthStore.setState({
      user: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,
      mode: null,
    });
  });

  it('redirects to /:mode/login when unauthenticated', () => {
    render(
      <MemoryRouter initialEntries={['/roadways/dashboard']}>
        <Routes>
          <Route
            path="/:mode/dashboard"
            element={
              <ProtectedRoute>
                <div>Secret Dashboard Content</div>
              </ProtectedRoute>
            }
          />
          <Route path="/:mode/login" element={<div>Login Page Target</div>} />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.queryByText('Secret Dashboard Content')).not.toBeInTheDocument();
    expect(screen.getByText('Login Page Target')).toBeInTheDocument();
  });

  it('renders children when user is authenticated with matching mode', () => {
    useAuthStore.setState({
      user: {
        id: 'usr-1',
        email: 'test@example.com',
        fullName: 'Test User',
        role: 'manager',
        orgId: 'org-1',
        organization: {
          id: 'org-1',
          name: 'Test Org',
          mode: 'roadways',
          country: 'India',
          state: 'Maharashtra',
          district: 'Mumbai City',
          address: 'Test Address',
        },
      },
      isAuthenticated: true,
      isLoading: false,
      mode: 'roadways',
    });

    render(
      <MemoryRouter initialEntries={['/roadways/dashboard']}>
        <Routes>
          <Route
            path="/:mode/dashboard"
            element={
              <ProtectedRoute>
                <div>Secret Dashboard Content</div>
              </ProtectedRoute>
            }
          />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByText('Secret Dashboard Content')).toBeInTheDocument();
  });
});
