import React, { useRef, useState } from 'react';
import type { Institution, Building, Floor, RouteResult } from '../../types';
import { QRCodeSVG } from 'qrcode.react';
import {
  Printer,
  Download,
  X,
  Compass,
  Layers,
  Check,
  Smartphone,
  Sliders,
  FileText,
  Layout,
  Navigation,
} from 'lucide-react';

interface BlueprintExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  institution: Institution;
  building: Building;
  floor: Floor;
  routeResult: RouteResult | null;
}

export const BlueprintExportModal: React.FC<BlueprintExportModalProps> = ({
  isOpen,
  onClose,
  institution,
  building,
  floor,
  routeResult,
}) => {
  const printAreaRef = useRef<HTMLDivElement>(null);

  // Print sheet options
  const [sheetType, setSheetType] = useState<'blueprint' | 'wayfinding'>(
    routeResult ? 'wayfinding' : 'blueprint'
  );
  const [orientation, setOrientation] = useState<'landscape' | 'portrait'>('landscape');
  const [showQR, setShowQR] = useState<boolean>(true);
  const [showLegend, setShowLegend] = useState<boolean>(true);
  const [showRoomNames, setShowRoomNames] = useState<boolean>(true);
  const [showCoordinateGrid, setShowCoordinateGrid] = useState<boolean>(true);
  const [colorMode, setColorMode] = useState<'architectural' | 'monochrome'>('architectural');

  if (!isOpen) return null;

  const originUrl = typeof window !== 'undefined' ? window.location.origin : '';
  const shareUrl = `${originUrl}/?inst=${institution.id}&bld=${building.id}&floor=${floor.id}&mode=mobile`;

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadSVG = () => {
    const svgEl = printAreaRef.current?.querySelector('#export-blueprint-svg');
    if (!svgEl) return;
    const svgData = new XMLSerializer().serializeToString(svgEl);
    const blob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `tervrajz-${institution.city}-${building.code}-${floor.shortCode}.svg`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-[#1A3C2B]/60 backdrop-blur-xs select-none">
      <div className="bg-[#F7F7F5] border-2 border-[#1A3C2B] w-full max-w-6xl max-h-[95vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150 shadow-2xl">
        {/* Header */}
        <div className="p-3 bg-[#1A3C2B] text-[#F7F7F5] flex items-center justify-between no-print">
          <div className="flex items-center gap-2">
            <Printer className="w-4 h-4 text-emerald-400" />
            <span className="font-mono text-xs font-bold uppercase tracking-wider">
              ÉPÍTÉSZETI TERVLAP & NYOMTATÁSI KÖZPONT // ISO A4/A3
            </span>
          </div>
          <button onClick={onClose} className="font-mono text-sm text-[#F7F7F5]/80 hover:text-white">
            ✕
          </button>
        </div>

        {/* Customization Toolbar */}
        <div className="p-3 bg-white border-b border-[#1A3C2B] flex flex-wrap items-center justify-between gap-3 font-mono text-xs no-print">
          <div className="flex flex-wrap items-center gap-2">
            {/* Sheet Type Switcher */}
            <div className="flex items-center border border-[#1A3C2B] bg-[#F7F7F5] p-0.5">
              <button
                onClick={() => setSheetType('blueprint')}
                className={`px-2.5 py-1 text-[11px] font-bold flex items-center gap-1.5 transition-colors ${
                  sheetType === 'blueprint'
                    ? 'bg-[#1A3C2B] text-white'
                    : 'text-[#1A3C2B] hover:bg-[#EFEFEA]'
                }`}
              >
                <Layout className="w-3 h-3" />
                <span>TERVRAJZ NÉZET</span>
              </button>

              <button
                onClick={() => setSheetType('wayfinding')}
                className={`px-2.5 py-1 text-[11px] font-bold flex items-center gap-1.5 transition-colors ${
                  sheetType === 'wayfinding'
                    ? 'bg-[#1A3C2B] text-white'
                    : 'text-[#1A3C2B] hover:bg-[#EFEFEA]'
                }`}
              >
                <Navigation className="w-3 h-3" />
                <span>ÚTVONALLAP + LÉPÉSEK</span>
              </button>
            </div>

            {/* Checkbox Toggles */}
            <label className="flex items-center gap-1 text-[11px] font-bold text-[#1A3C2B] cursor-pointer bg-[#F7F7F5] border border-[#1A3C2B]/30 px-2 py-1">
              <input
                type="checkbox"
                checked={showQR}
                onChange={(e) => setShowQR(e.target.checked)}
                className="accent-[#1A3C2B]"
              />
              <span>QR KÓD</span>
            </label>

            <label className="flex items-center gap-1 text-[11px] font-bold text-[#1A3C2B] cursor-pointer bg-[#F7F7F5] border border-[#1A3C2B]/30 px-2 py-1">
              <input
                type="checkbox"
                checked={showLegend}
                onChange={(e) => setShowLegend(e.target.checked)}
                className="accent-[#1A3C2B]"
              />
              <span>JELMAGYARÁZAT</span>
            </label>

            <label className="flex items-center gap-1 text-[11px] font-bold text-[#1A3C2B] cursor-pointer bg-[#F7F7F5] border border-[#1A3C2B]/30 px-2 py-1">
              <input
                type="checkbox"
                checked={showCoordinateGrid}
                onChange={(e) => setShowCoordinateGrid(e.target.checked)}
                className="accent-[#1A3C2B]"
              />
              <span>CAD KERET</span>
            </label>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2">
            <button
              onClick={handleDownloadSVG}
              className="px-3 py-1.5 border border-[#1A3C2B] hover:bg-[#F0F5F2] text-[#1A3C2B] font-bold flex items-center gap-1.5 transition-colors"
            >
              <Download className="w-3.5 h-3.5" />
              <span>VEKTOROS SVG MENTÉSE</span>
            </button>

            <button
              onClick={handlePrint}
              className="px-4 py-1.5 bg-[#1A3C2B] text-white hover:bg-[#2A533E] font-bold flex items-center gap-1.5 transition-colors shadow-sm"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>NYOMTATÁS (A4 / PDF)</span>
            </button>
          </div>
        </div>

        {/* Printable Architectural Sheet Viewport */}
        <div className="p-4 sm:p-6 flex-1 overflow-y-auto bg-[#D0D0C7] flex items-center justify-center">
          <div
            ref={printAreaRef}
            id="printable-blueprint-sheet"
            className="printable-sheet-target bg-white border-2 border-[#1A3C2B] p-4 sm:p-5 flex flex-col justify-between text-[#1A3C2B] w-full max-w-[1000px] font-mono shadow-xl relative"
            style={{ minHeight: '620px' }}
          >
            {/* CAD Outer Grid Coordinate Ticks & Outer Frame */}
            {showCoordinateGrid && (
              <div className="absolute inset-1 border border-[#1A3C2B]/30 pointer-events-none flex flex-col justify-between p-1">
                <div className="flex justify-between text-[8px] font-bold text-[#1A3C2B]/50 px-8">
                  <span>1</span>
                  <span>2</span>
                  <span>3</span>
                  <span>4</span>
                  <span>5</span>
                  <span>6</span>
                </div>
                <div className="flex justify-between text-[8px] font-bold text-[#1A3C2B]/50 px-8">
                  <span>A</span>
                  <span>B</span>
                  <span>C</span>
                  <span>D</span>
                  <span>E</span>
                  <span>F</span>
                </div>
              </div>
            )}

            {/* 1. Sheet Header Banner */}
            <div className="border-b-2 border-[#1A3C2B] pb-2 flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-[#1A3C2B] text-white flex items-center justify-center font-bold text-sm">
                  ⌖
                </div>
                <div>
                  <h2 className="font-sans font-black text-base sm:text-lg uppercase tracking-tight leading-tight">
                    {institution.name} // {building.name} ({building.code})
                  </h2>
                  <p className="text-[11px] text-[#1A3C2B]/80 font-mono">
                    SZINT: <b>{floor.name}</b> ({floor.shortCode}) • SZINTMAGASSÁG: <b>+{floor.elevationMeters.toFixed(1)}m</b> • {institution.city}, {institution.address}
                  </p>
                </div>
              </div>

              {/* Graphical Scale & North Arrow */}
              <div className="flex items-center gap-4 text-right">
                {/* North Arrow */}
                <div className="flex flex-col items-center">
                  <div className="w-6 h-6 border border-[#1A3C2B] rounded-full flex items-center justify-center text-[10px] font-black">
                    ▲
                  </div>
                  <span className="text-[8px] font-bold text-[#1A3C2B]">ÉSZAK (N)</span>
                </div>

                {/* Metric Bar Scale */}
                <div className="flex flex-col items-end">
                  <span className="text-[9px] font-bold uppercase">LÉPTÉK 1:100 (METRIKUS)</span>
                  <div className="flex items-center mt-0.5 border border-[#1A3C2B] text-[8px] text-center">
                    <span className="w-6 bg-[#1A3C2B] text-white">0m</span>
                    <span className="w-6 bg-white text-[#1A3C2B]">5m</span>
                    <span className="w-6 bg-[#1A3C2B] text-white">10m</span>
                    <span className="w-8 bg-white text-[#1A3C2B]">20m</span>
                  </div>
                </div>
              </div>
            </div>

            {/* 2. Vector Blueprint Canvas */}
            <div className="my-2 border border-[#1A3C2B] relative bg-[#F7F7F5] overflow-hidden flex-1 flex items-center justify-center">
              <svg
                id="export-blueprint-svg"
                viewBox={`0 0 ${floor.width} ${floor.height}`}
                className="w-full h-auto max-h-[380px] object-contain"
              >
                {/* Architectural Technical Grid */}
                <defs>
                  <pattern id="export-major-grid" width="50" height="50" patternUnits="userSpaceOnUse">
                    <path d="M 50 0 L 0 0 0 50" fill="none" stroke="rgba(26, 60, 43, 0.08)" strokeWidth="1" />
                  </pattern>
                </defs>
                <rect width={floor.width} height={floor.height} fill="#F7F7F5" />
                <rect width={floor.width} height={floor.height} fill="url(#export-major-grid)" />

                {/* Rooms Layer */}
                {floor.rooms.map((room) => {
                  const pointsStr = room.polygon.map((p) => `${p.x},${p.y}`).join(' ');
                  const isRouteDest = routeResult && room.id === routeResult.steps[routeResult.steps.length - 1]?.nodeId;

                  return (
                    <g key={room.id}>
                      <polygon
                        points={pointsStr}
                        fill={colorMode === 'architectural' ? (room.colorHatch || 'rgba(26, 60, 43, 0.08)') : 'rgba(0,0,0,0.04)'}
                        stroke="#1A3C2B"
                        strokeWidth="2"
                      />
                      {/* Room Code */}
                      <text
                        x={room.polygon[0].x + 10}
                        y={room.polygon[0].y + 18}
                        fill="#1A3C2B"
                        className="font-mono text-[10px] font-bold"
                      >
                        {room.code}
                      </text>
                      {/* Room Name */}
                      {showRoomNames && (
                        <text
                          x={room.polygon[0].x + 10}
                          y={room.polygon[0].y + 30}
                          fill="#1A3C2B"
                          className="font-sans text-[9px] font-medium"
                          opacity="0.85"
                        >
                          {room.name}
                        </text>
                      )}
                    </g>
                  );
                })}

                {/* Walls Layer */}
                {floor.walls.map((wall) => (
                  <line
                    key={wall.id}
                    x1={wall.start.x}
                    y1={wall.start.y}
                    x2={wall.end.x}
                    y2={wall.end.y}
                    stroke="#1A3C2B"
                    strokeWidth={wall.thickness * 2}
                  />
                ))}

                {/* Doors Layer */}
                {floor.doors.map((door) => (
                  <line
                    key={door.id}
                    x1={door.start.x}
                    y1={door.start.y}
                    x2={door.end.x}
                    y2={door.end.y}
                    stroke="#FFFFFF"
                    strokeWidth="5"
                  />
                ))}

                {/* Transit Connectors (Elevators / Stairs) */}
                {floor.transitConnectors.map((t) => (
                  <g key={t.id} transform={`translate(${t.position.x - 20}, ${t.position.y - 20})`}>
                    <rect
                      width="40"
                      height="40"
                      fill={t.type === 'elevator' ? '#0E7490' : '#B45309'}
                      stroke="#1A3C2B"
                      strokeWidth="2"
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

                {/* Active Route Path Layer on this Floor */}
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
                          />
                          {floorNodes.map((n, i) => (
                            <circle
                              key={i}
                              cx={n.position.x}
                              cy={n.position.y}
                              r="4"
                              fill="#047857"
                              stroke="#FFFFFF"
                              strokeWidth="2"
                            />
                          ))}
                        </>
                      );
                    })()}
                  </g>
                )}
              </svg>
            </div>

            {/* 3. Turn-by-Turn Route Guidance Strip (when Wayfinding sheet mode is active) */}
            {sheetType === 'wayfinding' && routeResult && (
              <div className="border border-[#1A3C2B] bg-[#F7F7F5] p-2 mb-2 text-xs">
                <div className="flex items-center justify-between border-b border-[#1A3C2B]/20 pb-1 mb-1.5 font-bold">
                  <span className="text-[10px] uppercase">
                    ÚTVONAL VEZETÉS ({routeResult.totalDistanceMeters}m • ~{routeResult.estimatedTimeMinutes} perc • {routeResult.floorsTraversed.length} szint)
                  </span>
                  <span className="text-[9px] text-[#1A3C2B]/70">LÉPÉSRŐL LÉPÉSRE</span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[10px]">
                  {routeResult.steps.slice(0, 4).map((s, idx) => (
                    <div key={idx} className="bg-white border border-[#D0D0C7] p-1.5">
                      <span className="font-bold block text-[#1A3C2B]">{idx + 1}. {s.floorShortCode}</span>
                      <span className="text-[#1A3C2B]/85 truncate block">{s.instruction}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 4. Architectural Title Block & Legend (Szabványos Építészeti Bélyegző) */}
            <div className="border-2 border-[#1A3C2B] p-2.5 grid grid-cols-12 gap-3 text-xs font-mono bg-white">
              {/* Institution & Building Details */}
              <div className="col-span-5 flex flex-col justify-between border-r border-[#1A3C2B]/30 pr-2">
                <div>
                  <span className="font-bold uppercase text-[8px] text-[#1A3C2B]/60 block">LÉTESÍTMÉNY / CAMPUS:</span>
                  <span className="font-extrabold text-[11px] block">{institution.name}</span>
                  <span className="text-[9px] text-[#1A3C2B]/80 block">{building.name} • {floor.name}</span>
                </div>
                <div className="text-[8px] text-[#1A3C2B]/60 mt-1">
                  CÍM: {institution.city}, {institution.address}
                </div>
              </div>

              {/* Legend Strip */}
              {showLegend ? (
                <div className="col-span-4 flex flex-col justify-between border-r border-[#1A3C2B]/30 pr-2">
                  <span className="font-bold uppercase text-[8px] text-[#1A3C2B]/60 block">JELMAGYARÁZAT:</span>
                  <div className="grid grid-cols-2 gap-1 text-[9px] mt-0.5">
                    <span className="flex items-center gap-1">
                      <span className="w-2 h-2 bg-[#0E7490] inline-block" /> Liftakna
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="w-2 h-2 bg-[#B45309] inline-block" /> Lépcsőház
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="w-2 h-2 bg-[#047857] inline-block" /> Útvonal
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="w-2 h-2 border border-[#1A3C2B] bg-white inline-block" /> Ajtó
                    </span>
                  </div>
                  <div className="text-[8px] text-[#1A3C2B]/60 mt-1">
                    DÁTUM: {new Date().toLocaleDateString('hu-HU')}
                  </div>
                </div>
              ) : (
                <div className="col-span-4 flex flex-col justify-center border-r border-[#1A3C2B]/30 pr-2">
                  <span className="font-bold text-[10px]">ARCHIPATH CAD V4</span>
                  <span className="text-[8px] text-[#1A3C2B]/60">Érvényes: {new Date().getFullYear()}</span>
                </div>
              )}

              {/* QR Code & System Telemetry */}
              <div className="col-span-3 flex items-center justify-between">
                {showQR && (
                  <div className="p-1 bg-white border border-[#1A3C2B] flex-shrink-0">
                    <QRCodeSVG
                      value={shareUrl}
                      size={44}
                      level="M"
                      fgColor="#1A3C2B"
                      bgColor="#FFFFFF"
                    />
                  </div>
                )}
                <div className="flex flex-col text-right justify-between h-full pl-2">
                  <div className="font-black text-[10px] uppercase">ARCHIPATH</div>
                  <span className="text-[8px] text-[#1A3C2B]/60">DIGITÁLIS TERV</span>
                  <span className="text-[8px] font-bold">1 / 1 LAP</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
