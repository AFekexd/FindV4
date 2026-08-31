import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import type {
  Building,
  Floor,
  RouteResult,
  RouteStep,
  Room,
  Zone,
  Door,
  PointOfInterest,
  TransitConnector,
  RoutePreference,
} from '../../types';
import { POI_NAMES_HU, TRANSIT_NAMES_HU, ROOM_CATEGORY_NAMES_HU } from '../../types';
import { polygonCentroid, polygonAreaInSquareMeters, PIXELS_PER_METER } from '../../utils/geometry';
import {
  Navigation,
  CornerUpRight,
  CornerUpLeft,
  ArrowUp,
  Layers,
  Clock,
  ChevronRight,
  ChevronLeft,
  Volume2,
  VolumeX,
  List,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  CheckCircle2,
  DoorOpen,
  Compass,
  Search,
  ArrowUpDown,
  Accessibility,
  Share2,
  Box,
  MapPin,
  X,
  Sliders,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';

export interface MobileSearchItem {
  id: string;
  name: string;
  code?: string;
  floor: Floor;
  category: 'room' | 'poi' | 'transit';
  categoryLabel: string;
  subText?: string;
  icon: string;
}

interface MobileWayfinderProps {
  building: Building;
  activeFloorId: string;
  startRoomId: string | null;
  targetRoomId: string | null;
  intermediateStopIds?: string[];
  routeResult: RouteResult | null;
  routePreferences?: RoutePreference;
  onSelectFloor: (floorId: string) => void;
  onSetStartRoom?: (roomId: string | null) => void;
  onSetTargetRoom?: (roomId: string | null) => void;
  onSetIntermediateStops?: (stops: string[]) => void;
  onSetPreferences?: (prefs: RoutePreference) => void;
  onOpenDirectory?: () => void;
  onOpen3DView?: () => void;
  onOpenShareModal?: () => void;
  onExitMobileView?: () => void;
}

export const MobileWayfinder: React.FC<MobileWayfinderProps> = ({
  building,
  activeFloorId,
  startRoomId,
  targetRoomId,
  intermediateStopIds = [],
  routeResult,
  routePreferences = { accessibilityOnly: false, prioritizeElevators: false, fastestRoute: true },
  onSelectFloor,
  onSetStartRoom,
  onSetTargetRoom,
  onSetIntermediateStops,
  onSetPreferences,
  onOpenDirectory,
  onOpen3DView,
  onOpenShareModal,
  onExitMobileView,
}) => {
  const [currentStepIndex, setCurrentStepIndex] = useState<number>(0);
  const [showFullStepsList, setShowFullStepsList] = useState<boolean>(false);
  const [isSpeechEnabled, setIsSpeechEnabled] = useState<boolean>(false);
  const [isSearchDrawerOpen, setIsSearchDrawerOpen] = useState<boolean>(false);
  const [activeSearchField, setActiveSearchField] = useState<'start' | 'target' | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Selected element on map (when tapped)
  const [tappedRoom, setTappedRoom] = useState<{ room: Room; floor: Floor } | null>(null);
  const [tappedPoi, setTappedPoi] = useState<{ poi: PointOfInterest; floor: Floor } | null>(null);
  const [tappedTransit, setTappedTransit] = useState<{ transit: TransitConnector; floor: Floor } | null>(null);

  // Compass heading state
  const [compassEnabled, setCompassEnabled] = useState<boolean>(false);
  const [compassHeading, setCompassHeading] = useState<number>(0);
  const smoothHeadingRef = useRef<number>(0);

  // Zoom & Pan state for map
  const [zoom, setZoom] = useState<number>(1);
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const mapContainerRef = useRef<HTMLDivElement>(null);

  const panRef = useRef(pan);
  panRef.current = pan;
  const zoomRef = useRef(zoom);
  zoomRef.current = zoom;

  // Native wheel zooming for smooth desktop / touchpad interaction
  useEffect(() => {
    const container = mapContainerRef.current;
    if (!container) return;

    const handleWheelNative = (e: WheelEvent) => {
      e.preventDefault();
      const rect = container.getBoundingClientRect();
      const cx = e.clientX - rect.left;
      const cy = e.clientY - rect.top;
      const zoomFactor = e.deltaY < 0 ? 1.18 : 0.85;

      const currentZoom = zoomRef.current;
      const currentPan = panRef.current;
      const newZ = Math.min(10.0, Math.max(0.3, currentZoom * zoomFactor));
      const contentX = (cx - currentPan.x) / currentZoom;
      const contentY = (cy - currentPan.y) / currentZoom;

      setZoom(newZ);
      setPan({ x: cx - contentX * newZ, y: cy - contentY * newZ });
    };

    container.addEventListener('wheel', handleWheelNative, { passive: false });
    return () => {
      container.removeEventListener('wheel', handleWheelNative);
    };
  }, []);

  // Detect landscape / low-height orientation
  const [isLandscape, setIsLandscape] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return window.innerWidth > window.innerHeight || window.innerHeight < 520;
  });

  useEffect(() => {
    const checkOrientation = () => {
      setIsLandscape(window.innerWidth > window.innerHeight || window.innerHeight < 520);
    };
    window.addEventListener('resize', checkOrientation);
    window.addEventListener('orientationchange', checkOrientation);
    return () => {
      window.removeEventListener('resize', checkOrientation);
      window.removeEventListener('orientationchange', checkOrientation);
    };
  }, []);

  // Active Floor object
  const activeFloor = useMemo(() => {
    return building.floors.find((f) => f.id === activeFloorId) || building.floors[0];
  }, [building, activeFloorId]);

  // Target and Start Room Objects
  const targetRoom = useMemo(() => {
    for (const f of building.floors) {
      const rm = f.rooms.find((r) => r.id === targetRoomId);
      if (rm) return { room: rm, floor: f };
    }
    return null;
  }, [building, targetRoomId]);

  const startRoom = useMemo(() => {
    for (const f of building.floors) {
      const rm = f.rooms.find((r) => r.id === startRoomId);
      if (rm) return { room: rm, floor: f };
    }
    return null;
  }, [building, startRoomId]);

  // Build searchable database across building
  const allSearchableTargets = useMemo<MobileSearchItem[]>(() => {
    const list: MobileSearchItem[] = [];

    const sortedFloors = [...building.floors].sort((a, b) => {
      const elevA = a.elevationMeters ?? a.level ?? 0;
      const elevB = b.elevationMeters ?? b.level ?? 0;
      if (elevA !== elevB) return elevA - elevB;
      return (a.level ?? 0) - (b.level ?? 0);
    });

    for (const floor of sortedFloors) {
      // 1. Rooms
      for (const room of floor.rooms) {
        list.push({
          id: room.id,
          name: room.name,
          code: room.code,
          floor,
          category: 'room',
          categoryLabel: ROOM_CATEGORY_NAMES_HU[room.category] || 'Helyiség',
          subText: room.department || (room.occupant ? `Felelős: ${room.occupant}` : undefined),
          icon: 'room',
        });
      }

      // 2. Zones
      for (const zone of floor.zones || []) {
        list.push({
          id: zone.id,
          name: zone.name,
          code: zone.code,
          floor,
          category: 'room',
          categoryLabel: 'Zóna / Aula',
          subText: zone.description,
          icon: 'room',
        });
      }

      // 3. POIs
      for (const poi of floor.pois) {
        const huName = POI_NAMES_HU[poi.type] || poi.name;
        list.push({
          id: poi.id,
          name: poi.name,
          code: huName,
          floor,
          category: 'poi',
          categoryLabel: 'Szolgáltatás',
          subText: poi.description,
          icon: poi.type,
        });
      }

      // 4. Transit Connectors
      for (const transit of floor.transitConnectors) {
        const huName = TRANSIT_NAMES_HU[transit.type] || transit.name;
        list.push({
          id: transit.id,
          name: transit.name,
          code: huName,
          floor,
          category: 'transit',
          categoryLabel: 'Közlekedő mag',
          subText: transit.isAccessible ? 'Akadálymentes lift' : 'Lépcsőház',
          icon: transit.type,
        });
      }
    }

    return list;
  }, [building]);

  // Filter search targets
  const filteredSearchTargets = useMemo(() => {
    if (!searchQuery.trim()) return allSearchableTargets;
    const q = searchQuery.toLowerCase().trim();
    return allSearchableTargets.filter((t) => {
      const nameMatch = t.name.toLowerCase().includes(q);
      const codeMatch = t.code && t.code.toLowerCase().includes(q);
      const subMatch = t.subText && t.subText.toLowerCase().includes(q);
      const floorMatch = t.floor.name.toLowerCase().includes(q) || t.floor.shortCode.toLowerCase().includes(q);
      return nameMatch || codeMatch || subMatch || floorMatch;
    });
  }, [allSearchableTargets, searchQuery]);

  const steps = routeResult?.steps || [];
  const currentStep = steps[currentStepIndex] || steps[0];

  // Auto-switch floor ONLY when stepping through route steps
  useEffect(() => {
    if (currentStep && currentStep.floorId) {
      onSelectFloor(currentStep.floorId);
    }
  }, [currentStepIndex]);

  // Text-To-Speech guidance (Hungarian)
  const speakInstruction = (text: string) => {
    if (!isSpeechEnabled || typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'hu-HU';
    utterance.rate = 1.0;
    window.speechSynthesis.speak(utterance);
  };

  const handleNextStep = () => {
    if (currentStepIndex < steps.length - 1) {
      const nextIdx = currentStepIndex + 1;
      setCurrentStepIndex(nextIdx);
      const nextStep = steps[nextIdx];
      if (nextStep) {
        speakInstruction(nextStep.instruction);
      }
    }
  };

  const handlePrevStep = () => {
    if (currentStepIndex > 0) {
      const prevIdx = currentStepIndex - 1;
      setCurrentStepIndex(prevIdx);
      const prevStep = steps[prevIdx];
      if (prevStep) {
        speakInstruction(prevStep.instruction);
      }
    }
  };

  // Step Turn Icons
  const renderStepIcon = (step: RouteStep) => {
    if (step.isFloorChange) return <Layers className="w-5 h-5 text-emerald-600" />;
    switch (step.iconType) {
      case 'turn_left':
        return <CornerUpLeft className="w-5 h-5 text-[#1A3C2B]" />;
      case 'turn_right':
        return <CornerUpRight className="w-5 h-5 text-[#1A3C2B]" />;
      case 'door':
        return <DoorOpen className="w-5 h-5 text-emerald-700" />;
      case 'end':
        return <CheckCircle2 className="w-5 h-5 text-red-600" />;
      case 'start':
        return <Navigation className="w-5 h-5 text-emerald-700" />;
      default:
        return <ArrowUp className="w-5 h-5 text-[#1A3C2B]" />;
    }
  };

  // Filter current floor route path segments
  const currentFloorPathNodes = useMemo(() => {
    return (routeResult?.pathNodes || []).filter((n) => n.floorId === activeFloor.id);
  }, [routeResult, activeFloor]);

  // ── COMPASS / DEVICE ORIENTATION ──────────────────────────────────────
  const handleDeviceOrientation = useCallback((event: DeviceOrientationEvent) => {
    let heading: number | null = null;

    if ('webkitCompassHeading' in event && typeof (event as any).webkitCompassHeading === 'number') {
      heading = (event as any).webkitCompassHeading as number;
    } else if (event.alpha !== null) {
      heading = (360 - event.alpha) % 360;
    }

    if (heading !== null && !isNaN(heading)) {
      const prev = smoothHeadingRef.current;
      let diff = heading - prev;
      if (diff > 180) diff -= 360;
      if (diff < -180) diff += 360;
      const smoothed = ((prev + diff * 0.25) + 360) % 360;
      smoothHeadingRef.current = smoothed;
      setCompassHeading(smoothed);
    }
  }, []);

  const toggleCompass = useCallback(async () => {
    if (compassEnabled) {
      window.removeEventListener('deviceorientation', handleDeviceOrientation as any, true);
      if ('ondeviceorientationabsolute' in window) {
        window.removeEventListener('deviceorientationabsolute', handleDeviceOrientation as any, true);
      }
      setCompassEnabled(false);
      setCompassHeading(0);
      smoothHeadingRef.current = 0;
      return;
    }

    try {
      if (typeof (DeviceOrientationEvent as any).requestPermission === 'function') {
        const permission = await (DeviceOrientationEvent as any).requestPermission();
        if (permission !== 'granted') {
          alert('Az iránytű használatához engedélyezd a mozgásérzékelőt.');
          return;
        }
      }
      if ('ondeviceorientationabsolute' in window) {
        window.addEventListener('deviceorientationabsolute', handleDeviceOrientation as any, true);
      }
      window.addEventListener('deviceorientation', handleDeviceOrientation as any, true);
      setCompassEnabled(true);
    } catch {
      alert('Az iránytű nem érhető el ezen az eszközön.');
    }
  }, [compassEnabled, handleDeviceOrientation]);

  useEffect(() => {
    return () => {
      window.removeEventListener('deviceorientation', handleDeviceOrientation as any, true);
      if ('ondeviceorientationabsolute' in window) {
        window.removeEventListener('deviceorientationabsolute', handleDeviceOrientation as any, true);
      }
    };
  }, [handleDeviceOrientation]);

  // Touch handlers for panning & pinching on map
  const touchStartRef = useRef<{
    x: number;
    y: number;
    dist?: number;
    midX?: number;
    midY?: number;
    startZoom?: number;
    startPanX?: number;
    startPanY?: number;
  }>({ x: 0, y: 0 });

  const rotateToMapSpace = (dx: number, dy: number): { dx: number; dy: number } => {
    if (!compassEnabled || compassHeading === 0) return { dx, dy };
    const rad = (compassHeading * Math.PI) / 180;
    return {
      dx: dx * Math.cos(rad) + dy * Math.sin(rad),
      dy: -dx * Math.sin(rad) + dy * Math.cos(rad),
    };
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 1) {
      touchStartRef.current = {
        x: e.touches[0].clientX,
        y: e.touches[0].clientY,
        startPanX: pan.x,
        startPanY: pan.y,
        dist: undefined,
      };
    } else if (e.touches.length === 2) {
      const dist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      const container = mapContainerRef.current;
      const rect = container?.getBoundingClientRect();
      const containerX = rect ? rect.left : 0;
      const containerY = rect ? rect.top : 0;
      const midX = (e.touches[0].clientX + e.touches[1].clientX) / 2 - containerX;
      const midY = (e.touches[0].clientY + e.touches[1].clientY) / 2 - containerY;

      touchStartRef.current = {
        x: 0,
        y: 0,
        dist,
        midX,
        midY,
        startZoom: zoom,
        startPanX: pan.x,
        startPanY: pan.y,
      };
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 1 && touchStartRef.current.dist === undefined) {
      const rawDx = e.touches[0].clientX - touchStartRef.current.x;
      const rawDy = e.touches[0].clientY - touchStartRef.current.y;
      const rotated = rotateToMapSpace(rawDx, rawDy);
      setPan({
        x: (touchStartRef.current.startPanX ?? pan.x) + rotated.dx,
        y: (touchStartRef.current.startPanY ?? pan.y) + rotated.dy,
      });
    } else if (e.touches.length === 2 && touchStartRef.current.dist) {
      const dist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      if (dist === 0) return;
      const scaleFactor = dist / touchStartRef.current.dist;
      const oldZoom = touchStartRef.current.startZoom || 1;
      const newZoom = Math.min(10.0, Math.max(0.3, oldZoom * scaleFactor));

      const container = mapContainerRef.current;
      const rect = container?.getBoundingClientRect();
      const containerX = rect ? rect.left : 0;
      const containerY = rect ? rect.top : 0;

      const currentMidX = (e.touches[0].clientX + e.touches[1].clientX) / 2 - containerX;
      const currentMidY = (e.touches[0].clientY + e.touches[1].clientY) / 2 - containerY;

      const anchorX = touchStartRef.current.midX || 0;
      const anchorY = touchStartRef.current.midY || 0;
      const startPanX = touchStartRef.current.startPanX || 0;
      const startPanY = touchStartRef.current.startPanY || 0;

      const contentX = (anchorX - startPanX) / oldZoom;
      const contentY = (anchorY - startPanY) / oldZoom;
      const newPanX = currentMidX - contentX * newZoom;
      const newPanY = currentMidY - contentY * newZoom;

      setZoom(newZoom);
      setPan({ x: newPanX, y: newPanY });
    }
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (e.touches.length === 1) {
      touchStartRef.current = {
        x: e.touches[0].clientX,
        y: e.touches[0].clientY,
        startPanX: pan.x,
        startPanY: pan.y,
        dist: undefined,
      };
    } else if (e.touches.length === 0) {
      touchStartRef.current = { x: 0, y: 0, dist: undefined };
    }
  };

  // Auto-fit floor nicely into the screen
  const fitFloorToView = useCallback(() => {
    const container = mapContainerRef.current;
    if (!container || !activeFloor) return;
    const cw = container.clientWidth || window.innerWidth || 390;
    const ch = container.clientHeight || 500;
    const padding = 16;
    const scaleX = (cw - padding * 2) / (activeFloor.width || 1000);
    const scaleY = (ch - padding * 2) / (activeFloor.height || 700);
    const fitScale = Math.min(scaleX, scaleY);
    const initialZoom = Math.max(0.1, Math.min(fitScale, 1.5));
    const initialPanX = (cw - activeFloor.width * initialZoom) / 2;
    const initialPanY = (ch - activeFloor.height * initialZoom) / 2;

    setZoom(initialZoom);
    setPan({ x: initialPanX, y: initialPanY });
  }, [activeFloor]);

  // Initial fit when floor loads or changes
  useEffect(() => {
    const timer = setTimeout(() => {
      fitFloorToView();
    }, 50);
    return () => clearTimeout(timer);
  }, [activeFloor.id, fitFloorToView]);

  const handleButtonZoom = (factor: number) => {
    const container = mapContainerRef.current;
    const cx = container ? container.clientWidth / 2 : window.innerWidth / 2;
    const cy = container ? container.clientHeight / 2 : 300;

    setZoom((prevZoom) => {
      const newZoom = Math.min(10.0, Math.max(0.1, prevZoom * factor));
      setPan((prevPan) => {
        const contentX = (cx - prevPan.x) / prevZoom;
        const contentY = (cy - prevPan.y) / prevZoom;
        return {
          x: cx - contentX * newZoom,
          y: cy - contentY * newZoom,
        };
      });
      return newZoom;
    });
  };

  const resetMapView = () => {
    fitFloorToView();
  };

  const handleSwapStartAndTarget = () => {
    const prevStart = startRoomId;
    const prevTarget = targetRoomId;
    if (onSetStartRoom) onSetStartRoom(prevTarget);
    if (onSetTargetRoom) onSetTargetRoom(prevStart);
  };

  const handleSelectSearchItem = (item: MobileSearchItem) => {
    if (activeSearchField === 'start') {
      if (onSetStartRoom) onSetStartRoom(item.id);
      if (item.floor.id !== activeFloor.id) onSelectFloor(item.floor.id);
    } else if (activeSearchField === 'target') {
      if (onSetTargetRoom) onSetTargetRoom(item.id);
      if (item.floor.id !== activeFloor.id) onSelectFloor(item.floor.id);
    } else {
      // Default to setting as target
      if (onSetTargetRoom) onSetTargetRoom(item.id);
      if (item.floor.id !== activeFloor.id) onSelectFloor(item.floor.id);
    }
    setIsSearchDrawerOpen(false);
    setActiveSearchField(null);
    setSearchQuery('');
  };

  return (
    <div className="fixed inset-0 z-50 bg-[#EFEFEA] flex flex-col justify-between overflow-hidden select-none font-sans text-[#1A3C2B] safe-top safe-bottom">
      {/* ─────────────────────────────────────────────────────────────
          1. TOP MOBILE HEADER & SEARCH STRIP
          ───────────────────────────────────────────────────────────── */}
      <div className="z-20 bg-white border-b-2 border-[#1A3C2B] p-2.5 shadow-xs flex flex-col gap-2">
        {/* Upper Row: Brand, Building Name & Quick Tool Buttons */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="w-2.5 h-2.5 bg-[#1A3C2B] rotate-45 inline-block flex-shrink-0" />
            <span className="font-mono text-xs font-black tracking-wider text-[#1A3C2B] truncate">
              {building.name}
            </span>
          </div>

          <div className="flex items-center gap-1 flex-shrink-0">
            {/* Audio Guidance Toggle */}
            <button
              onClick={() => {
                const nextState = !isSpeechEnabled;
                setIsSpeechEnabled(nextState);
                if (nextState && currentStep) speakInstruction(currentStep.instruction);
              }}
              className={`p-1.5 border text-xs transition-colors ${
                isSpeechEnabled
                  ? 'bg-[#1A3C2B] text-white border-[#1A3C2B]'
                  : 'bg-[#F7F7F5] text-[#1A3C2B] border-[#1A3C2B]/30'
              }`}
              title="Hangos navigáció"
            >
              {isSpeechEnabled ? <Volume2 className="w-3.5 h-3.5" /> : <VolumeX className="w-3.5 h-3.5" />}
            </button>

            {/* 3D View Toggle */}
            {onOpen3DView && (
              <button
                onClick={onOpen3DView}
                className="p-1.5 border border-[#1A3C2B]/40 bg-[#F7F7F5] font-mono text-[10px] font-bold flex items-center gap-1"
                title="3D Izometrikus szint-halom megnyitása"
              >
                <Box className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">3D</span>
              </button>
            )}

            {/* Share / QR Modal */}
            {onOpenShareModal && (
              <button
                onClick={onOpenShareModal}
                className="p-1.5 border border-[#1A3C2B]/40 bg-[#F7F7F5] font-mono text-[10px] font-bold"
                title="Útvonal megosztása QR-kóddal"
              >
                <Share2 className="w-3.5 h-3.5" />
              </button>
            )}

            {/* Exit to full desktop CAD */}
            {onExitMobileView && (
              <button
                onClick={onExitMobileView}
                className="px-2 py-1 border border-[#1A3C2B] bg-[#F7F7F5] font-mono text-[10px] font-bold"
              >
                TELJES NÉZET
              </button>
            )}
          </div>
        </div>

        {/* Lower Row: Quick Destination Search Bar */}
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => {
              setActiveSearchField('target');
              setIsSearchDrawerOpen(true);
            }}
            className="flex-1 bg-[#F7F7F5] border border-[#1A3C2B] px-2.5 py-1.5 flex items-center justify-between text-left transition-colors hover:bg-white"
          >
            <div className="flex items-center gap-2 min-w-0">
              <Search className="w-3.5 h-3.5 text-[#1A3C2B]/60 flex-shrink-0" />
              <span className="font-sans text-xs font-bold text-[#1A3C2B] truncate">
                {targetRoom ? `${targetRoom.room.code} - ${targetRoom.room.name}` : 'Keresés (terem, tanár, WC, lift)...'}
              </span>
            </div>
            {targetRoom && (
              <span className="font-mono text-[9px] font-bold bg-[#1A3C2B] text-white px-1 py-0.2 ml-1 flex-shrink-0">
                {targetRoom.floor.shortCode}
              </span>
            )}
          </button>

          {/* Quick Route Settings / Start Trigger */}
          <button
            onClick={() => {
              setActiveSearchField('start');
              setIsSearchDrawerOpen(true);
            }}
            className={`p-1.5 border border-[#1A3C2B] font-mono text-[10px] font-bold flex items-center gap-1 ${
              startRoom ? 'bg-emerald-700 text-white' : 'bg-white text-[#1A3C2B]'
            }`}
            title="Indulási pont megadása"
          >
            <MapPin className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">START</span>
          </button>
        </div>

        {/* Route Stats Bar (if active route) */}
        {routeResult && (
          <div className="flex items-center justify-between bg-[#1A3C2B] text-white px-2.5 py-1 font-mono text-[10px] font-bold">
            <div className="flex items-center gap-2">
              <Clock className="w-3 h-3 text-emerald-400" />
              <span>~{routeResult.estimatedTimeMinutes} perc</span>
              <span className="opacity-40">•</span>
              <span>{routeResult.totalDistanceMeters} méter</span>
              <span className="opacity-40">•</span>
              <span>{routeResult.floorsTraversed.length} szint</span>
            </div>
            <span className="text-emerald-300 uppercase">{routeResult.steps.length} lépés</span>
          </div>
        )}
      </div>

      {/* ─────────────────────────────────────────────────────────────
          2. FULL-SCREEN 2D BLUEPRINT MAP STAGE
          ───────────────────────────────────────────────────────────── */}
      <div
        ref={mapContainerRef}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onTouchCancel={handleTouchEnd}
        className="relative flex-1 w-full h-full bg-[#EFEFEA] overflow-hidden touch-none"
      >
        {/* Floor Level Floating Quick Pills */}
        <div className="absolute z-10 top-2.5 left-2.5 flex items-center gap-1 bg-white/95 backdrop-blur-md border border-[#1A3C2B] p-1 font-mono text-xs shadow-md max-w-[calc(100vw-6rem)] overflow-x-auto">
          {[...building.floors]
            .sort((a, b) => {
              const elevA = a.elevationMeters ?? a.level ?? 0;
              const elevB = b.elevationMeters ?? b.level ?? 0;
              if (elevA !== elevB) return elevA - elevB;
              return (a.level ?? 0) - (b.level ?? 0);
            })
            .map((floor) => {
              const isActive = floor.id === activeFloor.id;
              const isTraversed = routeResult?.floorsTraversed.includes(floor.id);
              return (
                <button
                  key={floor.id}
                  onClick={() => onSelectFloor(floor.id)}
                  className={`px-2.5 py-1.5 text-xs font-bold transition-all flex-shrink-0 ${
                    isActive
                      ? 'bg-[#1A3C2B] text-white'
                      : isTraversed
                      ? 'bg-emerald-100 text-emerald-900 border-b-2 border-emerald-600'
                      : 'text-[#1A3C2B] hover:bg-[#F0F5F2]'
                  }`}
                >
                  {floor.shortCode}
                </button>
              );
            })}
        </div>

        {/* Floating Map Zoom & Pan Controls */}
        <div className="absolute z-10 top-2.5 right-2.5 flex flex-col gap-1 bg-white/95 backdrop-blur-md border border-[#1A3C2B] p-1 shadow-md pointer-events-auto">
          <button
            onClick={() => handleButtonZoom(1.3)}
            className="p-2 hover:bg-[#1A3C2B] hover:text-white border border-[#1A3C2B]/20 text-[#1A3C2B] transition-colors"
            title="Nagyítás"
          >
            <ZoomIn className="w-4 h-4" />
          </button>
          <button
            onClick={() => handleButtonZoom(0.77)}
            className="p-2 hover:bg-[#1A3C2B] hover:text-white border border-[#1A3C2B]/20 text-[#1A3C2B] transition-colors"
            title="Kicsinyítés"
          >
            <ZoomOut className="w-4 h-4" />
          </button>
          <button
            onClick={resetMapView}
            className="p-2 hover:bg-[#1A3C2B] hover:text-white border border-[#1A3C2B]/20 text-[#1A3C2B] transition-colors"
            title="Középre állítás"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
          <div className="h-px w-full bg-[#1A3C2B]/20" />
          <button
            onClick={toggleCompass}
            className={`p-2 border transition-colors ${
              compassEnabled
                ? 'bg-[#047857] text-white border-[#047857]'
                : 'hover:bg-[#1A3C2B] hover:text-white border-[#1A3C2B]/20 text-[#1A3C2B]'
            }`}
            title="Iránytű követés"
          >
            <Compass className="w-4 h-4" />
          </button>
        </div>

        {/* Floating North Arrow Indicator */}
        {compassEnabled && (
          <div className="absolute z-10 bottom-24 right-2.5 flex flex-col items-center gap-0.5 pointer-events-none">
            <div
              className="w-10 h-10 bg-white/95 backdrop-blur-md border-2 border-[#1A3C2B] rounded-full flex items-center justify-center shadow-md"
              style={{
                transform: `rotate(${-compassHeading}deg)`,
                transition: 'transform 0.3s ease-out',
              }}
            >
              <svg width="20" height="20" viewBox="0 0 20 20">
                <polygon points="10,1 7,10 10,8 13,10" fill="#B91C1C" />
                <polygon points="10,19 7,10 10,12 13,10" fill="#94A3B8" />
              </svg>
            </div>
            <span className="font-mono text-[8px] font-bold text-[#1A3C2B] bg-white/90 px-1 rounded">
              {Math.round(compassHeading)}°
            </span>
          </div>
        )}

        {/* Native Vector SVG Canvas (Always Crystal-Clear / No GPU Texture Blurring) */}
        <div
          className="w-full h-full relative"
          style={{
            transform: compassEnabled && compassHeading !== 0 ? `rotate(${-compassHeading}deg)` : undefined,
            transformOrigin: 'center center',
            transition: 'transform 0.3s ease-out',
          }}
        >
          <svg className="w-full h-full absolute inset-0 overflow-hidden select-none">
            <defs>
              <pattern id="mobile-grid" width="40" height="40" patternUnits="userSpaceOnUse">
                <path d="M 40 0 L 0 0 0 40" fill="none" stroke="rgba(26, 60, 43, 0.08)" strokeWidth="1" />
              </pattern>
            </defs>

            {/* Native SVG Vector Scaled & Translated World Space */}
            <g transform={`translate(${pan.x}, ${pan.y}) scale(${zoom})`}>
              <rect width={activeFloor.width} height={activeFloor.height} fill="#F7F7F5" />
              <rect width={activeFloor.width} height={activeFloor.height} fill="url(#mobile-grid)" stroke="#1A3C2B" strokeWidth="1" />

              {/* Underlay Image if present */}
              {activeFloor.underlay && activeFloor.underlay.visible && activeFloor.underlay.url && (
                <image
                  href={activeFloor.underlay.url}
                  x={activeFloor.underlay.offsetX}
                  y={activeFloor.underlay.offsetY}
                  width={activeFloor.width * activeFloor.underlay.scale}
                  height={activeFloor.height * activeFloor.underlay.scale}
                  opacity={activeFloor.underlay.opacity}
                  preserveAspectRatio="none"
                  style={{ pointerEvents: 'none' }}
                />
              )}

              {/* 0. ZONES LAYER */}
              {(activeFloor.zones || []).map((zone) => {
                const pointsStr = zone.polygon.map((p) => `${p.x},${p.y}`).join(' ');
                const centroid = polygonCentroid(zone.polygon);
                const area = polygonAreaInSquareMeters(zone.polygon);

                return (
                  <g key={zone.id}>
                    <polygon
                      points={pointsStr}
                      fill={zone.color || 'rgba(180, 160, 120, 0.15)'}
                      stroke="#94A3B8"
                      strokeWidth={1.5}
                      strokeDasharray="5 4"
                    />
                    <g
                      transform={`translate(${centroid.x}, ${centroid.y})`}
                      className="pointer-events-none select-none"
                    >
                      <rect
                        x={-Math.max(45, zone.name.length * 4.2)}
                        y={-13}
                        width={Math.max(90, zone.name.length * 8.4)}
                        height={26}
                        rx={2}
                        fill="#FFFFFF"
                        stroke="#94A3B8"
                        strokeWidth={1}
                        opacity={0.92}
                      />
                      <text
                        x="0"
                        y="-1.5"
                        textAnchor="middle"
                        fill="#64748B"
                        className="font-mono text-[9px] font-bold uppercase"
                      >
                        {zone.name}
                      </text>
                      <text
                        x="0"
                        y="8.5"
                        textAnchor="middle"
                        fill="#94A3B8"
                        className="font-mono text-[7px]"
                      >
                        {zone.code ? `${zone.code} • ` : ''}{area.toFixed(1)} m²
                      </text>
                    </g>
                  </g>
                );
              })}

              {/* 1. ROOMS LAYER */}
              {activeFloor.rooms.map((room) => {
                const isTarget = targetRoomId === room.id;
                const isStart = startRoomId === room.id;
                const isTapped = tappedRoom?.room.id === room.id;
                const pointsStr = room.polygon.map((p) => `${p.x},${p.y}`).join(' ');
                const centroid = polygonCentroid(room.polygon);
                const area = polygonAreaInSquareMeters(room.polygon);

                const rMinX = Math.min(...room.polygon.map((p) => p.x));
                const rMaxX = Math.max(...room.polygon.map((p) => p.x));
                const rMinY = Math.min(...room.polygon.map((p) => p.y));
                const rMaxY = Math.max(...room.polygon.map((p) => p.y));
                const roomWidthPx = rMaxX - rMinX;
                const roomHeightPx = rMaxY - rMinY;
                const minDimMeters = Math.min(roomWidthPx, roomHeightPx) / PIXELS_PER_METER;
                const isTinyRoom = minDimMeters < 3.4 || area < 10;
                const isSmallRoom = minDimMeters < 5.2 || area < 22;

                let fillColor = room.colorHatch || 'rgba(26, 60, 43, 0.06)';
                let strokeColor = '#1A3C2B';
                let strokeWidth = 1.5;

                if (isTarget) {
                  fillColor = 'rgba(185, 28, 28, 0.25)';
                  strokeColor = '#B91C1C';
                  strokeWidth = 3.5;
                } else if (isStart) {
                  fillColor = 'rgba(4, 120, 87, 0.25)';
                  strokeColor = '#047857';
                  strokeWidth = 3.5;
                } else if (isTapped) {
                  fillColor = 'rgba(30, 64, 175, 0.22)';
                  strokeColor = '#1E40AF';
                  strokeWidth = 3;
                }

                return (
                  <g
                    key={room.id}
                    onClick={() => {
                      setTappedRoom({ room, floor: activeFloor });
                      setTappedPoi(null);
                      setTappedTransit(null);
                    }}
                    className="cursor-pointer"
                  >
                    <polygon
                      points={pointsStr}
                      fill={fillColor}
                      stroke={strokeColor}
                      strokeWidth={strokeWidth}
                    />

                    {/* Room Labels */}
                    <g
                      transform={`translate(${centroid.x}, ${centroid.y})`}
                      className="pointer-events-none select-none"
                    >
                      {isTinyRoom ? (
                        <g>
                          <rect x="-16" y="-7" width="32" height="14" fill="#1A3C2B" rx="2" />
                          <text x="0" y="3" textAnchor="middle" fill="#F7F7F5" className="font-mono text-[8px] font-bold">
                            {room.code || room.name.slice(0, 5)}
                          </text>
                        </g>
                      ) : isSmallRoom ? (
                        <g>
                          <rect x="-20" y="-13" width="40" height="12" fill="#1A3C2B" rx="2" />
                          <text x="0" y="-4" textAnchor="middle" fill="#F7F7F5" className="font-mono text-[7.5px] font-bold tracking-wider">
                            {room.code}
                          </text>
                          <text x="0" y="7" textAnchor="middle" fill="#1A3C2B" className="font-sans text-[8.5px] font-bold">
                            {room.name.length > 14 ? `${room.name.slice(0, 12)}…` : room.name}
                          </text>
                        </g>
                      ) : (
                        <g>
                          <rect x="-28" y="-22" width="56" height="15" fill="#1A3C2B" rx="2" />
                          <text x="0" y="-11" textAnchor="middle" fill="#F7F7F5" className="font-mono text-[9px] font-bold tracking-wider">
                            {room.code}
                          </text>
                          <text x="0" y="5" textAnchor="middle" fill="#1A3C2B" className="font-sans text-[11px] font-bold">
                            {room.name.length > 26 ? `${room.name.slice(0, 24)}…` : room.name}
                          </text>
                          <text x="0" y="18" textAnchor="middle" fill="#1A3C2B" fillOpacity="0.75" className="font-mono text-[8px]">
                            {area.toFixed(0)}m² • {room.capacity ? `${room.capacity} FŐ` : '—'}
                          </text>
                        </g>
                      )}
                    </g>

                    {/* Start / Target Badges */}
                    {isStart && (
                      <g transform={`translate(${centroid.x}, ${isSmallRoom ? rMinY - 14 : centroid.y - 32})`}>
                        <rect x="-38" y="-14" width="76" height="14" fill="#047857" stroke="#F7F7F5" strokeWidth="1" rx="2" />
                        <text x="0" y="-3" textAnchor="middle" fill="#F7F7F5" className="font-mono text-[8px] font-bold">
                          ● INDULÁS
                        </text>
                        <line x1="0" y1="0" x2="0" y2="10" stroke="#047857" strokeWidth="2" />
                      </g>
                    )}
                    {isTarget && (
                      <g transform={`translate(${centroid.x}, ${isSmallRoom ? rMinY - 14 : centroid.y - 32})`}>
                        <rect x="-32" y="-14" width="64" height="14" fill="#B91C1C" stroke="#F7F7F5" strokeWidth="1" rx="2" />
                        <text x="0" y="-3" textAnchor="middle" fill="#F7F7F5" className="font-mono text-[8px] font-bold">
                          ★ CÉL
                        </text>
                        <line x1="0" y1="0" x2="0" y2="10" stroke="#B91C1C" strokeWidth="2" />
                      </g>
                    )}
                  </g>
                );
              })}

              {/* 2. WALLS LAYER */}
              {activeFloor.walls.map((wall) => (
                <line
                  key={wall.id}
                  x1={wall.start.x}
                  y1={wall.start.y}
                  x2={wall.end.x}
                  y2={wall.end.y}
                  stroke="#1A3C2B"
                  strokeWidth={wall.thickness * 1.5}
                />
              ))}

              {/* 3. DOORS LAYER */}
              {activeFloor.doors.map((door) => {
                const dx = door.end.x - door.start.x;
                const dy = door.end.y - door.start.y;
                const doorWidth = Math.sqrt(dx * dx + dy * dy) || 36;
                const unitTan = { x: dx / doorWidth, y: dy / doorWidth };
                const unitNorm = { x: -unitTan.y, y: unitTan.x };
                const leafEnd = {
                  x: door.start.x + unitNorm.x * doorWidth,
                  y: door.start.y + unitNorm.y * doorWidth,
                };
                const midPoint = {
                  x: (door.start.x + door.end.x) / 2,
                  y: (door.start.y + door.end.y) / 2,
                };
                const halfWidth = doorWidth / 2;
                const leaf1End = {
                  x: door.start.x + unitNorm.x * halfWidth,
                  y: door.start.y + unitNorm.y * halfWidth,
                };
                const leaf2End = {
                  x: door.end.x + unitNorm.x * halfWidth,
                  y: door.end.y + unitNorm.y * halfWidth,
                };

                return (
                  <g key={door.id} className="pointer-events-none">
                    <line
                      x1={door.start.x} y1={door.start.y}
                      x2={door.end.x} y2={door.end.y}
                      stroke="#FFFFFF" strokeWidth="6" strokeLinecap="square"
                    />
                    <line
                      x1={door.start.x} y1={door.start.y}
                      x2={door.end.x} y2={door.end.y}
                      stroke="#94A3B8" strokeWidth="1" strokeDasharray="2 2"
                    />
                    {door.type === 'double' ? (
                      <>
                        <path
                          d={`M ${door.start.x} ${door.start.y} L ${midPoint.x} ${midPoint.y} A ${halfWidth} ${halfWidth} 0 0 0 ${leaf1End.x} ${leaf1End.y} Z`}
                          fill="rgba(4, 120, 87, 0.05)" stroke="#059669" strokeWidth="0.9" strokeDasharray="2 1.5"
                        />
                        <path
                          d={`M ${door.end.x} ${door.end.y} L ${midPoint.x} ${midPoint.y} A ${halfWidth} ${halfWidth} 0 0 1 ${leaf2End.x} ${leaf2End.y} Z`}
                          fill="rgba(4, 120, 87, 0.05)" stroke="#059669" strokeWidth="0.9" strokeDasharray="2 1.5"
                        />
                        <line x1={door.start.x} y1={door.start.y} x2={leaf1End.x} y2={leaf1End.y} stroke="#1A3C2B" strokeWidth="2" />
                        <line x1={door.end.x} y1={door.end.y} x2={leaf2End.x} y2={leaf2End.y} stroke="#1A3C2B" strokeWidth="2" />
                      </>
                    ) : (
                      <>
                        <path
                          d={`M ${door.start.x} ${door.start.y} L ${door.end.x} ${door.end.y} A ${doorWidth} ${doorWidth} 0 0 0 ${leafEnd.x} ${leafEnd.y} Z`}
                          fill="rgba(4, 120, 87, 0.05)" stroke="#059669" strokeWidth="0.9" strokeDasharray="2 1.5"
                        />
                        <line x1={door.start.x} y1={door.start.y} x2={leafEnd.x} y2={leafEnd.y} stroke="#1A3C2B" strokeWidth="2" />
                      </>
                    )}
                  </g>
                );
              })}

              {/* 4. TRANSIT CONNECTORS */}
              {activeFloor.transitConnectors.map((t) => (
                <g
                  key={t.id}
                  transform={`translate(${t.position.x - t.width / 2}, ${t.position.y - t.height / 2})`}
                  onClick={() => {
                    setTappedTransit({ transit: t, floor: activeFloor });
                    setTappedRoom(null);
                    setTappedPoi(null);
                  }}
                  className="cursor-pointer"
                >
                  <rect
                    width={t.width}
                    height={t.height}
                    fill={t.type === 'elevator' ? '#0E7490' : '#B45309'}
                    stroke="#1A3C2B"
                    strokeWidth="1.5"
                    rx="2"
                  />
                  <text
                    x={t.width / 2}
                    y={t.height / 2 + 4}
                    textAnchor="middle"
                    fill="#FFFFFF"
                    className="font-mono text-[8.5px] font-bold pointer-events-none select-none"
                  >
                    {t.type === 'elevator' ? 'LIFT' : 'LÉPCSŐ'}
                  </text>
                </g>
              ))}

              {/* 5. POINTS OF INTEREST (POIs) */}
              {activeFloor.pois.map((poi) => {
                const isPoiStart = startRoomId === poi.id;
                const isPoiTarget = targetRoomId === poi.id;

                let poiFill = '#F7F7F5';
                let poiStroke = '#1A3C2B';
                if (poi.type === 'entrance') { poiFill = '#ECFDF5'; poiStroke = '#047857'; }
                else if (poi.type === 'exit') { poiFill = '#FEF2F2'; poiStroke = '#B91C1C'; }
                else if (poi.type === 'fire_exit') { poiFill = '#F0FDF4'; poiStroke = '#15803D'; }
                else if (poi.type === 'accessible_entrance') { poiFill = '#F0F9FF'; poiStroke = '#0284C7'; }

                if (isPoiStart) { poiFill = '#ECFDF5'; poiStroke = '#047857'; }
                if (isPoiTarget) { poiFill = '#FEF2F2'; poiStroke = '#B91C1C'; }

                return (
                  <g
                    key={poi.id}
                    transform={`translate(${poi.position.x}, ${poi.position.y})`}
                    onClick={() => {
                      setTappedPoi({ poi, floor: activeFloor });
                      setTappedRoom(null);
                      setTappedTransit(null);
                    }}
                    className="cursor-pointer"
                  >
                    <circle
                      r="11"
                      fill={poiFill}
                      stroke={poiStroke}
                      strokeWidth={isPoiStart || isPoiTarget ? 2.5 : 1.8}
                    />
                    <text
                      x="0" y="4"
                      textAnchor="middle"
                      fill={poiStroke}
                      className="font-mono text-[8px] font-black pointer-events-none select-none"
                    >
                      {poi.type === 'entrance' ? '⇥' :
                       poi.type === 'exit' ? '⇤' :
                       poi.type === 'fire_exit' ? '🔥' :
                       poi.type === 'accessible_entrance' ? '♿' :
                       poi.type.startsWith('restroom') ? 'WC' :
                       poi.type === 'water' ? '💧' :
                       poi.type === 'first_aid' ? '➕' :
                       poi.type === 'coffee' ? '☕' :
                       'ℹ'}
                    </text>
                    {poi.name && (
                      <text
                        x="0" y="22"
                        textAnchor="middle"
                        fill="#1A3C2B"
                        className="font-mono text-[7px] font-bold pointer-events-none select-none"
                      >
                        {poi.name.length > 16 ? `${poi.name.slice(0, 14)}…` : poi.name}
                      </text>
                    )}
                  </g>
                );
              })}

              {/* 6. ROUTE LINE & BEACON */}
              {currentFloorPathNodes.length > 1 && (
                <g>
                  <path
                    d={currentFloorPathNodes.map((n, i) => `${i === 0 ? 'M' : 'L'} ${n.position.x} ${n.position.y}`).join(' ')}
                    fill="none"
                    stroke="#047857"
                    strokeWidth="6"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  {currentFloorPathNodes.map((n, i) => (
                    <circle
                      key={i}
                      cx={n.position.x}
                      cy={n.position.y}
                      r="4"
                      fill="#047857"
                      stroke="#FFFFFF"
                      strokeWidth="1.5"
                    />
                  ))}

                  {/* Focus Beacon */}
                  {currentStep && currentStep.floorId === activeFloor.id && (
                    <g transform={`translate(${currentStep.coordinates.x}, ${currentStep.coordinates.y})`}>
                      <circle r="16" fill="none" stroke="#047857" strokeWidth="2" className="animate-ping" />
                      <circle r="7" fill="#047857" stroke="#FFFFFF" strokeWidth="2" />
                    </g>
                  )}
                </g>
              )}
            </g>
          </svg>
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          3. TAPPED ROOM / POI BOTTOM POP-UP CARD
          ───────────────────────────────────────────────────────────── */}
      {tappedRoom && (
        <div className="z-30 bg-white border-t-2 border-[#1A3C2B] p-3 shadow-2xl animate-in slide-in-from-bottom-4 duration-150 flex flex-col gap-2">
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-mono text-xs px-1.5 py-0.5 bg-[#1A3C2B] text-white font-bold">
                  {tappedRoom.room.code}
                </span>
                <span className="font-mono text-[9px] text-[#1A3C2B]/70">
                  {tappedRoom.floor.name} ({tappedRoom.floor.shortCode}. szint)
                </span>
              </div>
              <h3 className="font-sans font-bold text-sm text-[#1A3C2B] mt-0.5">
                {tappedRoom.room.name}
              </h3>
            </div>
            <button
              onClick={() => setTappedRoom(null)}
              className="font-mono text-xs text-[#1A3C2B]/60 p-1 hover:text-[#1A3C2B]"
            >
              ✕
            </button>
          </div>

          <div className="flex items-center gap-2 font-mono text-[10px] text-[#1A3C2B]/80 bg-[#F7F7F5] p-1.5 border border-[#1A3C2B]/20">
            <span>TERÜLET: <b>{polygonAreaInSquareMeters(tappedRoom.room.polygon).toFixed(1)} m²</b></span>
            <span>•</span>
            <span>FÉRŐHELY: <b>{tappedRoom.room.capacity ? `${tappedRoom.room.capacity} FŐ` : '—'}</b></span>
            {tappedRoom.room.department && (
              <>
                <span>•</span>
                <span className="truncate"><b>{tappedRoom.room.department}</b></span>
              </>
            )}
          </div>

          <div className="grid grid-cols-2 gap-2 pt-0.5">
            <button
              onClick={() => {
                if (onSetStartRoom) onSetStartRoom(tappedRoom.room.id);
                setTappedRoom(null);
              }}
              className="py-2 px-2 bg-[#047857] text-white font-mono text-xs font-bold flex items-center justify-center gap-1.5"
            >
              <div className="w-2 h-2 rounded-full bg-white" />
              <span>INDULÁS INNEN</span>
            </button>
            <button
              onClick={() => {
                if (onSetTargetRoom) onSetTargetRoom(tappedRoom.room.id);
                setTappedRoom(null);
              }}
              className="py-2 px-2 bg-[#B91C1C] text-white font-mono text-xs font-bold flex items-center justify-center gap-1.5"
            >
              <MapPin className="w-3.5 h-3.5" />
              <span>ÚTVONAL IDE</span>
            </button>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          4. BOTTOM TURN-BY-TURN NAVIGATION DRAWER
          ───────────────────────────────────────────────────────────── */}
      {!tappedRoom && (
        <div className="z-30 bg-white border-t-2 border-[#1A3C2B] p-3 shadow-xl flex flex-col gap-2 max-h-[48vh] overflow-y-auto">
          {currentStep ? (
            <div className="flex flex-col gap-2">
              {/* Header Row: Step counter, floor indicator, and navigation buttons */}
              <div className="flex items-center justify-between gap-2 border-b border-[#1A3C2B]/15 pb-2">
                <div className="flex items-center gap-1.5 min-w-0">
                  <span className="font-mono text-[10px] font-black px-1.5 py-0.5 bg-[#1A3C2B] text-white">
                    {currentStepIndex + 1} / {steps.length}
                  </span>
                  <span className="font-mono text-[10px] font-bold text-[#1A3C2B]/75 uppercase truncate">
                    {currentStep.floorName} ({currentStep.floorShortCode}. szint)
                  </span>
                </div>

                {/* Navigation Action Controls */}
                <div className="flex items-center gap-1 flex-shrink-0">
                  <button
                    onClick={() => setShowFullStepsList(!showFullStepsList)}
                    className={`px-2 py-1.5 border font-mono text-[10px] font-bold flex items-center gap-1 transition-colors ${
                      showFullStepsList
                        ? 'bg-[#1A3C2B] text-white border-[#1A3C2B]'
                        : 'bg-[#F7F7F5] border-[#1A3C2B]/30 text-[#1A3C2B] hover:bg-[#F0F5F2]'
                    }`}
                    title="Összes lépés listája"
                  >
                    <List className="w-3.5 h-3.5" />
                    <span>LÉPÉSEK</span>
                  </button>

                  <button
                    onClick={handlePrevStep}
                    disabled={currentStepIndex === 0}
                    className="p-1.5 px-2.5 border border-[#1A3C2B] bg-[#F7F7F5] disabled:opacity-25 font-mono text-xs font-bold hover:bg-[#F0F5F2] transition-colors"
                    title="Előző lépés"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>

                  <button
                    onClick={handleNextStep}
                    disabled={currentStepIndex === steps.length - 1}
                    className="p-1.5 px-2.5 bg-[#1A3C2B] text-white disabled:opacity-25 font-mono text-xs font-bold hover:bg-[#2A533E] transition-colors"
                    title="Következő lépés"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Main Instruction Display - FULL, UNTRUNCATED TEXT */}
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 bg-[#F0F5F2] border-2 border-[#1A3C2B] flex items-center justify-center flex-shrink-0 mt-0.5 shadow-xs">
                  {renderStepIcon(currentStep)}
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-sans font-bold text-sm text-[#1A3C2B] leading-snug break-words">
                    {currentStep.instruction}
                  </h3>
                  {currentStep.detail && (
                    <p className="font-mono text-[10.5px] text-[#1A3C2B]/75 mt-1 leading-tight">
                      {currentStep.detail}
                      {currentStep.distanceMeters ? ` • kb. ${currentStep.distanceMeters} m` : ''}
                    </p>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-between py-1">
              <span className="font-mono text-xs text-[#1A3C2B]/70">
                Válassz ki egy célállomást a keresőben vagy bökj a térképre!
              </span>
              <button
                onClick={() => {
                  setActiveSearchField('target');
                  setIsSearchDrawerOpen(true);
                }}
                className="px-3 py-1.5 bg-[#1A3C2B] text-white font-mono text-xs font-bold"
              >
                KERESÉS
              </button>
            </div>
          )}

          {/* Full Steps List Drawer (Fully Readable, Multi-Line Cards) */}
          {showFullStepsList && (
            <div className="max-h-60 overflow-y-auto flex flex-col gap-1.5 pt-2 mt-1 border-t-2 border-[#1A3C2B] animate-in slide-in-from-bottom-3 duration-100">
              <div className="flex items-center justify-between font-mono text-[10px] font-bold text-[#1A3C2B] pb-1">
                <span>TELJES ÚTVONALTERV ({steps.length} LÉPÉS):</span>
                <button
                  onClick={() => setShowFullStepsList(false)}
                  className="text-xs px-1 hover:text-red-700 font-bold"
                >
                  ✕ BEZÁRÁS
                </button>
              </div>
              {steps.map((s, idx) => (
                <div
                  key={idx}
                  onClick={() => {
                    setCurrentStepIndex(idx);
                    if (s.floorId !== activeFloor.id) onSelectFloor(s.floorId);
                    setShowFullStepsList(false);
                  }}
                  className={`p-2.5 border cursor-pointer flex items-start justify-between gap-2.5 text-xs transition-all ${
                    idx === currentStepIndex
                      ? 'bg-[#1A3C2B] text-white border-[#1A3C2B] shadow-xs'
                      : 'bg-[#F7F7F5] text-[#1A3C2B] border-[#D0D0C7] hover:bg-[#F0F5F2]'
                  }`}
                >
                  <div className="flex items-start gap-2 min-w-0 flex-1">
                    <span
                      className={`font-mono text-[9px] font-black px-1.5 py-0.5 mt-0.5 flex-shrink-0 ${
                        idx === currentStepIndex ? 'bg-white/20 text-white' : 'bg-[#1A3C2B] text-white'
                      }`}
                    >
                      {idx + 1}.
                    </span>
                    <div className="flex flex-col min-w-0 flex-1">
                      <span className="font-bold leading-snug break-words">{s.instruction}</span>
                      {s.detail && (
                        <span
                          className={`font-mono text-[9.5px] mt-0.5 leading-tight ${
                            idx === currentStepIndex ? 'text-white/80' : 'text-[#1A3C2B]/60'
                          }`}
                        >
                          {s.detail}
                          {s.distanceMeters ? ` • ${s.distanceMeters}m` : ''}
                        </span>
                      )}
                    </div>
                  </div>
                  <span
                    className={`font-mono text-[9px] font-black px-1.5 py-0.5 flex-shrink-0 border ${
                      idx === currentStepIndex
                        ? 'border-white/40 bg-white/10 text-white'
                        : 'border-[#1A3C2B]/30 bg-white text-[#1A3C2B]'
                    }`}
                  >
                    {s.floorShortCode}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          5. SEARCH & ROUTE PLANNING BOTTOM SHEET / MODAL
          ───────────────────────────────────────────────────────────── */}
      {isSearchDrawerOpen && (
        <div className="fixed inset-0 z-50 bg-[#1A3C2B]/50 backdrop-blur-xs flex flex-col justify-end">
          <div className="bg-[#F7F7F5] border-t-2 border-[#1A3C2B] max-h-[90vh] flex flex-col overflow-hidden animate-in slide-in-from-bottom-5 duration-150">
            {/* Drawer Header */}
            <div className="p-3 bg-[#1A3C2B] text-white flex items-center justify-between">
              <span className="font-mono text-xs font-bold uppercase tracking-wider">
                {activeSearchField === 'start' ? '📍 INDULÁSI PONT KIVÁLASZTÁSA' : '★ CÉLÁLLOMÁS KIVÁLASZTÁSA'}
              </span>
              <button
                onClick={() => {
                  setIsSearchDrawerOpen(false);
                  setActiveSearchField(null);
                }}
                className="font-mono text-sm px-1 text-white/80 hover:text-white"
              >
                ✕
              </button>
            </div>

            {/* Origin & Destination Matrix in Drawer */}
            <div className="p-3 bg-white border-b border-[#1A3C2B] flex flex-col gap-2">
              {/* Start Field */}
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-[#047857] flex-shrink-0" />
                <div
                  onClick={() => setActiveSearchField('start')}
                  className={`flex-1 p-2 border font-sans text-xs flex items-center justify-between cursor-pointer ${
                    activeSearchField === 'start' ? 'border-[#047857] bg-emerald-50 ring-1 ring-[#047857]' : 'border-[#1A3C2B]/30 bg-[#F7F7F5]'
                  }`}
                >
                  <span className="font-bold truncate text-[#1A3C2B]">
                    {startRoom ? `${startRoom.room.code} - ${startRoom.room.name}` : 'Indulási pont megadása...'}
                  </span>
                  {startRoom && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        if (onSetStartRoom) onSetStartRoom(null);
                      }}
                      className="font-mono text-xs text-[#1A3C2B]/60 hover:text-red-700 ml-1"
                    >
                      ✕
                    </button>
                  )}
                </div>
              </div>

              {/* Swap Button */}
              <div className="flex justify-center -my-1">
                <button
                  onClick={handleSwapStartAndTarget}
                  className="p-1 border border-[#1A3C2B]/30 bg-white hover:bg-[#F0F5F2] font-mono text-[9px] flex items-center gap-1 font-bold shadow-xs"
                >
                  <ArrowUpDown className="w-3 h-3 text-[#1A3C2B]" />
                  <span>START / CÉL MEGFORDÍTÁSA</span>
                </button>
              </div>

              {/* Target Field */}
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-[#B91C1C] flex-shrink-0" />
                <div
                  onClick={() => setActiveSearchField('target')}
                  className={`flex-1 p-2 border font-sans text-xs flex items-center justify-between cursor-pointer ${
                    activeSearchField === 'target' ? 'border-[#B91C1C] bg-red-50 ring-1 ring-[#B91C1C]' : 'border-[#1A3C2B]/30 bg-[#F7F7F5]'
                  }`}
                >
                  <span className="font-bold truncate text-[#1A3C2B]">
                    {targetRoom ? `${targetRoom.room.code} - ${targetRoom.room.name}` : 'Célállomás megadása...'}
                  </span>
                  {targetRoom && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        if (onSetTargetRoom) onSetTargetRoom(null);
                      }}
                      className="font-mono text-xs text-[#1A3C2B]/60 hover:text-red-700 ml-1"
                    >
                      ✕
                    </button>
                  )}
                </div>
              </div>

              {/* Search Live Input */}
              <div className="relative mt-1">
                <Search className="w-3.5 h-3.5 text-[#1A3C2B]/50 absolute left-2.5 top-3" />
                <input
                  type="text"
                  autoFocus
                  placeholder="Keresés név, teremkód, tanár vagy szint szerint..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-[#F7F7F5] border-2 border-[#1A3C2B] pl-8 pr-3 py-2 font-sans text-xs font-bold text-[#1A3C2B] focus:outline-none placeholder-[#1A3C2B]/50"
                />
              </div>

              {/* Quick Preset Filter Chips */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 font-mono text-[9px]">
                <span className="text-[#1A3C2B]/60 font-bold uppercase flex-shrink-0">GYORSKERESÉS:</span>
                <button
                  onClick={() => setSearchQuery('WC')}
                  className="px-2 py-1 bg-[#F7F7F5] border border-[#1A3C2B]/30 hover:bg-[#1A3C2B] hover:text-white font-bold flex-shrink-0"
                >
                  🚻 Mosdók
                </button>
                <button
                  onClick={() => setSearchQuery('Lift')}
                  className="px-2 py-1 bg-[#F7F7F5] border border-[#1A3C2B]/30 hover:bg-[#1A3C2B] hover:text-white font-bold flex-shrink-0"
                >
                  🛗 Liftek
                </button>
                <button
                  onClick={() => setSearchQuery('Lépcső')}
                  className="px-2 py-1 bg-[#F7F7F5] border border-[#1A3C2B]/30 hover:bg-[#1A3C2B] hover:text-white font-bold flex-shrink-0"
                >
                  🪜 Lépcsők
                </button>
                <button
                  onClick={() => setSearchQuery('Bejárat')}
                  className="px-2 py-1 bg-[#F7F7F5] border border-[#1A3C2B]/30 hover:bg-[#1A3C2B] hover:text-white font-bold flex-shrink-0"
                >
                  🚪 Kijáratok
                </button>
              </div>

              {/* Accessibility Toggle */}
              {onSetPreferences && (
                <label className="flex items-center gap-2 pt-1 border-t border-[#1A3C2B]/20 cursor-pointer font-mono text-[10px] font-bold text-[#1A3C2B]">
                  <input
                    type="checkbox"
                    checked={routePreferences.accessibilityOnly}
                    onChange={(e) =>
                      onSetPreferences({
                        ...routePreferences,
                        accessibilityOnly: e.target.checked,
                        prioritizeElevators: e.target.checked,
                      })
                    }
                    className="accent-[#047857] w-4 h-4 cursor-pointer"
                  />
                  <Accessibility className="w-3.5 h-3.5 text-blue-700" />
                  <span>Akadálymentes útvonal (csak lift, lépcső nélkül)</span>
                </label>
              )}
            </div>

            {/* Results List */}
            <div className="flex-1 overflow-y-auto p-2 flex flex-col gap-1 max-h-72">
              {filteredSearchTargets.length === 0 ? (
                <div className="p-6 text-center font-mono text-xs text-[#1A3C2B]/60">
                  Nincs találat a megadott kifejezésre.
                </div>
              ) : (
                filteredSearchTargets.map((item) => (
                  <div
                    key={`${item.floor.id}-${item.id}`}
                    onClick={() => handleSelectSearchItem(item)}
                    className="p-2.5 bg-white border border-[#D0D0C7] hover:border-[#1A3C2B] hover:bg-[#F0F5F2] cursor-pointer flex items-center justify-between gap-2 transition-colors"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="w-7 h-7 bg-[#F7F7F5] border border-[#1A3C2B]/30 flex items-center justify-center text-xs flex-shrink-0">
                        {item.category === 'transit' ? '🛗' : item.category === 'poi' ? '📍' : '🚪'}
                      </div>
                      <div className="flex flex-col min-w-0">
                        <span className="font-sans font-bold text-xs text-[#1A3C2B] truncate">
                          {item.name}
                        </span>
                        <span className="font-mono text-[9px] text-[#1A3C2B]/70 truncate">
                          {item.floor.name} • {item.subText || item.categoryLabel}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      <span className="font-mono text-[9px] font-bold bg-[#1A3C2B] text-white px-1.5 py-0.5">
                        {item.floor.shortCode}
                      </span>
                      {item.code && (
                        <span className="font-mono text-[10px] font-bold text-[#1A3C2B] bg-[#F7F7F5] border border-[#D0D0C7] px-1.5 py-0.5">
                          {item.code}
                        </span>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MobileWayfinder;

