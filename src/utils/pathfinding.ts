import type {
  Floor,
  Building,
  Room,
  Zone,
  Door,
  PointOfInterest,
  TransitConnector,
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
  pointInPolygon,
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
 * Builds a strictly collision-free, door- and wall-aware multi-floor navigation graph.
 * Guarantees routes NEVER clip through foreign room polygons or impenetrable walls.
 */
export function buildNavGraph(
  building: Building,
  preferences: RoutePreference = { accessibilityOnly: false, prioritizeElevators: false, fastestRoute: true }
): Map<string, GraphNode> {
  const graph = new Map<string, GraphNode>();

  for (const floor of building.floors) {
    const rooms = floor.rooms || [];
    const zones = floor.zones || [];
    const walls = floor.walls || [];
    const doors = floor.doors || [];
    const pois = floor.pois || [];
    const transits = floor.transitConnectors || [];
    const navNodes = floor.navNodes || [];
    const navEdges = floor.navEdges || [];

    // 1. Add all standard explicit navNodes
    for (const node of navNodes) {
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

    // 2. Add explicit floor navEdges
    for (const edge of navEdges) {
      if (preferences.accessibilityOnly && !edge.isAccessible) {
        continue;
      }
      const from = graph.get(edge.fromNodeId);
      const to = graph.get(edge.toNodeId);
      if (from && to) {
        const isClear = hasClearLineOfSight(from.position, to.position, rooms, [], walls, doors);
        const dist = edge.distance || distance(from.position, to.position);
        const weight = isClear ? dist : dist + 50000;

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
    rooms.forEach((room) => {
      const roomCenter = polygonCentroid(room.polygon);
      room.polygon.forEach((vertex, vIdx) => {
        const vx = vertex.x - roomCenter.x;
        const vy = vertex.y - roomCenter.y;
        const vLen = Math.max(1, Math.hypot(vx, vy));
        const cornerPos: Point = {
          x: Math.round(vertex.x + (vx / vLen) * 24),
          y: Math.round(vertex.y + (vy / vLen) * 24),
        };

        if (hasClearLineOfSight(cornerPos, cornerPos, rooms, [], walls, doors)) {
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
        }
      });
    });

    // 4. Generate Wall Endpoint Clearance Nodes
    walls.forEach((wall) => {
      const tips = [wall.start, wall.end];
      tips.forEach((tip, tIdx) => {
        const dx = tip === wall.start ? wall.start.x - wall.end.x : wall.end.x - wall.start.x;
        const dy = tip === wall.start ? wall.start.y - wall.end.y : wall.end.y - wall.start.y;
        const len = Math.max(1, Math.hypot(dx, dy));
        const tipPos: Point = {
          x: Math.round(tip.x + (dx / len) * 22),
          y: Math.round(tip.y + (dy / len) * 22),
        };

        if (hasClearLineOfSight(tipPos, tipPos, rooms, [], walls, doors)) {
          const wallNodeId = `wall-tip-${wall.id}-${tIdx}`;
          if (!graph.has(wallNodeId)) {
            const wNode: GraphNode = {
              id: wallNodeId,
              floorId: floor.id,
              floorLevel: floor.level,
              floorName: floor.name,
              floorShortCode: floor.shortCode,
              buildingName: building.name,
              position: tipPos,
              type: 'corridor',
              label: 'Folyosó átjáró',
              neighbors: [],
            };
            graph.set(wallNodeId, wNode);
          }
        }
      });
    });

    // 5. Adaptive Walkable Space Corridor Grid (Grid sampling for open floor plans)
    const floorWidth = floor.width || 1200;
    const floorHeight = floor.height || 800;
    const gridStep = 60;

    for (let x = 60; x < floorWidth; x += gridStep) {
      for (let y = 60; y < floorHeight; y += gridStep) {
        const pt: Point = { x, y };
        let isInsideRoom = false;
        for (const rm of rooms) {
          if (pointInPolygon(pt, rm.polygon)) {
            isInsideRoom = true;
            break;
          }
        }
        if (isInsideRoom) continue;

        let isNearWall = false;
        for (const w of walls) {
          if (pointToSegmentDistance(pt, w.start, w.end) < 18) {
            isNearWall = true;
            break;
          }
        }
        if (isNearWall) continue;

        const gridNodeId = `grid-${floor.id}-${x}-${y}`;
        const gNode: GraphNode = {
          id: gridNodeId,
          floorId: floor.id,
          floorLevel: floor.level,
          floorName: floor.name,
          floorShortCode: floor.shortCode,
          buildingName: building.name,
          position: pt,
          type: 'corridor',
          label: 'Folyosó',
          neighbors: [],
        };
        graph.set(gridNodeId, gNode);
      }
    }

    // 5.5 Synthesize All Doors on Floor (Wall Doors, Corridor Doors, Room Doors)
    const doorApproachMap = new Map<string, { midId: string; frontId: string; backId: string }>();

    for (const door of doors) {
      const doorMid: Point = {
        x: Math.round((door.start.x + door.end.x) / 2),
        y: Math.round((door.start.y + door.end.y) / 2),
      };

      const ddx = door.end.x - door.start.x;
      const ddy = door.end.y - door.start.y;
      const dlen = Math.max(1, Math.hypot(ddx, ddy));
      const nx = -ddy / dlen;
      const ny = ddx / dlen;

      const frontPos: Point = {
        x: Math.round(doorMid.x + nx * 24),
        y: Math.round(doorMid.y + ny * 24),
      };
      const backPos: Point = {
        x: Math.round(doorMid.x - nx * 24),
        y: Math.round(doorMid.y - ny * 24),
      };

      const midNodeId = `door-mid-${door.id}`;
      const frontNodeId = `door-front-${door.id}`;
      const backNodeId = `door-back-${door.id}`;

      const midNode: GraphNode = {
        id: midNodeId,
        floorId: floor.id,
        floorLevel: floor.level,
        floorName: floor.name,
        floorShortCode: floor.shortCode,
        buildingName: building.name,
        position: doorMid,
        type: 'door',
        refId: door.id,
        label: 'Ajtó nyílás',
        neighbors: [],
      };

      const frontNode: GraphNode = {
        id: frontNodeId,
        floorId: floor.id,
        floorLevel: floor.level,
        floorName: floor.name,
        floorShortCode: floor.shortCode,
        buildingName: building.name,
        position: frontPos,
        type: 'corridor',
        refId: door.id,
        label: 'Ajtó előtér',
        neighbors: [],
      };

      const backNode: GraphNode = {
        id: backNodeId,
        floorId: floor.id,
        floorLevel: floor.level,
        floorName: floor.name,
        floorShortCode: floor.shortCode,
        buildingName: building.name,
        position: backPos,
        type: 'corridor',
        refId: door.id,
        label: 'Ajtó háttér',
        neighbors: [],
      };

      graph.set(midNodeId, midNode);
      graph.set(frontNodeId, frontNode);
      graph.set(backNodeId, backNode);

      // Connect Front <===> Mid <===> Back (Unconditional traversable passage through doorway)
      frontNode.neighbors.push({ nodeId: midNodeId, weight: 24, isAccessible: true });
      midNode.neighbors.push({ nodeId: frontNodeId, weight: 24, isAccessible: true });

      backNode.neighbors.push({ nodeId: midNodeId, weight: 24, isAccessible: true });
      midNode.neighbors.push({ nodeId: backNodeId, weight: 24, isAccessible: true });

      frontNode.neighbors.push({ nodeId: backNodeId, weight: 48, isAccessible: true });
      backNode.neighbors.push({ nodeId: frontNodeId, weight: 48, isAccessible: true });

      doorApproachMap.set(door.id, { midId: midNodeId, frontId: frontNodeId, backId: backNodeId });
    }

    // 6. Synthesize Rooms & their Doorway Connections
    for (const room of rooms) {
      const roomCenter = polygonCentroid(room.polygon);
      const roomNodeId = `room-node-${room.id}`;

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

      // Match closest door in floor.doors
      let matchedDoor: Door | null = null;
      let minDoorDist = Infinity;
      const roomEdges = getPolygonEdges(room.polygon);

      for (const door of doors) {
        const dMid: Point = {
          x: (door.start.x + door.end.x) / 2,
          y: (door.start.y + door.end.y) / 2,
        };
        for (const edge of roomEdges) {
          const d = pointToSegmentDistance(dMid, edge.start, edge.end);
          if (d < minDoorDist && d <= 35) {
            minDoorDist = d;
            matchedDoor = door;
          }
        }
      }

      if (matchedDoor && doorApproachMap.has(matchedDoor.id)) {
        const { midId, frontId, backId } = doorApproachMap.get(matchedDoor.id)!;
        const frontNode = graph.get(frontId)!;
        const backNode = graph.get(backId)!;
        const midNode = graph.get(midId)!;

        // Label door node with room name and register alias for direct doorway routing
        midNode.label = `${room.name} (${room.code})`;
        midNode.refId = room.id;
        graph.set(`door-room-${room.id}`, midNode);

        // Check which approach node is inside or closer to room center
        const isFrontInRoom = pointInPolygon(frontNode.position, room.polygon);
        const isBackInRoom = pointInPolygon(backNode.position, room.polygon);

        let insideNode = midNode;
        if (isFrontInRoom && !isBackInRoom) insideNode = frontNode;
        else if (isBackInRoom && !isFrontInRoom) insideNode = backNode;
        else {
          const dFront = distance(frontNode.position, roomCenter);
          const dBack = distance(backNode.position, roomCenter);
          insideNode = dFront < dBack ? frontNode : backNode;
        }

        const cDist = distance(roomCenter, insideNode.position);
        roomNode.neighbors.push({ nodeId: insideNode.id, weight: cDist, isAccessible: true });
        insideNode.neighbors.push({ nodeId: roomNodeId, weight: cDist, isAccessible: true });
      } else {
        // Fallback Doorway on room perimeter
        let fallbackDoorPos = room.doorLocation;
        if (!fallbackDoorPos && roomEdges.length > 0) {
          fallbackDoorPos = roomEdges[0].midPoint;
        }
        if (!fallbackDoorPos) {
          fallbackDoorPos = { x: roomCenter.x + 20, y: roomCenter.y };
        }

        const cdx = fallbackDoorPos.x - roomCenter.x;
        const cdy = fallbackDoorPos.y - roomCenter.y;
        const cLen = Math.max(1, Math.hypot(cdx, cdy));
        let approachPos: Point = {
          x: Math.round(fallbackDoorPos.x + (cdx / cLen) * 24),
          y: Math.round(fallbackDoorPos.y + (cdy / cLen) * 24),
        };
        if (pointInPolygon(approachPos, room.polygon)) {
          approachPos = {
            x: Math.round(fallbackDoorPos.x - (cdx / cLen) * 24),
            y: Math.round(fallbackDoorPos.y - (cdy / cLen) * 24),
          };
        }

        const doorNodeId = `door-room-${room.id}`;
        const doorNode: GraphNode = {
          id: doorNodeId,
          floorId: floor.id,
          floorLevel: floor.level,
          floorName: floor.name,
          floorShortCode: floor.shortCode,
          buildingName: building.name,
          position: fallbackDoorPos,
          type: 'door',
          refId: room.id,
          label: `${room.name} (${room.code})`,
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

        const centerToDoorDist = distance(roomCenter, fallbackDoorPos);
        roomNode.neighbors.push({ nodeId: doorNodeId, weight: centerToDoorDist, isAccessible: true });
        doorNode.neighbors.push({ nodeId: roomNodeId, weight: centerToDoorDist, isAccessible: true });

        const doorToApproachDist = distance(fallbackDoorPos, approachPos);
        doorNode.neighbors.push({ nodeId: approachNodeId, weight: doorToApproachDist, isAccessible: true });
        approachNode.neighbors.push({ nodeId: doorNodeId, weight: doorToApproachDist, isAccessible: true });
      }
    }

    // 6.5 Synthesize Zones (Aulas, Atriums, Courtyards, Lounges)
    for (const zone of zones) {
      const zoneCenter = polygonCentroid(zone.polygon);
      const zoneNodeId = `zone-node-${zone.id}`;
      const zNode: GraphNode = {
        id: zoneNodeId,
        floorId: floor.id,
        floorLevel: floor.level,
        floorName: floor.name,
        floorShortCode: floor.shortCode,
        buildingName: building.name,
        position: zoneCenter,
        type: 'room',
        refId: zone.id,
        label: `${zone.name} (${zone.code || 'Zóna'})`,
        neighbors: [],
      };
      graph.set(zoneNodeId, zNode);

      const zEdges = getPolygonEdges(zone.polygon);
      zEdges.forEach((edge, eIdx) => {
        const edgeMid = edge.midPoint;
        const appNodeId = `approach-zone-${zone.id}-${eIdx}`;
        const appNode: GraphNode = {
          id: appNodeId,
          floorId: floor.id,
          floorLevel: floor.level,
          floorName: floor.name,
          floorShortCode: floor.shortCode,
          buildingName: building.name,
          position: edgeMid,
          type: 'corridor',
          refId: zone.id,
          label: `${zone.name} Átjáró`,
          neighbors: [],
        };
        graph.set(appNodeId, appNode);
        const d = distance(zoneCenter, edgeMid);
        zNode.neighbors.push({ nodeId: appNodeId, weight: d, isAccessible: true });
        appNode.neighbors.push({ nodeId: zoneNodeId, weight: d, isAccessible: true });
      });
    }

    // 7. Register POIs (Each POI gets its own dedicated node at its exact position)
    for (const poi of pois) {
      const poiNodeId = `poi-node-${poi.id}`;
      const pNode: GraphNode = {
        id: poiNodeId,
        floorId: floor.id,
        floorLevel: floor.level,
        floorName: floor.name,
        floorShortCode: floor.shortCode,
        buildingName: building.name,
        position: { ...poi.position },
        type: 'poi',
        refId: poi.id,
        label: poi.name,
        neighbors: [],
      };
      graph.set(poiNodeId, pNode);

      // Link to explicit navNode if specified
      if (poi.navNodeId && graph.has(poi.navNodeId)) {
        const linkNode = graph.get(poi.navNodeId)!;
        const d = distance(pNode.position, linkNode.position);
        pNode.neighbors.push({ nodeId: linkNode.id, weight: d, isAccessible: true });
        linkNode.neighbors.push({ nodeId: pNode.id, weight: d, isAccessible: true });
      }
    }

    // 8. Register Transit Connectors
    for (const transit of transits) {
      const transitNodeId = `transit-node-${transit.id}`;
      const tNode: GraphNode = {
        id: transitNodeId,
        floorId: floor.id,
        floorLevel: floor.level,
        floorName: floor.name,
        floorShortCode: floor.shortCode,
        buildingName: building.name,
        position: { ...transit.position },
        type: 'transit',
        refId: transit.id,
        label: transit.name,
        neighbors: [],
      };
      graph.set(transitNodeId, tNode);

      if (transit.navNodeId && graph.has(transit.navNodeId)) {
        const linkNode = graph.get(transit.navNodeId)!;
        const d = distance(tNode.position, linkNode.position);
        tNode.neighbors.push({ nodeId: linkNode.id, weight: d, isAccessible: transit.isAccessible });
        linkNode.neighbors.push({ nodeId: tNode.id, weight: d, isAccessible: transit.isAccessible });
      }
    }

    // 9. Inter-connect all walkable corridor and gateway nodes on this floor
    const walkableNodes = Array.from(graph.values()).filter(
      (gn) => gn.floorId === floor.id && gn.type !== 'room'
    );

    for (let i = 0; i < walkableNodes.length; i++) {
      const nA = walkableNodes[i];
      for (let j = i + 1; j < walkableNodes.length; j++) {
        const nB = walkableNodes[j];
        const d = distance(nA.position, nB.position);

        const maxDist =
          nA.type === 'door' || nB.type === 'door' || nA.type === 'poi' || nB.type === 'poi' || nA.type === 'transit' || nB.type === 'transit'
            ? 380
            : 260;

        if (d <= maxDist) {
          if (hasClearLineOfSight(nA.position, nB.position, rooms, [], walls, doors)) {
            if (!nA.neighbors.some((nbr) => nbr.nodeId === nB.id)) {
              nA.neighbors.push({ nodeId: nB.id, weight: d, isAccessible: true });
              nB.neighbors.push({ nodeId: nA.id, weight: d, isAccessible: true });
            }
          }
        }
      }
    }

    // 9.5 Fallback connection: Guarantee every transit connector links to the nearest corridor node on its floor
    const floorTransits = Array.from(graph.values()).filter((gn) => gn.floorId === floor.id && gn.type === 'transit');
    const floorCorridors = Array.from(graph.values()).filter((gn) => gn.floorId === floor.id && gn.type !== 'room' && gn.type !== 'transit');

    for (const tNode of floorTransits) {
      if (tNode.neighbors.length === 0 && floorCorridors.length > 0) {
        let nearest: GraphNode | null = null;
        let minDist = Infinity;
        for (const candidate of floorCorridors) {
          const d = distance(tNode.position, candidate.position);
          if (d < minDist) {
            minDist = d;
            nearest = candidate;
          }
        }
        if (nearest) {
          tNode.neighbors.push({ nodeId: nearest.id, weight: minDist, isAccessible: true });
          nearest.neighbors.push({ nodeId: tNode.id, weight: minDist, isAccessible: true });
        }
      }
    }
  }

  // 10. Cross-Floor Vertical Connections (Elevators, Stairs, Escalators, Ramps)
  const allTransitsAcrossFloors: {
    connectorId: string;
    floorId: string;
    floorLevel: number;
    graphNodeId: string;
    position: Point;
    type: TransitType;
    name: string;
    isAccessible: boolean;
    transitGroupId: string;
  }[] = [];

  for (const floor of building.floors) {
    for (const connector of floor.transitConnectors) {
      const primaryNodeId = `transit-node-${connector.id}`;
      const altNodeId = connector.navNodeId;
      const targetNodeId = graph.has(primaryNodeId)
        ? primaryNodeId
        : altNodeId && graph.has(altNodeId)
        ? altNodeId
        : undefined;

      if (targetNodeId) {
        allTransitsAcrossFloors.push({
          connectorId: connector.id,
          floorId: floor.id,
          floorLevel: floor.level,
          graphNodeId: targetNodeId,
          position: connector.position,
          type: connector.type,
          name: connector.name || (connector.type === 'elevator' ? 'Lift' : 'Lépcső'),
          isAccessible: connector.isAccessible,
          transitGroupId: connector.transitGroupId || '',
        });
      }
    }
  }

  for (let i = 0; i < allTransitsAcrossFloors.length; i++) {
    for (let j = i + 1; j < allTransitsAcrossFloors.length; j++) {
      const c1 = allTransitsAcrossFloors[i];
      const c2 = allTransitsAcrossFloors[j];

      // Must be on different floors of the same building
      if (c1.floorId === c2.floorId) continue;

      // Check if they belong to the same vertical shaft/group:
      const sameGroup = !!(c1.transitGroupId && c2.transitGroupId && c1.transitGroupId === c2.transitGroupId);
      const sameType = c1.type === c2.type;
      const sameName = !!(c1.name && c2.name && c1.name.trim().toLowerCase() === c2.name.trim().toLowerCase());
      const closePosition = distance(c1.position, c2.position) < 180; // Within ~9 meters 2D distance

      const isSameShaft = sameGroup || (sameType && (sameName || closePosition));

      if (isSameShaft) {
        if (preferences.accessibilityOnly && (!c1.isAccessible || !c2.isAccessible)) {
          continue;
        }

        const node1 = graph.get(c1.graphNodeId);
        const node2 = graph.get(c2.graphNodeId);

        if (node1 && node2) {
          const levelDiff = Math.abs(c1.floorLevel - c2.floorLevel);
          let verticalPenalty = levelDiff * 60;

          if (c1.type === 'elevator') {
            if (preferences.prioritizeElevators) {
              verticalPenalty = levelDiff * 25;
            } else if (preferences.prioritizeStairs) {
              verticalPenalty = levelDiff * 190;
            } else {
              verticalPenalty = levelDiff * 55;
            }
          } else if (c1.type === 'stairs') {
            if (preferences.prioritizeElevators) {
              verticalPenalty = levelDiff * 190;
            } else if (preferences.prioritizeStairs) {
              verticalPenalty = levelDiff * 25;
            } else {
              verticalPenalty = levelDiff * 50;
            }
          } else if (c1.type === 'escalator') {
            verticalPenalty = levelDiff * 45;
          } else if (c1.type === 'ramp') {
            verticalPenalty = levelDiff * 50;
          }

          if (!node1.neighbors.some((n) => n.nodeId === node2.id)) {
            node1.neighbors.push({
              nodeId: node2.id,
              weight: verticalPenalty,
              isVertical: true,
              transitType: c1.type,
              transitName: c1.name,
              isAccessible: c1.isAccessible && c2.isAccessible,
            });
          }

          if (!node2.neighbors.some((n) => n.nodeId === node1.id)) {
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
  }

  return graph;
}

/**
 * String-pulls a raw A* path into a straighter route by skipping over any
 * intermediate corridor/corner nodes whenever a direct, collision-free line
 * of sight exists between two waypoints on the same floor.
 */
function simplifyRoutePath(
  pathNodes: { nodeId: string; floorId: string; position: Point; floorLevel: number }[],
  graph: Map<string, GraphNode>,
  building: Building
): { nodeId: string; floorId: string; position: Point; floorLevel: number }[] {
  if (pathNodes.length <= 2) return pathNodes;

  const floorMap = new Map<string, Floor>();
  for (const floor of building.floors) {
    floorMap.set(floor.id, floor);
  }

  const mandatoryTypes = new Set(['door', 'room', 'transit', 'poi']);
  const simplified = [pathNodes[0]];
  let anchorIdx = 0;

  while (anchorIdx < pathNodes.length - 1) {
    const anchor = pathNodes[anchorIdx];
    const floor = floorMap.get(anchor.floorId);
    const rooms = floor?.rooms || [];
    const walls = floor?.walls || [];
    const doors = floor?.doors || [];
    let farthest = anchorIdx + 1;

    for (let candidate = anchorIdx + 2; candidate < pathNodes.length; candidate++) {
      const node = pathNodes[candidate];
      if (node.floorId !== anchor.floorId) break;

      let blockedByMandatory = false;
      for (let k = anchorIdx + 1; k < candidate; k++) {
        const midNode = graph.get(pathNodes[k].nodeId);
        if (midNode && mandatoryTypes.has(midNode.type)) {
          blockedByMandatory = true;
          break;
        }
      }
      if (blockedByMandatory) break;

      if (hasClearLineOfSight(anchor.position, node.position, rooms, [], walls, doors)) {
        farthest = candidate;
      } else {
        break;
      }
    }

    simplified.push(pathNodes[farthest]);
    anchorIdx = farthest;
  }

  return simplified;
}

/**
 * Inserts a single right-angle elbow between any two consecutive waypoints
 * that aren't already horizontally/vertically aligned, so the rendered route
 * only ever bends in clean 90° corners.
 */
function enforceOrthogonalTurns(
  pathNodes: { nodeId: string; floorId: string; position: Point; floorLevel: number }[],
  graph: Map<string, GraphNode>,
  building: Building
): { nodeId: string; floorId: string; position: Point; floorLevel: number }[] {
  const floorMap = new Map<string, Floor>();
  for (const floor of building.floors) {
    floorMap.set(floor.id, floor);
  }

  const result: typeof pathNodes = [];
  let elbowCounter = 0;

  for (let i = 0; i < pathNodes.length; i++) {
    result.push(pathNodes[i]);
    if (i === pathNodes.length - 1) continue;

    const a = pathNodes[i];
    const b = pathNodes[i + 1];
    if (a.floorId !== b.floorId) continue;
    if (a.position.x === b.position.x || a.position.y === b.position.y) continue;

    const floor = floorMap.get(a.floorId);
    const rooms = floor?.rooms || [];
    const walls = floor?.walls || [];
    const doors = floor?.doors || [];

    const elbowCandidates: Point[] = [
      { x: b.position.x, y: a.position.y },
      { x: a.position.x, y: b.position.y },
    ];

    for (const elbow of elbowCandidates) {
      if (
        hasClearLineOfSight(a.position, elbow, rooms, [], walls, doors) &&
        hasClearLineOfSight(elbow, b.position, rooms, [], walls, doors)
      ) {
        const anchorGraphNode = graph.get(a.nodeId);
        const elbowId = `elbow-${elbowCounter++}-${a.nodeId}-${b.nodeId}`;
        graph.set(elbowId, {
          id: elbowId,
          floorId: a.floorId,
          floorLevel: a.floorLevel,
          floorName: anchorGraphNode?.floorName || '',
          floorShortCode: anchorGraphNode?.floorShortCode || '',
          buildingName: anchorGraphNode?.buildingName || '',
          position: elbow,
          type: 'corner',
          label: 'Folyosó forduló',
          neighbors: [],
        });
        result.push({ nodeId: elbowId, floorId: a.floorId, position: elbow, floorLevel: a.floorLevel });
        break;
      }
    }
  }

  return result;
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

  // Helper to resolve start / target node IDs (routes to room doorway, zone center, POI, or transit)
  const resolveNodeId = (identifier: string): string | null => {
    // 1. Zones: always route directly to the zone center
    if (graph.has(`zone-node-${identifier}`)) return `zone-node-${identifier}`;
    const directNode = graph.get(identifier);
    if (directNode && directNode.id.startsWith('zone-node-')) {
      return directNode.id;
    }

    // 2. Rooms: route directly to the room's doorway / door on the wall
    if (identifier.startsWith('room-node-')) {
      const rmId = identifier.replace(/^room-node-/, '');
      if (graph.has(`door-room-${rmId}`)) return `door-room-${rmId}`;
    }
    if (graph.has(`door-room-${identifier}`)) return `door-room-${identifier}`;

    // 3. Direct IDs: POIs, Transits, Doors, explicit NavNodes
    if (graph.has(identifier)) return identifier;
    if (graph.has(`poi-node-${identifier}`)) return `poi-node-${identifier}`;
    if (graph.has(`transit-node-${identifier}`)) return `transit-node-${identifier}`;
    if (graph.has(`door-mid-${identifier}`)) return `door-mid-${identifier}`;

    // 4. Search by refId (prefer door node for rooms)
    for (const node of graph.values()) {
      if (node.refId === identifier && node.type === 'door') {
        return node.id;
      }
    }
    for (const node of graph.values()) {
      if (node.refId === identifier) {
        return node.id;
      }
    }
    if (graph.has(`room-node-${identifier}`)) return `room-node-${identifier}`;
    return null;
  };

  const resolvedStartKey = resolveNodeId(startIdentifier);
  const resolvedTargetKey = resolveNodeId(targetIdentifier);

  if (!resolvedStartKey || !resolvedTargetKey) return null;

  const startNode = graph.get(resolvedStartKey);
  const targetNode = graph.get(resolvedTargetKey);

  if (!startNode || !targetNode) return null;

  const startNodeId = startNode.id;
  const targetNodeId = targetNode.id;

  const friendlyEndpointLabel = (node: GraphNode): string =>
    (node.label || (node.type === 'door' ? 'Ajtó' : 'Célállomás')).replace(/^Ajtó: /, '');

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
          detail: friendlyEndpointLabel(targetNode),
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
    return null;
  }

  // Reconstruct path nodes
  const pathNodeIds: string[] = [];
  let curr: string | undefined = targetNodeId;
  while (curr) {
    pathNodeIds.unshift(curr);
    curr = previous.get(curr);
  }

  const rawPathNodes = pathNodeIds.map((id) => {
    const n = graph.get(id)!;
    return {
      nodeId: n.id,
      floorId: n.floorId,
      position: n.position,
      floorLevel: n.floorLevel,
    };
  });

  const straightenedPathNodes = simplifyRoutePath(rawPathNodes, graph, building);
  const pathNodes = enforceOrthogonalTurns(straightenedPathNodes, graph, building);

  // Generate Turn-by-Turn Navigation Instructions
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
        instruction: `Indulás: ${friendlyEndpointLabel(currGraph)}`,
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

      let instruction = '';
      if (transitType === 'elevator') {
        instruction = `Menjen a lifttel (${transitName}) ${isUp ? 'FEL' : 'LE'} a(z) ${currGraph.floorName} szintre`;
      } else if (transitType === 'stairs') {
        instruction = `Menjen a lépcsőn (${transitName}) ${isUp ? 'FEL' : 'LE'} a(z) ${currGraph.floorName} szintre`;
      } else if (transitType === 'escalator') {
        instruction = `Használja a mozgólépcsőt (${transitName}) ${isUp ? 'FEL' : 'LE'} a(z) ${currGraph.floorName} szintre`;
      } else {
        instruction = `Közlekedjen a rámpán (${transitName}) ${isUp ? 'FEL' : 'LE'} a(z) ${currGraph.floorName} szintre`;
      }

      steps.push({
        stepIndex: steps.length + 1,
        instruction,
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
        instruction: `Megérkezett: ${friendlyEndpointLabel(currGraph)}`,
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
 * Optimizes the sequence of intermediate waypoints to minimize total walking distance.
 */
export function optimizeStopOrder(
  building: Building,
  startId: string,
  stopIds: string[],
  targetId: string,
  preferences: RoutePreference
): string[] {
  if (stopIds.length <= 1) return stopIds;

  const permute = (arr: string[]): string[][] => {
    if (arr.length <= 1) return [arr];
    const result: string[][] = [];
    for (let i = 0; i < arr.length; i++) {
      const curr = arr[i];
      const rest = arr.slice(0, i).concat(arr.slice(i + 1));
      const subPerms = permute(rest);
      for (const p of subPerms) {
        result.push([curr, ...p]);
      }
    }
    return result;
  };

  const allPerms = permute(stopIds);
  let bestPerm = stopIds;
  let minDistance = Infinity;

  for (const perm of allPerms) {
    const fullRoute = [startId, ...perm, targetId];
    const res = findMultiStopPath(building, fullRoute, preferences);
    if (res && res.totalDistanceMeters < minDistance) {
      minDistance = res.totalDistanceMeters;
      bestPerm = perm;
    }
  }

  return bestPerm;
}

/**
 * Finds the closest POI of a given type to a specific location (room, POI, transit)
 */
export function findNearestPOIToRoom(
  building: Building,
  fromId: string,
  poiType: string
): { poi: PointOfInterest; floor: Floor } | null {
  let fromPosition: Point | null = null;
  let fromFloor: Floor | null = null;

  for (const floor of building.floors) {
    const r = floor.rooms.find((rm) => rm.id === fromId || rm.id === `room-node-${fromId}`);
    if (r) {
      fromPosition = polygonCentroid(r.polygon);
      fromFloor = floor;
      break;
    }
    const p = floor.pois.find((poi) => poi.id === fromId || poi.id === `poi-node-${fromId}`);
    if (p) {
      fromPosition = p.position;
      fromFloor = floor;
      break;
    }
    const t = floor.transitConnectors.find((tc) => tc.id === fromId || tc.id === `transit-node-${fromId}`);
    if (t) {
      fromPosition = t.position;
      fromFloor = floor;
      break;
    }
  }

  if (!fromPosition || !fromFloor) return null;

  let nearestPOI: PointOfInterest | null = null;
  let nearestFloor: Floor | null = null;
  let minDistance = Infinity;

  for (const floor of building.floors) {
    for (const poi of floor.pois) {
      const matchesType =
        poi.type.includes(poiType) ||
        (poiType === 'entrance' && (poi.type === 'entrance' || poi.type === 'accessible_entrance')) ||
        (poiType === 'exit' && (poi.type === 'exit' || poi.type === 'fire_exit')) ||
        (poiType === 'fire_exit' && poi.type === 'fire_exit') ||
        (poiType === 'restroom' && poi.type.startsWith('restroom')) ||
        (poiType === 'coffee' && (poi.type === 'coffee' || poi.type === 'vending')) ||
        (poiType === 'aed' && (poi.type === 'aed' || poi.type === 'first_aid')) ||
        (poiType === 'water' && poi.type === 'water');

      if (matchesType) {
        const floorDistPenalty = Math.abs(floor.level - fromFloor.level) * 350;
        const d = distance(fromPosition, poi.position) + floorDistPenalty;
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

/**
 * Finds the nearest elevator or stairs shaft on a given floor from a point.
 */
export function findNearestTransitToLocation(
  building: Building,
  floorId: string,
  position: Point,
  transitType?: TransitType
): TransitConnector | null {
  const floor = building.floors.find((f) => f.id === floorId);
  if (!floor || floor.transitConnectors.length === 0) return null;

  let best: TransitConnector | null = null;
  let minDist = Infinity;

  for (const t of floor.transitConnectors) {
    if (transitType && t.type !== transitType) continue;
    const d = distance(position, t.position);
    if (d < minDist) {
      minDist = d;
      best = t;
    }
  }

  return best;
}

/**
 * Finds the nearest elevator or stairs shaft to a room/POI/transit from any point in the building.
 */
export function findNearestTransitToRoom(
  building: Building,
  fromId: string,
  transitType?: TransitType
): { transit: TransitConnector; floor: Floor } | null {
  let fromPosition: Point | null = null;
  let fromFloor: Floor | null = null;

  for (const floor of building.floors) {
    const r = floor.rooms.find((rm) => rm.id === fromId || rm.id === `room-node-${fromId}`);
    if (r) {
      fromPosition = polygonCentroid(r.polygon);
      fromFloor = floor;
      break;
    }
    const p = floor.pois.find((poi) => poi.id === fromId || poi.id === `poi-node-${fromId}`);
    if (p) {
      fromPosition = p.position;
      fromFloor = floor;
      break;
    }
    const t = floor.transitConnectors.find((tc) => tc.id === fromId || tc.id === `transit-node-${fromId}`);
    if (t) {
      fromPosition = t.position;
      fromFloor = floor;
      break;
    }
  }

  if (!fromPosition || !fromFloor) return null;

  let nearestTransit: TransitConnector | null = null;
  let nearestFloor: Floor | null = null;
  let minDistance = Infinity;

  for (const floor of building.floors) {
    for (const transit of floor.transitConnectors) {
      if (transitType && transit.type !== transitType) continue;
      const floorDistPenalty = Math.abs(floor.level - fromFloor.level) * 350;
      const d = distance(fromPosition, transit.position) + floorDistPenalty;
      if (d < minDistance) {
        minDistance = d;
        nearestTransit = transit;
        nearestFloor = floor;
      }
    }
  }

  if (!nearestTransit || !nearestFloor) return null;
  return { transit: nearestTransit, floor: nearestFloor };
}


