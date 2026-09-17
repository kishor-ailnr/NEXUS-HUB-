import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MovementDetailsPanel } from '../MovementDetailsPanel';
import { CreateMovementModal } from '../CreateMovementModal';
import { railwaysService } from '../../services/railways';
import { TrainMovement } from '@nexus-ways/shared';

// Mock railwaysService
vi.mock('../../services/railways', () => ({
  railwaysService: {
    getEta: vi.fn(),
    getReportUrl: vi.fn(),
    checkSlot: vi.fn(),
    createMovement: vi.fn(),
    updateMovementStatus: vi.fn(),
  },
}));

describe('Phase 7A-2 Railways Intelligence Frontend Suite', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('MovementDetailsPanel Intelligence Metrics', () => {
    const mockMovement: TrainMovement = {
      id: 'mov-rail-101',
      org_id: 'org-rail-1',
      train_id: 'tr-1',
      loco_pilot_id: 'lp-1',
      origin_station_id: 'st-1',
      destination_station_id: 'st-2',
      status: 'in_transit',
      distance_km: 300,
      duration_minutes: 240,
      simulation_speed_multiplier: 60,
      created_at: new Date().toISOString(),
      train: {
        id: 'tr-1',
        org_id: 'org-rail-1',
        train_number: '12951',
        train_name: 'Freight Special',
        status: 'active',
        created_at: new Date().toISOString(),
        locomotive: {
          id: 'loco-1',
          org_id: 'org-rail-1',
          loco_number: 'WAG-9-31001',
          loco_type: 'WAG-9',
          fuel_type: 'electric',
          power_kw: 6000,
          status: 'active',
          created_at: new Date().toISOString(),
        },
      },
      loco_pilot: {
        id: 'lp-1',
        org_id: 'org-rail-1',
        user_id: 'u-1',
        license_number: 'LP-IND-999',
        status: 'on_duty',
        created_at: new Date().toISOString(),
        user: { id: 'u-1', full_name: 'Rajesh Sharma', email: 'rajesh@rail.com' },
      },
      origin_station: {
        id: 'st-1',
        org_id: 'org-rail-1',
        name: 'Mumbai CSMT',
        station_code: 'CSMT',
        lat: 18.9402,
        lng: 72.8357,
        station_type: 'junction',
        created_at: new Date().toISOString(),
      },
      destination_station: {
        id: 'st-2',
        org_id: 'org-rail-1',
        name: 'New Delhi',
        station_code: 'NDLS',
        lat: 28.6143,
        lng: 77.2104,
        station_type: 'station',
        created_at: new Date().toISOString(),
      },
      crew_score: {
        id: 'score-1',
        movement_id: 'mov-rail-101',
        loco_pilot_id: 'lp-1',
        score: 95,
        harsh_brake_count: 0,
        overspeed_event_count: 1,
        computed_at: new Date().toISOString(),
      },
      carbon_kg: 9450,
    };

    it('renders predictive ETA confidence badge and range for in_transit train movement', async () => {
      (railwaysService.getEta as any).mockResolvedValue({
        movement_id: 'mov-rail-101',
        remaining_distance_km: 180,
        base_eta_minutes: 144,
        min_eta_minutes: 130,
        max_eta_minutes: 158,
        confidence_band_minutes: 14,
        confidence_basis: 'historical',
        sample_size: 4,
        calculated_at: new Date().toISOString(),
      });

      render(
        <MovementDetailsPanel
          movement={mockMovement}
          onClose={vi.fn()}
          onRefresh={vi.fn()}
          userRole="manager"
        />,
      );

      await waitFor(() => {
        expect(screen.getByText(/Predictive ETA Confidence/i)).toBeDefined();
        expect(screen.getByText(/Historical \(N=4\)/i)).toBeDefined();
        expect(screen.getByText(/144 min/i)).toBeDefined();
        expect(screen.getByText(/Range: 130 – 158 min/i)).toBeDefined();
      });
    });

    it('renders Crew Behavior Score and Rail Carbon Intelligence with savings percentage', () => {
      render(
        <MovementDetailsPanel
          movement={mockMovement}
          onClose={vi.fn()}
          onRefresh={vi.fn()}
          userRole="manager"
        />,
      );

      // Crew score
      expect(screen.getByText(/Loco Pilot Crew Score/i)).toBeDefined();
      expect(screen.getByText(/95 \/ 100/i)).toBeDefined();
      expect(screen.getByText(/1 event\(s\)/i)).toBeDefined();

      // Rail carbon
      expect(screen.getByText(/Rail Carbon Intelligence/i)).toBeDefined();
      expect(screen.getByText(/9450 kg CO₂e/i)).toBeDefined();
      expect(screen.getByText(/79% cleaner vs road/i)).toBeDefined();
    });

    it('renders "View Rail Audit PDF" button when movement is completed and opens signed URL', async () => {
      const completedMovement: TrainMovement = {
        ...mockMovement,
        status: 'completed',
      };

      (railwaysService.getReportUrl as any).mockResolvedValue({
        movementId: 'mov-rail-101',
        signedUrl: 'https://storage.supabase.co/railways/report.pdf',
        storagePath: 'railways/report.pdf',
        fileSizeBytes: 8500,
        generatedAt: new Date().toISOString(),
      });

      const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null);

      render(
        <MovementDetailsPanel
          movement={completedMovement}
          onClose={vi.fn()}
          onRefresh={vi.fn()}
          userRole="manager"
        />,
      );

      const pdfButton = screen.getByText(/View Rail Audit PDF/i);
      expect(pdfButton).toBeDefined();

      fireEvent.click(pdfButton);

      await waitFor(() => {
        expect(railwaysService.getReportUrl).toHaveBeenCalledWith('mov-rail-101');
        expect(openSpy).toHaveBeenCalledWith('https://storage.supabase.co/railways/report.pdf', '_blank');
      });
    });
  });

  describe('CreateMovementModal Slot Intelligence', () => {
    const mockStations = [
      { id: 'st-1', org_id: 'org-1', name: 'Mumbai CSMT', station_type: 'junction' as const, lat: 18.9, lng: 72.8, created_at: '' },
      { id: 'st-2', org_id: 'org-1', name: 'Pune Junction', station_type: 'junction' as const, lat: 18.5, lng: 73.8, created_at: '' },
    ];
    const mockTrains = [
      { id: 'tr-1', org_id: 'org-1', train_number: '12951', status: 'idle' as const, created_at: '' },
    ];
    const mockPilots = [
      { id: 'lp-1', org_id: 'org-1', user_id: 'u-1', license_number: 'LP-1', status: 'available' as const, created_at: '', user: { id: 'u-1', full_name: 'Rajesh', email: 'r@r.com' } },
    ];

    it('displays Slot Intelligence congestion warning and suggested alternative slot when line occupancy is high', async () => {
      (railwaysService.checkSlot as any).mockResolvedValue({
        originStationId: 'st-1',
        destinationStationId: 'st-2',
        proposedDeparture: new Date().toISOString(),
        congested: true,
        overlapCount: 2,
        threshold: 1,
        reason: 'High line occupancy: 2 active or planned train movement(s) detected within ±2h window.',
        suggestedDeparture: new Date(Date.now() + 3 * 3600000).toISOString(),
      });

      render(
        <CreateMovementModal
          isOpen={true}
          onClose={vi.fn()}
          stations={mockStations}
          trains={mockTrains}
          locoPilots={mockPilots}
          savedRoutes={[]}
          onMovementCreated={vi.fn()}
        />,
      );

      await waitFor(() => {
        expect(screen.getByText(/Slot Intelligence: Congestion Warning/i)).toBeDefined();
        expect(screen.getByText(/2 movement\(s\) active/i)).toBeDefined();
        expect(screen.getByText(/Apply Suggested Slot/i)).toBeDefined();
      });
    });
  });
});
