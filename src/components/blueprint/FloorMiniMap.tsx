import React from 'react';
import type { Floor, ViewportTransform } from '../../types';

interface FloorMiniMapProps {
  floor: Floor;
  viewport: ViewportTransform;
  containerSize: { width: number; height: number };
  onNavigate?: (x: number, y: number) => void;
  className?: string;
}

export const FloorMiniMap: React.FC<FloorMiniMapProps> = ({
  floor,
  viewport,
  containerSize,
  onNavigate,
  className = '',
}) => {
  const mapWidth = 140;
  const mapHeight = (floor.height / floor.width) * mapWidth;
  const scale = mapWidth / floor.width;

  // Viewport rect on mini-map
  const viewWidth = (containerSize.width / viewport.zoom) * scale;
  const viewHeight = (containerSize.height / viewport.zoom) * scale;
  const viewX = (-viewport.x / viewport.zoom) * scale;
  const viewY = (-viewport.y / viewport.zoom) * scale;

  const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!onNavigate) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;

    const floorX = clickX / scale;
    const floorY = clickY / scale;

    const targetX = -floorX * viewport.zoom + containerSize.width / 2;
    const targetY = -floorY * viewport.zoom + containerSize.height / 2;
    onNavigate(targetX, targetY);
  };

  return (
    <div
      className={`bg-[#F7F7F5] border border-[#1A3C2B] p-1.5 cursor-crosshair select-none ${className}`}
      onClick={handleClick}
      title="Mini-térkép navigátor (Kattintson a mozgatáshoz)"
    >
      <div className="flex items-center justify-between pb-1 border-b border-[#1A3C2B]/20 text-[8px] font-mono uppercase text-[#1A3C2B]">
        <span>ÁTTEKINTÉS</span>
        <span>{floor.shortCode}</span>
      </div>

      <div
        className="relative bg-white border border-[#D0D0C7] overflow-hidden mt-1"
        style={{ width: `${mapWidth}px`, height: `${mapHeight}px` }}
      >
        {/* Rooms miniature */}
        <svg
          viewBox={`0 0 ${floor.width} ${floor.height}`}
          className="w-full h-full"
        >
          {floor.rooms.map((room) => {
            const pointsStr = room.polygon.map((p) => `${p.x},${p.y}`).join(' ');
            return (
              <polygon
                key={room.id}
                points={pointsStr}
                fill="rgba(26, 60, 43, 0.12)"
                stroke="#1A3C2B"
                strokeWidth="2"
              />
            );
          })}
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
        </svg>

        {/* Viewport Indicator Frame */}
        <div
          className="absolute border-2 border-cad-red pointer-events-none transition-all duration-75"
          style={{
            left: `${Math.max(0, viewX)}px`,
            top: `${Math.max(0, viewY)}px`,
            width: `${Math.min(mapWidth, Math.max(12, viewWidth))}px`,
            height: `${Math.min(mapHeight, Math.max(12, viewHeight))}px`,
            backgroundColor: 'rgba(185, 28, 28, 0.1)',
          }}
        />
      </div>
    </div>
  );
};
