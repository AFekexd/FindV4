import React from 'react';
import type { Building, Floor, Room } from '../../types';
import { Compass, RotateCcw, X, Search, Sparkles, Navigation } from 'lucide-react';

interface KioskOverlayProps {
  building: Building;
  floor: Floor;
  onExitKiosk: () => void;
  onOpenDirectory: () => void;
  onQuickSelectTarget: (roomId: string) => void;
}

export const KioskOverlay: React.FC<KioskOverlayProps> = ({
  building,
  floor,
  onExitKiosk,
  onOpenDirectory,
  onQuickSelectTarget,
}) => {
  return (
    <div className="absolute inset-x-4 bottom-4 z-30 pointer-events-none flex flex-col items-center">
      <div className="bg-[#FFFFFF]/95 backdrop-blur-xs border-2 border-[#1A3C2B] p-4 pointer-events-auto flex flex-col md:flex-row items-center justify-between gap-4 max-w-3xl w-full">
        {/* Left Kiosk Info */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-[#1A3C2B] text-white flex items-center justify-center font-mono font-bold text-sm tracking-wider">
            ITT
          </div>
          <div>
            <h3 className="font-sans font-bold text-sm text-[#1A3C2B]">
              AULA ÉRINTŐKÉPERNYŐS INFORMÁCIÓS TERMINÁL
            </h3>
            <p className="font-mono text-xs text-[#1A3C2B]/70">
              Érintsen meg egy helyiséget az alaprajzon vagy válasszon a keresőből.
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={onOpenDirectory}
            className="px-3 py-2 bg-[#1A3C2B] text-white hover:bg-[#2A533E] font-mono text-xs font-bold flex items-center gap-1.5"
          >
            <Search className="w-3.5 h-3.5" />
            <span>NÉVTÁR MEGNYITÁSA</span>
          </button>

          <button
            onClick={onExitKiosk}
            className="px-3 py-2 border border-[#1A3C2B] bg-[#F7F7F5] hover:bg-[#EFEFEA] text-[#1A3C2B] font-mono text-xs font-bold flex items-center gap-1.5"
          >
            <X className="w-3.5 h-3.5" />
            <span>KILÉPÉS</span>
          </button>
        </div>
      </div>
    </div>
  );
};
