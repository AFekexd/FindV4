import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import type { Building, Floor, RouteResult, RouteStep, Room, Zone, Door, PointOfInterest } from '../../types';
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
  Eye,
  EyeOff,
  Maximize2,
  DoorOpen,
  Compass,
} from 'lucide-react';

interface MobileWayfinderProps {
  building: Building;
  activeFloorId: string;
  startRoomId: string | null;
  targetRoomId: string | null;
  routeResult: RouteResult | null;
  onSelectFloor: (floorId: string) => void;
  onExitMobileView?: () => void;
}

export const MobileWayfinder: React.FC<MobileWayfinderProps> = ({
  building,
  activeFloorId,
  startRoomId,
  targetRoomId,
  routeResult,
  onSelectFloor,
  onExitMobileView,
}) => {
  const [currentStepIndex, setCurrentStepIndex] = useState<number>(0);
  const [showFullStepsList, setShowFullStepsList] = useState<boolean>(false);
  const [isSpeechEnabled, setIsSpeechEnabled] = useState<boolean>(false);
  const [isCardMinimized, setIsCardMinimized] = useState<boolean>(false);

  // Compass heading state
  const [compassEnabled, setCompassEnabled] = useState<boolean>(false);
  const [compassHeading, setCompassHeading] = useState<number>(0);
  const smoothHeadingRef = useRef<number>(0);

  // Zoom & Pan state for map
  const [zoom, setZoom] = useState<number>(1);
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const mapContainerRef = useRef<HTMLDivElement>(null);

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

    // iOS: webkitCompassHeading gives degrees from magnetic north (0-360)
    if ('webkitCompassHeading' in event && typeof (event as any).webkitCompassHeading === 'number') {
      heading = (event as any).webkitCompassHeading as number;
    } else if (event.alpha !== null) {
      // Android / standard: alpha is rotation around Z axis
      // When absolute is true or deviceorientationabsolute event is used, alpha=0 means magnetic north
      heading = (360 - event.alpha) % 360;
    }

    if (heading !== null && !isNaN(heading)) {
      // Smooth the heading to reduce jitter
      const prev = smoothHeadingRef.current;
      let diff = heading - prev;
      // Handle wrap-around at 0°/360°
      if (diff > 180) diff -= 360;
      if (diff < -180) diff += 360;
      const smoothed = ((prev + diff * 0.25) + 360) % 360;
      smoothHeadingRef.current = smoothed;
      setCompassHeading(smoothed);
    }
  }, []);

  const toggleCompass = useCallback(async () => {
    if (compassEnabled) {
      // Disable
      window.removeEventListener('deviceorientation', handleDeviceOrientation as any, true);
      if ('ondeviceorientationabsolute' in window) {
        window.removeEventListener('deviceorientationabsolute', handleDeviceOrientation as any, true);
      }
      setCompassEnabled(false);
      setCompassHeading(0);
      smoothHeadingRef.current = 0;
      return;
    }

    // Enable – iOS requires explicit permission
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

  // Cleanup listener on unmount
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

  // Helper: rotate screen-space delta into map-space when compass is active
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
      touchStartRef.current = { x: e.touches[0].clientX - pan.x, y: e.touches[0].clientY - pan.y };
    } else if (e.touches.length === 2) {
      const dist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      // Midpoint of the two fingers relative to the container
      const container = mapContainerRef.current;
      const rect = container?.getBoundingClientRect();
      const containerX = rect ? rect.left : 0;
      const containerY = rect ? rect.top : 0;
      const midX = (e.touches[0].clientX + e.touches[1].clientX) / 2 - containerX;
      const midY = (e.touches[0].clientY + e.touches[1].clientY) / 2 - containerY;

      touchStartRef.current = {
        x: pan.x,
        y: pan.y,
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
      const rawDx = e.touches[0].clientX - touchStartRef.current.x - pan.x;
      const rawDy = e.touches[0].clientY - touchStartRef.current.y - pan.y;
      const rotated = rotateToMapSpace(rawDx, rawDy);
      setPan({
        x: pan.x + rotated.dx,
        y: pan.y + rotated.dy,
      });
      // Update start ref so next frame is relative
      touchStartRef.current.x = e.touches[0].clientX - pan.x - rotated.dx;
      touchStartRef.current.y = e.touches[0].clientY - pan.y - rotated.dy;
    } else if (e.touches.length === 2 && touchStartRef.current.dist) {
      const dist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      const scaleFactor = dist / touchStartRef.current.dist;
      const oldZoom = touchStartRef.current.startZoom || 1;
      const newZoom = Math.min(3.5, Math.max(0.6, oldZoom * scaleFactor));

      // Anchor point: the original pinch midpoint relative to container
      const anchorX = touchStartRef.current.midX || 0;
      const anchorY = touchStartRef.current.midY || 0;
      const startPanX = touchStartRef.current.startPanX || 0;
      const startPanY = touchStartRef.current.startPanY || 0;

      // The point under the fingers in "content space" must remain fixed.
      // Content position = (screenPos - pan) / zoom
      // To keep it fixed: newPan = screenPos - contentPos * newZoom
      // contentPos = (anchorX - startPanX) / oldZoom
      // newPanX = anchorX - contentPos * newZoom
      const contentX = (anchorX - startPanX) / oldZoom;
      const contentY = (anchorY - startPanY) / oldZoom;
      const newPanX = anchorX - contentX * newZoom;
      const newPanY = anchorY - contentY * newZoom;

      setZoom(newZoom);
      setPan({ x: newPanX, y: newPanY });
    }
  };

  const resetMapView = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  };

  return (
    <div className="fixed inset-0 z-50 bg-[#EFEFEA] flex flex-col justify-between overflow-hidden select-none font-sans text-[#1A3C2B]">
      {/* 1. TOP HEADER - Floating Pill in Landscape / Full Strip in Portrait */}
      <div
        className={`z-20 transition-all ${
          isLandscape
            ? 'absolute top-2 left-2 right-2 flex items-center justify-between pointer-events-none'
            : 'bg-white border-b-2 border-[#1A3C2B] p-2.5 shadow-xs flex flex-col gap-1'
        }`}
      >
        {isLandscape ? (
          /* Landscape: Ultra-Compact Floating Destination Badge */
          <div className="flex items-center justify-between w-full pointer-events-auto gap-2">
            <div className="bg-white/95 backdrop-blur-md border border-[#1A3C2B] px-3 py-1 flex items-center gap-2 shadow-md">
              <span className="w-2 h-2 bg-[#1A3C2B] rotate-45 inline-block" />
              <span className="font-bold text-xs text-[#1A3C2B] truncate max-w-[200px]">
                {targetRoom ? targetRoom.room.name : building.name}
              </span>
              {targetRoom && (
                <span className="font-mono text-[10px] text-[#1A3C2B]/70 border-l border-[#1A3C2B]/20 pl-1.5">
                  {targetRoom.room.code}
                </span>
              )}
              {routeResult && (
                <span className="bg-[#1A3C2B] text-white px-1.5 py-0.2 font-mono text-[9px] font-bold">
                  ~{routeResult.estimatedTimeMinutes}p • {routeResult.totalDistanceMeters}m
                </span>
              )}
            </div>

            {/* Quick Actions (Audio & Exit) */}
            <div className="flex items-center gap-1.5 bg-white/95 backdrop-blur-md border border-[#1A3C2B] p-1 shadow-md">
              <button
                onClick={() => {
                  const nextState = !isSpeechEnabled;
                  setIsSpeechEnabled(nextState);
                  if (nextState && currentStep) speakInstruction(currentStep.instruction);
                }}
                className={`p-1 border text-xs transition-colors ${
                  isSpeechEnabled ? 'bg-[#1A3C2B] text-white border-[#1A3C2B]' : 'text-[#1A3C2B] border-transparent'
                }`}
                title="Hangos navigáció"
              >
                {isSpeechEnabled ? <Volume2 className="w-3.5 h-3.5" /> : <VolumeX className="w-3.5 h-3.5" />}
              </button>

              {onExitMobileView && (
                <button
                  onClick={onExitMobileView}
                  className="px-2 py-0.5 border border-[#1A3C2B] bg-[#F7F7F5] font-mono text-[9px] font-bold hover:bg-[#EFEFEA]"
                >
                  KILÉPÉS
                </button>
              )}
            </div>
          </div>
        ) : (
          /* Portrait: Standard Clean Mobile Header */
          <>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 bg-[#1A3C2B] rotate-45 inline-block" />
                <span className="font-mono text-[10px] font-bold tracking-wider text-[#1A3C2B]/70 uppercase">
                  {building.name}
                </span>
              </div>

              <div className="flex items-center gap-1">
                <button
                  onClick={() => {
                    const nextState = !isSpeechEnabled;
                    setIsSpeechEnabled(nextState);
                    if (nextState && currentStep) speakInstruction(currentStep.instruction);
                  }}
                  className={`p-1.5 border text-xs ${
                    isSpeechEnabled
                      ? 'bg-[#1A3C2B] text-white border-[#1A3C2B]'
                      : 'bg-[#F7F7F5] text-[#1A3C2B] border-[#1A3C2B]/30'
                  }`}
                >
                  {isSpeechEnabled ? <Volume2 className="w-3.5 h-3.5" /> : <VolumeX className="w-3.5 h-3.5" />}
                </button>

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

            <div className="flex items-start justify-between gap-2">
              <div>
                <h1 className="font-extrabold text-sm leading-tight text-[#1A3C2B]">
                  {targetRoom ? targetRoom.room.name : 'Útvonal Navigáció'}
                </h1>
                <span className="font-mono text-[11px] text-[#1A3C2B]/70">
                  {targetRoom ? `${targetRoom.floor.name} • ${targetRoom.room.code}` : 'Alaprajzi térkép'}
                </span>
              </div>

              {routeResult && (
                <div className="flex items-center gap-1.5 bg-[#1A3C2B] text-white px-2 py-0.5 font-mono text-[11px] font-bold flex-shrink-0">
                  <Clock className="w-3 h-3 text-emerald-400" />
                  <span>~{routeResult.estimatedTimeMinutes}p</span>
                  <span className="opacity-50">•</span>
                  <span>{routeResult.totalDistanceMeters}m</span>
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* 2. FULL-SCREEN INTERACTIVE 2D BLUEPRINT MAP STAGE */}
      <div
        ref={mapContainerRef}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        className="relative flex-1 w-full h-full bg-[#EFEFEA] overflow-hidden touch-none"
      >
        {/* Floor Level Floating Quick Tabs (Positioned smartly) */}
        <div
          className={`absolute z-10 flex items-center gap-1 bg-white/95 backdrop-blur-md border border-[#1A3C2B] p-1 font-mono text-xs shadow-md ${
            isLandscape ? 'top-12 left-2' : 'top-2.5 left-2.5'
          }`}
        >
          {building.floors.map((floor) => {
            const isActive = floor.id === activeFloor.id;
            const isTraversed = routeResult?.floorsTraversed.includes(floor.id);
            return (
              <button
                key={floor.id}
                onClick={() => onSelectFloor(floor.id)}
                className={`px-2 py-1 text-[11px] font-bold transition-all ${
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

        {/* Floating Zoom & Pan Map Controls */}
        <div
          className={`absolute z-10 flex flex-col gap-1 bg-white/95 backdrop-blur-md border border-[#1A3C2B] p-1 shadow-md ${
            isLandscape ? 'top-12 right-2' : 'top-2.5 right-2.5'
          }`}
        >
          <button
            onClick={() => {
              const container = mapContainerRef.current;
              if (!container) { setZoom((z) => Math.min(3.5, z * 1.25)); return; }
              const rect = container.getBoundingClientRect();
              const cx = rect.width / 2;
              const cy = rect.height / 2;
              setZoom((prevZ) => {
                const newZ = Math.min(3.5, prevZ * 1.25);
                const contentX = (cx - pan.x) / prevZ;
                const contentY = (cy - pan.y) / prevZ;
                setPan({ x: cx - contentX * newZ, y: cy - contentY * newZ });
                return newZ;
              });
            }}
            className="p-1.5 hover:bg-[#1A3C2B] hover:text-white border border-[#1A3C2B]/20 text-[#1A3C2B] transition-colors"
            title="Nagyítás"
          >
            <ZoomIn className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => {
              const container = mapContainerRef.current;
              if (!container) { setZoom((z) => Math.max(0.5, z * 0.8)); return; }
              const rect = container.getBoundingClientRect();
              const cx = rect.width / 2;
              const cy = rect.height / 2;
              setZoom((prevZ) => {
                const newZ = Math.max(0.5, prevZ * 0.8);
                const contentX = (cx - pan.x) / prevZ;
                const contentY = (cy - pan.y) / prevZ;
                setPan({ x: cx - contentX * newZ, y: cy - contentY * newZ });
                return newZ;
              });
            }}
            className="p-1.5 hover:bg-[#1A3C2B] hover:text-white border border-[#1A3C2B]/20 text-[#1A3C2B] transition-colors"
            title="Kicsinyítés"
          >
            <ZoomOut className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={resetMapView}
            className="p-1.5 hover:bg-[#1A3C2B] hover:text-white border border-[#1A3C2B]/20 text-[#1A3C2B] transition-colors"
            title="Középre állítás"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
          <div className="h-px w-full bg-[#1A3C2B]/20" />
          <button
            onClick={toggleCompass}
            className={`p-1.5 border transition-colors ${
              compassEnabled
                ? 'bg-[#047857] text-white border-[#047857]'
                : 'hover:bg-[#1A3C2B] hover:text-white border-[#1A3C2B]/20 text-[#1A3C2B]'
            }`}
            title={compassEnabled ? 'Iránytű kikapcsolása' : 'Iránytű bekapcsolása – a térkép a haladási irány szerint forog'}
          >
            <Compass className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Floating North Arrow Indicator (visible when compass is active) */}
        {compassEnabled && (
          <div
            className={`absolute z-10 flex flex-col items-center gap-0.5 ${
              isLandscape ? 'bottom-2 right-2' : 'bottom-2.5 right-2.5'
            }`}
          >
            <div
              className="w-10 h-10 bg-white/95 backdrop-blur-md border-2 border-[#1A3C2B] rounded-full flex items-center justify-center shadow-md"
              style={{
                transform: `rotate(${-compassHeading}deg)`,
                transition: 'transform 0.3s ease-out',
              }}
            >
              <svg width="20" height="20" viewBox="0 0 20 20">
                {/* North arrow (red) */}
                <polygon points="10,1 7,10 10,8 13,10" fill="#B91C1C" />
                {/* South arrow (gray) */}
                <polygon points="10,19 7,10 10,12 13,10" fill="#94A3B8" />
              </svg>
            </div>
            <span className="font-mono text-[8px] font-bold text-[#1A3C2B] bg-white/90 px-1 rounded">
              {Math.round(compassHeading)}°
            </span>
          </div>
        )}

        {/* Compass Rotation Wrapper */}
        <div
          className="w-full h-full"
          style={{
            transform: compassEnabled ? `rotate(${-compassHeading}deg)` : undefined,
            transformOrigin: 'center center',
            transition: 'transform 0.3s ease-out',
          }}
        >
          {/* Pan/Zoom Transform Wrapper */}
          <div
            className="w-full h-full flex items-center justify-center transition-transform duration-75"
            style={{
              transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
              transformOrigin: '0 0',
            }}
          >
          <svg
            viewBox={`0 0 ${activeFloor.width} ${activeFloor.height}`}
            className="w-full h-full max-h-[100vh] object-contain p-2"
          >
            {/* Subtle Grid */}
            <defs>
              <pattern id="mobile-grid" width="40" height="40" patternUnits="userSpaceOnUse">
                <path d="M 40 0 L 0 0 0 40" fill="none" stroke="rgba(26, 60, 43, 0.08)" strokeWidth="1" />
              </pattern>
            </defs>
            <rect width={activeFloor.width} height={activeFloor.height} fill="#F7F7F5" />
            <rect width={activeFloor.width} height={activeFloor.height} fill="url(#mobile-grid)" />

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

            {/* 0. ZONES LAYER (Atriums, Lobbies, Courtyards) */}
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
                  {/* Zone Center Label */}
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
              const pointsStr = room.polygon.map((p) => `${p.x},${p.y}`).join(' ');
              const centroid = polygonCentroid(room.polygon);
              const area = polygonAreaInSquareMeters(room.polygon);

              // Compute room geometric scale for adaptive labels
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
                strokeWidth = 3;
              } else if (isStart) {
                fillColor = 'rgba(4, 120, 87, 0.25)';
                strokeColor = '#047857';
                strokeWidth = 3;
              }

              return (
                <g key={room.id}>
                  <polygon
                    points={pointsStr}
                    fill={fillColor}
                    stroke={strokeColor}
                    strokeWidth={strokeWidth}
                  />

                  {/* Adaptive Room Labels (matching desktop quality) */}
                  <g
                    transform={`translate(${centroid.x}, ${centroid.y})`}
                    className="pointer-events-none select-none"
                  >
                    {isTinyRoom ? (
                      /* Tiny Room: compact single badge */
                      <g>
                        <rect x="-16" y="-7" width="32" height="14" fill="#1A3C2B" rx="2" />
                        <text x="0" y="3" textAnchor="middle" fill="#F7F7F5" className="font-mono text-[8px] font-bold">
                          {room.code || room.name.slice(0, 5)}
                        </text>
                      </g>
                    ) : isSmallRoom ? (
                      /* Small Room: 2-line label */
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
                      /* Normal/Large Room: 3-line layout */
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

                  {/* Start / Target Markers */}
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
                  {/* Wall cutout opening */}
                  <line
                    x1={door.start.x} y1={door.start.y}
                    x2={door.end.x} y2={door.end.y}
                    stroke="#FFFFFF" strokeWidth="6" strokeLinecap="square"
                  />
                  {/* Threshold dotted line */}
                  <line
                    x1={door.start.x} y1={door.start.y}
                    x2={door.end.x} y2={door.end.y}
                    stroke="#94A3B8" strokeWidth="1" strokeDasharray="2 2"
                  />
                  {/* Door jamb ticks */}
                  <line
                    x1={door.start.x - unitNorm.x * 2.5} y1={door.start.y - unitNorm.y * 2.5}
                    x2={door.start.x + unitNorm.x * 2.5} y2={door.start.y + unitNorm.y * 2.5}
                    stroke="#1A3C2B" strokeWidth="1.8"
                  />
                  <line
                    x1={door.end.x - unitNorm.x * 2.5} y1={door.end.y - unitNorm.y * 2.5}
                    x2={door.end.x + unitNorm.x * 2.5} y2={door.end.y + unitNorm.y * 2.5}
                    stroke="#1A3C2B" strokeWidth="1.8"
                  />
                  {/* Door swing arc */}
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
                      <line x1={door.start.x} y1={door.start.y} x2={leaf1End.x} y2={leaf1End.y} stroke="#1A3C2B" strokeWidth="2" strokeLinecap="round" />
                      <line x1={door.end.x} y1={door.end.y} x2={leaf2End.x} y2={leaf2End.y} stroke="#1A3C2B" strokeWidth="2" strokeLinecap="round" />
                    </>
                  ) : (
                    <>
                      <path
                        d={`M ${door.start.x} ${door.start.y} L ${door.end.x} ${door.end.y} A ${doorWidth} ${doorWidth} 0 0 0 ${leafEnd.x} ${leafEnd.y} Z`}
                        fill="rgba(4, 120, 87, 0.05)" stroke="#059669" strokeWidth="0.9" strokeDasharray="2 1.5"
                      />
                      <line x1={door.start.x} y1={door.start.y} x2={leafEnd.x} y2={leafEnd.y} stroke="#1A3C2B" strokeWidth="2" strokeLinecap="round" />
                    </>
                  )}
                </g>
              );
            })}

            {/* 4. TRANSIT CONNECTORS (Stairs, Elevators) */}
            {activeFloor.transitConnectors.map((t) => (
              <g key={t.id} transform={`translate(${t.position.x - t.width / 2}, ${t.position.y - t.height / 2})`}>
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
                  className="font-mono text-[8.5px] font-bold"
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
                <g key={poi.id} transform={`translate(${poi.position.x}, ${poi.position.y})`}>
                  <circle
                    r="10"
                    fill={poiFill}
                    stroke={poiStroke}
                    strokeWidth={isPoiStart || isPoiTarget ? 2.5 : 1.8}
                  />
                  <text
                    x="0" y="3.5"
                    textAnchor="middle"
                    fill={poiStroke}
                    className="font-mono text-[7px] font-black pointer-events-none select-none"
                  >
                    {poi.type === 'entrance' ? '⇥' :
                     poi.type === 'exit' ? '⇤' :
                     poi.type === 'fire_exit' ? '🔥' :
                     poi.type === 'accessible_entrance' ? '♿' :
                     poi.type === 'restroom_all' || poi.type === 'restroom_men' || poi.type === 'restroom_women' || poi.type === 'restroom_accessible' ? 'WC' :
                     poi.type === 'water' ? '💧' :
                     poi.type === 'first_aid' ? '➕' :
                     poi.type === 'coffee' ? '☕' :
                     poi.type === 'reception' ? 'ℹ' :
                     '•'}
                  </text>
                  {/* POI name label below */}
                  {poi.name && (
                    <text
                      x="0" y="20"
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

            {/* 6. ACTIVE 2D ROUTE LINE */}
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

                {/* Current Step Focus Beacon */}
                {currentStep && currentStep.floorId === activeFloor.id && (
                  <g transform={`translate(${currentStep.coordinates.x}, ${currentStep.coordinates.y})`}>
                    <circle r="16" fill="none" stroke="#047857" strokeWidth="2" className="animate-ping" />
                    <circle r="7" fill="#047857" stroke="#FFFFFF" strokeWidth="2" />
                  </g>
                )}
              </g>
            )}
          </svg>
        </div>
      </div>
    </div>

      {/* 3. BOTTOM NAVIGATION DRAWER - Compact Floating Dock in Landscape */}
      <div
        className={`z-30 transition-all ${
          isLandscape
            ? 'absolute bottom-2 left-1/2 -translate-x-1/2 w-[94%] max-w-xl bg-white/95 backdrop-blur-md border-2 border-[#1A3C2B] p-2 shadow-2xl'
            : 'bg-white border-t-2 border-[#1A3C2B] p-3 shadow-xl flex flex-col gap-2'
        }`}
      >
        {currentStep ? (
          <div>
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2.5 flex-1 min-w-0">
                <div className="w-8 h-8 sm:w-10 sm:h-10 bg-[#F0F5F2] border border-[#1A3C2B] flex items-center justify-center flex-shrink-0">
                  {renderStepIcon(currentStep)}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-[9px] font-bold text-[#1A3C2B]/60 uppercase">
                      {currentStepIndex + 1} / {steps.length} • {currentStep.floorName}
                    </span>
                  </div>
                  <h3 className="font-bold text-xs sm:text-sm text-[#1A3C2B] leading-tight truncate">
                    {currentStep.instruction}
                  </h3>
                </div>
              </div>

              {/* Action Buttons: Full List & Step Controls */}
              <div className="flex items-center gap-1.5 flex-shrink-0">
                <button
                  onClick={() => setShowFullStepsList(!showFullStepsList)}
                  className="p-1.5 border border-[#1A3C2B]/30 hover:bg-[#F0F5F2] flex items-center gap-1 font-mono text-[9px] font-bold"
                  title="Összes lépés listája"
                >
                  <List className="w-3 h-3" />
                  <span className="hidden sm:inline">{showFullStepsList ? 'ELREJTÉS' : 'LISTA'}</span>
                </button>

                <button
                  onClick={handlePrevStep}
                  disabled={currentStepIndex === 0}
                  className="p-1.5 sm:px-2.5 sm:py-1 border border-[#1A3C2B] bg-[#F7F7F5] disabled:opacity-25 font-mono text-xs font-bold flex items-center gap-1"
                  title="Előző lépés"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">ELŐZŐ</span>
                </button>

                <button
                  onClick={handleNextStep}
                  disabled={currentStepIndex === steps.length - 1}
                  className="p-1.5 sm:px-3 sm:py-1 bg-[#1A3C2B] text-white disabled:opacity-25 font-mono text-xs font-bold flex items-center gap-1 shadow-xs"
                  title="Következő lépés"
                >
                  <span className="hidden sm:inline">KÖVETKEZŐ</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="text-center py-1 font-mono text-xs text-[#1A3C2B]/70">
            Nincs aktív útvonal kiválasztva.
          </div>
        )}

        {/* Expandable Full Steps List Drawer */}
        {showFullStepsList && (
          <div className="max-h-44 overflow-y-auto flex flex-col gap-1 pt-2 mt-2 border-t border-[#1A3C2B]/20 animate-in slide-in-from-bottom-3 duration-100">
            {steps.map((s, idx) => (
              <div
                key={idx}
                onClick={() => {
                  setCurrentStepIndex(idx);
                  if (s.floorId !== activeFloor.id) onSelectFloor(s.floorId);
                  setShowFullStepsList(false);
                }}
                className={`p-1.5 border cursor-pointer flex items-center justify-between text-xs transition-colors ${
                  idx === currentStepIndex
                    ? 'bg-[#1A3C2B] text-white border-[#1A3C2B]'
                    : 'bg-[#F7F7F5] text-[#1A3C2B] border-[#D0D0C7] hover:bg-[#F0F5F2]'
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className="font-mono text-[9px] font-bold px-1 bg-white/20">
                    {idx + 1}.
                  </span>
                  <span className="font-medium truncate max-w-[280px]">{s.instruction}</span>
                </div>
                <span className="font-mono text-[9px] opacity-75">{s.floorShortCode}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
