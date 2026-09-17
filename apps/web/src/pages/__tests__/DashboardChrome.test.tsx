import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { Dashboard } from '../Dashboard';
import { useAuthStore } from '../../store/authStore';
import { dashboardService } from '../../services/dashboard';
import { notificationsService } from '../../services/notifications';
import { adminService } from '../../services/admin';
import { socketService } from '../../services/socket';

describe('Phase 3 Shared Dashboard Chrome', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Mock socket service
    vi.spyOn(socketService, 'connect').mockImplementation((onNotif, onStatus) => {
      if (onStatus) onStatus(true);
      return {} as any;
    });
    vi.spyOn(socketService, 'disconnect').mockImplementation(() => {});
    vi.spyOn(socketService, 'isConnected').mockReturnValue(true);

    // Mock dashboard service
    vi.spyOn(dashboardService, 'getStats').mockResolvedValue({
      activeAlerts: 3,
      activeVehicles: { value: 0, available: false, note: 'Phase 4' },
      totalFleetToday: { value: 0, available: false, note: 'Phase 4' },
      avgSpeedKmh: { value: 0, available: false, note: 'Phase 4' },
      arrivedCount: { value: 0, available: false, note: 'Phase 4' },
      departedCount: { value: 0, available: false, note: 'Phase 4' },
    });

    vi.spyOn(dashboardService, 'getSystemStatus').mockResolvedValue({
      dbHealthy: true,
      wsGatewayHealthy: true,
      agentsHealthy: true,
      connectionCount: 1,
    });

    vi.spyOn(dashboardService, 'measureClientLatency').mockResolvedValue({
      latencyMs: 32,
      quality: 'Good',
    });

    // Mock notifications service
    vi.spyOn(notificationsService, 'getNotifications').mockResolvedValue([
      {
        id: 'notif-1',
        orgId: 'org-test-1',
        type: 'alert',
        title: 'Brake Inspection Notice',
        body: 'Fleet unit 104 pending review',
        actionLabel: 'View Checklist',
        actionUrl: '/roadways/checklist',
        readAt: null,
        createdAt: new Date().toISOString(),
      },
    ]);

    vi.spyOn(notificationsService, 'getUnreadCount').mockResolvedValue(1);
    vi.spyOn(notificationsService, 'markAsRead').mockResolvedValue({
      id: 'notif-1',
      orgId: 'org-test-1',
      type: 'alert',
      title: 'Brake Inspection Notice',
      body: 'Fleet unit 104 pending review',
      readAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
    });

    // Mock admin service
    vi.spyOn(adminService, 'verifyPassword').mockImplementation(async (password: string) => {
      if (password === 'Password123!') {
        return { status: 'verified', expiresInMinutes: 15 };
      }
      throw new Error('Incorrect password verification');
    });

    vi.spyOn(adminService, 'getUsers').mockResolvedValue([
      {
        id: 'user-admin-1',
        email: 'manager@roadways.com',
        fullName: 'Fleet Director',
        role: 'manager',
        createdAt: new Date().toISOString(),
      },
    ]);

    vi.spyOn(adminService, 'getReports').mockResolvedValue([]);

    // Default authenticated store state
    useAuthStore.setState({
      user: {
        id: 'user-test-1',
        email: 'manager@roadways.com',
        fullName: 'Fleet Director',
        role: 'manager',
        orgId: 'org-test-1',
        organization: {
          id: 'org-test-1',
          name: 'Apex Road Logistics',
          mode: 'roadways',
          country: 'India',
          state: 'Maharashtra',
          district: 'Mumbai City',
          address: '101 Nariman Point',
          latitude: 18.92,
          longitude: 72.82,
        },
      },
      isAuthenticated: true,
      isLoading: false,
      mode: 'roadways',
    });
  });

  // 1. Dashboard renders the six stat cards
  it('renders the six stat cards with real alert count and vehicle-dependent fields showing available: false state', async () => {
    render(
      <MemoryRouter initialEntries={['/roadways/dashboard']}>
        <Routes>
          <Route path="/:mode/dashboard" element={<Dashboard />} />
        </Routes>
      </MemoryRouter>
    );

    // Check header and title
    expect(screen.getByText('Roadways')).toBeInTheDocument();
    expect(screen.getByText('Apex Road Logistics')).toBeInTheDocument();

    // Check stats row
    await waitFor(() => {
      // Active alerts has real count 3
      expect(screen.getByTestId('stat-card-active-alerts')).toHaveTextContent('3');
      // Vehicle dependent stats show "—"
      expect(screen.getByTestId('stat-card-active-vehicles')).toHaveTextContent('—');
      expect(screen.getByTestId('stat-card-total-fleet')).toHaveTextContent('—');
      expect(screen.getByTestId('stat-card-avg-speed')).toHaveTextContent('—');
    });
  });

  // 2. Notification bell badge reflects real unread count, and clicking marks as read
  it('displays real unread notification count badge and decrements count upon marking as read', async () => {
    render(
      <MemoryRouter initialEntries={['/roadways/dashboard']}>
        <Routes>
          <Route path="/:mode/dashboard" element={<Dashboard />} />
        </Routes>
      </MemoryRouter>
    );

    // Wait for badge with count 1 to appear
    await waitFor(() => {
      expect(screen.getByTestId('unread-badge')).toHaveTextContent('1');
    });

    // Open notifications drawer
    const bellBtn = screen.getByLabelText('Open notifications');
    fireEvent.click(bellBtn);

    // Verify notification content
    expect(screen.getByText('Brake Inspection Notice')).toBeInTheDocument();
    expect(screen.getByText('Fleet unit 104 pending review')).toBeInTheDocument();

    // Click "Mark read"
    const markReadBtn = screen.getByRole('button', { name: /mark read/i });
    fireEvent.click(markReadBtn);

    // Check unread badge decrements to 0 (badge disappears)
    await waitFor(() => {
      expect(screen.queryByTestId('unread-badge')).not.toBeInTheDocument();
    });
  });

  // 3. Admin icon requires correct password step-up before opening panel; wrong password displays error
  it('requires password step-up verification before opening admin panel, rejecting incorrect password', async () => {
    render(
      <MemoryRouter initialEntries={['/roadways/dashboard']}>
        <Routes>
          <Route path="/:mode/dashboard" element={<Dashboard />} />
        </Routes>
      </MemoryRouter>
    );

    // Click Admin Panel trigger
    const adminBtn = screen.getByTestId('admin-trigger-button');
    fireEvent.click(adminBtn);

    // Verify step-up modal appears
    expect(screen.getByText('Step-Up Authentication')).toBeInTheDocument();

    // Enter incorrect password
    const passwordInput = screen.getByLabelText(/your password/i);
    fireEvent.change(passwordInput, { target: { value: 'WrongPassword!' } });
    fireEvent.click(screen.getByRole('button', { name: /unlock admin panel/i }));

    // Verify error shown and panel not opened
    await waitFor(() => {
      expect(screen.getByTestId('verify-error')).toHaveTextContent(/incorrect password/i);
      expect(screen.queryByText('Organization Administration')).not.toBeInTheDocument();
    });

    // Enter correct password
    fireEvent.change(passwordInput, { target: { value: 'Password123!' } });
    fireEvent.click(screen.getByRole('button', { name: /unlock admin panel/i }));

    // Verify Admin panel unlocks with user directory and reports empty state
    await waitFor(() => {
      expect(screen.getByText('Organization Administration')).toBeInTheDocument();
      expect(screen.getByText('User Directory & Roles')).toBeInTheDocument();
      expect(screen.getByTestId('reports-empty-state')).toHaveTextContent(
        /No completed trip(s| reports) yet/i
      );
    });
  });

  // 4. Mini-map renders location-not-yet-available when coordinates are null, and real map when coordinates exist
  it('renders location placeholder when coordinates are null, and mini-map when present', () => {
    // 4a. With coordinates present
    const { unmount } = render(
      <MemoryRouter initialEntries={['/roadways/dashboard']}>
        <Routes>
          <Route path="/:mode/dashboard" element={<Dashboard />} />
        </Routes>
      </MemoryRouter>
    );
    expect(screen.getByTestId('mini-map')).toBeInTheDocument();
    unmount();

    // 4b. With coordinates null
    useAuthStore.setState({
      user: {
        id: 'user-null-coords',
        email: 'manager@nullcoords.com',
        fullName: 'Null Coords Mgr',
        role: 'manager',
        orgId: 'org-null',
        organization: {
          id: 'org-null',
          name: 'Ungeocoded Org',
          mode: 'roadways',
          country: 'India',
          state: 'Delhi',
          district: 'New Delhi',
          address: 'Unknown Street',
          latitude: null,
          longitude: null,
        },
      },
    });

    render(
      <MemoryRouter initialEntries={['/roadways/dashboard']}>
        <Routes>
          <Route path="/:mode/dashboard" element={<Dashboard />} />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByTestId('location-placeholder')).toHaveTextContent('Location not yet available');
  });

  // 5. Hub button logs out and navigates to /
  it('logs out and returns to Hub when clicking Hub button', async () => {
    const logoutSpy = vi.spyOn(useAuthStore.getState(), 'logout');

    render(
      <MemoryRouter initialEntries={['/roadways/dashboard']}>
        <Routes>
          <Route path="/:mode/dashboard" element={<Dashboard />} />
          <Route path="/" element={<div>Hub Landing Screen</div>} />
        </Routes>
      </MemoryRouter>
    );

    const hubBtn = screen.getByTestId('hub-button');
    fireEvent.click(hubBtn);

    await waitFor(() => {
      expect(logoutSpy).toHaveBeenCalled();
      expect(screen.getByText('Hub Landing Screen')).toBeInTheDocument();
    });
  });
});
