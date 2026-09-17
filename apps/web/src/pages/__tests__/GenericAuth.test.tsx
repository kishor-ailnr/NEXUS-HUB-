import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { Register } from '../Register';
import { Login } from '../Login';
import { Dashboard } from '../Dashboard';
import { ProtectedRoute } from '../../components/ProtectedRoute';
import { useAuthStore } from '../../store/authStore';
import { authService } from '../../services/auth';

describe('Generic Mode-Aware Auth & Isolation', () => {
  beforeEach(() => {
    useAuthStore.setState({
      user: null,
      orgId: null,
      role: null,
      mode: null,
      isLoading: false,
      isAuthenticated: false,
      error: null,
    });
    vi.clearAllMocks();
  });

  // 1. Visiting /railways/register, completing form, landing on /railways/dashboard with mode: 'railways'
  it('registers through /railways/register and passes mode railways to registration service', async () => {
    const mockUser = {
      id: 'rail-user-1',
      email: 'chief@railways.com',
      fullName: 'Vikram Rail',
      role: 'manager' as const,
      orgId: 'rail-org-1',
      organization: {
        id: 'rail-org-1',
        name: 'Indian Freight Corridors Ltd',
        mode: 'railways' as const,
        country: 'India',
        state: 'Delhi',
        district: 'New Delhi',
        address: 'Rail Bhavan',
      },
    };

    const registerSpy = vi.spyOn(authService, 'register').mockResolvedValue(mockUser);

    render(
      <MemoryRouter initialEntries={['/railways/register']}>
        <Routes>
          <Route path="/:mode/register" element={<Register />} />
          <Route
            path="/:mode/dashboard"
            element={
              <ProtectedRoute>
                <Dashboard />
              </ProtectedRoute>
            }
          />
        </Routes>
      </MemoryRouter>
    );

    // Verify Railways title & badge
    expect(screen.getByText('Railways Onboarding')).toBeInTheDocument();
    expect(screen.getByText('Register Railways Organization')).toBeInTheDocument();

    // Fill in registration form
    fireEvent.change(screen.getByLabelText(/full name/i), { target: { value: 'Vikram Rail' } });
    fireEvent.change(screen.getByLabelText(/work email/i), { target: { value: 'chief@railways.com' } });
    fireEvent.change(screen.getByLabelText(/password/i), { target: { value: 'Password123!' } });
    fireEvent.change(screen.getByLabelText(/organization \/ fleet name/i), { target: { value: 'Indian Freight Corridors Ltd' } });
    fireEvent.change(screen.getByLabelText(/state \/ ut/i), { target: { value: 'Delhi' } });
    fireEvent.change(screen.getByLabelText(/district/i), { target: { value: 'New Delhi' } });
    fireEvent.change(screen.getByLabelText(/registered address/i), { target: { value: 'Rail Bhavan' } });

    // Submit form
    const submitBtn = screen.getByRole('button', { name: /create railways organization/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(registerSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          fullName: 'Vikram Rail',
          email: 'chief@railways.com',
          mode: 'railways',
          orgName: 'Indian Freight Corridors Ltd',
          state: 'Delhi',
          district: 'New Delhi',
        })
      );
    });

    // Check landing on dashboard
    await waitFor(() => {
      expect(screen.getAllByText('Railways')[0]).toBeInTheDocument();
      expect(screen.getByText('Indian Freight Corridors Ltd')).toBeInTheDocument();
      expect(screen.getByText('Vikram Rail')).toBeInTheDocument();
    });
  });

  // 1b. Visiting /airways/register, completing form, landing on /airways/dashboard with mode: 'airways'
  it('registers through /airways/register and passes mode airways to registration service', async () => {
    const mockUser = {
      id: 'air-user-1',
      email: 'pilot@airways.com',
      fullName: 'Captain Sky',
      role: 'manager' as const,
      orgId: 'air-org-1',
      organization: {
        id: 'air-org-1',
        name: 'Sky Freight India Ltd',
        mode: 'airways' as const,
        country: 'India',
        state: 'Delhi',
        district: 'New Delhi',
        address: 'IGI Cargo Complex',
      },
    };

    const registerSpy = vi.spyOn(authService, 'register').mockResolvedValue(mockUser);

    render(
      <MemoryRouter initialEntries={['/airways/register']}>
        <Routes>
          <Route path="/:mode/register" element={<Register />} />
          <Route
            path="/:mode/dashboard"
            element={
              <ProtectedRoute>
                <Dashboard />
              </ProtectedRoute>
            }
          />
        </Routes>
      </MemoryRouter>
    );

    // Verify Airways title & badge
    expect(screen.getByText('Airways Onboarding')).toBeInTheDocument();
    expect(screen.getByText('Register Airways Organization')).toBeInTheDocument();

    // Fill in registration form
    fireEvent.change(screen.getByLabelText(/full name/i), { target: { value: 'Captain Sky' } });
    fireEvent.change(screen.getByLabelText(/work email/i), { target: { value: 'pilot@airways.com' } });
    fireEvent.change(screen.getByLabelText(/password/i), { target: { value: 'Password123!' } });
    fireEvent.change(screen.getByLabelText(/organization \/ fleet name/i), { target: { value: 'Sky Freight India Ltd' } });
    fireEvent.change(screen.getByLabelText(/state \/ ut/i), { target: { value: 'Delhi' } });
    fireEvent.change(screen.getByLabelText(/district/i), { target: { value: 'New Delhi' } });
    fireEvent.change(screen.getByLabelText(/registered address/i), { target: { value: 'IGI Cargo Complex' } });

    // Submit form
    const submitBtn = screen.getByRole('button', { name: /create airways organization/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(registerSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          fullName: 'Captain Sky',
          email: 'pilot@airways.com',
          mode: 'airways',
          orgName: 'Sky Freight India Ltd',
          state: 'Delhi',
          district: 'New Delhi',
        })
      );
    });

    // Check landing on dashboard
    await waitFor(() => {
      expect(screen.getAllByText('Airways')[0]).toBeInTheDocument();
      expect(screen.getByText('Sky Freight India Ltd')).toBeInTheDocument();
      expect(screen.getByText('Captain Sky')).toBeInTheDocument();
    });
  });

  // 1c. Visiting /seaways/register, completing form, landing on /seaways/dashboard with mode: 'seaways'
  it('registers through /seaways/register and passes mode seaways to registration service', async () => {
    const mockUser = {
      id: 'sea-user-1',
      email: 'captain@seaways.com',
      fullName: 'Admiral Ocean',
      role: 'manager' as const,
      orgId: 'sea-org-1',
      organization: {
        id: 'sea-org-1',
        name: 'Oceanic Ports & Cargo',
        mode: 'seaways' as const,
        country: 'India',
        state: 'Maharashtra',
        district: 'Mumbai City',
        address: 'JNPT Port Boulevard',
      },
    };

    const registerSpy = vi.spyOn(authService, 'register').mockResolvedValue(mockUser);

    render(
      <MemoryRouter initialEntries={['/seaways/register']}>
        <Routes>
          <Route path="/:mode/register" element={<Register />} />
          <Route
            path="/:mode/dashboard"
            element={
              <ProtectedRoute>
                <Dashboard />
              </ProtectedRoute>
            }
          />
        </Routes>
      </MemoryRouter>
    );

    // Verify Seaways title & badge
    expect(screen.getByText('Seaways Onboarding')).toBeInTheDocument();
    expect(screen.getByText('Register Seaways Organization')).toBeInTheDocument();

    // Fill in registration form
    fireEvent.change(screen.getByLabelText(/full name/i), { target: { value: 'Admiral Ocean' } });
    fireEvent.change(screen.getByLabelText(/work email/i), { target: { value: 'captain@seaways.com' } });
    fireEvent.change(screen.getByLabelText(/password/i), { target: { value: 'Password123!' } });
    fireEvent.change(screen.getByLabelText(/organization \/ fleet name/i), { target: { value: 'Oceanic Ports & Cargo' } });
    fireEvent.change(screen.getByLabelText(/state \/ ut/i), { target: { value: 'Maharashtra' } });
    fireEvent.change(screen.getByLabelText(/district/i), { target: { value: 'Mumbai City' } });
    fireEvent.change(screen.getByLabelText(/registered address/i), { target: { value: 'JNPT Port Boulevard' } });

    // Submit form
    const submitBtn = screen.getByRole('button', { name: /create seaways organization/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(registerSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          fullName: 'Admiral Ocean',
          email: 'captain@seaways.com',
          mode: 'seaways',
          orgName: 'Oceanic Ports & Cargo',
          state: 'Maharashtra',
          district: 'Mumbai City',
        })
      );
    });

    // Check landing on dashboard
    await waitFor(() => {
      expect(screen.getAllByText('Seaways')[0]).toBeInTheDocument();
      expect(screen.getByText('Oceanic Ports & Cargo')).toBeInTheDocument();
      expect(screen.getByText('Admiral Ocean')).toBeInTheDocument();
    });
  });

  // 2. An authenticated 'railways'-mode user visiting /roadways/dashboard, /airways/dashboard, /seaways/dashboard directly -> redirected to login
  it('redirects an authenticated railways user to /:mode/login when attempting to access cross-mode dashboards', () => {
    // Set active session for Railways user
    useAuthStore.setState({
      user: {
        id: 'rail-user-1',
        email: 'chief@railways.com',
        fullName: 'Vikram Rail',
        role: 'manager',
        orgId: 'rail-org-1',
        organization: {
          id: 'rail-org-1',
          name: 'Rail Freight Org',
          mode: 'railways',
          country: 'India',
          state: 'Delhi',
          district: 'New Delhi',
          address: 'Rail Office',
        },
      },
      isAuthenticated: true,
      isLoading: false,
      mode: 'railways',
    });

    // Test access to roadways
    const { unmount: unmount1 } = render(
      <MemoryRouter initialEntries={['/roadways/dashboard']}>
        <Routes>
          <Route
            path="/:mode/dashboard"
            element={
              <ProtectedRoute>
                <div>Roadways Secret Content</div>
              </ProtectedRoute>
            }
          />
          <Route path="/:mode/login" element={<Login />} />
        </Routes>
      </MemoryRouter>
    );
    expect(screen.queryByText('Roadways Secret Content')).not.toBeInTheDocument();
    expect(screen.getByText('Roadways Division')).toBeInTheDocument();
    unmount1();

    // Test access to airways
    const { unmount: unmount2 } = render(
      <MemoryRouter initialEntries={['/airways/dashboard']}>
        <Routes>
          <Route
            path="/:mode/dashboard"
            element={
              <ProtectedRoute>
                <div>Airways Secret Content</div>
              </ProtectedRoute>
            }
          />
          <Route path="/:mode/login" element={<Login />} />
        </Routes>
      </MemoryRouter>
    );
    expect(screen.queryByText('Airways Secret Content')).not.toBeInTheDocument();
    expect(screen.getByText('Airways Division')).toBeInTheDocument();
    unmount2();

    // Test access to seaways
    const { unmount: unmount3 } = render(
      <MemoryRouter initialEntries={['/seaways/dashboard']}>
        <Routes>
          <Route
            path="/:mode/dashboard"
            element={
              <ProtectedRoute>
                <div>Seaways Secret Content</div>
              </ProtectedRoute>
            }
          />
          <Route path="/:mode/login" element={<Login />} />
        </Routes>
      </MemoryRouter>
    );
    expect(screen.queryByText('Seaways Secret Content')).not.toBeInTheDocument();
    expect(screen.getByText('Seaways Division')).toBeInTheDocument();
    unmount3();
  });

  // 3. Visiting /subways/login -> 404 page renders
  it('renders 404 NotFound page when visiting an unrecognized mode route like /subways/login', () => {
    render(
      <MemoryRouter initialEntries={['/subways/login']}>
        <Routes>
          <Route path="/:mode/login" element={<Login />} />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByText('404 Error')).toBeInTheDocument();
    expect(screen.getByText('Route Not Found')).toBeInTheDocument();
    expect(screen.getByText(/valid modes are/i)).toBeInTheDocument();
  });
});
