const fetch = globalThis.fetch || require('node-fetch');

function haversineDistKm(lat1, lon1, lat2, lon2) {
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

// Spatial graph builder with configurable coordinate precision (snapping)
function buildGraph(elements, precision = 4, endpointSnapToleranceMeters = 30) {
  const nodeMap = new Map();

  const getNodeKey = (lat, lon) => `${lat.toFixed(precision)},${lon.toFixed(precision)}`;

  const getOrCreateNode = (lat, lon) => {
    const key = getNodeKey(lat, lon);
    let node = nodeMap.get(key);
    if (!node) {
      node = {
        id: key,
        lat,
        lon,
        neighbors: []
      };
      nodeMap.set(key, node);
    }
    return node;
  };

  let wayCount = 0;
  let rawNodeCount = 0;

  // Track way endpoint nodes to allow slight snapping between consecutive rail segments
  const wayEndpoints = [];

  for (const el of elements) {
    if (el.type === 'way' && el.geometry && el.geometry.length >= 2) {
      wayCount++;
      rawNodeCount += el.geometry.length;

      const firstPt = el.geometry[0];
      const lastPt = el.geometry[el.geometry.length - 1];

      for (let i = 0; i < el.geometry.length - 1; i++) {
        const p1 = el.geometry[i];
        const p2 = el.geometry[i + 1];

        const node1 = getOrCreateNode(p1.lat, p1.lon);
        const node2 = getOrCreateNode(p2.lat, p2.lon);

        if (node1.id !== node2.id) {
          const weight = haversineDistKm(node1.lat, node1.lon, node2.lat, node2.lon);

          if (!node1.neighbors.some(n => n.neighborId === node2.id)) {
            node1.neighbors.push({ neighborId: node2.id, weightKm: weight });
          }
          if (!node2.neighbors.some(n => n.neighborId === node1.id)) {
            node2.neighbors.push({ neighborId: node1.id, weightKm: weight });
          }
        }
      }

      wayEndpoints.push(getOrCreateNode(firstPt.lat, firstPt.lon));
      wayEndpoints.push(getOrCreateNode(lastPt.lat, lastPt.lon));
    }
  }

  // Connect close endpoints if within endpointSnapToleranceMeters
  if (endpointSnapToleranceMeters > 0) {
    for (let i = 0; i < wayEndpoints.length; i++) {
      for (let j = i + 1; j < wayEndpoints.length; j++) {
        const n1 = wayEndpoints[i];
        const n2 = wayEndpoints[j];
        if (n1.id !== n2.id) {
          const dMeters = haversineDistKm(n1.lat, n1.lon, n2.lat, n2.lon) * 1000;
          if (dMeters <= endpointSnapToleranceMeters) {
            const weightKm = dMeters / 1000;
            if (!n1.neighbors.some(n => n.neighborId === n2.id)) {
              n1.neighbors.push({ neighborId: n2.id, weightKm });
            }
            if (!n2.neighbors.some(n => n.neighborId === n1.id)) {
              n2.neighbors.push({ neighborId: n1.id, weightKm });
            }
          }
        }
      }
    }
  }

  const nodes = Array.from(nodeMap.values());
  let edgeCount = 0;
  for (const n of nodes) {
    edgeCount += n.neighbors.length;
  }
  edgeCount = Math.floor(edgeCount / 2); // undirected

  return { nodes, nodeMap, wayCount, rawNodeCount, edgeCount };
}

// Compute Connected Components using BFS
function computeConnectedComponents(nodes, nodeMap) {
  const visited = new Set();
  const components = [];
  const nodeComponentMap = new Map();

  for (const node of nodes) {
    if (!visited.has(node.id)) {
      const component = [];
      const queue = [node.id];
      visited.add(node.id);
      const compId = components.length;

      while (queue.length > 0) {
        const currentId = queue.shift();
        component.push(currentId);
        nodeComponentMap.set(currentId, compId);

        const currNode = nodeMap.get(currentId);
        if (currNode) {
          for (const nb of currNode.neighbors) {
            if (!visited.has(nb.neighborId)) {
              visited.add(nb.neighborId);
              queue.push(nb.neighborId);
            }
          }
        }
      }
      components.push(component);
    }
  }

  // Sort components by size descending
  components.sort((a, b) => b.length - a.length);
  return { components, nodeComponentMap, totalComponents: components.length };
}

function findNearestNode(lat, lon, nodes) {
  let nearest = null;
  let minDistance = Infinity;

  for (const node of nodes) {
    const d = haversineDistKm(lat, lon, node.lat, node.lon);
    if (d < minDistance) {
      minDistance = d;
      nearest = node;
    }
  }
  return { node: nearest, distanceKm: minDistance };
}

function dijkstra(startId, endId, nodeMap) {
  if (startId === endId) return { path: [startId], totalKm: 0 };
  const distances = new Map();
  const previous = new Map();
  const visited = new Set();
  const unvisited = [{ id: startId, dist: 0 }];
  distances.set(startId, 0);

  while (unvisited.length > 0) {
    unvisited.sort((a, b) => a.dist - b.dist);
    const { id: currentId, dist: currentDist } = unvisited.shift();

    if (visited.has(currentId)) continue;
    visited.add(currentId);

    if (currentId === endId) {
      const path = [];
      let curr = endId;
      while (curr) {
        path.unshift(curr);
        curr = previous.get(curr) || null;
      }
      return { path, totalKm: currentDist };
    }

    const node = nodeMap.get(currentId);
    if (!node) continue;

    for (const nb of node.neighbors) {
      if (visited.has(nb.neighborId)) continue;
      const newDist = currentDist + nb.weightKm;
      const existing = distances.get(nb.neighborId) ?? Infinity;
      if (newDist < existing) {
        distances.set(nb.neighborId, newDist);
        previous.set(nb.neighborId, currentId);
        unvisited.push({ id: nb.neighborId, dist: newDist });
      }
    }
  }
  return null;
}

async function queryOverpass(minLat, minLon, maxLat, maxLon) {
  const query = `[out:json][timeout:25]; (way["railway"="rail"](${minLat},${minLon},${maxLat},${maxLon});); out geom;`;
  const res = await fetch('https://overpass-api.de/api/interpreter', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'User-Agent': 'NexusWays-RailwaySimulation/1.0 (https://nexusways.io; operational-routing)',
      'Accept': 'application/json'
    },
    body: `data=${encodeURIComponent(query)}`
  });

  if (!res.ok) {
    throw new Error(`Overpass returned HTTP ${res.status}: ${res.statusText}`);
  }
  const json = await res.json();
  return { query, elements: json.elements || [] };
}

async function diagnoseCorridor(name, stA, stB, padding = 0.08, precision = 4, snapMeters = 0) {
  console.log('================================================================');
  console.log(`DIAGNOSTIC: Corridor "${name}" (Padding: ${padding}°, Snap: ${snapMeters}m)`);
  console.log('================================================================');
  console.log(`Station A (Origin):      ${stA.name} [Lat: ${stA.lat}, Lon: ${stA.lon}]`);
  console.log(`Station B (Destination): ${stB.name} [Lat: ${stB.lat}, Lon: ${stB.lon}]`);

  const geoDistKm = haversineDistKm(stA.lat, stA.lon, stB.lat, stB.lon);
  console.log(`Straight-line Geodesic:  ${geoDistKm.toFixed(2)} km`);

  const minLat = Math.min(stA.lat, stB.lat) - padding;
  const maxLat = Math.max(stA.lat, stB.lat) + padding;
  const minLon = Math.min(stA.lon, stB.lon) - padding;
  const maxLon = Math.max(stA.lon, stB.lon) + padding;

  console.log(`Bounding Box:            [${minLat.toFixed(4)}, ${minLon.toFixed(4)}] to [${maxLat.toFixed(4)}, ${maxLon.toFixed(4)}]`);

  const t0 = Date.now();
  let queryResult;
  try {
    queryResult = await queryOverpass(minLat, minLon, maxLat, maxLon);
  } catch (err) {
    console.error(`Overpass Query Failed: ${err.message}`);
    return;
  }
  const queryTime = Date.now() - t0;
  console.log(`Overpass Latency:        ${queryTime} ms`);
  console.log(`Raw Overpass Elements:   ${queryResult.elements.length} elements returned`);
  console.log(`Overpass Query Text:\n  ${queryResult.query}\n`);

  // Build graph
  const { nodes, nodeMap, wayCount, rawNodeCount, edgeCount } = buildGraph(queryResult.elements, precision, snapMeters);
  console.log(`Graph Build Metrics:`);
  console.log(`  - Ways Parsed:          ${wayCount}`);
  console.log(`  - Raw Nodes in Ways:    ${rawNodeCount}`);
  console.log(`  - Unique Graph Vertices: ${nodes.length}`);
  console.log(`  - Graph Edges:          ${edgeCount}`);

  // Coordinate Order Verification
  if (queryResult.elements.length > 0 && queryResult.elements[0].geometry) {
    const samplePt = queryResult.elements[0].geometry[0];
    console.log(`  - Coordinate Order Check:`);
    console.log(`    Sample OSM node geometry: { lat: ${samplePt.lat}, lon: ${samplePt.lon} }`);
    console.log(`    Parsed node in graph:     id="${nodes[0]?.id}", lat=${nodes[0]?.lat}, lon=${nodes[0]?.lon}`);
    const checkDist = haversineDistKm(samplePt.lat, samplePt.lon, nodes[0]?.lat, nodes[0]?.lon);
    console.log(`    Coordinate order consistency: ${checkDist < 0.05 ? 'MATCHED (lat/lon correctly aligned)' : 'MISMATCH DETECTED'}`);
  }

  // Connected Components
  const { components, nodeComponentMap, totalComponents } = computeConnectedComponents(nodes, nodeMap);
  console.log(`  - Connected Components: ${totalComponents}`);
  if (components.length > 0) {
    console.log(`    Top 5 component sizes: ${components.slice(0, 5).map(c => c.length).join(', ')} vertices`);
  }

  // Snapping Origin and Destination
  const nearestA = findNearestNode(stA.lat, stA.lon, nodes);
  const nearestB = findNearestNode(stB.lat, stB.lon, nodes);

  console.log(`\nStation Snapping Analysis:`);
  console.log(`  Origin (${stA.name}):`);
  console.log(`    - Nearest Node ID:    ${nearestA.node?.id}`);
  console.log(`    - Distance to Track:  ${nearestA.distanceKm.toFixed(3)} km (${(nearestA.distanceKm * 1000).toFixed(1)} m)`);
  const compIdA = nearestA.node ? nodeComponentMap.get(nearestA.node.id) : -1;
  console.log(`    - Component Index:    #${compIdA} (Component size: ${components[compIdA]?.length || 0} nodes)`);

  console.log(`  Destination (${stB.name}):`);
  console.log(`    - Nearest Node ID:    ${nearestB.node?.id}`);
  console.log(`    - Distance to Track:  ${nearestB.distanceKm.toFixed(3)} km (${(nearestB.distanceKm * 1000).toFixed(1)} m)`);
  const compIdB = nearestB.node ? nodeComponentMap.get(nearestB.node.id) : -1;
  console.log(`    - Component Index:    #${compIdB} (Component size: ${components[compIdB]?.length || 0} nodes)`);

  const sameComponent = compIdA !== -1 && compIdB !== -1 && compIdA === compIdB;
  console.log(`\nConnectivity Verdict:`);
  console.log(`  - Are Origin & Destination in the SAME connected component? ${sameComponent ? 'YES! (Path exists)' : 'NO (Disconnected components)'}`);

  if (sameComponent) {
    const dijkstraResult = dijkstra(nearestA.node.id, nearestB.node.id, nodeMap);
    if (dijkstraResult) {
      console.log(`  - Dijkstra Shortest Path: FOUND!`);
      console.log(`    Path Vertex Count: ${dijkstraResult.path.length}`);
      console.log(`    Calculated Rail Distance: ${dijkstraResult.totalKm.toFixed(2)} km`);
      console.log(`    Ratio vs Geodesic: ${(dijkstraResult.totalKm / geoDistKm).toFixed(2)}x (Sanity check: ${dijkstraResult.totalKm <= 3.0 * geoDistKm ? 'PASS' : 'FAIL'})`);
    } else {
      console.log(`  - Dijkstra returned NO path despite same component tag.`);
    }
  } else {
    console.log(`  - Direct Overpass path routing CANNOT bridge the disconnected graph components in OSM data for this bounding box.`);
  }
  console.log('\n');
}

async function runAllDiagnostics() {
  const csmt = { name: 'Chhatrapati Shivaji Terminus (CSMT)', lat: 18.939856, lon: 72.8355191 };
  const pune = { name: 'Pune Junction (PUNE)', lat: 18.5288773, lon: 73.8744146 };

  const ndls = { name: 'New Delhi Railway Station (NDLS)', lat: 28.6429, lon: 77.2195 };
  const agc = { name: 'Agra Cantt Railway Station (AGC)', lat: 27.1584, lon: 78.0098 };

  const mas = { name: 'Chennai Central (MAS)', lat: 13.0827, lon: 80.2755 };
  const sbc = { name: 'KSR Bengaluru City (SBC)', lat: 12.9784, lon: 77.5714 };

  // Section 1: Standard Bounding Box CSMT -> Pune
  await diagnoseCorridor('CSMT -> Pune (Standard 0.08° Padding, No Snap)', csmt, pune, 0.08, 4, 0);

  // Section 2: Larger Bounding Box CSMT -> Pune
  await diagnoseCorridor('CSMT -> Pune (Deliberately Larger 0.25° Padding, No Snap)', csmt, pune, 0.25, 4, 0);

  // Section 2b: Larger Bounding Box CSMT -> Pune with Endpoint Micro-Snapping (30m)
  await diagnoseCorridor('CSMT -> Pune (0.25° Padding + 30m Endpoint Snap)', csmt, pune, 0.25, 4, 30);

  // Section 3: Corridor 2 - New Delhi to Agra Cantt
  await diagnoseCorridor('New Delhi -> Agra Cantt (0.08° Padding)', ndls, agc, 0.08, 4, 0);
  await diagnoseCorridor('New Delhi -> Agra Cantt (0.20° Padding + 30m Endpoint Snap)', ndls, agc, 0.20, 4, 30);

  // Section 3: Corridor 3 - Chennai Central to KSR Bengaluru
  await diagnoseCorridor('Chennai Central -> KSR Bengaluru (0.08° Padding)', mas, sbc, 0.08, 4, 0);
  await diagnoseCorridor('Chennai Central -> KSR Bengaluru (0.25° Padding + 30m Endpoint Snap)', mas, sbc, 0.25, 4, 30);
}

runAllDiagnostics().catch(err => {
  console.error('Diagnostic failed:', err);
});
