import { Injectable, Logger } from '@nestjs/common';
import { Airport } from '@nexus-ways/shared';

export interface AirRouteGeometry {
  distance_km: number;
  duration_minutes: number;
  initial_bearing: number;
  routing_method: 'great-circle';
  coordinates: [number, number][]; // [lng, lat]
}

/**
 * Earth radius in kilometers (WGS-84 mean radius)
 */
const EARTH_RADIUS_KM = 6371;

@Injectable()
export class AirRoutingService {
  private readonly logger = new Logger(AirRoutingService.name);

  /**
   * Calculates the Great-Circle distance in kilometers between two coordinates using the Haversine formula.
   */
  calculateGreatCircleDistance(
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number,
  ): number {
    const toRad = (deg: number) => (deg * Math.PI) / 180;
    const phi1 = toRad(lat1);
    const phi2 = toRad(lat2);
    const deltaPhi = toRad(lat2 - lat1);
    const deltaLambda = toRad(lon2 - lon1);

    const a =
      Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
      Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distance = EARTH_RADIUS_KM * c;

    return Math.round(distance * 100) / 100;
  }

  /**
   * Calculates the initial forward bearing (in degrees, 0..360) from point 1 to point 2.
   */
  calculateInitialBearing(
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number,
  ): number {
    const toRad = (deg: number) => (deg * Math.PI) / 180;
    const toDeg = (rad: number) => (rad * 180) / Math.PI;

    const phi1 = toRad(lat1);
    const phi2 = toRad(lat2);
    const deltaLambda = toRad(lon2 - lon1);

    const y = Math.sin(deltaLambda) * Math.cos(phi2);
    const x =
      Math.cos(phi1) * Math.sin(phi2) -
      Math.sin(phi1) * Math.cos(phi2) * Math.cos(deltaLambda);

    const bearing = (toDeg(Math.atan2(y, x)) + 360) % 360;
    return Math.round(bearing * 10) / 10;
  }

  /**
   * Interpolates waypoints along the Great-Circle arc between two points using spherical interpolation.
   * Returns an array of [lng, lat] tuples suitable for GeoJSON / Leaflet Polyline rendering and flight simulation.
   */
  interpolateGreatCircleArc(
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number,
    numPoints = 60,
  ): [number, number][] {
    const toRad = (deg: number) => (deg * Math.PI) / 180;
    const toDeg = (rad: number) => (rad * 180) / Math.PI;

    const phi1 = toRad(lat1);
    const lambda1 = toRad(lon1);
    const phi2 = toRad(lat2);
    const lambda2 = toRad(lon2);

    // Angular distance in radians
    const deltaLambda = lambda2 - lambda1;
    const deltaPhi = phi2 - phi1;
    const a =
      Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
      Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
    const d = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    if (d < 1e-6 || numPoints <= 1) {
      return [
        [lon1, lat1],
        [lon2, lat2],
      ];
    }

    const points: [number, number][] = [];
    const stepCount = Math.max(10, numPoints);

    for (let i = 0; i <= stepCount; i++) {
      const f = i / stepCount;
      const A = Math.sin((1 - f) * d) / Math.sin(d);
      const B = Math.sin(f * d) / Math.sin(d);

      const x = A * Math.cos(phi1) * Math.cos(lambda1) + B * Math.cos(phi2) * Math.cos(lambda2);
      const y = A * Math.cos(phi1) * Math.sin(lambda1) + B * Math.cos(phi2) * Math.sin(lambda2);
      const z = A * Math.sin(phi1) + B * Math.sin(phi2);

      const lat = toDeg(Math.atan2(z, Math.sqrt(x * x + y * y)));
      const lon = toDeg(Math.atan2(y, x));

      points.push([Math.round(lon * 1e5) / 1e5, Math.round(lat * 1e5) / 1e5]);
    }

    return points;
  }

  /**
   * Computes the full great-circle route geometry, initial bearing, distance, and flight duration
   * for a flight between origin and destination airports.
   */
  computeFlightRoute(
    origin: { lat: number; lng: number; name?: string },
    destination: { lat: number; lng: number; name?: string },
  ): AirRouteGeometry {
    const lat1 = origin.lat;
    const lon1 = origin.lng;
    const lat2 = destination.lat;
    const lon2 = destination.lng;

    const distanceKm = this.calculateGreatCircleDistance(lat1, lon1, lat2, lon2);
    const initialBearing = this.calculateInitialBearing(lat1, lon1, lat2, lon2);

    // Number of waypoints scales with distance (at least 30, up to 100)
    const numPoints = Math.min(100, Math.max(30, Math.round(distanceKm / 25)));
    const coordinates = this.interpolateGreatCircleArc(lat1, lon1, lat2, lon2, numPoints);

    // Commercial cargo jet average cruise ~800 km/h (approx 430-450 kts) + 25 min for takeoff/climb/approach
    const durationMinutes = Math.max(20, Math.round((distanceKm / 800) * 60 + 25));

    this.logger.log(
      `Computed Great-Circle route: ${origin.name || 'Origin'} -> ${destination.name || 'Destination'} ` +
        `| Distance: ${distanceKm} km | Duration: ${durationMinutes} min | Initial Bearing: ${initialBearing}°`,
    );

    return {
      distance_km: distanceKm,
      duration_minutes: durationMinutes,
      initial_bearing: initialBearing,
      routing_method: 'great-circle',
      coordinates,
    };
  }
}
