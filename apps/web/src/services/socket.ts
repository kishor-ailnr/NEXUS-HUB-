import { io, Socket } from 'socket.io-client';
import { supabase } from '../lib/supabase';
import { getValidAuthToken } from '../lib/api';
import {
  NotificationItem,
  GhostPositionPayload,
  LiveFlightTelemetryPayload,
  LiveVesselTelemetryPayload,
} from '@nexus-ways/shared';

export type { LiveFlightTelemetryPayload, LiveVesselTelemetryPayload };

let socket: Socket | null = null;

export interface LiveGpsPayload {
  tripId: string;
  vehicleId: string;
  driverId: string;
  lat: number;
  lng: number;
  speed_kmh: number;
  heading?: number;
  recorded_at: string;
  progressPercent?: number;
  originLabel?: string;
  destinationLabel?: string;
}

export interface LiveTripStatusPayload {
  tripId: string;
  vehicleId: string;
  driverId: string;
  status: string;
  startedAt?: string;
  completedAt?: string;
}

export interface LiveGeofencePayload {
  tripId: string;
  vehicleId: string;
  geofenceId: string;
  geofenceName: string;
  eventType: 'enter' | 'exit';
  occurredAt: string;
}

export interface LiveRailTelemetryPayload {
  movementId: string;
  trainId: string;
  lat: number;
  lng: number;
  speedKmh?: number;
  heading?: number;
  progressPercent?: number;
  recordedAt?: string;
  speed_kmh?: number;
  recorded_at?: string;
  trainNumber?: string;
  trainName?: string;
  simulated?: boolean;
}

export interface LiveRailMovementCompletedPayload {
  movementId: string;
  trainId: string;
  completedAt: string;
}

export interface LiveFlightCompletedPayload {
  movementId: string;
  flightId: string;
  flightNumber: string;
  tailNumber: string;
  completedAt: string;
}

export interface LiveVesselCompletedPayload {
  movementId: string;
  vesselId: string;
  voyageNumber: string;
  completedAt: string;
}

export const socketService = {
  connect(
    onNotification?: (notification: NotificationItem) => void,
    onStatusChange?: (connected: boolean) => void,
    onGpsUpdate?: (gps: LiveGpsPayload) => void,
    onTripStatus?: (status: LiveTripStatusPayload) => void,
    onGeofenceEvent?: (event: LiveGeofencePayload) => void,
    onGhostPosition?: (ghost: GhostPositionPayload) => void,
  ): Socket {
    if (socket && socket.connected) {
      if (onNotification) socket.off('notification:new').on('notification:new', onNotification);
      if (onGpsUpdate) socket.off('tracking:gps').on('tracking:gps', onGpsUpdate);
      if (onTripStatus) socket.off('tracking:trip_status').on('tracking:trip_status', onTripStatus);
      if (onGeofenceEvent) socket.off('tracking:geofence_event').on('tracking:geofence_event', onGeofenceEvent);
      if (onGhostPosition) socket.off('tracking:ghost_position').on('tracking:ghost_position', onGhostPosition);
      return socket;
    }

    const socketBase = (
      import.meta.env.VITE_SOCKET_URL ||
      import.meta.env.VITE_API_URL ||
      import.meta.env.VITE_API_BASE_URL ||
      ''
    ).replace(/\/$/, '');
    const socketTarget = socketBase ? `${socketBase}/realtime` : '/realtime';

    socket = io(socketTarget, {
      path: '/socket.io',
      withCredentials: true,
      transports: ['websocket', 'polling'],
      reconnectionAttempts: 5,
      reconnectionDelay: 2000,
      auth: async (cb: (data: { token?: string }) => void) => {
        try {
          const token = await getValidAuthToken();
          cb({ token: token || undefined });
        } catch {
          cb({});
        }
      },
    });

    socket.on('connect', () => {
      if (onStatusChange) onStatusChange(true);
    });

    socket.on('disconnect', () => {
      if (onStatusChange) onStatusChange(false);
    });

    socket.on('connect_error', () => {
      if (onStatusChange) onStatusChange(false);
    });

    if (onNotification) {
      socket.on('notification:new', (notif: NotificationItem) => {
        onNotification(notif);
      });
    }

    if (onGpsUpdate) {
      socket.on('tracking:gps', (gps: LiveGpsPayload) => {
        onGpsUpdate(gps);
      });
    }

    if (onTripStatus) {
      socket.on('tracking:trip_status', (status: LiveTripStatusPayload) => {
        onTripStatus(status);
      });
    }

    if (onGeofenceEvent) {
      socket.on('tracking:geofence_event', (event: LiveGeofencePayload) => {
        onGeofenceEvent(event);
      });
    }

    if (onGhostPosition) {
      socket.on('tracking:ghost_position', (ghost: GhostPositionPayload) => {
        onGhostPosition(ghost);
      });
    }

    return socket;
  },

  onGps(callback: (gps: LiveGpsPayload) => void) {
    if (socket) {
      socket.on('tracking:gps', callback);
    }
  },

  offGps(callback: (gps: LiveGpsPayload) => void) {
    if (socket) {
      socket.off('tracking:gps', callback);
    }
  },

  onGhost(callback: (ghost: GhostPositionPayload) => void) {
    if (socket) {
      socket.on('tracking:ghost_position', callback);
    }
  },

  offGhost(callback: (ghost: GhostPositionPayload) => void) {
    if (socket) {
      socket.off('tracking:ghost_position', callback);
    }
  },

  onTripStatusChange(callback: (status: LiveTripStatusPayload) => void) {
    if (socket) {
      socket.on('tracking:trip_status', callback);
    }
  },

  offTripStatusChange(callback: (status: LiveTripStatusPayload) => void) {
    if (socket) {
      socket.off('tracking:trip_status', callback);
    }
  },

  onRailTelemetry(callback: (telemetry: LiveRailTelemetryPayload) => void) {
    if (socket) {
      socket.on('railways:telemetry', callback);
    }
  },

  offRailTelemetry(callback: (telemetry: LiveRailTelemetryPayload) => void) {
    if (socket) {
      socket.off('railways:telemetry', callback);
    }
  },

  onRailCompleted(callback: (completed: LiveRailMovementCompletedPayload) => void) {
    if (socket) {
      socket.on('railways:movement_completed', callback);
    }
  },

  offRailCompleted(callback: (completed: LiveRailMovementCompletedPayload) => void) {
    if (socket) {
      socket.off('railways:movement_completed', callback);
    }
  },

  onFlightTelemetry(callback: (telemetry: LiveFlightTelemetryPayload) => void) {
    if (socket) {
      socket.on('airways:telemetry', callback);
    }
  },

  offFlightTelemetry(callback: (telemetry: LiveFlightTelemetryPayload) => void) {
    if (socket) {
      socket.off('airways:telemetry', callback);
    }
  },

  onFlightCompleted(callback: (completed: LiveFlightCompletedPayload) => void) {
    if (socket) {
      socket.on('airways:flight_completed', callback);
    }
  },

  offFlightCompleted(callback: (completed: LiveFlightCompletedPayload) => void) {
    if (socket) {
      socket.off('airways:flight_completed', callback);
    }
  },

  onSeaTelemetry(callback: (telemetry: LiveVesselTelemetryPayload) => void) {
    if (socket) {
      socket.on('seaways:telemetry', callback);
    }
  },

  offSeaTelemetry(callback: (telemetry: LiveVesselTelemetryPayload) => void) {
    if (socket) {
      socket.off('seaways:telemetry', callback);
    }
  },

  onSeaCompleted(callback: (completed: LiveVesselCompletedPayload) => void) {
    if (socket) {
      socket.on('seaways:completed', callback);
      socket.on('seaways:voyage_completed', callback);
    }
  },

  offSeaCompleted(callback: (completed: LiveVesselCompletedPayload) => void) {
    if (socket) {
      socket.off('seaways:completed', callback);
      socket.off('seaways:voyage_completed', callback);
    }
  },

  onSeaGhost(callback: (ghost: GhostPositionPayload) => void) {
    if (socket) {
      socket.on('seaways:ghost_position', callback);
    }
  },

  offSeaGhost(callback: (ghost: GhostPositionPayload) => void) {
    if (socket) {
      socket.off('seaways:ghost_position', callback);
    }
  },

  disconnect() {
    if (socket) {
      socket.disconnect();
      socket = null;
    }
  },

  isConnected(): boolean {
    return !!socket && socket.connected;
  },
};




