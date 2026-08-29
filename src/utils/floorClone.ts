import type { Floor, Room, Zone, Wall, Door, TransitConnector, PointOfInterest, NavNode, NavEdge } from '../types';

export interface CloneFloorOptions {
  copyRooms?: boolean;
  copyZones?: boolean;
  copyWalls?: boolean;
  copyDoors?: boolean;
  copyTransit?: boolean;
  copyPois?: boolean;
  copyNav?: boolean;
  copyUnderlay?: boolean;
}

/**
 * Deep-clones floor contents (rooms, walls, doors, etc.) with new IDs and re-mapped references.
 */
export function cloneFloorData(
  sourceFloor: Floor,
  targetFloorId: string,
  options: CloneFloorOptions = {
    copyRooms: true,
    copyZones: true,
    copyWalls: true,
    copyDoors: true,
    copyTransit: true,
    copyPois: true,
    copyNav: true,
    copyUnderlay: true,
  }
): {
  rooms: Room[];
  zones: Zone[];
  walls: Wall[];
  doors: Door[];
  transitConnectors: TransitConnector[];
  pois: PointOfInterest[];
  navNodes: NavNode[];
  navEdges: NavEdge[];
  underlay?: Floor['underlay'];
  width: number;
  height: number;
} {
  const nodeMap = new Map<string, string>();
  const roomMap = new Map<string, string>();
  const transitMap = new Map<string, string>();
  const poiMap = new Map<string, string>();

  // Pre-generate new IDs for references
  (sourceFloor.navNodes || []).forEach((node) => {
    nodeMap.set(node.id, `node-${Date.now()}-${Math.random().toString(36).substr(2, 8)}`);
  });

  (sourceFloor.rooms || []).forEach((room) => {
    roomMap.set(room.id, `room-${Date.now()}-${Math.random().toString(36).substr(2, 8)}`);
  });

  (sourceFloor.transitConnectors || []).forEach((t) => {
    transitMap.set(t.id, `transit-${Date.now()}-${Math.random().toString(36).substr(2, 8)}`);
  });

  (sourceFloor.pois || []).forEach((poi) => {
    poiMap.set(poi.id, `poi-${Date.now()}-${Math.random().toString(36).substr(2, 8)}`);
  });

  const rooms: Room[] = options.copyRooms !== false
    ? (sourceFloor.rooms || []).map((r) => ({
        ...r,
        id: roomMap.get(r.id) || `room-${Date.now()}-${Math.random().toString(36).substr(2, 8)}`,
        floorId: targetFloorId,
        navNodeId: r.navNodeId && nodeMap.has(r.navNodeId) ? nodeMap.get(r.navNodeId) : r.navNodeId,
        polygon: r.polygon.map((p) => ({ ...p })),
        doorLocation: r.doorLocation ? { ...r.doorLocation } : undefined,
        tags: [...(r.tags || [])],
      }))
    : [];

  const zones: Zone[] = options.copyZones !== false
    ? (sourceFloor.zones || []).map((z) => ({
        ...z,
        id: `zone-${Date.now()}-${Math.random().toString(36).substr(2, 8)}`,
        floorId: targetFloorId,
        polygon: z.polygon.map((p) => ({ ...p })),
        tags: [...(z.tags || [])],
      }))
    : [];

  const walls: Wall[] = options.copyWalls !== false
    ? (sourceFloor.walls || []).map((w) => ({
        ...w,
        id: `w-${Date.now()}-${Math.random().toString(36).substr(2, 8)}`,
        floorId: targetFloorId,
        start: { ...w.start },
        end: { ...w.end },
      }))
    : [];

  const doors: Door[] = options.copyDoors !== false
    ? (sourceFloor.doors || []).map((d) => ({
        ...d,
        id: `d-${Date.now()}-${Math.random().toString(36).substr(2, 8)}`,
        floorId: targetFloorId,
        start: { ...d.start },
        end: { ...d.end },
      }))
    : [];

  const transitConnectors: TransitConnector[] = options.copyTransit !== false
    ? (sourceFloor.transitConnectors || []).map((t) => ({
        ...t,
        id: transitMap.get(t.id) || `transit-${Date.now()}-${Math.random().toString(36).substr(2, 8)}`,
        floorId: targetFloorId,
        position: { ...t.position },
        navNodeId: t.navNodeId && nodeMap.has(t.navNodeId) ? nodeMap.get(t.navNodeId)! : t.navNodeId,
        servesFloorIds: Array.from(new Set([...(t.servesFloorIds || []), targetFloorId])),
      }))
    : [];

  const pois: PointOfInterest[] = options.copyPois !== false
    ? (sourceFloor.pois || []).map((poi) => ({
        ...poi,
        id: poiMap.get(poi.id) || `poi-${Date.now()}-${Math.random().toString(36).substr(2, 8)}`,
        floorId: targetFloorId,
        position: { ...poi.position },
        navNodeId: poi.navNodeId && nodeMap.has(poi.navNodeId) ? nodeMap.get(poi.navNodeId) : poi.navNodeId,
      }))
    : [];

  const navNodes: NavNode[] = options.copyNav !== false
    ? (sourceFloor.navNodes || []).map((n) => {
        let refId = n.refId;
        if (refId) {
          if (roomMap.has(refId)) refId = roomMap.get(refId);
          else if (transitMap.has(refId)) refId = transitMap.get(refId);
          else if (poiMap.has(refId)) refId = poiMap.get(refId);
        }
        return {
          ...n,
          id: nodeMap.get(n.id) || `node-${Date.now()}-${Math.random().toString(36).substr(2, 8)}`,
          floorId: targetFloorId,
          position: { ...n.position },
          refId,
        };
      })
    : [];

  const navEdges: NavEdge[] = options.copyNav !== false
    ? (sourceFloor.navEdges || []).map((e) => ({
        ...e,
        id: `e-${Date.now()}-${Math.random().toString(36).substr(2, 8)}`,
        floorId: targetFloorId,
        fromNodeId: nodeMap.get(e.fromNodeId) || e.fromNodeId,
        toNodeId: nodeMap.get(e.toNodeId) || e.toNodeId,
      }))
    : [];

  const underlay = options.copyUnderlay !== false && sourceFloor.underlay
    ? { ...sourceFloor.underlay }
    : undefined;

  return {
    rooms,
    zones,
    walls,
    doors,
    transitConnectors,
    pois,
    navNodes,
    navEdges,
    underlay,
    width: sourceFloor.width,
    height: sourceFloor.height,
  };
}

/**
 * Creates a new Floor by duplicating an existing floor.
 */
export function duplicateFloor(
  sourceFloor: Floor,
  newFloorMeta: {
    buildingId?: string;
    name: string;
    level: number;
    shortCode: string;
    elevationMeters: number;
  },
  options?: CloneFloorOptions
): Floor {
  const newFloorId = `floor-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;
  const clonedData = cloneFloorData(sourceFloor, newFloorId, options);

  return {
    id: newFloorId,
    buildingId: newFloorMeta.buildingId || sourceFloor.buildingId,
    name: newFloorMeta.name,
    level: newFloorMeta.level,
    shortCode: newFloorMeta.shortCode,
    elevationMeters: newFloorMeta.elevationMeters,
    ...clonedData,
  };
}
