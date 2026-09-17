import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TripDetailsPanel } from '../TripDetailsPanel';
import { AiAssistantWidget } from '../AiAssistantWidget';
import { tripsApi } from '../../services/trips';
import { driversApi } from '../../services/drivers';
import { aiApi } from '../../services/ai';
import { Trip, TripEtaResponse, DriverBehaviorScore } from '@nexus-ways/shared';

// Mock the API services
vi.mock('../../services/trips', () => ({
  tripsApi: {
    getTripEta: vi.fn(),
  },
}));

vi.mock('../../services/drivers', () => ({
  driversApi: {
    getBehaviorHistory: vi.fn(),
  },
}));

vi.mock('../../services/ai', () => ({
  aiApi: {
    chat: vi.fn(),
    confirmAction: vi.fn(),
  },
}));

describe('Phase 5 Frontend Components', () => {
  const mockTrip: Trip = {
    id: 'trip-test-12345',
    org_id: 'org-1',
    vehicle_id: 'veh-1',
    driver_id: 'drv-1',
    origin_lat: 19.076,
    origin_lng: 72.8777,
    destination_lat: 18.5204,
    destination_lng: 73.8567,
    origin_label: 'Mumbai Port',
    destination_label: 'Pune Hub',
    distance_km: 150,
    duration_minutes: 180,
    simulation_speed_multiplier: 1,
    status: 'in_transit',
    carbon_kg: 258.8,
    toll_estimate_inr: 817.5,
    created_at: '2026-09-06T00:00:00Z',
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('TripDetailsPanel', () => {
    it('displays historical confidence band badge when confidence_basis is historical', async () => {
      const historicalEta: TripEtaResponse = {
        trip_id: 'trip-test-12345',
        remaining_distance_km: 120,
        base_eta_minutes: 180,
        min_eta_minutes: 165,
        max_eta_minutes: 195,
        confidence_band_minutes: 15,
        confidence_basis: 'historical',
        sample_size: 12,
        calculated_at: '2026-09-06T00:00:00Z',
      };

      vi.mocked(tripsApi.getTripEta).mockResolvedValue(historicalEta);
      vi.mocked(driversApi.getBehaviorHistory).mockResolvedValue([
        {
          id: 'score-1',
          trip_id: 'trip-test-12345',
          driver_id: 'drv-1',
          score: 85,
          harsh_brake_count: 1,
          speeding_event_count: 1,
          computed_at: '2026-09-06T00:00:00Z',
        } as DriverBehaviorScore,
      ]);

      render(<TripDetailsPanel trip={mockTrip} onClose={vi.fn()} />);

      await waitFor(() => {
        expect(screen.getByTestId('confidence-basis-badge')).toBeInTheDocument();
      });

      expect(screen.getByText('based on 12 prior trips on this route')).toBeInTheDocument();
      expect(screen.getByText('165 – 195 min')).toBeInTheDocument();
      expect(screen.getByText('85')).toBeInTheDocument();
      expect(screen.getByText('Harsh Brakes: 1')).toBeInTheDocument();
      expect(screen.getByText('Speeding Events: 1')).toBeInTheDocument();
      expect(screen.getByText('258.8 kg')).toBeInTheDocument();
      expect(screen.getByText('₹818')).toBeInTheDocument();
    });

    it('displays default estimate badge when confidence_basis is default with 0 history', async () => {
      const defaultEta: TripEtaResponse = {
        trip_id: 'trip-test-12345',
        remaining_distance_km: 150,
        base_eta_minutes: 180,
        min_eta_minutes: 153,
        max_eta_minutes: 207,
        confidence_band_minutes: 27,
        confidence_basis: 'default',
        sample_size: 0,
        calculated_at: '2026-09-06T00:00:00Z',
      };

      vi.mocked(tripsApi.getTripEta).mockResolvedValue(defaultEta);
      vi.mocked(driversApi.getBehaviorHistory).mockResolvedValue([]);

      render(<TripDetailsPanel trip={mockTrip} onClose={vi.fn()} />);

      await waitFor(() => {
        expect(screen.getByTestId('confidence-basis-badge')).toBeInTheDocument();
      });

      expect(screen.getByText('default estimate — no route history yet')).toBeInTheDocument();
      expect(screen.getByText('153 – 207 min')).toBeInTheDocument();
    });
  });

  describe('AiAssistantWidget', () => {
    it('opens chat window, sends user message, renders tool calls, and handles proposed action with Apply/Reject buttons', async () => {
      vi.mocked(aiApi.chat).mockResolvedValue({
        id: 'msg-resp-1',
        role: 'assistant',
        content: 'I found unacknowledged alert #alert-99. Should I acknowledge it for you?',
        createdAt: '2026-09-06T00:00:00Z',
        toolCalls: [
          {
            name: 'list_unacknowledged_alerts',
            args: {},
            result: [{ id: 'alert-99', title: 'Harsh braking detected' }],
          },
        ],
        proposedAction: {
          id: 'action-99',
          actionType: 'acknowledge_alert',
          description: 'Acknowledge alert #alert-99',
          payload: { alertId: 'alert-99' },
          status: 'pending',
        },
      });

      vi.mocked(aiApi.confirmAction).mockResolvedValue({
        success: true,
        message: 'Successfully acknowledged alert #alert-99',
      });

      render(<AiAssistantWidget />);

      // 1. Click floating trigger
      const triggerBtn = screen.getByLabelText('Open AI Assistant');
      fireEvent.click(triggerBtn);

      // 2. Chat window should open
      expect(screen.getByText('Operations Copilot')).toBeInTheDocument();

      // 3. Type message and send
      const input = screen.getByPlaceholderText('Ask assistant or request fleet action...');
      fireEvent.change(input, { target: { value: 'Show active alerts' } });
      fireEvent.submit(screen.getByLabelText('Send message'));

      // 4. Assert tool call badge and assistant message
      await waitFor(() => {
        expect(screen.getByText('list_unacknowledged_alerts()')).toBeInTheDocument();
        expect(screen.getByTestId('proposed-action-card')).toBeInTheDocument();
      });

      expect(screen.getByTestId('apply-action-btn')).toBeInTheDocument();
      expect(screen.getByTestId('reject-action-btn')).toBeInTheDocument();

      // 5. Click Apply action button
      fireEvent.click(screen.getByTestId('apply-action-btn'));

      await waitFor(() => {
        expect(aiApi.confirmAction).toHaveBeenCalledWith({
          actionId: 'action-99',
          actionType: 'acknowledge_alert',
          payload: { alertId: 'alert-99' },
          confirmed: true,
        });
      });

      expect(screen.getByText('Successfully acknowledged alert #alert-99')).toBeInTheDocument();
    });
  });
});
