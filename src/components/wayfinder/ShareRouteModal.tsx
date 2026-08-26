import React, { useState } from 'react';
import type { RouteResult, Building, Room } from '../../types';
import { QRCodeSVG } from 'qrcode.react';
import { Share2, Copy, Check, QrCode, ExternalLink, Printer, Smartphone } from 'lucide-react';

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

  if (!isOpen) return null;

  const originUrl =
    typeof window !== 'undefined'
      ? `${window.location.origin}${window.location.pathname.replace(/\/$/, '')}`
      : '';
  const stopsQuery = intermediateStopIds.length > 0 ? `&stops=${intermediateStopIds.join(',')}` : '';
  const shareUrl = `${originUrl}/?inst=${building.institutionId}&bld=${building.id}&start=${startRoomId || ''}&dest=${targetRoomId || ''}${stopsQuery}&mode=mobile`;

  const handleCopy = () => {
    navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#1A3C2B]/40 backdrop-blur-xs select-none">
      <div className="bg-[#F7F7F5] border-2 border-[#1A3C2B] w-full max-w-md overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="p-4 bg-[#1A3C2B] text-[#F7F7F5] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Share2 className="w-4 h-4" />
            <span className="font-mono text-xs font-bold uppercase tracking-wider">
              MOBIL ÚTVONAL MEGOSZTÁSA // QR KÓD
            </span>
          </div>
          <button onClick={onClose} className="font-mono text-sm text-[#F7F7F5]/80 hover:text-white">
            ✕
          </button>
        </div>

        <div className="p-5 flex flex-col gap-4">
          {/* Functional High-Res QR Code */}
          <div className="flex flex-col items-center justify-center p-4 bg-white border-2 border-[#1A3C2B]">
            <div className="p-3 bg-white border border-[#D0D0C7]">
              <QRCodeSVG
                value={shareUrl}
                size={180}
                level="M"
                fgColor="#1A3C2B"
                bgColor="#FFFFFF"
              />
            </div>
            <span className="font-mono text-[10px] uppercase font-bold tracking-wider text-[#1A3C2B] mt-3 flex items-center gap-1.5">
              <Smartphone className="w-3.5 h-3.5" />
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
              className="w-full py-2 bg-white hover:bg-[#F0F5F2] border border-[#1A3C2B] text-[#1A3C2B] font-mono text-xs font-bold flex items-center justify-center gap-2 transition-colors"
            >
              <Smartphone className="w-4 h-4" />
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
              className="px-3 py-1.5 border border-[#1A3C2B] hover:bg-[#EFEFEA] text-[#1A3C2B] font-mono text-xs font-bold flex items-center gap-1.5"
            >
              <Printer className="w-3 h-3" />
              <span>NYOMTATÁS</span>
            </button>
            <button
              onClick={onClose}
              className="px-4 py-1.5 bg-[#1A3C2B] text-white hover:bg-[#2A533E] font-mono text-xs font-bold"
            >
              BEZÁRÁS
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
