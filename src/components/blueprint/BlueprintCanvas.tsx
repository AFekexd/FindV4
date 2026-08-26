import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import type {
  Floor,
  Room,
  Wall,
  Door,
  TransitConnector,
  PointOfInterest,
  NavNode,
  EditorTool,
  RouteResult,
  Point,
  ViewportTransform,
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
} from 'lucide-react';
import { BlueprintScaleBar } from './BlueprintScaleBar';
import { CompassRose } from './CompassRose';
import { FloorMiniMap } from './FloorMiniMap';

interface BlueprintCanvasProps {
  floor: Floor;
  activeTool: EditorTool;
  isStudioMode: boolean;
  selectedRoomId?: string | null;
  selectedTransitId?: string | null;
  selectedPOIId?: string | null;
  startRoomId?: string | null;
  targetRoomId?: string | null;
  routeResult?: RouteResult | null;
  activeSimulationProgress?: number | null; // 0 to 1
  gridSnapSize?: number; // 0 (free), 5, 10, 20
  onSelectRoom?: (room: Room | null) => void;
  onSelectTransit?: (transit: TransitConnector | null) => void;
  onSelectPOI?: (poi: PointOfInterest | null) => void;
  onSetAsStartRoom?: (roomId: string) => void;
  onSetAsTargetRoom?: (roomId: string) => void;
  onUpdateFloor?: (updatedFloor: Floor) => void;
  className?: string;
}

export const BlueprintCanvas: React.FC<BlueprintCanvasProps> = ({
  floor,
  activeTool,
  isStudioMode,
  selectedRoomId,
  selectedTransitId,
  selectedPOIId,
  startRoomId,
  targetRoomId,
  routeResult,
  activeSimulationProgress,
  gridSnapSize = 10,
  onSelectRoom,
  onSelectTransit,
  onSelectPOI,
  onSetAsStartRoom,
  onSetAsTargetRoom,
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

  // Layer Visibility
  const [layerVisibility, setLayerVisibility] = useState({
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

  // Room Vertex & Entire Room Dragging state with zero-latency local tracking
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

  // Global Pointer Listeners for smooth, uninterrupted vertex and whole room dragging
  useEffect(() => {
    const handleGlobalPointerMove = (e: PointerEvent) => {
      // 1. Dragging single vertex
      if (draggingVertexRef.current) {
        const floorPt = screenToFloorCoords(e.clientX, e.clientY);
        const { roomId, vertexIndex, currentPolygon } = draggingVertexRef.current;
        const updatedPolygon = [...currentPolygon];
        updatedPolygon[vertexIndex] = floorPt;
        draggingVertexRef.current.currentPolygon = updatedPolygon;
        setActiveDragPolygon({ roomId, polygon: updatedPolygon });
        return;
      }

      // 2. Dragging entire room (Translation)
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
    };

    const handleGlobalPointerUp = () => {
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

      draggingVertexRef.current = null;
      draggingRoomRef.current = null;
      setActiveDragPolygon(null);
    };

    window.addEventListener('pointermove', handleGlobalPointerMove);
    window.addEventListener('pointerup', handleGlobalPointerUp);
    window.addEventListener('pointercancel', handleGlobalPointerUp);

    return () => {
      window.removeEventListener('pointermove', handleGlobalPointerMove);
      window.removeEventListener('pointerup', handleGlobalPointerUp);
      window.removeEventListener('pointercancel', handleGlobalPointerUp);
    };
  }, [screenToFloorCoords, floor, onUpdateFloor, activeDragPolygon]);

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
      if (t.position.x - 60 < minX) minX = t.position.x - 60;
      if (t.position.y - 60 < minY) minY = t.position.y - 60;
      if (t.position.x + 60 > maxX) maxX = t.position.x + 60;
      if (t.position.y + 60 > maxY) maxY = t.position.y + 60;
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
  }, [floor, activeDragPolygon, drawingState]);

  // Reset Viewport to fit all content
  const handleFitToScreen = useCallback(() => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const padding = 60;
    const availableWidth = rect.width - padding * 2;
    const availableHeight = rect.height - padding * 2;

    const spanWidth = computedBounds.width;
    const spanHeight = computedBounds.height;
    const zoomX = availableWidth / spanWidth;
    const zoomY = availableHeight / spanHeight;
    const optimalZoom = Math.min(1.6, Math.max(0.3, Math.min(zoomX, zoomY)));

    const centeredX = (rect.width - spanWidth * optimalZoom) / 2 - computedBounds.minX * optimalZoom;
    const centeredY = (rect.height - spanHeight * optimalZoom) / 2 - computedBounds.minY * optimalZoom;

    setViewport({
      x: centeredX,
      y: centeredY,
      zoom: optimalZoom,
    });
  }, [computedBounds]);

  useEffect(() => {
    handleFitToScreen();
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
      const newDoor: Door = {
        id: `door-${Date.now()}`,
        floorId: floor.id,
        start: { x: floorPt.x - 10, y: floorPt.y },
        end: { x: floorPt.x + 10, y: floorPt.y },
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
      const newTransit: TransitConnector = {
        id: `transit-${Date.now()}`,
        floorId: floor.id,
        transitGroupId: `SHAFT-${Date.now().toString().slice(-4)}`,
        type: 'elevator',
        name: 'New Elevator Shaft',
        position: floorPt,
        width: 44,
        height: 44,
        navNodeId: `node-transit-${Date.now()}`,
        isAccessible: true,
        servesFloorIds: [floor.id],
      };
      if (onUpdateFloor) {
        onUpdateFloor({
          ...floor,
          transitConnectors: [...floor.transitConnectors, newTransit],
        });
      }
      return;
    }

    if (activeTool === 'poi') {
      const newPOI: PointOfInterest = {
        id: `poi-${Date.now()}`,
        floorId: floor.id,
        type: 'restroom_accessible',
        name: 'Restroom Facility',
        position: floorPt,
        description: 'Sanitary facility',
      };
      if (onUpdateFloor) {
        onUpdateFloor({
          ...floor,
          pois: [...floor.pois, newPOI],
        });
      }
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
        onUpdateFloor({
          ...floor,
          rooms: floor.rooms.filter((r) => r.id !== hitRoom.id),
        });
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

  // Double click to finish polygon room
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
    }
  };

  // Global Keyboard shortcuts while drawing (Enter / Escape)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
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
      } else if (e.key === 'Escape') {
        setDrawingState({ startPoint: null, currentPoint: null, polygonPoints: [] });
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
  }, [activeTool, drawingState, floor, onUpdateFloor, isStudioMode, selectedRoomId]);

  // Filter current floor route path segments
  const currentFloorPathNodes = (routeResult?.pathNodes || []).filter(
    (n) => n.floorId === floor.id
  );

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
      <div className="absolute top-3 left-3 z-20 flex items-center gap-2">
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
      <div className="absolute top-3 right-3 z-20 flex items-center gap-1 bg-[#F7F7F5] border border-[#1A3C2B] p-1">
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
      <div className="absolute bottom-3 left-3 z-20 flex flex-col gap-2 pointer-events-auto">
        <BlueprintScaleBar
          zoom={viewport.zoom}
          cursorPos={cursorFloorPos}
          elevationMeters={floor.elevationMeters}
        />
      </div>

      {/* Bottom Right: True North Compass & Mini-Map */}
      <div className="absolute bottom-3 right-3 z-20 flex items-end gap-2 pointer-events-auto">
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

          {/* 1. ROOMS LAYER */}
          {layerVisibility.rooms &&
            floor.rooms.map((room) => {
              const isSelected = selectedRoomId === room.id;
              const isStart = startRoomId === room.id;
              const isTarget = targetRoomId === room.id;
              const isDragging = activeDragPolygon && activeDragPolygon.roomId === room.id;
              const currentPolygon = isDragging ? activeDragPolygon.polygon : room.polygon;
              const centroid = polygonCentroid(currentPolygon);
              const area = polygonAreaInSquareMeters(currentPolygon);
              const pointsStr = currentPolygon.map((p) => `${p.x},${p.y}`).join(' ');

              // Fill styling based on room state
              let fillColor = room.colorHatch || 'rgba(26, 60, 43, 0.05)';
              let strokeColor = '#1A3C2B';
              let strokeWidth = isSelected ? 3 : 1.5;

              if (isStart) {
                fillColor = 'rgba(4, 120, 87, 0.22)';
                strokeColor = '#047857';
                strokeWidth = 3;
              } else if (isTarget) {
                fillColor = 'rgba(185, 28, 28, 0.22)';
                strokeColor = '#B91C1C';
                strokeWidth = 3;
              } else if (isSelected) {
                fillColor = 'rgba(26, 60, 43, 0.18)';
              }

              return (
                <g
                  key={room.id}
                  className={`cursor-pointer group ${
                    activeTool === 'eraser' ? 'hover:opacity-60' : ''
                  }`}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (activeTool === 'eraser') {
                      if (onUpdateFloor) {
                        onUpdateFloor({
                          ...floor,
                          rooms: floor.rooms.filter((r) => r.id !== room.id),
                        });
                      }
                      return;
                    }
                    if (onSelectRoom) onSelectRoom(room);
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
                      isStudioMode && activeTool === 'select' && isSelected
                        ? 'cursor-move'
                        : undefined
                    }
                    onPointerDown={(e) => {
                      if (e.button === 0 && isStudioMode && activeTool === 'select' && isSelected) {
                        e.stopPropagation();
                        const floorPt = screenToFloorCoords(e.clientX, e.clientY);
                        startRoomDrag(room.id, floorPt, currentPolygon);
                      }
                    }}
                  />

                  {/* Room Diagonal Hatch if restricted or lab */}
                  {room.isRestricted && (
                    <polygon
                      points={pointsStr}
                      fill="url(#cad-diagonal-hatch)"
                      pointerEvents="none"
                    />
                  )}

                  {/* Room Labels (Editorial Space Grotesk + JetBrains Mono) */}
                  <g
                    transform={`translate(${centroid.x}, ${centroid.y})`}
                    className="pointer-events-none select-none"
                  >
                    {/* Room Code Badge */}
                    <rect
                      x="-28"
                      y="-22"
                      width="56"
                      height="15"
                      fill="#1A3C2B"
                      className="transition-colors"
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

                    {/* Room Name */}
                    <text
                      x="0"
                      y="5"
                      textAnchor="middle"
                      fill="#1A3C2B"
                      className="font-sans text-[11px] font-bold"
                    >
                      {room.name.length > 26 ? `${room.name.slice(0, 24)}…` : room.name}
                    </text>

                    {/* Technical Room Area / Capacity Subtext */}
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

                  {/* Start / Destination CAD Pin Markers */}
                  {isStart && (
                    <g transform={`translate(${centroid.x}, ${centroid.y - 32})`}>
                      <rect
                        x="-44"
                        y="-16"
                        width="88"
                        height="16"
                        fill="#047857"
                        stroke="#F7F7F5"
                        strokeWidth="1"
                      />
                      <text
                        x="0"
                        y="-4"
                        textAnchor="middle"
                        fill="#F7F7F5"
                        className="font-mono text-[9px] font-bold"
                      >
                        ● INDULÁSI PONT
                      </text>
                      <line x1="0" y1="0" x2="0" y2="12" stroke="#047857" strokeWidth="2" />
                    </g>
                  )}

                  {isTarget && (
                    <g transform={`translate(${centroid.x}, ${centroid.y - 32})`}>
                      <rect
                        x="-46"
                        y="-16"
                        width="92"
                        height="16"
                        fill="#B91C1C"
                        stroke="#F7F7F5"
                        strokeWidth="1"
                      />
                      <text
                        x="0"
                        y="-4"
                        textAnchor="middle"
                        fill="#F7F7F5"
                        className="font-mono text-[9px] font-bold"
                      >
                        ★ CÉLÁLLOMÁS
                      </text>
                      <line x1="0" y1="0" x2="0" y2="12" stroke="#B91C1C" strokeWidth="2" />
                    </g>
                  )}

                  {/* Draggable Corner Vertex Handles & Midpoint Split Handles on Selected Room */}
                  {isStudioMode && activeTool === 'select' && selectedRoomId === room.id && (
                    <g className="room-edge-vertex-editor">
                      {/* 1. Wall Segment Dimensions & [+] Midpoint Split Handles */}
                      {getPolygonEdges(currentPolygon).map((edge) => (
                        <g key={`edge-${edge.index}`}>
                          {/* Dimension Label Tag */}
                          <g transform={`translate(${edge.midPoint.x}, ${edge.midPoint.y})`}>
                            <rect
                              x="-22"
                              y="-8"
                              width="44"
                              height="16"
                              fill="#FFFFFF"
                              stroke="#1A3C2B"
                              strokeWidth={1 / viewport.zoom}
                              rx="2"
                              className="pointer-events-none shadow-xs"
                            />
                            <text
                              x="0"
                              y="3.5"
                              textAnchor="middle"
                              fill="#1A3C2B"
                              className="font-mono text-[9px] font-bold select-none pointer-events-none"
                            >
                              {edge.lengthMeters.toFixed(2)}m
                            </text>
                          </g>

                          {/* [+] Midpoint Wall Split Handle */}
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
                              cy="-14"
                              r={6 / viewport.zoom}
                              fill="#1A3C2B"
                              stroke="#FFFFFF"
                              strokeWidth={1.5 / viewport.zoom}
                            />
                            <text
                              x="0"
                              y="-11"
                              textAnchor="middle"
                              fill="#FFFFFF"
                              className="font-mono text-[9px] font-black select-none pointer-events-none"
                            >
                              +
                            </text>
                          </g>
                        </g>
                      ))}

                      {/* 2. Draggable Corner Vertices (Right-click to delete vertex) */}
                      {currentPolygon.map((vertex, vIdx) => (
                        <g key={`v-${vIdx}`} transform={`translate(${vertex.x}, ${vertex.y})`}>
                          {/* Large invisible hit target for effortless pointer grab */}
                          <circle
                            r={14 / viewport.zoom}
                            fill="transparent"
                            className="cursor-move"
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
                            r={6 / viewport.zoom}
                            fill="#1A3C2B"
                            stroke="#FFFFFF"
                            strokeWidth={2 / viewport.zoom}
                            className="pointer-events-none"
                          />
                        </g>
                      ))}

                      {/* 3. Central CAD Move Anchor Handle (Drag to reposition entire room) */}
                      <g
                        transform={`translate(${centroid.x}, ${centroid.y + 24})`}
                        className="cursor-move select-none"
                        onPointerDown={(e) => {
                          if (e.button === 0) {
                            e.stopPropagation();
                            const floorPt = screenToFloorCoords(e.clientX, e.clientY);
                            startRoomDrag(room.id, floorPt, currentPolygon);
                          }
                        }}
                      >
                        {/* Invisible large hit area */}
                        <rect
                          x="-44"
                          y="-14"
                          width="88"
                          height="28"
                          fill="transparent"
                        />
                        {/* Move pill button */}
                        <rect
                          x="-38"
                          y="-10"
                          width="76"
                          height="20"
                          fill="#1A3C2B"
                          stroke="#FFFFFF"
                          strokeWidth={1.5 / viewport.zoom}
                          rx="3"
                          className="shadow-sm"
                        />
                        <text
                          x="0"
                          y="3.5"
                          textAnchor="middle"
                          fill="#FFFFFF"
                          className="font-mono text-[9px] font-bold tracking-wider pointer-events-none select-none"
                        >
                          ✥ MOZGATÁS
                        </text>
                      </g>
                    </g>
                  )}
                </g>
              );
            })}

          {/* 2. WALLS LAYER */}
          {layerVisibility.walls &&
            floor.walls.map((wall) => (
              <line
                key={wall.id}
                x1={wall.start.x}
                y1={wall.start.y}
                x2={wall.end.x}
                y2={wall.end.y}
                stroke="#1A3C2B"
                strokeWidth={wall.thickness * (wall.isExterior ? 2.2 : 1.5)}
                strokeLinecap="square"
                className={activeTool === 'eraser' ? 'cursor-pointer hover:stroke-red-600' : ''}
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
            ))}

          {/* 3. DOORS LAYER */}
          {layerVisibility.doors &&
            floor.doors.map((door) => (
              <g
                key={door.id}
                className={activeTool === 'eraser' ? 'cursor-pointer hover:opacity-50' : 'pointer-events-none'}
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
                <line
                  x1={door.start.x}
                  y1={door.start.y}
                  x2={door.end.x}
                  y2={door.end.y}
                  stroke="#FFFFFF"
                  strokeWidth="5"
                />
                <line
                  x1={door.start.x}
                  y1={door.start.y}
                  x2={door.end.x}
                  y2={door.end.y}
                  stroke="#1A3C2B"
                  strokeWidth="1.5"
                  strokeDasharray="2 2"
                />
              </g>
            ))}

          {/* 4. TRANSIT CONNECTORS LAYER (Stairs, Elevators) */}
          {layerVisibility.transits &&
            floor.transitConnectors.map((transit) => {
              const isSelected = selectedTransitId === transit.id;
              const isElevator = transit.type === 'elevator';

              return (
                <g
                  key={transit.id}
                  transform={`translate(${transit.position.x - transit.width / 2}, ${
                    transit.position.y - transit.height / 2
                  })`}
                  className={`cursor-pointer ${activeTool === 'eraser' ? 'hover:opacity-50' : ''}`}
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
                  }}
                >
                  {/* Shaft Bounding Box */}
                  <rect
                    x="0"
                    y="0"
                    width={transit.width}
                    height={transit.height}
                    fill={isElevator ? '#1A3C2B' : '#FFFFFF'}
                    stroke="#1A3C2B"
                    strokeWidth={isSelected ? 3 : 2}
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
                </g>
              );
            })}

          {/* 5. POINTS OF INTEREST (POIs) LAYER */}
          {layerVisibility.pois &&
            floor.pois.map((poi) => {
              const isSelected = selectedPOIId === poi.id;
              return (
                <g
                  key={poi.id}
                  transform={`translate(${poi.position.x}, ${poi.position.y})`}
                  className={`cursor-pointer ${activeTool === 'eraser' ? 'hover:opacity-50' : ''}`}
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
                  }}
                >
                  <circle
                    r="12"
                    fill="#F7F7F5"
                    stroke="#1A3C2B"
                    strokeWidth={isSelected ? 2.5 : 1.5}
                  />
                  {/* Icon Glyphs */}
                  {poi.type.includes('restroom') ? (
                    <text x="0" y="3.5" textAnchor="middle" fill="#1A3C2B" className="font-mono text-[9px] font-bold pointer-events-none">
                      WC
                    </text>
                  ) : poi.type === 'aed' ? (
                    <text x="0" y="3.5" textAnchor="middle" fill="#B91C1C" className="font-mono text-[9px] font-bold pointer-events-none">
                      +
                    </text>
                  ) : poi.type === 'water' ? (
                    <text x="0" y="3.5" textAnchor="middle" fill="#0E7490" className="font-mono text-[9px] font-bold pointer-events-none">
                      H₂O
                    </text>
                  ) : (
                    <text x="0" y="3.5" textAnchor="middle" fill="#1A3C2B" className="font-mono text-[9px] font-bold pointer-events-none">
                      i
                    </text>
                  )}
                  <text
                    x="0"
                    y="22"
                    textAnchor="middle"
                    fill="#1A3C2B"
                    className="font-mono text-[7.5px] font-semibold uppercase tracking-wider select-none pointer-events-none"
                  >
                    {poi.name}
                  </text>
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
                return (
                  <line
                    key={edge.id}
                    x1={fromNode.position.x}
                    y1={fromNode.position.y}
                    x2={toNode.position.x}
                    y2={toNode.position.y}
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
              {floor.navNodes.map((node) => (
                <circle
                  key={node.id}
                  cx={node.position.x}
                  cy={node.position.y}
                  r="4"
                  fill="#0E7490"
                  stroke="#FFFFFF"
                  strokeWidth="1"
                  className={activeTool === 'eraser' ? 'cursor-pointer hover:fill-red-600' : ''}
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
                />
              ))}
            </g>
          )}

          {/* 7. ACTIVE WAYFINDING ROUTE PATH OVERLAY */}
          {currentFloorPathNodes.length > 1 && (
            <g className="pointer-events-none">
              {/* Path Underlay Glow */}
              <polyline
                points={currentFloorPathNodes
                  .map((n) => `${n.position.x},${n.position.y}`)
                  .join(' ')}
                fill="none"
                stroke="#1A3C2B"
                strokeWidth="7"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeOpacity="0.25"
              />

              {/* Animated Glowing Forest Green Dashed Route Line */}
              <polyline
                points={currentFloorPathNodes
                  .map((n) => `${n.position.x},${n.position.y}`)
                  .join(' ')}
                fill="none"
                stroke="#1A3C2B"
                strokeWidth="3.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="animate-route-flow"
              />

              {/* Waypoint circles along the path */}
              {currentFloorPathNodes.map((node, i) => (
                <circle
                  key={`route-pt-${i}`}
                  cx={node.position.x}
                  cy={node.position.y}
                  r="4"
                  fill="#F7F7F5"
                  stroke="#1A3C2B"
                  strokeWidth="2"
                />
              ))}

              {/* Real-time Walkthrough Simulation Avatar */}
              {simulationMarkerPos && (
                <g transform={`translate(${simulationMarkerPos.x}, ${simulationMarkerPos.y})`}>
                  <circle r="14" fill="#047857" fillOpacity="0.25" className="animate-ping-slow" />
                  <circle r="8" fill="#1A3C2B" stroke="#F7F7F5" strokeWidth="2" />
                  <circle r="3" fill="#F7F7F5" />
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

              {activeTool === 'wall' && drawingState.startPoint && drawingState.currentPoint && (
                <g>
                  <line
                    x1={drawingState.startPoint.x}
                    y1={drawingState.startPoint.y}
                    x2={drawingState.currentPoint.x}
                    y2={drawingState.currentPoint.y}
                    stroke="#1A3C2B"
                    strokeWidth="3.5"
                    strokeDasharray="4 2"
                  />
                  <g
                    transform={`translate(${
                      (drawingState.startPoint.x + drawingState.currentPoint.x) / 2
                    }, ${(drawingState.startPoint.y + drawingState.currentPoint.y) / 2})`}
                  >
                    <rect
                      x="-20"
                      y="-8"
                      width="40"
                      height="16"
                      fill="#FFFFFF"
                      stroke="#1A3C2B"
                      strokeWidth="1"
                      rx="2"
                    />
                    <text
                      x="0"
                      y="3.5"
                      textAnchor="middle"
                      fill="#1A3C2B"
                      className="font-mono text-[9px] font-bold"
                    >
                      {(distance(drawingState.startPoint, drawingState.currentPoint) / PIXELS_PER_METER).toFixed(2)}m
                    </text>
                  </g>
                </g>
              )}
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
        </g>
      </svg>
    </div>
  );
};
