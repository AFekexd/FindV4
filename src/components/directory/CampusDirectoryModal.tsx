import React, { useState, useMemo } from 'react';
import type { Institution, Building, Floor, Room, RoomCategory } from '../../types';
import { ROOM_CATEGORY_NAMES_HU } from '../../types';
import { Search, MapPin, Building as BuildingIcon, Users, Tag, X, Navigation } from 'lucide-react';
import { polygonAreaInSquareMeters } from '../../utils/geometry';

interface CampusDirectoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  institutions: Institution[];
  activeInstitutionId: string;
  activeBuildingId: string;
  onNavigateToRoom: (instId: string, bldId: string, floorId: string, roomId: string) => void;
  onSetStartRoom: (roomId: string) => void;
}

export const CampusDirectoryModal: React.FC<CampusDirectoryModalProps> = ({
  isOpen,
  onClose,
  institutions,
  activeInstitutionId,
  activeBuildingId,
  onNavigateToRoom,
  onSetStartRoom,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedInstId, setSelectedInstId] = useState<string>(activeInstitutionId);

  const currentInst = institutions.find((i) => i.id === selectedInstId) || institutions[0];

  // Aggregate all rooms in this institution
  const allRooms = useMemo(() => {
    const list: { room: Room; floor: Floor; building: Building }[] = [];
    if (!currentInst) return list;
    for (const bld of currentInst.buildings) {
      for (const floor of bld.floors) {
        for (const room of floor.rooms) {
          list.push({ room, floor, building: bld });
        }
      }
    }
    return list;
  }, [currentInst]);

  // Categories present
  const availableCategories = useMemo(() => {
    const set = new Set<string>();
    for (const item of allRooms) {
      set.add(item.room.category);
    }
    return Array.from(set);
  }, [allRooms]);

  // Filtered rooms
  const filteredRooms = useMemo(() => {
    return allRooms.filter(({ room, floor, building }) => {
      if (selectedCategory !== 'all' && room.category !== selectedCategory) {
        return false;
      }
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      return (
        room.name.toLowerCase().includes(q) ||
        room.code.toLowerCase().includes(q) ||
        (room.department && room.department.toLowerCase().includes(q)) ||
        (room.occupant && room.occupant.toLowerCase().includes(q)) ||
        room.tags.some((t) => t.toLowerCase().includes(q)) ||
        building.name.toLowerCase().includes(q) ||
        floor.name.toLowerCase().includes(q)
      );
    });
  }, [allRooms, selectedCategory, searchQuery]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#1A3C2B]/40 backdrop-blur-xs select-none">
      <div className="bg-[#F7F7F5] border-2 border-[#1A3C2B] w-full max-w-4xl max-h-[85vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="p-4 bg-[#1A3C2B] text-[#F7F7F5] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs font-bold uppercase tracking-wider">
              CAMPUS TÉRKÉPES NÉVTÁR // HELYISÉGKERESŐ
            </span>
          </div>
          <button onClick={onClose} className="font-mono text-sm text-[#F7F7F5]/80 hover:text-white">
            ✕
          </button>
        </div>

        {/* Filter Controls (Bento Top Bar) */}
        <div className="p-4 bg-white border-b border-[#1A3C2B] flex flex-col gap-3">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
            {/* Campus Selector Pill */}
            <select
              value={selectedInstId}
              onChange={(e) => setSelectedInstId(e.target.value)}
              className="bg-[#F7F7F5] border border-[#1A3C2B] px-3 py-2 font-mono text-xs font-bold text-[#1A3C2B]"
            >
              {institutions.map((inst) => (
                <option key={inst.id} value={inst.id}>
                  {inst.name} ({inst.city})
                </option>
              ))}
            </select>

            {/* Search Input */}
            <div className="flex-1 flex items-center bg-[#F7F7F5] border border-[#1A3C2B] px-3 py-2">
              <Search className="w-4 h-4 text-[#1A3C2B]/60 mr-2 flex-shrink-0" />
              <input
                type="text"
                placeholder="Keresés termek, professzorok, laborok, előadók, szolgáltatások között..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-transparent font-sans text-xs text-[#1A3C2B] focus:outline-none"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="font-mono text-xs text-[#1A3C2B]/60 hover:text-[#1A3C2B]"
                >
                  ✕
                </button>
              )}
            </div>
          </div>

          {/* Category Filter Chips */}
          <div className="flex flex-wrap gap-1.5 items-center">
            <span className="font-mono text-[9px] uppercase font-bold text-[#1A3C2B]/60 mr-1">
              KATEGÓRIA:
            </span>
            <button
              onClick={() => setSelectedCategory('all')}
              className={`font-mono text-[10px] px-2 py-0.5 border transition-colors ${
                selectedCategory === 'all'
                  ? 'bg-[#1A3C2B] text-white border-[#1A3C2B]'
                  : 'bg-white text-[#1A3C2B] border-[#D0D0C7] hover:border-[#1A3C2B]'
              }`}
            >
              ÖSSZES ({allRooms.length})
            </button>
            {availableCategories.map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`font-mono text-[10px] px-2 py-0.5 border transition-colors ${
                  selectedCategory === cat
                    ? 'bg-[#1A3C2B] text-white border-[#1A3C2B]'
                    : 'bg-white text-[#1A3C2B] border-[#D0D0C7] hover:border-[#1A3C2B]'
                }`}
              >
                {ROOM_CATEGORY_NAMES_HU[cat as RoomCategory] || cat}
              </button>
            ))}
          </div>
        </div>

        {/* Directory Grid */}
        <div className="p-4 flex-1 overflow-y-auto grid grid-cols-1 md:grid-cols-2 gap-3">
          {filteredRooms.map(({ room, floor, building }) => {
            const area = polygonAreaInSquareMeters(room.polygon).toFixed(0);
            return (
              <div
                key={room.id}
                className="p-3.5 bg-white border border-[#1A3C2B] hover:border-[#1A3C2B] flex flex-col justify-between gap-3 group transition-colors"
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <span className="font-mono text-xs font-bold px-1.5 py-0.5 bg-[#1A3C2B] text-white">
                      {room.code}
                    </span>
                    <span className="font-mono text-[9px] uppercase tracking-wider text-[#1A3C2B]/70 border border-[#D0D0C7] px-1">
                      {building.name} • {floor.shortCode}. szint
                    </span>
                  </div>

                  <h4 className="font-sans font-bold text-sm text-[#1A3C2B] leading-tight">
                    {room.name}
                  </h4>

                  {(room.department || room.occupant) && (
                    <p className="font-mono text-[10px] text-[#1A3C2B]/70 mt-1">
                      {room.department} {room.occupant ? `• ${room.occupant}` : ''}
                    </p>
                  )}

                  {room.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {room.tags.map((tag, tIdx) => (
                        <span
                          key={tIdx}
                          className="font-mono text-[8.5px] px-1 py-0.2 bg-[#F7F7F5] border border-[#D0D0C7] text-[#1A3C2B]"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-between border-t border-[#1A3C2B]/10 pt-2 text-xs">
                  <span className="font-mono text-[9px] text-[#1A3C2B]/60">
                    {area} m² • {room.capacity ? `${room.capacity} fő` : '—'}
                  </span>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => {
                        onSetStartRoom(room.id);
                        onNavigateToRoom(selectedInstId, building.id, floor.id, room.id);
                        onClose();
                      }}
                      className="px-2 py-1 border border-[#1A3C2B] text-[#1A3C2B] hover:bg-[#F0F5F2] font-mono text-[9px] font-bold"
                    >
                      INDULÁS INNEN
                    </button>
                    <button
                      onClick={() => {
                        onNavigateToRoom(selectedInstId, building.id, floor.id, room.id);
                        onClose();
                      }}
                      className="px-2 py-1 bg-[#1A3C2B] text-white hover:bg-[#2A533E] font-mono text-[9px] font-bold flex items-center gap-1"
                    >
                      <Navigation className="w-2.5 h-2.5" />
                      <span>ÚTVONAL IDE</span>
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="p-3 bg-[#FFFFFF] border-t border-[#1A3C2B] flex items-center justify-between text-xs font-mono text-[#1A3C2B]/70">
          <span>MEGJELENÍTVE: {filteredRooms.length} HELYISÉG ÉS LÉTESÍTMÉNY</span>
          <button
            onClick={onClose}
            className="px-4 py-1 bg-[#1A3C2B] text-white font-bold text-xs"
          >
            BEZÁRÁS
          </button>
        </div>
      </div>
    </div>
  );
};
