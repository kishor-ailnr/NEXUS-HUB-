import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TripDetailsPanel } from '../TripDetailsPanel';
import { AdminPanelModal } from '../AdminPanelModal';
import { tripsService } from '../../services/trips';
import { driversApi } from '../../services/drivers';
import { adminService } from '../../services/admin';
import { Trip, TripEtaResponse, AdminReport } from '@nexus-ways/shared';

const { mockTrips, mockAdmin } = vi.hoisted(() => ({
  mockTrips: {
    getTripEta: vi.fn(),
    getTripReport: vi.fn(),
  },
  mockAdmin: {
    verifyPassword: vi.fn(),
    getUsers: vi.fn(),
    updateUser: vi.fn(),
    getReports: vi.fn(),
  },
}));

// Mock services
vi.mock('../../services/trips', () => ({
  tripsService: mockTrips,
  tripsApi: mockTrips,
}));

vi.mock('../../services/drivers', () => ({
  driversApi: {
    getBehaviorHistory: vi.fn().mockResolvedValue([]),
  },
}));

vi.mock('../../services/admin', () => ({
  adminService: mockAdmin,
  adminApi: mockAdmin,
}));

describe('Phase 6 PDF Reports Frontend Suite', () => {
  const mockCompletedTrip: Trip = {
    id: 'trip-pdf-completed-1',
    org_id: 'org-1',
    vehicle_id: 'veh-1',
    driver_id: 'drv-1',
    origin_lat: 19.076,
    origin_lng: 72.8777,
    destination_lat: 18.5204,
    destination_lng: 73.8567,
    origin_label: 'Mumbai Central Port',
    destination_label: 'Pune Chakan Hub',
    distance_km: 150,
    duration_minutes: 180,
    simulation_speed_multiplier: 1,
    status: 'completed',
    carbon_kg: 227.25,
    toll_estimate_inr: 825,
    created_at: '2026-09-07T10:00:00Z',
    completed_at: '2026-09-07T13:00:00Z',
  };

  const mockActiveTrip: Trip = {
    ...mockCompletedTrip,
    id: 'trip-pdf-active-2',
    status: 'in_transit',
    completed_at: undefined,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(tripsService.getTripEta).mockResolvedValue({
      trip_id: 'trip-pdf-completed-1',
      remaining_distance_km: 0,
      base_eta_minutes: 180,
      min_eta_minutes: 170,
      max_eta_minutes: 190,
      confidence_band_minutes: 10,
      confidence_basis: 'historical',
      sample_size: 5,
      calculated_at: '2026-09-07T13:00:00Z',
    } as TripEtaResponse);

    vi.mocked(driversApi.getBehaviorHistory).mockResolvedValue([]);
  });

  describe('TripDetailsPanel PDF Report Trigger', () => {
    it('shows View PDF Report button when trip status is completed and fetches signed URL on click', async () => {
      const windowOpenSpy = vi.spyOn(window, 'open').mockImplementation(() => null);
      vi.mocked(tripsService.getTripReport).mockResolvedValue({
        tripId: 'trip-pdf-completed-1',
        signedUrl: 'https://supabase.co/storage/v1/object/sign/trip-pdfs/org-1/trip-pdf-completed-1.pdf?token=valid',
        storagePath: 'org-1/trip-pdf-completed-1.pdf',
        fileSizeBytes: 24500,
        generatedAt: '2026-09-07T13:00:00Z',
      });

      render(<TripDetailsPanel trip={mockCompletedTrip} onClose={vi.fn()} />);

      // Ensure PDF Report button is rendered
      const pdfButton = screen.getByTestId('view-trip-report-btn');
      expect(pdfButton).toBeInTheDocument();
      expect(pdfButton).toHaveTextContent('View PDF Report');

      // Click button
      fireEvent.click(pdfButton);

      await waitFor(() => {
        expect(tripsService.getTripReport).toHaveBeenCalledWith('trip-pdf-completed-1');
      });

      expect(windowOpenSpy).toHaveBeenCalledWith(
        'https://supabase.co/storage/v1/object/sign/trip-pdfs/org-1/trip-pdf-completed-1.pdf?token=valid',
        '_blank',
        'noopener,noreferrer',
      );
      windowOpenSpy.mockRestore();
    });

    it('does NOT show View PDF Report button when trip is in_transit or pending', () => {
      render(<TripDetailsPanel trip={mockActiveTrip} onClose={vi.fn()} />);

      expect(screen.queryByTestId('view-trip-report-btn')).not.toBeInTheDocument();
    });
  });

  describe('AdminPanelModal Reports Tab Ledger', () => {
    it('loads and renders completed trip reports ledger with clickable PDF report links', async () => {
      const mockAdminReports: AdminReport[] = [
        {
          id: 'report-1',
          tripId: 'trip-pdf-completed-1',
          vehicleRegistration: 'MH-04-AX-5555',
          driverName: 'Rajesh Kumar',
          originLabel: 'Mumbai Central Port',
          destinationLabel: 'Pune Chakan Hub',
          storagePath: 'org-1/trip-pdf-completed-1.pdf',
          fileSizeBytes: 24500,
          completedAt: '2026-09-07T13:00:00Z',
        },
      ];

      vi.mocked(adminService.verifyPassword).mockResolvedValue({ status: 'ok', expiresInMinutes: 15 });
      vi.mocked(adminService.getUsers).mockResolvedValue([]);
      vi.mocked(adminService.getReports).mockResolvedValue(mockAdminReports);

      const windowOpenSpy = vi.spyOn(window, 'open').mockImplementation(() => null);
      vi.mocked(tripsService.getTripReport).mockResolvedValue({
        tripId: 'trip-pdf-completed-1',
        signedUrl: 'https://supabase.co/storage/v1/object/sign/trip-pdfs/org-1/trip-pdf-completed-1.pdf?token=valid',
        storagePath: 'org-1/trip-pdf-completed-1.pdf',
        fileSizeBytes: 24500,
        generatedAt: '2026-09-07T13:00:00Z',
      });

      render(<AdminPanelModal currentUserRole="manager" />);

      // 1. Click admin trigger button
      const triggerBtn = screen.getByTestId('admin-trigger-button');
      fireEvent.click(triggerBtn);

      // 2. Step-up password modal is displayed
      const passwordInput = screen.getByLabelText(/Your Password/i);
      expect(passwordInput).toBeInTheDocument();

      fireEvent.change(passwordInput, { target: { value: 'Manager123!' } });
      fireEvent.click(screen.getByRole('button', { name: /Unlock Admin Panel/i }));

      // 3. Admin panel opens with Reports Section
      await waitFor(() => {
        expect(screen.getByText('Organization Administration')).toBeInTheDocument();
        expect(screen.getByText('Completed Trip Reports')).toBeInTheDocument();
      });

      // 4. Assert report row details
      await waitFor(() => {
        expect(screen.getByText('MH-04-AX-5555')).toBeInTheDocument();
        expect(screen.getByText('Rajesh Kumar')).toBeInTheDocument();
        expect(screen.getByText('Mumbai Central Port → Pune Chakan Hub')).toBeInTheDocument();
      });

      // 5. Click "View PDF" action in table row
      const viewPdfLink = screen.getByTestId('view-report-btn-trip-pdf-completed-1');
      expect(viewPdfLink).toBeInTheDocument();
      fireEvent.click(viewPdfLink);

      await waitFor(() => {
        expect(tripsService.getTripReport).toHaveBeenCalledWith('trip-pdf-completed-1');
      });

      expect(windowOpenSpy).toHaveBeenCalledWith(
        'https://supabase.co/storage/v1/object/sign/trip-pdfs/org-1/trip-pdf-completed-1.pdf?token=valid',
        '_blank',
        'noopener,noreferrer',
      );
      windowOpenSpy.mockRestore();
    });
  });
});
