import { Injectable, Logger } from '@nestjs/common';
import { SupabaseService } from '../../supabase/supabase.service';
import { Port, SeaRoutingSource, SavedSeaRoute } from '@nexus-ways/shared';

export interface SeaRouteGeometry {
  type: string;
  coordinates: [number, number][]; // [lng, lat]
  distance_km: number;
  duration_minutes: number;
  routing_source: SeaRoutingSource;
}

export interface MarineWayPoint {
  id: string;
  name: string;
  lat: number;
  lng: number;
  neighbors: string[]; // Connected waypoint IDs in open water
}

export function haversineDistKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Precomputed marine-traffic navigation graph covering Indian coastal waters,
 * Arabian Sea, Laccadive Sea, Bay of Bengal, Sri Lanka maritime passages,
 * Gulf of Aden / Red Sea, Persian Gulf, and Malacca Strait.
 *
 * All coordinates are strictly in open waters, ensuring zero land crossing
 * across the Indian peninsula and other coastlines.
 */
export const MARINE_NETWORK: MarineWayPoint[] = [
  // --- North Arabian Sea & Gulf of Kutch / Gujarat ---
  { id: 'kandla_app', name: 'Kandla Approach', lat: 22.85, lng: 69.95, neighbors: ['gulf_kutch_mid', 'mundra_offshore'] },
  { id: 'mundra_offshore', name: 'Mundra Offshore', lat: 22.60, lng: 69.60, neighbors: ['kandla_app', 'gulf_kutch_mid', 'kutch_exit'] },
  { id: 'gulf_kutch_mid', name: 'Gulf of Kutch Channel', lat: 22.50, lng: 69.10, neighbors: ['kandla_app', 'mundra_offshore', 'kutch_exit'] },
  { id: 'kutch_exit', name: 'Gulf of Kutch Ocean Exit', lat: 22.40, lng: 68.70, neighbors: ['gulf_kutch_mid', 'mundra_offshore', 'dwarka_offshore', 'arabian_sea_nw'] },
  { id: 'dwarka_offshore', name: 'Dwarka Offshore', lat: 21.80, lng: 68.70, neighbors: ['kutch_exit', 'porbandar_offshore'] },
  { id: 'porbandar_offshore', name: 'Porbandar Offshore', lat: 21.40, lng: 69.20, neighbors: ['dwarka_offshore', 'veraval_offshore'] },
  { id: 'veraval_offshore', name: 'Veraval / Somnath Offshore', lat: 20.60, lng: 70.10, neighbors: ['porbandar_offshore', 'diu_head'] },
  { id: 'diu_head', name: 'Diu Head Passage', lat: 20.40, lng: 71.00, neighbors: ['veraval_offshore', 'gulf_khambhat_entry', 'mumbai_nw_lane'] },
  { id: 'gulf_khambhat_entry', name: 'Gulf of Khambhat Entry', lat: 20.80, lng: 71.80, neighbors: ['diu_head', 'dahej_app', 'hazira_app'] },
  { id: 'dahej_app', name: 'Dahej Approach', lat: 21.65, lng: 72.45, neighbors: ['gulf_khambhat_entry', 'hazira_app'] },
  { id: 'hazira_app', name: 'Hazira / Surat Approach', lat: 21.05, lng: 72.60, neighbors: ['gulf_khambhat_entry', 'dahej_app', 'mumbai_approach'] },

  // --- West Coast India (Konkan, Goa, Kanara, Malabar) ---
  { id: 'mumbai_nw_lane', name: 'Mumbai NW Shipping Lane', lat: 19.50, lng: 71.80, neighbors: ['diu_head', 'mumbai_approach', 'arabian_sea_mid'] },
  { id: 'mumbai_approach', name: 'Mumbai / JNPT Outer Anchorage', lat: 18.90, lng: 72.70, neighbors: ['hazira_app', 'mumbai_nw_lane', 'mumbai_pilot_station', 'mumbai_south_lane'] },
  { id: 'mumbai_pilot_station', name: 'Mumbai Harbor Fairway', lat: 18.94, lng: 72.82, neighbors: ['mumbai_approach'] },
  { id: 'mumbai_south_lane', name: 'Mumbai South Coastal Passage', lat: 18.00, lng: 72.50, neighbors: ['mumbai_approach', 'ratnagiri_offshore'] },
  { id: 'ratnagiri_offshore', name: 'Ratnagiri Offshore', lat: 16.90, lng: 72.70, neighbors: ['mumbai_south_lane', 'goa_north_lane'] },
  { id: 'goa_north_lane', name: 'Goa North Sea Lane', lat: 15.80, lng: 73.20, neighbors: ['ratnagiri_offshore', 'mormugao_approach', 'goa_south_lane'] },
  { id: 'mormugao_approach', name: 'Mormugao / Goa Harbor Approach', lat: 15.42, lng: 73.72, neighbors: ['goa_north_lane', 'goa_south_lane'] },
  { id: 'goa_south_lane', name: 'Goa South Sea Lane', lat: 14.80, lng: 73.70, neighbors: ['goa_north_lane', 'mormugao_approach', 'karwar_offshore', 'mangalore_north_lane'] },
  { id: 'karwar_offshore', name: 'Karwar Offshore', lat: 14.70, lng: 74.00, neighbors: ['goa_south_lane', 'mangalore_north_lane'] },
  { id: 'mangalore_north_lane', name: 'New Mangalore Sea Lane', lat: 13.40, lng: 74.30, neighbors: ['goa_south_lane', 'karwar_offshore', 'mangalore_approach', 'mangalore_south_lane'] },
  { id: 'mangalore_approach', name: 'New Mangalore Port Approach', lat: 12.92, lng: 74.75, neighbors: ['mangalore_north_lane', 'mangalore_south_lane'] },
  { id: 'mangalore_south_lane', name: 'Mangalore South Sea Lane', lat: 12.20, lng: 74.60, neighbors: ['mangalore_north_lane', 'mangalore_approach', 'kannur_offshore', 'kochi_north_lane'] },
  { id: 'kannur_offshore', name: 'Kannur / Kozhikode Offshore', lat: 11.40, lng: 75.10, neighbors: ['mangalore_south_lane', 'kochi_north_lane'] },
  { id: 'kochi_north_lane', name: 'Kochi North Sea Lane', lat: 10.40, lng: 75.60, neighbors: ['mangalore_south_lane', 'kannur_offshore', 'cochin_approach', 'kochi_south_lane'] },
  { id: 'cochin_approach', name: 'Cochin / Kochi Fairway Buoy', lat: 9.96, lng: 76.18, neighbors: ['kochi_north_lane', 'kochi_south_lane'] },
  { id: 'kochi_south_lane', name: 'Kochi South Sea Lane', lat: 9.20, lng: 76.00, neighbors: ['kochi_north_lane', 'cochin_approach', 'kollam_offshore', 'cape_comorin_nw'] },
  { id: 'kollam_offshore', name: 'Kollam Offshore', lat: 8.80, lng: 76.25, neighbors: ['kochi_south_lane', 'vizhinjam_offshore'] },
  { id: 'vizhinjam_offshore', name: 'Vizhinjam / Trivandrum Offshore', lat: 8.35, lng: 76.85, neighbors: ['kollam_offshore', 'cape_comorin_nw'] },

  // --- Cape Comorin & Sri Lanka Rounding Passages (The Vital East-West Maritime Highway) ---
  { id: 'cape_comorin_nw', name: 'Cape Comorin NW Approach', lat: 7.90, lng: 77.10, neighbors: ['kochi_south_lane', 'vizhinjam_offshore', 'cape_comorin_south'] },
  { id: 'cape_comorin_south', name: 'Cape Comorin South TSS', lat: 7.40, lng: 77.60, neighbors: ['cape_comorin_nw', 'gulf_mannar_deep', 'sri_lanka_sw_lane'] },
  { id: 'gulf_mannar_deep', name: 'Gulf of Mannar Deep Channel', lat: 8.20, lng: 78.40, neighbors: ['cape_comorin_south', 'tuticorin_approach', 'sri_lanka_west'] },
  { id: 'tuticorin_approach', name: 'V.O. Chidambaranar / Tuticorin Approach', lat: 8.75, lng: 78.22, neighbors: ['gulf_mannar_deep'] },
  { id: 'sri_lanka_west', name: 'Colombo / West Sri Lanka Lane', lat: 6.95, lng: 79.50, neighbors: ['gulf_mannar_deep', 'sri_lanka_sw_lane', 'colombo_approach'] },
  { id: 'colombo_approach', name: 'Colombo Port Approach', lat: 6.95, lng: 79.80, neighbors: ['sri_lanka_west'] },
  { id: 'sri_lanka_sw_lane', name: 'Galle / SW Sri Lanka Passage', lat: 5.85, lng: 80.10, neighbors: ['cape_comorin_south', 'sri_lanka_west', 'dondra_head_tss'] },
  { id: 'dondra_head_tss', name: 'Dondra Head Deep Sea TSS', lat: 5.60, lng: 80.60, neighbors: ['sri_lanka_sw_lane', 'sri_lanka_se_lane', 'hambantota_offshore'] },
  { id: 'hambantota_offshore', name: 'Hambantota Offshore', lat: 6.05, lng: 81.15, neighbors: ['dondra_head_tss', 'sri_lanka_se_lane'] },
  { id: 'sri_lanka_se_lane', name: 'Great Basses / SE Sri Lanka Passage', lat: 6.15, lng: 81.80, neighbors: ['dondra_head_tss', 'hambantota_offshore', 'sri_lanka_east_lane', 'bay_of_bengal_south'] },
  { id: 'sri_lanka_east_lane', name: 'Batticaloa / East Sri Lanka Lane', lat: 7.70, lng: 82.20, neighbors: ['sri_lanka_se_lane', 'trincomalee_offshore', 'bay_of_bengal_sw_deep'] },
  { id: 'trincomalee_offshore', name: 'Trincomalee Offshore', lat: 8.60, lng: 81.60, neighbors: ['sri_lanka_east_lane', 'bay_of_bengal_sw_deep'] },

  // --- East Coast India (Coromandel, Andhra, Odisha, Bengal) ---
  { id: 'bay_of_bengal_sw_deep', name: 'Bay of Bengal SW Deep Sea Corridor', lat: 10.50, lng: 81.40, neighbors: ['sri_lanka_east_lane', 'trincomalee_offshore', 'nagapattinam_offshore', 'chennai_south_lane'] },
  { id: 'nagapattinam_offshore', name: 'Nagapattinam / Karaikal Offshore', lat: 10.80, lng: 80.20, neighbors: ['bay_of_bengal_sw_deep', 'cuddalore_offshore'] },
  { id: 'cuddalore_offshore', name: 'Cuddalore / Pondicherry Offshore', lat: 11.80, lng: 80.20, neighbors: ['nagapattinam_offshore', 'chennai_south_lane'] },
  { id: 'chennai_south_lane', name: 'Chennai South Coastal Lane', lat: 12.60, lng: 80.60, neighbors: ['bay_of_bengal_sw_deep', 'cuddalore_offshore', 'chennai_approach', 'chennai_north_lane'] },
  { id: 'chennai_approach', name: 'Chennai / Ennore Port Fairway', lat: 13.12, lng: 80.38, neighbors: ['chennai_south_lane', 'chennai_north_lane'] },
  { id: 'chennai_north_lane', name: 'Chennai North Coastal Lane', lat: 13.80, lng: 80.60, neighbors: ['chennai_south_lane', 'chennai_approach', 'krishnapatnam_offshore'] },
  { id: 'krishnapatnam_offshore', name: 'Krishnapatnam Port Approach', lat: 14.25, lng: 80.25, neighbors: ['chennai_north_lane', 'machilipatnam_offshore'] },
  { id: 'machilipatnam_offshore', name: 'Machilipatnam / Krishna Delta Offshore', lat: 15.80, lng: 81.20, neighbors: ['krishnapatnam_offshore', 'kakinada_offshore', 'andhra_deep_lane'] },
  { id: 'kakinada_offshore', name: 'Kakinada Deep Sea Port Anchorage', lat: 16.95, lng: 82.40, neighbors: ['machilipatnam_offshore', 'vizag_south_lane'] },
  { id: 'andhra_deep_lane', name: 'Andhra Coastal Sea Lane', lat: 17.00, lng: 83.50, neighbors: ['machilipatnam_offshore', 'vizag_south_lane', 'bay_of_bengal_mid'] },
  { id: 'vizag_south_lane', name: 'Visakhapatnam South Approach', lat: 17.60, lng: 83.40, neighbors: ['kakinada_offshore', 'andhra_deep_lane', 'vizag_approach', 'vizag_north_lane'] },
  { id: 'vizag_approach', name: 'Visakhapatnam Harbor Approach', lat: 17.68, lng: 83.33, neighbors: ['vizag_south_lane', 'vizag_north_lane'] },
  { id: 'vizag_north_lane', name: 'Visakhapatnam North Sea Lane', lat: 18.50, lng: 84.80, neighbors: ['vizag_south_lane', 'vizag_approach', 'gopalpur_offshore', 'paradip_south_lane'] },
  { id: 'gopalpur_offshore', name: 'Gopalpur Offshore', lat: 19.20, lng: 85.10, neighbors: ['vizag_north_lane', 'paradip_south_lane'] },
  { id: 'paradip_south_lane', name: 'Paradip South Sea Lane', lat: 19.80, lng: 86.40, neighbors: ['vizag_north_lane', 'gopalpur_offshore', 'paradip_approach', 'dhamra_offshore'] },
  { id: 'paradip_approach', name: 'Paradip Port Fairway Anchorage', lat: 20.25, lng: 86.75, neighbors: ['paradip_south_lane', 'dhamra_offshore'] },
  { id: 'dhamra_offshore', name: 'Dhamra Port Offshore', lat: 20.80, lng: 87.20, neighbors: ['paradip_south_lane', 'paradip_approach', 'sandheads_lane'] },
  { id: 'sandheads_lane', name: 'Sandheads Pilot Boarding Ground (Hooghly)', lat: 21.00, lng: 88.20, neighbors: ['dhamra_offshore', 'haldia_channel', 'bay_of_bengal_north'] },
  { id: 'haldia_channel', name: 'Haldia / Sagar Island Channel', lat: 21.60, lng: 88.10, neighbors: ['sandheads_lane', 'kolkata_port_approach'] },
  { id: 'kolkata_port_approach', name: 'Kolkata Syama Prasad Mookerjee Port', lat: 22.10, lng: 88.15, neighbors: ['haldia_channel'] },

  // --- Bay of Bengal & International Connections ---
  { id: 'bay_of_bengal_north', name: 'North Bay of Bengal Open Sea Lane', lat: 20.50, lng: 89.50, neighbors: ['sandheads_lane', 'chittagong_offshore', 'bay_of_bengal_mid'] },
  { id: 'chittagong_offshore', name: 'Chittagong Anchorage', lat: 21.80, lng: 91.60, neighbors: ['bay_of_bengal_north'] },
  { id: 'bay_of_bengal_mid', name: 'Central Bay of Bengal Sea Lane', lat: 15.00, lng: 87.00, neighbors: ['andhra_deep_lane', 'bay_of_bengal_north', 'bay_of_bengal_south', 'port_blair_lane'] },
  { id: 'bay_of_bengal_south', name: 'South Bay of Bengal Mainline', lat: 10.00, lng: 86.00, neighbors: ['sri_lanka_se_lane', 'bay_of_bengal_mid', 'port_blair_lane', 'malacca_west_entry'] },
  { id: 'port_blair_lane', name: 'Port Blair / Andaman Offshore', lat: 11.66, lng: 92.80, neighbors: ['bay_of_bengal_mid', 'bay_of_bengal_south', 'malacca_west_entry'] },
  { id: 'malacca_west_entry', name: 'Great Channel / Malacca West Entry', lat: 6.00, lng: 95.00, neighbors: ['bay_of_bengal_south', 'port_blair_lane', 'malacca_strait_mid'] },
  { id: 'malacca_strait_mid', name: 'Malacca Strait Traffic Separation Scheme', lat: 3.50, lng: 100.50, neighbors: ['malacca_west_entry', 'singapore_strait'] },
  { id: 'singapore_strait', name: 'Singapore Port Fairway', lat: 1.25, lng: 103.80, neighbors: ['malacca_strait_mid'] },

  // --- Arabian Sea Open Ocean & Middle East / Red Sea Passages ---
  { id: 'arabian_sea_nw', name: 'Northwest Arabian Sea Lane', lat: 22.00, lng: 65.00, neighbors: ['kutch_exit', 'strait_of_hormuz_lane', 'arabian_sea_mid'] },
  { id: 'strait_of_hormuz_lane', name: 'Gulf of Oman / Hormuz Approach', lat: 24.50, lng: 58.50, neighbors: ['arabian_sea_nw', 'jebel_ali_app'] },
  { id: 'jebel_ali_app', name: 'Jebel Ali / Dubai Sea Approach', lat: 25.10, lng: 55.00, neighbors: ['strait_of_hormuz_lane'] },
  { id: 'arabian_sea_mid', name: 'Central Arabian Sea High Seas Route', lat: 16.00, lng: 66.00, neighbors: ['mumbai_nw_lane', 'arabian_sea_nw', 'gulf_of_aden_lane', 'arabian_sea_south'] },
  { id: 'gulf_of_aden_lane', name: 'Gulf of Aden / Bab-el-Mandeb Route', lat: 12.50, lng: 48.00, neighbors: ['arabian_sea_mid', 'arabian_sea_south'] },
  { id: 'arabian_sea_south', name: 'South Arabian Sea / Maldives Passage', lat: 7.00, lng: 72.00, neighbors: ['arabian_sea_mid', 'gulf_of_aden_lane', 'cape_comorin_south'] },
];

@Injectable()
export class SeaRoutingService {
  private readonly logger = new Logger(SeaRoutingService.name);
  private readonly wayPointMap = new Map<string, MarineWayPoint>();

  constructor(private readonly supabase: SupabaseService) {
    // Build bidirectional waypoint lookup map
    for (const wp of MARINE_NETWORK) {
      this.wayPointMap.set(wp.id, wp);
    }
    // Ensure all neighbor links are symmetrical
    for (const wp of MARINE_NETWORK) {
      for (const nId of wp.neighbors) {
        const neighbor = this.wayPointMap.get(nId);
        if (neighbor && !neighbor.neighbors.includes(wp.id)) {
          neighbor.neighbors.push(wp.id);
        }
      }
    }
  }

  /**
   * Calculates or retrieves cached land-avoiding sea route between two ports.
   * Marked with routing_source: 'searoute' (or 'fallback-chokepoint').
   */
  async getOrComputeRoute(
    orgId: string,
    origin: Port,
    destination: Port,
  ): Promise<SeaRouteGeometry> {
    // 1. Check saved_sea_routes cache
    const { data: cachedRoute } = await this.supabase.adminClient
      .from('saved_sea_routes')
      .select('*')
      .eq('org_id', orgId)
      .eq('origin_port_id', origin.id)
      .eq('destination_port_id', destination.id)
      .maybeSingle();

    if (cachedRoute && cachedRoute.route_geometry?.coordinates?.length > 1) {
      const cachedGeom = cachedRoute.route_geometry;
      const cachedDist = cachedGeom.distance_km || 0;

      this.logger.log(
        `Using cached sea route for ${origin.name} -> ${destination.name} (Source: ${cachedRoute.routing_source}, Dist: ${cachedDist} km)`,
      );

      // Increment usage count asynchronously
      this.supabase.adminClient
        .from('saved_sea_routes')
        .update({
          usage_count: (cachedRoute.usage_count || 1) + 1,
          updated_at: new Date().toISOString(),
        })
        .eq('id', cachedRoute.id)
        .then(() => {});

      return {
        type: 'LineString',
        coordinates: cachedGeom.coordinates,
        distance_km: cachedDist,
        duration_minutes:
          cachedGeom.duration_minutes ||
          Math.max(30, Math.round((cachedDist / 35) * 60)), // 35 km/h ~ 19 knots
        routing_source: cachedRoute.routing_source as SeaRoutingSource,
      };
    }

    // 2. Compute land-avoiding route using the maritime network graph
    const computedGeometry = this.computeSeaRoute(origin, destination);

    // 3. Cache into saved_sea_routes
    try {
      await this.supabase.adminClient
        .from('saved_sea_routes')
        .upsert(
          {
            org_id: orgId,
            origin_port_id: origin.id,
            destination_port_id: destination.id,
            route_geometry: computedGeometry,
            routing_source: computedGeometry.routing_source,
            usage_count: 1,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'org_id,origin_port_id,destination_port_id' },
        );
    } catch (saveErr: any) {
      this.logger.warn(`Failed to cache saved_sea_route: ${saveErr.message}`);
    }

    return computedGeometry;
  }

  /**
   * Computes a real land-avoiding sea path between origin and destination ports.
   * Snaps each port to the closest sea fairway, runs Dijkstra shortest path across
   * verified open-water corridors, and calculates nautical distance & duration.
   */
  computeSeaRoute(origin: Port, destination: Port): SeaRouteGeometry {
    const origLat = origin.lat ?? 18.95;
    const origLng = origin.lng ?? 72.95;
    const destLat = destination.lat ?? 13.08;
    const destLng = destination.lng ?? 80.29;

    const geoDistKm = haversineDistKm(origLat, origLng, destLat, destLng);

    // Find nearest waypoints in the marine network for both ports
    const startWp = this.findNearestMarineWayPoint(origLat, origLng);
    const endWp = this.findNearestMarineWayPoint(destLat, destLng);

    if (!startWp || !endWp) {
      // Fallback: steer through Cape Comorin / Dondra Head chokepoint if spanning West & East coasts
      return this.computeChokepointFallback(origLat, origLng, destLat, destLng);
    }

    // If both ports snap to the same waypoint or are very close
    if (startWp.id === endWp.id) {
      const directPoints = this.interpolateWaypoints(origLat, origLng, destLat, destLng, 10);
      const dist = Math.round(geoDistKm * 100) / 100;
      return {
        type: 'LineString',
        coordinates: directPoints,
        distance_km: dist,
        duration_minutes: Math.max(30, Math.round((dist / 35) * 60)),
        routing_source: 'searoute',
      };
    }

    // Run Dijkstra shortest-path search along the marine network
    const pathNodeIds = this.findShortestSeaPath(startWp.id, endWp.id);

    if (!pathNodeIds || pathNodeIds.length === 0) {
      return this.computeChokepointFallback(origLat, origLng, destLat, destLng);
    }

    // Build complete waypoint sequence: [Origin Port, ...Marine Nodes, Destination Port]
    const routeWaypoints: [number, number][] = [[origLng, origLat]];

    for (const nodeId of pathNodeIds) {
      const node = this.wayPointMap.get(nodeId);
      if (node) {
        routeWaypoints.push([node.lng, node.lat]);
      }
    }
    routeWaypoints.push([destLng, destLat]);

    // Densify and smooth the polyline
    const smoothedCoordinates = this.smoothRoutePolyline(routeWaypoints);

    // Compute cumulative maritime distance
    let totalKm = 0;
    for (let i = 0; i < smoothedCoordinates.length - 1; i++) {
      const [lon1, lat1] = smoothedCoordinates[i];
      const [lon2, lat2] = smoothedCoordinates[i + 1];
      totalKm += haversineDistKm(lat1, lon1, lat2, lon2);
    }
    const distanceKm = Math.round(totalKm * 100) / 100;

    // Average commercial vessel cruise speed ~ 18-20 knots (~33-37 km/h)
    const durationMinutes = Math.max(30, Math.round((distanceKm / 35) * 60));

    this.logger.log(
      `Computed Searoute Land-Avoiding Marine Path: ${origin.name} -> ${destination.name} ` +
        `(${smoothedCoordinates.length} waypoints, ${distanceKm} km, Duration: ${durationMinutes} min, Routing: searoute)`,
    );

    return {
      type: 'LineString',
      coordinates: smoothedCoordinates,
      distance_km: distanceKm,
      duration_minutes: durationMinutes,
      routing_source: 'searoute',
    };
  }

  /**
   * Dijkstra shortest path algorithm across marine network.
   */
  private findShortestSeaPath(startId: string, endId: string): string[] | null {
    if (startId === endId) return [startId];

    const distances = new Map<string, number>();
    const previous = new Map<string, string | null>();
    const visited = new Set<string>();

    const unvisited: { id: string; dist: number }[] = [];

    for (const wp of this.wayPointMap.values()) {
      distances.set(wp.id, Infinity);
    }
    distances.set(startId, 0);
    unvisited.push({ id: startId, dist: 0 });

    while (unvisited.length > 0) {
      unvisited.sort((a, b) => a.dist - b.dist);
      const { id: currentId, dist: currentDist } = unvisited.shift()!;

      if (visited.has(currentId)) continue;
      visited.add(currentId);

      if (currentId === endId) {
        // Reconstruct path
        const path: string[] = [];
        let curr: string | null = endId;
        while (curr) {
          path.unshift(curr);
          curr = previous.get(curr) || null;
        }
        return path;
      }

      const node = this.wayPointMap.get(currentId);
      if (!node) continue;

      for (const neighborId of node.neighbors) {
        if (visited.has(neighborId)) continue;
        const neighbor = this.wayPointMap.get(neighborId);
        if (!neighbor) continue;

        const weight = haversineDistKm(node.lat, node.lng, neighbor.lat, neighbor.lng);
        const newDist = currentDist + weight;
        const currentNeighborDist = distances.get(neighborId) ?? Infinity;

        if (newDist < currentNeighborDist) {
          distances.set(neighborId, newDist);
          previous.set(neighborId, currentId);
          unvisited.push({ id: neighborId, dist: newDist });
        }
      }
    }

    return null;
  }

  /**
   * Find nearest marine fairway waypoint to a given port coordinate.
   */
  findNearestMarineWayPoint(lat: number, lng: number): MarineWayPoint | null {
    let nearest: MarineWayPoint | null = null;
    let minDistance = Infinity;

    for (const wp of this.wayPointMap.values()) {
      const d = haversineDistKm(lat, lng, wp.lat, wp.lng);
      if (d < minDistance) {
        minDistance = d;
        nearest = wp;
      }
    }

    return nearest;
  }

  /**
   * Labeled Fallback: If disconnected or off-network, explicitly route around
   * southern peninsular chokepoints (Cape Comorin / Dondra Head) so land is never crossed.
   */
  public computeChokepointFallback(
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number,
  ): SeaRouteGeometry {
    const rawDist = haversineDistKm(lat1, lon1, lat2, lon2);
    const keypoints: [number, number][] = [[lon1, lat1]];

    // Check if crossing between West (long < 78) and East (long >= 78) of Indian Peninsula
    const isWest1 = lon1 < 78 && lat1 > 8.0;
    const isEast2 = lon2 >= 78 && lat2 > 8.0;
    const isEast1 = lon1 >= 78 && lat1 > 8.0;
    const isWest2 = lon2 < 78 && lat2 > 8.0;

    if ((isWest1 && isEast2) || (isEast1 && isWest2)) {
      this.logger.warn(`Using fallback-chokepoint routing around Cape Comorin/Sri Lanka to prevent land crossing`);
      // Route via southern tip: Cape Comorin West -> South of Sri Lanka -> Bay of Bengal South
      if (isWest1 && isEast2) {
        keypoints.push([77.20, 7.80]); // Cape Comorin West offshore
        keypoints.push([77.60, 7.40]); // South of Comorin
        keypoints.push([80.60, 5.60]); // Dondra Head South passage
        keypoints.push([82.20, 7.70]); // East Sri Lanka
      } else {
        keypoints.push([82.20, 7.70]); // East Sri Lanka
        keypoints.push([80.60, 5.60]); // Dondra Head South passage
        keypoints.push([77.60, 7.40]); // South of Comorin
        keypoints.push([77.20, 7.80]); // Cape Comorin West offshore
      }
    }
    keypoints.push([lon2, lat2]);

    const smoothed = this.smoothRoutePolyline(keypoints);

    let totalKm = 0;
    for (let i = 0; i < smoothed.length - 1; i++) {
      const [pLon1, pLat1] = smoothed[i];
      const [pLon2, pLat2] = smoothed[i + 1];
      totalKm += haversineDistKm(pLat1, pLon1, pLat2, pLon2);
    }
    const distanceKm = Math.round(totalKm * 100) / 100;
    const durationMinutes = Math.max(30, Math.round((distanceKm / 35) * 60));

    return {
      type: 'LineString',
      coordinates: smoothed,
      distance_km: distanceKm,
      duration_minutes: durationMinutes,
      routing_source: 'fallback-chokepoint',
    };
  }

  /**
   * Smooth and interpolate between consecutive navigational waypoints.
   */
  private smoothRoutePolyline(points: [number, number][]): [number, number][] {
    if (points.length < 2) return points;

    const result: [number, number][] = [];

    for (let i = 0; i < points.length - 1; i++) {
      const [lonA, latA] = points[i];
      const [lonB, latB] = points[i + 1];
      const legDistKm = haversineDistKm(latA, lonA, latB, lonB);

      // Interpolate roughly every 25-40 km along legs for smooth vessel simulation
      const steps = Math.max(3, Math.min(25, Math.round(legDistKm / 30)));
      const segment = this.interpolateWaypoints(latA, lonA, latB, lonB, steps);

      if (i === 0) {
        result.push(...segment);
      } else {
        result.push(...segment.slice(1));
      }
    }

    return result;
  }

  private interpolateWaypoints(
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number,
    steps = 10,
  ): [number, number][] {
    const pts: [number, number][] = [];
    for (let s = 0; s <= steps; s++) {
      const frac = s / steps;
      const lat = lat1 + (lat2 - lat1) * frac;
      const lon = lon1 + (lon2 - lon1) * frac;
      pts.push([Math.round(lon * 1e5) / 1e5, Math.round(lat * 1e5) / 1e5]);
    }
    return pts;
  }
}
