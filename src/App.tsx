import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import type {
  Institution,
  Building,
  Floor,
  Room,
  Zone,
  Door,
  TransitConnector,
  PointOfInterest,
  EditorTool,
  AppMode,
  RouteResult,
  RoutePreference,
  RouteStep,
  Point,
} from './types';
import {
  loadInstitutions,
  saveInstitutions,
  resetToDefaults,
  getSavedActiveState,
  saveActiveState,
} from './utils/storage';
import {
  findMultiFloorPath,
  findMultiStopPath,
  optimizeStopOrder,
  findNearestPOIToRoom,
  findNearestTransitToRoom,
} from './utils/pathfinding';
import { useAuth } from './auth/AuthContext';
import { Header } from './components/common/Header';
import { BlueprintCanvas } from './components/blueprint/BlueprintCanvas';
import { Isometric3DView } from './components/isometric3d/Isometric3DView';
import { MobileWayfinder } from './components/mobile/MobileWayfinder';
import { WayfinderPanel } from './components/wayfinder/WayfinderPanel';
import { RoomDetailModal } from './components/wayfinder/RoomDetailModal';
import { ShareRouteModal } from './components/wayfinder/ShareRouteModal';
import { BlueprintExportModal } from './components/blueprint/BlueprintExportModal';
import { CloudSyncModal } from './components/common/CloudSyncModal';
import { UnderlayManagerModal } from './components/editor/UnderlayManagerModal';
import { AuthRequiredModal } from './components/auth/AuthRequiredModal';
import { EditorToolbar } from './components/editor/EditorToolbar';
import { RoomInspector } from './components/editor/RoomInspector';
import { ZoneInspector } from './components/editor/ZoneInspector';
import { TransitInspector } from './components/editor/TransitInspector';
import { POIInspector } from './components/editor/POIInspector';
import { DoorInspector } from './components/editor/DoorInspector';
import { FloorManagerModal } from './components/editor/FloorManagerModal';
import { CampusDirectoryModal } from './components/directory/CampusDirectoryModal';
import { FloorStackSelector } from './components/common/FloorStackSelector';
import { KioskOverlay } from './components/common/KioskOverlay';
import {
  distance,
  polygonCentroid,
  pointInPolygon,
  pointToSegmentDistance,
  hasClearLineOfSight,
} from './utils/geometry';
import {
  fetchInstitutionsFromCloud,
  saveInstitutionsToCloud,
  subscribeToCloudChanges,
  SyncStatus,
} from './services/supabase';

export function App() {
  // 1. Auth State (Keycloak)
  const { isAuthenticated, user, login, logout } = useAuth();
  const [isDemoEditor, setIsDemoEditor] = useState<boolean>(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState<boolean>(false);
  const [authModalTitle, setAuthModalTitle] = useState<string>('CAD Stúdió & Szerkesztés');

  const isEditorAllowed = isAuthenticated || isDemoEditor;

  // 2. Core Campus Dataset State
  const [institutions, setInstitutions] = useState<Institution[]>(() => loadInstitutions());

  // Parse URL search parameters for shared links
  const urlParams = useMemo(() => {
    if (typeof window === 'undefined') return new URLSearchParams();
    return new URLSearchParams(window.location.search);
  }, []);

  const paramInstId = urlParams.get('inst');
  const paramBldId = urlParams.get('bld');
  const paramStartId = urlParams.get('start');
  const paramDestId = urlParams.get('dest');
  const paramStops = urlParams.get('stops');
  const paramMode = urlParams.get('mode');

  const savedState = getSavedActiveState();
  const [activeInstId, setActiveInstId] = useState<string>(() => {
    if (paramInstId && institutions.some((i) => i.id === paramInstId)) {
      return paramInstId;
    }
    return savedState.institutionId && institutions.some((i) => i.id === savedState.institutionId)
      ? savedState.institutionId
      : institutions[0]?.id || '';
  });

  const activeInstitution = useMemo(() => {
    return institutions.find((i) => i.id === activeInstId) || institutions[0];
  }, [institutions, activeInstId]);

  const [activeBldId, setActiveBldId] = useState<string>(() => {
    if (paramBldId && activeInstitution?.buildings.some((b) => b.id === paramBldId)) {
      return paramBldId;
    }
    return activeInstitution?.buildings[0]?.id || '';
  });

  const activeBuilding = useMemo(() => {
    return (
      activeInstitution?.buildings.find((b) => b.id === activeBldId) ||
      activeInstitution?.buildings[0]
    );
  }, [activeInstitution, activeBldId]);

  const paramFloorId = urlParams.get('floor');

  const [activeFloorId, setActiveFloorId] = useState<string>(() => {
    if (paramFloorId && activeBuilding?.floors.some((f) => f.id === paramFloorId)) {
      return paramFloorId;
    }
    const checkRoomId = paramDestId || paramStartId;
    if (checkRoomId && activeBuilding) {
      for (const fl of activeBuilding.floors) {
        if (fl.rooms.some((r) => r.id === checkRoomId)) {
          return fl.id;
        }
      }
    }
    return activeBuilding?.floors[0]?.id || '';
  });

  const activeFloor = useMemo(() => {
    return activeBuilding?.floors.find((f) => f.id === activeFloorId) || activeBuilding?.floors[0];
  }, [activeBuilding, activeFloorId]);

  // Sync state changes to storage
  useEffect(() => {
    if (activeInstitution && activeBuilding && activeFloor) {
      saveActiveState(activeInstitution.id, activeBuilding.id, activeFloor.id);
    }
  }, [activeInstitution, activeBuilding, activeFloor]);

  // 3. Wayfinding & Routing State
  const [startRoomId, setStartRoomId] = useState<string | null>(paramStartId || null);
  const [targetRoomId, setTargetRoomId] = useState<string | null>(paramDestId || null);
  const [intermediateStopIds, setIntermediateStopIds] = useState<string[]>(() => {
    if (paramStops) {
      return paramStops.split(',').filter(Boolean);
    }
    return [];
  });
  const [activeRouteStep, setActiveRouteStep] = useState<RouteStep | null>(null);

  // 4. Undo / Redo History Stack & Clipboard State for CAD Studio
  const [undoStack, setUndoStack] = useState<Floor[]>([]);
  const [redoStack, setRedoStack] = useState<Floor[]>([]);
  const [clipboard, setClipboard] = useState<{
    type: 'room' | 'zone' | 'poi' | 'transit' | 'door';
    data: any;
  } | null>(null);

  // Supabase Cloud Sync State
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('synced');
  const [isCloudSyncOpen, setIsCloudSyncOpen] = useState<boolean>(false);

  // Load from Supabase Cloud on mount & listen for realtime updates
  useEffect(() => {
    fetchInstitutionsFromCloud().then((cloudData) => {
      if (cloudData && cloudData.length > 0) {
        setInstitutions(cloudData);
        saveInstitutions(cloudData);
        setSyncStatus('synced');
      }
    });

    const unsubscribe = subscribeToCloudChanges((remoteData) => {
      if (remoteData && remoteData.length > 0) {
        setInstitutions(remoteData);
        saveInstitutions(remoteData);
        setSyncStatus('synced');
      }
    });

    return () => {
      unsubscribe();
    };
  }, []);

  const cloudSyncTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Save changes to localStorage & debounced push to Supabase Cloud
  const handleUpdateInstitutions = useCallback((updated: Institution[]) => {
    setInstitutions(updated);
    saveInstitutions(updated);
    setSyncStatus('syncing');

    if (cloudSyncTimerRef.current) {
      clearTimeout(cloudSyncTimerRef.current);
    }

    cloudSyncTimerRef.current = setTimeout(() => {
      saveInstitutionsToCloud(updated).then((res) => {
        if (res.success) {
          setSyncStatus('synced');
        } else {
          setSyncStatus('error');
        }
      });
    }, 1000);
  }, []);

  // 5. Application UI Modes & Tools
  const [appMode, setAppMode] = useState<AppMode>(() => {
    if (paramMode === 'mobile') return 'mobile';
    if (paramMode === 'kiosk') return 'kiosk';
    if (paramMode === '3d') return '3d';
    return 'wayfinder';
  });
  const [activeTool, setActiveTool] = useState<EditorTool>('select');
  const [gridSnapSize, setGridSnapSize] = useState<number>(10);

  // Selected Entities
  const [selectedRoom, setSelectedRoom] = useState<Room | null>(null);
  const [selectedZone, setSelectedZone] = useState<Zone | null>(null);
  const [selectedTransit, setSelectedTransit] = useState<TransitConnector | null>(null);
  const [selectedPOI, setSelectedPOI] = useState<PointOfInterest | null>(null);
  const [selectedDoor, setSelectedDoor] = useState<Door | null>(null);
  const [isAllElementsSelected, setIsAllElementsSelected] = useState<boolean>(false);

  const [routePreferences, setRoutePreferences] = useState<RoutePreference>({
    accessibilityOnly: false,
    prioritizeElevators: false,
    fastestRoute: true,
  });

  // 6. Global Modals State
  const [isDirectoryOpen, setIsDirectoryOpen] = useState(false);
  const [isFloorManagerOpen, setIsFloorManagerOpen] = useState(false);
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [isRoomDetailOpen, setIsRoomDetailOpen] = useState(false);
  const [isUnderlayModalOpen, setIsUnderlayModalOpen] = useState(false);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);

  // 7. Simulation Walkthrough State
  const [isSimulating, setIsSimulating] = useState(false);
  const [simulationProgress, setSimulationProgress] = useState<number | null>(null);

  const handleRequireAuth = (actionTitle?: string) => {
    setAuthModalTitle(actionTitle || 'CAD Stúdió & Szerkesztés');
    setIsAuthModalOpen(true);
  };

  // Reset selection when changing floor
  const handleSelectFloor = (floorId: string) => {
    setActiveFloorId(floorId);
    setSelectedRoom(null);
    setSelectedZone(null);
    setSelectedTransit(null);
    setSelectedPOI(null);
    setSelectedDoor(null);
  };

  const handleSelectBuilding = (bldId: string) => {
    setActiveBldId(bldId);
    const bld = activeInstitution?.buildings.find((b) => b.id === bldId);
    if (bld && bld.floors[0]) {
      setActiveFloorId(bld.floors[0].id);
    }
    setSelectedRoom(null);
    setSelectedTransit(null);
    setSelectedPOI(null);
  };

  const handleSelectInstitution = (instId: string) => {
    setActiveInstId(instId);
    const inst = institutions.find((i) => i.id === instId);
    if (inst && inst.buildings[0]) {
      setActiveBldId(inst.buildings[0].id);
      if (inst.buildings[0].floors[0]) {
        setActiveFloorId(inst.buildings[0].floors[0].id);
      }
    }
    setStartRoomId(null);
    setTargetRoomId(null);
    setIntermediateStopIds([]);
    setSelectedRoom(null);
  };

  // Helper to find nav node ID, room doorway ID, zone ID, POI ID, or Transit ID for route planning
  const getNodeIdForEntity = useCallback((entityId: string, bld: Building): string => {
    for (const fl of bld.floors) {
      const z = (fl.zones || []).find((zone) => zone.id === entityId);
      if (z) return `zone-node-${z.id}`;
      const rm = fl.rooms.find((r) => r.id === entityId);
      if (rm) return `door-room-${rm.id}`;
      const p = fl.pois.find((poi) => poi.id === entityId);
      if (p) return `poi-node-${p.id}`;
      const t = fl.transitConnectors.find((tc) => tc.id === entityId);
      if (t) return `transit-node-${t.id}`;
      const d = (fl.doors || []).find((door) => door.id === entityId);
      if (d) return `door-mid-${d.id}`;
    }
    return entityId;
  }, []);

  // Compute multi-stop route with full doorway and POI routing
  const routeResult = useMemo<RouteResult | null>(() => {
    if (!activeBuilding) return null;
    const stops = [startRoomId, ...intermediateStopIds, targetRoomId].filter(Boolean) as string[];
    if (stops.length < 2) return null;

    const stopNodeIds = stops
      .map((rmId) => getNodeIdForEntity(rmId, activeBuilding))
      .filter(Boolean);

    if (stopNodeIds.length < 2) return null;

    return findMultiStopPath(activeBuilding, stopNodeIds, routePreferences);
  }, [activeBuilding, startRoomId, intermediateStopIds, targetRoomId, routePreferences, getNodeIdForEntity]);

  // Handler to optimize intermediate stops (Traveling Salesperson Problem)
  const handleOptimizeStops = useCallback(() => {
    if (!startRoomId || !targetRoomId || intermediateStopIds.length <= 1 || !activeBuilding) return;
    const startNode = getNodeIdForEntity(startRoomId, activeBuilding);
    const stopNodes = intermediateStopIds.map((id) => getNodeIdForEntity(id, activeBuilding));
    const targetNode = getNodeIdForEntity(targetRoomId, activeBuilding);

    const optStopNodes = optimizeStopOrder(
      activeBuilding,
      startNode,
      stopNodes,
      targetNode,
      routePreferences
    );

    const nodeToEntityMap = new Map<string, string>();
    for (const id of intermediateStopIds) {
      nodeToEntityMap.set(getNodeIdForEntity(id, activeBuilding), id);
      nodeToEntityMap.set(id, id);
    }

    const reorderedStops = optStopNodes.map((n) => nodeToEntityMap.get(n) || n);
    setIntermediateStopIds(reorderedStops);
  }, [startRoomId, targetRoomId, intermediateStopIds, activeBuilding, routePreferences, getNodeIdForEntity]);

  // Handler to inject closest POI (Restroom, Coffee, AED, Water)
  const handleInjectNearestPOI = useCallback((poiType: string) => {
    if (!activeBuilding) return;
    const fromId = intermediateStopIds.length > 0
      ? intermediateStopIds[intermediateStopIds.length - 1]
      : startRoomId || activeFloor?.rooms[0]?.id;

    if (!fromId) return;

    const res = findNearestPOIToRoom(activeBuilding, fromId, poiType);
    if (!res) return;

    if (!startRoomId) {
      setStartRoomId(res.poi.id);
      setActiveFloorId(res.floor.id);
    } else if (!targetRoomId) {
      setTargetRoomId(res.poi.id);
    } else {
      setIntermediateStopIds((prev) => [...prev, res.poi.id]);
    }
  }, [intermediateStopIds, startRoomId, targetRoomId, activeBuilding, activeFloor]);

  // Handler to inject closest Transit connector (Stairs or Elevator)
  const handleInjectNearestTransit = useCallback((transitType: 'stairs' | 'elevator') => {
    if (!activeBuilding) return;
    const fromId = intermediateStopIds.length > 0
      ? intermediateStopIds[intermediateStopIds.length - 1]
      : startRoomId || activeFloor?.rooms[0]?.id;

    if (!fromId) return;

    const res = findNearestTransitToRoom(activeBuilding, fromId, transitType);
    if (!res) return;

    if (!startRoomId) {
      setStartRoomId(res.transit.id);
      setActiveFloorId(res.floor.id);
    } else if (!targetRoomId) {
      setTargetRoomId(res.transit.id);
    } else {
      setIntermediateStopIds((prev) => [...prev, res.transit.id]);
    }
  }, [intermediateStopIds, startRoomId, targetRoomId, activeBuilding, activeFloor]);

  const handleAddIntermediateStop = useCallback((id: string) => {
    setIntermediateStopIds((prev) => [...prev, id]);
  }, []);

  // Auto-switch floor when selecting start or destination
  useEffect(() => {
    if (targetRoomId && activeBuilding) {
      for (const fl of activeBuilding.floors) {
        if (
          fl.rooms.some((r) => r.id === targetRoomId) ||
          fl.pois.some((p) => p.id === targetRoomId) ||
          fl.transitConnectors.some((t) => t.id === targetRoomId)
        ) {
          if (!startRoomId) {
            setActiveFloorId(fl.id);
          }
          break;
        }
      }
    }
  }, [targetRoomId, activeBuilding, startRoomId]);

  // Handle Simulation Animation Loop
  useEffect(() => {
    let animationFrameId: number;
    let lastTime = performance.now();

    if (isSimulating && routeResult && routeResult.pathNodes.length > 1) {
      const animate = (time: number) => {
        const delta = (time - lastTime) / 1000;
        lastTime = time;

        setSimulationProgress((prev) => {
          const current = prev === null ? 0 : prev;
          const next = current + delta / 12;

          if (next >= 1) {
            setIsSimulating(false);
            return 1;
          }

          const nodeIndex = Math.min(
            routeResult.pathNodes.length - 1,
            Math.floor(next * routeResult.pathNodes.length)
          );
          const activePathNode = routeResult.pathNodes[nodeIndex];
          if (activePathNode && activePathNode.floorId !== activeFloorId) {
            setActiveFloorId(activePathNode.floorId);
          }

          return next;
        });

        animationFrameId = requestAnimationFrame(animate);
      };

      animationFrameId = requestAnimationFrame(animate);
    }

    return () => {
      if (animationFrameId) cancelAnimationFrame(animationFrameId);
    };
  }, [isSimulating, routeResult, activeFloorId]);

  // Update Floor Handler with Undo / Redo tracking
  const handleUpdateFloor = (updatedFloor: Floor) => {
    if (!activeInstitution || !activeBuilding || !activeFloor) return;

    if (!isEditorAllowed) {
      handleRequireAuth('Alaprajz módosítások mentése');
      return;
    }

    // Push current floor snapshot to undo stack
    setUndoStack((prev) => [...prev.slice(-30), activeFloor]);
    setRedoStack([]); // Clear redo on new action

    const updatedInstitutions = institutions.map((inst) => {
      if (inst.id === activeInstitution.id) {
        return {
          ...inst,
          buildings: inst.buildings.map((bld) => {
            if (bld.id === activeBuilding.id) {
              return {
                ...bld,
                floors: bld.floors.map((f) => (f.id === updatedFloor.id ? updatedFloor : f)),
              };
            }
            return bld;
          }),
        };
      }
      return inst;
    });

    handleUpdateInstitutions(updatedInstitutions);
  };

  // Undo / Redo Handlers
  const handleUndo = () => {
    if (undoStack.length === 0 || !activeFloor) return;
    const previousFloor = undoStack[undoStack.length - 1];
    setUndoStack((prev) => prev.slice(0, -1));
    setRedoStack((prev) => [...prev, activeFloor]);

    const updatedInstitutions = institutions.map((inst) => {
      if (inst.id === activeInstitution.id) {
        return {
          ...inst,
          buildings: inst.buildings.map((bld) => {
            if (bld.id === activeBuilding.id) {
              return {
                ...bld,
                floors: bld.floors.map((f) => (f.id === previousFloor.id ? previousFloor : f)),
              };
            }
            return bld;
          }),
        };
      }
      return inst;
    });
    handleUpdateInstitutions(updatedInstitutions);
  };

  const handleRedo = () => {
    if (redoStack.length === 0 || !activeFloor) return;
    const nextFloor = redoStack[redoStack.length - 1];
    setRedoStack((prev) => prev.slice(0, -1));
    setUndoStack((prev) => [...prev, activeFloor]);

    const updatedInstitutions = institutions.map((inst) => {
      if (inst.id === activeInstitution.id) {
        return {
          ...inst,
          buildings: inst.buildings.map((bld) => {
            if (bld.id === activeBuilding.id) {
              return {
                ...bld,
                floors: bld.floors.map((f) => (f.id === nextFloor.id ? nextFloor : f)),
              };
            }
            return bld;
          }),
        };
      }
      return inst;
    });
    handleUpdateInstitutions(updatedInstitutions);
  };

  // Duplicate Room Handler
  const handleDuplicateRoom = useCallback((roomToDuplicate: Room) => {
    if (!activeFloor) return;

    if (!isEditorAllowed) {
      handleRequireAuth('Helyiség másolása');
      return;
    }

    const offset = { x: 30, y: 30 };
    const newPolygon = roomToDuplicate.polygon.map((p) => ({
      x: p.x + offset.x,
      y: p.y + offset.y,
    }));
    const newDoorLocation = roomToDuplicate.doorLocation
      ? {
          x: roomToDuplicate.doorLocation.x + offset.x,
          y: roomToDuplicate.doorLocation.y + offset.y,
        }
      : undefined;

    const timestamp = Date.now();
    const newRoomId = `room-${timestamp}`;
    const newNavNodeId = `node-room-${timestamp}`;

    // Auto-increment code if possible (e.g. I-101 -> I-102)
    const codeMatch = roomToDuplicate.code.match(/^(.+?)(\d+)$/);
    let nextCode = `${roomToDuplicate.code} (Másolat)`;
    if (codeMatch) {
      const prefix = codeMatch[1];
      const numStr = codeMatch[2];
      const nextNum = parseInt(numStr, 10) + 1;
      const candidateCode = `${prefix}${String(nextNum).padStart(numStr.length, '0')}`;
      const codeExists = activeFloor.rooms.some((r) => r.code === candidateCode);
      if (!codeExists) {
        nextCode = candidateCode;
      }
    }

    const duplicatedRoom: Room = {
      ...roomToDuplicate,
      id: newRoomId,
      code: nextCode,
      name: `${roomToDuplicate.name} (Másolat)`,
      polygon: newPolygon,
      doorLocation: newDoorLocation,
      navNodeId: newNavNodeId,
    };

    handleUpdateFloor({
      ...activeFloor,
      rooms: [...activeFloor.rooms, duplicatedRoom],
    });
    setSelectedRoom(duplicatedRoom);
    setSelectedZone(null);
    setSelectedTransit(null);
    setSelectedPOI(null);
    setSelectedDoor(null);
  }, [activeFloor, isEditorAllowed]);

  // Duplicate Zone Handler
  const handleDuplicateZone = useCallback((zoneToDuplicate: Zone) => {
    if (!activeFloor) return;

    if (!isEditorAllowed) {
      handleRequireAuth('Zóna duplikálása');
      return;
    }

    const offset = { x: 30, y: 30 };
    const newPolygon = zoneToDuplicate.polygon.map((p) => ({
      x: p.x + offset.x,
      y: p.y + offset.y,
    }));

    const timestamp = Date.now();
    const newZoneId = `zone-${timestamp}`;
    const zoneCount = (activeFloor.zones || []).length + 1;

    const duplicatedZone: Zone = {
      ...zoneToDuplicate,
      id: newZoneId,
      code: `Z-${String(zoneCount).padStart(2, '0')}`,
      name: `${zoneToDuplicate.name} (Másolat)`,
      polygon: newPolygon,
    };

    handleUpdateFloor({
      ...activeFloor,
      zones: [...(activeFloor.zones || []), duplicatedZone],
    });
    setSelectedZone(duplicatedZone);
    setSelectedRoom(null);
    setSelectedTransit(null);
    setSelectedPOI(null);
    setSelectedDoor(null);
  }, [activeFloor, isEditorAllowed]);

  // Duplicate POI Handler
  const handleDuplicatePOI = useCallback((poiToDuplicate: PointOfInterest) => {
    if (!activeFloor) return;
    const offset = { x: 30, y: 30 };
    const timestamp = Date.now();
    const newPoi: PointOfInterest = {
      ...poiToDuplicate,
      id: `poi-${timestamp}`,
      position: {
        x: poiToDuplicate.position.x + offset.x,
        y: poiToDuplicate.position.y + offset.y,
      },
      name: poiToDuplicate.name ? `${poiToDuplicate.name} (Másolat)` : 'POI (Másolat)',
    };
    handleUpdateFloor({
      ...activeFloor,
      pois: [...activeFloor.pois, newPoi],
    });
    setSelectedPOI(newPoi);
    setSelectedRoom(null);
    setSelectedZone(null);
    setSelectedTransit(null);
    setSelectedDoor(null);
  }, [activeFloor]);

  // Duplicate Transit Handler
  const handleDuplicateTransit = useCallback((transitToDuplicate: TransitConnector) => {
    if (!activeFloor) return;
    const offset = { x: 30, y: 30 };
    const timestamp = Date.now();
    const newTransit: TransitConnector = {
      ...transitToDuplicate,
      id: `transit-${timestamp}`,
      position: {
        x: transitToDuplicate.position.x + offset.x,
        y: transitToDuplicate.position.y + offset.y,
      },
    };
    handleUpdateFloor({
      ...activeFloor,
      transitConnectors: [...activeFloor.transitConnectors, newTransit],
    });
    setSelectedTransit(newTransit);
    setSelectedRoom(null);
    setSelectedZone(null);
    setSelectedPOI(null);
    setSelectedDoor(null);
  }, [activeFloor]);

  // Duplicate Door Handler
  const handleDuplicateDoor = useCallback((doorToDuplicate: Door) => {
    if (!activeFloor) return;
    const offset = { x: 30, y: 30 };
    const timestamp = Date.now();
    const newDoor: Door = {
      ...doorToDuplicate,
      id: `door-${timestamp}`,
      start: { x: doorToDuplicate.start.x + offset.x, y: doorToDuplicate.start.y + offset.y },
      end: { x: doorToDuplicate.end.x + offset.x, y: doorToDuplicate.end.y + offset.y },
    };
    handleUpdateFloor({
      ...activeFloor,
      doors: [...activeFloor.doors, newDoor],
    });
    setSelectedDoor(newDoor);
    setSelectedRoom(null);
    setSelectedZone(null);
    setSelectedTransit(null);
    setSelectedPOI(null);
  }, [activeFloor]);

  // Paste Handler for Ctrl+V
  const handlePaste = useCallback(() => {
    if (!clipboard || !activeFloor) return;
    if (clipboard.type === 'room') handleDuplicateRoom(clipboard.data);
    else if (clipboard.type === 'zone') handleDuplicateZone(clipboard.data);
    else if (clipboard.type === 'poi') handleDuplicatePOI(clipboard.data);
    else if (clipboard.type === 'transit') handleDuplicateTransit(clipboard.data);
    else if (clipboard.type === 'door') handleDuplicateDoor(clipboard.data);
  }, [clipboard, activeFloor, handleDuplicateRoom, handleDuplicateZone, handleDuplicatePOI, handleDuplicateTransit, handleDuplicateDoor]);

  // Keyboard shortcut listener (Ctrl+Z, Ctrl+Y, Ctrl+D, Ctrl+C, Ctrl+V, etc.)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const isInput = target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable);

      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z') {
        if (e.shiftKey) {
          e.preventDefault();
          handleRedo();
        } else {
          e.preventDefault();
          handleUndo();
        }
      } else if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        handleRedo();
      } else if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsDirectoryOpen((prev) => !prev);
      } else if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'd') {
        if (appMode === 'studio' && !isInput) {
          e.preventDefault();
          if (selectedRoom) handleDuplicateRoom(selectedRoom);
          else if (selectedZone) handleDuplicateZone(selectedZone);
          else if (selectedPOI) handleDuplicatePOI(selectedPOI);
          else if (selectedTransit) handleDuplicateTransit(selectedTransit);
          else if (selectedDoor) handleDuplicateDoor(selectedDoor);
        }
      } else if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'c') {
        if (appMode === 'studio' && !isInput) {
          if (selectedRoom) {
            e.preventDefault();
            setClipboard({ type: 'room', data: selectedRoom });
          } else if (selectedZone) {
            e.preventDefault();
            setClipboard({ type: 'zone', data: selectedZone });
          } else if (selectedPOI) {
            e.preventDefault();
            setClipboard({ type: 'poi', data: selectedPOI });
          } else if (selectedTransit) {
            e.preventDefault();
            setClipboard({ type: 'transit', data: selectedTransit });
          } else if (selectedDoor) {
            e.preventDefault();
            setClipboard({ type: 'door', data: selectedDoor });
          }
        }
      } else if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'v') {
        if (appMode === 'studio' && !isInput && clipboard) {
          e.preventDefault();
          handlePaste();
        }
      } else if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'a') {
        if (appMode === 'studio' && !isInput) {
          e.preventDefault();
          setIsAllElementsSelected(true);
          setSelectedRoom(null);
          setSelectedZone(null);
          setSelectedTransit(null);
          setSelectedPOI(null);
          setSelectedDoor(null);
        }
      } else if (e.key === 'Escape') {
        setIsAllElementsSelected(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    undoStack,
    redoStack,
    activeFloor,
    selectedRoom,
    selectedZone,
    selectedPOI,
    selectedTransit,
    selectedDoor,
    clipboard,
    appMode,
    handleDuplicateRoom,
    handleDuplicateZone,
    handleDuplicatePOI,
    handleDuplicateTransit,
    handleDuplicateDoor,
    handlePaste,
  ]);


  // Smart NavMesh Generator for current floor
  const handleAutoGenerateNavMesh = () => {
    if (!activeFloor) return;

    if (!isEditorAllowed) {
      handleRequireAuth('Navigációs Háló Újragenerálása');
      return;
    }

    const rooms = activeFloor.rooms || [];
    const walls = activeFloor.walls || [];
    const doors = activeFloor.doors || [];
    const transits = activeFloor.transitConnectors || [];
    const pois = activeFloor.pois || [];

    const newNodes: Floor['navNodes'] = [];
    const newEdges: Floor['navEdges'] = [];

    // 1. Synthesize Door Nodes
    doors.forEach((door) => {
      const dMid: Point = {
        x: Math.round((door.start.x + door.end.x) / 2),
        y: Math.round((door.start.y + door.end.y) / 2),
      };
      newNodes.push({
        id: `node-door-${door.id}`,
        floorId: activeFloor.id,
        position: dMid,
        type: 'door',
        refId: door.id,
        label: 'Ajtó átjáró',
      });
    });

    // 2. Room Doorway Nodes
    rooms.forEach((room) => {
      let doorPt = room.doorLocation;
      if (!doorPt && room.polygon.length >= 2) {
        doorPt = {
          x: Math.round((room.polygon[0].x + room.polygon[1].x) / 2),
          y: Math.round((room.polygon[0].y + room.polygon[1].y) / 2),
        };
      }
      if (!doorPt) {
        doorPt = polygonCentroid(room.polygon);
      }

      const roomNodeId = room.navNodeId || `node-room-${room.id}`;
      newNodes.push({
        id: roomNodeId,
        floorId: activeFloor.id,
        position: doorPt,
        type: 'door',
        refId: room.id,
        label: `${room.code} Bejárat`,
      });
    });

    // 3. Transit Nodes
    transits.forEach((transit) => {
      newNodes.push({
        id: transit.navNodeId || `node-transit-${transit.id}`,
        floorId: activeFloor.id,
        position: { ...transit.position },
        type: 'transit',
        refId: transit.id,
        label: transit.name,
      });
    });

    // 4. POI Nodes
    pois.forEach((poi) => {
      newNodes.push({
        id: poi.navNodeId || `node-poi-${poi.id}`,
        floorId: activeFloor.id,
        position: { ...poi.position },
        type: 'poi',
        refId: poi.id,
        label: poi.name,
      });
    });

    // 5. Open Space Corridor Hubs
    const stepX = 140;
    const stepY = 140;
    for (let x = 100; x < activeFloor.width - 50; x += stepX) {
      for (let y = 100; y < activeFloor.height - 50; y += stepY) {
        const pt = { x, y };
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
          if (pointToSegmentDistance(pt, w.start, w.end) < 22) {
            isNearWall = true;
            break;
          }
        }
        if (isNearWall) continue;

        newNodes.push({
          id: `node-corridor-${x}-${y}`,
          floorId: activeFloor.id,
          position: pt,
          type: 'hub',
          label: 'Folyosói Csomópont',
        });
      }
    }

    // 6. Connect Nodes with Clear Line of Sight
    let edgeCounter = 1;
    for (let i = 0; i < newNodes.length; i++) {
      const nA = newNodes[i];
      for (let j = i + 1; j < newNodes.length; j++) {
        const nB = newNodes[j];
        const d = distance(nA.position, nB.position);
        const maxDist = nA.type === 'door' || nB.type === 'door' || nA.type === 'transit' || nB.type === 'transit' ? 320 : 220;

        if (d <= maxDist) {
          if (hasClearLineOfSight(nA.position, nB.position, rooms, [], walls, doors)) {
            newEdges.push({
              id: `edge-auto-${edgeCounter++}`,
              fromNodeId: nA.id,
              toNodeId: nB.id,
              floorId: activeFloor.id,
              distance: Math.round(d),
              isAccessible: true,
            });
          }
        }
      }
    }

    handleUpdateFloor({
      ...activeFloor,
      navNodes: newNodes,
      navEdges: newEdges,
    });
  };

  if (!activeInstitution || !activeBuilding || !activeFloor) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-[#F7F7F5] font-mono text-sm">
        Campus alaprajzi adatok inicializálása...
      </div>
    );
  }

  // 8. Dedicated Ultra-Clean Mobile Wayfinder Screen
  if (appMode === 'mobile') {
    return (
      <MobileWayfinder
        building={activeBuilding}
        activeFloorId={activeFloor.id}
        startRoomId={startRoomId}
        targetRoomId={targetRoomId}
        routeResult={routeResult}
        onSelectFloor={handleSelectFloor}
        onExitMobileView={() => setAppMode('wayfinder')}
      />
    );
  }

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-[#F7F7F5] text-[#1A3C2B] font-sans antialiased">
      {/* 1. Header Navigation Bar */}
      <Header
        institutions={institutions}
        activeInstitution={activeInstitution}
        activeBuilding={activeBuilding}
        activeFloor={activeFloor}
        appMode={appMode}
        isAuthenticated={isEditorAllowed}
        user={user}
        syncStatus={syncStatus}
        onLogin={() => login()}
        onLogout={() => {
          setIsDemoEditor(false);
          logout();
        }}
        onRequireAuth={handleRequireAuth}
        onSelectInstitution={handleSelectInstitution}
        onSelectBuilding={handleSelectBuilding}
        onSelectFloor={handleSelectFloor}
        onSetAppMode={setAppMode}
        onOpenDirectory={() => setIsDirectoryOpen(true)}
        onOpenFloorManager={() => setIsFloorManagerOpen(true)}
        onOpenExportModal={() => setIsExportModalOpen(true)}
        onOpenCloudModal={() => setIsCloudSyncOpen(true)}
        onResetData={() => {
          const fresh = resetToDefaults();
          setInstitutions(fresh);
          setActiveInstId(fresh[0].id);
          setActiveBldId(fresh[0].buildings[0].id);
          setActiveFloorId(fresh[0].buildings[0].floors[0].id);
        }}
        onDataImported={(data) => {
          setInstitutions(data);
          setActiveInstId(data[0].id);
          setActiveBldId(data[0].buildings[0].id);
          setActiveFloorId(data[0].buildings[0].floors[0].id);
        }}
      />

      {/* 2. Main Workspace Layout */}
      <main className="flex-1 flex flex-row overflow-hidden relative">
        {/* Left Sidebar: CAD Toolbar (Studio Mode) or Elevation Stack (Wayfinder Mode) */}
        {appMode === 'studio' ? (
          <aside className="w-56 flex-shrink-0 flex flex-col gap-2 p-2 border-r border-[#1A3C2B] bg-[#F7F7F5] overflow-y-auto z-10">
            <EditorToolbar
              activeTool={activeTool}
              onSelectTool={setActiveTool}
              gridSnapSize={gridSnapSize}
              onSetGridSnapSize={setGridSnapSize}
              onAutoGenerateNavMesh={handleAutoGenerateNavMesh}
              onClearFloor={() => {
                if (confirm('Törli az összes falat, helyiséget és útpontot erről a szintről?')) {
                  handleUpdateFloor({
                    ...activeFloor,
                    rooms: [],
                    walls: [],
                    doors: [],
                    transitConnectors: [],
                    pois: [],
                    navNodes: [],
                    navEdges: [],
                  });
                }
              }}
              onUndo={handleUndo}
              onRedo={handleRedo}
              canUndo={undoStack.length > 0}
              canRedo={redoStack.length > 0}
              onOpenUnderlayModal={() => setIsUnderlayModalOpen(true)}
              hasUnderlay={!!activeFloor.underlay?.url}
              isAllElementsSelected={isAllElementsSelected}
              onSelectAllElements={() => {
                setIsAllElementsSelected((prev) => !prev);
                setSelectedRoom(null);
                setSelectedZone(null);
                setSelectedTransit(null);
                setSelectedPOI(null);
              }}
            />

            {/* Inspector Panels */}
            {selectedRoom && (
              <RoomInspector
                room={activeFloor.rooms.find((r) => r.id === selectedRoom.id) || selectedRoom}
                onUpdate={(updated) => {
                  handleUpdateFloor({
                    ...activeFloor,
                    rooms: activeFloor.rooms.map((r) => (r.id === updated.id ? updated : r)),
                  });
                  setSelectedRoom(updated);
                }}
                onDelete={(roomId) => {
                  handleUpdateFloor({
                    ...activeFloor,
                    rooms: activeFloor.rooms.filter((r) => r.id !== roomId),
                  });
                  setSelectedRoom(null);
                }}
                onDuplicate={handleDuplicateRoom}
                onClose={() => setSelectedRoom(null)}
              />
            )}

            {selectedZone && (
              <ZoneInspector
                zone={(activeFloor.zones || []).find((z) => z.id === selectedZone.id) || selectedZone}
                onUpdate={(updated) => {
                  handleUpdateFloor({
                    ...activeFloor,
                    zones: (activeFloor.zones || []).map((z) => (z.id === updated.id ? updated : z)),
                  });
                  setSelectedZone(updated);
                }}
                onDelete={(zoneId) => {
                  handleUpdateFloor({
                    ...activeFloor,
                    zones: (activeFloor.zones || []).filter((z) => z.id !== zoneId),
                  });
                  setSelectedZone(null);
                }}
                onDuplicate={handleDuplicateZone}
                onClose={() => setSelectedZone(null)}
              />
            )}

            {selectedTransit && (
              <TransitInspector
                transit={selectedTransit}
                allFloors={activeBuilding.floors}
                onUpdate={(updated) => {
                  handleUpdateFloor({
                    ...activeFloor,
                    transitConnectors: activeFloor.transitConnectors.map((t) =>
                      t.id === updated.id ? updated : t
                    ),
                  });
                  setSelectedTransit(updated);
                }}
                onDelete={(transitId) => {
                  handleUpdateFloor({
                    ...activeFloor,
                    transitConnectors: activeFloor.transitConnectors.filter((t) => t.id !== transitId),
                  });
                  setSelectedTransit(null);
                }}
                onClose={() => setSelectedTransit(null)}
              />
            )}

            {selectedPOI && (
              <POIInspector
                poi={selectedPOI}
                onUpdate={(updated) => {
                  handleUpdateFloor({
                    ...activeFloor,
                    pois: activeFloor.pois.map((p) =>
                      p.id === updated.id ? updated : p
                    ),
                  });
                  setSelectedPOI(updated);
                }}
                onDelete={(poiId) => {
                  handleUpdateFloor({
                    ...activeFloor,
                    pois: activeFloor.pois.filter((p) => p.id !== poiId),
                  });
                  setSelectedPOI(null);
                }}
                onClose={() => setSelectedPOI(null)}
              />
            )}

            {selectedDoor && (
              <DoorInspector
                door={selectedDoor}
                onUpdate={(updated) => {
                  handleUpdateFloor({
                    ...activeFloor,
                    doors: activeFloor.doors.map((d) =>
                      d.id === updated.id ? updated : d
                    ),
                  });
                  setSelectedDoor(updated);
                }}
                onDelete={(doorId) => {
                  handleUpdateFloor({
                    ...activeFloor,
                    doors: activeFloor.doors.filter((d) => d.id !== doorId),
                  });
                  setSelectedDoor(null);
                }}
                onClose={() => setSelectedDoor(null)}
              />
            )}
          </aside>
        ) : appMode === 'wayfinder' ? (
          /* Wayfinder Mode Left Sidebar: Floor Elevation Stack */
          <aside className="hidden lg:flex w-48 flex-shrink-0 flex-col p-2 border-r border-[#1A3C2B] bg-[#F7F7F5] overflow-y-auto z-10">
            <FloorStackSelector
              building={activeBuilding}
              activeFloorId={activeFloor.id}
              routeResult={routeResult}
              onSelectFloor={handleSelectFloor}
            />
          </aside>
        ) : null}

        {/* Center: Interactive Blueprint Canvas or 3D Isometric View */}
        <section className="flex-1 relative overflow-hidden bg-[#F7F7F5]">
          {appMode === '3d' ? (
            <Isometric3DView
              building={activeBuilding}
              activeFloorId={activeFloor.id}
              routeResult={routeResult}
              onSelectFloor={handleSelectFloor}
              onNavigateTo2DEditor={(floorId) => {
                setActiveFloorId(floorId);
                if (!isEditorAllowed) {
                  handleRequireAuth('2D CAD Szerkesztő Megnyitása');
                } else {
                  setAppMode('studio');
                }
              }}
              onSetStartRoom={(roomId) => setStartRoomId(roomId)}
              onSetTargetRoom={(roomId) => setTargetRoomId(roomId)}
            />
          ) : (
            <BlueprintCanvas
              floor={activeFloor}
              activeTool={activeTool}
              isStudioMode={appMode === 'studio'}
              isAllElementsSelected={isAllElementsSelected}
              onToggleSelectAll={setIsAllElementsSelected}
              selectedRoomId={selectedRoom?.id}
              selectedZoneId={selectedZone?.id}
              selectedTransitId={selectedTransit?.id}
              selectedPOIId={selectedPOI?.id}
              selectedDoorId={selectedDoor?.id}
              startRoomId={startRoomId}
              targetRoomId={targetRoomId}
              intermediateStopIds={intermediateStopIds}
              routeResult={routeResult}
              activeSimulationProgress={simulationProgress}
              activeStep={activeRouteStep}
              gridSnapSize={gridSnapSize}
              onSelectRoom={(room) => {
                setSelectedRoom(room);
                if (room) {
                  setSelectedZone(null);
                  setSelectedTransit(null);
                  setSelectedPOI(null);
                  setSelectedDoor(null);
                }
                if (room && (appMode === 'wayfinder' || appMode === 'kiosk')) {
                  setIsRoomDetailOpen(true);
                } else {
                  setIsRoomDetailOpen(false);
                }
              }}
              onSelectZone={(zone) => {
                setSelectedZone(zone);
                if (zone) {
                  setSelectedRoom(null);
                  setSelectedTransit(null);
                  setSelectedPOI(null);
                  setSelectedDoor(null);
                }
              }}
              onSelectTransit={(transit) => {
                setSelectedTransit(transit);
                if (transit) {
                  setSelectedRoom(null);
                  setSelectedZone(null);
                  setSelectedPOI(null);
                  setSelectedDoor(null);
                }
              }}
              onSelectPOI={(poi) => {
                setSelectedPOI(poi);
                if (poi) {
                  setSelectedRoom(null);
                  setSelectedZone(null);
                  setSelectedTransit(null);
                  setSelectedDoor(null);
                }
              }}
              onSelectDoor={(door) => {
                setSelectedDoor(door);
                if (door) {
                  setSelectedRoom(null);
                  setSelectedZone(null);
                  setSelectedTransit(null);
                  setSelectedPOI(null);
                }
              }}
              onSetAsStartRoom={(roomId) => setStartRoomId(roomId)}
              onSetAsTargetRoom={(roomId) => setTargetRoomId(roomId)}
              onAddIntermediateStop={handleAddIntermediateStop}
              onDuplicateRoom={handleDuplicateRoom}
              onDuplicateZone={handleDuplicateZone}
              onUpdateFloor={handleUpdateFloor}
            />
          )}
        </section>

        {/* Right Sidebar: Wayfinder Route Planner & Turn-by-Turn Guidance */}
        {appMode === 'wayfinder' && (
          <aside className="w-80 md:w-96 flex-shrink-0 border-l border-[#1A3C2B] bg-[#F7F7F5] z-10">
            <WayfinderPanel
              building={activeBuilding}
              currentFloor={activeFloor}
              startRoomId={startRoomId}
              targetRoomId={targetRoomId}
              intermediateStopIds={intermediateStopIds}
              routeResult={routeResult}
              routePreferences={routePreferences}
              activeSimulationProgress={simulationProgress}
              isSimulating={isSimulating}
              onSetStartRoom={setStartRoomId}
              onSetTargetRoom={setTargetRoomId}
              onSetIntermediateStops={setIntermediateStopIds}
              onOptimizeStops={handleOptimizeStops}
              onSetPreferences={setRoutePreferences}
              onStepClick={(step: RouteStep) => {
                setActiveRouteStep(step);
                if (step.floorId !== activeFloor.id) {
                  setActiveFloorId(step.floorId);
                }
              }}
              onStartSimulation={() => setIsSimulating(true)}
              onPauseSimulation={() => setIsSimulating(false)}
              onResetSimulation={() => {
                setIsSimulating(false);
                setSimulationProgress(0);
              }}
              onOpenShareModal={() => setIsShareModalOpen(true)}
              onInjectNearestPOI={handleInjectNearestPOI}
              onInjectNearestTransit={handleInjectNearestTransit}
            />
          </aside>
        )}

        {/* Kiosk Mode Overlay */}
        {appMode === 'kiosk' && (
          <KioskOverlay
            building={activeBuilding}
            floor={activeFloor}
            onExitKiosk={() => setAppMode('wayfinder')}
            onOpenDirectory={() => setIsDirectoryOpen(true)}
            onQuickSelectTarget={(roomId) => {
              setTargetRoomId(roomId);
              setIsRoomDetailOpen(true);
            }}
          />
        )}
      </main>

      {/* 3. Global Interactive Modals */}
      <CampusDirectoryModal
        isOpen={isDirectoryOpen}
        onClose={() => setIsDirectoryOpen(false)}
        institutions={institutions}
        activeInstitutionId={activeInstitution.id}
        activeBuildingId={activeBuilding.id}
        onNavigateToRoom={(instId, bldId, floorId, roomId) => {
          setActiveInstId(instId);
          setActiveBldId(bldId);
          setActiveFloorId(floorId);
          setTargetRoomId(roomId);
        }}
        onSetStartRoom={(roomId) => setStartRoomId(roomId)}
      />

      <FloorManagerModal
        isOpen={isFloorManagerOpen}
        onClose={() => setIsFloorManagerOpen(false)}
        institutions={institutions}
        activeInstitutionId={activeInstitution.id}
        activeBuildingId={activeBuilding.id}
        activeFloorId={activeFloor.id}
        onSelectInstitution={handleSelectInstitution}
        onSelectBuilding={handleSelectBuilding}
        onSelectFloor={handleSelectFloor}
        onUpdateInstitutions={handleUpdateInstitutions}
      />

      <RoomDetailModal
        isOpen={isRoomDetailOpen && appMode !== 'studio'}
        room={selectedRoom}
        floor={activeFloor}
        building={activeBuilding}
        onClose={() => {
          setIsRoomDetailOpen(false);
        }}
        onSetAsStart={(roomId) => setStartRoomId(roomId)}
        onSetAsDestination={(roomId) => setTargetRoomId(roomId)}
      />

      <ShareRouteModal
        isOpen={isShareModalOpen}
        onClose={() => setIsShareModalOpen(false)}
        building={activeBuilding}
        startRoomId={startRoomId}
        targetRoomId={targetRoomId}
        intermediateStopIds={intermediateStopIds}
        routeResult={routeResult}
        onOpenMobileView={() => setAppMode('mobile')}
      />

      <UnderlayManagerModal
        isOpen={isUnderlayModalOpen}
        onClose={() => setIsUnderlayModalOpen(false)}
        floor={activeFloor}
        onUpdateFloor={handleUpdateFloor}
      />

      <BlueprintExportModal
        isOpen={isExportModalOpen}
        onClose={() => setIsExportModalOpen(false)}
        institution={activeInstitution}
        building={activeBuilding}
        floor={activeFloor}
        routeResult={routeResult}
      />

      <AuthRequiredModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
        actionTitle={authModalTitle}
        onLogin={() => {
          setIsAuthModalOpen(false);
          login();
        }}
        onBypassDemo={() => {
          setIsDemoEditor(true);
          setIsAuthModalOpen(false);
        }}
      />

      <CloudSyncModal
        isOpen={isCloudSyncOpen}
        onClose={() => setIsCloudSyncOpen(false)}
        institutions={institutions}
        syncStatus={syncStatus}
        onUpdateInstitutions={handleUpdateInstitutions}
        onSetSyncStatus={setSyncStatus}
      />
    </div>
  );
}

export default App;
