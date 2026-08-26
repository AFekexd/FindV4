import React from 'react';
import { PIXELS_PER_METER } from '../../utils/geometry';

interface BlueprintScaleBarProps {
  zoom: number;
  cursorPos?: { x: number; y: number } | null;
  elevationMeters?: number;
  className?: string;
}

export const BlueprintScaleBar: React.FC<BlueprintScaleBarProps> = ({
  zoom,
  cursorPos,
  elevationMeters = 0,
  className = '',
}) => {
  // At zoom = 1, 1 meter = 20px.
  // 5 meters = 100px on canvas. With zoom, scaled width = 100 * zoom.
  const fiveMetersPx = 5 * PIXELS_PER_METER * zoom;
  const tenMetersPx = 10 * PIXELS_PER_METER * zoom;

  return (
    <div
      className={`bg-[#F7F7F5] border border-[#1A3C2B] p-2 flex flex-col gap-1.5 font-mono text-[10px] text-[#1A3C2B] select-none ${className}`}
    >
      <div className="flex items-center justify-between gap-4 border-b border-[#1A3C2B]/20 pb-1">
        <span className="font-bold tracking-wider uppercase">CAD METRIKUS LÉPTÉK</span>
        <span className="bg-[#1A3C2B] text-[#F7F7F5] px-1 py-0.2 text-[9px]">1:100</span>
      </div>

      {/* Graphical Scale Bar */}
      <div className="flex flex-col gap-0.5">
        <div className="flex items-end" style={{ width: `${Math.max(80, tenMetersPx)}px` }}>
          {/* 0 to 5m block */}
          <div
            className="h-2 bg-[#1A3C2B] border-r border-[#F7F7F5] relative"
            style={{ width: `${Math.max(40, fiveMetersPx)}px` }}
          >
            <span className="absolute -top-3.5 left-0 text-[8px]">0m</span>
          </div>
          {/* 5 to 10m block */}
          <div
            className="h-2 bg-transparent border border-[#1A3C2B] border-l-0 relative"
            style={{ width: `${Math.max(40, fiveMetersPx)}px` }}
          >
            <span className="absolute -top-3.5 -left-1 text-[8px]">5m</span>
            <span className="absolute -top-3.5 -right-1 text-[8px]">10m</span>
          </div>
        </div>
      </div>

      {/* Coordinate & Zoom telemetry */}
      <div className="flex items-center justify-between text-[9px] text-[#1A3C2B]/80 pt-0.5 border-t border-[#1A3C2B]/10">
        <div>
          <span>NAGYÍTÁS: </span>
          <span className="font-semibold">{Math.round(zoom * 100)}%</span>
        </div>
        <div>
          <span>SZINT: </span>
          <span className="font-semibold">+{elevationMeters.toFixed(1)}m</span>
        </div>
        {cursorPos && (
          <div>
            <span>X: </span>
            <span className="font-semibold">{Math.round(cursorPos.x)}</span>
            <span className="ml-1">Y: </span>
            <span className="font-semibold">{Math.round(cursorPos.y)}</span>
          </div>
        )}
      </div>
    </div>
  );
};
