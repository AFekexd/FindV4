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
  const [showPrintPreview, setShowPrintPreview] = useState(false);

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

  return (
    <>
      {/* 1. DEDICATED INK-SAVING MINIMAL PRINT SHEET (@media print only) */}
      <div className="printable-qr-target hidden flex-col items-center justify-center text-center bg-white text-black p-8 font-sans">
        <div className="w-full max-w-md border-2 border-black p-8 flex flex-col items-center gap-5">
          {/* Header */}
          <div className="border-b-2 border-black pb-3 w-full text-center">
            <span className="font-mono text-xs font-black tracking-widest uppercase block">
              POLLÁK // MOBIL NAVIGÁCIÓ
            </span>
            <span className="text-sm font-bold text-gray-800">{building.name}</span>
          </div>

          {/* Route Endpoints Box (Minimal, Ink-Friendly) */}
          <div className="w-full flex flex-col gap-2 text-left font-mono border border-black p-3.5 text-xs">
            {/* Start Station */}
            <div className="flex items-start gap-2">
              <span className="font-black px-1.5 py-0.5 border border-black text-[10px] uppercase">
                START
              </span>
              <div className="flex flex-col">
                <span className="font-bold text-sm">
                  {startRoom ? `${startRoom.name} (${startRoom.code})` : 'Kiindulási helyiség'}
                </span>
                <span className="text-gray-600 text-[10px]">{startFloorName}</span>
              </div>
            </div>

            {/* Down Arrow */}
            <div className="flex items-center justify-center my-0.5 text-gray-500">
              <span className="text-xs">↓</span>
            </div>

            {/* Destination Station */}
            <div className="flex items-start gap-2">
              <span className="font-black px-1.5 py-0.5 bg-black text-white text-[10px] uppercase">
                CÉL
              </span>
              <div className="flex flex-col">
                <span className="font-bold text-sm">
                  {targetRoom ? `${targetRoom.name} (${targetRoom.code})` : 'Célállomás'}
                </span>
                <span className="text-gray-600 text-[10px]">{targetFloorName}</span>
              </div>
            </div>
          </div>

          {/* High-Resolution QR Code */}
          <div className="p-3 border border-black bg-white flex items-center justify-center my-2">
            <QRCodeSVG
              value={shareUrl}
              size={240}
              level="H"
              fgColor="#000000"
              bgColor="#FFFFFF"
            />
          </div>

          {/* Instruction */}
          <div className="flex flex-col items-center gap-1">
            <span className="font-bold text-xs uppercase tracking-wide">
              Olvassa be telefonjával az azonnali navigációhoz!
            </span>
            <span className="text-[10px] text-gray-600">
              Kamerával beolvasva azonnal megnyílik a lépésről-lépésre útvonalterv.
            </span>
          </div>

          {/* Telemetry Footer */}
          {routeResult && (
            <div className="border-t border-black/30 pt-2 w-full flex items-center justify-between font-mono text-[10px] text-gray-700">
              <span>Távolság: <b>{routeResult.totalDistanceMeters} m</b></span>
              <span>Menetidő: <b>~{routeResult.estimatedTimeMinutes} perc</b></span>
              <span>Érintett szintek: <b>{routeResult.floorsTraversed.length} db</b></span>
            </div>
          )}
        </div>
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

            {/* Route Summary Telemetry */}
            {routeResult && (
              <div className="bg-[#FFFFFF] border border-[#D0D0C7] p-2.5 flex items-center justify-between text-xs font-mono">
                <div className="flex flex-col">
                  <span className="text-[9px] text-[#1A3C2B]/60 uppercase">TÁVOLSÁG</span>
                  <span className="font-bold text-[#1A3C2B]">{routeResult.totalDistanceMeters} méter</span>
                </div>
                <div className="flex flex-col">
                  <span className="text-[9px] text-[#1A3C2B]/60 uppercase">MENETIDŐ</span>
                  <span className="font-bold text-[#1A3C2B]">~{routeResult.estimatedTimeMinutes} perc</span>
                </div>
                <div className="flex flex-col">
                  <span className="text-[9px] text-[#1A3C2B]/60 uppercase">SZINTEK</span>
                  <span className="font-bold text-[#1A3C2B]">{routeResult.floorsTraversed.length} szint</span>
                </div>
              </div>
            )}

            {/* Footer Actions */}
            <div className="flex items-center justify-between pt-1 border-t border-[#1A3C2B]/20">
              <button
                onClick={handlePrint}
                className="px-3.5 py-1.5 bg-[#1A3C2B] text-white hover:bg-[#2A533E] font-mono text-xs font-bold flex items-center gap-1.5 transition-colors shadow-xs"
                title="Nyomtató- és papírbarát QR lap nyomtatása"
              >
                <Printer className="w-3.5 h-3.5 text-emerald-300" />
                <span>PAPÍRBARÁT NYOMTATÁS</span>
              </button>
              <button
                onClick={onClose}
                className="px-4 py-1.5 bg-white border border-[#1A3C2B] text-[#1A3C2B] hover:bg-[#EFEFEA] font-mono text-xs font-bold"
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
