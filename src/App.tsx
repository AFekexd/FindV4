import React, { useState, useEffect, useMemo, useCallback } from 'react';
import type {
  Institution,
  Building,
  Floor,
  Room,
  TransitConnector,
  PointOfInterest,
  EditorTool,
  AppMode,
  RouteResult,
  RoutePreference,
  RouteStep,
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
  findNearestPOIToRoom,
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
import { TransitInspector } from './components/editor/TransitInspector';
import { FloorManagerModal } from './components/editor/FloorManagerModal';
import { CampusDirectoryModal } from './components/directory/CampusDirectoryModal';
import { FloorStackSelector } from './components/common/FloorStackSelector';
import { KioskOverlay } from './components/common/KioskOverlay';
import { distance } from './utils/geometry';
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

  // 4. Undo / Redo History Stack for CAD Studio
  const [undoStack, setUndoStack] = useState<Floor[]>([]);
  const [redoStack, setRedoStack] = useState<Floor[]>([]);

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

  // Save changes to localStorage & push to Supabase Cloud
  const handleUpdateInstitutions = (updated: Institution[]) => {
    setInstitutions(updated);
    saveInstitutions(updated);
    setSyncStatus('syncing');

    // Async push to Supabase Cloud
    saveInstitutionsToCloud(updated).then((res) => {
      if (res.success) {
        setSyncStatus('synced');
      } else {
        setSyncStatus('error');
      }
    });
  };

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
  const [selectedTransit, setSelectedTransit] = useState<TransitConnector | null>(null);
  const [selectedPOI, setSelectedPOI] = useState<PointOfInterest | null>(null);

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
    setSelectedTransit(null);
    setSelectedPOI(null);
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

  // Helper to find nav node ID or room ID for route planning
  const getNavNodeIdForRoom = useCallback((roomId: string, bld: Building): string | null => {
    for (const fl of bld.floors) {
      const rm = fl.rooms.find((r) => r.id === roomId);
      if (rm) {
        return `room-node-${rm.id}`;
      }
    }
    return roomId;
  }, []);

  // Compute multi-stop route with full doorway routing
  const routeResult = useMemo<RouteResult | null>(() => {
    if (!activeBuilding) return null;
    const stops = [startRoomId, ...intermediateStopIds, targetRoomId].filter(Boolean) as string[];
    if (stops.length < 2) return null;

    const stopNodeIds = stops
      .map((rmId) => getNavNodeIdForRoom(rmId, activeBuilding))
      .filter(Boolean) as string[];

    if (stopNodeIds.length < 2) return null;

    return findMultiStopPath(activeBuilding, stopNodeIds, routePreferences);
  }, [activeBuilding, startRoomId, intermediateStopIds, targetRoomId, routePreferences, getNavNodeIdForRoom]);

  // Auto-switch floor when selecting start or destination
  useEffect(() => {
    if (targetRoomId && activeBuilding) {
      for (const fl of activeBuilding.floors) {
        if (fl.rooms.some((r) => r.id === targetRoomId)) {
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

  // Keyboard shortcut listener (Ctrl+Z, Ctrl+Y, Escape, etc.)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'z') {
        if (e.shiftKey) {
          e.preventDefault();
          handleRedo();
        } else {
          e.preventDefault();
          handleUndo();
        }
      } else if ((e.metaKey || e.ctrlKey) && e.key === 'y') {
        e.preventDefault();
        handleRedo();
      } else if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setIsDirectoryOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [undoStack, redoStack, activeFloor, activeInstitution, activeBuilding]);

  // Inject nearest POI as intermediate stop
  const handleInjectNearestPOI = (poiType: string) => {
    if (!startRoomId || !activeBuilding) {
      alert('Kérjük, először válasszon ki egy indulási pontot a közeli szolgáltatások kereséséhez!');
      return;
    }
    const match = findNearestPOIToRoom(activeBuilding, startRoomId, poiType);
    if (match) {
      const associatedRoom =
        match.floor.rooms.find(
          (r) => distance(r.doorLocation || r.polygon[0], match.poi.position) < 100
        ) || match.floor.rooms[0];

      if (associatedRoom && !intermediateStopIds.includes(associatedRoom.id)) {
        setIntermediateStopIds((prev) => [...prev, associatedRoom.id]);
      }
    } else {
      alert('Nem található ilyen típusú szolgáltatás az épületben.');
    }
  };

  // Smart NavMesh Generator for current floor
  const handleAutoGenerateNavMesh = () => {
    if (!activeFloor) return;

    if (!isEditorAllowed) {
      handleRequireAuth('Navigációs Háló Újragenerálása');
      return;
    }

    const newNodes: Floor['navNodes'] = [];
    const newEdges: Floor['navEdges'] = [];

    const spineY = Math.round(activeFloor.height / 2);
    const spineNode1 = {
      id: `gen-spine-1-${Date.now()}`,
      floorId: activeFloor.id,
      position: { x: 250, y: spineY },
      type: 'hub' as const,
      label: 'Főfolyosó Nyugat',
    };
    const spineNode2 = {
      id: `gen-spine-2-${Date.now()}`,
      floorId: activeFloor.id,
      position: { x: 500, y: spineY },
      type: 'hub' as const,
      label: 'Központi Aula Csomópont',
    };
    const spineNode3 = {
      id: `gen-spine-3-${Date.now()}`,
      floorId: activeFloor.id,
      position: { x: 750, y: spineY },
      type: 'hub' as const,
      label: 'Főfolyosó Kelet',
    };

    newNodes.push(spineNode1, spineNode2, spineNode3);

    newEdges.push(
      {
        id: `e-spine-1-2`,
        fromNodeId: spineNode1.id,
        toNodeId: spineNode2.id,
        floorId: activeFloor.id,
        distance: distance(spineNode1.position, spineNode2.position),
        isAccessible: true,
      },
      {
        id: `e-spine-2-3`,
        fromNodeId: spineNode2.id,
        toNodeId: spineNode3.id,
        floorId: activeFloor.id,
        distance: distance(spineNode2.position, spineNode3.position),
        isAccessible: true,
      }
    );

    activeFloor.rooms.forEach((room, idx) => {
      const doorPt = room.doorLocation || {
        x: Math.round((room.polygon[0].x + room.polygon[1].x) / 2),
        y: room.polygon[0].y,
      };

      const roomNode = {
        id: room.navNodeId || `node-room-${room.id}`,
        floorId: activeFloor.id,
        position: doorPt,
        type: 'door' as const,
        refId: room.id,
        label: `${room.code} Bejárat`,
      };
      newNodes.push(roomNode);

      let closestSpine = spineNode1;
      let minD = distance(doorPt, spineNode1.position);
      if (distance(doorPt, spineNode2.position) < minD) {
        closestSpine = spineNode2;
        minD = distance(doorPt, spineNode2.position);
      }
      if (distance(doorPt, spineNode3.position) < minD) {
        closestSpine = spineNode3;
      }

      newEdges.push({
        id: `e-room-${room.id}-spine`,
        fromNodeId: roomNode.id,
        toNodeId: closestSpine.id,
        floorId: activeFloor.id,
        distance: distance(roomNode.position, closestSpine.position),
        isAccessible: true,
      });
    });

    activeFloor.transitConnectors.forEach((transit) => {
      const transitNode = {
        id: transit.navNodeId || `node-transit-${transit.id}`,
        floorId: activeFloor.id,
        position: transit.position,
        type: 'transit' as const,
        refId: transit.id,
        label: `${transit.name}`,
      };
      newNodes.push(transitNode);

      let closestSpine = spineNode1;
      let minD = distance(transit.position, spineNode1.position);
      if (distance(transit.position, spineNode2.position) < minD) {
        closestSpine = spineNode2;
        minD = distance(transit.position, spineNode2.position);
      }
      if (distance(transit.position, spineNode3.position) < minD) {
        closestSpine = spineNode3;
      }

      newEdges.push({
        id: `e-transit-${transit.id}-spine`,
        fromNodeId: transitNode.id,
        toNodeId: closestSpine.id,
        floorId: activeFloor.id,
        distance: distance(transitNode.position, closestSpine.position),
        isAccessible: transit.isAccessible,
      });
    });

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
            />

            {/* Inspector Panels */}
            {selectedRoom && (
              <RoomInspector
                room={selectedRoom}
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
                onClose={() => setSelectedRoom(null)}
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
            />
          ) : (
            <BlueprintCanvas
              floor={activeFloor}
              activeTool={activeTool}
              isStudioMode={appMode === 'studio'}
              selectedRoomId={selectedRoom?.id}
              selectedTransitId={selectedTransit?.id}
              selectedPOIId={selectedPOI?.id}
              startRoomId={startRoomId}
              targetRoomId={targetRoomId}
              routeResult={routeResult}
              activeSimulationProgress={simulationProgress}
              gridSnapSize={gridSnapSize}
              onSelectRoom={(room) => {
                setSelectedRoom(room);
                if (room && (appMode === 'wayfinder' || appMode === 'kiosk')) {
                  setIsRoomDetailOpen(true);
                } else {
                  setIsRoomDetailOpen(false);
                }
              }}
              onSelectTransit={(transit) => setSelectedTransit(transit)}
              onSelectPOI={(poi) => setSelectedPOI(poi)}
              onSetAsStartRoom={(roomId) => setStartRoomId(roomId)}
              onSetAsTargetRoom={(roomId) => setTargetRoomId(roomId)}
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
              onSetPreferences={setRoutePreferences}
              onStepClick={(step: RouteStep) => {
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
