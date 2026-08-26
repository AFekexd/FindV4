import React, { useState, useEffect, useMemo, useRef } from 'react';
import type { Building, Floor, RouteResult, RouteStep, Room } from '../../types';
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

  // Zoom & Pan state for map
  const [zoom, setZoom] = useState<number>(1);
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const touchStartRef = useRef<{ x: number; y: number; dist?: number }>({ x: 0, y: 0 });

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

  // Auto-switch floor when stepping through route
  useEffect(() => {
    if (currentStep && currentStep.floorId && currentStep.floorId !== activeFloorId) {
      onSelectFloor(currentStep.floorId);
    }
  }, [currentStepIndex, currentStep, activeFloorId, onSelectFloor]);

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

  // Touch handlers for panning & pinching on map
  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 1) {
      touchStartRef.current = { x: e.touches[0].clientX - pan.x, y: e.touches[0].clientY - pan.y };
    } else if (e.touches.length === 2) {
      const dist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      touchStartRef.current = { x: pan.x, y: pan.y, dist };
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 1 && touchStartRef.current.dist === undefined) {
      setPan({
        x: e.touches[0].clientX - touchStartRef.current.x,
        y: e.touches[0].clientY - touchStartRef.current.y,
      });
    } else if (e.touches.length === 2 && touchStartRef.current.dist) {
      const dist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      const factor = dist / touchStartRef.current.dist;
      setZoom((z) => Math.min(3.5, Math.max(0.6, z * factor)));
      touchStartRef.current.dist = dist;
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
            onClick={() => setZoom((z) => Math.min(3.5, z * 1.25))}
            className="p-1.5 hover:bg-[#1A3C2B] hover:text-white border border-[#1A3C2B]/20 text-[#1A3C2B] transition-colors"
            title="Nagyítás"
          >
            <ZoomIn className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => setZoom((z) => Math.max(0.5, z * 0.8))}
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
        </div>

        {/* Vector SVG Scaled/Panned Blueprint Map */}
        <div
          className="w-full h-full flex items-center justify-center transition-transform duration-75"
          style={{
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
            transformOrigin: 'center center',
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

            {/* Rooms */}
            {activeFloor.rooms.map((room) => {
              const isTarget = targetRoomId === room.id;
              const isStart = startRoomId === room.id;
              const pointsStr = room.polygon.map((p) => `${p.x},${p.y}`).join(' ');

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
                  <text
                    x={room.polygon[0].x + 8}
                    y={room.polygon[0].y + 16}
                    fill="#1A3C2B"
                    className="font-mono text-[9px] font-bold pointer-events-none"
                  >
                    {room.code}
                  </text>
                </g>
              );
            })}

            {/* Walls */}
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

            {/* Transit Connectors */}
            {activeFloor.transitConnectors.map((t) => (
              <g key={t.id} transform={`translate(${t.position.x - 18}, ${t.position.y - 18})`}>
                <rect
                  width="36"
                  height="36"
                  fill={t.type === 'elevator' ? '#0E7490' : '#B45309'}
                  stroke="#1A3C2B"
                  strokeWidth="1.5"
                />
                <text
                  x="18"
                  y="22"
                  textAnchor="middle"
                  fill="#FFFFFF"
                  className="font-mono text-[8.5px] font-bold"
                >
                  {t.type === 'elevator' ? 'LIFT' : 'LÉPCSŐ'}
                </text>
              </g>
            ))}

            {/* Active 2D Route Line */}
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
