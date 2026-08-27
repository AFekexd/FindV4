import React, { useState, useMemo } from 'react';
import type {
  Building,
  Floor,
  Room,
  PointOfInterest,
  TransitConnector,
  RouteResult,
  RoutePreference,
  RouteStep,
} from '../../types';
import {
  POI_NAMES_HU,
  TRANSIT_NAMES_HU,
} from '../../types';
import {
  Search,
  ArrowUpDown,
  Accessibility,
  Clock,
  Play,
  Pause,
  RotateCcw,
  Share2,
  Layers,
  MapPin,
  Sparkles,
  Zap,
  Plus,
  Trash2,
  ChevronUp,
  ChevronDown,
  DoorOpen,
  Coffee,
  HeartPulse,
  Droplet,
  Compass,
  ArrowRight,
  CheckCircle2,
  Sliders,
} from 'lucide-react';
import { TurnByTurnList } from './TurnByTurnList';

export interface SearchableTargetItem {
  id: string;
  name: string;
  code?: string;
  floor: Floor;
  category: 'room' | 'poi' | 'transit';
  categoryLabel: string;
  subText?: string;
  icon: string;
}

interface WayfinderPanelProps {
  building: Building;
  currentFloor: Floor;
  startRoomId: string | null;
  targetRoomId: string | null;
  intermediateStopIds?: string[];
  routeResult: RouteResult | null;
  routePreferences: RoutePreference;
  activeSimulationProgress: number | null;
  isSimulating: boolean;
  onSetStartRoom: (targetId: string | null) => void;
  onSetTargetRoom: (targetId: string | null) => void;
  onSetIntermediateStops?: (stops: string[]) => void;
  onOptimizeStops?: () => void;
  onSetPreferences: (prefs: RoutePreference) => void;
  onStepClick: (step: RouteStep) => void;
  onStartSimulation: () => void;
  onPauseSimulation: () => void;
  onResetSimulation: () => void;
  onOpenShareModal: () => void;
  onInjectNearestPOI?: (poiType: string) => void;
  onInjectNearestTransit?: (transitType: 'stairs' | 'elevator') => void;
  className?: string;
}

export const WayfinderPanel: React.FC<WayfinderPanelProps> = ({
  building,
  currentFloor,
  startRoomId,
  targetRoomId,
  intermediateStopIds = [],
  routeResult,
  routePreferences,
  activeSimulationProgress,
  isSimulating,
  onSetStartRoom,
  onSetTargetRoom,
  onSetIntermediateStops,
  onOptimizeStops,
  onSetPreferences,
  onStepClick,
  onStartSimulation,
  onPauseSimulation,
  onResetSimulation,
  onOpenShareModal,
  onInjectNearestPOI,
  onInjectNearestTransit,
  className = '',
}) => {
  // Build unified searchable targets across all building floors
  const allSearchableTargets = useMemo<SearchableTargetItem[]>(() => {
    const list: SearchableTargetItem[] = [];

    for (const floor of building.floors) {
      // 1. Rooms
      for (const room of floor.rooms) {
        list.push({
          id: room.id,
          name: room.name,
          code: room.code,
          floor,
          category: 'room',
          categoryLabel: 'Helyiség',
          subText: room.department || (room.tags && room.tags.length > 0 ? room.tags.join(', ') : undefined),
          icon: 'room',
        });
      }

      // 2. POIs
      for (const poi of floor.pois) {
        const huName = POI_NAMES_HU[poi.type] || poi.name;
        list.push({
          id: poi.id,
          name: poi.name,
          code: huName,
          floor,
          category: 'poi',
          categoryLabel: 'Szolgáltatás / Ki-Bejárat',
          subText: poi.description,
          icon:
            poi.type === 'entrance' || poi.type === 'accessible_entrance'
              ? 'entrance'
              : poi.type === 'exit'
              ? 'exit'
              : poi.type === 'fire_exit'
              ? 'fire_exit'
              : poi.type.startsWith('restroom')
              ? 'restroom'
              : poi.type === 'coffee' || poi.type === 'vending'
              ? 'coffee'
              : poi.type === 'aed' || poi.type === 'first_aid'
              ? 'aed'
              : poi.type === 'water'
              ? 'water'
              : 'poi',
        });
      }

      // 3. Zones / Aulas
      for (const zone of floor.zones || []) {
        list.push({
          id: zone.id,
          name: zone.name,
          code: zone.code,
          floor,
          category: 'room',
          categoryLabel: 'Zóna / Aula',
          subText: zone.description || (zone.tags && zone.tags.length > 0 ? zone.tags.join(', ') : undefined),
          icon: 'room',
        });
      }

      // 4. Transit Connectors
      for (const transit of floor.transitConnectors) {
        const huName = TRANSIT_NAMES_HU[transit.type] || transit.name;
        list.push({
          id: transit.id,
          name: transit.name,
          code: huName,
          floor,
          category: 'transit',
          categoryLabel: 'Közlekedő mag',
          subText: transit.isAccessible ? 'Akadálymentes felvonó' : 'Lépcsőház',
          icon: transit.type === 'elevator' ? 'elevator' : 'stairs',
        });
      }
    }

    return list;
  }, [building]);

  const [startQuery, setStartQuery] = useState('');
  const [targetQuery, setTargetQuery] = useState('');
  const [isStartFocused, setIsStartFocused] = useState(false);
  const [isTargetFocused, setIsTargetFocused] = useState(false);
  const [addingStopQuery, setAddingStopQuery] = useState('');
  const [showAddStopDropdown, setShowAddStopDropdown] = useState(false);

  // Selected entities
  const startTargetItem = allSearchableTargets.find((t) => t.id === startRoomId);
  const destinationTargetItem = allSearchableTargets.find((t) => t.id === targetRoomId);

  // Filter helper
  const filterTargets = (query: string) => {
    if (!query.trim()) return allSearchableTargets.slice(0, 8);
    const q = query.toLowerCase();
    return allSearchableTargets
      .filter((t) => {
        const nameMatch = t.name.toLowerCase().includes(q);
        const codeMatch = t.code && t.code.toLowerCase().includes(q);
        const subMatch = t.subText && t.subText.toLowerCase().includes(q);
        const floorMatch = t.floor.name.toLowerCase().includes(q) || t.floor.shortCode.toLowerCase().includes(q);
        return nameMatch || codeMatch || subMatch || floorMatch;
      })
      .slice(0, 10);
  };

  const startFiltered = useMemo(() => filterTargets(startQuery), [allSearchableTargets, startQuery]);
  const targetFiltered = useMemo(() => filterTargets(targetQuery), [allSearchableTargets, targetQuery]);
  const stopFiltered = useMemo(() => filterTargets(addingStopQuery), [allSearchableTargets, addingStopQuery]);

  // Swap start & destination
  const handleSwap = () => {
    const prevStart = startRoomId;
    const prevTarget = targetRoomId;
    onSetStartRoom(prevTarget);
    onSetTargetRoom(prevStart);
  };

  const handleAddStop = (id: string) => {
    if (onSetIntermediateStops) {
      onSetIntermediateStops([...intermediateStopIds, id]);
    }
    setShowAddStopDropdown(false);
    setAddingStopQuery('');
  };

  const handleRemoveStop = (index: number) => {
    if (onSetIntermediateStops) {
      const updated = intermediateStopIds.filter((_, i) => i !== index);
      onSetIntermediateStops(updated);
    }
  };

  const handleMoveStop = (index: number, direction: 'up' | 'down') => {
    if (!onSetIntermediateStops) return;
    const targetIdx = direction === 'up' ? index - 1 : index + 1;
    if (targetIdx < 0 || targetIdx >= intermediateStopIds.length) return;
    const copy = [...intermediateStopIds];
    const temp = copy[index];
    copy[index] = copy[targetIdx];
    copy[targetIdx] = temp;
    onSetIntermediateStops(copy);
  };

  const renderTargetIcon = (item: SearchableTargetItem) => {
    if (item.category === 'transit') {
      return item.icon === 'elevator' ? '🛗' : '🪜';
    }
    if (item.category === 'poi') {
      if (item.icon === 'entrance') return '🚪';
      if (item.icon === 'exit') return '🚪';
      if (item.icon === 'fire_exit') return '🚨';
      if (item.icon === 'restroom') return '🚻';
      if (item.icon === 'coffee') return '☕';
      if (item.icon === 'aed') return '❤️';
      if (item.icon === 'water') return '🚰';
      return '📍';
    }
    return '🚪';
  };

  return (
    <div
      className={`bg-[#F7F7F5] border border-[#1A3C2B] flex flex-col h-full overflow-hidden select-none ${className}`}
    >
      {/* Top Header */}
      <div className="p-3 border-b border-[#1A3C2B] bg-[#FFFFFF] flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 bg-[#1A3C2B]" />
          <span className="font-mono text-xs font-bold tracking-wider text-[#1A3C2B] uppercase">
            ÚTVONALTERVEZŐ // NAVIGÁCIÓ
          </span>
        </div>
        <button
          onClick={onOpenShareModal}
          className="px-2 py-1 border border-[#1A3C2B] hover:bg-[#1A3C2B] hover:text-[#F7F7F5] transition-colors font-mono text-[10px] flex items-center gap-1 text-[#1A3C2B]"
          title="Útvonal és QR-kód megosztása"
        >
          <Share2 className="w-3 h-3" />
          <span className="hidden sm:inline">MEGOSZTÁS</span>
        </button>
      </div>

      {/* Origin, Waypoints & Destination Matrix */}
      <div className="p-3 bg-[#FFFFFF] border-b border-[#1A3C2B] flex flex-col gap-2 relative">
        {/* Origin Field */}
        <div className="relative">
          <label className="font-mono text-[9px] font-bold text-[#1A3C2B]/70 uppercase block mb-1 flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-[#047857] inline-block border border-black/20" />
              INDULÁSI PONT
            </span>
            {startTargetItem && (
              <span className="text-[9px] text-[#1A3C2B]/60 font-mono">
                {startTargetItem.floor.shortCode} • {startTargetItem.code}
              </span>
            )}
          </label>

          <div className="flex items-center border border-[#1A3C2B] bg-[#F7F7F5] px-2 py-1.5 focus-within:ring-1 focus-within:ring-[#1A3C2B]">
            <Search className="w-3.5 h-3.5 text-[#1A3C2B]/50 mr-2 flex-shrink-0" />
            <input
              type="text"
              placeholder="Indulási helyiség, lift vagy szolgáltatás..."
              value={
                isStartFocused
                  ? startQuery
                  : startTargetItem
                  ? `${startTargetItem.code ? `${startTargetItem.code} - ` : ''}${startTargetItem.name}`
                  : ''
              }
              onFocus={() => {
                setIsStartFocused(true);
                setStartQuery('');
              }}
              onBlur={() => setTimeout(() => setIsStartFocused(false), 200)}
              onChange={(e) => setStartQuery(e.target.value)}
              className="w-full bg-transparent font-sans text-xs text-[#1A3C2B] focus:outline-none placeholder-[#1A3C2B]/40"
            />
            {startRoomId && (
              <button
                onClick={() => onSetStartRoom(null)}
                className="font-mono text-xs text-[#1A3C2B]/60 hover:text-[#1A3C2B] ml-1"
                title="Törlés"
              >
                ✕
              </button>
            )}
          </div>

          {/* Autocomplete Dropdown for Start */}
          {isStartFocused && (
            <div className="absolute top-full left-0 right-0 z-30 mt-1 bg-[#FFFFFF] border border-[#1A3C2B] shadow-xl max-h-56 overflow-y-auto">
              {startFiltered.map((item) => (
                <div
                  key={item.id}
                  onMouseDown={() => onSetStartRoom(item.id)}
                  className="p-2 border-b border-[#D0D0C7]/50 hover:bg-[#F0F5F2] cursor-pointer flex items-center justify-between gap-2"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-sm">{renderTargetIcon(item)}</span>
                    <div className="flex flex-col min-w-0">
                      <span className="font-sans font-bold text-xs text-[#1A3C2B] truncate">{item.name}</span>
                      <span className="font-mono text-[9px] text-[#1A3C2B]/60 truncate">
                        {item.floor.shortCode} • {item.subText || item.categoryLabel}
                      </span>
                    </div>
                  </div>
                  {item.code && (
                    <span className="font-mono text-[10px] font-bold text-[#1A3C2B] px-1 bg-[#F7F7F5] border border-[#D0D0C7] flex-shrink-0">
                      {item.code}
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Intermediate Stops List */}
        {intermediateStopIds.length > 0 && (
          <div className="flex flex-col gap-1.5 my-0.5">
            {intermediateStopIds.map((stopId, sIdx) => {
              const stopItem = allSearchableTargets.find((t) => t.id === stopId);
              if (!stopItem) return null;
              return (
                <div
                  key={`${stopId}-${sIdx}`}
                  className="p-2 bg-[#F0F5F2] border border-[#1A3C2B]/40 flex items-center justify-between gap-2"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="font-mono text-[9px] font-bold px-1.5 py-0.5 bg-[#B45309] text-white flex-shrink-0">
                      {sIdx + 1}. MEGÁLLÓ
                    </span>
                    <span className="text-sm flex-shrink-0">{renderTargetIcon(stopItem)}</span>
                    <div className="flex flex-col min-w-0">
                      <span className="font-sans font-bold text-xs text-[#1A3C2B] truncate">{stopItem.name}</span>
                      <span className="font-mono text-[9px] text-[#1A3C2B]/70 truncate">
                        {stopItem.floor.shortCode} • {stopItem.code || stopItem.categoryLabel}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button
                      onClick={() => handleMoveStop(sIdx, 'up')}
                      disabled={sIdx === 0}
                      className="p-0.5 border border-[#1A3C2B]/30 disabled:opacity-30 hover:bg-white text-[9px]"
                      title="Mozgatás előre"
                    >
                      <ChevronUp className="w-3 h-3" />
                    </button>
                    <button
                      onClick={() => handleMoveStop(sIdx, 'down')}
                      disabled={sIdx === intermediateStopIds.length - 1}
                      className="p-0.5 border border-[#1A3C2B]/30 disabled:opacity-30 hover:bg-white text-[9px]"
                      title="Mozgatás hátra"
                    >
                      <ChevronDown className="w-3 h-3" />
                    </button>
                    <button
                      onClick={() => handleRemoveStop(sIdx)}
                      className="p-0.5 border border-red-300 text-red-700 hover:bg-red-50 text-[9px]"
                      title="Megálló törlése"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              );
            })}

            {/* Optimize Order Button */}
            {intermediateStopIds.length > 1 && onOptimizeStops && (
              <button
                onClick={onOptimizeStops}
                className="py-1 px-2 border border-[#B45309] bg-[#FFFBEB] text-[#B45309] hover:bg-[#FEF3C7] font-mono text-[10px] font-bold flex items-center justify-center gap-1.5 transition-colors shadow-xs"
                title="Köztes megállók sorrendjének optimalizálása a legrövidebb útvonalhoz"
              >
                <Zap className="w-3 h-3 text-[#B45309]" />
                <span>⚡ MEGÁLLÓK SORRENDJÉNEK OPTIMALIZÁLÁSA</span>
              </button>
            )}
          </div>
        )}

        {/* Action Bar (Add Stop & Swap) */}
        <div className="flex items-center justify-between pt-0.5">
          <button
            onClick={() => setShowAddStopDropdown(!showAddStopDropdown)}
            className="font-mono text-[10px] font-bold text-[#1A3C2B] hover:underline flex items-center gap-1"
          >
            <Plus className="w-3 h-3" />
            <span>+ KÖZTES MEGÁLLÓ HOZZÁADÁSA</span>
          </button>

          <button
            onClick={handleSwap}
            className="p-1 border border-[#1A3C2B]/40 hover:border-[#1A3C2B] hover:bg-[#F0F5F2] transition-colors"
            title="Indulási pont és célállomás megcserélése"
          >
            <ArrowUpDown className="w-3.5 h-3.5 text-[#1A3C2B]" />
          </button>
        </div>

        {/* Add Stop Autocomplete Input */}
        {showAddStopDropdown && (
          <div className="p-2.5 bg-[#FFFFFF] border border-[#1A3C2B] flex flex-col gap-1.5 shadow-md">
            <span className="font-mono text-[9px] font-bold text-[#1A3C2B] uppercase">Köztes megálló keresése:</span>
            <input
              type="text"
              placeholder="Terem, lift vagy szolgáltatás keresése..."
              value={addingStopQuery}
              onChange={(e) => setAddingStopQuery(e.target.value)}
              className="border border-[#1A3C2B] px-2 py-1 text-xs"
              autoFocus
            />
            <div className="max-h-36 overflow-y-auto flex flex-col gap-1">
              {stopFiltered.map((item) => (
                <div
                  key={item.id}
                  onClick={() => handleAddStop(item.id)}
                  className="p-1.5 border border-[#D0D0C7] hover:bg-[#F0F5F2] cursor-pointer flex items-center justify-between text-xs gap-2"
                >
                  <div className="flex items-center gap-1.5 truncate">
                    <span>{renderTargetIcon(item)}</span>
                    <span className="font-medium truncate">{item.name}</span>
                  </div>
                  <span className="font-mono text-[9px] px-1 bg-[#F7F7F5] flex-shrink-0">
                    {item.floor.shortCode} • {item.code || item.categoryLabel}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Destination Field */}
        <div className="relative">
          <label className="font-mono text-[9px] font-bold text-[#1A3C2B]/70 uppercase block mb-1 flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 bg-[#B91C1C] rotate-45 inline-block border border-black/20" />
              CÉLÁLLOMÁS
            </span>
            {destinationTargetItem && (
              <span className="text-[9px] text-[#1A3C2B]/60 font-mono">
                {destinationTargetItem.floor.shortCode} • {destinationTargetItem.code}
              </span>
            )}
          </label>

          <div className="flex items-center border border-[#1A3C2B] bg-[#F7F7F5] px-2 py-1.5 focus-within:ring-1 focus-within:ring-[#1A3C2B]">
            <Search className="w-3.5 h-3.5 text-[#1A3C2B]/50 mr-2 flex-shrink-0" />
            <input
              type="text"
              placeholder="Célállomás helyiség, lift vagy szolgáltatás..."
              value={
                isTargetFocused
                  ? targetQuery
                  : destinationTargetItem
                  ? `${destinationTargetItem.code ? `${destinationTargetItem.code} - ` : ''}${destinationTargetItem.name}`
                  : ''
              }
              onFocus={() => {
                setIsTargetFocused(true);
                setTargetQuery('');
              }}
              onBlur={() => setTimeout(() => setIsTargetFocused(false), 200)}
              onChange={(e) => setTargetQuery(e.target.value)}
              className="w-full bg-transparent font-sans text-xs text-[#1A3C2B] focus:outline-none placeholder-[#1A3C2B]/40"
            />
            {targetRoomId && (
              <button
                onClick={() => onSetTargetRoom(null)}
                className="font-mono text-xs text-[#1A3C2B]/60 hover:text-[#1A3C2B] ml-1"
                title="Törlés"
              >
                ✕
              </button>
            )}
          </div>

          {/* Autocomplete Dropdown for Target */}
          {isTargetFocused && (
            <div className="absolute top-full left-0 right-0 z-30 mt-1 bg-[#FFFFFF] border border-[#1A3C2B] shadow-xl max-h-56 overflow-y-auto">
              {targetFiltered.map((item) => (
                <div
                  key={item.id}
                  onMouseDown={() => onSetTargetRoom(item.id)}
                  className="p-2 border-b border-[#D0D0C7]/50 hover:bg-[#F0F5F2] cursor-pointer flex items-center justify-between gap-2"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-sm">{renderTargetIcon(item)}</span>
                    <div className="flex flex-col min-w-0">
                      <span className="font-sans font-bold text-xs text-[#1A3C2B] truncate">{item.name}</span>
                      <span className="font-mono text-[9px] text-[#1A3C2B]/60 truncate">
                        {item.floor.shortCode} • {item.subText || item.categoryLabel}
                      </span>
                    </div>
                  </div>
                  {item.code && (
                    <span className="font-mono text-[10px] font-bold text-[#1A3C2B] px-1 bg-[#F7F7F5] border border-[#D0D0C7] flex-shrink-0">
                      {item.code}
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Quick POI & Transit Injection Buttons */}
        <div className="flex flex-wrap gap-1.5 pt-1.5 border-t border-[#1A3C2B]/20">
          <button
            onClick={() => onInjectNearestPOI && onInjectNearestPOI('entrance')}
            className="px-2 py-1 bg-white border border-[#047857]/40 hover:border-[#047857] hover:bg-[#ECFDF5] font-mono text-[9.5px] font-bold flex items-center gap-1 text-[#047857] transition-colors cursor-pointer"
            title="Közeli főbejárat beillesztése"
          >
            <span>🚪 + Bejárat</span>
          </button>
          <button
            onClick={() => onInjectNearestPOI && onInjectNearestPOI('exit')}
            className="px-2 py-1 bg-white border border-[#B91C1C]/40 hover:border-[#B91C1C] hover:bg-[#FEF2F2] font-mono text-[9.5px] font-bold flex items-center gap-1 text-[#B91C1C] transition-colors cursor-pointer"
            title="Közeli kijárat beillesztése"
          >
            <span>🚪 + Kijárat</span>
          </button>
          <button
            onClick={() => onInjectNearestPOI && onInjectNearestPOI('fire_exit')}
            className="px-2 py-1 bg-white border border-[#15803D]/40 hover:border-[#15803D] hover:bg-[#F0FDF4] font-mono text-[9.5px] font-bold flex items-center gap-1 text-[#15803D] transition-colors cursor-pointer"
            title="Közeli vészkijárat beillesztése"
          >
            <span>🚨 + Vészkijárat</span>
          </button>
          <button
            onClick={() => onInjectNearestPOI && onInjectNearestPOI('restroom')}
            className="px-2 py-1 bg-white border border-[#1A3C2B]/30 hover:border-[#1A3C2B] hover:bg-[#F0F5F2] font-mono text-[9.5px] font-bold flex items-center gap-1 text-[#1A3C2B] transition-colors cursor-pointer"
            title="Közeli mosdó beillesztése"
          >
            <span>🚻 + Mosdó</span>
          </button>
          <button
            onClick={() => onInjectNearestPOI && onInjectNearestPOI('coffee')}
            className="px-2 py-1 bg-white border border-[#1A3C2B]/30 hover:border-[#1A3C2B] hover:bg-[#F0F5F2] font-mono text-[9.5px] font-bold flex items-center gap-1 text-[#1A3C2B] transition-colors cursor-pointer"
            title="Közeli kávézó / büfé beillesztése"
          >
            <span>☕ + Kávézó</span>
          </button>
          <button
            onClick={() => onInjectNearestTransit && onInjectNearestTransit('stairs')}
            className="px-2 py-1 bg-white border border-[#1A3C2B]/30 hover:border-[#1A3C2B] hover:bg-[#F0F5F2] font-mono text-[9.5px] font-bold flex items-center gap-1 text-[#1A3C2B] transition-colors cursor-pointer"
            title="Közeli lépcsőház beillesztése"
          >
            <span>🪜 + Lépcső</span>
          </button>
          <button
            onClick={() => onInjectNearestTransit && onInjectNearestTransit('elevator')}
            className="px-2 py-1 bg-white border border-[#1A3C2B]/30 hover:border-[#1A3C2B] hover:bg-[#F0F5F2] font-mono text-[9.5px] font-bold flex items-center gap-1 text-[#1A3C2B] transition-colors cursor-pointer"
            title="Közeli lift beillesztése"
          >
            <span>🛗 + Lift</span>
          </button>
          <button
            onClick={() => onInjectNearestPOI && onInjectNearestPOI('aed')}
            className="px-2 py-1 bg-white border border-[#1A3C2B]/30 hover:border-[#1A3C2B] hover:bg-[#F0F5F2] font-mono text-[9.5px] font-bold flex items-center gap-1 text-[#1A3C2B] transition-colors cursor-pointer"
            title="Közeli defibrillátor beillesztése"
          >
            <span>❤️ + AED</span>
          </button>
          <button
            onClick={() => onInjectNearestPOI && onInjectNearestPOI('water')}
            className="px-2 py-1 bg-white border border-[#1A3C2B]/30 hover:border-[#1A3C2B] hover:bg-[#F0F5F2] font-mono text-[9.5px] font-bold flex items-center gap-1 text-[#1A3C2B] transition-colors cursor-pointer"
            title="Közeli ivókút beillesztése"
          >
            <span>🚰 + Ivókút</span>
          </button>
        </div>

        {/* Accessibility & Route Preference Filters */}
        <div className="pt-2 border-t border-[#1A3C2B]/20 flex items-center justify-between text-xs font-mono">
          <label className="flex items-center gap-1 cursor-pointer text-[9.5px] text-[#1A3C2B] font-bold">
            <input
              type="checkbox"
              checked={routePreferences.accessibilityOnly}
              onChange={(e) =>
                onSetPreferences({
                  ...routePreferences,
                  accessibilityOnly: e.target.checked,
                  prioritizeStairs: e.target.checked ? false : routePreferences.prioritizeStairs,
                })
              }
              className="accent-[#1A3C2B]"
            />
            <Accessibility className="w-3 h-3 text-[#1A3C2B]" />
            <span>AKADÁLYMENTES</span>
          </label>

          <label className="flex items-center gap-1 cursor-pointer text-[9.5px] text-[#1A3C2B] font-bold">
            <input
              type="checkbox"
              checked={routePreferences.prioritizeElevators}
              disabled={routePreferences.accessibilityOnly}
              onChange={(e) =>
                onSetPreferences({
                  ...routePreferences,
                  prioritizeElevators: e.target.checked,
                  prioritizeStairs: e.target.checked ? false : routePreferences.prioritizeStairs,
                })
              }
              className="accent-[#1A3C2B]"
            />
            <span>🛗 LIFT</span>
          </label>

          <label className="flex items-center gap-1 cursor-pointer text-[9.5px] text-[#1A3C2B] font-bold">
            <input
              type="checkbox"
              checked={!!routePreferences.prioritizeStairs}
              disabled={routePreferences.accessibilityOnly}
              onChange={(e) =>
                onSetPreferences({
                  ...routePreferences,
                  prioritizeStairs: e.target.checked,
                  prioritizeElevators: e.target.checked ? false : routePreferences.prioritizeElevators,
                })
              }
              className="accent-[#1A3C2B]"
            />
            <span>🪜 LÉPCSŐ</span>
          </label>
        </div>
      </div>

      {/* Telemetry Metrics Strip (When route calculated) */}
      {routeResult && (
        <div className="p-3 bg-[#1A3C2B] text-[#F7F7F5] grid grid-cols-3 gap-2 font-mono text-center border-b border-[#1A3C2B]">
          <div className="flex flex-col border-r border-[#F7F7F5]/20 pr-1">
            <span className="text-[9px] text-[#F7F7F5]/70 uppercase">TÁVOLSÁG</span>
            <span className="text-sm font-bold">{routeResult.totalDistanceMeters} m</span>
          </div>
          <div className="flex flex-col border-r border-[#F7F7F5]/20 pr-1">
            <span className="text-[9px] text-[#F7F7F5]/70 uppercase">MENETIDŐ</span>
            <span className="text-sm font-bold">~{routeResult.estimatedTimeMinutes} perc</span>
          </div>
          <div className="flex flex-col">
            <span className="text-[9px] text-[#F7F7F5]/70 uppercase">SZINTEK</span>
            <span className="text-sm font-bold">{routeResult.floorsTraversed.length} szint</span>
          </div>
        </div>
      )}

      {/* Simulation Controller Bar */}
      {routeResult && (
        <div className="p-2 bg-[#FFFFFF] border-b border-[#1A3C2B] flex items-center justify-between font-mono text-xs">
          <div className="flex items-center gap-2">
            {!isSimulating ? (
              <button
                onClick={onStartSimulation}
                className="px-3 py-1 bg-[#1A3C2B] text-[#F7F7F5] hover:bg-[#2A533E] text-[10px] font-bold flex items-center gap-1"
              >
                <Play className="w-3 h-3" />
                <span>LEJÁTSZÁS</span>
              </button>
            ) : (
              <button
                onClick={onPauseSimulation}
                className="px-3 py-1 bg-[#B45309] text-[#F7F7F5] hover:bg-[#92400E] text-[10px] font-bold flex items-center gap-1"
              >
                <Pause className="w-3 h-3" />
                <span>SZÜNET</span>
              </button>
            )}
            <button
              onClick={onResetSimulation}
              className="p-1 border border-[#1A3C2B]/40 hover:bg-[#F0F5F2]"
              title="Visszaállítás"
            >
              <RotateCcw className="w-3 h-3 text-[#1A3C2B]" />
            </button>
          </div>

          {/* Progress Bar */}
          <div className="flex-1 mx-3 flex items-center gap-2">
            <div className="flex-1 h-1.5 bg-[#D0D0C7] overflow-hidden">
              <div
                className="h-full bg-[#1A3C2B] transition-all duration-100"
                style={{ width: `${(activeSimulationProgress || 0) * 100}%` }}
              />
            </div>
            <span className="text-[9px] font-bold text-[#1A3C2B]">
              {Math.round((activeSimulationProgress || 0) * 100)}%
            </span>
          </div>
        </div>
      )}

      {/* Turn-by-turn Navigation Instruction Cards */}
      <div className="flex-1 overflow-y-auto p-3">
        {routeResult ? (
          <TurnByTurnList
            steps={routeResult.steps}
            currentFloorId={currentFloor.id}
            onStepClick={onStepClick}
          />
        ) : (
          <div className="h-full flex flex-col items-center justify-center p-6 text-center text-[#1A3C2B]/60">
            <MapPin className="w-8 h-8 mb-2 opacity-40" />
            <p className="font-mono text-xs font-bold uppercase mb-1">
              NINCS AKTÍV ÚTVONAL
            </p>
            <p className="font-sans text-xs max-w-xs leading-relaxed">
              Válasszon ki egy indulási pontot és egy célállomást a fenti keresőben, vagy kattintson közvetlenül az alaprajzon a kiválasztott teremre vagy szolgáltatásra.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

