import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { AirwaysSidebar } from '../AirwaysSidebar';
import { AirwaysMap } from '../AirwaysMap';
import { FlightMovementDetailsPanel } from '../FlightMovementDetailsPanel';
import { CreateFlightMovementModal } from '../CreateFlightMovementModal';
import { DriverDashboard } from '../../pages/DriverDashboard';
import { airwaysService } from '../../services/airways';
import {
  Airport,
  Aircraft,
  FlightCrew,
  Flight,
  FlightMovement,
  LiveFlightTelemetryPayload,
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
  id: 'crew-user-air-1',
  email: 'pilot@airways.com',
  fullName: 'Capt. Rajesh Sharma',
  role: 'driver',
  orgId: 'org-air-1',
  organization: { id: 'org-air-1', name: 'Nexus Air Global', mode: 'airways' },
};

vi.mock('../../store/authStore', () => ({
  useAuthStore: () => ({
    user: mockUser,
    logout: vi.fn(),
  }),
}));

// Mock services
vi.mock('../../services/airways', () => ({
  airwaysService: {
    getAirports: vi.fn().mockResolvedValue([]),
    getAircraft: vi.fn().mockResolvedValue([]),
    getFlightCrew: vi.fn().mockResolvedValue([]),
    getFlights: vi.fn().mockResolvedValue([]),
    getMovements: vi.fn().mockResolvedValue([]),
    createAirport: vi.fn().mockResolvedValue({}),
    createAircraft: vi.fn().mockResolvedValue({}),
    createFlightCrew: vi.fn().mockResolvedValue({}),
    createFlight: vi.fn().mockResolvedValue({}),
    createMovement: vi.fn().mockResolvedValue({ id: 'mov-1', flight: { flight_number: 'NX-101' } }),
    updateMovementStatus: vi.fn().mockResolvedValue({}),
    getEta: vi.fn().mockResolvedValue({
      movement_id: 'mov-1',
      base_eta_minutes: 105,
      min_eta_minutes: 95,
      max_eta_minutes: 115,
      confidence_band_minutes: 10,
      confidence_basis: 'historical',
      sample_size: 4,
    }),
    getCrewScore: vi.fn().mockResolvedValue([
      {
        id: 'cfs-1',
        movement_id: 'mov-1',
        pilot_id: 'fc-1',
        score: 95,
        abrupt_maneuver_count: 0,
        overspeed_event_count: 1,
        computed_at: new Date().toISOString(),
      },
    ]),
    getDutyLogs: vi.fn().mockResolvedValue([
      {
        id: 'fdl-1',
        pilot_id: 'fc-1',
        movement_id: 'mov-1',
        duty_minutes: 105,
        window_started_at: new Date().toISOString(),
        window_ended_at: new Date().toISOString(),
        violation: false,
      },
    ]),
    checkAirportSlots: vi.fn().mockResolvedValue({
      departureAirportId: 'apt-1',
      arrivalAirportId: 'apt-2',
      proposedDeparture: new Date().toISOString(),
      congested: false,
      departureSlotCount: 0,
      arrivalSlotCount: 0,
      threshold: 3,
      departureSlotCongested: false,
      arrivalSlotCongested: false,
      advisoryMessage: 'Airport runway and apron slots clear for departure and arrival windows.',
    }),
    getReportUrl: vi.fn().mockResolvedValue({
      movementId: 'mov-1',
      signedUrl: 'https://mock-storage.nexus.ways/flight-pdfs/airways/org-air-1/mov-1.pdf',
      storagePath: 'airways/org-air-1/mov-1.pdf',
      fileSizeBytes: 9500,
      generatedAt: new Date().toISOString(),
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

vi.mock('../../services/vehicles', () => ({
  vehiclesService: {
    getVehicles: vi.fn().mockResolvedValue([]),
  },
}));

describe('Airways Frontend Modules & Phase 7B-2 Intelligence', () => {
  const mockAirports: Airport[] = [
    {
      id: 'apt-1',
      org_id: 'org-air-1',
      name: 'Mumbai International',
      iata_code: 'BOM',
      icao_code: 'VABB',
      lat: 19.0896,
      lng: 72.8656,
      created_at: new Date().toISOString(),
    },
    {
      id: 'apt-2',
      org_id: 'org-air-1',
      name: 'Delhi International',
      iata_code: 'DEL',
      icao_code: 'VIDP',
      lat: 28.5562,
      lng: 77.1,
      created_at: new Date().toISOString(),
    },
  ];

  const mockAircraftList: Aircraft[] = [
    {
      id: 'ac-1',
      org_id: 'org-air-1',
      tail_number: 'VT-NEX',
      aircraft_type: 'Boeing 777F',
      cargo_capacity_kg: 102000,
      status: 'active',
      created_at: new Date().toISOString(),
    },
  ];

  const mockFlightCrewList: FlightCrew[] = [
    {
      id: 'fc-1',
      org_id: 'org-air-1',
      user_id: 'crew-user-air-1',
      license_number: 'ATPL-777-9942',
      crew_role: 'pilot',
      status: 'on_duty',
      created_at: new Date().toISOString(),
      user: { id: 'crew-user-air-1', email: 'pilot@airways.com', full_name: 'Capt. Rajesh Sharma' },
    },
  ];

  const mockFlights: Flight[] = [
    {
      id: 'flt-1',
      org_id: 'org-air-1',
      flight_number: 'NX-101',
      origin_airport_id: 'apt-1',
      destination_airport_id: 'apt-2',
      created_at: new Date().toISOString(),
      origin_airport: mockAirports[0],
      destination_airport: mockAirports[1],
    },
  ];

  const mockMovements: FlightMovement[] = [
    {
      id: 'mov-1',
      org_id: 'org-air-1',
      flight_id: 'flt-1',
      aircraft_id: 'ac-1',
      pilot_id: 'fc-1',
      status: 'in_transit',
      routing_method: 'great-circle',
      distance_km: 1148,
      duration_minutes: 105,
      carbon_kg: 27643.84,
      simulation_speed_multiplier: 60,
      started_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
      flight: mockFlights[0],
      aircraft: mockAircraftList[0],
      pilot: mockFlightCrewList[0],
    },
  ];

  describe('1. AirwaysSidebar Component', () => {
    it('Renders flights list and search bar', () => {
      const onSelectAircraft = vi.fn();
      const onSelectMovement = vi.fn();
      const onRefresh = vi.fn();
      const onOpenCreateMovement = vi.fn();

      render(
        <AirwaysSidebar
          flights={mockFlights}
          airports={mockAirports}
          aircraft={mockAircraftList}
          crew={mockFlightCrewList}
          movements={mockMovements}
          selectedAircraftId={null}
          onSelectAircraft={onSelectAircraft}
          selectedMovementId={null}
          onSelectMovement={onSelectMovement}
          userRole="manager"
          onRefresh={onRefresh}
          onOpenCreateMovement={onOpenCreateMovement}
        />,
      );

      expect(screen.getByText('NX-101')).toBeInTheDocument();
      expect(screen.getByText(/Mumbai International/i)).toBeInTheDocument();
      expect(screen.getByText(/Delhi International/i)).toBeInTheDocument();
      expect(screen.getByText('Dispatch')).toBeInTheDocument();
    });

    it('Filters flights based on search query', () => {
      render(
        <AirwaysSidebar
          flights={mockFlights}
          airports={mockAirports}
          aircraft={mockAircraftList}
          crew={mockFlightCrewList}
          movements={mockMovements}
          selectedAircraftId={null}
          onSelectAircraft={vi.fn()}
          selectedMovementId={null}
          onSelectMovement={vi.fn()}
          userRole="manager"
          onRefresh={vi.fn()}
          onOpenCreateMovement={vi.fn()}
        />,
      );

      const searchInput = screen.getByPlaceholderText('Search flights, aircraft, airports...');
      fireEvent.change(searchInput, { target: { value: 'NX-101' } });
      expect(screen.getByText('NX-101')).toBeInTheDocument();

      fireEvent.change(searchInput, { target: { value: 'NX-999' } });
      expect(screen.queryByText('NX-101')).not.toBeInTheDocument();
    });

    it('renders Add Crew button for manager, submits valid data, and calls createFlightCrew with correct payload', async () => {
      const onRefresh = vi.fn();
      render(
        <AirwaysSidebar
          flights={mockFlights}
          airports={mockAirports}
          aircraft={mockAircraftList}
          crew={mockFlightCrewList}
          movements={mockMovements}
          selectedAircraftId={null}
          onSelectAircraft={vi.fn()}
          selectedMovementId={null}
          onSelectMovement={vi.fn()}
          userRole="manager"
          onRefresh={onRefresh}
          onOpenCreateMovement={vi.fn()}
        />,
      );

      // Open crew tab
      const crewTabBtn = screen.getByRole('button', { name: /^crew$/i });
      fireEvent.click(crewTabBtn);

      const addCrewBtn = screen.getByTestId('add-crew-button-tab');
      expect(addCrewBtn).toBeInTheDocument();
      fireEvent.click(addCrewBtn);

      expect(screen.getByText('Register Flight Crew Member')).toBeInTheDocument();

      fireEvent.change(screen.getByTestId('crew-name-input'), { target: { value: 'Capt. Aditya Rao' } });
      fireEvent.change(screen.getByTestId('crew-email-input'), { target: { value: 'aditya.rao@airways.com' } });
      fireEvent.change(screen.getByTestId('crew-license-input'), { target: { value: 'ATPL-IND-10293' } });
      fireEvent.change(screen.getByTestId('crew-phone-input'), { target: { value: '+91 99887 66554' } });
      fireEvent.change(screen.getByTestId('crew-role-select'), { target: { value: 'pilot' } });
      fireEvent.change(screen.getByTestId('crew-password-input'), { target: { value: 'Aditya@Sky2026' } });

      fireEvent.click(screen.getByTestId('submit-crew-button'));

      await waitFor(() => {
        expect(airwaysService.createFlightCrew).toHaveBeenCalledWith({
          fullName: 'Capt. Aditya Rao',
          email: 'aditya.rao@airways.com',
          licenseNumber: 'ATPL-IND-10293',
          phone: '+91 99887 66554',
          crewRole: 'pilot',
          password: 'Aditya@Sky2026',
        });
        expect(onRefresh).toHaveBeenCalled();
      });
    });

    it('immediately reflects new flight crew in CreateFlightMovementModal pilot assignment dropdown without reload', () => {
      const updatedCrew: FlightCrew[] = [
        ...mockFlightCrewList,
        {
          id: 'fc-new-99',
          org_id: 'org-air-1',
          user_id: 'u-air-99',
          license_number: 'ATPL-IND-9999',
          crew_role: 'pilot',
          status: 'available',
          created_at: new Date().toISOString(),
          user: { id: 'u-air-99', email: 'aditya.rao@airways.com', full_name: 'Capt. Aditya Rao' },
        },
      ];

      render(
        <CreateFlightMovementModal
          isOpen={true}
          onClose={vi.fn()}
          airports={mockAirports}
          aircraft={mockAircraftList}
          crew={updatedCrew}
          flights={mockFlights}
          onMovementCreated={vi.fn()}
        />,
      );

      expect(screen.getByText(/Capt. Aditya Rao/i)).toBeInTheDocument();
    });

    it('guards Add Crew and Add Aircraft buttons: driver/pilot-role user cannot see them', () => {
      render(
        <AirwaysSidebar
          flights={mockFlights}
          airports={mockAirports}
          aircraft={mockAircraftList}
          crew={mockFlightCrewList}
          movements={mockMovements}
          selectedAircraftId={null}
          onSelectAircraft={vi.fn()}
          selectedMovementId={null}
          onSelectMovement={vi.fn()}
          userRole="driver"
          onRefresh={vi.fn()}
          onOpenCreateMovement={vi.fn()}
        />,
      );

      // In aircraft tab
      const aircraftTabBtn = screen.getByRole('button', { name: /^aircraft$/i });
      fireEvent.click(aircraftTabBtn);
      expect(screen.queryByTestId('add-crew-button')).not.toBeInTheDocument();
      expect(screen.queryByTestId('add-aircraft-button')).not.toBeInTheDocument();

      // In crew tab
      const crewTabBtn = screen.getByRole('button', { name: /^crew$/i });
      fireEvent.click(crewTabBtn);
      expect(screen.queryByTestId('add-crew-button-tab')).not.toBeInTheDocument();
    });
  });

  describe('2. AirwaysMap Component & Digital Twin Ghost Projection', () => {
    it('Renders map container, great-circle radar header, and digital twin ghost marker', () => {
      const liveTelemetry: Record<string, LiveFlightTelemetryPayload> = {
        'mov-1': {
          movementId: 'mov-1',
          flightId: 'flt-1',
          aircraftId: 'ac-1',
          pilotId: 'fc-1',
          flightNumber: 'NX-101',
          tailNumber: 'VT-NEX',
          aircraftType: 'Boeing 777F',
          pilotName: 'Capt. Rajesh Sharma',
          originAirportName: 'Mumbai International',
          destinationAirportName: 'Delhi International',
          lat: 23.5,
          lng: 75.0,
          altitudeFt: 34000,
          speedKts: 460,
          heading: 25,
          status: 'in_transit',
          progressPercent: 45,
          distanceKm: 1148,
          durationMinutes: 105,
          timestamp: new Date().toISOString(),
        },
      };

      const ghostPositions: Record<string, GhostPositionPayload> = {
        'mov-1': {
          tripId: 'mov-1',
          vehicleId: 'ac-1',
          ghostLat: 23.6,
          ghostLng: 75.1,
          deviationMinutes: 0,
          status: 'on_schedule',
        },
      };

      const { container } = render(
        <AirwaysMap
          airports={mockAirports}
          aircraft={mockAircraftList}
          movements={mockMovements}
          selectedMovement={mockMovements[0]}
          selectedAircraftId="ac-1"
          liveTelemetry={liveTelemetry}
          ghostPositions={ghostPositions}
          onSelectMovement={vi.fn()}
        />,
      );

      expect(container.querySelector('[data-testid="airways-map"]')).toBeInTheDocument();
      expect(screen.getByText(/Airways Live Radar/i)).toBeInTheDocument();
      expect(screen.getByText(/Digital Twin/i)).toBeInTheDocument();
    });
  });

  describe('3. FlightMovementDetailsPanel & Phase 7B-2 Intelligence', () => {
    it('Renders ETA confidence badge, pilot safety score, DGCA FDTL compliance, and carbon footprint', async () => {
      render(
        <FlightMovementDetailsPanel
          movement={mockMovements[0]}
          liveTelemetry={{
            movementId: 'mov-1',
            flightId: 'flt-1',
            aircraftId: 'ac-1',
            pilotId: 'fc-1',
            flightNumber: 'NX-101',
            tailNumber: 'VT-NEX',
            aircraftType: 'Boeing 777F',
            pilotName: 'Capt. Rajesh Sharma',
            originAirportName: 'Mumbai International',
            destinationAirportName: 'Delhi International',
            lat: 23.5,
            lng: 75.0,
            altitudeFt: 34000,
            speedKts: 460,
            heading: 25,
            status: 'in_transit',
            progressPercent: 45,
            distanceKm: 1148,
            durationMinutes: 105,
            timestamp: new Date().toISOString(),
          }}
          onClose={vi.fn()}
          onRefresh={vi.fn()}
          userRole="manager"
        />,
      );

      expect(screen.getByText('NX-101')).toBeInTheDocument();
      expect(screen.getByText(/VT-NEX/i)).toBeInTheDocument();
      expect(screen.getByText('BOM')).toBeInTheDocument();
      expect(screen.getByText('DEL')).toBeInTheDocument();
      expect(screen.getByText('34,000 ft')).toBeInTheDocument();
      expect(screen.getByText('460 kts')).toBeInTheDocument();

      // Intelligence elements
      await waitFor(() => {
        expect(screen.getByText(/Estimated Flight Duration/i)).toBeInTheDocument();
        expect(screen.getByText(/Pilot Safety Score/i)).toBeInTheDocument();
        expect(screen.getByText(/DGCA FDTL Status/i)).toBeInTheDocument();
        expect(screen.getByText(/Air Freight Carbon Footprint/i)).toBeInTheDocument();
      });
    });

    it('Renders Download Flight Audit PDF button when movement is completed', async () => {
      const completedMovement: FlightMovement = {
        ...mockMovements[0],
        status: 'completed',
        completed_at: new Date().toISOString(),
      };

      render(
        <FlightMovementDetailsPanel
          movement={completedMovement}
          onClose={vi.fn()}
          onRefresh={vi.fn()}
          userRole="manager"
        />,
      );

      await waitFor(() => {
        expect(screen.getByTestId('flight-report-button')).toBeInTheDocument();
        expect(screen.getByText(/Download Flight Audit PDF/i)).toBeInTheDocument();
      });
    });
  });

  describe('4. CreateFlightMovementModal with Airport Slot Intelligence', () => {
    it('Checks airport slot capacity on airport selection and shows clear feedback', async () => {
      render(
        <CreateFlightMovementModal
          isOpen={true}
          onClose={vi.fn()}
          airports={mockAirports}
          aircraft={mockAircraftList}
          crew={mockFlightCrewList}
          flights={mockFlights}
          onMovementCreated={vi.fn()}
        />,
      );

      await waitFor(() => {
        expect(screen.getByTestId('slot-check-feedback')).toBeInTheDocument();
        expect(screen.getByText(/Airport Runway & Apron Slots Clear/i)).toBeInTheDocument();
      });
    });
  });

  describe('5. Flight Crew Cockpit Console View', () => {
    it('Renders Cockpit console when role is driver/pilot in airways mode', async () => {
      render(
        <MemoryRouter initialEntries={['/airways/driver']}>
          <Routes>
            <Route path="/:mode/driver" element={<DriverDashboard />} />
          </Routes>
        </MemoryRouter>,
      );

      expect(screen.getByText(/Flight Crew Cockpit Console/i)).toBeInTheDocument();
      expect(screen.getByText(/Capt. Rajesh Sharma/i)).toBeInTheDocument();
      expect(screen.getByText(/Nexus Air Global/i)).toBeInTheDocument();
    });
  });
});
