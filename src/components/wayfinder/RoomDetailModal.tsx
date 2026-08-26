import React from 'react';
import type { Room, Floor, Building } from '../../types';
import { ROOM_CATEGORY_NAMES_HU } from '../../types';
import { polygonAreaInSquareMeters } from '../../utils/geometry';
import {
  MapPin,
  Users,
  Building as BuildingIcon,
  Tag,
  Navigation,
  Sparkles,
  Shield,
  Layers,
  X,
} from 'lucide-react';

interface RoomDetailModalProps {
  isOpen?: boolean;
  room: Room | null;
  floor: Floor;
  building: Building;
  onClose: () => void;
  onSetAsStart: (roomId: string) => void;
  onSetAsDestination: (roomId: string) => void;
}

export const RoomDetailModal: React.FC<RoomDetailModalProps> = ({
  isOpen = true,
  room,
  floor,
  building,
  onClose,
  onSetAsStart,
  onSetAsDestination,
}) => {
  if (!isOpen || !room) return null;

  const areaM2 = polygonAreaInSquareMeters(room.polygon).toFixed(1);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#1A3C2B]/40 backdrop-blur-xs select-none">
      <div className="bg-[#F7F7F5] border-2 border-[#1A3C2B] w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="p-4 bg-[#1A3C2B] text-[#F7F7F5] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs px-2 py-0.5 bg-[#F7F7F5] text-[#1A3C2B] font-bold">
              {room.code}
            </span>
            <span className="font-mono text-[10px] tracking-wider uppercase text-[#F7F7F5]/80">
              ÉPÍTÉSZETI ADATLAP
            </span>
          </div>
          <button
            onClick={onClose}
            className="text-[#F7F7F5]/80 hover:text-white font-mono text-sm px-1.5"
          >
            ✕
          </button>
        </div>

        {/* Content Body */}
        <div className="p-5 flex flex-col gap-4">
          <div>
            <h3 className="font-sans font-bold text-xl text-[#1A3C2B] leading-snug">
              {room.name}
            </h3>
            <p className="font-mono text-xs text-[#1A3C2B]/70 mt-1">
              {building.name} • {floor.name} ({floor.shortCode}. szint)
            </p>
          </div>

          {/* Key Metric Grid (Bento) */}
          <div className="grid grid-cols-3 gap-2 border border-[#1A3C2B] bg-white p-3">
            <div className="flex flex-col">
              <span className="font-mono text-[9px] uppercase text-[#1A3C2B]/60">KATEGÓRIA</span>
              <span className="font-sans text-xs font-bold text-[#1A3C2B] truncate">
                {ROOM_CATEGORY_NAMES_HU[room.category] || room.category}
              </span>
            </div>
            <div className="flex flex-col border-l border-[#1A3C2B]/20 pl-2">
              <span className="font-mono text-[9px] uppercase text-[#1A3C2B]/60">FÉRŐHELY</span>
              <span className="font-sans text-xs font-bold text-[#1A3C2B]">
                {room.capacity ? `${room.capacity} fő` : '—'}
              </span>
            </div>
            <div className="flex flex-col border-l border-[#1A3C2B]/20 pl-2">
              <span className="font-mono text-[9px] uppercase text-[#1A3C2B]/60">ALAPTERÜLET</span>
              <span className="font-sans text-xs font-bold text-[#1A3C2B]">{areaM2} m²</span>
            </div>
          </div>

          {/* Department & Occupant */}
          {(room.department || room.occupant) && (
            <div className="border border-[#1A3C2B] bg-[#FFFFFF] p-3 flex flex-col gap-1 text-xs">
              {room.department && (
                <div className="flex items-center gap-2">
                  <span className="font-mono text-[10px] text-[#1A3C2B]/70 uppercase w-28">
                    TANSZÉK / EGYSÉG:
                  </span>
                  <span className="font-bold text-[#1A3C2B]">{room.department}</span>
                </div>
              )}
              {room.occupant && (
                <div className="flex items-center gap-2">
                  <span className="font-mono text-[10px] text-[#1A3C2B]/70 uppercase w-28">
                    FELELŐS / OKTATÓ:
                  </span>
                  <span className="font-bold text-[#1A3C2B]">{room.occupant}</span>
                </div>
              )}
            </div>
          )}

          {/* Description */}
          {room.description && (
            <p className="font-sans text-xs text-[#1A3C2B]/90 bg-white border border-[#D0D0C7] p-2.5 leading-relaxed">
              {room.description}
            </p>
          )}

          {/* Tags & Features */}
          {room.tags && room.tags.length > 0 && (
            <div className="flex flex-col gap-1">
              <span className="font-mono text-[9px] uppercase text-[#1A3C2B]/70">
                FELSZERELTSÉG & SAJÁTOSSÁGOK
              </span>
              <div className="flex flex-wrap gap-1.5">
                {room.tags.map((tag, idx) => (
                  <span
                    key={idx}
                    className="font-mono text-[10px] px-2 py-0.5 bg-[#FFFFFF] border border-[#1A3C2B] text-[#1A3C2B]"
                  >
                    ✓ {tag}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="grid grid-cols-2 gap-3 pt-2">
            <button
              onClick={() => {
                onSetAsStart(room.id);
                onClose();
              }}
              className="py-2.5 px-3 border border-[#1A3C2B] bg-white text-[#1A3C2B] hover:bg-[#F0F5F2] transition-colors font-mono text-xs font-bold flex items-center justify-center gap-1.5"
            >
              <div className="w-2 h-2 rounded-full bg-[#047857]" />
              <span>INDULÁS INNEN</span>
            </button>

            <button
              onClick={() => {
                onSetAsDestination(room.id);
                onClose();
              }}
              className="py-2.5 px-3 border border-[#1A3C2B] bg-[#1A3C2B] text-[#F7F7F5] hover:bg-[#2A533E] transition-colors font-mono text-xs font-bold flex items-center justify-center gap-1.5"
            >
              <MapPin className="w-3.5 h-3.5" />
              <span>ÚTVONAL IDE</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
