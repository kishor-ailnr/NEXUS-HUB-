import { Injectable, Logger } from '@nestjs/common';
import { SupabaseService } from '../../supabase/supabase.service';
import { Station, RailRoutingSource } from '@nexus-ways/shared';

export interface RailRouteGeometry {
  type: string;
  coordinates: [number, number][]; // [lng, lat]
  distance_km: number;
  duration_minutes: number;
  routing_source: RailRoutingSource;
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

export interface GraphNode {
  id: string;
  lat: number;
  lon: number;
  neighbors: { neighborId: string; weightKm: number }[];
}

@Injectable()
export class RailRoutingService {
  private readonly logger = new Logger(RailRoutingService.name);
  private readonly overpassEndpoint = 'https://overpass-api.de/api/interpreter';

  constructor(private readonly supabase: SupabaseService) {}

  /**
   * Get cached rail route or compute via OSM Overpass API with graph path selection and sanity checks.
   */
  async getOrComputeRoute(
    orgId: string,
    origin: Station,
    destination: Station,
    intermediates: Station[] = [],
  ): Promise<RailRouteGeometry> {
    // 1. Check saved_rail_routes cache
    const { data: cachedRoute } = await this.supabase.adminClient
      .from('saved_rail_routes')
      .select('*')
      .eq('org_id', orgId)
      .eq('origin_station_id', origin.id)
      .eq('destination_station_id', destination.id)
      .maybeSingle();

    if (cachedRoute && cachedRoute.route_geometry?.coordinates?.length > 1) {
      const cachedGeom = cachedRoute.route_geometry;
      const cachedDist = cachedGeom.distance_km || 0;
      const geoDist = haversineDistKm(origin.lat || 0, origin.lng || 0, destination.lat || 0, destination.lng || 0);

      // Verify cached route sanity before reuse (defensive check against legacy bad cache)
      if (geoDist > 1 && cachedDist > 3.5 * geoDist) {
        this.logger.warn(
          `Cached route for ${origin.name} -> ${destination.name} is corrupted (${cachedDist} km > 3.5x geodesic ${geoDist.toFixed(1)} km). Recomputing...`,
        );
      } else {
        this.logger.log(
          `Using cached rail route for ${origin.name} -> ${destination.name} (Source: ${cachedRoute.routing_source}, Dist: ${cachedDist} km)`,
        );

        // Increment usage count asynchronously
        this.supabase.adminClient
          .from('saved_rail_routes')
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
          duration_minutes: cachedGeom.duration_minutes || Math.max(15, Math.round((cachedDist / 75) * 60)),
          routing_source: cachedRoute.routing_source as RailRoutingSource,
        };
      }
    }

    // 2. Build station sequence [origin, ...intermediates, destination]
    const fullSequence = [origin, ...intermediates, destination];

    let allCoordinates: [number, number][] = [];
    let usedSource: RailRoutingSource = 'overpass';

    for (let i = 0; i < fullSequence.length - 1; i++) {
      const stA = fullSequence[i];
      const stB = fullSequence[i + 1];

      const segment = await this.computeSegmentRoute(stA, stB);
      if (segment.routing_source !== 'overpass') {
        usedSource = 'fallback-straight-line';
      }

      if (i === 0) {
        allCoordinates = segment.coordinates;
      } else {
        allCoordinates = allCoordinates.concat(segment.coordinates.slice(1));
      }
    }

    // Ensure minimum coordinates
    if (allCoordinates.length < 2) {
      allCoordinates = this.generateStraightLineCoordinates(fullSequence);
      usedSource = 'fallback-straight-line';
    }

    // 3. Compute total distance & duration (rail avg speed 75 km/h)
    let totalKm = 0;
    for (let i = 0; i < allCoordinates.length - 1; i++) {
      const [lon1, lat1] = allCoordinates[i];
      const [lon2, lat2] = allCoordinates[i + 1];
      totalKm += haversineDistKm(lat1, lon1, lat2, lon2);
    }
    let distanceKm = Math.round(totalKm * 100) / 100;

    // Overall Sanity Check against total geodesic distance
    const totalGeoKm = haversineDistKm(origin.lat || 0, origin.lng || 0, destination.lat || 0, destination.lng || 0);
    if (totalGeoKm > 1 && distanceKm > 3.0 * totalGeoKm) {
      this.logger.warn(
        `[Sanity Check Failed] Total computed route distance (${distanceKm} km) exceeds 3x geodesic distance (${totalGeoKm.toFixed(1)} km). Falling back to straight-line route.`,
      );
      allCoordinates = this.generateStraightLineCoordinates(fullSequence);
      usedSource = 'fallback-straight-line';
      distanceKm = Math.round(totalGeoKm * 100) / 100;
    }

    const durationMinutes = Math.max(15, Math.round((distanceKm / 75) * 60));

    const computedGeometry: RailRouteGeometry = {
      type: 'LineString',
      coordinates: allCoordinates,
      distance_km: distanceKm,
      duration_minutes: durationMinutes,
      routing_source: usedSource,
    };

    // 4. Cache into saved_rail_routes
    try {
      const intermediatePayload = intermediates.map((st, idx) => ({
        station_id: st.id,
        sequence: idx + 1,
      }));

      await this.supabase.adminClient
        .from('saved_rail_routes')
        .upsert(
          {
            org_id: orgId,
            origin_station_id: origin.id,
            destination_station_id: destination.id,
            intermediate_stations: intermediatePayload,
            route_geometry: computedGeometry,
            routing_source: usedSource,
            usage_count: 1,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'org_id,origin_station_id,destination_station_id' },
        );
    } catch (saveErr: any) {
      this.logger.warn(`Failed to cache saved_rail_route: ${saveErr.message}`);
    }

    return computedGeometry;
  }

  /**
   * Compute a coherent rail route between two stations using Overpass query + graph shortest-path.
   */
  async computeSegmentRoute(
    stA: Station,
    stB: Station,
  ): Promise<{ coordinates: [number, number][]; distance_km: number; routing_source: RailRoutingSource }> {
    const lat1 = stA.lat ?? 0;
    const lon1 = stA.lng ?? 0;
    const lat2 = stB.lat ?? 0;
    const lon2 = stB.lng ?? 0;

    const geoDistKm = haversineDistKm(lat1, lon1, lat2, lon2);

    if (!lat1 || !lon1 || !lat2 || !lon2 || geoDistKm < 0.1) {
      return {
        coordinates: this.interpolatePoints(lat1 || 18.9, lon1 || 72.8, lat2 || 18.5, lon2 || 73.8),
        distance_km: Math.round(geoDistKm * 100) / 100,
        routing_source: 'fallback-straight-line',
      };
    }

    // 1. Query Overpass API for real rail ways
    const elements = await this.queryOverpassApi(stA, stB);

    if (!elements || elements.length === 0) {
      return {
        coordinates: this.interpolatePoints(lat1, lon1, lat2, lon2),
        distance_km: Math.round(geoDistKm * 100) / 100,
        routing_source: 'fallback-straight-line',
      };
    }

    // 2. Build graph from Overpass way elements
    const { nodes, nodeMap } = this.buildRailGraph(elements);

    if (nodes.length < 2) {
      this.logger.warn(`Insufficient rail graph nodes (${nodes.length}). Using straight-line fallback.`);
      return {
        coordinates: this.interpolatePoints(lat1, lon1, lat2, lon2),
        distance_km: Math.round(geoDistKm * 100) / 100,
        routing_source: 'fallback-straight-line',
      };
    }

    // 3. Find graph nodes nearest to Origin and Destination stations
    const startNode = this.findNearestNode(lat1, lon1, nodes);
    const endNode = this.findNearestNode(lat2, lon2, nodes);

    if (!startNode || !endNode || startNode.id === endNode.id) {
      this.logger.warn(`Could not snap distinct origin/dest nodes on rail graph. Using straight-line fallback.`);
      return {
        coordinates: this.interpolatePoints(lat1, lon1, lat2, lon2),
        distance_km: Math.round(geoDistKm * 100) / 100,
        routing_source: 'fallback-straight-line',
      };
    }

    // Ensure snapped nodes are reasonably close to the stations (within 25 km)
    const distToStart = haversineDistKm(lat1, lon1, startNode.lat, startNode.lon);
    const distToEnd = haversineDistKm(lat2, lon2, endNode.lat, endNode.lon);

    if (distToStart > 25 || distToEnd > 25) {
      this.logger.warn(
        `Nearest rail nodes too far from stations (start: ${distToStart.toFixed(1)} km, end: ${distToEnd.toFixed(1)} km). Using straight-line fallback.`,
      );
      return {
        coordinates: this.interpolatePoints(lat1, lon1, lat2, lon2),
        distance_km: Math.round(geoDistKm * 100) / 100,
        routing_source: 'fallback-straight-line',
      };
    }

    // 4. Run Dijkstra Shortest Path Search
    const path = this.findShortestPathDijkstra(startNode.id, endNode.id, nodeMap);

    if (!path || path.length < 2) {
      this.logger.warn(`No connected path exists between ${stA.name} and ${stB.name} in rail graph. Using straight-line fallback.`);
      return {
        coordinates: this.interpolatePoints(lat1, lon1, lat2, lon2),
        distance_km: Math.round(geoDistKm * 100) / 100,
        routing_source: 'fallback-straight-line',
      };
    }

    // 5. Construct path coordinates
    const pathCoords: [number, number][] = [[lon1, lat1]];
    for (const nodeId of path) {
      const node = nodeMap.get(nodeId);
      if (node) {
        pathCoords.push([node.lon, node.lat]);
      }
    }
    pathCoords.push([lon2, lat2]);

    // Calculate path distance
    let pathDistKm = 0;
    for (let i = 0; i < pathCoords.length - 1; i++) {
      pathDistKm += haversineDistKm(pathCoords[i][1], pathCoords[i][0], pathCoords[i + 1][1], pathCoords[i + 1][0]);
    }
    pathDistKm = Math.round(pathDistKm * 100) / 100;

    // 6. Defensive Sanity Check: Compare path distance to straight-line distance
    if (pathDistKm > 3.0 * geoDistKm) {
      this.logger.warn(
        `[Sanity Check] Computed rail path distance (${pathDistKm} km) exceeds 3x geodesic distance (${geoDistKm.toFixed(1)} km). Treating as implausible and falling back.`,
      );
      return {
        coordinates: this.interpolatePoints(lat1, lon1, lat2, lon2),
        distance_km: Math.round(geoDistKm * 100) / 100,
        routing_source: 'fallback-straight-line',
      };
    }

    this.logger.log(
      `Computed valid Overpass rail route: ${stA.name} -> ${stB.name} (${pathCoords.length} pts, ${pathDistKm} km, Geodesic: ${geoDistKm.toFixed(1)} km)`,
    );

    return {
      coordinates: pathCoords,
      distance_km: pathDistKm,
      routing_source: 'overpass',
    };
  }

  /**
   * Query Overpass API for way["railway"="rail"] inside bounding box.
   */
  async queryOverpassApi(stA: Station, stB: Station): Promise<any[]> {
    const lat1 = stA.lat ?? 0;
    const lon1 = stA.lng ?? 0;
    const lat2 = stB.lat ?? 0;
    const lon2 = stB.lng ?? 0;

    const geoDistKm = haversineDistKm(lat1, lon1, lat2, lon2);
    // Use dynamic padding (minimum 0.25° ~ 27 km) to capture mainline junction arcs like Kalyan/Bhor Ghat
    const padding = Math.max(0.25, Math.min(0.50, geoDistKm * 0.002));

    const minLat = Math.min(lat1, lat2) - padding;
    const maxLat = Math.max(lat1, lat2) + padding;
    const minLon = Math.min(lon1, lon2) - padding;
    const maxLon = Math.max(lon1, lon2) + padding;

    const overpassQuery = `[out:json][timeout:25]; (way["railway"="rail"](${minLat},${minLon},${maxLat},${maxLon});); out geom;`;

    try {
      this.logger.log(`Calling OSM Overpass API for rail line between ${stA.name} and ${stB.name} (padding: ${padding.toFixed(2)}°)...`);
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 20000);

      const response = await fetch(this.overpassEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'User-Agent': 'NexusWays-RailwaySimulation/1.0 (https://nexusways.io; operational-routing)',
          'Accept': 'application/json',
        },
        body: `data=${encodeURIComponent(overpassQuery)}`,
        signal: controller.signal,
      });

      clearTimeout(timeout);

      if (!response.ok) {
        this.logger.warn(`Overpass API responded with HTTP ${response.status}. Using straight-line fallback.`);
        return [];
      }

      const json = await response.json();
      return json?.elements || [];
    } catch (err: any) {
      this.logger.warn(`Overpass API call error (${err.message}). Using straight-line fallback.`);
      return [];
    }
  }

  /**
   * Parse Overpass way elements into a connected adjacency graph.
   */
  buildRailGraph(elements: any[]): { nodes: GraphNode[]; nodeMap: Map<string, GraphNode> } {
    const nodeMap = new Map<string, GraphNode>();

    const getNodeKey = (lat: number, lon: number): string => {
      // Snap nodes within ~5.5 meters (4 decimal places) to merge track segment junctions
      return `${lat.toFixed(4)},${lon.toFixed(4)}`;
    };

    const getOrCreateNode = (lat: number, lon: number): GraphNode => {
      const key = getNodeKey(lat, lon);
      let node = nodeMap.get(key);
      if (!node) {
        node = {
          id: key,
          lat,
          lon,
          neighbors: [],
        };
        nodeMap.set(key, node);
      }
      return node;
    };

    const wayEndpoints: GraphNode[] = [];

    for (const el of elements) {
      if (el.geometry && Array.isArray(el.geometry) && el.geometry.length >= 2) {
        const firstPt = el.geometry[0];
        const lastPt = el.geometry[el.geometry.length - 1];

        for (let i = 0; i < el.geometry.length - 1; i++) {
          const p1 = el.geometry[i];
          const p2 = el.geometry[i + 1];

          const node1 = getOrCreateNode(p1.lat, p1.lon);
          const node2 = getOrCreateNode(p2.lat, p2.lon);

          if (node1.id !== node2.id) {
            const weight = haversineDistKm(node1.lat, node1.lon, node2.lat, node2.lon);

            // Add undirected edge if not already present
            if (!node1.neighbors.some((n) => n.neighborId === node2.id)) {
              node1.neighbors.push({ neighborId: node2.id, weightKm: weight });
            }
            if (!node2.neighbors.some((n) => n.neighborId === node1.id)) {
              node2.neighbors.push({ neighborId: node1.id, weightKm: weight });
            }
          }
        }

        wayEndpoints.push(getOrCreateNode(firstPt.lat, firstPt.lon));
        wayEndpoints.push(getOrCreateNode(lastPt.lat, lastPt.lon));
      }
    }

    // Micro-snap track endpoints within 30 meters to bridge switch/turnout gaps
    for (let i = 0; i < wayEndpoints.length; i++) {
      for (let j = i + 1; j < wayEndpoints.length; j++) {
        const n1 = wayEndpoints[i];
        const n2 = wayEndpoints[j];
        if (n1.id !== n2.id) {
          const dMeters = haversineDistKm(n1.lat, n1.lon, n2.lat, n2.lon) * 1000;
          if (dMeters <= 30) {
            const weightKm = dMeters / 1000;
            if (!n1.neighbors.some((n) => n.neighborId === n2.id)) {
              n1.neighbors.push({ neighborId: n2.id, weightKm });
            }
            if (!n2.neighbors.some((n) => n.neighborId === n1.id)) {
              n2.neighbors.push({ neighborId: n1.id, weightKm });
            }
          }
        }
      }
    }

    return {
      nodes: Array.from(nodeMap.values()),
      nodeMap,
    };
  }

  /**
   * Find the graph node closest to the given coordinates.
   */
  findNearestNode(lat: number, lon: number, nodes: GraphNode[]): GraphNode | null {
    if (!nodes || nodes.length === 0) return null;

    let nearest: GraphNode | null = null;
    let minDistance = Infinity;

    for (const node of nodes) {
      const d = haversineDistKm(lat, lon, node.lat, node.lon);
      if (d < minDistance) {
        minDistance = d;
        nearest = node;
      }
    }

    return nearest;
  }

  /**
   * Run Dijkstra shortest-path algorithm from startNodeId to endNodeId.
   */
  findShortestPathDijkstra(startId: string, endId: string, nodeMap: Map<string, GraphNode>): string[] | null {
    if (startId === endId) return [startId];
    if (!nodeMap.has(startId) || !nodeMap.has(endId)) return null;

    const distances = new Map<string, number>();
    const previous = new Map<string, string | null>();
    const visited = new Set<string>();

    const unvisitedNodes: { id: string; dist: number }[] = [];

    distances.set(startId, 0);
    unvisitedNodes.push({ id: startId, dist: 0 });

    while (unvisitedNodes.length > 0) {
      unvisitedNodes.sort((a, b) => a.dist - b.dist);
      const { id: currentId, dist: currentDist } = unvisitedNodes.shift()!;

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

      const currentNode = nodeMap.get(currentId);
      if (!currentNode) continue;

      for (const neighbor of currentNode.neighbors) {
        if (visited.has(neighbor.neighborId)) continue;

        const newDist = currentDist + neighbor.weightKm;
        const existingDist = distances.get(neighbor.neighborId) ?? Infinity;

        if (newDist < existingDist) {
          distances.set(neighbor.neighborId, newDist);
          previous.set(neighbor.neighborId, currentId);
          unvisitedNodes.push({ id: neighbor.neighborId, dist: newDist });
        }
      }
    }

    // No path found (disconnected components)
    return null;
  }

  private generateStraightLineCoordinates(stations: Station[]): [number, number][] {
    const coords: [number, number][] = [];
    for (let i = 0; i < stations.length - 1; i++) {
      const stA = stations[i];
      const stB = stations[i + 1];
      const pts = this.interpolatePoints(stA.lat || 0, stA.lng || 0, stB.lat || 0, stB.lng || 0);
      if (i === 0) {
        coords.push(...pts);
      } else {
        coords.push(...pts.slice(1));
      }
    }
    return coords;
  }

  interpolatePoints(lat1: number, lon1: number, lat2: number, lon2: number, steps = 15): [number, number][] {
    const pts: [number, number][] = [];
    for (let s = 0; s <= steps; s++) {
      const frac = s / steps;
      const lat = lat1 + (lat2 - lat1) * frac;
      const lon = lon1 + (lon2 - lon1) * frac;
      pts.push([Math.round(lon * 1e6) / 1e6, Math.round(lat * 1e6) / 1e6]);
    }
    return pts;
  }
}
