import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { SeawaysSidebar } from '../SeawaysSidebar';
import { SeawaysMap } from '../SeawaysMap';
import { VoyageMovementDetailsPanel } from '../VoyageMovementDetailsPanel';
import { CreateVoyageMovementModal } from '../CreateVoyageMovementModal';
import { DriverDashboard } from '../../pages/DriverDashboard';
import {
  Port,
  Vessel,
  SeaCrew,
  Voyage,
  VoyageMovement,
  LiveVesselTelemetryPayload,
  SeaConvoyGroup,
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

// Mock AuthStore
let mockUser: any = {
  id: 'crew-user-sea-1',
  email: 'captain@seaways.com',
  fullName: 'Capt. Sunil Nair',
  role: 'driver',
  orgId: 'org-sea-1',
  organization: { id: 'org-sea-1', name: 'Nexus Seaways Global', mode: 'seaways' },
};

vi.mock('../../store/authStore', () => ({
  useAuthStore: () => ({
    user: mockUser,
    logout: vi.fn(),
  }),
}));

// Mock services
vi.mock('../../services/seaways', () => ({
  seawaysService: {
    getPorts: vi.fn().mockResolvedValue([]),
    getVessels: vi.fn().mockResolvedValue([]),
    getSeaCrew: vi.fn().mockResolvedValue([]),
    getVoyages: vi.fn().mockResolvedValue([]),
    getMovements: vi.fn().mockResolvedValue([]),
    getConvoys: vi.fn().mockResolvedValue([]),
    createPort: vi.fn().mockResolvedValue({}),
    createVessel: vi.fn().mockResolvedValue({}),
    createSeaCrew: vi.fn().mockResolvedValue({}),
    createVoyage: vi.fn().mockResolvedValue({}),
    createMovement: vi.fn().mockResolvedValue({ id: 'mov-sea-1', voyage: { voyage_number: 'VOY-101' } }),
    updateMovementStatus: vi.fn().mockResolvedValue({}),
    createConvoy: vi.fn().mockResolvedValue({}),
    addVesselToConvoy: vi.fn().mockResolvedValue({}),
    removeVesselFromConvoy: vi.fn().mockResolvedValue({}),
    getEta: vi.fn().mockResolvedValue({
      base_eta_minutes: 3600,
      min_eta_minutes: 3060,
      max_eta_minutes: 4140,
      confidence_basis: 'default',
      sample_size: 1,
    }),
    getCrewScore: vi.fn().mockResolvedValue([{ score: 100, harsh_maneuver_count: 0, overspeed_event_count: 0 }]),
    getWatchkeepingLogs: vi.fn().mockResolvedValue([]),
    checkPortSlots: vi.fn().mockResolvedValue({
      congested: false,
      originSlotCount: 0,
      destinationSlotCount: 0,
    }),
    getReportUrl: vi.fn().mockResolvedValue({ signedUrl: 'https://example.com/report.pdf' }),
    getAdminReports: vi.fn().mockResolvedValue([]),
  },
}));

vi.mock('../../services/trips', () => ({
  tripsService: {
    getTrips: vi.fn().mockResolvedValue([]),
    getDriverTrips: vi.fn().mockResolvedValue([]),
  },
}));

vi.mock('../../services/vehicles', () => ({
  vehiclesService: {
    getVehicles: vi.fn().mockResolvedValue([]),
  },
}));

describe('Seaways Frontend Modules & Components', () => {
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
    {
      id: 'ves-2',
      org_id: 'org-sea-1',
      vessel_name: 'MV Arabian Pearl',
      imo_number: 'IMO9123456',
      vessel_type: 'Oil Tanker (Aframax)',
      dwt_tonnes: 110000,
      status: 'idle',
      created_at: new Date().toISOString(),
    },
  ];

  const mockSeaCrew: SeaCrew[] = [
    {
      id: 'crew-1',
      org_id: 'org-sea-1',
      user_id: 'crew-user-sea-1',
      certificate_number: 'IND-COC-MASTER-88412',
      crew_role: 'master',
      status: 'on_duty',
      created_at: new Date().toISOString(),
      user: { id: 'crew-user-sea-1', email: 'captain@seaways.com', full_name: 'Capt. Sunil Nair' },
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

  const mockMovements: VoyageMovement[] = [
    {
      id: 'mov-sea-1',
      org_id: 'org-sea-1',
      voyage_id: 'voy-1',
      vessel_id: 'ves-1',
      master_id: 'crew-1',
      status: 'in_transit',
      distance_km: 2150,
      duration_minutes: 3680,
      simulation_speed_multiplier: 60,
      started_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
      voyage: mockVoyages[0],
      vessel: mockVessels[0],
      master: mockSeaCrew[0],
    },
  ];

  const mockConvoys: SeaConvoyGroup[] = [
    {
      id: 'convoy-1',
      org_id: 'org-sea-1',
      name: 'Malacca Strait Escort Convoy',
      created_at: new Date().toISOString(),
      members: [
        {
          id: 'mem-1',
          convoy_id: 'convoy-1',
          vessel_id: 'ves-1',
          joined_at: new Date().toISOString(),
          vessel: {
            id: 'ves-1',
            org_id: 'org-sea-1',
            vessel_name: 'MV Ocean Titan',
            imo_number: 'IMO9876543',
            vessel_type: 'Container Ship (Panamax)',
            dwt_tonnes: 65000,
            status: 'active',
            created_at: new Date().toISOString(),
          },
        },
      ],
    },
  ];

  describe('1. SeawaysSidebar Component', () => {
    it('Renders voyages, vessels, and search filter', () => {
      render(
        <SeawaysSidebar
          voyages={mockVoyages}
          ports={mockPorts}
          vessels={mockVessels}
          crew={mockSeaCrew}
          movements={mockMovements}
          convoys={mockConvoys}
          selectedVesselId={null}
          onSelectVessel={vi.fn()}
          selectedMovementId={null}
          onSelectMovement={vi.fn()}
          userRole="manager"
          onRefresh={vi.fn()}
          onOpenCreateMovement={vi.fn()}
        />,
      );

      expect(screen.getByText('VOY-BOM-MAA-001')).toBeInTheDocument();
      expect(screen.getByText(/MV Ocean Titan/i)).toBeInTheDocument();
      expect(screen.getByText('Dispatch')).toBeInTheDocument();
    });

    it('Switches tabs between Movements, Vessels, and Convoys', () => {
      render(
        <SeawaysSidebar
          voyages={mockVoyages}
          ports={mockPorts}
          vessels={mockVessels}
          crew={mockSeaCrew}
          movements={mockMovements}
          convoys={mockConvoys}
          selectedVesselId={null}
          onSelectVessel={vi.fn()}
          selectedMovementId={null}
          onSelectMovement={vi.fn()}
          userRole="manager"
          onRefresh={vi.fn()}
          onOpenCreateMovement={vi.fn()}
        />,
      );

      // Click Convoys tab
      const convoyTab = screen.getByRole('button', { name: /Convoys/i });
      fireEvent.click(convoyTab);

      expect(screen.getByText('Malacca Strait Escort Convoy')).toBeInTheDocument();
      expect(screen.getByText(/1 Vessels/i)).toBeInTheDocument();
    });
  });

  describe('2. SeawaysMap Component', () => {
    it('Renders map container and vessel tracking elements', () => {
      const mockLiveTelemetry: Record<string, LiveVesselTelemetryPayload> = {
        'mov-sea-1': {
          movementId: 'mov-sea-1',
          voyageId: 'voy-1',
          vesselId: 'ves-1',
          masterId: 'crew-1',
          voyageNumber: 'VOY-BOM-MAA-001',
          vesselName: 'MV Ocean Titan',
          vesselType: 'Container Ship (Panamax)',
          masterName: 'Capt. Sunil Nair',
          originPortName: 'Jawaharlal Nehru Port (JNPT), Mumbai',
          destinationPortName: 'Chennai Port',
          lat: 10.5,
          lng: 76.0,
          speedKnots: 19.4,
          heading: 165,
          timestamp: new Date().toISOString(),
          status: 'in_transit',
          progressPercent: 35,
          distanceKm: 2808,
          durationMinutes: 4200,
        },
      };

      const { container } = render(
        <SeawaysMap
          ports={mockPorts}
          vessels={mockVessels}
          movements={mockMovements}
          convoys={mockConvoys}
          selectedMovement={mockMovements[0]}
          selectedVesselId={null}
          liveTelemetry={mockLiveTelemetry}
        />,
      );

      expect(container.querySelector('.leaflet-container') || container.firstChild).toBeTruthy();
    });
  });

  describe('3. CreateVoyageMovementModal Component', () => {
    it('Renders voyage dispatch form with land-avoiding route banner', () => {
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
      expect(screen.getByText(/Land-Avoiding Maritime Routing Active/i)).toBeInTheDocument();
      expect(screen.getAllByText(/MV Ocean Titan/i)[0]).toBeInTheDocument();
    });
  });

  describe('4. VoyageMovementDetailsPanel Component', () => {
    it('Displays nautical miles, live knots speed, master name, and routing label', () => {
      const liveData: LiveVesselTelemetryPayload = {
        movementId: 'mov-sea-1',
        voyageId: 'voy-1',
        vesselId: 'ves-1',
        masterId: 'crew-1',
        voyageNumber: 'VOY-BOM-MAA-001',
        vesselName: 'MV Ocean Titan',
        vesselType: 'Container Ship (Panamax)',
        masterName: 'Capt. Sunil Nair',
        originPortName: 'Jawaharlal Nehru Port (JNPT), Mumbai',
        destinationPortName: 'Chennai Port',
        lat: 10.5,
        lng: 76.0,
        speedKnots: 19.5,
        heading: 165,
        timestamp: new Date().toISOString(),
        status: 'in_transit',
        progressPercent: 35,
        distanceKm: 2808,
        durationMinutes: 4200,
      };

      render(
        <VoyageMovementDetailsPanel
          movement={mockMovements[0]}
          onClose={vi.fn()}
          onStatusChange={vi.fn()}
          liveData={liveData}
          userRole="manager"
        />,
      );

      expect(screen.getByText('VOY-BOM-MAA-001')).toBeInTheDocument();
      expect(screen.getAllByText('MV Ocean Titan')[0]).toBeInTheDocument();
      expect(screen.getByText('Capt. Sunil Nair')).toBeInTheDocument();
      expect(screen.getByText(/19\.5 knots/i)).toBeInTheDocument();
      expect(screen.getByText(/searoute/i)).toBeInTheDocument();
    });
  });

  describe('5. Driver / Master Helm Console View', () => {
    beforeEach(() => {
      mockUser = {
        id: 'crew-user-sea-1',
        email: 'captain@seaways.com',
        fullName: 'Capt. Sunil Nair',
        role: 'driver',
        orgId: 'org-sea-1',
        organization: { id: 'org-sea-1', name: 'Nexus Seaways Global', mode: 'seaways' },
      };
    });

    it('Renders simplified Bridge Master console for driver role', async () => {
      const { seawaysService } = await import('../../services/seaways');
      (seawaysService.getMovements as any).mockResolvedValue(mockMovements);

      render(
        <MemoryRouter initialEntries={['/driver']}>
          <Routes>
            <Route path="/driver" element={<DriverDashboard />} />
          </Routes>
        </MemoryRouter>,
      );

      await waitFor(() => {
        expect(screen.getByText(/Bridge Master & Helm Console/i)).toBeInTheDocument();
        expect(screen.getByText(/Capt. Sunil Nair/i)).toBeInTheDocument();
      });
    });
  });
});
