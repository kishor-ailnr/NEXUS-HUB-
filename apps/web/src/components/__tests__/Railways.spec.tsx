import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { RailwaysSidebar } from '../RailwaysSidebar';
import { RailwaysMap } from '../RailwaysMap';
import { MovementDetailsPanel } from '../MovementDetailsPanel';
import { CreateMovementModal } from '../CreateMovementModal';
import { DriverDashboard } from '../../pages/DriverDashboard';
import { railwaysService } from '../../services/railways';
import {
  Station,
  Train,
  Locomotive,
  Rake,
  LocoPilot,
  TrainMovement,
  LiveRailTelemetryPayload,
} from '@nexus-ways/shared';

// Mock Leaflet
vi.mock('leaflet', () => {
  const mapMock = {
    setView: vi.fn().mockReturnThis(),
    fitBounds: vi.fn().mockReturnThis(),
    getZoom: vi.fn().mockReturnValue(12),
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
  id: 'driver-user-rail-1',
  email: 'locopilot@railways.com',
  fullName: 'Rajesh Kumar',
  role: 'driver',
  orgId: 'org-rail-1',
  organization: { id: 'org-rail-1', name: 'Nexus Rail Central', mode: 'railways' },
};

vi.mock('../../store/authStore', () => ({
  useAuthStore: () => ({
    user: mockUser,
    logout: vi.fn(),
  }),
}));

// Mock services
vi.mock('../../services/railways', () => ({
  railwaysService: {
    getStations: vi.fn().mockResolvedValue([]),
    getTrains: vi.fn().mockResolvedValue([]),
    getLocomotives: vi.fn().mockResolvedValue([]),
    getRakes: vi.fn().mockResolvedValue([]),
    getLocoPilots: vi.fn().mockResolvedValue([]),
    getMovements: vi.fn().mockResolvedValue([]),
    createStation: vi.fn().mockResolvedValue({}),
    createLocomotive: vi.fn().mockResolvedValue({}),
    createRake: vi.fn().mockResolvedValue({}),
    createLocoPilot: vi.fn().mockResolvedValue({}),
    createTrain: vi.fn().mockResolvedValue({}),
    createMovement: vi.fn().mockResolvedValue({}),
    updateMovementStatus: vi.fn().mockResolvedValue({}),
    getEta: vi.fn().mockResolvedValue({
      movement_id: 'mov-1',
      base_eta_minutes: 240,
      min_eta_minutes: 216,
      max_eta_minutes: 264,
      confidence_basis: 'default',
      sample_size: 0,
      confidence_band_minutes: 24,
    }),
    getReportUrl: vi.fn().mockResolvedValue({
      movementId: 'mov-1',
      signedUrl: 'https://test-rail-pdf.url',
      storagePath: 'railways/org-1/mov-1.pdf',
    }),
    checkSlot: vi.fn().mockResolvedValue({
      congested: false,
      overlapCount: 0,
      reason: 'Track clear',
    }),
    getCrewScore: vi.fn().mockResolvedValue({
      score: 95,
      harsh_brake_count: 0,
      overspeed_event_count: 1,
    }),
    getAdminReports: vi.fn().mockResolvedValue([]),
  },
}));

vi.mock('../../services/trips', () => ({
  tripsService: {
    getTrips: vi.fn().mockResolvedValue([]),
    getDriverTrips: vi.fn().mockResolvedValue([]),
  },
}));

describe('Railways Frontend Modules', () => {
  const mockStations: Station[] = [
    {
      id: 'st-1',
      org_id: 'org-rail-1',
      name: 'Mumbai CSMT',
      station_code: 'CSMT',
      lat: 18.9398,
      lng: 72.8354,
      station_type: 'station',
      created_at: new Date().toISOString(),
    },
    {
      id: 'st-2',
      org_id: 'org-rail-1',
      name: 'Pune Junction',
      station_code: 'PUNE',
      lat: 18.5204,
      lng: 73.8567,
      station_type: 'junction',
      created_at: new Date().toISOString(),
    },
  ];

  const mockLocomotives: Locomotive[] = [
    {
      id: 'loco-1',
      org_id: 'org-rail-1',
      loco_number: 'WAP7-30221',
      loco_type: 'WAP-7',
      power_kw: 4500,
      fuel_type: 'electric',
      status: 'active',
      created_at: new Date().toISOString(),
    },
  ];

  const mockRakes: Rake[] = [
    {
      id: 'rake-1',
      org_id: 'org-rail-1',
      rake_id: 'RAKE-DECCAN-01',
      composition: [{ type: 'coach', count: 16 }],
      created_at: new Date().toISOString(),
    },
  ];

  const mockLocoPilots: LocoPilot[] = [
    {
      id: 'lp-1',
      org_id: 'org-rail-1',
      user_id: 'user-pilot-1',
      license_number: 'LP-CR-8841',
      phone: '+919876543210',
      status: 'on_duty',
      created_at: new Date().toISOString(),
      user: { id: 'user-pilot-1', email: 'locopilot@railways.com', full_name: 'Rajesh Kumar' },
    },
  ];

  const mockTrains: Train[] = [
    {
      id: 'train-1',
      org_id: 'org-rail-1',
      train_number: '12124',
      train_name: 'Deccan Queen',
      locomotive_id: 'loco-1',
      rake_id: 'rake-1',
      status: 'active',
      created_at: new Date().toISOString(),
      locomotive: mockLocomotives[0],
      rake: mockRakes[0],
    },
  ];

  const mockMovements: TrainMovement[] = [
    {
      id: 'mov-1',
      org_id: 'org-rail-1',
      train_id: 'train-1',
      loco_pilot_id: 'lp-1',
      origin_station_id: 'st-1',
      destination_station_id: 'st-2',
      status: 'in_transit',
      distance_km: 192,
      duration_minutes: 190,
      simulation_speed_multiplier: 60,
      started_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
      train: mockTrains[0],
      loco_pilot: mockLocoPilots[0],
      origin_station: mockStations[0],
      destination_station: mockStations[1],
      stops: [
        { id: 'stop-1', movement_id: 'mov-1', station_id: 'st-1', sequence: 1, station: mockStations[0] },
        { id: 'stop-2', movement_id: 'mov-1', station_id: 'st-2', sequence: 2, station: mockStations[1] },
      ],
      route_geometry: {
        type: 'LineString',
        coordinates: [
          [72.8354, 18.9398],
          [73.8567, 18.5204],
        ],
        distance_km: 192,
        duration_minutes: 190,
        routing_source: 'overpass',
      },
    },
  ];

  describe('1. RailwaysSidebar Component', () => {
    it('Renders trains list and station counts', () => {
      const onSelectTrain = vi.fn();
      const onSelectMovement = vi.fn();
      const onRefresh = vi.fn();
      const onOpenCreateMovement = vi.fn();

      render(
        <RailwaysSidebar
          trains={mockTrains}
          stations={mockStations}
          locomotives={mockLocomotives}
          rakes={mockRakes}
          locoPilots={mockLocoPilots}
          movements={mockMovements}
          selectedTrainId={null}
          onSelectTrain={onSelectTrain}
          selectedMovementId={null}
          onSelectMovement={onSelectMovement}
          userRole="manager"
          onRefresh={onRefresh}
          onOpenCreateMovement={onOpenCreateMovement}
        />,
      );

      expect(screen.getByText('12124')).toBeInTheDocument();
      expect(screen.getByText('Deccan Queen')).toBeInTheDocument();
      expect(screen.getByText('Dispatch')).toBeInTheDocument();
    });

    it('Allows searching and filtering trains', () => {
      render(
        <RailwaysSidebar
          trains={mockTrains}
          stations={mockStations}
          locomotives={mockLocomotives}
          rakes={mockRakes}
          locoPilots={mockLocoPilots}
          movements={mockMovements}
          selectedTrainId={null}
          onSelectTrain={vi.fn()}
          selectedMovementId={null}
          onSelectMovement={vi.fn()}
          userRole="manager"
          onRefresh={vi.fn()}
          onOpenCreateMovement={vi.fn()}
        />,
      );

      const searchInput = screen.getByPlaceholderText('Search trains, stations...');
      fireEvent.change(searchInput, { target: { value: 'Deccan' } });
      expect(screen.getByText('Deccan Queen')).toBeInTheDocument();

      fireEvent.change(searchInput, { target: { value: 'NonExistentTrain' } });
      expect(screen.queryByText('Deccan Queen')).not.toBeInTheDocument();
    });

    it('renders Add Loco Pilot button for manager, submits valid data, and calls createLocoPilot with correct payload', async () => {
      const onRefresh = vi.fn();
      render(
        <RailwaysSidebar
          trains={mockTrains}
          stations={mockStations}
          locomotives={mockLocomotives}
          rakes={mockRakes}
          locoPilots={mockLocoPilots}
          movements={mockMovements}
          selectedTrainId={null}
          onSelectTrain={vi.fn()}
          selectedMovementId={null}
          onSelectMovement={vi.fn()}
          userRole="manager"
          onRefresh={onRefresh}
          onOpenCreateMovement={vi.fn()}
        />,
      );

      // Switch to pilots tab
      const pilotsTabBtn = screen.getByText(/Pilots \(/i);
      fireEvent.click(pilotsTabBtn);

      const addPilotBtn = screen.getByTestId('add-pilot-button-tab');
      expect(addPilotBtn).toBeInTheDocument();
      fireEvent.click(addPilotBtn);

      expect(screen.getByRole('heading', { name: 'Register Loco Pilot' })).toBeInTheDocument();

      fireEvent.change(screen.getByTestId('pilot-name-input'), { target: { value: 'Devendra Yadav' } });
      fireEvent.change(screen.getByTestId('pilot-email-input'), { target: { value: 'devendra@railways.in' } });
      fireEvent.change(screen.getByTestId('pilot-license-input'), { target: { value: 'IR-LP-99881' } });
      fireEvent.change(screen.getByTestId('pilot-phone-input'), { target: { value: '+91 94111 55667' } });
      fireEvent.change(screen.getByTestId('pilot-password-input'), { target: { value: 'Pilot@Secret123' } });

      fireEvent.click(screen.getByTestId('submit-pilot-button'));

      await waitFor(() => {
        expect(railwaysService.createLocoPilot).toHaveBeenCalledWith({
          fullName: 'Devendra Yadav',
          email: 'devendra@railways.in',
          licenseNumber: 'IR-LP-99881',
          phone: '+91 94111 55667',
          password: 'Pilot@Secret123',
        });
        expect(onRefresh).toHaveBeenCalled();
      });
    });

    it('immediately reflects new loco pilot in CreateMovementModal pilot assignment dropdown without reload', () => {
      const updatedPilots: LocoPilot[] = [
        ...mockLocoPilots,
        {
          id: 'lp-new-99',
          org_id: 'org-rail-1',
          user_id: 'u-pilot-99',
          license_number: 'IR-LP-NEW99',
          phone: '+91 94111 55667',
          status: 'available',
          created_at: new Date().toISOString(),
          user: { id: 'u-pilot-99', email: 'newpilot@railways.in', full_name: 'Devendra Yadav' },
        },
      ];

      render(
        <CreateMovementModal
          isOpen={true}
          onClose={vi.fn()}
          stations={mockStations}
          trains={mockTrains}
          locoPilots={updatedPilots}
          savedRoutes={[]}
          onMovementCreated={vi.fn()}
        />,
      );

      expect(screen.getByText(/Devendra Yadav \(IR-LP-NEW99\)/i)).toBeInTheDocument();
    });

    it('guards Add Loco Pilot buttons: driver-role user cannot see them', () => {
      render(
        <RailwaysSidebar
          trains={mockTrains}
          stations={mockStations}
          locomotives={mockLocomotives}
          rakes={mockRakes}
          locoPilots={mockLocoPilots}
          movements={mockMovements}
          selectedTrainId={null}
          onSelectTrain={vi.fn()}
          selectedMovementId={null}
          onSelectMovement={vi.fn()}
          userRole="driver"
          onRefresh={vi.fn()}
          onOpenCreateMovement={vi.fn()}
        />,
      );

      // Switch to locos tab
      fireEvent.click(screen.getByText(/Locos \(/i));
      expect(screen.queryByTestId('add-pilot-button')).not.toBeInTheDocument();

      // Switch to pilots tab
      fireEvent.click(screen.getByText(/Pilots \(/i));
      expect(screen.queryByTestId('add-pilot-button-tab')).not.toBeInTheDocument();
    });
  });

  describe('2. RailwaysMap Component', () => {
    it('Renders map with stations and live train movement overlay', () => {
      const liveTelemetry: Record<string, LiveRailTelemetryPayload> = {
        'mov-1': {
          movementId: 'mov-1',
          trainId: 'train-1',
          trainNumber: '12124',
          lat: 18.75,
          lng: 73.2,
          speed_kmh: 88,
          heading: 120,
          recorded_at: new Date().toISOString(),
          simulated: true,
        },
      };

      const { container } = render(
        <RailwaysMap
          stations={mockStations}
          trains={mockTrains}
          movements={mockMovements}
          selectedMovement={mockMovements[0]}
          selectedTrainId="train-1"
          liveTelemetry={liveTelemetry}
          onSelectMovement={vi.fn()}
        />,
      );

      expect(container.querySelector('.leaflet-container')).toBeDefined();
      expect(screen.getByText(/OpenRailwayMap Real Track Overlay/i)).toBeInTheDocument();
    });
  });

  describe('3. MovementDetailsPanel Component', () => {
    it('Renders movement details, speed, route source badge and stop progress', () => {
      render(
        <MovementDetailsPanel
          movement={mockMovements[0]}
          liveTelemetry={{
            movementId: 'mov-1',
            trainId: 'train-1',
            trainNumber: '12124',
            lat: 18.75,
            lng: 73.2,
            speed_kmh: 88,
            heading: 120,
            recorded_at: new Date().toISOString(),
            simulated: true,
          }}
          onClose={vi.fn()}
          onRefresh={vi.fn()}
          userRole="manager"
        />,
      );

      expect(screen.getByText('12124')).toBeInTheDocument();
      expect(screen.getByText('Deccan Queen')).toBeInTheDocument();
      expect(screen.getByText('Mumbai CSMT')).toBeInTheDocument();
      expect(screen.getByText('Pune Junction')).toBeInTheDocument();
      expect(screen.getByText(/overpass/i)).toBeInTheDocument();
      expect(screen.getAllByText(/km\/h/i).length).toBeGreaterThan(0);
    });
  });

  describe('4. Loco Pilot Driver View', () => {
    it('Renders Loco Pilot Cabin dashboard when role is driver in railways mode', async () => {
      render(
        <MemoryRouter initialEntries={['/railways/driver']}>
          <Routes>
            <Route path="/:mode/driver" element={<DriverDashboard />} />
          </Routes>
        </MemoryRouter>,
      );

      expect(screen.getByText(/Loco Pilot Console/i)).toBeInTheDocument();
      expect(screen.getByText(/Rajesh Kumar/i)).toBeInTheDocument();
      expect(screen.getByText(/Nexus Rail Central/i)).toBeInTheDocument();
    });
  });
});
