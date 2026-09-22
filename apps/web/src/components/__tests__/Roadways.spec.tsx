import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { VehicleSidebar } from '../VehicleSidebar';
import { RoadwaysMap } from '../RoadwaysMap';
import { DriverDashboard } from '../../pages/DriverDashboard';
import { Vehicle, Driver, Trip, Geofence } from '@nexus-ways/shared';

// Mock Leaflet
vi.mock('leaflet', () => {
  const mapMock = {
    setView: vi.fn().mockReturnThis(),
    fitBounds: vi.fn().mockReturnThis(),
    getZoom: vi.fn().mockReturnValue(12),
    remove: vi.fn(),
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
      circle: vi.fn(() => ({ bindTooltip: vi.fn() })),
      polyline: vi.fn(() => ({ bindTooltip: vi.fn() })),
      circleMarker: vi.fn(() => ({ bindTooltip: vi.fn() })),
      marker: vi.fn(() => markerMock),
      divIcon: vi.fn(() => ({})),
      latLngBounds: vi.fn(() => ({ extend: vi.fn(), isValid: vi.fn(() => true) })),
    },
  };
});

// Mock AuthStore
vi.mock('../../store/authStore', () => ({
  useAuthStore: () => ({
    user: {
      id: 'driver-user-1',
      email: 'driver@roadways.com',
      fullName: 'Vikram Patel',
      role: 'driver',
      orgId: 'org-1',
      organization: { id: 'org-1', name: 'Nexus Roadways', mode: 'roadways' },
    },
    logout: vi.fn(),
  }),
}));

// Mock services
vi.mock('../../services/drivers', () => ({
  driversService: {
    getDrivers: vi.fn().mockResolvedValue([]),
    createDriver: vi.fn().mockImplementation((dto) =>
      Promise.resolve({
        id: 'd-new-99',
        org_id: 'org-1',
        user_id: 'u-new-99',
        license_number: dto.licenseNumber,
        phone: dto.phone,
        status: 'available',
        created_at: new Date().toISOString(),
        user: { id: 'u-new-99', email: dto.email, full_name: dto.fullName },
      }),
    ),
  },
}));

vi.mock('../../services/vehicles', () => ({
  vehiclesService: {
    getVehicles: vi.fn().mockResolvedValue([
      {
        id: 'v-1',
        org_id: 'org-1',
        registration_number: 'MH-12-AB-9988',
        vehicle_type: 'Heavy Truck',
        status: 'active',
        assigned_driver_id: 'driver-user-1',
        created_at: new Date().toISOString(),
        latest_gps: {
          id: 'gps-1',
          trip_id: 'trip-1',
          vehicle_id: 'v-1',
          lat: 19.076,
          lng: 72.8777,
          speed_kmh: 62,
          recorded_at: new Date().toISOString(),
        },
      },
    ]),
  },
}));

vi.mock('../../services/trips', () => ({
  tripsService: {
    getTrips: vi.fn().mockResolvedValue([
      {
        id: 'trip-1',
        org_id: 'org-1',
        vehicle_id: 'v-1',
        driver_id: 'driver-user-1',
        origin_label: 'Mumbai Hub',
        destination_label: 'Pune Warehouse',
        status: 'in_transit',
        distance_km: 152,
        duration_minutes: 180,
        simulation_speed_multiplier: 60,
        created_at: new Date().toISOString(),
      },
    ]),
  },
}));

describe('Roadways Operational Components', () => {
  const mockVehicles: Vehicle[] = [
    {
      id: 'v-1',
      org_id: 'org-1',
      registration_number: 'MH-12-AB-1234',
      vehicle_type: 'Heavy Truck',
      status: 'active',
      created_at: new Date().toISOString(),
      latest_gps: {
        id: 'g-1',
        trip_id: 't-1',
        vehicle_id: 'v-1',
        lat: 19.076,
        lng: 72.8777,
        speed_kmh: 58,
        recorded_at: new Date().toISOString(),
      },
    },
    {
      id: 'v-2',
      org_id: 'org-1',
      registration_number: 'KA-01-CD-5678',
      vehicle_type: 'Medium LCV',
      status: 'idle',
      created_at: new Date().toISOString(),
    },
  ];

  const mockDrivers: Driver[] = [
    {
      id: 'd-1',
      org_id: 'org-1',
      user_id: 'u-1',
      license_number: 'MH-14-2023-001',
      status: 'available',
      created_at: new Date().toISOString(),
      user: { id: 'u-1', email: 'd1@roadways.com', full_name: 'Harpreet Singh' },
    },
  ];

  describe('<VehicleSidebar />', () => {
    it('renders list of vehicles and filters by search term', () => {
      render(
        <MemoryRouter>
          <VehicleSidebar
            vehicles={mockVehicles}
            drivers={mockDrivers}
            onSelectVehicle={vi.fn()}
            onVehicleCreated={vi.fn()}
            onCreateTrip={vi.fn()}
            currentUserRole="manager"
          />
        </MemoryRouter>,
      );

      expect(screen.getByText('MH-12-AB-1234')).toBeInTheDocument();
      expect(screen.getByText('KA-01-CD-5678')).toBeInTheDocument();

      // Search
      const searchInput = screen.getByTestId('vehicle-search-input');
      fireEvent.change(searchInput, { target: { value: '1234' } });

      expect(screen.getByText('MH-12-AB-1234')).toBeInTheDocument();
      expect(screen.queryByText('KA-01-CD-5678')).not.toBeInTheDocument();
    });

    it('renders Add Vehicle button for managers and opens modal', () => {
      render(
        <MemoryRouter>
          <VehicleSidebar
            vehicles={mockVehicles}
            drivers={mockDrivers}
            onSelectVehicle={vi.fn()}
            onVehicleCreated={vi.fn()}
            onCreateTrip={vi.fn()}
            currentUserRole="manager"
          />
        </MemoryRouter>,
      );

      const addBtn = screen.getByTestId('add-vehicle-button');
      expect(addBtn).toBeInTheDocument();
      fireEvent.click(addBtn);

      expect(screen.getByText('Add Vehicle to Fleet')).toBeInTheDocument();
      expect(screen.getByTestId('registration-input')).toBeInTheDocument();
    });

    it('renders Add Driver button for managers, submits valid driver data, and calls createDriver with correct payload', async () => {
      const { driversService } = await import('../../services/drivers');
      const onDriverCreated = vi.fn();

      render(
        <MemoryRouter>
          <VehicleSidebar
            vehicles={mockVehicles}
            drivers={mockDrivers}
            onSelectVehicle={vi.fn()}
            onVehicleCreated={vi.fn()}
            onDriverCreated={onDriverCreated}
            onCreateTrip={vi.fn()}
            currentUserRole="manager"
          />
        </MemoryRouter>,
      );

      const addDriverBtn = screen.getByTestId('add-driver-button');
      expect(addDriverBtn).toBeInTheDocument();
      fireEvent.click(addDriverBtn);

      expect(screen.getByText('Register Fleet Driver')).toBeInTheDocument();

      fireEvent.change(screen.getByTestId('driver-name-input'), { target: { value: 'Suresh Raina' } });
      fireEvent.change(screen.getByTestId('driver-email-input'), { target: { value: 'suresh@nexusways.com' } });
      fireEvent.change(screen.getByTestId('driver-license-input'), { target: { value: 'DL-04-2024-9988' } });
      fireEvent.change(screen.getByTestId('driver-phone-input'), { target: { value: '+91 98111 22233' } });
      fireEvent.change(screen.getByTestId('driver-password-input'), { target: { value: 'Raina@Nexus123' } });

      fireEvent.click(screen.getByTestId('submit-driver-button'));

      await waitFor(() => {
        expect(driversService.createDriver).toHaveBeenCalledWith({
          fullName: 'Suresh Raina',
          email: 'suresh@nexusways.com',
          licenseNumber: 'DL-04-2024-9988',
          phone: '+91 98111 22233',
          password: 'Raina@Nexus123',
        });
      });
    });

    it('immediately reflects new driver in Add Vehicle driver assignment dropdown without reload', () => {
      const updatedDrivers: Driver[] = [
        ...mockDrivers,
        {
          id: 'd-new-99',
          org_id: 'org-1',
          user_id: 'u-new-99',
          license_number: 'HR-26-2024-7711',
          phone: '+91 98111 22233',
          status: 'available',
          created_at: new Date().toISOString(),
          user: { id: 'u-new-99', email: 'karan@nexusways.com', full_name: 'Karan Mehra' },
        },
      ];

      render(
        <MemoryRouter>
          <VehicleSidebar
            vehicles={mockVehicles}
            drivers={updatedDrivers}
            onSelectVehicle={vi.fn()}
            onVehicleCreated={vi.fn()}
            onCreateTrip={vi.fn()}
            currentUserRole="manager"
          />
        </MemoryRouter>,
      );

      // Open Add Vehicle modal and verify driver appears in dropdown
      fireEvent.click(screen.getByTestId('add-vehicle-button'));
      expect(screen.getByText(/Karan Mehra \(HR-26-2024-7711\)/i)).toBeInTheDocument();
    });

    it('guards Add Driver and Add Vehicle buttons: driver-role user cannot see them', () => {
      render(
        <MemoryRouter>
          <VehicleSidebar
            vehicles={mockVehicles}
            drivers={mockDrivers}
            onSelectVehicle={vi.fn()}
            onVehicleCreated={vi.fn()}
            onCreateTrip={vi.fn()}
            currentUserRole="driver"
          />
        </MemoryRouter>,
      );

      expect(screen.queryByTestId('add-driver-button')).not.toBeInTheDocument();
      expect(screen.queryByTestId('add-vehicle-button')).not.toBeInTheDocument();
    });
  });

  describe('<RoadwaysMap />', () => {
    it('renders live simulation badge and map container', () => {
      render(
        <RoadwaysMap
          vehicles={mockVehicles}
          activeTrips={[]}
          geofences={[]}
        />,
      );

      expect(screen.getByTestId('roadways-live-map')).toBeInTheDocument();
      expect(screen.getByText('Roadways Live Simulation')).toBeInTheDocument();
      expect(screen.getByText('OSRM + Telemetry')).toBeInTheDocument();
    });
  });

  describe('<DriverDashboard />', () => {
    it('renders simplified read-only console for driver-role user', async () => {
      render(
        <MemoryRouter>
          <DriverDashboard />
        </MemoryRouter>,
      );

      expect(screen.getByTestId('driver-dashboard')).toBeInTheDocument();
      expect(screen.getByText(/NEXUS WAYS • Driver Console/i)).toBeInTheDocument();
      expect(screen.getByText('Assigned Commercial Unit')).toBeInTheDocument();
    });
  });
});
