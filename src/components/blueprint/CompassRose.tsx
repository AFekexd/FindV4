import React from 'react';

interface CompassRoseProps {
  rotation?: number; // degrees
  className?: string;
}

export const CompassRose: React.FC<CompassRoseProps> = ({ rotation = 0, className = '' }) => {
  return (
    <div
      className={`inline-flex flex-col items-center justify-center select-none ${className}`}
      title="Architectural Project Orientation (North)"
    >
      <div
        className="relative w-12 h-12 border border-[#1A3C2B] bg-[#F7F7F5] flex items-center justify-center transition-transform duration-300"
        style={{ transform: `rotate(${rotation}deg)` }}
      >
        {/* Crosshair lines */}
        <div className="absolute inset-x-0 top-1/2 h-[1px] bg-[#1A3C2B]/30" />
        <div className="absolute inset-y-0 left-1/2 w-[1px] bg-[#1A3C2B]/30" />

        {/* North Arrow Triangle */}
        <svg viewBox="0 0 24 24" className="w-8 h-8" fill="none">
          {/* North Point (Filled Forest Green) */}
          <polygon points="12,2 8,12 12,10" fill="#1A3C2B" />
          <polygon points="12,2 16,12 12,10" fill="none" stroke="#1A3C2B" strokeWidth="1" />
          {/* South Point */}
          <polygon points="12,22 8,12 12,14" fill="none" stroke="#1A3C2B" strokeWidth="1" strokeDasharray="1 1" />
          <polygon points="12,22 16,12 12,14" fill="#D0D0C7" />
        </svg>

        {/* North Label */}
        <span className="absolute -top-2.5 font-mono text-[9px] font-bold bg-[#F7F7F5] px-1 text-[#1A3C2B] border border-[#1A3C2B]">
          N
        </span>
      </div>
      {/* Északi jelölő */}
      <div className="font-mono text-[8px] tracking-widest text-[#1A3C2B]/70 mt-1 uppercase">
        ÉSZAK (N)
      </div>
    </div>
  );
};
