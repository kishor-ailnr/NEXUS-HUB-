import { Injectable, Logger } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { OsrmRouteGeometry } from '@nexus-ways/shared';

export interface RouteWaypoint {
  lat: number;
  lng: number;
  label?: string;
}

@Injectable()
export class RoutingService {
  private readonly logger = new Logger(RoutingService.name);

  constructor(private readonly supabase: SupabaseService) {}

  /**
   * Generates a cache key string from ordered waypoints rounded to 5 decimal places.
   */
  private generateCoordKey(waypoints: RouteWaypoint[]): string {
    return waypoints
      .map((w) => `${w.lng.toFixed(5)},${w.lat.toFixed(5)}`)
      .join(';');
  }

  /**
   * Calculate route distance and duration using haversine formula for straight-line fallback.
   */
  private calculateHaversineFallback(waypoints: RouteWaypoint[]): OsrmRouteGeometry {
    const coordinates: [number, number][] = [];
    let totalDistKm = 0;

    for (let i = 0; i < waypoints.length; i++) {
      const current = waypoints[i];
      coordinates.push([current.lng, current.lat]);

      if (i < waypoints.length - 1) {
        const next = waypoints[i + 1];
        // Generate intermediate interpolation points (e.g. 5 steps between waypoints)
        const steps = 10;
        for (let s = 1; s < steps; s++) {
          const frac = s / steps;
          const interpLng = current.lng + (next.lng - current.lng) * frac;
          const interpLat = current.lat + (next.lat - current.lat) * frac;
          coordinates.push([interpLng, interpLat]);
        }

        // Haversine distance
        const R = 6371; // Earth radius km
        const dLat = ((next.lat - current.lat) * Math.PI) / 180;
        const dLng = ((next.lng - current.lng) * Math.PI) / 180;
        const a =
          Math.sin(dLat / 2) * Math.sin(dLat / 2) +
          Math.cos((current.lat * Math.PI) / 180) *
            Math.cos((next.lat * Math.PI) / 180) *
            Math.sin(dLng / 2) *
            Math.sin(dLng / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        totalDistKm += R * c;
      }
    }

    // Assume average speed 60 km/h for straight line estimation
    const durationMinutes = (totalDistKm / 60) * 60;

    return {
      routing_source: 'fallback-straight-line',
      coordinates,
      distance_km: Math.round(totalDistKm * 100) / 100,
      duration_minutes: Math.round(durationMinutes),
    };
  }

  /**
   * Route calculation using OSRM with caching in saved_routes.
   */
  async getRoute(
    orgId: string,
    waypoints: RouteWaypoint[],
    originLabel?: string,
    destLabel?: string,
  ): Promise<OsrmRouteGeometry> {
    if (!waypoints || waypoints.length < 2) {
      throw new Error('At least origin and destination waypoints are required');
    }

    // 1. Check database cache in saved_routes if origin & destination labels are provided
    if (orgId && originLabel && destLabel) {
      try {
        const { data: cached } = await this.supabase.adminClient
          .from('saved_routes')
          .select('osrm_geometry, usage_count')
          .eq('org_id', orgId)
          .eq('origin_label', originLabel)
          .eq('destination_label', destLabel)
          .maybeSingle();

        if (cached && cached.osrm_geometry && Array.isArray(cached.osrm_geometry.coordinates)) {
          this.logger.log(`Using cached OSRM route for "${originLabel}" -> "${destLabel}"`);
          // Increment usage count asynchronously
          await this.supabase.adminClient
            .from('saved_routes')
            .update({
              usage_count: (cached.usage_count || 1) + 1,
              updated_at: new Date().toISOString(),
            })
            .eq('org_id', orgId)
            .eq('origin_label', originLabel)
            .eq('destination_label', destLabel);

          return cached.osrm_geometry as OsrmRouteGeometry;
        }
      } catch (err: any) {
        this.logger.warn(`Cache lookup failed for saved route: ${err.message}`);
      }
    }

    // 2. Call real OSRM demo server
    const coordString = waypoints
      .map((w) => `${w.lng.toFixed(5)},${w.lat.toFixed(5)}`)
      .join(';');

    const osrmUrl = `https://router.project-osrm.org/route/v1/driving/${coordString}?overview=full&geometries=geojson`;

    try {
      this.logger.log(`Calling OSRM server: ${osrmUrl}`);
      const response = await fetch(osrmUrl, {
        headers: {
          'User-Agent': 'NEXUS-WAYS-Platform/1.0',
        },
      });

      if (!response.ok) {
        this.logger.warn(`OSRM server returned status ${response.status}: ${response.statusText}`);
        return this.calculateHaversineFallback(waypoints);
      }

      const json = (await response.json()) as any;
      if (json.code !== 'Ok' || !json.routes || json.routes.length === 0) {
        this.logger.warn(`OSRM route calculation error: ${json.code || 'no routes'}`);
        return this.calculateHaversineFallback(waypoints);
      }

      const route = json.routes[0];
      const distanceKm = Math.round((route.distance / 1000) * 100) / 100;
      const durationMinutes = Math.round(route.duration / 60);

      const result: OsrmRouteGeometry = {
        routing_source: 'osrm',
        coordinates: route.geometry.coordinates as [number, number][],
        distance_km: distanceKm,
        duration_minutes: durationMinutes,
      };

      // 3. Cache the result in saved_routes if orgId & labels present
      if (orgId && originLabel && destLabel) {
        try {
          const intermediateCheckpoints = waypoints.slice(1, -1).map((w) => ({
            label: w.label || 'Checkpoint',
            lat: w.lat,
            lng: w.lng,
          }));

          await this.supabase.adminClient
            .from('saved_routes')
            .upsert(
              {
                org_id: orgId,
                origin_label: originLabel,
                destination_label: destLabel,
                checkpoints: intermediateCheckpoints,
                osrm_geometry: result,
                usage_count: 1,
                updated_at: new Date().toISOString(),
              },
              { onConflict: 'org_id,origin_label,destination_label' },
            );
        } catch (saveErr: any) {
          this.logger.warn(`Failed to save route cache to saved_routes: ${saveErr.message}`);
        }
      }

      return result;
    } catch (error: any) {
      this.logger.warn(`OSRM network error: ${error.message}. Using fallback straight-line.`);
      return this.calculateHaversineFallback(waypoints);
    }
  }
}
