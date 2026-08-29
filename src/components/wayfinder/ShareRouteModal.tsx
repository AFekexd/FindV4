import React, { useState } from 'react';
import type { RouteResult, Building, Room } from '../../types';
import { QRCodeSVG } from 'qrcode.react';
import {
  Share2,
  Copy,
  Check,
  Printer,
  Smartphone,
  Navigation,
  MapPin,
  ArrowDown,
  Eye,
} from 'lucide-react';

interface ShareRouteModalProps {
  isOpen: boolean;
  onClose: () => void;
  building: Building;
  startRoomId: string | null;
  targetRoomId: string | null;
  intermediateStopIds?: string[];
  routeResult: RouteResult | null;
  onOpenMobileView?: () => void;
}

export const ShareRouteModal: React.FC<ShareRouteModalProps> = ({
  isOpen,
  onClose,
  building,
  startRoomId,
  targetRoomId,
  intermediateStopIds = [],
  routeResult,
  onOpenMobileView,
}) => {
  const [copied, setCopied] = useState(false);
  const [includeRouteStepsInPrint, setIncludeRouteStepsInPrint] = useState<boolean>(true);
  const [copiesPerPage, setCopiesPerPage] = useState<1 | 2 | 4>(1);
  const [orientation, setOrientation] = useState<'portrait' | 'landscape'>('portrait');

  if (!isOpen) return null;

  const originUrl =
    typeof window !== 'undefined'
      ? `${window.location.origin}${window.location.pathname.replace(/\/$/, '')}`
      : '';
  const stopsQuery =
    intermediateStopIds.length > 0 ? `&stops=${intermediateStopIds.join(',')}` : '';
  const shareUrl = `${originUrl}/?inst=${building.institutionId}&bld=${building.id}&start=${
    startRoomId || ''
  }&dest=${targetRoomId || ''}${stopsQuery}&mode=mobile`;

  let startRoom: Room | undefined;
  let startFloorName = '';
  let targetRoom: Room | undefined;
  let targetFloorName = '';

  for (const fl of building.floors) {
    if (startRoomId && !startRoom) {
      const r = fl.rooms.find((rm) => rm.id === startRoomId);
      if (r) { startRoom = r; startFloorName = fl.name; }
    }
    if (targetRoomId && !targetRoom) {
      const r = fl.rooms.find((rm) => rm.id === targetRoomId);
      if (r) { targetRoom = r; targetFloorName = fl.name; }
    }
  }

  const handleCopy = () => {
    navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handlePrint = () => {
    window.print();
  };

  const pageClass = `print-page ${orientation === 'landscape' ? 'print-landscape' : 'print-portrait'}`;

  // Compact card for front side
  const renderFrontCard = (qrSize: number, compact: boolean) => (
    <div className={`w-full border border-black flex flex-col items-center bg-white text-black font-sans box-border ${compact ? 'p-1.5 gap-1' : 'p-3 gap-2'}`}>
      <div className="border-b border-black/60 pb-0.5 w-full text-center">
        <span className="font-mono text-[7px] font-black tracking-widest uppercase block">POLLÁK // MOBIL NAVIGÁCIÓ</span>
        <span className={`${compact ? 'text-[10px]' : 'text-xs'} font-bold text-gray-900 truncate block`}>{building.name}</span>
      </div>
      <div className="w-full flex flex-col gap-0.5 text-left font-mono border border-black/60 p-1 text-[9px]">
        <div className="flex items-center gap-1">
          <span className="font-black px-1 border border-black text-[7px] uppercase flex-shrink-0">START</span>
          <span className="font-bold text-[9px] truncate">{startRoom ? `${startRoom.name} (${startRoom.code})` : 'Kiindulás'}</span>
        </div>
        <div className="text-center text-[8px] text-gray-500 leading-none">↓</div>
        <div className="flex items-center gap-1">
          <span className="font-black px-1 bg-black text-white text-[7px] uppercase flex-shrink-0">CÉL</span>
          <span className="font-bold text-[9px] truncate">{targetRoom ? `${targetRoom.name} (${targetRoom.code})` : 'Célállomás'}</span>
        </div>
      </div>
      <div className="border border-black/60 bg-white flex items-center justify-center p-0.5">
        <QRCodeSVG value={shareUrl} size={qrSize} level="M" fgColor="#000000" bgColor="#FFFFFF" />
      </div>
      <span className="font-bold text-[8px] uppercase tracking-wide text-center">Olvassa be telefonjával!</span>
      {routeResult && (
        <div className="border-t border-black/30 pt-0.5 w-full flex items-center justify-between font-mono text-[7px] text-gray-700">
          <span>{routeResult.totalDistanceMeters} m</span>
          <span>~{routeResult.estimatedTimeMinutes} p</span>
          <span>{routeResult.floorsTraversed.length} szint</span>
        </div>
      )}
    </div>
  );

  // Compact card for back side
  const renderBackCard = (compact: boolean) => (
    <div className={`w-full border border-black flex flex-col items-center bg-white text-black font-sans box-border ${compact ? 'p-1.5 gap-1' : 'p-3 gap-1.5'}`}>
      <div className="border-b border-black/60 pb-0.5 w-full text-center">
        <span className="font-mono text-[7px] font-black tracking-widest uppercase block text-gray-600">{building.name} • HÁTLAP</span>
        <span className={`${compact ? 'text-[10px]' : 'text-xs'} font-black uppercase tracking-wider block`}>ÚTVONALÚTMUTATÓ</span>
      </div>
      {routeResult && (
        <>
          <div className="w-full bg-gray-100 border border-black/60 p-0.5 flex items-center justify-between text-[8px] font-mono">
            <span className="font-bold text-[9px] truncate">
              {startRoom ? startRoom.code || startRoom.name : 'Start'} ➔ {targetRoom ? targetRoom.code || targetRoom.name : 'Cél'}
            </span>
            <span className="font-bold text-[7px] px-1 bg-black text-white flex-shrink-0">{routeResult.steps.length} LÉPÉS</span>
          </div>
          <div className="w-full flex flex-col gap-px text-left font-mono">
            {routeResult.steps.slice(0, compact ? 4 : 10).map((step, idx) => (
              <div key={idx} className="flex items-center gap-1 p-px border border-black/30 bg-white text-[8px]">
                <span className="font-black text-[7px] px-0.5 bg-black text-white flex-shrink-0">{idx + 1}.</span>
                <span className="font-bold text-[8px] truncate flex-1">{step.instruction}</span>
                <span className="text-[6px] px-0.5 bg-gray-100 border border-black/40 flex-shrink-0">{step.floorShortCode}</span>
              </div>
            ))}
            {compact && routeResult.steps.length > 4 && (
              <span className="text-[7px] text-center text-gray-500 mt-0.5">+ {routeResult.steps.length - 4} lépés a mobilon...</span>
            )}
            {!compact && routeResult.steps.length > 10 && (
              <span className="text-[7px] text-center text-gray-500 mt-0.5">+ {routeResult.steps.length - 10} lépés a mobilon...</span>
            )}
          </div>
        </>
      )}
      <div className="border-t border-black/30 pt-0.5 w-full flex items-center justify-between font-mono text-[7px] text-gray-600">
        <span>FindV4 Navigáció</span>
        <span>2-oldalas kártya</span>
      </div>
    </div>
  );

  const cutLine = (label: string) => (
    <div className="w-full border-b border-dashed border-black/50 my-px flex items-center justify-center">
      <span className="bg-white px-1 font-mono text-[7px] text-gray-500">✂ ── {label} ── ✂</span>
    </div>
  );

  return (
    <>
      {/* Dynamic @page orientation override for print */}
      <style>{`@media print { @page { size: A4 ${orientation}; margin: 5mm; } }`}</style>

      {/* 1. PRINT-ONLY PAGES (hidden on screen, shown only @media print) */}
      <div className="printable-qr-target hidden bg-white text-black font-sans">
        {/* PAGE 1 — FRONT: QR CODE */}
        <div className={pageClass}>
          {copiesPerPage === 1 ? (
            <div className="w-full max-w-sm">{renderFrontCard(160, false)}</div>
          ) : copiesPerPage === 2 ? (
            <div className="w-full max-w-sm flex flex-col items-center gap-1">
              {renderFrontCard(100, true)}
              {cutLine('VÁGÁSI VONAL')}
              {renderFrontCard(100, true)}
            </div>
          ) : (
            <div className="w-full max-w-lg grid grid-cols-2 gap-1 items-start">
              {renderFrontCard(70, true)}
              {renderFrontCard(70, true)}
              <div className="col-span-2">{cutLine('VÁGÁSI VONAL')}</div>
              {renderFrontCard(70, true)}
              {renderFrontCard(70, true)}
            </div>
          )}
        </div>

        {/* PAGE 2 — BACK: ROUTE STEPS */}
        {includeRouteStepsInPrint && routeResult && routeResult.steps.length > 0 && (
          <div className={pageClass}>
            {copiesPerPage === 1 ? (
              <div className="w-full max-w-sm">{renderBackCard(false)}</div>
            ) : copiesPerPage === 2 ? (
              <div className="w-full max-w-sm flex flex-col items-center gap-1">
                {renderBackCard(true)}
                {cutLine('VÁGÁSI VONAL')}
                {renderBackCard(true)}
              </div>
            ) : (
              <div className="w-full max-w-lg grid grid-cols-2 gap-1 items-start">
                {renderBackCard(true)}
                {renderBackCard(true)}
                <div className="col-span-2">{cutLine('VÁGÁSI VONAL')}</div>
                {renderBackCard(true)}
                {renderBackCard(true)}
              </div>
            )}
          </div>
        )}
      </div>

      {/* 2. ON-SCREEN MODAL DIALOG */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#1A3C2B]/40 backdrop-blur-xs select-none no-print">
        <div className="bg-[#F7F7F5] border-2 border-[#1A3C2B] w-full max-w-md overflow-hidden shadow-2xl max-h-[90vh] overflow-y-auto">
          {/* Header */}
          <div className="p-3.5 bg-[#1A3C2B] text-[#F7F7F5] flex items-center justify-between sticky top-0 z-10">
            <div className="flex items-center gap-2">
              <Share2 className="w-4 h-4" />
              <span className="font-mono text-xs font-bold uppercase tracking-wider">
                MOBIL ÚTVONAL MEGOSZTÁSA // QR KÓD
              </span>
            </div>
            <button onClick={onClose} className="font-mono text-sm text-[#F7F7F5]/80 hover:text-white px-1.5">✕</button>
          </div>

          <div className="p-5 flex flex-col gap-3">
            {/* Start & Destination Pill */}
            <div className="bg-white border border-[#1A3C2B] p-3 flex flex-col gap-2 text-xs font-mono">
              <div className="flex items-center gap-2">
                <span className="px-1.5 py-0.5 border border-[#1A3C2B] font-bold text-[9px] uppercase">START</span>
                <span className="font-bold text-[#1A3C2B] truncate">
                  {startRoom ? `${startRoom.name} (${startRoom.code})` : 'Kiindulási helyiség'}
                </span>
              </div>
              <div className="flex items-center gap-2 border-t border-[#1A3C2B]/15 pt-1.5">
                <span className="px-1.5 py-0.5 bg-[#1A3C2B] text-white font-bold text-[9px] uppercase">CÉL</span>
                <span className="font-bold text-[#1A3C2B] truncate">
                  {targetRoom ? `${targetRoom.name} (${targetRoom.code})` : 'Célállomás'}
                </span>
              </div>
            </div>

            {/* QR Code Card */}
            <div className="flex flex-col items-center justify-center p-4 bg-white border border-[#1A3C2B]">
              <div className="p-3 bg-white border border-[#D0D0C7]">
                <QRCodeSVG value={shareUrl} size={170} level="H" fgColor="#1A3C2B" bgColor="#FFFFFF" />
              </div>
              <span className="font-mono text-[10px] uppercase font-bold tracking-wider text-[#1A3C2B] mt-3 flex items-center gap-1.5">
                <Smartphone className="w-3.5 h-3.5 text-emerald-700" />
                <span>OLVASSA BE MOBILJÁVAL A GYORS NAVIGÁCIÓHOZ</span>
              </span>
            </div>

            {/* Mobile View Button */}
            {onOpenMobileView && (
              <button
                onClick={() => { onClose(); onOpenMobileView(); }}
                className="w-full py-2 bg-white hover:bg-[#F0F5F2] border border-[#1A3C2B] text-[#1A3C2B] font-mono text-xs font-bold flex items-center justify-center gap-2 transition-colors shadow-xs"
              >
                <Smartphone className="w-4 h-4 text-emerald-700" />
                <span>MEGNYITÁS MOBIL NÉZETBEN MOST</span>
              </button>
            )}

            {/* Copyable Link */}
            <div className="flex flex-col gap-1">
              <span className="font-mono text-[9px] uppercase font-bold text-[#1A3C2B]/70">KÖZVETLEN MOBIL NAVIGÁCIÓS LINK</span>
              <div className="flex items-center bg-white border border-[#1A3C2B] p-1.5">
                <input type="text" readOnly value={shareUrl} className="w-full bg-transparent font-mono text-[10px] text-[#1A3C2B] focus:outline-none select-all" />
                <button
                  onClick={handleCopy}
                  className="px-2.5 py-1 bg-[#1A3C2B] text-white hover:bg-[#2A533E] transition-colors font-mono text-[10px] font-bold flex items-center gap-1 flex-shrink-0 ml-1"
                >
                  {copied ? <Check className="w-3 h-3 text-emerald-300" /> : <Copy className="w-3 h-3" />}
                  <span>{copied ? 'MÁSOLVA' : 'MÁSOLÁS'}</span>
                </button>
              </div>
            </div>

            {/* ── PRINT SETTINGS ── */}
            <div className="bg-white border border-[#1A3C2B] p-2.5 flex flex-col gap-2.5 font-mono text-xs select-none">
              <span className="font-bold text-[#1A3C2B] uppercase text-[10px] tracking-wider block">
                🖨️ NYOMTATÁSI BEÁLLÍTÁSOK
              </span>

              {/* Orientation */}
              <div className="flex flex-col gap-1">
                <span className="text-[9px] text-[#1A3C2B]/70 uppercase font-bold">ORIENTÁCIÓ</span>
                <div className="grid grid-cols-2 gap-1.5">
                  <button
                    type="button"
                    onClick={() => setOrientation('portrait')}
                    className={`py-1.5 px-2 border text-[10px] font-bold transition-all flex items-center justify-center gap-1.5 ${
                      orientation === 'portrait'
                        ? 'bg-[#1A3C2B] text-white border-[#1A3C2B]'
                        : 'bg-white text-[#1A3C2B] border-[#1A3C2B]/30 hover:bg-[#F0F5F2]'
                    }`}
                  >
                    <span className="text-sm">▯</span> Álló (Portrait)
                  </button>
                  <button
                    type="button"
                    onClick={() => setOrientation('landscape')}
                    className={`py-1.5 px-2 border text-[10px] font-bold transition-all flex items-center justify-center gap-1.5 ${
                      orientation === 'landscape'
                        ? 'bg-[#1A3C2B] text-white border-[#1A3C2B]'
                        : 'bg-white text-[#1A3C2B] border-[#1A3C2B]/30 hover:bg-[#F0F5F2]'
                    }`}
                  >
                    <span className="text-sm rotate-90">▯</span> Fekvő (Landscape)
                  </button>
                </div>
              </div>

              {/* Copies per page */}
              <div className="flex flex-col gap-1">
                <span className="text-[9px] text-[#1A3C2B]/70 uppercase font-bold">KÁRTYÁK SZÁMA / LAP</span>
                <div className="grid grid-cols-3 gap-1.5">
                  {([1, 2, 4] as const).map((n) => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => setCopiesPerPage(n)}
                      className={`py-1.5 px-2 border text-[10px] font-bold transition-all flex flex-col items-center gap-0.5 ${
                        copiesPerPage === n
                          ? 'bg-[#1A3C2B] text-white border-[#1A3C2B]'
                          : 'bg-white text-[#1A3C2B] border-[#1A3C2B]/30 hover:bg-[#F0F5F2]'
                      }`}
                    >
                      <span>{n} DB / A4</span>
                      <span className="text-[8px] opacity-75">{n === 1 ? 'Teljes méret' : n === 2 ? 'A5 (Fél lap)' : 'A6 (Negyed lap)'}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Route steps toggle */}
              {routeResult && routeResult.steps.length > 0 && (
                <label className="flex items-start gap-2 cursor-pointer pt-1 border-t border-[#1A3C2B]/15">
                  <input
                    type="checkbox"
                    checked={includeRouteStepsInPrint}
                    onChange={(e) => setIncludeRouteStepsInPrint(e.target.checked)}
                    className="mt-0.5 accent-[#1A3C2B] w-4 h-4 cursor-pointer flex-shrink-0"
                  />
                  <div className="flex flex-col">
                    <span className="font-bold text-[#1A3C2B]">Útvonalutasítások a 2. oldalra</span>
                    <span className="text-[9px] text-[#1A3C2B]/70 leading-tight">Előlap: QR kód • Hátlap: Szöveges lépések</span>
                  </div>
                </label>
              )}
            </div>

            {/* Footer Actions */}
            <div className="flex items-center justify-between pt-1 border-t border-[#1A3C2B]/20">
              <button
                onClick={handlePrint}
                className="px-3 py-1.5 bg-[#1A3C2B] text-white hover:bg-[#2A533E] font-mono text-[10px] font-bold flex items-center gap-1.5 transition-colors shadow-xs"
              >
                <Printer className="w-3.5 h-3.5 text-emerald-300" />
                <span>
                  NYOMTATÁS ({copiesPerPage}×{orientation === 'portrait' ? 'álló' : 'fekvő'} • {includeRouteStepsInPrint && routeResult?.steps.length ? '2 old.' : '1 old.'})
                </span>
              </button>
              <button onClick={onClose} className="px-4 py-1.5 bg-[#F7F7F5] hover:bg-[#EFEFEA] border border-[#1A3C2B] text-[#1A3C2B] font-mono text-xs font-bold">
                BEZÁRÁS
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};
