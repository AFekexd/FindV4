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

  // Resolve start and target room metadata
  let startRoom: Room | undefined;
  let startFloorName = '';
  let targetRoom: Room | undefined;
  let targetFloorName = '';

  for (const fl of building.floors) {
    if (startRoomId && !startRoom) {
      const r = fl.rooms.find((rm) => rm.id === startRoomId);
      if (r) {
        startRoom = r;
        startFloorName = fl.name;
      }
    }
    if (targetRoomId && !targetRoom) {
      const r = fl.rooms.find((rm) => rm.id === targetRoomId);
      if (r) {
        targetRoom = r;
        targetFloorName = fl.name;
      }
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

  // Helper renderers for Printable Cards
  const renderFrontCardContent = (qrSize: number = 180, isCompact: boolean = false) => (
    <div className={`w-full border-2 border-black flex flex-col items-center bg-white text-black font-sans box-border ${isCompact ? 'p-2 gap-1.5' : 'p-4 gap-3'}`}>
      {/* Header */}
      <div className="border-b border-black pb-1 w-full text-center">
        <span className="font-mono text-[8px] font-black tracking-widest uppercase block text-black">
          POLLÁK // MOBIL NAVIGÁCIÓ
        </span>
        <span className={`${isCompact ? 'text-[11px]' : 'text-xs'} font-bold text-gray-900 truncate block`}>
          {building.name}
        </span>
      </div>

      {/* Start & Destination Box */}
      <div className="w-full flex flex-col gap-1 text-left font-mono border border-black p-1.5 text-xs">
        <div className="flex items-center gap-1.5 min-w-0">
          <span className="font-black px-1 py-0.2 border border-black text-[8px] uppercase flex-shrink-0">
            START
          </span>
          <span className="font-bold text-[10px] text-black truncate">
            {startRoom ? `${startRoom.name} (${startRoom.code})` : 'Kiindulási helyiség'}
          </span>
        </div>

        <div className="flex items-center justify-center text-gray-500 my-0 leading-none">
          <span className="text-[9px]">↓</span>
        </div>

        <div className="flex items-center gap-1.5 min-w-0">
          <span className="font-black px-1 py-0.2 bg-black text-white text-[8px] uppercase flex-shrink-0">
            CÉL
          </span>
          <span className="font-bold text-[10px] text-black truncate">
            {targetRoom ? `${targetRoom.name} (${targetRoom.code})` : 'Célállomás'}
          </span>
        </div>
      </div>

      {/* High-Resolution QR Code */}
      <div className="p-1 border border-black bg-white flex items-center justify-center my-0.5">
        <QRCodeSVG
          value={shareUrl}
          size={qrSize}
          level="M"
          fgColor="#000000"
          bgColor="#FFFFFF"
        />
      </div>

      {/* Instruction */}
      <div className="flex flex-col items-center gap-0.5 text-center leading-tight">
        <span className="font-bold text-[9px] uppercase tracking-wide">
          Olvassa be telefonjával az útvonalhoz!
        </span>
      </div>

      {/* Telemetry Footer */}
      {routeResult && (
        <div className="border-t border-black/30 pt-1 w-full flex items-center justify-between font-mono text-[8px] text-gray-700">
          <span>Táv: <b>{routeResult.totalDistanceMeters} m</b></span>
          <span>Idő: <b>~{routeResult.estimatedTimeMinutes} p</b></span>
          <span>Szintek: <b>{routeResult.floorsTraversed.length}</b></span>
        </div>
      )}
    </div>
  );

  const renderBackCardContent = (isCompact: boolean = false) => (
    <div className={`w-full border-2 border-black flex flex-col items-center bg-white text-black font-sans box-border ${isCompact ? 'p-2 gap-1.5' : 'p-4 gap-2.5'}`}>
      {/* Header */}
      <div className="border-b border-black pb-1 w-full text-center">
        <span className="font-mono text-[8px] font-black tracking-widest uppercase block text-gray-600">
          {building.name} • HÁTLAP (ÚTVONAL)
        </span>
        <span className={`${isCompact ? 'text-[11px]' : 'text-xs'} font-black uppercase tracking-wider block text-black`}>
          LÉPÉSRŐL-LÉPÉSRE ÚTVONALÚTMUTATÓ
        </span>
      </div>

      {/* Route Summary */}
      {routeResult && (
        <div className="w-full bg-gray-100 border border-black p-1 flex items-center justify-between text-[8px] font-mono">
          <span className="font-bold text-[10px] text-black truncate">
            {startRoom ? startRoom.code || startRoom.name : 'Start'} ➔ {targetRoom ? targetRoom.code || targetRoom.name : 'Cél'}
          </span>
          <span className="font-mono font-bold text-[8px] px-1 py-0.2 border border-black bg-black text-white flex-shrink-0 ml-1">
            {routeResult.steps.length} LÉPÉS
          </span>
        </div>
      )}

      {/* Turn-by-Turn Instruction Steps */}
      {routeResult && (
        <div className="w-full flex flex-col gap-0.5 text-left font-mono">
          {routeResult.steps.slice(0, isCompact ? 5 : 12).map((step, idx) => (
            <div key={idx} className="flex items-start gap-1 p-0.5 border border-black/40 bg-white text-[9px]">
              <span className="font-black text-[8px] px-1 py-0.1 border border-black bg-black text-white flex-shrink-0">
                {idx + 1}.
              </span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-1">
                  <span className="font-bold text-[9px] text-black leading-tight truncate">
                    {step.instruction}
                  </span>
                  <span className="font-bold text-[7px] px-1 bg-gray-100 border border-black flex-shrink-0">
                    {step.floorShortCode}
                  </span>
                </div>
              </div>
            </div>
          ))}
          {isCompact && routeResult.steps.length > 5 && (
            <span className="text-[7.5px] text-center font-bold text-gray-600 block mt-0.5">
              + további {routeResult.steps.length - 5} lépés a mobil kijelzőjén...
            </span>
          )}
        </div>
      )}

      {/* Footer */}
      <div className="border-t border-black/30 pt-1 w-full flex items-center justify-between font-mono text-[8px] text-gray-600">
        <span>FindV4 Navigáció</span>
        <span>2-oldalas kártya</span>
      </div>
    </div>
  );

  return (
    <>
      {/* 1. DEDICATED INK-SAVING MINIMAL PRINT SHEET (@media print only) */}
      <div className="printable-qr-target hidden bg-white text-black font-sans">
        {/* PAGE 1: FRONT SIDE - QR CODE & DESTINATION DESIGN */}
        <div className="print-page">
          {copiesPerPage === 1 ? (
            <div className="w-full max-w-md">
              {renderFrontCardContent(180, false)}
            </div>
          ) : copiesPerPage === 2 ? (
            <div className="w-full max-w-md flex flex-col items-center gap-3">
              {renderFrontCardContent(120, true)}
              <div className="w-full border-b border-dashed border-black my-0.5 flex items-center justify-center">
                <span className="bg-white px-2 font-mono text-[8px] text-gray-600">
                  ✂ ------------------- VÁGÁSI VONAL (A5 KÁRTYÁK) ------------------- ✂
                </span>
              </div>
              {renderFrontCardContent(120, true)}
            </div>
          ) : (
            <div className="w-full max-w-lg grid grid-cols-2 gap-2 items-center">
              {renderFrontCardContent(85, true)}
              {renderFrontCardContent(85, true)}
              <div className="col-span-2 border-b border-dashed border-black my-0.5 flex items-center justify-center">
                <span className="bg-white px-2 font-mono text-[8px] text-gray-600">
                  ✂ ------------------- VÁGÁSI VONAL (A6 KÁRTYÁK) ------------------- ✂
                </span>
              </div>
              {renderFrontCardContent(85, true)}
              {renderFrontCardContent(85, true)}
            </div>
          )}
        </div>

        {/* PAGE 2: BACK SIDE - TURN-BY-TURN ROUTE INSTRUCTIONS */}
        {includeRouteStepsInPrint && routeResult && routeResult.steps.length > 0 && (
          <div className="print-page">
            {copiesPerPage === 1 ? (
              <div className="w-full max-w-md">
                {renderBackCardContent(false)}
              </div>
            ) : copiesPerPage === 2 ? (
              <div className="w-full max-w-md flex flex-col items-center gap-3">
                {renderBackCardContent(true)}
                <div className="w-full border-b border-dashed border-black my-0.5 flex items-center justify-center">
                  <span className="bg-white px-2 font-mono text-[8px] text-gray-600">
                    ✂ ------------------- VÁGÁSI VONAL (A5 KÁRTYÁK) ------------------- ✂
                  </span>
                </div>
                {renderBackCardContent(true)}
              </div>
            ) : (
              <div className="w-full max-w-lg grid grid-cols-2 gap-2 items-center">
                {renderBackCardContent(true)}
                {renderBackCardContent(true)}
                <div className="col-span-2 border-b border-dashed border-black my-0.5 flex items-center justify-center">
                  <span className="bg-white px-2 font-mono text-[8px] text-gray-600">
                    ✂ ------------------- VÁGÁSI VONAL (A6 KÁRTYÁK) ------------------- ✂
                  </span>
                </div>
                {renderBackCardContent(true)}
                {renderBackCardContent(true)}
              </div>
            )}
          </div>
        )}
      </div>

      {/* 2. ON-SCREEN MODAL DIALOG */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#1A3C2B]/40 backdrop-blur-xs select-none no-print">
        <div className="bg-[#F7F7F5] border-2 border-[#1A3C2B] w-full max-w-md overflow-hidden shadow-2xl">
          {/* Header */}
          <div className="p-3.5 bg-[#1A3C2B] text-[#F7F7F5] flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Share2 className="w-4 h-4" />
              <span className="font-mono text-xs font-bold uppercase tracking-wider">
                MOBIL ÚTVONAL MEGOSZTÁSA // QR KÓD
              </span>
            </div>
            <button
              onClick={onClose}
              className="font-mono text-sm text-[#F7F7F5]/80 hover:text-white px-1.5"
            >
              ✕
            </button>
          </div>

          <div className="p-5 flex flex-col gap-4">
            {/* Start & Destination Pill Preview */}
            <div className="bg-white border border-[#1A3C2B] p-3 flex flex-col gap-2 text-xs font-mono">
              <div className="flex items-center gap-2">
                <span className="px-1.5 py-0.5 border border-[#1A3C2B] font-bold text-[9px] uppercase">
                  START
                </span>
                <span className="font-bold text-[#1A3C2B] truncate">
                  {startRoom ? `${startRoom.name} (${startRoom.code})` : 'Kiindulási helyiség'}
                </span>
              </div>
              <div className="flex items-center gap-2 border-t border-[#1A3C2B]/15 pt-1.5">
                <span className="px-1.5 py-0.5 bg-[#1A3C2B] text-white font-bold text-[9px] uppercase">
                  CÉL
                </span>
                <span className="font-bold text-[#1A3C2B] truncate">
                  {targetRoom ? `${targetRoom.name} (${targetRoom.code})` : 'Célállomás'}
                </span>
              </div>
            </div>

            {/* High-Res QR Code Card */}
            <div className="flex flex-col items-center justify-center p-4 bg-white border border-[#1A3C2B]">
              <div className="p-3 bg-white border border-[#D0D0C7]">
                <QRCodeSVG
                  value={shareUrl}
                  size={170}
                  level="H"
                  fgColor="#1A3C2B"
                  bgColor="#FFFFFF"
                />
              </div>
              <span className="font-mono text-[10px] uppercase font-bold tracking-wider text-[#1A3C2B] mt-3 flex items-center gap-1.5">
                <Smartphone className="w-3.5 h-3.5 text-emerald-700" />
                <span>OLVASSA BE MOBILJÁVAL A GYORS NAVIGÁCIÓHOZ</span>
              </span>
              <span className="text-[9px] text-[#1A3C2B]/70 mt-0.5 text-center">
                A telefonon egy letisztult, sallangmentes mobil navigáció nyílik meg.
              </span>
            </div>

            {/* Direct Try on Mobile Button */}
            {onOpenMobileView && (
              <button
                onClick={() => {
                  onClose();
                  onOpenMobileView();
                }}
                className="w-full py-2 bg-white hover:bg-[#F0F5F2] border border-[#1A3C2B] text-[#1A3C2B] font-mono text-xs font-bold flex items-center justify-center gap-2 transition-colors shadow-xs"
              >
                <Smartphone className="w-4 h-4 text-emerald-700" />
                <span>MEGNYITÁS MOBIL NÉZETBEN MOST</span>
              </button>
            )}

            {/* Copyable Link */}
            <div className="flex flex-col gap-1">
              <span className="font-mono text-[9px] uppercase font-bold text-[#1A3C2B]/70">
                KÖZVETLEN MOBIL NAVIGÁCIÓS LINK
              </span>
              <div className="flex items-center bg-white border border-[#1A3C2B] p-1.5">
                <input
                  type="text"
                  readOnly
                  value={shareUrl}
                  className="w-full bg-transparent font-mono text-[10px] text-[#1A3C2B] focus:outline-none select-all"
                />
                <button
                  onClick={handleCopy}
                  className="px-2.5 py-1 bg-[#1A3C2B] text-white hover:bg-[#2A533E] transition-colors font-mono text-[10px] font-bold flex items-center gap-1 flex-shrink-0 ml-1"
                >
                  {copied ? <Check className="w-3 h-3 text-emerald-300" /> : <Copy className="w-3 h-3" />}
                  <span>{copied ? 'MÁSOLVA' : 'MÁSOLÁS'}</span>
                </button>
              </div>
            </div>

            {/* A4 Page Layout & Copies selector */}
            <div className="bg-white border border-[#1A3C2B] p-2.5 flex flex-col gap-2 font-mono text-xs select-none">
              <span className="font-bold text-[#1A3C2B] uppercase text-[10px] tracking-wider block">
                📄 A4 PAPÍR ELRENDEZÉS & PÉLDÁNYSZÁM (PAPÍRTAKARÉKOS)
              </span>
              <div className="grid grid-cols-3 gap-1.5">
                <button
                  type="button"
                  onClick={() => setCopiesPerPage(1)}
                  className={`py-1.5 px-2 border text-[10px] font-bold transition-all flex flex-col items-center gap-0.5 ${
                    copiesPerPage === 1
                      ? 'bg-[#1A3C2B] text-white border-[#1A3C2B]'
                      : 'bg-white text-[#1A3C2B] border-[#1A3C2B]/30 hover:bg-[#F0F5F2]'
                  }`}
                >
                  <span>1 DB / A4</span>
                  <span className="text-[8px] opacity-75">Teljes méret</span>
                </button>
                <button
                  type="button"
                  onClick={() => setCopiesPerPage(2)}
                  className={`py-1.5 px-2 border text-[10px] font-bold transition-all flex flex-col items-center gap-0.5 ${
                    copiesPerPage === 2
                      ? 'bg-[#1A3C2B] text-white border-[#1A3C2B]'
                      : 'bg-white text-[#1A3C2B] border-[#1A3C2B]/30 hover:bg-[#F0F5F2]'
                  }`}
                >
                  <span>2 DB / A4</span>
                  <span className="text-[8px] opacity-75">A5 méret (Fél lap)</span>
                </button>
                <button
                  type="button"
                  onClick={() => setCopiesPerPage(4)}
                  className={`py-1.5 px-2 border text-[10px] font-bold transition-all flex flex-col items-center gap-0.5 ${
                    copiesPerPage === 4
                      ? 'bg-[#1A3C2B] text-white border-[#1A3C2B]'
                      : 'bg-white text-[#1A3C2B] border-[#1A3C2B]/30 hover:bg-[#F0F5F2]'
                  }`}
                >
                  <span>4 DB / A4</span>
                  <span className="text-[8px] opacity-75">A6 méret (Negyed lap)</span>
                </button>
              </div>
            </div>

            {/* 2-Page Print Option Toggle */}
            {routeResult && routeResult.steps.length > 0 && (
              <label className="flex items-start gap-2.5 cursor-pointer bg-white border border-[#1A3C2B] p-2.5 font-mono text-xs hover:bg-[#F0F5F2] transition-colors select-none">
                <input
                  type="checkbox"
                  checked={includeRouteStepsInPrint}
                  onChange={(e) => setIncludeRouteStepsInPrint(e.target.checked)}
                  className="mt-0.5 accent-[#1A3C2B] w-4 h-4 cursor-pointer"
                />
                <div className="flex flex-col">
                  <span className="font-bold text-[#1A3C2B]">
                    Útvonalutasítások nyomtatása a 2. oldalra (2 oldalas)
                  </span>
                  <span className="text-[9px] text-[#1A3C2B]/70 leading-tight mt-0.5">
                    1. oldal (előlap): QR kód & Célállomás design • 2. oldal (hátlap): Szöveges útvonalutasítások
                  </span>
                </div>
              </label>
            )}

            {/* Footer Actions */}
            <div className="flex items-center justify-between pt-1 border-t border-[#1A3C2B]/20">
              <button
                onClick={handlePrint}
                className="px-3.5 py-1.5 bg-[#1A3C2B] text-white hover:bg-[#2A533E] font-mono text-xs font-bold flex items-center gap-1.5 transition-colors shadow-xs"
                title="Nyomtató- és papírbarát QR + Útvonal lap nyomtatása"
              >
                <Printer className="w-3.5 h-3.5 text-emerald-300" />
                <span>
                  NYOMTATÁS ({copiesPerPage} DB / LAP • {includeRouteStepsInPrint && routeResult?.steps.length ? '2 OLDALAS' : '1 OLDALAS'})
                </span>
              </button>
              <button
                onClick={onClose}
                className="px-4 py-1.5 bg-[#F7F7F5] hover:bg-[#EFEFEA] border border-[#1A3C2B] text-[#1A3C2B] font-mono text-xs font-bold"
              >
                BEZÁRÁS
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};
