import React from 'react';
import type { RouteStep } from '../../types';
import {
  Navigation,
  CornerUpRight,
  CornerUpLeft,
  ArrowUp,
  ArrowDown,
  MapPin,
  Footprints,
  Layers,
  Sparkles,
  DoorOpen,
} from 'lucide-react';

interface TurnByTurnListProps {
  steps: RouteStep[];
  currentFloorId: string;
  onStepClick?: (step: RouteStep) => void;
  className?: string;
}

export const TurnByTurnList: React.FC<TurnByTurnListProps> = ({
  steps,
  currentFloorId,
  onStepClick,
  className = '',
}) => {
  if (!steps || steps.length === 0) {
    return (
      <div className="p-4 text-center text-[#1A3C2B]/60 font-mono text-xs border border-dashed border-[#1A3C2B]/30">
        Nincs aktív útvonal tervezve. Válasszon kiindulási és célpontot.
      </div>
    );
  }

  return (
    <div className={`flex flex-col gap-2 ${className}`}>
      {steps.map((step, idx) => {
        const isCurrentFloor = step.floorId === currentFloorId;
        const isFloorChange = step.isFloorChange;

        // Determine icon
        let iconNode = <Navigation className="w-4 h-4 text-[#1A3C2B]" />;
        if (step.iconType === 'start') {
          iconNode = <div className="w-2.5 h-2.5 rounded-full bg-[#047857]" />;
        } else if (step.iconType === 'end') {
          iconNode = <MapPin className="w-4 h-4 text-[#B91C1C]" />;
        } else if (step.iconType === 'door') {
          iconNode = <DoorOpen className="w-4 h-4 text-emerald-800" />;
        } else if (step.iconType === 'turn_left') {
          iconNode = <CornerUpLeft className="w-4 h-4 text-[#1A3C2B]" />;
        } else if (step.iconType === 'turn_right') {
          iconNode = <CornerUpRight className="w-4 h-4 text-[#1A3C2B]" />;
        } else if (step.iconType === 'transit') {
          iconNode = <Layers className="w-4 h-4 text-[#1A3C2B]" />;
        }

        return (
          <div
            key={idx}
            onClick={() => onStepClick && onStepClick(step)}
            className={`border p-3 cursor-pointer transition-all ${
              isFloorChange
                ? 'bg-[#1A3C2B] text-[#F7F7F5] border-[#1A3C2B]'
                : isCurrentFloor
                ? 'bg-[#FFFFFF] border-[#1A3C2B] hover:bg-[#F0F5F2]'
                : 'bg-[#F7F7F5] border-[#D0D0C7] opacity-75 hover:opacity-100 hover:border-[#1A3C2B]'
            }`}
          >
            <div className="flex items-start gap-3">
              {/* Step Number & Icon */}
              <div
                className={`w-7 h-7 flex-shrink-0 flex items-center justify-center border font-mono text-xs font-bold ${
                  isFloorChange
                    ? 'border-[#F7F7F5] bg-[#F7F7F5] text-[#1A3C2B]'
                    : 'border-[#1A3C2B] bg-[#F7F7F5] text-[#1A3C2B]'
                }`}
              >
                {step.stepIndex}
              </div>

              {/* Step Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2 mb-0.5">
                  <span
                    className={`font-mono text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 border ${
                      isFloorChange
                        ? 'border-[#F7F7F5]/40 text-[#F7F7F5]'
                        : 'border-[#1A3C2B]/30 text-[#1A3C2B]'
                    }`}
                  >
                    {step.floorShortCode} SZINT
                  </span>
                  {step.distanceMeters > 0 && (
                    <span
                      className={`font-mono text-[10px] ${
                        isFloorChange ? 'text-[#F7F7F5]/80' : 'text-[#1A3C2B]/70'
                      }`}
                    >
                      {step.distanceMeters}m
                    </span>
                  )}
                </div>

                <p
                  className={`font-sans text-xs font-bold leading-snug ${
                    isFloorChange ? 'text-[#F7F7F5]' : 'text-[#1A3C2B]'
                  }`}
                >
                  {step.instruction}
                </p>

                <p
                  className={`font-mono text-[10px] mt-0.5 ${
                    isFloorChange ? 'text-[#F7F7F5]/80' : 'text-[#1A3C2B]/70'
                  }`}
                >
                  {step.detail}
                </p>
              </div>

              {/* Directional Icon */}
              <div className="flex-shrink-0 self-center">{iconNode}</div>
            </div>
          </div>
        );
      })}
    </div>
  );
};
