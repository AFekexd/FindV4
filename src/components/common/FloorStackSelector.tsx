import React from 'react';
import type { Building, Floor, RouteResult } from '../../types';
import { Layers, ChevronUp, ChevronDown, Check } from 'lucide-react';

interface FloorStackSelectorProps {
  building: Building;
  activeFloorId: string;
  routeResult?: RouteResult | null;
  onSelectFloor: (floorId: string) => void;
  className?: string;
}

export const FloorStackSelector: React.FC<FloorStackSelectorProps> = ({
  building,
  activeFloorId,
  routeResult,
  onSelectFloor,
  className = '',
}) => {
  // Sort floors from highest elevation/level to lowest (architectural stack order: top floor to ground/basement)
  const sortedFloors = [...building.floors].sort((a, b) => {
    const elevA = a.elevationMeters ?? a.level ?? 0;
    const elevB = b.elevationMeters ?? b.level ?? 0;
    if (elevB !== elevA) return elevB - elevA;
    return (b.level ?? 0) - (a.level ?? 0);
  });

  return (
    <div
      className={`bg-[#F7F7F5] border border-[#1A3C2B] p-2 flex flex-col gap-1.5 select-none ${className}`}
    >
      <div className="flex items-center justify-between border-b border-[#1A3C2B]/20 pb-1 text-[9px] font-mono font-bold text-[#1A3C2B] uppercase">
        <span>SZINTEK ÁTTEKINTÉSE</span>
        <span>{building.floors.length} SZINT</span>
      </div>

      <div className="flex flex-col gap-1">
        {sortedFloors.map((floor) => {
          const isActive = floor.id === activeFloorId;
          const isTraversedByRoute = routeResult?.floorsTraversed.includes(floor.id);

          return (
            <button
              key={floor.id}
              onClick={() => onSelectFloor(floor.id)}
              className={`p-2 text-left border flex items-center justify-between transition-all ${
                isActive
                  ? 'bg-[#1A3C2B] text-white border-[#1A3C2B]'
                  : isTraversedByRoute
                  ? 'bg-[#FFFFFF] text-[#1A3C2B] border-[#047857] border-l-4'
                  : 'bg-[#FFFFFF] text-[#1A3C2B] border-[#D0D0C7] hover:border-[#1A3C2B]'
              }`}
            >
              <div className="flex items-center gap-2">
                <span
                  className={`font-mono text-xs font-bold px-1.5 py-0.5 border ${
                    isActive
                      ? 'border-white/40 bg-white/10 text-white'
                      : 'border-[#1A3C2B]/30 bg-[#F7F7F5] text-[#1A3C2B]'
                  }`}
                >
                  {floor.shortCode}
                </span>
                <div className="flex flex-col min-w-0">
                  <span className="font-sans font-bold text-xs truncate max-w-[120px]">
                    {floor.name}
                  </span>
                  <span
                    className={`font-mono text-[8.5px] ${
                      isActive ? 'text-white/70' : 'text-[#1A3C2B]/60'
                    }`}
                  >
                    +{floor.elevationMeters.toFixed(1)}m • {floor.rooms.length} terem
                  </span>
                </div>
              </div>

              {isTraversedByRoute && !isActive && (
                <div className="w-2 h-2 rounded-full bg-[#047857] animate-pulse" title="Az útvonal érinti ezt a szintet" />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
};
