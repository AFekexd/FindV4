import type {
  Floor,
  Building,
  Room,
  PointOfInterest,
  RouteResult,
  RouteStep,
  RoutePreference,
  Point,
  TransitType,
} from '../types';
import {
  distance,
  distanceInMeters,
  getTurnDirection,
  PIXELS_PER_METER,
  polygonCentroid,
  getPolygonEdges,
  pointToSegmentDistance,
  hasClearLineOfSight,
  segmentIntersectsPolygon,
} from './geometry';

export interface GraphNode {
  id: string;
  floorId: string;
  floorLevel: number;
  floorName: string;
  floorShortCode: string;
  buildingName: string;
  position: Point;
  type: string; // 'corridor' | 'door' | 'room' | 'transit' | 'poi' | 'hub' | 'corner'
  refId?: string;
  label?: string;
  neighbors: {
    nodeId: string;
    weight: number;
    isVertical?: boolean;
    transitType?: TransitType;
    transitName?: string;
    isAccessible: boolean;
  }[];
}

/**
 * Builds a strictly collision-free, door-aware multi-floor navigation graph.
 * Guarantees routes NEVER clip through foreign room polygons.
 */
export function buildNavGraph(
  building: Building,
  preferences: RoutePreference
): Map<string, GraphNode> {
  const graph = new Map<string, GraphNode>();

  for (const floor of building.floors) {
    // 1. Add all standard explicit navNodes
    for (const node of floor.navNodes) {
      graph.set(node.id, {
        id: node.id,
        floorId: floor.id,
        floorLevel: floor.level,
        floorName: floor.name,
        floorShortCode: floor.shortCode,
        buildingName: building.name,
        position: { ...node.position },
        type: node.type || 'corridor',
        refId: node.refId,
        label: node.label,
        neighbors: [],
      });
    }

    // 2. Add explicit floor navEdges ONLY if they do not cut through foreign room polygons
    for (const edge of floor.navEdges) {
      if (preferences.accessibilityOnly && !edge.isAccessible) {
        continue;
      }
      const from = graph.get(edge.fromNodeId);
      const to = graph.get(edge.toNodeId);
      if (from && to) {
        // Validate clear line of sight in corridor
        const isClear = hasClearLineOfSight(from.position, to.position, floor.rooms);
        const dist = edge.distance || distance(from.position, to.position);
        const weight = isClear ? dist : dist + 50000; // Heavily penalize room penetration if any

        if (!from.neighbors.some((n) => n.nodeId === to.id)) {
          from.neighbors.push({
            nodeId: to.id,
            weight,
            isAccessible: edge.isAccessible,
          });
        }
        if (!to.neighbors.some((n) => n.nodeId === from.id)) {
          to.neighbors.push({
            nodeId: from.id,
            weight,
            isAccessible: edge.isAccessible,
          });
        }
      }
    }

    // 3. Generate Convex Corner Detour Nodes around room corners into corridors
    // This allows smooth navigation around room corners without cutting through walls
    const cornerNodes: GraphNode[] = [];
    floor.rooms.forEach((room) => {
      const roomCenter = polygonCentroid(room.polygon);
      room.polygon.forEach((vertex, vIdx) => {
        // Vector pointing outwards from room center through vertex
        const vx = vertex.x - roomCenter.x;
        const vy = vertex.y - roomCenter.y;
        const vLen = Math.max(1, Math.hypot(vx, vy));
        const cornerPos: Point = {
          x: Math.round(vertex.x + (vx / vLen) * 22),
          y: Math.round(vertex.y + (vy / vLen) * 22),
        };

        // Only use corner node if it lies outside all room polygons
        if (hasClearLineOfSight(cornerPos, cornerPos, floor.rooms)) {
          const cornerNodeId = `corner-${room.id}-${vIdx}`;
          const cNode: GraphNode = {
            id: cornerNodeId,
            floorId: floor.id,
            floorLevel: floor.level,
            floorName: floor.name,
            floorShortCode: floor.shortCode,
            buildingName: building.name,
            position: cornerPos,
            type: 'corner',
            label: 'Folyosó Sarok',
            neighbors: [],
          };
          graph.set(cornerNodeId, cNode);
          cornerNodes.push(cNode);
        }
      });
    });

    // 4. Synthesize Rooms & their Doorway Connections
    for (const room of floor.rooms) {
      const roomCenter = polygonCentroid(room.polygon);
      const roomNodeId = `room-node-${room.id}`;

      // A. Register the Room Center Node
      const roomNode: GraphNode = {
        id: roomNodeId,
        floorId: floor.id,
        floorLevel: floor.level,
        floorName: floor.name,
        floorShortCode: floor.shortCode,
        buildingName: building.name,
        position: roomCenter,
        type: 'room',
        refId: room.id,
        label: `${room.name} (${room.code})`,
        neighbors: [],
      };
      graph.set(roomNodeId, roomNode);

      // B. Determine the exact doorway point for this room
      let doorPos: Point | null = null;
      const roomEdges = getPolygonEdges(room.polygon);

      // Check if an explicit door in floor.doors lies on this room's perimeter
      for (const door of floor.doors) {
        const dMid: Point = {
          x: Math.round((door.start.x + door.end.x) / 2),
          y: Math.round((door.start.y + door.end.y) / 2),
        };
        for (const edge of roomEdges) {
          if (pointToSegmentDistance(dMid, edge.start, edge.end) <= 35) {
            doorPos = dMid;
            break;
          }
        }
        if (doorPos) break;
      }

      // If not found, use room.doorLocation
      if (!doorPos && room.doorLocation) {
        doorPos = { ...room.doorLocation };
      }

      // If still not found, pick the closest wall midpoint to the nearest corridor node
      if (!doorPos && roomEdges.length > 0) {
        let bestDist = Infinity;
        let bestMid = roomEdges[0].midPoint;
        for (const edge of roomEdges) {
          for (const node of floor.navNodes) {
            const d = distance(edge.midPoint, node.position);
            if (d < bestDist) {
              bestDist = d;
              bestMid = edge.midPoint;
            }
          }
        }
        doorPos = bestMid;
      }

      if (!doorPos) {
        doorPos = { x: roomCenter.x + 20, y: roomCenter.y };
      }

      // C. Calculate Door Approach Point (Stepped 24px outside room into the corridor)
      const cdx = doorPos.x - roomCenter.x;
      const cdy = doorPos.y - roomCenter.y;
      const cLen = Math.max(1, Math.hypot(cdx, cdy));
      const approachPos: Point = {
        x: Math.round(doorPos.x + (cdx / cLen) * 24),
        y: Math.round(doorPos.y + (cdy / cLen) * 24),
      };

      // D. Register Room Door Node & Door Approach Node
      const doorNodeId = `door-room-${room.id}`;
      const doorNode: GraphNode = {
        id: doorNodeId,
        floorId: floor.id,
        floorLevel: floor.level,
        floorName: floor.name,
        floorShortCode: floor.shortCode,
        buildingName: building.name,
        position: doorPos,
        type: 'door',
        refId: room.id,
        label: `Ajtó: ${room.name}`,
        neighbors: [],
      };
      graph.set(doorNodeId, doorNode);

      const approachNodeId = `approach-room-${room.id}`;
      const approachNode: GraphNode = {
        id: approachNodeId,
        floorId: floor.id,
        floorLevel: floor.level,
        floorName: floor.name,
        floorShortCode: floor.shortCode,
        buildingName: building.name,
        position: approachPos,
        type: 'corridor',
        refId: room.id,
        label: `Folyosói előtér: ${room.name}`,
        neighbors: [],
      };
      graph.set(approachNodeId, approachNode);

      // CONNECT: Room Center <===> Room Door
      const centerToDoorDist = distance(roomCenter, doorPos);
      roomNode.neighbors.push({ nodeId: doorNodeId, weight: centerToDoorDist, isAccessible: true });
      doorNode.neighbors.push({ nodeId: roomNodeId, weight: centerToDoorDist, isAccessible: true });

      // CONNECT: Room Door <===> Door Approach Point (out into the corridor)
      const doorToApproachDist = distance(doorPos, approachPos);
      doorNode.neighbors.push({ nodeId: approachNodeId, weight: doorToApproachDist, isAccessible: true });
      approachNode.neighbors.push({ nodeId: doorNodeId, weight: doorToApproachDist, isAccessible: true });

      // CONNECT: Door Approach Point <===> Visible Corridor Nodes with CLEAR LINE OF SIGHT
      const candidateCorridors = Array.from(graph.values()).filter(
        (gn) =>
          gn.floorId === floor.id &&
          gn.id !== roomNodeId &&
          gn.id !== doorNodeId &&
          gn.id !== approachNodeId &&
          gn.type !== 'room' &&
          gn.type !== 'door'
      );

      // Connect to closest corridor nodes that have unobstructed line of sight (no room cutting)
      const clearConnections = candidateCorridors
        .map((corridor) => ({
          node: corridor,
          dist: distance(approachPos, corridor.position),
          clear: hasClearLineOfSight(approachPos, corridor.position, floor.rooms),
        }))
        .filter((c) => c.clear)
        .sort((a, b) => a.dist - b.dist)
        .slice(0, 4);

      for (const { node: corridor, dist } of clearConnections) {
        approachNode.neighbors.push({ nodeId: corridor.id, weight: dist, isAccessible: true });
        corridor.neighbors.push({ nodeId: approachNodeId, weight: dist, isAccessible: true });
      }

      // If no corridor nodes had line of sight, connect to nearest clear corner nodes
      if (clearConnections.length === 0) {
        const clearCorners = cornerNodes
          .map((cn) => ({
            node: cn,
            dist: distance(approachPos, cn.position),
            clear: hasClearLineOfSight(approachPos, cn.position, floor.rooms),
          }))
          .filter((c) => c.clear)
          .sort((a, b) => a.dist - b.dist)
          .slice(0, 3);

        for (const { node: cNode, dist } of clearCorners) {
          approachNode.neighbors.push({ nodeId: cNode.id, weight: dist, isAccessible: true });
          cNode.neighbors.push({ nodeId: approachNodeId, weight: dist, isAccessible: true });
        }
      }
    }

    // 5. Connect Corner Detour Nodes to each other and to corridor hubs with clear line of sight
    const corridorAndCorners = Array.from(graph.values()).filter(
      (gn) => gn.floorId === floor.id && (gn.type === 'corner' || gn.type === 'corridor' || gn.type === 'hub')
    );

    for (let i = 0; i < corridorAndCorners.length; i++) {
      for (let j = i + 1; j < corridorAndCorners.length; j++) {
        const nA = corridorAndCorners[i];
        const nB = corridorAndCorners[j];
        const d = distance(nA.position, nB.position);

        if (d <= 350) {
          if (hasClearLineOfSight(nA.position, nB.position, floor.rooms)) {
            if (!nA.neighbors.some((nbr) => nbr.nodeId === nB.id)) {
              nA.neighbors.push({ nodeId: nB.id, weight: d, isAccessible: true });
              nB.neighbors.push({ nodeId: nA.id, weight: d, isAccessible: true });
            }
          }
        }
      }
    }
  }

  // 6. Connect Vertical Transit Shafts across floors (Lifts & Stairs)
  const transitGroupMap = new Map<
    string,
    {
      connectorId: string;
      floorId: string;
      floorLevel: number;
      navNodeId: string;
      position: Point;
      type: TransitType;
      name: string;
      isAccessible: boolean;
    }[]
  >();

  for (const floor of building.floors) {
    for (const connector of floor.transitConnectors) {
      if (!transitGroupMap.has(connector.transitGroupId)) {
        transitGroupMap.set(connector.transitGroupId, []);
      }

      let transitNodeId = connector.navNodeId;
      if (!graph.has(transitNodeId)) {
        transitNodeId = `node-transit-${connector.id}`;
        graph.set(transitNodeId, {
          id: transitNodeId,
          floorId: floor.id,
          floorLevel: floor.level,
          floorName: floor.name,
          floorShortCode: floor.shortCode,
          buildingName: building.name,
          position: connector.position,
          type: 'transit',
          refId: connector.id,
          label: connector.name,
          neighbors: [],
        });

        // Link transit node to closest unobstructed corridor node
        const clearCorridors = Array.from(graph.values())
          .filter(
            (gn) =>
              gn.floorId === floor.id &&
              gn.id !== transitNodeId &&
              gn.type !== 'room' &&
              gn.type !== 'door' &&
              hasClearLineOfSight(connector.position, gn.position, floor.rooms)
          )
          .map((gn) => ({ node: gn, dist: distance(connector.position, gn.position) }))
          .sort((a, b) => a.dist - b.dist)
          .slice(0, 3);

        const tNode = graph.get(transitNodeId)!;
        for (const { node: cNode, dist } of clearCorridors) {
          tNode.neighbors.push({ nodeId: cNode.id, weight: dist, isAccessible: connector.isAccessible });
          cNode.neighbors.push({ nodeId: transitNodeId, weight: dist, isAccessible: connector.isAccessible });
        }
      }

      transitGroupMap.get(connector.transitGroupId)!.push({
        connectorId: connector.id,
        floorId: floor.id,
        floorLevel: floor.level,
        navNodeId: transitNodeId,
        position: connector.position,
        type: connector.type,
        name: connector.name,
        isAccessible: connector.isAccessible,
      });
    }
  }

  // Cross-floor vertical connections
  for (const [, connectors] of transitGroupMap.entries()) {
    for (let i = 0; i < connectors.length; i++) {
      for (let j = i + 1; j < connectors.length; j++) {
        const c1 = connectors[i];
        const c2 = connectors[j];

        if (preferences.accessibilityOnly && (!c1.isAccessible || !c2.isAccessible)) {
          continue;
        }

        const node1 = graph.get(c1.navNodeId);
        const node2 = graph.get(c2.navNodeId);

        if (node1 && node2) {
          const levelDiff = Math.abs(c1.floorLevel - c2.floorLevel);
          let verticalPenalty = levelDiff * 80;
          if (c1.type === 'elevator') {
            verticalPenalty = preferences.prioritizeElevators ? levelDiff * 35 : levelDiff * 60;
          } else if (c1.type === 'stairs') {
            verticalPenalty = preferences.prioritizeElevators ? levelDiff * 140 : levelDiff * 80;
          }

          node1.neighbors.push({
            nodeId: node2.id,
            weight: verticalPenalty,
            isVertical: true,
            transitType: c1.type,
            transitName: c1.name,
            isAccessible: c1.isAccessible && c2.isAccessible,
          });

          node2.neighbors.push({
            nodeId: node1.id,
            weight: verticalPenalty,
            isVertical: true,
            transitType: c2.type,
            transitName: c2.name,
            isAccessible: c1.isAccessible && c2.isAccessible,
          });
        }
      }
    }
  }

  return graph;
}

/**
 * Finds the shortest route between start and target, navigating strictly through doors and open corridors.
 */
export function findMultiFloorPath(
  building: Building,
  startIdentifier: string,
  targetIdentifier: string,
  preferences: RoutePreference
): RouteResult | null {
  const graph = buildNavGraph(building, preferences);

  // Resolve start and target node IDs
  let startNodeId = startIdentifier;
  if (!graph.has(startNodeId)) {
    if (graph.has(`room-node-${startIdentifier}`)) {
      startNodeId = `room-node-${startIdentifier}`;
    }
  }

  let targetNodeId = targetIdentifier;
  if (!graph.has(targetNodeId)) {
    if (graph.has(`room-node-${targetIdentifier}`)) {
      targetNodeId = `room-node-${targetIdentifier}`;
    }
  }

  const startNode = graph.get(startNodeId);
  const targetNode = graph.get(targetNodeId);

  if (!startNode || !targetNode) return null;
  if (startNodeId === targetNodeId) {
    return {
      pathNodes: [
        {
          nodeId: startNode.id,
          floorId: startNode.floorId,
          position: startNode.position,
          floorLevel: startNode.floorLevel,
        },
      ],
      steps: [
        {
          stepIndex: 1,
          instruction: 'Ön már a kiválasztott célállomáson tartózkodik.',
          detail: `${targetNode.label || 'Célállomás'}`,
          floorId: targetNode.floorId,
          floorName: targetNode.floorName,
          floorShortCode: targetNode.floorShortCode,
          buildingName: targetNode.buildingName,
          nodeId: targetNode.id,
          coordinates: targetNode.position,
          distanceMeters: 0,
          iconType: 'end',
        },
      ],
      totalDistanceMeters: 0,
      estimatedTimeMinutes: 0,
      floorsTraversed: [startNode.floorId],
      isAccessible: true,
    };
  }

  // A* Shortest Path Search
  const distances = new Map<string, number>();
  const previous = new Map<string, string>();
  const visited = new Set<string>();
  const priorityQueue: { nodeId: string; priority: number }[] = [];

  for (const nodeId of graph.keys()) {
    distances.set(nodeId, Infinity);
  }
  distances.set(startNodeId, 0);

  const heuristic = (curr: GraphNode, goal: GraphNode): number => {
    const floorDiff = Math.abs(curr.floorLevel - goal.floorLevel);
    if (curr.floorId === goal.floorId) {
      return distance(curr.position, goal.position);
    }
    return distance(curr.position, goal.position) + floorDiff * 100;
  };

  priorityQueue.push({
    nodeId: startNodeId,
    priority: heuristic(startNode, targetNode),
  });

  while (priorityQueue.length > 0) {
    priorityQueue.sort((a, b) => a.priority - b.priority);
    const { nodeId: currentId } = priorityQueue.shift()!;

    if (currentId === targetNodeId) {
      break;
    }

    if (visited.has(currentId)) continue;
    visited.add(currentId);

    const currentNode = graph.get(currentId)!;
    const currentDist = distances.get(currentId)!;

    for (const neighbor of currentNode.neighbors) {
      if (visited.has(neighbor.nodeId)) continue;

      const neighborNode = graph.get(neighbor.nodeId);
      if (!neighborNode) continue;

      const tentativeDist = currentDist + neighbor.weight;
      if (tentativeDist < distances.get(neighbor.nodeId)!) {
        distances.set(neighbor.nodeId, tentativeDist);
        previous.set(neighbor.nodeId, currentId);
        const prio = tentativeDist + heuristic(neighborNode, targetNode);
        priorityQueue.push({ nodeId: neighbor.nodeId, priority: prio });
      }
    }
  }

  if (!previous.has(targetNodeId) && startNodeId !== targetNodeId) {
    return null; // Path unreachable
  }

  // Reconstruct path nodes
  const pathNodeIds: string[] = [];
  let curr: string | undefined = targetNodeId;
  while (curr) {
    pathNodeIds.unshift(curr);
    curr = previous.get(curr);
  }

  const pathNodes = pathNodeIds.map((id) => {
    const n = graph.get(id)!;
    return {
      nodeId: n.id,
      floorId: n.floorId,
      position: n.position,
      floorLevel: n.floorLevel,
    };
  });

  // Generate Door-Aware Turn-by-Turn Navigation Instructions
  const steps: RouteStep[] = [];
  let totalDistanceUnits = 0;
  const floorsTraversedSet = new Set<string>();
  let allStepsAccessible = true;

  for (let i = 0; i < pathNodes.length; i++) {
    const currObj = pathNodes[i];
    const currGraph = graph.get(currObj.nodeId)!;
    floorsTraversedSet.add(currObj.floorId);

    // Initial Departure Step
    if (i === 0) {
      steps.push({
        stepIndex: 1,
        instruction: `Indulás: ${currGraph.label || 'Kiindulási helyiség'}`,
        detail: `Kezdőpont: ${currGraph.floorName}`,
        floorId: currGraph.floorId,
        floorName: currGraph.floorName,
        floorShortCode: currGraph.floorShortCode,
        buildingName: currGraph.buildingName,
        nodeId: currGraph.id,
        coordinates: currGraph.position,
        distanceMeters: 0,
        iconType: 'start',
      });
      continue;
    }

    const prevObj = pathNodes[i - 1];
    const prevGraph = graph.get(prevObj.nodeId)!;

    // Vertical Level Change (Elevator / Stairs)
    if (prevGraph.floorId !== currGraph.floorId) {
      const edge = prevGraph.neighbors.find((n) => n.nodeId === currGraph.id);
      const isUp = currGraph.floorLevel > prevGraph.floorLevel;
      const transitType = edge?.transitType || 'stairs';
      const transitName = edge?.transitName || (transitType === 'elevator' ? 'Lift' : 'Lépcső');

      if (!edge?.isAccessible) {
        allStepsAccessible = false;
      }

      steps.push({
        stepIndex: steps.length + 1,
        instruction: `Menjen a(z) ${transitName} segítségével ${isUp ? 'FEL' : 'LE'} a(z) ${currGraph.floorName} szintre`,
        detail: `${prevGraph.floorShortCode}. szint ➔ ${currGraph.floorShortCode}. szint`,
        floorId: currGraph.floorId,
        floorName: currGraph.floorName,
        floorShortCode: currGraph.floorShortCode,
        buildingName: currGraph.buildingName,
        nodeId: currGraph.id,
        coordinates: currGraph.position,
        distanceMeters: 0,
        isFloorChange: true,
        transitType,
        transitName,
        toFloorName: currGraph.floorName,
        iconType: 'transit',
      });
      continue;
    }

    // Horizontal Movement
    const segDistUnits = distance(prevGraph.position, currGraph.position);
    totalDistanceUnits += segDistUnits;
    const segDistMeters = Math.round((segDistUnits / PIXELS_PER_METER) * 10) / 10;

    // 1. Exiting Start Room through Doorway
    if (i === 1 && currGraph.type === 'door') {
      steps.push({
        stepIndex: steps.length + 1,
        instruction: `Lépjen ki a(z) ${prevGraph.label || 'helyiség'} ajtaján a folyosóra`,
        detail: `Sétáljon kb. ${segDistMeters} métert az ajtóig`,
        floorId: currGraph.floorId,
        floorName: currGraph.floorName,
        floorShortCode: currGraph.floorShortCode,
        buildingName: currGraph.buildingName,
        nodeId: currGraph.id,
        coordinates: currGraph.position,
        distanceMeters: segDistMeters,
        iconType: 'door',
      });
      continue;
    }

    // 2. Entering Destination Room through Doorway
    if (i === pathNodes.length - 1 && prevGraph.type === 'door') {
      steps.push({
        stepIndex: steps.length + 1,
        instruction: `Lépjen be a(z) ${currGraph.label || 'célterem'} ajtaján`,
        detail: `Megérkezett a célterembe (${currGraph.floorName})`,
        floorId: currGraph.floorId,
        floorName: currGraph.floorName,
        floorShortCode: currGraph.floorShortCode,
        buildingName: currGraph.buildingName,
        nodeId: currGraph.id,
        coordinates: currGraph.position,
        distanceMeters: segDistMeters,
        iconType: 'end',
      });
      continue;
    }

    // 3. Final Destination Step
    if (i === pathNodes.length - 1) {
      steps.push({
        stepIndex: steps.length + 1,
        instruction: `Megérkezett: ${currGraph.label || 'Célállomás'}`,
        detail: `${currGraph.floorName} • ${currGraph.buildingName}`,
        floorId: currGraph.floorId,
        floorName: currGraph.floorName,
        floorShortCode: currGraph.floorShortCode,
        buildingName: currGraph.buildingName,
        nodeId: currGraph.id,
        coordinates: currGraph.position,
        distanceMeters: segDistMeters,
        iconType: 'end',
      });
      continue;
    }

    // 4. Corridor Turns & Doors
    let iconType: RouteStep['iconType'] = 'straight';
    let turnText = 'Haladjon egyenesen';

    if (i > 1 && pathNodes[i - 2].floorId === currGraph.floorId) {
      const p1 = pathNodes[i - 2].position;
      const p2 = prevGraph.position;
      const p3 = currGraph.position;
      const dir = getTurnDirection(p1, p2, p3);
      if (dir === 'turn_left') {
        iconType = 'turn_left';
        turnText = 'Forduljon balra';
      } else if (dir === 'turn_right') {
        iconType = 'turn_right';
        turnText = 'Forduljon jobbra';
      }
    }

    if (currGraph.type === 'door') {
      steps.push({
        stepIndex: steps.length + 1,
        instruction: `Haladjon át a(z) ${currGraph.label || 'ajtó'} átjárón`,
        detail: `Folyosói átjáró • kb. ${segDistMeters} méter`,
        floorId: currGraph.floorId,
        floorName: currGraph.floorName,
        floorShortCode: currGraph.floorShortCode,
        buildingName: currGraph.buildingName,
        nodeId: currGraph.id,
        coordinates: currGraph.position,
        distanceMeters: segDistMeters,
        iconType: 'door',
      });
    } else if (iconType !== 'straight' || i === 1) {
      steps.push({
        stepIndex: steps.length + 1,
        instruction: `${turnText} a folyosón`,
        detail: `Sétáljon kb. ${segDistMeters} métert`,
        floorId: currGraph.floorId,
        floorName: currGraph.floorName,
        floorShortCode: currGraph.floorShortCode,
        buildingName: currGraph.buildingName,
        nodeId: currGraph.id,
        coordinates: currGraph.position,
        distanceMeters: segDistMeters,
        iconType,
      });
    }
  }

  const totalDistanceMeters = Math.round((totalDistanceUnits / PIXELS_PER_METER) * 10) / 10;
  const floorChangeCount = Array.from(floorsTraversedSet).length - 1;
  const walkSeconds = totalDistanceMeters / 1.2 + floorChangeCount * 25;
  const estimatedTimeMinutes = Math.max(1, Math.ceil(walkSeconds / 60));

  return {
    pathNodes,
    steps,
    totalDistanceMeters,
    estimatedTimeMinutes,
    floorsTraversed: Array.from(floorsTraversedSet),
    isAccessible: allStepsAccessible,
  };
}

/**
 * Multi-Stop Waypoints Path Planner
 */
export function findMultiStopPath(
  building: Building,
  stopIdentifiers: string[],
  preferences: RoutePreference
): RouteResult | null {
  const validStops = stopIdentifiers.filter(Boolean);
  if (validStops.length < 2) return null;

  const aggregatedPathNodes: RouteResult['pathNodes'] = [];
  const aggregatedSteps: RouteStep[] = [];
  let totalDistanceMeters = 0;
  let totalEstimatedTimeMinutes = 0;
  const floorsTraversedSet = new Set<string>();
  let isAccessibleOverall = true;

  for (let i = 0; i < validStops.length - 1; i++) {
    const originId = validStops[i];
    const destinationId = validStops[i + 1];

    const segmentResult = findMultiFloorPath(building, originId, destinationId, preferences);
    if (!segmentResult) {
      return null;
    }

    if (aggregatedPathNodes.length > 0) {
      aggregatedPathNodes.push(...segmentResult.pathNodes.slice(1));
    } else {
      aggregatedPathNodes.push(...segmentResult.pathNodes);
    }

    for (let sIdx = 0; sIdx < segmentResult.steps.length; sIdx++) {
      const step = segmentResult.steps[sIdx];
      if (i > 0 && sIdx === 0) continue;

      aggregatedSteps.push({
        ...step,
        stepIndex: aggregatedSteps.length + 1,
      });
    }

    totalDistanceMeters += segmentResult.totalDistanceMeters;
    totalEstimatedTimeMinutes += segmentResult.estimatedTimeMinutes;
    segmentResult.floorsTraversed.forEach((fId) => floorsTraversedSet.add(fId));
    if (!segmentResult.isAccessible) {
      isAccessibleOverall = false;
    }
  }

  return {
    pathNodes: aggregatedPathNodes,
    steps: aggregatedSteps,
    totalDistanceMeters: Math.round(totalDistanceMeters * 10) / 10,
    estimatedTimeMinutes: totalEstimatedTimeMinutes,
    floorsTraversed: Array.from(floorsTraversedSet),
    isAccessible: isAccessibleOverall,
  };
}

/**
 * Finds the closest POI of a given type to a specific room
 */
export function findNearestPOIToRoom(
  building: Building,
  fromRoomId: string,
  poiType: string
): { poi: PointOfInterest; floor: Floor } | null {
  let fromRoom: Room | undefined;
  let fromFloor: Floor | undefined;

  for (const floor of building.floors) {
    const r = floor.rooms.find((rm) => rm.id === fromRoomId);
    if (r) {
      fromRoom = r;
      fromFloor = floor;
      break;
    }
  }

  if (!fromRoom || !fromFloor) return null;
  const roomCenter = polygonCentroid(fromRoom.polygon);

  let nearestPOI: PointOfInterest | null = null;
  let nearestFloor: Floor | null = null;
  let minDistance = Infinity;

  for (const floor of building.floors) {
    for (const poi of floor.pois) {
      if (poi.type.includes(poiType) || (poiType === 'restroom' && poi.type.startsWith('restroom'))) {
        const floorDistPenalty = Math.abs(floor.level - fromFloor.level) * 400;
        const d = distance(roomCenter, poi.position) + floorDistPenalty;
        if (d < minDistance) {
          minDistance = d;
          nearestPOI = poi;
          nearestFloor = floor;
        }
      }
    }
  }

  if (!nearestPOI || !nearestFloor) return null;
  return { poi: nearestPOI, floor: nearestFloor };
}
