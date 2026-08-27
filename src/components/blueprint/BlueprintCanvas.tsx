import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import type {
  Floor,
  Room,
  Zone,
  ZoneType,
  Wall,
  Door,
  TransitConnector,
  PointOfInterest,
  POIType,
  NavNode,
  EditorTool,
  RouteResult,
  RouteStep,
  Point,
  ViewportTransform,
} from '../../types';
import {
  ZONE_TYPES,
  ZONE_TYPE_NAMES_HU,
  ZONE_TYPE_COLORS,
} from '../../types';
import {
  snapToGrid,
  distance,
  distanceInMeters,
  polygonCentroid,
  polygonAreaInSquareMeters,
  generateRectPolygon,
  getPolygonEdges,
  insertVertexInPolygon,
  removeVertexFromPolygon,
  alignDoorToWall,
  PIXELS_PER_METER,
} from '../../utils/geometry';
import {
  Maximize2,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Footprints,
  Compass,
  Layers,
  Sparkles,
  ArrowUpRight,
  User,
  Coffee,
  HeartPulse,
  Droplet,
  Flame,
  Info,
  Sliders,
  CornerDownRight,
  Accessibility,
  LandPlot,
} from 'lucide-react';
import { BlueprintScaleBar } from './BlueprintScaleBar';
import { CompassRose } from './CompassRose';
import { FloorMiniMap } from './FloorMiniMap';

/**
 * Shift all elements on a floor simultaneously by (dx, dy) and auto-expand canvas bounds.
 */
export const translateFloorElements = (targetFloor: Floor, dx: number, dy: number): Floor => {
  if (dx === 0 && dy === 0) return targetFloor;

  // Prevent sliding off the top-left canvas edge (min coord 10px)
  let minX = Infinity;
  let minY = Infinity;
  targetFloor.rooms.forEach((r) => r.polygon.forEach((p) => { minX = Math.min(minX, p.x); minY = Math.min(minY, p.y); }));
  (targetFloor.zones || []).forEach((z) => z.polygon.forEach((p) => { minX = Math.min(minX, p.x); minY = Math.min(minY, p.y); }));
  targetFloor.walls.forEach((w) => { minX = Math.min(minX, w.start.x, w.end.x); minY = Math.min(minY, w.start.y, w.end.y); });
  targetFloor.doors.forEach((d) => { minX = Math.min(minX, d.start.x, d.end.x); minY = Math.min(minY, d.start.y, d.end.y); });
  targetFloor.pois.forEach((p) => { minX = Math.min(minX, p.position.x); minY = Math.min(minY, p.position.y); });
  targetFloor.transitConnectors.forEach((t) => { minX = Math.min(minX, t.position.x); minY = Math.min(minY, t.position.y); });
  (targetFloor.navNodes || []).forEach((n) => { minX = Math.min(minX, n.position.x); minY = Math.min(minY, n.position.y); });

  const safeMinX = isFinite(minX) ? minX : 50;
  const safeMinY = isFinite(minY) ? minY : 50;
  const effectiveDx = Math.max(-safeMinX + 10, dx);
  const effectiveDy = Math.max(-safeMinY + 10, dy);

  const shiftedRooms = targetFloor.rooms.map((r) => ({
    ...r,
    polygon: r.polygon.map((p) => ({ x: p.x + effectiveDx, y: p.y + effectiveDy })),
  }));

  const shiftedZones = (targetFloor.zones || []).map((z) => ({
    ...z,
    polygon: z.polygon.map((p) => ({ x: p.x + effectiveDx, y: p.y + effectiveDy })),
  }));

  const shiftedWalls = targetFloor.walls.map((w) => ({
    ...w,
    start: { x: w.start.x + effectiveDx, y: w.start.y + effectiveDy },
    end: { x: w.end.x + effectiveDx, y: w.end.y + effectiveDy },
  }));

  const shiftedDoors = targetFloor.doors.map((d) => ({
    ...d,
    start: { x: d.start.x + effectiveDx, y: d.start.y + effectiveDy },
    end: { x: d.end.x + effectiveDx, y: d.end.y + effectiveDy },
  }));

  const shiftedPois = targetFloor.pois.map((p) => ({
    ...p,
    position: { x: p.position.x + effectiveDx, y: p.position.y + effectiveDy },
  }));

  const shiftedTransits = targetFloor.transitConnectors.map((t) => ({
    ...t,
    position: { x: t.position.x + effectiveDx, y: t.position.y + effectiveDy },
  }));

  const shiftedNavNodes = (targetFloor.navNodes || []).map((n) => ({
    ...n,
    position: { x: n.position.x + effectiveDx, y: n.position.y + effectiveDy },
  }));

  let newWidth = targetFloor.width;
  let newHeight = targetFloor.height;

  const allPts = [
    ...shiftedRooms.flatMap((r) => r.polygon),
    ...shiftedZones.flatMap((z) => z.polygon),
    ...shiftedWalls.flatMap((w) => [w.start, w.end]),
    ...shiftedDoors.flatMap((d) => [d.start, d.end]),
    ...shiftedPois.map((p) => p.position),
    ...shiftedTransits.map((t) => t.position),
    ...shiftedNavNodes.map((n) => n.position),
  ];

  for (const pt of allPts) {
    if (pt.x + 150 > newWidth) newWidth = Math.ceil((pt.x + 200) / 100) * 100;
    if (pt.y + 150 > newHeight) newHeight = Math.ceil((pt.y + 200) / 100) * 100;
  }

  return {
    ...targetFloor,
    width: newWidth,
    height: newHeight,
    rooms: shiftedRooms,
    zones: shiftedZones,
    walls: shiftedWalls,
    doors: shiftedDoors,
    pois: shiftedPois,
    transitConnectors: shiftedTransits,
    navNodes: shiftedNavNodes,
  };
};

interface BlueprintCanvasProps {
  floor: Floor;
  activeTool: EditorTool;
  isStudioMode: boolean;
  isAllElementsSelected?: boolean;
  onToggleSelectAll?: (selected: boolean) => void;
  selectedRoomId?: string | null;
  selectedZoneId?: string | null;
  selectedTransitId?: string | null;
  selectedPOIId?: string | null;
  startRoomId?: string | null;
  targetRoomId?: string | null;
  intermediateStopIds?: string[];
  routeResult?: RouteResult | null;
  activeSimulationProgress?: number | null; // 0 to 1
  activeStep?: RouteStep | null;
  gridSnapSize?: number; // 0 (free), 5, 10, 20
  onSelectRoom?: (room: Room | null) => void;
  onSelectZone?: (zone: Zone | null) => void;
  onSelectTransit?: (transit: TransitConnector | null) => void;
  onSelectPOI?: (poi: PointOfInterest | null) => void;
  onSetAsStartRoom?: (roomId: string) => void;
  onSetAsTargetRoom?: (roomId: string) => void;
  onAddIntermediateStop?: (roomId: string) => void;
  onDuplicateRoom?: (room: Room) => void;
  onDuplicateZone?: (zone: Zone) => void;
  onUpdateFloor?: (updatedFloor: Floor) => void;
  className?: string;
}

export const BlueprintCanvas: React.FC<BlueprintCanvasProps> = ({
  floor,
  activeTool,
  isStudioMode,
  isAllElementsSelected,
  onToggleSelectAll,
  selectedRoomId,
  selectedZoneId,
  selectedTransitId,
  selectedPOIId,
  startRoomId,
  targetRoomId,
  intermediateStopIds = [],
  routeResult,
  activeSimulationProgress,
  activeStep,
  gridSnapSize = 10,
  onSelectRoom,
  onSelectZone,
  onSelectTransit,
  onSelectPOI,
  onSetAsStartRoom,
  onSetAsTargetRoom,
  onAddIntermediateStop,
  onDuplicateRoom,
  onDuplicateZone,
  onUpdateFloor,
  className = '',
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  // Viewport transformation (Pan & Zoom)
  const [viewport, setViewport] = useState<ViewportTransform>({
    x: 40,
    y: 40,
    zoom: 1.0,
  });

  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [cursorFloorPos, setCursorFloorPos] = useState<Point | null>(null);

  // Quick Action Menu for Wayfinding directly on canvas
  const [wayfinderActionMenu, setWayfinderActionMenu] = useState<{
    screenX: number;
    screenY: number;
    entityId: string;
    entityName: string;
    entityType: 'room' | 'poi' | 'transit' | 'zone';
  } | null>(null);

  // Layer Visibility
  const [layerVisibility, setLayerVisibility] = useState({
    zones: true,
    walls: true,
    rooms: true,
    doors: true,
    transits: true,
    pois: true,
    navMesh: false,
    dimensions: true,
    grid: true,
  });

  const [showLayerMenu, setShowLayerMenu] = useState(false);

  // Studio Interactive Creation States
  const [drawingState, setDrawingState] = useState<{
    startPoint: Point | null;
    currentPoint: Point | null;
    polygonPoints: Point[];
  }>({
    startPoint: null,
    currentPoint: null,
    polygonPoints: [],
  });

  // Measure Tape state
  const [measurePoints, setMeasurePoints] = useState<{
    start: Point | null;
    end: Point | null;
  }>({ start: null, end: null });

  // 0. All Elements Selection & Dragging state
  const [internalAllSelected, setInternalAllSelected] = useState<boolean>(false);
  const isAllSelected = isAllElementsSelected !== undefined ? isAllElementsSelected : internalAllSelected;
  const setAllSelected = useCallback(
    (val: boolean) => {
      setInternalAllSelected(val);
      if (onToggleSelectAll) onToggleSelectAll(val);
    },
    [onToggleSelectAll]
  );

  const draggingAllRef = useRef<{
    startPointerFloor: Point;
    initialFloor: Floor;
    currentOffset: { dx: number; dy: number };
  } | null>(null);
  const [activeAllOffset, setActiveAllOffset] = useState<{ dx: number; dy: number } | null>(null);

  const allElementsBoundingBox = useMemo(() => {
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    let count = 0;

    floor.rooms.forEach((r) => {
      r.polygon.forEach((p) => {
        minX = Math.min(minX, p.x);
        minY = Math.min(minY, p.y);
        maxX = Math.max(maxX, p.x);
        maxY = Math.max(maxY, p.y);
      });
      count++;
    });

    (floor.zones || []).forEach((z) => {
      z.polygon.forEach((p) => {
        minX = Math.min(minX, p.x);
        minY = Math.min(minY, p.y);
        maxX = Math.max(maxX, p.x);
        maxY = Math.max(maxY, p.y);
      });
      count++;
    });

    floor.walls.forEach((w) => {
      minX = Math.min(minX, w.start.x, w.end.x);
      minY = Math.min(minY, w.start.y, w.end.y);
      maxX = Math.max(maxX, w.start.x, w.end.x);
      maxY = Math.max(maxY, w.start.y, w.end.y);
      count++;
    });

    floor.doors.forEach((d) => {
      minX = Math.min(minX, d.start.x, d.end.x);
      minY = Math.min(minY, d.start.y, d.end.y);
      maxX = Math.max(maxX, d.start.x, d.end.x);
      maxY = Math.max(maxY, d.start.y, d.end.y);
      count++;
    });

    floor.pois.forEach((p) => {
      minX = Math.min(minX, p.position.x);
      minY = Math.min(minY, p.position.y);
      maxX = Math.max(maxX, p.position.x);
      maxY = Math.max(maxY, p.position.y);
      count++;
    });

    floor.transitConnectors.forEach((t) => {
      minX = Math.min(minX, t.position.x);
      minY = Math.min(minY, t.position.y);
      maxX = Math.max(maxX, t.position.x);
      maxY = Math.max(maxY, t.position.y);
      count++;
    });

    (floor.navNodes || []).forEach((n) => {
      minX = Math.min(minX, n.position.x);
      minY = Math.min(minY, n.position.y);
      maxX = Math.max(maxX, n.position.x);
      maxY = Math.max(maxY, n.position.y);
    });

    if (count === 0 || !isFinite(minX)) return null;

    const dx = activeAllOffset ? activeAllOffset.dx : 0;
    const dy = activeAllOffset ? activeAllOffset.dy : 0;

    return {
      x: minX + dx - 15,
      y: minY + dy - 15,
      width: maxX - minX + 30,
      height: maxY - minY + 30,
      realWidthMeters: (maxX - minX) / PIXELS_PER_METER,
      realHeightMeters: (maxY - minY) / PIXELS_PER_METER,
      elementCount: count,
    };
  }, [floor, activeAllOffset]);

  const startAllElementsDrag = useCallback(
    (startPointerFloor: Point) => {
      draggingAllRef.current = {
        startPointerFloor,
        initialFloor: floor,
        currentOffset: { dx: 0, dy: 0 },
      };
      setActiveAllOffset({ dx: 0, dy: 0 });
    },
    [floor]
  );

  const nudgeAllElements = useCallback(
    (dx: number, dy: number) => {
      if (!onUpdateFloor) return;
      const updated = translateFloorElements(floor, dx, dy);
      onUpdateFloor(updated);
    },
    [floor, onUpdateFloor]
  );

  // 1. Room Vertex & Entire Room Dragging state
  const draggingVertexRef = useRef<{
    roomId: string;
    vertexIndex: number;
    currentPolygon: Point[];
  } | null>(null);
  const draggingRoomRef = useRef<{
    roomId: string;
    startPointerFloor: Point;
    initialPolygon: Point[];
  } | null>(null);
  const [activeDragPolygon, setActiveDragPolygon] = useState<{
    roomId: string;
    polygon: Point[];
  } | null>(null);

  // 1.5 Zone Vertex & Entire Zone Dragging state
  const draggingZoneVertexRef = useRef<{
    zoneId: string;
    vertexIndex: number;
    currentPolygon: Point[];
  } | null>(null);
  const draggingZoneRef = useRef<{
    zoneId: string;
    startPointerFloor: Point;
    initialPolygon: Point[];
    currentPolygon?: Point[];
  } | null>(null);
  const [activeDragZonePolygon, setActiveDragZonePolygon] = useState<{
    zoneId: string;
    polygon: Point[];
  } | null>(null);

  // 2. POI Dragging state
  const draggingPoiRef = useRef<{
    poiId: string;
    startPointerFloor: Point;
    initialPosition: Point;
  } | null>(null);
  const [activeDragPoi, setActiveDragPoi] = useState<{
    poiId: string;
    position: Point;
  } | null>(null);

  // 3. Transit Connector Dragging state
  const draggingTransitRef = useRef<{
    transitId: string;
    startPointerFloor: Point;
    initialPosition: Point;
  } | null>(null);
  const [activeDragTransit, setActiveDragTransit] = useState<{
    transitId: string;
    position: Point;
  } | null>(null);

  // 4. Nav Node Dragging state
  const draggingNavNodeRef = useRef<{
    nodeId: string;
    startPointerFloor: Point;
    initialPosition: Point;
  } | null>(null);
  const [activeDragNavNode, setActiveDragNavNode] = useState<{
    nodeId: string;
    position: Point;
  } | null>(null);

  // 5. Door Dragging state
  const draggingDoorRef = useRef<{
    doorId: string;
    startPointerFloor: Point;
    initialStart: Point;
    initialEnd: Point;
  } | null>(null);
  const [activeDragDoor, setActiveDragDoor] = useState<{
    doorId: string;
    start: Point;
    end: Point;
  } | null>(null);

  // 6. Wall Dragging state
  const draggingWallRef = useRef<{
    wallId: string;
    mode: 'start' | 'end' | 'body';
    startPointerFloor: Point;
    initialStart: Point;
    initialEnd: Point;
  } | null>(null);
  const [activeDragWall, setActiveDragWall] = useState<{
    wallId: string;
    start: Point;
    end: Point;
  } | null>(null);

  // Convert client mouse coordinates to floor coordinate space
  const screenToFloorCoords = useCallback(
    (clientX: number, clientY: number): Point => {
      if (!containerRef.current) return { x: 0, y: 0 };
      const rect = containerRef.current.getBoundingClientRect();
      const rawX = (clientX - rect.left - viewport.x) / viewport.zoom;
      const rawY = (clientY - rect.top - viewport.y) / viewport.zoom;
      return snapToGrid({ x: rawX, y: rawY }, gridSnapSize);
    },
    [viewport, gridSnapSize]
  );

  const startVertexDrag = useCallback(
    (roomId: string, vertexIndex: number, currentPolygon: Point[]) => {
      draggingVertexRef.current = {
        roomId,
        vertexIndex,
        currentPolygon: [...currentPolygon],
      };
      setActiveDragPolygon({
        roomId,
        polygon: [...currentPolygon],
      });
    },
    []
  );

  const startRoomDrag = useCallback(
    (roomId: string, startPointerFloor: Point, initialPolygon: Point[]) => {
      draggingRoomRef.current = {
        roomId,
        startPointerFloor,
        initialPolygon: [...initialPolygon],
      };
      setActiveDragPolygon({
        roomId,
        polygon: [...initialPolygon],
      });
    },
    []
  );

  const startZoneVertexDrag = useCallback(
    (zoneId: string, vertexIndex: number, currentPolygon: Point[]) => {
      draggingZoneVertexRef.current = {
        zoneId,
        vertexIndex,
        currentPolygon: [...currentPolygon],
      };
      setActiveDragZonePolygon({
        zoneId,
        polygon: [...currentPolygon],
      });
    },
    []
  );

  const startZoneDrag = useCallback(
    (zoneId: string, startPointerFloor: Point, initialPolygon: Point[]) => {
      draggingZoneRef.current = {
        zoneId,
        startPointerFloor,
        initialPolygon: [...initialPolygon],
        currentPolygon: [...initialPolygon],
      };
      setActiveDragZonePolygon({
        zoneId,
        polygon: [...initialPolygon],
      });
    },
    []
  );

  const startPoiDrag = useCallback(
    (poiId: string, startPointerFloor: Point, initialPosition: Point) => {
      draggingPoiRef.current = { poiId, startPointerFloor, initialPosition: { ...initialPosition } };
      setActiveDragPoi({ poiId, position: { ...initialPosition } });
    },
    []
  );

  const startTransitDrag = useCallback(
    (transitId: string, startPointerFloor: Point, initialPosition: Point) => {
      draggingTransitRef.current = { transitId, startPointerFloor, initialPosition: { ...initialPosition } };
      setActiveDragTransit({ transitId, position: { ...initialPosition } });
    },
    []
  );

  const startNavNodeDrag = useCallback(
    (nodeId: string, startPointerFloor: Point, initialPosition: Point) => {
      draggingNavNodeRef.current = { nodeId, startPointerFloor, initialPosition: { ...initialPosition } };
      setActiveDragNavNode({ nodeId, position: { ...initialPosition } });
    },
    []
  );

  const startDoorDrag = useCallback(
    (doorId: string, startPointerFloor: Point, initialStart: Point, initialEnd: Point) => {
      draggingDoorRef.current = {
        doorId,
        startPointerFloor,
        initialStart: { ...initialStart },
        initialEnd: { ...initialEnd },
      };
      setActiveDragDoor({ doorId, start: { ...initialStart }, end: { ...initialEnd } });
    },
    []
  );

  const startWallDrag = useCallback(
    (wallId: string, mode: 'start' | 'end' | 'body', startPointerFloor: Point, initialStart: Point, initialEnd: Point) => {
      draggingWallRef.current = {
        wallId,
        mode,
        startPointerFloor,
        initialStart: { ...initialStart },
        initialEnd: { ...initialEnd },
      };
      setActiveDragWall({ wallId, start: { ...initialStart }, end: { ...initialEnd } });
    },
    []
  );

  // Global Pointer Listeners for smooth, uninterrupted drag of ANY CAD element
  useEffect(() => {
    const handleGlobalPointerMove = (e: PointerEvent) => {
      // 0. Dragging ALL elements simultaneously
      if (draggingAllRef.current) {
        const floorPt = screenToFloorCoords(e.clientX, e.clientY);
        const { startPointerFloor } = draggingAllRef.current;
        let dx = floorPt.x - startPointerFloor.x;
        let dy = floorPt.y - startPointerFloor.y;
        if (gridSnapSize > 0) {
          dx = Math.round(dx / gridSnapSize) * gridSnapSize;
          dy = Math.round(dy / gridSnapSize) * gridSnapSize;
        }
        draggingAllRef.current.currentOffset = { dx, dy };
        setActiveAllOffset({ dx, dy });
        return;
      }

      // 1. Dragging single room vertex
      if (draggingVertexRef.current) {
        const floorPt = screenToFloorCoords(e.clientX, e.clientY);
        const { roomId, vertexIndex, currentPolygon } = draggingVertexRef.current;
        const updatedPolygon = [...currentPolygon];
        updatedPolygon[vertexIndex] = floorPt;
        draggingVertexRef.current.currentPolygon = updatedPolygon;
        setActiveDragPolygon({ roomId, polygon: updatedPolygon });
        return;
      }

      // 2. Dragging entire room
      if (draggingRoomRef.current) {
        const floorPt = screenToFloorCoords(e.clientX, e.clientY);
        const { roomId, startPointerFloor, initialPolygon } = draggingRoomRef.current;
        const dx = floorPt.x - startPointerFloor.x;
        const dy = floorPt.y - startPointerFloor.y;
        const movedPolygon = initialPolygon.map((p) => ({
          x: p.x + dx,
          y: p.y + dy,
        }));
        setActiveDragPolygon({ roomId, polygon: movedPolygon });
        return;
      }

      // 2.5 Dragging single zone vertex
      if (draggingZoneVertexRef.current) {
        const floorPt = screenToFloorCoords(e.clientX, e.clientY);
        const { zoneId, vertexIndex, currentPolygon } = draggingZoneVertexRef.current;
        const updatedPolygon = [...currentPolygon];
        updatedPolygon[vertexIndex] = floorPt;
        draggingZoneVertexRef.current.currentPolygon = updatedPolygon;
        setActiveDragZonePolygon({ zoneId, polygon: updatedPolygon });
        return;
      }

      // 2.6 Dragging entire zone
      if (draggingZoneRef.current) {
        const floorPt = screenToFloorCoords(e.clientX, e.clientY);
        const { zoneId, startPointerFloor, initialPolygon } = draggingZoneRef.current;
        const dx = floorPt.x - startPointerFloor.x;
        const dy = floorPt.y - startPointerFloor.y;
        const movedPolygon = initialPolygon.map((p) => ({
          x: p.x + dx,
          y: p.y + dy,
        }));
        draggingZoneRef.current.currentPolygon = movedPolygon;
        setActiveDragZonePolygon({ zoneId, polygon: movedPolygon });
        return;
      }

      // 3. Dragging POI
      if (draggingPoiRef.current) {
        const floorPt = screenToFloorCoords(e.clientX, e.clientY);
        const { poiId, startPointerFloor, initialPosition } = draggingPoiRef.current;
        const dx = floorPt.x - startPointerFloor.x;
        const dy = floorPt.y - startPointerFloor.y;
        setActiveDragPoi({
          poiId,
          position: { x: initialPosition.x + dx, y: initialPosition.y + dy },
        });
        return;
      }

      // 4. Dragging Transit Connector (Lift / Stairs)
      if (draggingTransitRef.current) {
        const floorPt = screenToFloorCoords(e.clientX, e.clientY);
        const { transitId, startPointerFloor, initialPosition } = draggingTransitRef.current;
        const dx = floorPt.x - startPointerFloor.x;
        const dy = floorPt.y - startPointerFloor.y;
        setActiveDragTransit({
          transitId,
          position: { x: initialPosition.x + dx, y: initialPosition.y + dy },
        });
        return;
      }

      // 5. Dragging Nav Node
      if (draggingNavNodeRef.current) {
        const floorPt = screenToFloorCoords(e.clientX, e.clientY);
        const { nodeId, startPointerFloor, initialPosition } = draggingNavNodeRef.current;
        const dx = floorPt.x - startPointerFloor.x;
        const dy = floorPt.y - startPointerFloor.y;
        setActiveDragNavNode({
          nodeId,
          position: { x: initialPosition.x + dx, y: initialPosition.y + dy },
        });
        return;
      }

      // 6. Dragging Door (Dynamic Wall Snapping & Orientation)
      if (draggingDoorRef.current) {
        const floorPt = screenToFloorCoords(e.clientX, e.clientY);
        const { doorId, startPointerFloor, initialStart, initialEnd } = draggingDoorRef.current;
        const initialLen = distance(initialStart, initialEnd) || 18;
        const aligned = alignDoorToWall(floorPt, floor.walls, floor.rooms, initialLen);
        if (aligned.isSnapped) {
          setActiveDragDoor({
            doorId,
            start: aligned.start,
            end: aligned.end,
          });
        } else {
          const dx = floorPt.x - startPointerFloor.x;
          const dy = floorPt.y - startPointerFloor.y;
          setActiveDragDoor({
            doorId,
            start: { x: initialStart.x + dx, y: initialStart.y + dy },
            end: { x: initialEnd.x + dx, y: initialEnd.y + dy },
          });
        }
        return;
      }

      // 7. Dragging Wall (Endpoints or Body)
      if (draggingWallRef.current) {
        const floorPt = screenToFloorCoords(e.clientX, e.clientY);
        const { wallId, mode, startPointerFloor, initialStart, initialEnd } = draggingWallRef.current;
        if (mode === 'start') {
          setActiveDragWall({ wallId, start: floorPt, end: initialEnd });
        } else if (mode === 'end') {
          setActiveDragWall({ wallId, start: initialStart, end: floorPt });
        } else {
          const dx = floorPt.x - startPointerFloor.x;
          const dy = floorPt.y - startPointerFloor.y;
          setActiveDragWall({
            wallId,
            start: { x: initialStart.x + dx, y: initialStart.y + dy },
            end: { x: initialEnd.x + dx, y: initialEnd.y + dy },
          });
        }
        return;
      }
    };

    const handleGlobalPointerUp = () => {
      // 0. Commit ALL elements drag
      if (draggingAllRef.current && onUpdateFloor) {
        const { initialFloor, currentOffset } = draggingAllRef.current;
        const { dx, dy } = currentOffset;
        if (dx !== 0 || dy !== 0) {
          const updated = translateFloorElements(initialFloor, dx, dy);
          onUpdateFloor(updated);
        }
      }

      // 1. Commit vertex drag
      if (draggingVertexRef.current && onUpdateFloor) {
        const { roomId, currentPolygon } = draggingVertexRef.current;
        let newWidth = floor.width;
        let newHeight = floor.height;
        for (const p of currentPolygon) {
          if (p.x + 150 > newWidth) newWidth = Math.ceil((p.x + 200) / 100) * 100;
          if (p.y + 150 > newHeight) newHeight = Math.ceil((p.y + 200) / 100) * 100;
        }

        onUpdateFloor({
          ...floor,
          width: newWidth,
          height: newHeight,
          rooms: floor.rooms.map((r) =>
            r.id === roomId ? { ...r, polygon: currentPolygon } : r
          ),
        });
      }

      // 2. Commit entire room drag
      if (draggingRoomRef.current && onUpdateFloor && activeDragPolygon) {
        const { roomId } = draggingRoomRef.current;
        const finalPolygon = activeDragPolygon.polygon;
        let newWidth = floor.width;
        let newHeight = floor.height;
        for (const p of finalPolygon) {
          if (p.x + 150 > newWidth) newWidth = Math.ceil((p.x + 200) / 100) * 100;
          if (p.y + 150 > newHeight) newHeight = Math.ceil((p.y + 200) / 100) * 100;
        }

        onUpdateFloor({
          ...floor,
          width: newWidth,
          height: newHeight,
          rooms: floor.rooms.map((r) =>
            r.id === roomId ? { ...r, polygon: finalPolygon } : r
          ),
        });
      }

      // 2.5 Commit zone vertex drag
      if (draggingZoneVertexRef.current && onUpdateFloor) {
        const { zoneId, currentPolygon } = draggingZoneVertexRef.current;
        let newWidth = floor.width;
        let newHeight = floor.height;
        for (const p of currentPolygon) {
          if (p.x + 150 > newWidth) newWidth = Math.ceil((p.x + 200) / 100) * 100;
          if (p.y + 150 > newHeight) newHeight = Math.ceil((p.y + 200) / 100) * 100;
        }

        onUpdateFloor({
          ...floor,
          width: newWidth,
          height: newHeight,
          zones: (floor.zones || []).map((z) =>
            z.id === zoneId ? { ...z, polygon: currentPolygon } : z
          ),
        });
      }

      // 2.6 Commit entire zone drag
      if (draggingZoneRef.current && onUpdateFloor) {
        const { zoneId, currentPolygon, initialPolygon } = draggingZoneRef.current;
        const finalPolygon = currentPolygon || activeDragZonePolygon?.polygon || initialPolygon;
        if (finalPolygon) {
          let newWidth = floor.width;
          let newHeight = floor.height;
          for (const p of finalPolygon) {
            if (p.x + 150 > newWidth) newWidth = Math.ceil((p.x + 200) / 100) * 100;
            if (p.y + 150 > newHeight) newHeight = Math.ceil((p.y + 200) / 100) * 100;
          }

          onUpdateFloor({
            ...floor,
            width: newWidth,
            height: newHeight,
            zones: (floor.zones || []).map((z) =>
              z.id === zoneId ? { ...z, polygon: finalPolygon } : z
            ),
          });
        }
      }

      // 3. Commit POI drag
      if (draggingPoiRef.current && onUpdateFloor && activeDragPoi) {
        const { poiId } = draggingPoiRef.current;
        onUpdateFloor({
          ...floor,
          pois: floor.pois.map((p) =>
            p.id === poiId ? { ...p, position: activeDragPoi.position } : p
          ),
        });
      }

      // 4. Commit Transit drag
      if (draggingTransitRef.current && onUpdateFloor && activeDragTransit) {
        const { transitId } = draggingTransitRef.current;
        onUpdateFloor({
          ...floor,
          transitConnectors: floor.transitConnectors.map((t) =>
            t.id === transitId ? { ...t, position: activeDragTransit.position } : t
          ),
        });
      }

      // 5. Commit NavNode drag
      if (draggingNavNodeRef.current && onUpdateFloor && activeDragNavNode) {
        const { nodeId } = draggingNavNodeRef.current;
        onUpdateFloor({
          ...floor,
          navNodes: floor.navNodes.map((n) =>
            n.id === nodeId ? { ...n, position: activeDragNavNode.position } : n
          ),
        });
      }

      // 6. Commit Door drag
      if (draggingDoorRef.current && onUpdateFloor && activeDragDoor) {
        const { doorId } = draggingDoorRef.current;
        onUpdateFloor({
          ...floor,
          doors: floor.doors.map((d) =>
            d.id === doorId ? { ...d, start: activeDragDoor.start, end: activeDragDoor.end } : d
          ),
        });
      }

      // 7. Commit Wall drag
      if (draggingWallRef.current && onUpdateFloor && activeDragWall) {
        const { wallId } = draggingWallRef.current;
        onUpdateFloor({
          ...floor,
          walls: floor.walls.map((w) =>
            w.id === wallId ? { ...w, start: activeDragWall.start, end: activeDragWall.end } : w
          ),
        });
      }

      draggingAllRef.current = null;
      draggingVertexRef.current = null;
      draggingRoomRef.current = null;
      draggingZoneVertexRef.current = null;
      draggingZoneRef.current = null;
      draggingPoiRef.current = null;
      draggingTransitRef.current = null;
      draggingNavNodeRef.current = null;
      draggingDoorRef.current = null;
      draggingWallRef.current = null;

      setActiveAllOffset(null);
      setActiveDragPolygon(null);
      setActiveDragZonePolygon(null);
      setActiveDragPoi(null);
      setActiveDragTransit(null);
      setActiveDragNavNode(null);
      setActiveDragDoor(null);
      setActiveDragWall(null);
    };

    window.addEventListener('pointermove', handleGlobalPointerMove);
    window.addEventListener('pointerup', handleGlobalPointerUp);
    window.addEventListener('pointercancel', handleGlobalPointerUp);

    return () => {
      window.removeEventListener('pointermove', handleGlobalPointerMove);
      window.removeEventListener('pointerup', handleGlobalPointerUp);
      window.removeEventListener('pointercancel', handleGlobalPointerUp);
    };
  }, [
    screenToFloorCoords,
    floor,
    onUpdateFloor,
    activeDragPolygon,
    activeDragPoi,
    activeDragTransit,
    activeDragNavNode,
    activeDragDoor,
    activeDragWall,
  ]);

  // Dynamic Auto-Expanding Bounds for Grid & Canvas
  const computedBounds = useMemo(() => {
    let minX = 0;
    let minY = 0;
    let maxX = floor.width || 1600;
    let maxY = floor.height || 1000;

    // Check all rooms
    for (const r of floor.rooms) {
      const poly =
        activeDragPolygon && activeDragPolygon.roomId === r.id
          ? activeDragPolygon.polygon
          : r.polygon;
      for (const p of poly) {
        if (p.x < minX) minX = p.x;
        if (p.y < minY) minY = p.y;
        if (p.x > maxX) maxX = p.x;
        if (p.y > maxY) maxY = p.y;
      }
    }

    // Check walls
    for (const w of floor.walls) {
      if (w.start.x < minX) minX = w.start.x;
      if (w.start.y < minY) minY = w.start.y;
      if (w.end.x < minX) minX = w.end.x;
      if (w.end.y < minY) minY = w.end.y;
      if (w.start.x > maxX) maxX = w.start.x;
      if (w.start.y > maxY) maxY = w.start.y;
      if (w.end.x > maxX) maxX = w.end.x;
      if (w.end.y > maxY) maxY = w.end.y;
    }

    // Check transits and POIs
    for (const t of floor.transitConnectors) {
      const pos = activeDragTransit && activeDragTransit.transitId === t.id ? activeDragTransit.position : t.position;
      if (pos.x - 60 < minX) minX = pos.x - 60;
      if (pos.y - 60 < minY) minY = pos.y - 60;
      if (pos.x + 60 > maxX) maxX = pos.x + 60;
      if (pos.y + 60 > maxY) maxY = pos.y + 60;
    }

    for (const poi of floor.pois) {
      const pos = activeDragPoi && activeDragPoi.poiId === poi.id ? activeDragPoi.position : poi.position;
      if (pos.x - 40 < minX) minX = pos.x - 40;
      if (pos.y - 40 < minY) minY = pos.y - 40;
      if (pos.x + 40 > maxX) maxX = pos.x + 40;
      if (pos.y + 40 > maxY) maxY = pos.y + 40;
    }

    // Check active drawing points
    for (const p of drawingState.polygonPoints) {
      if (p.x < minX) minX = p.x;
      if (p.y < minY) minY = p.y;
      if (p.x > maxX) maxX = p.x;
      if (p.y > maxY) maxY = p.y;
    }
    if (drawingState.currentPoint) {
      const p = drawingState.currentPoint;
      if (p.x < minX) minX = p.x;
      if (p.y < minY) minY = p.y;
      if (p.x > maxX) maxX = p.x;
      if (p.y > maxY) maxY = p.y;
    }

    // Generous buffer margin around the canvas bounds
    const margin = 200;
    const roundedMinX = Math.floor((minX - margin) / 100) * 100;
    const roundedMinY = Math.floor((minY - margin) / 100) * 100;
    const roundedMaxX = Math.ceil((maxX + margin) / 100) * 100;
    const roundedMaxY = Math.ceil((maxY + margin) / 100) * 100;

    return {
      minX: roundedMinX,
      minY: roundedMinY,
      maxX: roundedMaxX,
      maxY: roundedMaxY,
      width: roundedMaxX - roundedMinX,
      height: roundedMaxY - roundedMinY,
    };
  }, [
    floor,
    activeDragPolygon,
    activeDragPoi,
    activeDragTransit,
    activeDragNavNode,
    activeDragDoor,
    activeDragWall,
    drawingState,
  ]);

  const computedBoundsRef = useRef(computedBounds);
  useEffect(() => {
    computedBoundsRef.current = computedBounds;
  }, [computedBounds]);

  // Reset Viewport to fit all content
  const handleFitToScreen = useCallback(() => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const padding = 60;
    const availableWidth = rect.width - padding * 2;
    const availableHeight = rect.height - padding * 2;

    const bounds = computedBoundsRef.current;
    const spanWidth = Math.max(100, bounds.width);
    const spanHeight = Math.max(100, bounds.height);
    const zoomX = availableWidth / spanWidth;
    const zoomY = availableHeight / spanHeight;
    const optimalZoom = Math.min(1.6, Math.max(0.3, Math.min(zoomX, zoomY)));

    const centeredX = (rect.width - spanWidth * optimalZoom) / 2 - bounds.minX * optimalZoom;
    const centeredY = (rect.height - spanHeight * optimalZoom) / 2 - bounds.minY * optimalZoom;

    setViewport({
      x: centeredX,
      y: centeredY,
      zoom: optimalZoom,
    });
  }, []);

  // Auto-fit to screen ONLY on initial mount or when switching to a different floor
  const lastFloorIdRef = useRef<string | null>(null);
  useEffect(() => {
    if (lastFloorIdRef.current !== floor.id) {
      lastFloorIdRef.current = floor.id;
      handleFitToScreen();
    }
  }, [floor.id, handleFitToScreen]);

  // Zoom controls
  const handleZoom = (factor: number, centerX?: number, centerY?: number) => {
    setViewport((prev) => {
      const newZoom = Math.min(3.0, Math.max(0.3, prev.zoom * factor));
      if (centerX !== undefined && centerY !== undefined && containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        const mouseX = centerX - rect.left;
        const mouseY = centerY - rect.top;
        const newX = mouseX - (mouseX - prev.x) * (newZoom / prev.zoom);
        const newY = mouseY - (mouseY - prev.y) * (newZoom / prev.zoom);
        return { x: newX, y: newY, zoom: newZoom };
      }
      return { ...prev, zoom: newZoom };
    });
  };

  // Wheel zoom handler
  const handleWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (e.ctrlKey || e.metaKey || true) {
      const zoomFactor = e.deltaY < 0 ? 1.1 : 0.9;
      handleZoom(zoomFactor, e.clientX, e.clientY);
    }
  };

  // Mouse Down
  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    setWayfinderActionMenu(null);
    // Middle click or Space + Click or Select Tool dragging on background initiates Pan
    if (e.button === 1 || e.button === 2 || (activeTool === 'select' && e.target === svgRef.current)) {
      setIsPanning(true);
      setPanStart({ x: e.clientX - viewport.x, y: e.clientY - viewport.y });
      return;
    }

    if (!isStudioMode) {
      if (e.button === 0) {
        setIsPanning(true);
        setPanStart({ x: e.clientX - viewport.x, y: e.clientY - viewport.y });
      }
      return;
    }

    // Studio Mode Tools
    const floorPt = screenToFloorCoords(e.clientX, e.clientY);

    if (activeTool === 'measure') {
      if (!measurePoints.start) {
        setMeasurePoints({ start: floorPt, end: floorPt });
      } else {
        setMeasurePoints({ start: null, end: null });
      }
      return;
    }

    if (activeTool === 'room') {
      if (drawingState.polygonPoints.length === 0) {
        setDrawingState({
          startPoint: floorPt,
          currentPoint: floorPt,
          polygonPoints: [floorPt],
        });
      } else {
        const startPt = drawingState.polygonPoints[0];
        const isClosing =
          drawingState.polygonPoints.length >= 3 && distance(startPt, floorPt) < 22;

        if (isClosing) {
          // Finish multi-point polygon room
          const finalPolygon = drawingState.polygonPoints;
          const newRoom: Room = {
            id: `room-${Date.now()}`,
            floorId: floor.id,
            name: `Helyiség ${floor.rooms.length + 1}`,
            code: `${floor.shortCode}-${100 + floor.rooms.length + 1}`,
            category: 'classroom',
            polygon: finalPolygon,
            doorLocation: {
              x: Math.round((finalPolygon[0].x + finalPolygon[1].x) / 2),
              y: Math.round((finalPolygon[0].y + finalPolygon[1].y) / 2),
            },
            navNodeId: `node-room-${Date.now()}`,
            capacity: 25,
            tags: ['Akadálymentes'],
            colorHatch: 'rgba(26, 60, 43, 0.08)',
          };

          if (onUpdateFloor) {
            onUpdateFloor({
              ...floor,
              rooms: [...floor.rooms, newRoom],
            });
          }
          setDrawingState({ startPoint: null, currentPoint: null, polygonPoints: [] });
        } else {
          // Add next vertex to polygon
          setDrawingState((prev) => ({
            ...prev,
            currentPoint: floorPt,
            polygonPoints: [...prev.polygonPoints, floorPt],
          }));
        }
      }
      return;
    }

    if (activeTool === 'zone') {
      if (drawingState.polygonPoints.length === 0) {
        setDrawingState({
          startPoint: floorPt,
          currentPoint: floorPt,
          polygonPoints: [floorPt],
        });
      } else {
        const startPt = drawingState.polygonPoints[0];
        const isClosing =
          drawingState.polygonPoints.length >= 3 && distance(startPt, floorPt) < 22;

        if (isClosing) {
          const finalPolygon = drawingState.polygonPoints;
          const zoneCount = (floor.zones || []).length + 1;
          const newZone: Zone = {
            id: `zone-${Date.now()}`,
            floorId: floor.id,
            name: `Központi Aula & Átrium ${zoneCount > 1 ? zoneCount : ''}`.trim(),
            code: `Z-${String(zoneCount).padStart(2, '0')}`,
            type: 'atrium',
            polygon: finalPolygon,
            tags: ['Aula', 'Közösségi Tér'],
          };
          if (onUpdateFloor) {
            onUpdateFloor({
              ...floor,
              zones: [...(floor.zones || []), newZone],
            });
          }
          if (onSelectZone) onSelectZone(newZone);
          setDrawingState({ startPoint: null, currentPoint: null, polygonPoints: [] });
        } else {
          setDrawingState((prev) => ({
            ...prev,
            currentPoint: floorPt,
            polygonPoints: [...prev.polygonPoints, floorPt],
          }));
        }
      }
      return;
    }

    if (activeTool === 'wall') {
      if (!drawingState.startPoint) {
        setDrawingState({
          startPoint: floorPt,
          currentPoint: floorPt,
          polygonPoints: [floorPt],
        });
      } else {
        const newWall: Wall = {
          id: `wall-${Date.now()}`,
          floorId: floor.id,
          start: drawingState.startPoint,
          end: floorPt,
          thickness: 3,
        };
        if (onUpdateFloor) {
          onUpdateFloor({
            ...floor,
            walls: [...floor.walls, newWall],
          });
        }
        setDrawingState({ startPoint: null, currentPoint: null, polygonPoints: [] });
      }
      return;
    }

    if (activeTool === 'door') {
      const aligned = alignDoorToWall(floorPt, floor.walls, floor.rooms, 18);
      const newDoor: Door = {
        id: `door-${Date.now()}`,
        floorId: floor.id,
        start: aligned.start,
        end: aligned.end,
        type: 'single',
      };
      if (onUpdateFloor) {
        onUpdateFloor({
          ...floor,
          doors: [...floor.doors, newDoor],
        });
      }
      return;
    }

    if (activeTool === 'transit') {
      const isStairNext = floor.transitConnectors.length % 2 === 1;
      const newTransit: TransitConnector = {
        id: `transit-${Date.now()}`,
        floorId: floor.id,
        transitGroupId: `SHAFT-${isStairNext ? 'STAIR' : 'ELEV'}-${Date.now().toString().slice(-4)}`,
        type: isStairNext ? 'stairs' : 'elevator',
        name: isStairNext
          ? `Lépcsőház ${Math.floor(floor.transitConnectors.length / 2) + 1}`
          : `Lift ${Math.floor(floor.transitConnectors.length / 2) + 1}`,
        position: floorPt,
        width: 48,
        height: 48,
        navNodeId: `node-transit-${Date.now()}`,
        isAccessible: !isStairNext,
        servesFloorIds: [floor.id],
      };
      if (onUpdateFloor) {
        onUpdateFloor({
          ...floor,
          transitConnectors: [...floor.transitConnectors, newTransit],
        });
      }
      if (onSelectTransit) onSelectTransit(newTransit);
      return;
    }

    if (activeTool === 'poi') {
      const hasEntrance = floor.pois.some((p) => p.type === 'entrance');
      const nextType: POIType = !hasEntrance ? 'entrance' : 'exit';
      const newPOI: PointOfInterest = {
        id: `poi-${Date.now()}`,
        floorId: floor.id,
        type: nextType,
        name: nextType === 'entrance' ? 'Főbejárat' : `Kijárat ${floor.pois.filter((p) => p.type === 'exit').length + 1}`,
        position: floorPt,
        description: nextType === 'entrance' ? 'Épület bejárati pont' : 'Épület kijárati pont',
      };
      if (onUpdateFloor) {
        onUpdateFloor({
          ...floor,
          pois: [...floor.pois, newPOI],
        });
      }
      if (onSelectPOI) onSelectPOI(newPOI);
      return;
    }

    if (activeTool === 'nav_node') {
      const newNode: NavNode = {
        id: `node-user-${Date.now()}`,
        floorId: floor.id,
        position: floorPt,
        type: 'corridor',
        label: 'Walkable Waypoint',
      };
      if (onUpdateFloor) {
        onUpdateFloor({
          ...floor,
          navNodes: [...floor.navNodes, newNode],
        });
      }
      return;
    }

    if (activeTool === 'eraser') {
      if (!onUpdateFloor) return;

      // 1. Check POI (within 20px)
      const hitPOI = floor.pois.find((p) => distance(p.position, floorPt) < 20);
      if (hitPOI) {
        onUpdateFloor({
          ...floor,
          pois: floor.pois.filter((p) => p.id !== hitPOI.id),
        });
        return;
      }

      // 2. Check Transit Connector
      const hitTransit = floor.transitConnectors.find(
        (t) => distance(t.position, floorPt) < Math.max(t.width, t.height) / 2 + 12
      );
      if (hitTransit) {
        onUpdateFloor({
          ...floor,
          transitConnectors: floor.transitConnectors.filter((t) => t.id !== hitTransit.id),
        });
        return;
      }

      // 3. Check Nav Node (within 16px)
      const hitNode = floor.navNodes.find((n) => distance(n.position, floorPt) < 16);
      if (hitNode) {
        onUpdateFloor({
          ...floor,
          navNodes: floor.navNodes.filter((n) => n.id !== hitNode.id),
          navEdges: floor.navEdges.filter((e) => e.fromNodeId !== hitNode.id && e.toNodeId !== hitNode.id),
        });
        return;
      }

      // 4. Check Door (within 18px)
      const hitDoor = floor.doors.find((d) => {
        const midX = (d.start.x + d.end.x) / 2;
        const midY = (d.start.y + d.end.y) / 2;
        return distance({ x: midX, y: midY }, floorPt) < 18;
      });
      if (hitDoor) {
        onUpdateFloor({
          ...floor,
          doors: floor.doors.filter((d) => d.id !== hitDoor.id),
        });
        return;
      }

      // 5. Check Wall (point-to-segment distance < 16px)
      const hitWall = floor.walls.find((w) => {
        const dx = w.end.x - w.start.x;
        const dy = w.end.y - w.start.y;
        const lenSq = dx * dx + dy * dy;
        if (lenSq === 0) return distance(w.start, floorPt) < 16;
        const t = Math.max(0, Math.min(1, ((floorPt.x - w.start.x) * dx + (floorPt.y - w.start.y) * dy) / lenSq));
        const proj = { x: w.start.x + t * dx, y: w.start.y + t * dy };
        return distance(proj, floorPt) < 16;
      });
      if (hitWall) {
        onUpdateFloor({
          ...floor,
          walls: floor.walls.filter((w) => w.id !== hitWall.id),
        });
        return;
      }

      // 6. Check Room (point inside polygon)
      const hitRoom = floor.rooms.slice().reverse().find((r) => {
        let inside = false;
        const vs = r.polygon;
        for (let i = 0, j = vs.length - 1; i < vs.length; j = i++) {
          const xi = vs[i].x, yi = vs[i].y;
          const xj = vs[j].y, yj = vs[j].y;
          const intersect = ((vs[i].y > floorPt.y) !== (vs[j].y > floorPt.y)) &&
            (floorPt.x < (vs[j].x - vs[i].x) * (floorPt.y - vs[i].y) / (vs[j].y - vs[i].y) + vs[i].x);
          if (intersect) inside = !inside;
        }
        return inside;
      });
      if (hitRoom) {
        if (window.confirm(`Biztosan törölni szeretné a(z) ${hitRoom.name} (${hitRoom.code}) helyiséget?`)) {
          onUpdateFloor({
            ...floor,
            rooms: floor.rooms.filter((r) => r.id !== hitRoom.id),
          });
        }
        return;
      }

      return;
    }
  };

  // Mouse Move
  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const floorPt = screenToFloorCoords(e.clientX, e.clientY);
    setCursorFloorPos(floorPt);

    if (isPanning) {
      setViewport((prev) => ({
        ...prev,
        x: e.clientX - panStart.x,
        y: e.clientY - panStart.y,
      }));
      return;
    }

    if (drawingState.startPoint) {
      setDrawingState((prev) => ({ ...prev, currentPoint: floorPt }));
    }

    if (measurePoints.start && !measurePoints.end) {
      setMeasurePoints((prev) => ({ ...prev, end: floorPt }));
    }
  };

  // Mouse Up
  const handleMouseUp = () => {
    setIsPanning(false);
  };

  // Double click to finish polygon room or zone
  const handleDoubleClick = () => {
    if (activeTool === 'room' && drawingState.polygonPoints.length >= 3) {
      const finalPolygon = drawingState.polygonPoints;
      const newRoom: Room = {
        id: `room-${Date.now()}`,
        floorId: floor.id,
        name: `Helyiség ${floor.rooms.length + 1}`,
        code: `${floor.shortCode}-${100 + floor.rooms.length + 1}`,
        category: 'classroom',
        polygon: finalPolygon,
        doorLocation: {
          x: Math.round((finalPolygon[0].x + finalPolygon[1].x) / 2),
          y: Math.round((finalPolygon[0].y + finalPolygon[1].y) / 2),
        },
        navNodeId: `node-room-${Date.now()}`,
        capacity: 25,
        tags: ['Akadálymentes'],
        colorHatch: 'rgba(26, 60, 43, 0.08)',
      };

      if (onUpdateFloor) {
        onUpdateFloor({
          ...floor,
          rooms: [...floor.rooms, newRoom],
        });
      }
      setDrawingState({ startPoint: null, currentPoint: null, polygonPoints: [] });
    } else if (activeTool === 'zone' && drawingState.polygonPoints.length >= 3) {
      const finalPolygon = drawingState.polygonPoints;
      const zoneCount = (floor.zones || []).length + 1;
      const newZone: Zone = {
        id: `zone-${Date.now()}`,
        floorId: floor.id,
        name: `Központi Aula & Átrium ${zoneCount > 1 ? zoneCount : ''}`.trim(),
        code: `Z-${String(zoneCount).padStart(2, '0')}`,
        type: 'atrium',
        polygon: finalPolygon,
        tags: ['Aula', 'Közösségi Tér'],
      };
      if (onUpdateFloor) {
        onUpdateFloor({
          ...floor,
          zones: [...(floor.zones || []), newZone],
        });
      }
      if (onSelectZone) onSelectZone(newZone);
      setDrawingState({ startPoint: null, currentPoint: null, polygonPoints: [] });
    }
  };

  // Global Keyboard shortcuts while drawing (Enter / Escape)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const isInput =
        target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable);

      if (e.key === 'Enter' && activeTool === 'room' && drawingState.polygonPoints.length >= 3) {
        const finalPolygon = drawingState.polygonPoints;
        const newRoom: Room = {
          id: `room-${Date.now()}`,
          floorId: floor.id,
          name: `Helyiség ${floor.rooms.length + 1}`,
          code: `${floor.shortCode}-${100 + floor.rooms.length + 1}`,
          category: 'classroom',
          polygon: finalPolygon,
          doorLocation: {
            x: Math.round((finalPolygon[0].x + finalPolygon[1].x) / 2),
            y: Math.round((finalPolygon[0].y + finalPolygon[1].y) / 2),
          },
          navNodeId: `node-room-${Date.now()}`,
          capacity: 25,
          tags: ['Akadálymentes'],
          colorHatch: 'rgba(26, 60, 43, 0.08)',
        };

        if (onUpdateFloor) {
          onUpdateFloor({
            ...floor,
            rooms: [...floor.rooms, newRoom],
          });
        }
        setDrawingState({ startPoint: null, currentPoint: null, polygonPoints: [] });
      } else if (e.key === 'Enter' && activeTool === 'zone' && drawingState.polygonPoints.length >= 3) {
        const finalPolygon = drawingState.polygonPoints;
        const zoneCount = (floor.zones || []).length + 1;
        const newZone: Zone = {
          id: `zone-${Date.now()}`,
          floorId: floor.id,
          name: `Központi Aula & Átrium ${zoneCount > 1 ? zoneCount : ''}`.trim(),
          code: `Z-${String(zoneCount).padStart(2, '0')}`,
          type: 'atrium',
          polygon: finalPolygon,
          tags: ['Aula', 'Közösségi Tér'],
        };
        if (onUpdateFloor) {
          onUpdateFloor({
            ...floor,
            zones: [...(floor.zones || []), newZone],
          });
        }
        if (onSelectZone) onSelectZone(newZone);
        setDrawingState({ startPoint: null, currentPoint: null, polygonPoints: [] });
      } else if (e.key === 'Escape') {
        if (isAllSelected) {
          setAllSelected(false);
        }
        setDrawingState({ startPoint: null, currentPoint: null, polygonPoints: [] });
      }

      // Ctrl+A to select all elements in Studio Mode
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'a' && isStudioMode && !isInput) {
        e.preventDefault();
        setAllSelected(true);
        if (onSelectRoom) onSelectRoom(null);
        if (onSelectZone) onSelectZone(null);
        if (onSelectTransit) onSelectTransit(null);
        if (onSelectPOI) onSelectPOI(null);
        return;
      }

      // Arrow keys to nudge ALL elements when all elements are selected
      if (
        isStudioMode &&
        activeTool === 'select' &&
        isAllSelected &&
        ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)
      ) {
        e.preventDefault();
        const step = e.shiftKey ? 20 : 5;
        let dx = 0;
        let dy = 0;
        if (e.key === 'ArrowUp') dy = -step;
        if (e.key === 'ArrowDown') dy = step;
        if (e.key === 'ArrowLeft') dx = -step;
        if (e.key === 'ArrowRight') dx = step;
        nudgeAllElements(dx, dy);
        return;
      }

      // Arrow keys to nudge selected room with precision in CAD Studio
      if (
        isStudioMode &&
        activeTool === 'select' &&
        selectedRoomId &&
        ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)
      ) {
        e.preventDefault();
        const targetRoom = floor.rooms.find((r) => r.id === selectedRoomId);
        if (targetRoom && onUpdateFloor) {
          const step = e.shiftKey ? 20 : 5;
          let dx = 0;
          let dy = 0;
          if (e.key === 'ArrowUp') dy = -step;
          if (e.key === 'ArrowDown') dy = step;
          if (e.key === 'ArrowLeft') dx = -step;
          if (e.key === 'ArrowRight') dx = step;

          const movedPolygon = targetRoom.polygon.map((p) => ({
            x: p.x + dx,
            y: p.y + dy,
          }));

          let newWidth = floor.width;
          let newHeight = floor.height;
          for (const p of movedPolygon) {
            if (p.x + 150 > newWidth) newWidth = Math.ceil((p.x + 200) / 100) * 100;
            if (p.y + 150 > newHeight) newHeight = Math.ceil((p.y + 200) / 100) * 100;
          }

          onUpdateFloor({
            ...floor,
            width: newWidth,
            height: newHeight,
            rooms: floor.rooms.map((r) =>
              r.id === selectedRoomId ? { ...r, polygon: movedPolygon } : r
            ),
          });
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeTool, drawingState, floor, onUpdateFloor, onSelectRoom, onSelectZone, onSelectTransit, onSelectPOI, isStudioMode, selectedRoomId, isAllSelected, setAllSelected, nudgeAllElements]);

  // Filter current floor route path segments into contiguous segments
  const currentFloorPathSegments = useMemo(() => {
    if (!routeResult || !routeResult.pathNodes) return [];
    const segments: { nodeId: string; floorId: string; position: Point; floorLevel: number }[][] = [];
    let currentSeg: typeof segments[0] = [];

    for (const node of routeResult.pathNodes) {
      if (node.floorId === floor.id) {
        currentSeg.push(node);
      } else {
        if (currentSeg.length > 0) {
          segments.push(currentSeg);
          currentSeg = [];
        }
      }
    }
    if (currentSeg.length > 0) {
      segments.push(currentSeg);
    }
    return segments;
  }, [routeResult, floor.id]);

  const currentFloorPathNodes = useMemo(() => {
    return (routeResult?.pathNodes || []).filter((n) => n.floorId === floor.id);
  }, [routeResult, floor.id]);

  // Floor transition steps (Lifts / Stairs change points on this floor)
  const floorTransitions = useMemo(() => {
    if (!routeResult) return [];
    return routeResult.steps.filter((s) => s.isFloorChange && s.floorId === floor.id);
  }, [routeResult, floor.id]);

  // Compute live walkthrough simulation avatar position along route
  let simulationMarkerPos: Point | null = null;
  if (
    activeSimulationProgress !== null &&
    activeSimulationProgress !== undefined &&
    currentFloorPathNodes.length > 1
  ) {
    const totalSegments = currentFloorPathNodes.length - 1;
    const progressIndex = Math.min(
      totalSegments - 0.001,
      activeSimulationProgress * totalSegments
    );
    const segIdx = Math.floor(progressIndex);
    const segFrac = progressIndex - segIdx;

    const pA = currentFloorPathNodes[segIdx].position;
    const pB = currentFloorPathNodes[segIdx + 1].position;
    simulationMarkerPos = {
      x: pA.x + (pB.x - pA.x) * segFrac,
      y: pA.y + (pB.y - pA.y) * segFrac,
    };
  }

  return (
    <div
      ref={containerRef}
      className={`relative w-full h-full bg-[#F7F7F5] overflow-hidden select-none border border-[#1A3C2B] ${className}`}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onDoubleClick={handleDoubleClick}
      onWheel={handleWheel}
      style={{
        cursor: isPanning
          ? 'grabbing'
          : isStudioMode
          ? activeTool === 'select'
            ? 'default'
            : activeTool === 'eraser'
            ? 'crosshair'
            : 'crosshair'
          : 'default',
      }}
    >
      {/* CAD Header Status Overlay (Bento Top Bar) */}
      <div className="absolute top-3 left-3 z-20 flex items-center gap-2 no-print">
        <div className="bg-[#F7F7F5] border border-[#1A3C2B] px-3 py-1.5 flex items-center gap-3">
          <div className="w-2.5 h-2.5 bg-[#1A3C2B] animate-pulse" />
          <div className="flex flex-col font-mono text-[11px] leading-tight">
            <span className="font-bold tracking-wider text-[#1A3C2B] uppercase">
              {floor.name}
            </span>
            <span className="text-[#1A3C2B]/70 text-[9px]">
              SZINT: {floor.shortCode} • MAGASSÁG: +{floor.elevationMeters.toFixed(1)}M
            </span>
          </div>
        </div>

        {/* Layer Visibility Toggle Dropdown */}
        <div className="relative">
          <button
            onClick={() => setShowLayerMenu(!showLayerMenu)}
            className={`border border-[#1A3C2B] px-2.5 py-1.5 flex items-center gap-1.5 font-mono text-[11px] transition-colors ${
              showLayerMenu ? 'bg-[#1A3C2B] text-[#F7F7F5]' : 'bg-[#F7F7F5] text-[#1A3C2B] hover:bg-[#EFEFEA]'
            }`}
            title="Alaprajzi rétegek ki/bekapcsolása"
          >
            <Layers className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">RÉTEGEK</span>
          </button>

          {showLayerMenu && (
            <div className="absolute left-0 top-full mt-1 bg-[#F7F7F5] border border-[#1A3C2B] p-2 flex flex-col gap-1.5 z-30 min-w-[190px]">
              <span className="font-mono text-[9px] font-bold text-[#1A3C2B] border-b border-[#1A3C2B]/20 pb-1 uppercase">
                ALAPRAJZI RÉTEGEK
              </span>
              {[
                { key: 'zones', label: 'Zónák & Aulák' },
                { key: 'walls', label: 'Fal felületek' },
                { key: 'rooms', label: 'Helyiségek & Termek' },
                { key: 'doors', label: 'Ajtók & Átjárók' },
                { key: 'transits', label: 'Liftek & Lépcsők' },
                { key: 'pois', label: 'Szolgáltatások (POI)' },
                { key: 'navMesh', label: 'Gyalogos hálózat' },
                { key: 'dimensions', label: 'Méretvonalak' },
                { key: 'grid', label: 'Koordináta rács' },
              ].map(({ key, label }) => (
                <label
                  key={key}
                  className="flex items-center justify-between text-[10px] font-mono cursor-pointer hover:bg-[#EFEFEA] px-1 py-0.5"
                >
                  <span>{label}</span>
                  <input
                    type="checkbox"
                    checked={(layerVisibility as any)[key]}
                    onChange={(e) =>
                      setLayerVisibility((prev) => ({ ...prev, [key]: e.target.checked }))
                    }
                    className="accent-[#1A3C2B] cursor-pointer"
                  />
                </label>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Floating Canvas Controls (Zoom, Fit, Reset) */}
      <div className="absolute top-3 right-3 z-20 flex items-center gap-1 bg-[#F7F7F5] border border-[#1A3C2B] p-1 no-print">
        <button
          onClick={() => handleZoom(1.2)}
          className="p-1.5 text-[#1A3C2B] hover:bg-[#1A3C2B] hover:text-[#F7F7F5] transition-colors"
          title="Nagyítás"
        >
          <ZoomIn className="w-4 h-4" />
        </button>
        <button
          onClick={() => handleZoom(0.8)}
          className="p-1.5 text-[#1A3C2B] hover:bg-[#1A3C2B] hover:text-[#F7F7F5] transition-colors"
          title="Kicsinyítés"
        >
          <ZoomOut className="w-4 h-4" />
        </button>
        <div className="h-4 w-[1px] bg-[#1A3C2B]/30 mx-0.5" />
        <button
          onClick={handleFitToScreen}
          className="p-1.5 text-[#1A3C2B] hover:bg-[#1A3C2B] hover:text-[#F7F7F5] transition-colors font-mono text-[10px] flex items-center gap-1"
          title="Alaprajz igazítása a képernyőhöz"
        >
          <Maximize2 className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">ILLESZTÉS</span>
        </button>
      </div>

      {/* Bottom Left: Scale Bar & Coordinates */}
      <div className="absolute bottom-3 left-3 z-20 flex flex-col gap-2 pointer-events-auto no-print">
        <BlueprintScaleBar
          zoom={viewport.zoom}
          cursorPos={cursorFloorPos}
          elevationMeters={floor.elevationMeters}
        />
      </div>

      {/* Bottom Right: True North Compass & Mini-Map */}
      <div className="absolute bottom-3 right-3 z-20 flex items-end gap-2 pointer-events-auto no-print">
        <CompassRose />
        <FloorMiniMap
          floor={floor}
          viewport={viewport}
          containerSize={{
            width: containerRef.current?.clientWidth || 800,
            height: containerRef.current?.clientHeight || 600,
          }}
          onNavigate={(targetX, targetY) => {
            setViewport((prev) => ({ ...prev, x: targetX, y: targetY }));
          }}
        />
      </div>

      {/* SVG Canvas Root */}
      <svg
        ref={svgRef}
        className="w-full h-full absolute inset-0 overflow-visible"
      >
        <defs>
          {/* Subtle Grid Hatch Pattern */}
          <pattern
            id="cad-grid-pattern"
            width="20"
            height="20"
            patternUnits="userSpaceOnUse"
          >
            <path
              d="M 20 0 L 0 0 0 20"
              fill="none"
              stroke="rgba(26, 60, 43, 0.07)"
              strokeWidth="0.8"
            />
          </pattern>
          {/* Major Grid Pattern */}
          <pattern
            id="cad-major-grid-pattern"
            width="100"
            height="100"
            patternUnits="userSpaceOnUse"
          >
            <rect width="100" height="100" fill="url(#cad-grid-pattern)" />
            <path
              d="M 100 0 L 0 0 0 100"
              fill="none"
              stroke="rgba(26, 60, 43, 0.16)"
              strokeWidth="1.2"
            />
          </pattern>
          {/* Diagonal Hatch for Structural Zones */}
          <pattern
            id="cad-diagonal-hatch"
            width="8"
            height="8"
            patternTransform="rotate(45 0 0)"
            patternUnits="userSpaceOnUse"
          >
            <line
              x1="0"
              y1="0"
              x2="0"
              y2="8"
              stroke="rgba(26, 60, 43, 0.12)"
              strokeWidth="1.5"
            />
          </pattern>
          {/* Arrowhead Marker */}
          <marker
            id="route-arrowhead"
            viewBox="0 0 10 10"
            refX="6"
            refY="5"
            markerWidth="6"
            markerHeight="6"
            orient="auto-start-reverse"
          >
            <path d="M 0 1 L 8 5 L 0 9 z" fill="#1A3C2B" />
          </marker>
        </defs>

        {/* Global Scaled & Translated World Space */}
        <g
          transform={`translate(${viewport.x}, ${viewport.y}) scale(${viewport.zoom})`}
        >
          {/* Floor Blueprint Boundary Canvas Box (Auto-Expanding) */}
          <rect
            x={computedBounds.minX}
            y={computedBounds.minY}
            width={computedBounds.width}
            height={computedBounds.height}
            fill="#FFFFFF"
            stroke="#1A3C2B"
            strokeWidth="2"
          />

          {/* Background Technical Grid (Covers all expanded bounds) */}
          {layerVisibility.grid && (
            <rect
              x={computedBounds.minX}
              y={computedBounds.minY}
              width={computedBounds.width}
              height={computedBounds.height}
              fill="url(#cad-major-grid-pattern)"
            />
          )}

          {/* Original Base Floor Boundary Outline (Subtle dashed reference line) */}
          {(computedBounds.minX < 0 ||
            computedBounds.minY < 0 ||
            computedBounds.maxX > floor.width ||
            computedBounds.maxY > floor.height) && (
            <rect
              x="0"
              y="0"
              width={floor.width}
              height={floor.height}
              fill="none"
              stroke="#1A3C2B"
              strokeWidth="1"
              strokeDasharray="6 4"
              strokeOpacity="0.35"
              pointerEvents="none"
            />
          )}

          {/* Background Architectural Underlay Image Tracing */}
          {floor.underlay && floor.underlay.visible && floor.underlay.url && (
            <image
              href={floor.underlay.url}
              x={floor.underlay.offsetX}
              y={floor.underlay.offsetY}
              width={floor.width * floor.underlay.scale}
              height={floor.height * floor.underlay.scale}
              opacity={floor.underlay.opacity}
              preserveAspectRatio="none"
              style={{ pointerEvents: 'none' }}
            />
          )}

          {/* Architectural Outer Coordinate Ticks (Along entire dynamic grid) */}
          {layerVisibility.dimensions && (
            <g className="cad-boundary-dimensions text-[8px] font-mono fill-[#1A3C2B]/60">
              {Array.from({
                length: Math.floor(computedBounds.width / 100) + 1,
              }).map((_, i) => {
                const tickX = computedBounds.minX + i * 100;
                return (
                  <g key={`xtick-${i}`} transform={`translate(${tickX}, ${computedBounds.minY})`}>
                    <line x1="0" y1="-8" x2="0" y2="0" stroke="#1A3C2B" strokeWidth="1" />
                    <text x="0" y="-12" textAnchor="middle">
                      {(tickX / PIXELS_PER_METER).toFixed(0)}m
                    </text>
                  </g>
                );
              })}
              {Array.from({
                length: Math.floor(computedBounds.height / 100) + 1,
              }).map((_, i) => {
                const tickY = computedBounds.minY + i * 100;
                return (
                  <g key={`ytick-${i}`} transform={`translate(${computedBounds.minX}, ${tickY})`}>
                    <line x1="-8" y1="0" x2="0" y2="0" stroke="#1A3C2B" strokeWidth="1" />
                    <text x="-12" y="3" textAnchor="end">
                      {(tickY / PIXELS_PER_METER).toFixed(0)}m
                    </text>
                  </g>
                );
              })}
            </g>
          )}

          {/* 0. ZONES & AULAS LAYER (Atriums, Lobbies, Lounges, Courtyards) */}
          {layerVisibility.zones &&
            (floor.zones || []).map((zone) => {
              const isSelected = selectedZoneId === zone.id;
              const isAllDragging = isAllSelected && activeAllOffset && (activeAllOffset.dx !== 0 || activeAllOffset.dy !== 0);
              const isDragging = activeDragZonePolygon && activeDragZonePolygon.zoneId === zone.id;
              const currentPolygon = isAllDragging
                ? zone.polygon.map((p) => ({ x: p.x + activeAllOffset.dx, y: p.y + activeAllOffset.dy }))
                : isDragging
                ? activeDragZonePolygon.polygon
                : zone.polygon;
              const centroid = polygonCentroid(currentPolygon);
              const area = polygonAreaInSquareMeters(currentPolygon);
              const pointsStr = currentPolygon.map((p) => `${p.x},${p.y}`).join(' ');
              const palette = ZONE_TYPE_COLORS[zone.type] || ZONE_TYPE_COLORS.custom;
              const isDraggable = isStudioMode && activeTool === 'select';

              return (
                <g
                  key={zone.id}
                  className={`cursor-pointer ${activeTool === 'eraser' ? 'hover:opacity-50' : ''}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (activeTool === 'eraser') {
                      if (onUpdateFloor) {
                        if (window.confirm(`Biztosan törölni szeretné a(z) ${zone.name} (${zone.code || 'Zóna'}) zónát?`)) {
                          onUpdateFloor({
                            ...floor,
                            zones: (floor.zones || []).filter((z) => z.id !== zone.id),
                          });
                        }
                      }
                      return;
                    }
                    if (onSelectZone) onSelectZone(zone);
                  }}
                  onContextMenu={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setWayfinderActionMenu({
                      screenX: e.clientX,
                      screenY: e.clientY,
                      entityId: zone.id,
                      entityName: `${zone.name} (${zone.code || 'Zóna'})`,
                      entityType: 'zone',
                    });
                  }}
                >
                  {/* Zone Polygon Fill & Border */}
                  <polygon
                    points={pointsStr}
                    fill={zone.color || palette.fill}
                    stroke={isSelected || isAllSelected ? '#1A3C2B' : palette.stroke}
                    strokeWidth={isSelected || isAllSelected ? 2.5 : 1.5}
                    strokeDasharray={isSelected ? undefined : '5 4'}
                    className={isDraggable ? 'cursor-move' : ''}
                    onPointerDown={(e) => {
                      if (e.button === 0 && isDraggable) {
                        e.stopPropagation();
                        const floorPt = screenToFloorCoords(e.clientX, e.clientY);
                        if (isAllSelected) {
                          startAllElementsDrag(floorPt);
                          return;
                        }
                        if (onSelectZone) onSelectZone(zone);
                        startZoneDrag(zone.id, floorPt, currentPolygon);
                      }
                    }}
                  />

                  {/* Corner Accent Ticks on Vertices */}
                  {currentPolygon.map((p, idx) => (
                    <circle
                      key={`zc-${idx}`}
                      cx={p.x}
                      cy={p.y}
                      r={3}
                      fill={palette.stroke}
                      opacity={0.7}
                      className="pointer-events-none"
                    />
                  ))}

                  {/* Zone Center Label Badge */}
                  <g
                    transform={`translate(${centroid.x}, ${centroid.y})`}
                    className="pointer-events-none select-none"
                  >
                    <rect
                      x={-Math.max(45, (zone.name.length * 4.2))}
                      y={-13}
                      width={Math.max(90, (zone.name.length * 8.4))}
                      height={26}
                      rx={2}
                      fill="#FFFFFF"
                      stroke={palette.stroke}
                      strokeWidth={1.2}
                      className="shadow-xs"
                      opacity={0.95}
                    />
                    <text
                      x="0"
                      y="-1.5"
                      textAnchor="middle"
                      fill={palette.text}
                      className="font-mono text-[9px] font-bold uppercase tracking-wider"
                    >
                      {zone.name}
                    </text>
                    <text
                      x="0"
                      y="8.5"
                      textAnchor="middle"
                      fill="#64748B"
                      className="font-mono text-[7.5px]"
                    >
                      {zone.code ? `${zone.code} • ` : ''}{area.toFixed(1)} m² • {ZONE_TYPE_NAMES_HU[zone.type] || zone.type}
                    </text>
                  </g>

                  {/* Active Selected Vertex Handles & Split [+] Handles */}
                  {isSelected && isStudioMode && (
                    <g>
                      {currentPolygon.map((vertex, vIdx) => (
                        <g key={`z-vert-${vIdx}`} transform={`translate(${vertex.x}, ${vertex.y})`}>
                          <circle
                            r={12 / viewport.zoom}
                            fill="transparent"
                            className="cursor-crosshair"
                            onPointerDown={(e) => {
                              if (e.button === 0) {
                                e.stopPropagation();
                                startZoneVertexDrag(zone.id, vIdx, currentPolygon);
                              }
                            }}
                            onContextMenu={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              if (currentPolygon.length > 3 && onUpdateFloor) {
                                const newPolygon = removeVertexFromPolygon(currentPolygon, vIdx);
                                onUpdateFloor({
                                  ...floor,
                                  zones: (floor.zones || []).map((z) =>
                                    z.id === zone.id ? { ...z, polygon: newPolygon } : z
                                  ),
                                });
                              }
                            }}
                          />
                          <circle
                            r={4.5 / viewport.zoom}
                            fill="#FFFFFF"
                            stroke={palette.stroke}
                            strokeWidth={1.8 / viewport.zoom}
                            className="pointer-events-none shadow-xs"
                          />
                        </g>
                      ))}

                      {/* Edge Midpoint [+] Handles */}
                      {getPolygonEdges(currentPolygon).map((edge) => (
                        <g
                          key={`z-edge-split-${edge.index}`}
                          transform={`translate(${edge.midPoint.x}, ${edge.midPoint.y})`}
                          className="cursor-pointer"
                          onPointerDown={(e) => {
                            if (e.button === 0) {
                              e.stopPropagation();
                              const newPoly = insertVertexInPolygon(currentPolygon, edge.index, edge.midPoint);
                              startZoneVertexDrag(zone.id, edge.index + 1, newPoly);
                            }
                          }}
                        >
                          <circle
                            cy="-10"
                            r={5 / viewport.zoom}
                            fill={palette.stroke}
                            stroke="#FFFFFF"
                            strokeWidth={1.2 / viewport.zoom}
                          />
                          <text
                            x="0"
                            y="-7.5"
                            textAnchor="middle"
                            fill="#FFFFFF"
                            className="font-mono text-[8px] font-black select-none pointer-events-none"
                          >
                            +
                          </text>
                        </g>
                      ))}
                    </g>
                  )}
                </g>
              );
            })}

          {/* 1. ROOMS LAYER */}
          {layerVisibility.rooms &&
            floor.rooms.map((room) => {
              const isSelected = selectedRoomId === room.id;
              const isStart = startRoomId === room.id;
              const isTarget = targetRoomId === room.id;
              const stopIndex = intermediateStopIds.indexOf(room.id);
              const isStop = stopIndex !== -1;
              const isAllDragging = isAllSelected && activeAllOffset && (activeAllOffset.dx !== 0 || activeAllOffset.dy !== 0);
              const isDragging = activeDragPolygon && activeDragPolygon.roomId === room.id;
              const currentPolygon = isAllDragging
                ? room.polygon.map((p) => ({ x: p.x + activeAllOffset.dx, y: p.y + activeAllOffset.dy }))
                : isDragging
                ? activeDragPolygon.polygon
                : room.polygon;
              const centroid = polygonCentroid(currentPolygon);
              const area = polygonAreaInSquareMeters(currentPolygon);
              const pointsStr = currentPolygon.map((p) => `${p.x},${p.y}`).join(' ');

              // Fill styling based on room state
              let fillColor = room.colorHatch || 'rgba(26, 60, 43, 0.05)';
              let strokeColor = '#1A3C2B';
              let strokeWidth = isSelected || isAllSelected ? 3 : 1.5;

              if (isStart) {
                fillColor = 'rgba(4, 120, 87, 0.22)';
                strokeColor = '#047857';
                strokeWidth = 3;
              } else if (isTarget) {
                fillColor = 'rgba(185, 28, 28, 0.22)';
                strokeColor = '#B91C1C';
                strokeWidth = 3;
              } else if (isStop) {
                fillColor = 'rgba(180, 83, 9, 0.22)';
                strokeColor = '#B45309';
                strokeWidth = 3;
              } else if (isSelected || isAllSelected) {
                fillColor = 'rgba(26, 60, 43, 0.18)';
              }

              return (
                <g
                  key={room.id}
                  className={`cursor-pointer group ${
                    activeTool === 'eraser' ? 'hover:opacity-60' : ''
                  }`}
                  onContextMenu={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setWayfinderActionMenu({
                      screenX: e.clientX,
                      screenY: e.clientY,
                      entityId: room.id,
                      entityName: `${room.name} (${room.code})`,
                      entityType: 'room',
                    });
                  }}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (activeTool === 'eraser') {
                      if (onUpdateFloor) {
                        if (window.confirm(`Biztosan törölni szeretné a(z) ${room.name} (${room.code}) helyiséget?`)) {
                          onUpdateFloor({
                            ...floor,
                            rooms: floor.rooms.filter((r) => r.id !== room.id),
                          });
                        }
                      }
                      return;
                    }
                    if (onSelectRoom) onSelectRoom(room);
                    if (!isStudioMode) {
                      setWayfinderActionMenu({
                        screenX: e.clientX,
                        screenY: e.clientY,
                        entityId: room.id,
                        entityName: `${room.name} (${room.code})`,
                        entityType: 'room',
                      });
                    }
                  }}
                >
                  {/* Room Polygon with Flat CAD Line & Direct Drag Support */}
                  <polygon
                    points={pointsStr}
                    fill={fillColor}
                    stroke={strokeColor}
                    strokeWidth={strokeWidth}
                    strokeDasharray={isSelected ? '6 3' : undefined}
                    className={
                      isStudioMode && activeTool === 'select' && (isSelected || isAllSelected)
                        ? 'cursor-move'
                        : undefined
                    }
                    onPointerDown={(e) => {
                      if (e.button === 0 && isStudioMode && activeTool === 'select') {
                        if (isAllSelected) {
                          e.stopPropagation();
                          const floorPt = screenToFloorCoords(e.clientX, e.clientY);
                          startAllElementsDrag(floorPt);
                          return;
                        }
                        if (isSelected) {
                          e.stopPropagation();
                          const floorPt = screenToFloorCoords(e.clientX, e.clientY);
                          startRoomDrag(room.id, floorPt, currentPolygon);
                        }
                      }
                    }}
                  />

                  {/* Calculate Room Geometric Scale Metrics for Adaptive UI */}
                  {(() => {
                    const rMinX = Math.min(...currentPolygon.map((p) => p.x));
                    const rMaxX = Math.max(...currentPolygon.map((p) => p.x));
                    const rMinY = Math.min(...currentPolygon.map((p) => p.y));
                    const rMaxY = Math.max(...currentPolygon.map((p) => p.y));
                    const roomWidthPx = rMaxX - rMinX;
                    const roomHeightPx = rMaxY - rMinY;
                    const minDimMeters = Math.min(roomWidthPx, roomHeightPx) / PIXELS_PER_METER;
                    const isTinyRoom = minDimMeters < 3.4 || area < 10;
                    const isSmallRoom = minDimMeters < 5.2 || area < 22;

                    return (
                      <>
                        {/* Room Diagonal Hatch if restricted or lab */}
                        {room.isRestricted && (
                          <polygon
                            points={pointsStr}
                            fill="url(#cad-diagonal-hatch)"
                            pointerEvents="none"
                          />
                        )}

                        {/* Room Labels - Dynamically Adaptive to Room Size */}
                        <g
                          transform={`translate(${centroid.x}, ${centroid.y})`}
                          className="pointer-events-none select-none"
                        >
                          {isTinyRoom ? (
                            /* 1. Tiny Room (e.g. 3m x 3m or smaller): Ultra-compact single badge */
                            <g>
                              <rect
                                x="-16"
                                y="-7"
                                width="32"
                                height="14"
                                fill="#1A3C2B"
                                rx="2"
                                className="transition-colors shadow-xs"
                              />
                              <text
                                x="0"
                                y="3"
                                textAnchor="middle"
                                fill="#F7F7F5"
                                className="font-mono text-[8px] font-bold"
                              >
                                {room.code || room.name.slice(0, 5)}
                              </text>
                            </g>
                          ) : isSmallRoom ? (
                            /* 2. Small Room (e.g. 3m - 5m): Compact 2-line label */
                            <g>
                              <rect
                                x="-20"
                                y="-13"
                                width="40"
                                height="12"
                                fill="#1A3C2B"
                                rx="2"
                                className="transition-colors shadow-xs"
                              />
                              <text
                                x="0"
                                y="-4"
                                textAnchor="middle"
                                fill="#F7F7F5"
                                className="font-mono text-[7.5px] font-bold tracking-wider"
                              >
                                {room.code}
                              </text>
                              <text
                                x="0"
                                y="7"
                                textAnchor="middle"
                                fill="#1A3C2B"
                                className="font-sans text-[8.5px] font-bold"
                              >
                                {room.name.length > 14 ? `${room.name.slice(0, 12)}…` : room.name}
                              </text>
                            </g>
                          ) : (
                            /* 3. Normal / Large Room: Standard editorial 3-line layout */
                            <g>
                              <rect
                                x="-28"
                                y="-22"
                                width="56"
                                height="15"
                                fill="#1A3C2B"
                                rx="2"
                                className="transition-colors shadow-xs"
                              />
                              <text
                                x="0"
                                y="-11"
                                textAnchor="middle"
                                fill="#F7F7F5"
                                className="font-mono text-[9px] font-bold tracking-wider"
                              >
                                {room.code}
                              </text>
                              <text
                                x="0"
                                y="5"
                                textAnchor="middle"
                                fill="#1A3C2B"
                                className="font-sans text-[11px] font-bold"
                              >
                                {room.name.length > 26 ? `${room.name.slice(0, 24)}…` : room.name}
                              </text>
                              <text
                                x="0"
                                y="18"
                                textAnchor="middle"
                                fill="#1A3C2B"
                                fillOpacity="0.75"
                                className="font-mono text-[8px]"
                              >
                                {area.toFixed(0)}m² • {room.capacity ? `${room.capacity} FŐ` : '—'}
                              </text>
                            </g>
                          )}
                        </g>

                        {/* Start / Stop / Destination CAD Pin Markers */}
                        {isStart && (
                          <g transform={`translate(${centroid.x}, ${isSmallRoom ? rMinY - 14 : centroid.y - 32})`}>
                            <rect
                              x="-38"
                              y="-14"
                              width="76"
                              height="14"
                              fill="#047857"
                              stroke="#F7F7F5"
                              strokeWidth="1"
                              rx="2"
                            />
                            <text
                              x="0"
                              y="-3"
                              textAnchor="middle"
                              fill="#F7F7F5"
                              className="font-mono text-[8px] font-bold"
                            >
                              ● INDULÁS
                            </text>
                            <line x1="0" y1="0" x2="0" y2="10" stroke="#047857" strokeWidth="2" />
                          </g>
                        )}

                        {isStop && !isStart && !isTarget && (
                          <g transform={`translate(${centroid.x}, ${isSmallRoom ? rMinY - 14 : centroid.y - 32})`}>
                            <rect
                              x="-40"
                              y="-14"
                              width="80"
                              height="14"
                              fill="#B45309"
                              stroke="#F7F7F5"
                              strokeWidth="1"
                              rx="2"
                            />
                            <text
                              x="0"
                              y="-3"
                              textAnchor="middle"
                              fill="#F7F7F5"
                              className="font-mono text-[8px] font-bold"
                            >
                              {`🟠 ${stopIndex + 1}. MEGÁLLÓ`}
                            </text>
                            <line x1="0" y1="0" x2="0" y2="10" stroke="#B45309" strokeWidth="2" />
                          </g>
                        )}

                        {isTarget && (
                          <g transform={`translate(${centroid.x}, ${isSmallRoom ? rMinY - 14 : centroid.y - 32})`}>
                            <rect
                              x="-32"
                              y="-14"
                              width="64"
                              height="14"
                              fill="#B91C1C"
                              stroke="#F7F7F5"
                              strokeWidth="1"
                              rx="2"
                            />
                            <text
                              x="0"
                              y="-3"
                              textAnchor="middle"
                              fill="#F7F7F5"
                              className="font-mono text-[8px] font-bold"
                            >
                              ★ CÉL
                            </text>
                            <line x1="0" y1="0" x2="0" y2="10" stroke="#B91C1C" strokeWidth="2" />
                          </g>
                        )}

                        {/* Draggable Corner Vertex Handles & Midpoint Split Handles on Selected Room */}
                        {isStudioMode && activeTool === 'select' && selectedRoomId === room.id && (
                          <g className="room-edge-vertex-editor">
                            {/* 1. Wall Segment Dimensions & [+] Midpoint Split Handles */}
                            {getPolygonEdges(currentPolygon).map((edge) => {
                              const isShortEdge = edge.lengthMeters < 2.0;

                              return (
                                <g key={`edge-${edge.index}`}>
                                  {/* Sleek Dimension Label Tag */}
                                  <g transform={`translate(${edge.midPoint.x}, ${edge.midPoint.y})`}>
                                    <rect
                                      x={isShortEdge ? "-15" : "-18"}
                                      y="-6.5"
                                      width={isShortEdge ? "30" : "36"}
                                      height="13"
                                      fill="#FFFFFF"
                                      stroke="#1A3C2B"
                                      strokeWidth={1 / viewport.zoom}
                                      rx="1.5"
                                      className="pointer-events-none shadow-xs"
                                    />
                                    <text
                                      x="0"
                                      y="2.5"
                                      textAnchor="middle"
                                      fill="#1A3C2B"
                                      className="font-mono text-[7.5px] font-bold select-none pointer-events-none"
                                    >
                                      {edge.lengthMeters.toFixed(1)}m
                                    </text>
                                  </g>

                                  {/* [+] Midpoint Wall Split Handle (Only on sufficiently long edges to prevent clutter) */}
                                  {!isShortEdge && (
                                    <g
                                      transform={`translate(${edge.midPoint.x}, ${edge.midPoint.y})`}
                                      className="cursor-pointer"
                                      onPointerDown={(e) => {
                                        if (e.button === 0) {
                                          e.stopPropagation();
                                          const newPolygon = insertVertexInPolygon(
                                            currentPolygon,
                                            edge.index,
                                            edge.midPoint
                                          );
                                          startVertexDrag(room.id, edge.index + 1, newPolygon);
                                        }
                                      }}
                                    >
                                      <circle
                                        cy="-12"
                                        r={5 / viewport.zoom}
                                        fill="#1A3C2B"
                                        stroke="#FFFFFF"
                                        strokeWidth={1.2 / viewport.zoom}
                                      />
                                      <text
                                        x="0"
                                        y="-9.5"
                                        textAnchor="middle"
                                        fill="#FFFFFF"
                                        className="font-mono text-[8px] font-black select-none pointer-events-none"
                                      >
                                        +
                                      </text>
                                    </g>
                                  )}
                                </g>
                              );
                            })}

                            {/* 2. Draggable Corner Vertices (Right-click to delete vertex) */}
                            {currentPolygon.map((vertex, vIdx) => (
                              <g key={`v-${vIdx}`} transform={`translate(${vertex.x}, ${vertex.y})`}>
                                {/* Invisible hit target for effortless pointer grab */}
                                <circle
                                  r={12 / viewport.zoom}
                                  fill="transparent"
                                  className="cursor-crosshair"
                                  onPointerDown={(e) => {
                                    if (e.button === 0) {
                                      e.stopPropagation();
                                      startVertexDrag(room.id, vIdx, currentPolygon);
                                    }
                                  }}
                                  onContextMenu={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    if (currentPolygon.length > 3) {
                                      const newPolygon = removeVertexFromPolygon(currentPolygon, vIdx);
                                      if (onUpdateFloor) {
                                        onUpdateFloor({
                                          ...floor,
                                          rooms: floor.rooms.map((r) =>
                                            r.id === room.id ? { ...r, polygon: newPolygon } : r
                                          ),
                                        });
                                      }
                                    }
                                  }}
                                />
                                {/* Visible CAD Corner Vertex Point */}
                                <circle
                                  r={4.5 / viewport.zoom}
                                  fill="#FFFFFF"
                                  stroke="#1A3C2B"
                                  strokeWidth={1.8 / viewport.zoom}
                                  className="pointer-events-none shadow-xs"
                                />
                              </g>
                            ))}
                          </g>
                        )}
                      </>
                    );
                  })()}
                </g>
              );
            })}

          {/* 2. WALLS LAYER */}
          {layerVisibility.walls &&
            floor.walls.map((wall) => {
              const isAllDragging = isAllSelected && activeAllOffset && (activeAllOffset.dx !== 0 || activeAllOffset.dy !== 0);
              const currentStart = isAllDragging
                ? { x: wall.start.x + activeAllOffset.dx, y: wall.start.y + activeAllOffset.dy }
                : activeDragWall && activeDragWall.wallId === wall.id
                ? activeDragWall.start
                : wall.start;
              const currentEnd = isAllDragging
                ? { x: wall.end.x + activeAllOffset.dx, y: wall.end.y + activeAllOffset.dy }
                : activeDragWall && activeDragWall.wallId === wall.id
                ? activeDragWall.end
                : wall.end;
              const isDraggable = isStudioMode && activeTool === 'select';

              return (
                <g key={wall.id}>
                  {/* Thick Invisible Wall Hit Area for Easy Grabbing */}
                  {isDraggable && (
                    <line
                      x1={currentStart.x}
                      y1={currentStart.y}
                      x2={currentEnd.x}
                      y2={currentEnd.y}
                      stroke="transparent"
                      strokeWidth={Math.max(20, wall.thickness * 3)}
                      strokeLinecap="round"
                      className="cursor-move"
                      onPointerDown={(e) => {
                        if (e.button === 0) {
                          e.stopPropagation();
                          const floorPt = screenToFloorCoords(e.clientX, e.clientY);
                          if (isAllSelected) {
                            startAllElementsDrag(floorPt);
                            return;
                          }
                          startWallDrag(wall.id, 'body', floorPt, currentStart, currentEnd);
                        }
                      }}
                    />
                  )}

                  {/* Visible Wall Line */}
                  <line
                    x1={currentStart.x}
                    y1={currentStart.y}
                    x2={currentEnd.x}
                    y2={currentEnd.y}
                    stroke="#1A3C2B"
                    strokeWidth={wall.thickness * (wall.isExterior ? 2.2 : 1.5)}
                    strokeLinecap="square"
                    className={
                      activeTool === 'eraser'
                        ? 'cursor-pointer hover:stroke-red-600'
                        : isDraggable
                        ? 'cursor-move hover:stroke-[#047857]'
                        : ''
                    }
                    onPointerDown={(e) => {
                      if (e.button === 0 && isDraggable) {
                        e.stopPropagation();
                        const floorPt = screenToFloorCoords(e.clientX, e.clientY);
                        if (isAllSelected) {
                          startAllElementsDrag(floorPt);
                          return;
                        }
                        startWallDrag(wall.id, 'body', floorPt, currentStart, currentEnd);
                      }
                    }}
                    onClick={(e) => {
                      if (activeTool === 'eraser' && onUpdateFloor) {
                        e.stopPropagation();
                        onUpdateFloor({
                          ...floor,
                          walls: floor.walls.filter((w) => w.id !== wall.id),
                        });
                      }
                    }}
                  />

                  {/* Real-Time Wall Length Dimension Badge During Dragging */}
                  {activeDragWall && activeDragWall.wallId === wall.id && (
                    <g
                      transform={`translate(${
                        (currentStart.x + currentEnd.x) / 2
                      }, ${(currentStart.y + currentEnd.y) / 2 - 14})`}
                      className="pointer-events-none select-none"
                    >
                      <rect
                        x="-22"
                        y="-8"
                        width="44"
                        height="16"
                        fill="#1A3C2B"
                        rx="2"
                        className="shadow-sm"
                      />
                      <text
                        x="0"
                        y="3.5"
                        textAnchor="middle"
                        fill="#FFFFFF"
                        className="font-mono text-[9px] font-bold"
                      >
                        {(distance(currentStart, currentEnd) / PIXELS_PER_METER).toFixed(2)}m
                      </text>
                    </g>
                  )}

                  {/* Draggable Wall Endpoint Handles in Studio Select Mode (Zero-latency, no CSS animation drift) */}
                  {isDraggable && (
                    <g>
                      {/* Start Endpoint Handle */}
                      <g transform={`translate(${currentStart.x}, ${currentStart.y})`}>
                        <circle
                          r={14 / viewport.zoom}
                          fill="transparent"
                          className="cursor-crosshair"
                          onPointerDown={(e) => {
                            if (e.button === 0) {
                              e.stopPropagation();
                              const floorPt = screenToFloorCoords(e.clientX, e.clientY);
                              startWallDrag(wall.id, 'start', floorPt, currentStart, currentEnd);
                            }
                          }}
                        />
                        <circle
                          r={5.5 / viewport.zoom}
                          fill="#FFFFFF"
                          stroke="#1A3C2B"
                          strokeWidth={2 / viewport.zoom}
                          className="pointer-events-none shadow-xs"
                        />
                      </g>

                      {/* End Endpoint Handle */}
                      <g transform={`translate(${currentEnd.x}, ${currentEnd.y})`}>
                        <circle
                          r={14 / viewport.zoom}
                          fill="transparent"
                          className="cursor-crosshair"
                          onPointerDown={(e) => {
                            if (e.button === 0) {
                              e.stopPropagation();
                              const floorPt = screenToFloorCoords(e.clientX, e.clientY);
                              startWallDrag(wall.id, 'end', floorPt, currentStart, currentEnd);
                            }
                          }}
                        />
                        <circle
                          r={5.5 / viewport.zoom}
                          fill="#FFFFFF"
                          stroke="#1A3C2B"
                          strokeWidth={2 / viewport.zoom}
                          className="pointer-events-none shadow-xs"
                        />
                      </g>
                    </g>
                  )}
                </g>
              );
            })}

          {/* 3. DOORS LAYER */}
          {layerVisibility.doors &&
            floor.doors.map((door) => {
              const isAllDragging = isAllSelected && activeAllOffset && (activeAllOffset.dx !== 0 || activeAllOffset.dy !== 0);
              const currentStart = isAllDragging
                ? { x: door.start.x + activeAllOffset.dx, y: door.start.y + activeAllOffset.dy }
                : activeDragDoor && activeDragDoor.doorId === door.id
                ? activeDragDoor.start
                : door.start;
              const currentEnd = isAllDragging
                ? { x: door.end.x + activeAllOffset.dx, y: door.end.y + activeAllOffset.dy }
                : activeDragDoor && activeDragDoor.doorId === door.id
                ? activeDragDoor.end
                : door.end;
              const isDraggable = isStudioMode && activeTool === 'select';
              const isDragging = activeDragDoor && activeDragDoor.doorId === door.id;

              const dx = currentEnd.x - currentStart.x;
              const dy = currentEnd.y - currentStart.y;
              const doorWidth = Math.sqrt(dx * dx + dy * dy) || 36;
              const unitTan = { x: dx / doorWidth, y: dy / doorWidth };
              const unitNorm = { x: -unitTan.y, y: unitTan.x };

              // Door leaf endpoints & arcs
              const leafEnd = {
                x: currentStart.x + unitNorm.x * doorWidth,
                y: currentStart.y + unitNorm.y * doorWidth,
              };

              const midPoint = {
                x: (currentStart.x + currentEnd.x) / 2,
                y: (currentStart.y + currentEnd.y) / 2,
              };
              const halfWidth = doorWidth / 2;
              const leaf1End = {
                x: currentStart.x + unitNorm.x * halfWidth,
                y: currentStart.y + unitNorm.y * halfWidth,
              };
              const leaf2End = {
                x: currentEnd.x + unitNorm.x * halfWidth,
                y: currentEnd.y + unitNorm.y * halfWidth,
              };

              return (
                <g
                  key={door.id}
                  className={
                    activeTool === 'eraser'
                      ? 'cursor-pointer hover:opacity-50'
                      : isDraggable
                      ? 'cursor-move'
                      : 'pointer-events-none'
                  }
                  onPointerDown={(e) => {
                    if (e.button === 0 && isDraggable) {
                      e.stopPropagation();
                      const floorPt = screenToFloorCoords(e.clientX, e.clientY);
                      if (isAllSelected) {
                        startAllElementsDrag(floorPt);
                        return;
                      }
                      startDoorDrag(door.id, floorPt, currentStart, currentEnd);
                    }
                  }}
                  onClick={(e) => {
                    if (activeTool === 'eraser' && onUpdateFloor) {
                      e.stopPropagation();
                      onUpdateFloor({
                        ...floor,
                        doors: floor.doors.filter((d) => d.id !== door.id),
                      });
                    }
                  }}
                >
                  {/* Large hit area for effortless pointer grabbing */}
                  <line
                    x1={currentStart.x}
                    y1={currentStart.y}
                    x2={currentEnd.x}
                    y2={currentEnd.y}
                    stroke="transparent"
                    strokeWidth={20}
                  />

                  {/* 1. Wall Cutout Opening Line (Hides underlying wall line with clean gap) */}
                  <line
                    x1={currentStart.x}
                    y1={currentStart.y}
                    x2={currentEnd.x}
                    y2={currentEnd.y}
                    stroke="#FFFFFF"
                    strokeWidth="6"
                    strokeLinecap="square"
                  />

                  {/* 2. Threshold Dotted Line (Architectural floor transition) */}
                  <line
                    x1={currentStart.x}
                    y1={currentStart.y}
                    x2={currentEnd.x}
                    y2={currentEnd.y}
                    stroke="#94A3B8"
                    strokeWidth="1"
                    strokeDasharray="2 2"
                  />

                  {/* 3. Door Jamb Frame End Ticks */}
                  <line
                    x1={currentStart.x - unitNorm.x * 2.5}
                    y1={currentStart.y - unitNorm.y * 2.5}
                    x2={currentStart.x + unitNorm.x * 2.5}
                    y2={currentStart.y + unitNorm.y * 2.5}
                    stroke={isDragging ? "#047857" : "#1A3C2B"}
                    strokeWidth="1.8"
                  />
                  <line
                    x1={currentEnd.x - unitNorm.x * 2.5}
                    y1={currentEnd.y - unitNorm.y * 2.5}
                    x2={currentEnd.x + unitNorm.x * 2.5}
                    y2={currentEnd.y + unitNorm.y * 2.5}
                    stroke={isDragging ? "#047857" : "#1A3C2B"}
                    strokeWidth="1.8"
                  />

                  {/* 4. Door Swing Arc and Panel Leaf */}
                  {door.type === 'double' ? (
                    <>
                      {/* Double Door Left Sector */}
                      <path
                        d={`M ${currentStart.x} ${currentStart.y} L ${midPoint.x} ${midPoint.y} A ${halfWidth} ${halfWidth} 0 0 0 ${leaf1End.x} ${leaf1End.y} Z`}
                        fill={isDragging ? "rgba(4, 120, 87, 0.1)" : "rgba(4, 120, 87, 0.05)"}
                        stroke={isDragging ? "#047857" : "#059669"}
                        strokeWidth="0.9"
                        strokeDasharray="2 1.5"
                      />
                      {/* Double Door Right Sector */}
                      <path
                        d={`M ${currentEnd.x} ${currentEnd.y} L ${midPoint.x} ${midPoint.y} A ${halfWidth} ${halfWidth} 0 0 1 ${leaf2End.x} ${leaf2End.y} Z`}
                        fill={isDragging ? "rgba(4, 120, 87, 0.1)" : "rgba(4, 120, 87, 0.05)"}
                        stroke={isDragging ? "#047857" : "#059669"}
                        strokeWidth="0.9"
                        strokeDasharray="2 1.5"
                      />
                      {/* Double Door Leaves */}
                      <line
                        x1={currentStart.x}
                        y1={currentStart.y}
                        x2={leaf1End.x}
                        y2={leaf1End.y}
                        stroke={isDragging ? "#047857" : "#1A3C2B"}
                        strokeWidth="2"
                        strokeLinecap="round"
                      />
                      <line
                        x1={currentEnd.x}
                        y1={currentEnd.y}
                        x2={leaf2End.x}
                        y2={leaf2End.y}
                        stroke={isDragging ? "#047857" : "#1A3C2B"}
                        strokeWidth="2"
                        strokeLinecap="round"
                      />
                    </>
                  ) : (
                    <>
                      {/* Single Door 90° Swing Sector */}
                      <path
                        d={`M ${currentStart.x} ${currentStart.y} L ${currentEnd.x} ${currentEnd.y} A ${doorWidth} ${doorWidth} 0 0 0 ${leafEnd.x} ${leafEnd.y} Z`}
                        fill={isDragging ? "rgba(4, 120, 87, 0.1)" : "rgba(4, 120, 87, 0.05)"}
                        stroke={isDragging ? "#047857" : "#059669"}
                        strokeWidth="0.9"
                        strokeDasharray="2 1.5"
                      />
                      {/* Solid Door Leaf Panel */}
                      <line
                        x1={currentStart.x}
                        y1={currentStart.y}
                        x2={leafEnd.x}
                        y2={leafEnd.y}
                        stroke={isDragging ? "#047857" : "#1A3C2B"}
                        strokeWidth="2"
                        strokeLinecap="round"
                      />
                    </>
                  )}

                  {/* Active Dragging Dimension Indicator */}
                  {isDragging && (
                    <g transform={`translate(${midPoint.x}, ${midPoint.y - 12})`}>
                      <rect
                        x="-20"
                        y="-8"
                        width="40"
                        height="16"
                        fill="#047857"
                        rx="2"
                        className="shadow-sm"
                      />
                      <text
                        x="0"
                        y="3.5"
                        textAnchor="middle"
                        fill="#FFFFFF"
                        className="font-mono text-[9px] font-bold select-none pointer-events-none"
                      >
                        {(doorWidth / PIXELS_PER_METER).toFixed(2)}m
                      </text>
                    </g>
                  )}
                </g>
              );
            })}

          {/* 4. TRANSIT CONNECTORS LAYER (Stairs, Elevators) */}
          {layerVisibility.transits &&
            floor.transitConnectors.map((transit) => {
              const isSelected = selectedTransitId === transit.id;
              const isElevator = transit.type === 'elevator';
              const isStart = startRoomId === transit.id;
              const isTarget = targetRoomId === transit.id;
              const stopIndex = intermediateStopIds.indexOf(transit.id);
              const isStop = stopIndex !== -1;
              const isAllDragging = isAllSelected && activeAllOffset && (activeAllOffset.dx !== 0 || activeAllOffset.dy !== 0);
              const currentPos = isAllDragging
                ? { x: transit.position.x + activeAllOffset.dx, y: transit.position.y + activeAllOffset.dy }
                : activeDragTransit && activeDragTransit.transitId === transit.id
                ? activeDragTransit.position
                : transit.position;
              const isDraggable = isStudioMode && activeTool === 'select';

              return (
                <g
                  key={transit.id}
                  transform={`translate(${currentPos.x - transit.width / 2}, ${
                    currentPos.y - transit.height / 2
                  })`}
                  className={`${activeTool === 'eraser' ? 'cursor-pointer hover:opacity-50' : isDraggable ? 'cursor-move' : 'cursor-pointer'}`}
                  onPointerDown={(e) => {
                    if (e.button === 0 && isDraggable) {
                      e.stopPropagation();
                      const floorPt = screenToFloorCoords(e.clientX, e.clientY);
                      if (isAllSelected) {
                        startAllElementsDrag(floorPt);
                        return;
                      }
                      startTransitDrag(transit.id, floorPt, currentPos);
                    }
                  }}
                  onContextMenu={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setWayfinderActionMenu({
                      screenX: e.clientX,
                      screenY: e.clientY,
                      entityId: transit.id,
                      entityName: transit.name,
                      entityType: 'transit',
                    });
                  }}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (activeTool === 'eraser') {
                      if (onUpdateFloor) {
                        onUpdateFloor({
                          ...floor,
                          transitConnectors: floor.transitConnectors.filter((t) => t.id !== transit.id),
                        });
                      }
                      return;
                    }
                    if (onSelectTransit) onSelectTransit(transit);
                    if (!isStudioMode) {
                      setWayfinderActionMenu({
                        screenX: e.clientX,
                        screenY: e.clientY,
                        entityId: transit.id,
                        entityName: transit.name,
                        entityType: 'transit',
                      });
                    }
                  }}
                >
                  {/* Shaft Bounding Box */}
                  <rect
                    x="0"
                    y="0"
                    width={transit.width}
                    height={transit.height}
                    fill={isElevator ? '#1A3C2B' : '#FFFFFF'}
                    stroke={isStart ? '#047857' : isTarget ? '#B91C1C' : isStop ? '#B45309' : '#1A3C2B'}
                    strokeWidth={isSelected || isStart || isTarget || isStop ? 3 : 2}
                  />

                  {/* Architectural Elevator Symbol (Box with double arrow & diagonal cross) */}
                  {isElevator ? (
                    <g className="text-white fill-white pointer-events-none">
                      <line x1="0" y1="0" x2={transit.width} y2={transit.height} stroke="#FFFFFF" strokeWidth="0.8" strokeOpacity="0.4" />
                      <line x1={transit.width} y1="0" x2="0" y2={transit.height} stroke="#FFFFFF" strokeWidth="0.8" strokeOpacity="0.4" />
                      <rect x="8" y="8" width={transit.width - 16} height={transit.height - 16} fill="#F7F7F5" stroke="#1A3C2B" strokeWidth="1" />
                      <text
                        x={transit.width / 2}
                        y={transit.height / 2 + 3}
                        textAnchor="middle"
                        fill="#1A3C2B"
                        className="font-mono text-[9px] font-bold"
                      >
                        LIFT
                      </text>
                    </g>
                  ) : (
                    // Architectural Staircase symbol (Diagonal wireframe treads)
                    <g className="pointer-events-none">
                      {Array.from({ length: 6 }).map((_, idx) => (
                        <line
                          key={idx}
                          x1={4 + idx * 7}
                          y1="4"
                          x2={4 + idx * 7}
                          y2={transit.height - 4}
                          stroke="#1A3C2B"
                          strokeWidth="1.2"
                        />
                      ))}
                      <path
                        d={`M 4 ${transit.height / 2} L ${transit.width - 6} ${transit.height / 2}`}
                        stroke="#1A3C2B"
                        strokeWidth="1.5"
                        markerEnd="url(#route-arrowhead)"
                      />
                    </g>
                  )}

                  {/* Label under transit */}
                  <text
                    x={transit.width / 2}
                    y={transit.height + 12}
                    textAnchor="middle"
                    fill="#1A3C2B"
                    className="font-mono text-[8px] font-bold uppercase tracking-wider select-none pointer-events-none"
                  >
                    {transit.name}
                  </text>

                  {/* Routing Markers */}
                  {isStart && (
                    <g transform={`translate(${transit.width / 2}, -16)`}>
                      <rect x="-35" y="-12" width="70" height="15" fill="#047857" rx="2" stroke="#FFFFFF" strokeWidth="1" />
                      <text x="0" y="-1" textAnchor="middle" fill="#FFFFFF" className="font-mono text-[8px] font-bold">● INDULÁS</text>
                    </g>
                  )}
                  {isStop && !isStart && !isTarget && (
                    <g transform={`translate(${transit.width / 2}, -16)`}>
                      <rect x="-38" y="-12" width="76" height="15" fill="#B45309" rx="2" stroke="#FFFFFF" strokeWidth="1" />
                      <text x="0" y="-1" textAnchor="middle" fill="#FFFFFF" className="font-mono text-[8px] font-bold">{`🟠 ${stopIndex + 1}. MEGÁLLÓ`}</text>
                    </g>
                  )}
                  {isTarget && (
                    <g transform={`translate(${transit.width / 2}, -16)`}>
                      <rect x="-30" y="-12" width="60" height="15" fill="#B91C1C" rx="2" stroke="#FFFFFF" strokeWidth="1" />
                      <text x="0" y="-1" textAnchor="middle" fill="#FFFFFF" className="font-mono text-[8px] font-bold">★ CÉL</text>
                    </g>
                  )}
                </g>
              );
            })}

          {/* 5. POINTS OF INTEREST (POIs) LAYER */}
          {layerVisibility.pois &&
            floor.pois.map((poi) => {
              const isSelected = selectedPOIId === poi.id;
              const isStart = startRoomId === poi.id;
              const isTarget = targetRoomId === poi.id;
              const stopIndex = intermediateStopIds.indexOf(poi.id);
              const isStop = stopIndex !== -1;
              const isAllDragging = isAllSelected && activeAllOffset && (activeAllOffset.dx !== 0 || activeAllOffset.dy !== 0);
              const currentPos = isAllDragging
                ? { x: poi.position.x + activeAllOffset.dx, y: poi.position.y + activeAllOffset.dy }
                : activeDragPoi && activeDragPoi.poiId === poi.id
                ? activeDragPoi.position
                : poi.position;
              const isDraggable = isStudioMode && activeTool === 'select';

              return (
                <g
                  key={poi.id}
                  transform={`translate(${currentPos.x}, ${currentPos.y})`}
                  className={`${activeTool === 'eraser' ? 'cursor-pointer hover:opacity-50' : isDraggable ? 'cursor-move' : 'cursor-pointer'}`}
                  onPointerDown={(e) => {
                    if (e.button === 0 && isDraggable) {
                      e.stopPropagation();
                      const floorPt = screenToFloorCoords(e.clientX, e.clientY);
                      if (isAllSelected) {
                        startAllElementsDrag(floorPt);
                        return;
                      }
                      startPoiDrag(poi.id, floorPt, currentPos);
                    }
                  }}
                  onContextMenu={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setWayfinderActionMenu({
                      screenX: e.clientX,
                      screenY: e.clientY,
                      entityId: poi.id,
                      entityName: poi.name,
                      entityType: 'poi',
                    });
                  }}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (activeTool === 'eraser') {
                      if (onUpdateFloor) {
                        onUpdateFloor({
                          ...floor,
                          pois: floor.pois.filter((p) => p.id !== poi.id),
                        });
                      }
                      return;
                    }
                    if (onSelectPOI) onSelectPOI(poi);
                    if (!isStudioMode) {
                      setWayfinderActionMenu({
                        screenX: e.clientX,
                        screenY: e.clientY,
                        entityId: poi.id,
                        entityName: poi.name,
                        entityType: 'poi',
                      });
                    }
                  }}
                >
                  <circle
                    r={poi.type === 'entrance' || poi.type === 'exit' || poi.type === 'fire_exit' ? "15" : "13"}
                    fill={
                      isStart
                        ? '#ECFDF5'
                        : isTarget
                        ? '#FEF2F2'
                        : isStop
                        ? '#FFFBEB'
                        : poi.type === 'entrance'
                        ? '#ECFDF5'
                        : poi.type === 'exit'
                        ? '#FEF2F2'
                        : poi.type === 'fire_exit'
                        ? '#F0FDF4'
                        : poi.type === 'accessible_entrance'
                        ? '#F0F9FF'
                        : '#F7F7F5'
                    }
                    stroke={
                      isStart
                        ? '#047857'
                        : isTarget
                        ? '#B91C1C'
                        : isStop
                        ? '#B45309'
                        : poi.type === 'entrance'
                        ? '#047857'
                        : poi.type === 'exit'
                        ? '#B91C1C'
                        : poi.type === 'fire_exit'
                        ? '#15803D'
                        : poi.type === 'accessible_entrance'
                        ? '#0284C7'
                        : '#1A3C2B'
                    }
                    strokeWidth={isSelected || isStart || isTarget || isStop ? 2.5 : 1.8}
                  />
                  {/* Icon Glyphs */}
                  {poi.type === 'entrance' ? (
                    <g className="pointer-events-none">
                      <text x="0" y="3.5" textAnchor="middle" fill="#047857" className="font-mono text-[9px] font-bold">
                        🚪IN
                      </text>
                    </g>
                  ) : poi.type === 'exit' ? (
                    <g className="pointer-events-none">
                      <text x="0" y="3.5" textAnchor="middle" fill="#B91C1C" className="font-mono text-[9px] font-bold">
                        🚪OUT
                      </text>
                    </g>
                  ) : poi.type === 'fire_exit' ? (
                    <g className="pointer-events-none">
                      <text x="0" y="3.5" textAnchor="middle" fill="#15803D" className="font-mono text-[9px] font-bold">
                        🚨KI
                      </text>
                    </g>
                  ) : poi.type === 'accessible_entrance' ? (
                    <g className="pointer-events-none">
                      <text x="0" y="3.5" textAnchor="middle" fill="#0284C7" className="font-mono text-[9px] font-bold">
                        ♿IN
                      </text>
                    </g>
                  ) : poi.type.includes('restroom') ? (
                    <text x="0" y="3.5" textAnchor="middle" fill="#1A3C2B" className="font-mono text-[9px] font-bold pointer-events-none">
                      WC
                    </text>
                  ) : poi.type === 'aed' ? (
                    <text x="0" y="3.5" textAnchor="middle" fill="#B91C1C" className="font-mono text-[9px] font-bold pointer-events-none">
                      AED
                    </text>
                  ) : poi.type === 'reception' ? (
                    <text x="0" y="3.5" textAnchor="middle" fill="#1A3C2B" className="font-mono text-[9px] font-bold pointer-events-none">
                      ℹ️
                    </text>
                  ) : poi.type === 'printer' ? (
                    <text x="0" y="3.5" textAnchor="middle" fill="#1A3C2B" className="font-mono text-[9px] font-bold pointer-events-none">
                      🖨️
                    </text>
                  ) : poi.type === 'coffee' || poi.type === 'vending' ? (
                    <text x="0" y="3.5" textAnchor="middle" fill="#B45309" className="font-mono text-[9px] font-bold pointer-events-none">
                      ☕
                    </text>
                  ) : poi.type === 'water' ? (
                    <text x="0" y="3.5" textAnchor="middle" fill="#0284C7" className="font-mono text-[9px] font-bold pointer-events-none">
                      🚰
                    </text>
                  ) : (
                    <text x="0" y="3.5" textAnchor="middle" fill="#1A3C2B" className="font-mono text-[9px] font-bold pointer-events-none">
                      ●
                    </text>
                  )}

                  {/* Label under POI */}
                  <text
                    x="0"
                    y={poi.type === 'entrance' || poi.type === 'exit' || poi.type === 'fire_exit' ? "24" : "22"}
                    textAnchor="middle"
                    fill={poi.type === 'entrance' ? '#047857' : poi.type === 'exit' ? '#B91C1C' : '#1A3C2B'}
                    className="font-mono text-[7.5px] font-bold select-none pointer-events-none"
                  >
                    {poi.name}
                  </text>

                  {/* Routing Badges */}
                  {isStart && (
                    <g transform="translate(0, -20)">
                      <rect x="-35" y="-12" width="70" height="15" fill="#047857" rx="2" stroke="#FFFFFF" strokeWidth="1" />
                      <text x="0" y="-1" textAnchor="middle" fill="#FFFFFF" className="font-mono text-[8px] font-bold">● INDULÁS</text>
                    </g>
                  )}
                  {isStop && !isStart && !isTarget && (
                    <g transform="translate(0, -20)">
                      <rect x="-38" y="-12" width="76" height="15" fill="#B45309" rx="2" stroke="#FFFFFF" strokeWidth="1" />
                      <text x="0" y="-1" textAnchor="middle" fill="#FFFFFF" className="font-mono text-[8px] font-bold">{`🟠 ${stopIndex + 1}. MEGÁLLÓ`}</text>
                    </g>
                  )}
                  {isTarget && (
                    <g transform="translate(0, -20)">
                      <rect x="-30" y="-12" width="60" height="15" fill="#B91C1C" rx="2" stroke="#FFFFFF" strokeWidth="1" />
                      <text x="0" y="-1" textAnchor="middle" fill="#FFFFFF" className="font-mono text-[8px] font-bold">★ CÉL</text>
                    </g>
                  )}
                </g>
              );
            })}

          {/* 6. WALKABLE NAVGRAPH MESH LAYER (Toggleable in Studio) */}
          {layerVisibility.navMesh && (
            <g>
              {floor.navEdges.map((edge) => {
                const fromNode = floor.navNodes.find((n) => n.id === edge.fromNodeId);
                const toNode = floor.navNodes.find((n) => n.id === edge.toNodeId);
                if (!fromNode || !toNode) return null;
                const isAllDragging = isAllSelected && activeAllOffset && (activeAllOffset.dx !== 0 || activeAllOffset.dy !== 0);
                const fromPos = isAllDragging
                  ? { x: fromNode.position.x + activeAllOffset.dx, y: fromNode.position.y + activeAllOffset.dy }
                  : activeDragNavNode && activeDragNavNode.nodeId === fromNode.id
                  ? activeDragNavNode.position
                  : fromNode.position;
                const toPos = isAllDragging
                  ? { x: toNode.position.x + activeAllOffset.dx, y: toNode.position.y + activeAllOffset.dy }
                  : activeDragNavNode && activeDragNavNode.nodeId === toNode.id
                  ? activeDragNavNode.position
                  : toNode.position;

                return (
                  <line
                    key={edge.id}
                    x1={fromPos.x}
                    y1={fromPos.y}
                    x2={toPos.x}
                    y2={toPos.y}
                    stroke="rgba(14, 116, 144, 0.4)"
                    strokeWidth="1.5"
                    strokeDasharray="3 3"
                    className={activeTool === 'eraser' ? 'cursor-pointer hover:stroke-red-600' : 'pointer-events-none'}
                    onClick={(e) => {
                      if (activeTool === 'eraser' && onUpdateFloor) {
                        e.stopPropagation();
                        onUpdateFloor({
                          ...floor,
                          navEdges: floor.navEdges.filter((ed) => ed.id !== edge.id),
                        });
                      }
                    }}
                  />
                );
              })}
              {floor.navNodes.map((node) => {
                const isAllDragging = isAllSelected && activeAllOffset && (activeAllOffset.dx !== 0 || activeAllOffset.dy !== 0);
                const currentPos = isAllDragging
                  ? { x: node.position.x + activeAllOffset.dx, y: node.position.y + activeAllOffset.dy }
                  : activeDragNavNode && activeDragNavNode.nodeId === node.id
                  ? activeDragNavNode.position
                  : node.position;
                const isDraggable = isStudioMode && (activeTool === 'select' || activeTool === 'nav_node');

                return (
                  <g
                    key={node.id}
                    transform={`translate(${currentPos.x}, ${currentPos.y})`}
                    className={activeTool === 'eraser' ? 'cursor-pointer hover:fill-red-600' : isDraggable ? 'cursor-move' : ''}
                    onPointerDown={(e) => {
                      if (e.button === 0 && isDraggable) {
                        e.stopPropagation();
                        const floorPt = screenToFloorCoords(e.clientX, e.clientY);
                        if (isAllSelected) {
                          startAllElementsDrag(floorPt);
                          return;
                        }
                        startNavNodeDrag(node.id, floorPt, currentPos);
                      }
                    }}
                    onClick={(e) => {
                      if (activeTool === 'eraser' && onUpdateFloor) {
                        e.stopPropagation();
                        onUpdateFloor({
                          ...floor,
                          navNodes: floor.navNodes.filter((n) => n.id !== node.id),
                          navEdges: floor.navEdges.filter((ed) => ed.fromNodeId !== node.id && ed.toNodeId !== node.id),
                        });
                      }
                    }}
                  >
                    <circle
                      r={4}
                      fill="#0E7490"
                      stroke="#FFFFFF"
                      strokeWidth={1}
                    />
                    {isDraggable && (
                      <circle
                        r={12}
                        fill="transparent"
                      />
                    )}
                  </g>
                );
              })}
            </g>
          )}

          {/* 7. ACTIVE WAYFINDING ROUTE PATH OVERLAY */}
          {currentFloorPathSegments.length > 0 && (
            <g className="pointer-events-none">
              {currentFloorPathSegments.map((segment, sIdx) => {
                if (segment.length < 2) return null;
                const pointsStr = segment.map((n) => `${n.position.x},${n.position.y}`).join(' ');
                return (
                  <g key={`route-seg-${sIdx}`}>
                    {/* Path Underlay Glow */}
                    <polyline
                      points={pointsStr}
                      fill="none"
                      stroke="#047857"
                      strokeWidth="9"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeOpacity="0.25"
                    />

                    {/* Animated Dashed Route Flow Line */}
                    <polyline
                      points={pointsStr}
                      fill="none"
                      stroke="#1A3C2B"
                      strokeWidth="3.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="animate-route-flow"
                    />

                    {/* Waypoint circles along the path */}
                    {segment.map((node, i) => (
                      <circle
                        key={`route-pt-${sIdx}-${i}`}
                        cx={node.position.x}
                        cy={node.position.y}
                        r="3.5"
                        fill="#F7F7F5"
                        stroke="#1A3C2B"
                        strokeWidth="1.5"
                      />
                    ))}
                  </g>
                );
              })}

              {/* Floor Transition Badges (Elevator / Stairs Shaft Level Change on this floor) */}
              {floorTransitions.map((step, idx) => (
                <g key={`ft-${idx}`} transform={`translate(${step.coordinates.x}, ${step.coordinates.y - 28})`}>
                  <rect
                    x="-54"
                    y="-14"
                    width="108"
                    height="18"
                    fill="#1A3C2B"
                    stroke="#FFFFFF"
                    strokeWidth="1.5"
                    rx="3"
                  />
                  <text
                    x="0"
                    y="-1.5"
                    textAnchor="middle"
                    fill="#FFFFFF"
                    className="font-mono text-[8.5px] font-bold"
                  >
                    {step.transitType === 'elevator' ? '🛗 ' : '🪜 '}
                    {step.instruction.includes('FEL') ? 'SZINTVÁLTÁS (FEL)' : 'SZINTVÁLTÁS (LE)'}
                  </text>
                </g>
              ))}

              {/* Active Clicked Step Beacon Highlight */}
              {activeStep && activeStep.floorId === floor.id && activeStep.coordinates && (
                <g transform={`translate(${activeStep.coordinates.x}, ${activeStep.coordinates.y})`}>
                  <circle r="20" fill="#B45309" fillOpacity="0.25" className="animate-ping" />
                  <circle r="10" fill="#B45309" fillOpacity="0.6" />
                  <circle r="5" fill="#FFFFFF" stroke="#B45309" strokeWidth="2" />
                </g>
              )}

              {/* Real-time Walkthrough Simulation Avatar */}
              {simulationMarkerPos && (
                <g transform={`translate(${simulationMarkerPos.x}, ${simulationMarkerPos.y})`}>
                  <circle r="16" fill="#047857" fillOpacity="0.3" className="animate-ping-slow" />
                  <circle r="9" fill="#047857" stroke="#F7F7F5" strokeWidth="2.5" />
                  <circle r="3.5" fill="#F7F7F5" />
                </g>
              )}
            </g>
          )}

          {/* 8. STUDIO DRAWING PREVIEW OVERLAY */}
          {drawingState.polygonPoints.length > 0 && (
            <g className="pointer-events-none">
              {activeTool === 'room' && (
                <g>
                  {/* Filled Semi-transparent Polygon Preview */}
                  {drawingState.polygonPoints.length >= 2 && drawingState.currentPoint && (
                    <polygon
                      points={[...drawingState.polygonPoints, drawingState.currentPoint]
                        .map((p) => `${p.x},${p.y}`)
                        .join(' ')}
                      fill="rgba(26, 60, 43, 0.12)"
                      stroke="#1A3C2B"
                      strokeWidth="2"
                      strokeDasharray="4 2"
                    />
                  )}

                  {/* Connected Placed Segments with Dimensions */}
                  {drawingState.polygonPoints.map((pt, idx) => {
                    const nextPt =
                      idx < drawingState.polygonPoints.length - 1
                        ? drawingState.polygonPoints[idx + 1]
                        : drawingState.currentPoint;
                    if (!nextPt) return null;

                    const lenM = (distance(pt, nextPt) / PIXELS_PER_METER).toFixed(2);
                    const midX = (pt.x + nextPt.x) / 2;
                    const midY = (pt.y + nextPt.y) / 2;

                    return (
                      <g key={`draw-seg-${idx}`}>
                        <line
                          x1={pt.x}
                          y1={pt.y}
                          x2={nextPt.x}
                          y2={nextPt.y}
                          stroke="#1A3C2B"
                          strokeWidth="2.5"
                          strokeDasharray={idx === drawingState.polygonPoints.length - 1 ? '4 2' : undefined}
                        />
                        <g transform={`translate(${midX}, ${midY})`}>
                          <rect
                            x="-18"
                            y="-7"
                            width="36"
                            height="14"
                            fill="#FFFFFF"
                            stroke="#1A3C2B"
                            strokeWidth="1"
                            rx="2"
                          />
                          <text
                            x="0"
                            y="3"
                            textAnchor="middle"
                            fill="#1A3C2B"
                            className="font-mono text-[8.5px] font-bold"
                          >
                            {lenM}m
                          </text>
                        </g>
                      </g>
                    );
                  })}

                  {/* Vertex Points */}
                  {drawingState.polygonPoints.map((pt, idx) => (
                    <g key={`draw-v-${idx}`} transform={`translate(${pt.x}, ${pt.y})`}>
                      <circle
                        r={idx === 0 && drawingState.polygonPoints.length >= 3 ? 8 : 4.5}
                        fill={idx === 0 && drawingState.polygonPoints.length >= 3 ? '#047857' : '#1A3C2B'}
                        stroke="#FFFFFF"
                        strokeWidth="1.5"
                        className={idx === 0 && drawingState.polygonPoints.length >= 3 ? 'animate-pulse' : ''}
                      />
                      <text
                        x="0"
                        y="2.5"
                        textAnchor="middle"
                        fill="#FFFFFF"
                        className="font-mono text-[7px] font-bold"
                      >
                        {idx + 1}
                      </text>
                    </g>
                  ))}

                  {/* Closing Snap Indicator when hovering near start point */}
                  {drawingState.polygonPoints.length >= 3 &&
                    drawingState.currentPoint &&
                    distance(drawingState.polygonPoints[0], drawingState.currentPoint) < 22 && (
                      <g
                        transform={`translate(${drawingState.polygonPoints[0].x}, ${drawingState.polygonPoints[0].y})`}
                      >
                        <circle r="16" fill="none" stroke="#047857" strokeWidth="2.5" className="animate-ping" />
                        <rect
                          x="-50"
                          y="-28"
                          width="100"
                          height="16"
                          fill="#047857"
                          stroke="#FFFFFF"
                          strokeWidth="1"
                          rx="2"
                        />
                        <text
                          x="0"
                          y="-16"
                          textAnchor="middle"
                          fill="#FFFFFF"
                          className="font-mono text-[8px] font-bold"
                        >
                          BEZÁRÁS (KATTINTSON)
                        </text>
                      </g>
                    )}
                </g>
              )}

              {activeTool === 'zone' && (
                <g>
                  {/* Filled Semi-transparent Zone Polygon Preview */}
                  {drawingState.polygonPoints.length >= 2 && drawingState.currentPoint && (
                    <polygon
                      points={[...drawingState.polygonPoints, drawingState.currentPoint]
                        .map((p) => `${p.x},${p.y}`)
                        .join(' ')}
                      fill="rgba(217, 119, 6, 0.16)"
                      stroke="#D97706"
                      strokeWidth="2"
                      strokeDasharray="4 2"
                    />
                  )}

                  {/* Connected Placed Segments with Dimensions */}
                  {drawingState.polygonPoints.map((pt, idx) => {
                    const nextPt =
                      idx < drawingState.polygonPoints.length - 1
                        ? drawingState.polygonPoints[idx + 1]
                        : drawingState.currentPoint;
                    if (!nextPt) return null;

                    const lenM = (distance(pt, nextPt) / PIXELS_PER_METER).toFixed(2);
                    const midX = (pt.x + nextPt.x) / 2;
                    const midY = (pt.y + nextPt.y) / 2;

                    return (
                      <g key={`draw-zone-seg-${idx}`}>
                        <line
                          x1={pt.x}
                          y1={pt.y}
                          x2={nextPt.x}
                          y2={nextPt.y}
                          stroke="#D97706"
                          strokeWidth="2.5"
                          strokeDasharray={idx === drawingState.polygonPoints.length - 1 ? '4 2' : undefined}
                        />
                        <g transform={`translate(${midX}, ${midY})`}>
                          <rect
                            x="-18"
                            y="-7"
                            width="36"
                            height="14"
                            fill="#FFFFFF"
                            stroke="#D97706"
                            strokeWidth="1"
                            rx="2"
                          />
                          <text
                            x="0"
                            y="3"
                            textAnchor="middle"
                            fill="#D97706"
                            className="font-mono text-[8px] font-bold"
                          >
                            {lenM}m
                          </text>
                        </g>
                      </g>
                    );
                  })}

                  {/* Placed Corner Anchor Vertices */}
                  {drawingState.polygonPoints.map((pt, idx) => (
                    <g key={`draw-zone-pt-${idx}`} transform={`translate(${pt.x}, ${pt.y})`}>
                      <circle
                        r="6"
                        fill="#D97706"
                        stroke="#FFFFFF"
                        strokeWidth="1.5"
                        className={idx === 0 && drawingState.polygonPoints.length >= 3 ? 'animate-pulse' : ''}
                      />
                      <text
                        x="0"
                        y="2.5"
                        textAnchor="middle"
                        fill="#FFFFFF"
                        className="font-mono text-[7px] font-bold"
                      >
                        {idx + 1}
                      </text>
                    </g>
                  ))}

                  {/* Closing Snap Indicator when hovering near start point */}
                  {drawingState.polygonPoints.length >= 3 &&
                    drawingState.currentPoint &&
                    distance(drawingState.polygonPoints[0], drawingState.currentPoint) < 22 && (
                      <g
                        transform={`translate(${drawingState.polygonPoints[0].x}, ${drawingState.polygonPoints[0].y})`}
                      >
                        <circle r="16" fill="none" stroke="#D97706" strokeWidth="2.5" className="animate-ping" />
                        <rect
                          x="-60"
                          y="-28"
                          width="120"
                          height="16"
                          fill="#D97706"
                          stroke="#FFFFFF"
                          strokeWidth="1"
                          rx="2"
                        />
                        <text
                          x="0"
                          y="-16"
                          textAnchor="middle"
                          fill="#FFFFFF"
                          className="font-mono text-[8px] font-bold"
                        >
                          ✓ ZÓNA LEZÁRÁSA (KATTINTÁS)
                        </text>
                      </g>
                    )}
                </g>
              )}

              {activeTool === 'wall' && drawingState.startPoint && drawingState.currentPoint && (
                <g className="pointer-events-none select-none">
                  {/* Dashed In-Progress Wall Line */}
                  <line
                    x1={drawingState.startPoint.x}
                    y1={drawingState.startPoint.y}
                    x2={drawingState.currentPoint.x}
                    y2={drawingState.currentPoint.y}
                    stroke="#1A3C2B"
                    strokeWidth="3.5"
                    strokeDasharray="4 2"
                  />
                  {/* Start Point Dot */}
                  <circle
                    cx={drawingState.startPoint.x}
                    cy={drawingState.startPoint.y}
                    r={5 / viewport.zoom}
                    fill="#1A3C2B"
                    stroke="#FFFFFF"
                    strokeWidth={1.5 / viewport.zoom}
                  />
                  {/* End/Current Cursor Dot */}
                  <circle
                    cx={drawingState.currentPoint.x}
                    cy={drawingState.currentPoint.y}
                    r={5 / viewport.zoom}
                    fill="#047857"
                    stroke="#FFFFFF"
                    strokeWidth={1.5 / viewport.zoom}
                  />
                  {/* Live Dimension Tag */}
                  <g
                    transform={`translate(${
                      (drawingState.startPoint.x + drawingState.currentPoint.x) / 2
                    }, ${(drawingState.startPoint.y + drawingState.currentPoint.y) / 2 - 14})`}
                  >
                    <rect
                      x="-22"
                      y="-8"
                      width="44"
                      height="16"
                      fill="#1A3C2B"
                      rx="2"
                      className="shadow-sm"
                    />
                    <text
                      x="0"
                      y="3.5"
                      textAnchor="middle"
                      fill="#FFFFFF"
                      className="font-mono text-[9px] font-bold"
                    >
                      {(distance(drawingState.startPoint, drawingState.currentPoint) / PIXELS_PER_METER).toFixed(2)}m
                    </text>
                  </g>
                </g>
              )}

              {/* Door Placement Live Snap Preview */}
              {activeTool === 'door' && cursorFloorPos && (() => {
                const aligned = alignDoorToWall(cursorFloorPos, floor.walls, floor.rooms, 18);
                const dx = aligned.end.x - aligned.start.x;
                const dy = aligned.end.y - aligned.start.y;
                const doorWidth = Math.sqrt(dx * dx + dy * dy) || 18;
                const unitTan = { x: dx / doorWidth, y: dy / doorWidth };
                const unitNorm = { x: -unitTan.y, y: unitTan.x };
                const leafEnd = {
                  x: aligned.start.x + unitNorm.x * doorWidth,
                  y: aligned.start.y + unitNorm.y * doorWidth,
                };

                return (
                  <g className="pointer-events-none select-none">
                    {/* Wall Opening Gap */}
                    <line
                      x1={aligned.start.x}
                      y1={aligned.start.y}
                      x2={aligned.end.x}
                      y2={aligned.end.y}
                      stroke="#FFFFFF"
                      strokeWidth="6"
                    />
                    {/* Threshold Line */}
                    <line
                      x1={aligned.start.x}
                      y1={aligned.start.y}
                      x2={aligned.end.x}
                      y2={aligned.end.y}
                      stroke="#047857"
                      strokeWidth="1.2"
                      strokeDasharray="2 1.5"
                    />
                    {/* Door Swing Sector Preview */}
                    <path
                      d={`M ${aligned.start.x} ${aligned.start.y} L ${aligned.end.x} ${aligned.end.y} A ${doorWidth} ${doorWidth} 0 0 0 ${leafEnd.x} ${leafEnd.y} Z`}
                      fill="rgba(4, 120, 87, 0.12)"
                      stroke="#047857"
                      strokeWidth="1"
                      strokeDasharray="2 1.5"
                    />
                    {/* Door Leaf Panel Preview */}
                    <line
                      x1={aligned.start.x}
                      y1={aligned.start.y}
                      x2={leafEnd.x}
                      y2={leafEnd.y}
                      stroke="#047857"
                      strokeWidth="2.2"
                      strokeLinecap="round"
                    />
                    {/* Jamb End Caps */}
                    <line
                      x1={aligned.start.x - unitNorm.x * 2.5}
                      y1={aligned.start.y - unitNorm.y * 2.5}
                      x2={aligned.start.x + unitNorm.x * 2.5}
                      y2={aligned.start.y + unitNorm.y * 2.5}
                      stroke="#047857"
                      strokeWidth="2"
                    />
                    <line
                      x1={aligned.end.x - unitNorm.x * 2.5}
                      y1={aligned.end.y - unitNorm.y * 2.5}
                      x2={aligned.end.x + unitNorm.x * 2.5}
                      y2={aligned.end.y + unitNorm.y * 2.5}
                      stroke="#047857"
                      strokeWidth="2"
                    />
                    {/* Snapped Tooltip Tag */}
                    <g
                      transform={`translate(${
                        (aligned.start.x + aligned.end.x) / 2
                      }, ${(aligned.start.y + aligned.end.y) / 2 - 14})`}
                    >
                      <rect
                        x="-48"
                        y="-7.5"
                        width="96"
                        height="15"
                        fill="#047857"
                        rx="2"
                        className="shadow-sm"
                      />
                      <text
                        x="0"
                        y="3"
                        textAnchor="middle"
                        fill="#FFFFFF"
                        className="font-mono text-[8px] font-bold"
                      >
                        {aligned.isSnapped ? "✓ FALHOZ IGAZÍTVA" : "AJTÓ LERAKÁSA"}
                      </text>
                    </g>
                  </g>
                );
              })()}
            </g>
          )}

          {/* 9. MEASURE TAPE TOOL DIMENSION LINE */}
          {measurePoints.start && measurePoints.end && (
            <g className="pointer-events-none">
              <line
                x1={measurePoints.start.x}
                y1={measurePoints.start.y}
                x2={measurePoints.end.x}
                y2={measurePoints.end.y}
                stroke="#B91C1C"
                strokeWidth="2"
                strokeDasharray="4 2"
              />
              <circle cx={measurePoints.start.x} cy={measurePoints.start.y} r="3" fill="#B91C1C" />
              <circle cx={measurePoints.end.x} cy={measurePoints.end.y} r="3" fill="#B91C1C" />
              {/* Measure Dimension Badge */}
              <g
                transform={`translate(${
                  (measurePoints.start.x + measurePoints.end.x) / 2
                }, ${(measurePoints.start.y + measurePoints.end.y) / 2 - 12})`}
              >
                <rect
                  x="-35"
                  y="-10"
                  width="70"
                  height="16"
                  fill="#B91C1C"
                  stroke="#FFFFFF"
                  strokeWidth="1"
                />
                <text
                  x="0"
                  y="2"
                  textAnchor="middle"
                  fill="#FFFFFF"
                  className="font-mono text-[9px] font-bold"
                >
                  {distanceInMeters(measurePoints.start, measurePoints.end).toFixed(2)}m
                </text>
              </g>
            </g>
          )}

          {/* ALL ELEMENTS BOUNDING BOX OVERLAY (When Ctrl+A / Select All is Active) */}
          {isAllSelected && isStudioMode && allElementsBoundingBox && (
            <g className="all-elements-selection-overlay">
              {/* Semi-transparent Bounding Fill & Dashed Outline */}
              <rect
                x={allElementsBoundingBox.x}
                y={allElementsBoundingBox.y}
                width={allElementsBoundingBox.width}
                height={allElementsBoundingBox.height}
                fill="#1A3C2B"
                fillOpacity={0.03}
                stroke="#1A3C2B"
                strokeWidth={2 / viewport.zoom}
                strokeDasharray={`${8 / viewport.zoom} ${5 / viewport.zoom}`}
                className="cursor-move"
                onPointerDown={(e) => {
                  if (e.button === 0 && activeTool === 'select') {
                    e.stopPropagation();
                    const floorPt = screenToFloorCoords(e.clientX, e.clientY);
                    startAllElementsDrag(floorPt);
                  }
                }}
              />

              {/* 4 Corner Markers */}
              {[
                { cx: allElementsBoundingBox.x, cy: allElementsBoundingBox.y },
                { cx: allElementsBoundingBox.x + allElementsBoundingBox.width, cy: allElementsBoundingBox.y },
                { cx: allElementsBoundingBox.x + allElementsBoundingBox.width, cy: allElementsBoundingBox.y + allElementsBoundingBox.height },
                { cx: allElementsBoundingBox.x, cy: allElementsBoundingBox.y + allElementsBoundingBox.height },
              ].map((c, i) => (
                <rect
                  key={`all-corner-${i}`}
                  x={c.cx - 5 / viewport.zoom}
                  y={c.cy - 5 / viewport.zoom}
                  width={10 / viewport.zoom}
                  height={10 / viewport.zoom}
                  fill="#FFFFFF"
                  stroke="#1A3C2B"
                  strokeWidth={2 / viewport.zoom}
                  className="pointer-events-none shadow-xs"
                />
              ))}

              {/* Top Dimension Tag */}
              <g transform={`translate(${allElementsBoundingBox.x + allElementsBoundingBox.width / 2}, ${allElementsBoundingBox.y - 12 / viewport.zoom})`}>
                <rect
                  x="-42"
                  y="-9"
                  width="84"
                  height="16"
                  rx="3"
                  fill="#1A3C2B"
                  className="pointer-events-none shadow-md"
                />
                <text
                  x="0"
                  y="2.5"
                  textAnchor="middle"
                  fill="#FFFFFF"
                  className="font-mono text-[8px] font-bold pointer-events-none select-none"
                >
                  {allElementsBoundingBox.realWidthMeters.toFixed(1)}m × {allElementsBoundingBox.realHeightMeters.toFixed(1)}m
                </text>
              </g>

              {/* Center Move Badge */}
              <g transform={`translate(${allElementsBoundingBox.x + allElementsBoundingBox.width / 2}, ${allElementsBoundingBox.y + allElementsBoundingBox.height / 2})`}>
                <rect
                  x="-115"
                  y="-14"
                  width="230"
                  height="28"
                  rx="4"
                  fill="#1A3C2B"
                  stroke="#FFFFFF"
                  strokeWidth={1.5 / viewport.zoom}
                  className="cursor-move shadow-xl"
                  onPointerDown={(e) => {
                    if (e.button === 0 && activeTool === 'select') {
                      e.stopPropagation();
                      const floorPt = screenToFloorCoords(e.clientX, e.clientY);
                      startAllElementsDrag(floorPt);
                    }
                  }}
                />
                <text
                  x="0"
                  y="3.5"
                  textAnchor="middle"
                  fill="#FFFFFF"
                  className="font-mono text-[9px] font-bold tracking-wider pointer-events-none select-none"
                >
                  ✥ ÖSSZES ELEM MOZGATÁSA ({allElementsBoundingBox.elementCount} DB)
                </text>
              </g>
            </g>
          )}
        </g>
      </svg>

      {/* Floating Batch Control Banner (When All Elements Selected) */}
      {isAllSelected && isStudioMode && allElementsBoundingBox && (
        <div className="absolute top-3 left-1/2 -translate-x-1/2 z-40 bg-[#1A3C2B] text-white px-3.5 py-1.5 shadow-2xl border border-white/40 flex items-center gap-3 font-mono text-xs select-none animate-in fade-in slide-in-from-top-3 duration-150 rounded-xs no-print">
          <div className="flex items-center gap-2">
            <span className="bg-white text-[#1A3C2B] px-1.5 py-0.5 font-bold text-[10px]">
              MINDEN ELEM KIJELÖLVE ({allElementsBoundingBox.elementCount} DB)
            </span>
            <span className="text-white/80 text-[10px] hidden md:inline">
              Húzással vagy nyilakkal mozgatható
            </span>
          </div>

          <div className="h-4 w-px bg-white/20" />

          {/* Quick Nudge Buttons */}
          <div className="flex items-center gap-1">
            <button
              onClick={() => nudgeAllElements(-20, 0)}
              className="px-1.5 py-0.5 bg-white/10 hover:bg-white/30 text-[10px] font-bold cursor-pointer transition-colors"
              title="Balra tolás 20px (Shift+Bal Nyíl)"
            >
              ⬅ 20px
            </button>
            <button
              onClick={() => nudgeAllElements(20, 0)}
              className="px-1.5 py-0.5 bg-white/10 hover:bg-white/30 text-[10px] font-bold cursor-pointer transition-colors"
              title="Jobbra tolás 20px (Shift+Jobb Nyíl)"
            >
              ➡ 20px
            </button>
            <button
              onClick={() => nudgeAllElements(0, -20)}
              className="px-1.5 py-0.5 bg-white/10 hover:bg-white/30 text-[10px] font-bold cursor-pointer transition-colors"
              title="Felfelé tolás 20px (Shift+Fel Nyíl)"
            >
              ⬆ 20px
            </button>
            <button
              onClick={() => nudgeAllElements(0, 20)}
              className="px-1.5 py-0.5 bg-white/10 hover:bg-white/30 text-[10px] font-bold cursor-pointer transition-colors"
              title="Lefelé tolás 20px (Shift+Le Nyíl)"
            >
              ⬇ 20px
            </button>
          </div>

          <div className="h-4 w-px bg-white/20" />

          <button
            onClick={() => setAllSelected(false)}
            className="px-2 py-0.5 bg-white text-[#1A3C2B] hover:bg-neutral-200 font-bold text-[10px] cursor-pointer transition-colors"
            title="Kijelölés feloldása (Esc)"
          >
            FELOLDÁS (ESC)
          </button>
        </div>
      )}

      {/* Wayfinder Action Context Popover */}
      {wayfinderActionMenu && (
        <div
          className="fixed z-50 bg-[#FFFFFF] border border-[#1A3C2B] shadow-2xl p-2 font-mono text-xs flex flex-col gap-1 min-w-[190px] animate-in fade-in zoom-in-95 duration-100 no-print"
          style={{
            left: Math.min(window.innerWidth - 210, Math.max(10, wayfinderActionMenu.screenX)),
            top: Math.min(window.innerHeight - 210, Math.max(10, wayfinderActionMenu.screenY)),
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="p-1 border-b border-[#1A3C2B]/20 font-bold text-[#1A3C2B] truncate text-[11px] flex items-center justify-between">
            <span className="truncate">{wayfinderActionMenu.entityName}</span>
            <button
              onClick={() => setWayfinderActionMenu(null)}
              className="text-[#1A3C2B]/50 hover:text-[#1A3C2B] text-xs px-1"
            >
              ✕
            </button>
          </div>

          <button
            onClick={() => {
              if (onSetAsStartRoom) onSetAsStartRoom(wayfinderActionMenu.entityId);
              setWayfinderActionMenu(null);
            }}
            className="px-2 py-1.5 hover:bg-[#F0F5F2] text-left flex items-center gap-2 text-[#047857] font-bold text-[10px] cursor-pointer"
          >
            <span className="w-2.5 h-2.5 rounded-full bg-[#047857]" />
            <span>INDULÁSI PONT</span>
          </button>

          <button
            onClick={() => {
              if (onSetAsTargetRoom) onSetAsTargetRoom(wayfinderActionMenu.entityId);
              setWayfinderActionMenu(null);
            }}
            className="px-2 py-1.5 hover:bg-[#F0F5F2] text-left flex items-center gap-2 text-[#B91C1C] font-bold text-[10px] cursor-pointer"
          >
            <span className="w-2.5 h-2.5 bg-[#B91C1C] rotate-45" />
            <span>CÉLÁLLOMÁS</span>
          </button>

          {onAddIntermediateStop && (
            <button
              onClick={() => {
                onAddIntermediateStop(wayfinderActionMenu.entityId);
                setWayfinderActionMenu(null);
              }}
              className="px-2 py-1.5 hover:bg-[#F0F5F2] text-left flex items-center gap-2 text-[#B45309] font-bold text-[10px] cursor-pointer"
            >
              <span className="w-2.5 h-2.5 rounded-xs bg-[#B45309]" />
              <span>+ KÖZTES MEGÁLLÓ</span>
            </button>
          )}

          {isStudioMode && onSelectRoom && wayfinderActionMenu.entityType === 'room' && (() => {
            const currentRoom = floor.rooms.find((r) => r.id === wayfinderActionMenu.entityId);
            if (!currentRoom) return null;
            return (
              <button
                onClick={() => {
                  onSelectRoom(currentRoom);
                  setWayfinderActionMenu(null);
                }}
                className="px-2 py-1.5 hover:bg-[#F0F5F2] text-left flex items-center gap-2 text-[#1A3C2B] font-bold text-[10px] cursor-pointer"
              >
                <span>⚙️</span>
                <span>HELYISÉG TULAJDONSÁGOK</span>
              </button>
            );
          })()}

          {isStudioMode && onDuplicateRoom && wayfinderActionMenu.entityType === 'room' && (() => {
            const currentRoom = floor.rooms.find((r) => r.id === wayfinderActionMenu.entityId);
            if (!currentRoom) return null;
            return (
              <button
                onClick={() => {
                  onDuplicateRoom(currentRoom);
                  setWayfinderActionMenu(null);
                }}
                className="px-2 py-1.5 hover:bg-[#F0F5F2] text-left flex items-center gap-2 text-[#1A3C2B] font-bold text-[10px] cursor-pointer border-t border-[#1A3C2B]/10"
              >
                <span>📋</span>
                <span>TEREM MÁSOLÁSA (DUPLIKÁLÁS)</span>
              </button>
            );
          })()}

          {isStudioMode && onSelectZone && wayfinderActionMenu.entityType === 'zone' && (() => {
            const currentZone = (floor.zones || []).find((z) => z.id === wayfinderActionMenu.entityId);
            if (!currentZone) return null;
            return (
              <button
                onClick={() => {
                  onSelectZone(currentZone);
                  setWayfinderActionMenu(null);
                }}
                className="px-2 py-1.5 hover:bg-[#F0F5F2] text-left flex items-center gap-2 text-[#1A3C2B] font-bold text-[10px] cursor-pointer"
              >
                <span>🏢</span>
                <span>ZÓNA TULAJDONSÁGOK</span>
              </button>
            );
          })()}

          {isStudioMode && onDuplicateZone && wayfinderActionMenu.entityType === 'zone' && (() => {
            const currentZone = (floor.zones || []).find((z) => z.id === wayfinderActionMenu.entityId);
            if (!currentZone) return null;
            return (
              <button
                onClick={() => {
                  onDuplicateZone(currentZone);
                  setWayfinderActionMenu(null);
                }}
                className="px-2 py-1.5 hover:bg-[#F0F5F2] text-left flex items-center gap-2 text-[#1A3C2B] font-bold text-[10px] cursor-pointer border-t border-[#1A3C2B]/10"
              >
                <span>📋</span>
                <span>ZÓNA DUPLIKÁLÁSA</span>
              </button>
            );
          })()}
        </div>
      )}
    </div>
  );
};
