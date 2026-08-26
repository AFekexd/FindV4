import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import type { Building, Floor, RouteResult, Point } from '../../types';
import {
  RotateCcw,
  ZoomIn,
  ZoomOut,
  Sliders,
  Layers,
  ArrowUpRight,
  Maximize2,
  Box,
  Move,
  RotateCw,
} from 'lucide-react';

interface Isometric3DViewProps {
  building: Building;
  activeFloorId: string;
  routeResult: RouteResult | null;
  onSelectFloor: (floorId: string) => void;
  onNavigateTo2DEditor: (floorId: string) => void;
  className?: string;
}

export const Isometric3DView: React.FC<Isometric3DViewProps> = ({
  building,
  activeFloorId,
  routeResult,
  onSelectFloor,
  onNavigateTo2DEditor,
  className = '',
}) => {
  // 3D Camera State
  const [pitch, setPitch] = useState<number>(60); // 15 to 85 deg
  const [yaw, setYaw] = useState<number>(-35); // -180 to 180 deg
  const [zoom, setZoom] = useState<number>(0.85);
  const [floorSpacing, setFloorSpacing] = useState<number>(160); // px vertical gap
  const [isExploded, setIsExploded] = useState<boolean>(false);
  const [panOffset, setPanOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [dragMode, setDragMode] = useState<'rotate' | 'pan'>('rotate');
  const [showSlidersPanel, setShowSlidersPanel] = useState<boolean>(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const isDraggingRef = useRef<boolean>(false);
  const lastMousePosRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const dragModeRef = useRef<'rotate' | 'pan'>('rotate');

  // Keep dragModeRef in sync
  useEffect(() => {
    dragModeRef.current = dragMode;
  }, [dragMode]);

  // Floors ordered from bottom (level 0) to top (level N)
  const sortedFloors = useMemo(() => {
    return [...building.floors].sort((a, b) => a.level - b.level);
  }, [building]);

  // Group transit shafts across floors
  const transitShafts = useMemo(() => {
    const map = new Map<
      string,
      {
        groupId: string;
        name: string;
        type: string;
        positions: { floorLevel: number; pos: Point; floorId: string }[];
      }
    >();
    for (const floor of building.floors) {
      for (const t of floor.transitConnectors) {
        if (!map.has(t.transitGroupId)) {
          map.set(t.transitGroupId, {
            groupId: t.transitGroupId,
            name: t.name,
            type: t.type,
            positions: [],
          });
        }
        map.get(t.transitGroupId)!.positions.push({
          floorLevel: floor.level,
          pos: t.position,
          floorId: floor.id,
        });
      }
    }
    return Array.from(map.values());
  }, [building]);

  // Native Wheel Event listener to handle zoom without passive listener conflicts
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const onWheelHandler = (e: WheelEvent) => {
      e.preventDefault();
      const zoomFactor = e.deltaY > 0 ? 0.92 : 1.08;
      setZoom((prev) => Math.min(2.5, Math.max(0.25, prev * zoomFactor)));
    };

    el.addEventListener('wheel', onWheelHandler, { passive: false });
    return () => {
      el.removeEventListener('wheel', onWheelHandler);
    };
  }, []);

  // Global Pointer Dragging for high-precision 60fps tracking
  useEffect(() => {
    const handlePointerMove = (e: PointerEvent) => {
      if (!isDraggingRef.current) return;
      const dx = e.clientX - lastMousePosRef.current.x;
      const dy = e.clientY - lastMousePosRef.current.y;
      lastMousePosRef.current = { x: e.clientX, y: e.clientY };

      if (dragModeRef.current === 'rotate') {
        setYaw((prev) => {
          let next = prev + dx * 0.45;
          while (next > 180) next -= 360;
          while (next < -180) next += 360;
          return Math.round(next * 10) / 10;
        });
        setPitch((prev) => {
          const next = prev - dy * 0.35;
          return Math.round(Math.min(85, Math.max(15, next)) * 10) / 10;
        });
      } else {
        setPanOffset((prev) => ({
          x: prev.x + dx,
          y: prev.y + dy,
        }));
      }
    };

    const handlePointerUp = () => {
      isDraggingRef.current = false;
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };
  }, []);

  const handlePointerDownContainer = (e: React.PointerEvent) => {
    // If middle click or holding Space/Shift, pan instead of rotate
    if (e.button === 1 || e.shiftKey) {
      dragModeRef.current = 'pan';
      setDragMode('pan');
    } else {
      dragModeRef.current = 'rotate';
      setDragMode('rotate');
    }
    isDraggingRef.current = true;
    lastMousePosRef.current = { x: e.clientX, y: e.clientY };
  };

  const resetCamera = () => {
    setPitch(60);
    setYaw(-35);
    setZoom(0.85);
    setPanOffset({ x: 0, y: 0 });
    setIsExploded(false);
    setFloorSpacing(160);
  };

  const currentSpacing = isExploded ? floorSpacing * 1.8 : floorSpacing;

  return (
    <div
      ref={containerRef}
      onPointerDown={handlePointerDownContainer}
      className={`relative w-full h-full bg-[#EFEFEA] overflow-hidden select-none border border-[#1A3C2B] ${className}`}
      style={{
        perspective: '1400px',
        cursor: dragMode === 'rotate' ? 'grab' : 'move',
        touchAction: 'none',
      }}
    >
      {/* 3D HUD Top Left Title & Institution Telemetry */}
      <div
        className="absolute top-3 left-3 z-20 flex items-center gap-2 pointer-events-auto"
        onPointerDown={(e) => e.stopPropagation()}
      >
        <div className="bg-[#F7F7F5] border border-[#1A3C2B] px-3.5 py-2 flex items-center gap-3 shadow-xs">
          <div className="w-3 h-3 bg-[#1A3C2B] rotate-45" />
          <div className="flex flex-col font-mono text-[11px] leading-tight">
            <span className="font-bold tracking-wider text-[#1A3C2B] uppercase">
              {building.name} // 3D IZOMETRIKUS NÉZET
            </span>
            <span className="text-[#1A3C2B]/70 text-[9px]">
              {building.floors.length} SZINT • FORGATÁS: {Math.round(yaw)}° / DŐLÉS: {Math.round(pitch)}° / NAGYÍTÁS: {Math.round(zoom * 100)}%
            </span>
          </div>
        </div>
      </div>

      {/* 3D Floating Camera Controls (Right Top Bar) */}
      <div
        className="absolute top-3 right-3 z-20 flex items-center gap-1.5 bg-[#F7F7F5] border border-[#1A3C2B] p-1.5 font-mono text-xs shadow-xs pointer-events-auto"
        onPointerDown={(e) => e.stopPropagation()}
      >
        <button
          onClick={() => setShowSlidersPanel(!showSlidersPanel)}
          className={`px-2 py-1 border transition-colors flex items-center gap-1 text-[11px] font-bold ${
            showSlidersPanel
              ? 'bg-[#1A3C2B] text-white border-[#1A3C2B]'
              : 'bg-white text-[#1A3C2B] border-[#1A3C2B]/40 hover:bg-[#F0F5F2]'
          }`}
          title="Kamera és Szintköz Finomhangoló Csúszkák"
        >
          <Sliders className="w-3.5 h-3.5" />
          <span>VEZÉRLŐPULT</span>
        </button>

        <button
          onClick={() => setIsExploded(!isExploded)}
          className={`px-2.5 py-1 border transition-colors flex items-center gap-1 text-[11px] font-bold ${
            isExploded
              ? 'bg-[#1A3C2B] text-white border-[#1A3C2B]'
              : 'bg-white text-[#1A3C2B] border-[#1A3C2B]/40 hover:bg-[#F0F5F2]'
          }`}
          title="Szintek szétrobbantása / összehúzása"
        >
          <span>{isExploded ? 'KOMPAKT' : 'SZÉTHÚZÁS'}</span>
        </button>

        <button
          onClick={() => setZoom((z) => Math.min(2.5, Math.round((z + 0.15) * 100) / 100))}
          className="p-1.5 border border-[#1A3C2B]/40 bg-white text-[#1A3C2B] hover:bg-[#1A3C2B] hover:text-white transition-colors"
          title="Nagyítás"
        >
          <ZoomIn className="w-3.5 h-3.5" />
        </button>

        <button
          onClick={() => setZoom((z) => Math.max(0.25, Math.round((z - 0.15) * 100) / 100))}
          className="p-1.5 border border-[#1A3C2B]/40 bg-white text-[#1A3C2B] hover:bg-[#1A3C2B] hover:text-white transition-colors"
          title="Kicsinyítés"
        >
          <ZoomOut className="w-3.5 h-3.5" />
        </button>

        <button
          onClick={resetCamera}
          className="p-1.5 border border-[#1A3C2B]/40 bg-white text-[#1A3C2B] hover:bg-[#1A3C2B] hover:text-white transition-colors"
          title="Alaphelyzetbe állítás"
        >
          <RotateCcw className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Floating Sliders Control Panel */}
      {showSlidersPanel && (
        <div
          className="absolute top-14 right-3 z-30 bg-[#F7F7F5] border-2 border-[#1A3C2B] p-3 shadow-xl w-64 flex flex-col gap-2.5 font-mono text-xs pointer-events-auto"
          onPointerDown={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between border-b border-[#1A3C2B]/20 pb-1">
            <span className="font-bold text-[10px] uppercase">3D KAMERA FINOMHANGOLÁS</span>
            <button onClick={() => setShowSlidersPanel(false)} className="text-[#1A3C2B]/60 hover:text-[#1A3C2B]">✕</button>
          </div>

          <div className="flex flex-col gap-0.5">
            <div className="flex justify-between text-[9px] font-bold">
              <span>FORGATÁS (YAW):</span>
              <span>{Math.round(yaw)}°</span>
            </div>
            <input
              type="range"
              min="-180"
              max="180"
              value={yaw}
              onChange={(e) => setYaw(parseFloat(e.target.value))}
              className="accent-[#1A3C2B]"
            />
          </div>

          <div className="flex flex-col gap-0.5">
            <div className="flex justify-between text-[9px] font-bold">
              <span>DŐLÉSSZÖG (PITCH):</span>
              <span>{Math.round(pitch)}°</span>
            </div>
            <input
              type="range"
              min="15"
              max="85"
              value={pitch}
              onChange={(e) => setPitch(parseFloat(e.target.value))}
              className="accent-[#1A3C2B]"
            />
          </div>

          <div className="flex flex-col gap-0.5">
            <div className="flex justify-between text-[9px] font-bold">
              <span>NAGYÍTÁS (ZOOM):</span>
              <span>{Math.round(zoom * 100)}%</span>
            </div>
            <input
              type="range"
              min="0.25"
              max="2.5"
              step="0.05"
              value={zoom}
              onChange={(e) => setZoom(parseFloat(e.target.value))}
              className="accent-[#1A3C2B]"
            />
          </div>

          <div className="flex flex-col gap-0.5">
            <div className="flex justify-between text-[9px] font-bold">
              <span>SZINTEK KÖZTÁVOLSÁGA:</span>
              <span>{floorSpacing}px</span>
            </div>
            <input
              type="range"
              min="70"
              max="300"
              step="5"
              value={floorSpacing}
              onChange={(e) => setFloorSpacing(parseInt(e.target.value))}
              className="accent-[#1A3C2B]"
            />
          </div>
        </div>
      )}

      {/* Preset View Angles Pills (Bottom Left) */}
      <div
        className="absolute bottom-4 left-4 z-20 flex items-center gap-1.5 bg-[#F7F7F5] border border-[#1A3C2B] p-1.5 font-mono text-[10px] shadow-xs pointer-events-auto"
        onPointerDown={(e) => e.stopPropagation()}
      >
        <span className="font-bold text-[#1A3C2B] px-1">NÉZETEK:</span>
        <button
          onClick={() => { setPitch(60); setYaw(-35); }}
          className="px-2 py-1 bg-white border border-[#1A3C2B]/30 hover:bg-[#1A3C2B] hover:text-white transition-colors font-bold"
        >
          IZOMETRIKUS
        </button>
        <button
          onClick={() => { setPitch(25); setYaw(0); }}
          className="px-2 py-1 bg-white border border-[#1A3C2B]/30 hover:bg-[#1A3C2B] hover:text-white transition-colors font-bold"
        >
          ELÖLNÉZET
        </button>
        <button
          onClick={() => { setPitch(25); setYaw(90); }}
          className="px-2 py-1 bg-white border border-[#1A3C2B]/30 hover:bg-[#1A3C2B] hover:text-white transition-colors font-bold"
        >
          OLDALNÉZET
        </button>
        <button
          onClick={() => { setPitch(85); setYaw(0); }}
          className="px-2 py-1 bg-white border border-[#1A3C2B]/30 hover:bg-[#1A3C2B] hover:text-white transition-colors font-bold"
        >
          FELÜLNÉZET
        </button>
      </div>

      {/* Floor Quick Selector & Jump to 2D (Right Bottom) */}
      <div
        className="absolute bottom-4 right-4 z-20 flex flex-col gap-1 bg-[#F7F7F5] border border-[#1A3C2B] p-2 max-w-xs font-mono text-xs shadow-xs pointer-events-auto"
        onPointerDown={(e) => e.stopPropagation()}
      >
        <span className="text-[9px] uppercase font-bold text-[#1A3C2B]/70 border-b border-[#1A3C2B]/20 pb-1">
          SZINT KIVÁLASZTÁSA & 2D UGRÁS
        </span>
        <div className="flex flex-col gap-1 mt-1 max-h-40 overflow-y-auto">
          {sortedFloors.map((floor) => {
            const isActive = floor.id === activeFloorId;
            const isTraversed = routeResult?.floorsTraversed.includes(floor.id);
            return (
              <div
                key={floor.id}
                className={`flex items-center justify-between p-1.5 border transition-all ${
                  isActive
                    ? 'bg-[#1A3C2B] text-white border-[#1A3C2B]'
                    : isTraversed
                    ? 'bg-emerald-50 border-emerald-600 text-[#1A3C2B]'
                    : 'bg-white text-[#1A3C2B] border-[#D0D0C7] hover:border-[#1A3C2B]'
                }`}
              >
                <button
                  onClick={() => onSelectFloor(floor.id)}
                  className="flex items-center gap-1.5 text-left flex-1 min-w-0"
                >
                  <span className="font-bold text-[10px] px-1 bg-[#1A3C2B]/20">{floor.shortCode}</span>
                  <span className="truncate text-[11px] font-sans font-medium">{floor.name}</span>
                </button>

                <button
                  onClick={() => onNavigateTo2DEditor(floor.id)}
                  className={`p-1 border text-[9px] ml-1 transition-colors ${
                    isActive
                      ? 'border-white text-white hover:bg-white hover:text-[#1A3C2B]'
                      : 'border-[#1A3C2B] text-[#1A3C2B] hover:bg-[#1A3C2B] hover:text-white'
                  }`}
                  title="Megnyitás a 2D CAD szerkesztőben"
                >
                  <ArrowUpRight className="w-3 h-3" />
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* Central 3D Perspective Stage */}
      <div className="w-full h-full flex items-center justify-center pointer-events-none">
        <div
          style={{
            transform: `translate(${panOffset.x}px, ${panOffset.y}px) scale(${zoom}) rotateX(${pitch}deg) rotateZ(${yaw}deg)`,
            transformStyle: 'preserve-3d',
            willChange: 'transform',
          }}
          className="relative w-[1000px] h-[720px] pointer-events-auto"
        >
          {/* Vertical Connecting Transit Shaft Pillars */}
          {transitShafts.map((shaft) => {
            if (shaft.positions.length < 2) return null;
            const minLvl = Math.min(...shaft.positions.map((p) => p.floorLevel));
            const maxLvl = Math.max(...shaft.positions.map((p) => p.floorLevel));
            const pos = shaft.positions[0].pos;
            const heightPx = (maxLvl - minLvl) * currentSpacing;
            const isElevator = shaft.type === 'elevator';

            return (
              <div
                key={shaft.groupId}
                style={{
                  position: 'absolute',
                  left: `${pos.x - 24}px`,
                  top: `${pos.y - 24}px`,
                  width: '48px',
                  height: '48px',
                  transform: `translateZ(${minLvl * currentSpacing}px)`,
                  transformStyle: 'preserve-3d',
                }}
                className="pointer-events-none"
              >
                {/* 3D Vertical Shaft Pillar Box */}
                <div
                  style={{
                    position: 'absolute',
                    width: '48px',
                    height: `${heightPx}px`,
                    transform: 'rotateX(-90deg) translateZ(-24px)',
                    transformOrigin: 'top center',
                    backgroundColor: isElevator ? 'rgba(14, 116, 144, 0.22)' : 'rgba(180, 83, 9, 0.22)',
                    border: `1.5px dashed ${isElevator ? '#0E7490' : '#B45309'}`,
                    backdropFilter: 'blur(2px)',
                  }}
                  className="flex items-center justify-center"
                >
                  <span className="font-mono text-[9px] font-bold tracking-wider text-[#1A3C2B] rotate-90 bg-white/90 px-1 border border-[#1A3C2B]/30 shadow-xs">
                    {shaft.name}
                  </span>
                </div>
              </div>
            );
          })}

          {/* Render Each Floor as a 3D Layer Slab */}
          {sortedFloors.map((floor) => {
            const isActive = floor.id === activeFloorId;
            const zElevation = floor.level * currentSpacing;

            return (
              <div
                key={floor.id}
                onClick={(e) => {
                  e.stopPropagation();
                  onSelectFloor(floor.id);
                }}
                style={{
                  position: 'absolute',
                  left: 0,
                  top: 0,
                  width: `${floor.width}px`,
                  height: `${floor.height}px`,
                  transform: `translateZ(${zElevation}px)`,
                  transformStyle: 'preserve-3d',
                }}
                className={`group cursor-pointer rounded-none transition-shadow ${
                  isActive
                    ? 'ring-2 ring-[#1A3C2B] shadow-2xl'
                    : 'hover:ring-1 hover:ring-[#1A3C2B]/60'
                }`}
              >
                {/* SVG Vector Blueprint Floor Slab */}
                <svg
                  viewBox={`0 0 ${floor.width} ${floor.height}`}
                  className="w-full h-full overflow-visible"
                  style={{
                    backgroundColor: isActive ? 'rgba(255, 255, 255, 0.94)' : 'rgba(247, 247, 245, 0.88)',
                    border: `2px solid ${isActive ? '#1A3C2B' : 'rgba(26, 60, 43, 0.5)'}`,
                  }}
                >
                  {/* Grid Background */}
                  <defs>
                    <pattern id={`grid-3d-${floor.id}`} width="40" height="40" patternUnits="userSpaceOnUse">
                      <path d="M 40 0 L 0 0 0 40" fill="none" stroke="rgba(26, 60, 43, 0.08)" strokeWidth="1" />
                    </pattern>
                  </defs>
                  <rect width={floor.width} height={floor.height} fill={`url(#grid-3d-${floor.id})`} />

                  {/* Rooms */}
                  {floor.rooms.map((room) => {
                    const pointsStr = room.polygon.map((p) => `${p.x},${p.y}`).join(' ');
                    return (
                      <g key={room.id}>
                        <polygon
                          points={pointsStr}
                          fill={room.colorHatch || 'rgba(26, 60, 43, 0.06)'}
                          stroke="#1A3C2B"
                          strokeWidth="1.5"
                        />
                        <text
                          x={room.polygon[0].x + 12}
                          y={room.polygon[0].y + 18}
                          fill="#1A3C2B"
                          className="font-mono text-[9px] font-bold pointer-events-none"
                        >
                          {room.code}
                        </text>
                      </g>
                    );
                  })}

                  {/* Walls */}
                  {floor.walls.map((wall) => (
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

                  {/* Doors */}
                  {floor.doors.map((door) => (
                    <line
                      key={door.id}
                      x1={door.start.x}
                      y1={door.start.y}
                      x2={door.end.x}
                      y2={door.end.y}
                      stroke="#FFFFFF"
                      strokeWidth="4"
                    />
                  ))}

                  {/* Transit Connectors */}
                  {floor.transitConnectors.map((t) => (
                    <g key={t.id} transform={`translate(${t.position.x - 20}, ${t.position.y - 20})`}>
                      <rect
                        width="40"
                        height="40"
                        fill={t.type === 'elevator' ? '#0E7490' : '#B45309'}
                        stroke="#1A3C2B"
                        strokeWidth="1.5"
                      />
                      <text
                        x="20"
                        y="24"
                        textAnchor="middle"
                        fill="#FFFFFF"
                        className="font-mono text-[9px] font-bold"
                      >
                        {t.type === 'elevator' ? 'LIFT' : 'LÉPCSŐ'}
                      </text>
                    </g>
                  ))}

                  {/* Active 2D Route Segment on this floor */}
                  {routeResult && (
                    <g>
                      {(() => {
                        const floorNodes = routeResult.pathNodes.filter((n) => n.floorId === floor.id);
                        if (floorNodes.length < 2) return null;
                        const d = floorNodes.map((n, i) => `${i === 0 ? 'M' : 'L'} ${n.position.x} ${n.position.y}`).join(' ');
                        return (
                          <>
                            <path
                              d={d}
                              fill="none"
                              stroke="#047857"
                              strokeWidth="6"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeDasharray="8 6"
                              className="animate-pulse"
                            />
                            {floorNodes.map((n, i) => (
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
                          </>
                        );
                      })()}
                    </g>
                  )}
                </svg>

                {/* Floor Level Floating Tag Badge in 3D */}
                <div
                  style={{
                    position: 'absolute',
                    top: '-16px',
                    left: '0px',
                    transform: 'rotateX(-60deg)',
                    transformOrigin: 'bottom left',
                  }}
                  className={`px-3 py-1 font-mono text-[11px] font-bold flex items-center gap-2 border shadow-sm ${
                    isActive
                      ? 'bg-[#1A3C2B] text-white border-[#1A3C2B]'
                      : 'bg-white text-[#1A3C2B] border-[#1A3C2B]/40'
                  }`}
                >
                  <span>{floor.shortCode}</span>
                  <span className="font-sans font-medium text-xs">{floor.name}</span>
                  <span className="text-[9px] opacity-75">+{floor.elevationMeters.toFixed(1)}m</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
