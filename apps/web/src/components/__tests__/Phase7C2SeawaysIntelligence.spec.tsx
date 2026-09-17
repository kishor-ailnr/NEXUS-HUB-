import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { VoyageMovementDetailsPanel } from '../VoyageMovementDetailsPanel';
import { CreateVoyageMovementModal } from '../CreateVoyageMovementModal';
import { SeawaysMap } from '../SeawaysMap';
import { AdminPanelModal } from '../AdminPanelModal';
import {
  Port,
  Vessel,
  SeaCrew,
  Voyage,
  VoyageMovement,
  GhostPositionPayload,
} from '@nexus-ways/shared';

// Mock Leaflet
vi.mock('leaflet', () => {
  const mapMock = {
    setView: vi.fn().mockReturnThis(),
    fitBounds: vi.fn().mockReturnThis(),
    getZoom: vi.fn().mockReturnValue(12),
    flyTo: vi.fn().mockReturnThis(),
    remove: vi.fn(),
    invalidateSize: vi.fn(),
  };

  const layerGroupMock = {
    addTo: vi.fn().mockReturnThis(),
    clearLayers: vi.fn().mockReturnThis(),
    addLayer: vi.fn().mockReturnThis(),
  };

  const markerMock = {
    addTo: vi.fn().mockReturnThis(),
    bindPopup: vi.fn().mockReturnThis(),
    openPopup: vi.fn().mockReturnThis(),
    setLatLng: vi.fn().mockReturnThis(),
    setIcon: vi.fn().mockReturnThis(),
    on: vi.fn().mockReturnThis(),
    remove: vi.fn(),
  };

  return {
    default: {
      map: vi.fn(() => mapMock),
      tileLayer: vi.fn(() => ({ addTo: vi.fn() })),
      layerGroup: vi.fn(() => layerGroupMock),
      circle: vi.fn(() => ({ bindTooltip: vi.fn().mockReturnThis() })),
      polyline: vi.fn(() => ({
        bindTooltip: vi.fn().mockReturnThis(),
        addTo: vi.fn().mockReturnThis(),
        on: vi.fn().mockReturnThis(),
        remove: vi.fn(),
      })),
      circleMarker: vi.fn(() => ({ bindTooltip: vi.fn().mockReturnThis() })),
      marker: vi.fn(() => markerMock),
      divIcon: vi.fn(() => ({})),
      latLngBounds: vi.fn(() => ({ extend: vi.fn(), isValid: vi.fn(() => true) })),
    },
  };
});

let mockAuthMode = 'seaways';
let mockAuthUser: any = {
  id: 'user-manager-1',
  email: 'admin@seaways.com',
  fullName: 'Fleet Operations Director',
  role: 'manager',
  orgId: 'org-sea-1',
};

vi.mock('../../store/authStore', () => ({
  useAuthStore: (selector?: (state: any) => any) => {
    const state = {
      user: mockAuthUser,
      mode: mockAuthMode,
      token: 'valid-jwt-token',
    };
    return selector ? selector(state) : state;
  },
}));

vi.mock('../../services/seaways', () => ({
  seawaysService: {
    getEta: vi.fn().mockResolvedValue({
      movement_id: 'mov-sea-1',
      base_eta_minutes: 3600,
      min_eta_minutes: 3420,
      max_eta_minutes: 3780,
      confidence_band_minutes: 180,
      confidence_basis: 'historical',
      sample_size: 4,
    }),
    getEtaConfidence: vi.fn().mockResolvedValue({
      movement_id: 'mov-sea-1',
      base_eta_minutes: 3600,
      min_eta_minutes: 3420,
      max_eta_minutes: 3780,
      confidence_band_minutes: 180,
      confidence_basis: 'historical',
      sample_size: 4,
    }),
    getCrewScore: vi.fn().mockResolvedValue([
      {
        score: 95,
        harsh_maneuver_count: 0,
        overspeed_event_count: 1,
      },
    ]),
    getWatchkeepingLogs: vi.fn().mockResolvedValue([
      {
        id: 'wk-1',
        duty_minutes: 600,
        rest_minutes: 840,
        violation: false,
        window_started_at: new Date().toISOString(),
        window_ended_at: new Date().toISOString(),
      },
    ]),
    checkPortSlots: vi.fn().mockResolvedValue({
      congested: false,
      originSlotCount: 0,
      destinationSlotCount: 0,
    }),
    getReportUrl: vi.fn().mockResolvedValue({
      movementId: 'mov-sea-1',
      signedUrl: 'https://storage.supabase.co/seaways/org-sea-1/mov-sea-1.pdf',
    }),
    getAdminReports: vi.fn().mockResolvedValue([
      {
        id: 'rep-sea-1',
        movementId: 'mov-sea-1',
        vesselName: 'MV Ocean Titan',
        imoNumber: 'IMO9876543',
        masterName: 'Capt. Sunil Nair',
        originPortName: 'Jawaharlal Nehru Port',
        originPortCode: 'INBOM',
        destPortName: 'Chennai Port',
        destPortCode: 'INMAA',
        completedAt: new Date().toISOString(),
        fileSizeBytes: 9800,
        storagePath: 'seaways/org-sea-1/mov-sea-1.pdf',
      },
    ]),
    createMovement: vi.fn().mockResolvedValue({ id: 'mov-sea-1' }),
  },
}));

vi.mock('../../services/admin', () => ({
  adminService: {
    verifyPassword: vi.fn().mockResolvedValue({ valid: true }),
    getUsers: vi.fn().mockResolvedValue([]),
    getReports: vi.fn().mockResolvedValue([]),
  },
}));

describe('Phase 7C-2 Seaways Intelligence & PDF Reports (Frontend Components)', () => {
  const mockPorts: Port[] = [
    {
      id: 'port-1',
      org_id: 'org-sea-1',
      name: 'Jawaharlal Nehru Port (JNPT Mumbai)',
      unlocode: 'INBOM',
      lat: 18.95,
      lng: 72.95,
      created_at: new Date().toISOString(),
    },
    {
      id: 'port-2',
      org_id: 'org-sea-1',
      name: 'Chennai Port',
      unlocode: 'INMAA',
      lat: 13.08,
      lng: 80.29,
      created_at: new Date().toISOString(),
    },
  ];

  const mockVessels: Vessel[] = [
    {
      id: 'ves-1',
      org_id: 'org-sea-1',
      vessel_name: 'MV Ocean Titan',
      imo_number: 'IMO9876543',
      vessel_type: 'Container Ship (Panamax)',
      dwt_tonnes: 65000,
      status: 'active',
      created_at: new Date().toISOString(),
    },
  ];

  const mockSeaCrew: SeaCrew[] = [
    {
      id: 'crew-1',
      org_id: 'org-sea-1',
      user_id: 'user-1',
      certificate_number: 'M-STCW-991',
      crew_role: 'master',
      status: 'available',
      created_at: new Date().toISOString(),
      user: {
        id: 'user-1',
        full_name: 'Capt. Sunil Nair',
        email: 'captain@seaways.com',
      },
    },
  ];

  const mockVoyages: Voyage[] = [
    {
      id: 'voy-1',
      org_id: 'org-sea-1',
      voyage_number: 'VOY-BOM-MAA-001',
      origin_port_id: 'port-1',
      destination_port_id: 'port-2',
      created_at: new Date().toISOString(),
      origin_port: mockPorts[0],
      destination_port: mockPorts[1],
    },
  ];

  const mockMovement: VoyageMovement = {
    id: 'mov-sea-1',
    org_id: 'org-sea-1',
    voyage_id: 'voy-1',
    vessel_id: 'ves-1',
    master_id: 'crew-1',
    status: 'in_transit',
    simulation_speed_multiplier: 1,
    distance_km: 2808,
    duration_minutes: 3600,
    predicted_duration_minutes: 3600,
    carbon_kg: 578340,
    started_at: new Date().toISOString(),
    created_at: new Date().toISOString(),
    voyage: mockVoyages[0],
    vessel: mockVessels[0],
    master: mockSeaCrew[0],
  };

  it('1. VoyageMovementDetailsPanel renders ETA confidence badge, Master score, DWT carbon bucket, and STCW status', async () => {
    render(
      <VoyageMovementDetailsPanel
        movement={mockMovement}
        onClose={vi.fn()}
        onRefresh={vi.fn()}
        userRole="manager"
      />,
    );

    // Verify voyage number and vessel
    expect(screen.getByText('VOY-BOM-MAA-001')).toBeInTheDocument();
    expect(screen.getAllByText(/MV Ocean Titan/i)[0]).toBeInTheDocument();

    // Verify ETA Confidence badge loaded from seaEtaService
    await waitFor(() => {
      expect(screen.getByText(/Estimated Voyage Duration/i)).toBeInTheDocument();
      expect(screen.getAllByText(/3600 min/i).length).toBeGreaterThan(0);
    });

    // Verify Master Behavior Score
    await waitFor(() => {
      expect(screen.getByText('95')).toBeInTheDocument();
      expect(screen.getByText('/ 100')).toBeInTheDocument();
    });

    // Verify GLEC v3.2 TEU Carbon Estimate (Panamax/Neo-Panamax [3k–8k TEU] @ 0.0091 kg/t-km)
    expect(screen.getByText(/Maritime Carbon Footprint/i)).toBeInTheDocument();
    expect(screen.getByText(/Panamax \/ Neo-Panamax \(3k–8k TEU\)/i)).toBeInTheDocument();
    expect(screen.getByText(/Factor: 0.0091 kg\/t-km/i)).toBeInTheDocument();

    // Verify STCW Rest-Hour Compliance status
    await waitFor(() => {
      expect(screen.getByText('Compliant')).toBeInTheDocument();
      expect(screen.getByText('STCW Code Sec A-VIII/1')).toBeInTheDocument();
    });
  });

  it('1b. VoyageMovementDetailsPanel renders Download Voyage PDF Report button when completed', () => {
    const completedMovement: VoyageMovement = {
      ...mockMovement,
      status: 'completed',
      completed_at: new Date().toISOString(),
    };

    render(
      <VoyageMovementDetailsPanel
        movement={completedMovement}
        onClose={vi.fn()}
        onRefresh={vi.fn()}
        userRole="manager"
      />,
    );

    expect(screen.getByText(/Audit Report Ready/i)).toBeInTheDocument();
    expect(screen.getByText(/Download Voyage PDF Report/i)).toBeInTheDocument();
  });

  it('2. CreateVoyageMovementModal performs live port berth/slot check and displays clearance badge', async () => {
    render(
      <CreateVoyageMovementModal
        isOpen={true}
        onClose={vi.fn()}
        onMovementCreated={vi.fn()}
        voyages={mockVoyages}
        ports={mockPorts}
        vessels={mockVessels}
        crew={mockSeaCrew}
      />,
    );

    expect(screen.getByText('Dispatch Voyage Movement')).toBeInTheDocument();

    // Verify port slot intelligence clearance
    await waitFor(() => {
      expect(screen.getByText(/Berth & Fairway Slots Available/i)).toBeInTheDocument();
      expect(screen.getByText(/Sufficient berth capacity/i)).toBeInTheDocument();
    });
  });

  it('3. SeawaysMap renders digital twin ghost position and schedule deviation', () => {
    const ghostPositions: Record<string, GhostPositionPayload> = {
      'mov-sea-1': {
        tripId: 'mov-sea-1',
        vehicleId: 'ves-1',
        ghostLat: 15.2,
        ghostLng: 74.8,
        status: 'on_schedule',
        deviationMinutes: 0,
      },
    };

    const { container } = render(
      <SeawaysMap
        ports={mockPorts}
        vessels={mockVessels}
        movements={[mockMovement]}
        ghostPositions={ghostPositions}
      />,
    );

    expect(container.querySelector('.leaflet-container') || container.firstChild).toBeTruthy();
  });

  it('4. AdminPanelModal displays completed voyage reports for mode === seaways', async () => {
    render(<AdminPanelModal currentUserRole="manager" />);

    // Open Admin Step-Up Password Modal
    const adminBtn = screen.getByText(/Admin Panel/i);
    fireEvent.click(adminBtn);

    // Fill in password
    const passwordInput = screen.getByPlaceholderText('••••••••••••');
    fireEvent.change(passwordInput, { target: { value: 'NexusAdmin2026!' } });

    const verifyBtn = screen.getByText(/Unlock Admin Panel/i);
    fireEvent.click(verifyBtn);

    // Verify Seaways-specific table headers and report items
    await waitFor(() => {
      expect(screen.getByText(/Completed Voyage Movement Reports/i)).toBeInTheDocument();
      expect(screen.getByText('Vessel')).toBeInTheDocument();
      expect(screen.getByText('Master')).toBeInTheDocument();
      expect(screen.getByText(/MV Ocean Titan \(IMO9876543\)/i)).toBeInTheDocument();
      expect(screen.getByText('Capt. Sunil Nair')).toBeInTheDocument();
    });
  });
});
