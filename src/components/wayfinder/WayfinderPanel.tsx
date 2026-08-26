import React, { useState, useMemo } from 'react';
import type {
  Building,
  Floor,
  Room,
  RouteResult,
  RoutePreference,
  RouteStep,
} from '../../types';
import {
  Search,
  ArrowUpDown,
  Accessibility,
  Clock,
  Footprints,
  Play,
  Pause,
  RotateCcw,
  Share2,
  Sliders,
  Layers,
  MapPin,
  Sparkles,
  Zap,
  Plus,
  Trash2,
  ChevronUp,
  ChevronDown,
  Coffee,
  HeartPulse,
} from 'lucide-react';
import { TurnByTurnList } from './TurnByTurnList';

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
  onSetStartRoom: (roomId: string | null) => void;
  onSetTargetRoom: (roomId: string | null) => void;
  onSetIntermediateStops?: (stops: string[]) => void;
  onSetPreferences: (prefs: RoutePreference) => void;
  onStepClick: (step: RouteStep) => void;
  onStartSimulation: () => void;
  onPauseSimulation: () => void;
  onResetSimulation: () => void;
  onOpenShareModal: () => void;
  onInjectNearestPOI?: (poiType: string) => void;
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
  onSetPreferences,
  onStepClick,
  onStartSimulation,
  onPauseSimulation,
  onResetSimulation,
  onOpenShareModal,
  onInjectNearestPOI,
  className = '',
}) => {
  // Collect all searchable rooms across the active building
  const allRooms = useMemo(() => {
    const list: { room: Room; floor: Floor }[] = [];
    for (const floor of building.floors) {
      for (const room of floor.rooms) {
        list.push({ room, floor });
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

  // Selected room entities
  const startRoomItem = allRooms.find((r) => r.room.id === startRoomId);
  const targetRoomItem = allRooms.find((r) => r.room.id === targetRoomId);

  // Filtered rooms for start autocomplete
  const startFiltered = useMemo(() => {
    if (!startQuery.trim()) return allRooms.slice(0, 6);
    const q = startQuery.toLowerCase();
    return allRooms.filter(
      (r) =>
        r.room.name.toLowerCase().includes(q) ||
        r.room.code.toLowerCase().includes(q) ||
        (r.room.department && r.room.department.toLowerCase().includes(q))
    );
  }, [allRooms, startQuery]);

  // Filtered rooms for target autocomplete
  const targetFiltered = useMemo(() => {
    if (!targetQuery.trim()) return allRooms.slice(0, 6);
    const q = targetQuery.toLowerCase();
    return allRooms.filter(
      (r) =>
        r.room.name.toLowerCase().includes(q) ||
        r.room.code.toLowerCase().includes(q) ||
        (r.room.department && r.room.department.toLowerCase().includes(q))
    );
  }, [allRooms, targetQuery]);

  // Filtered rooms for intermediate stop
  const stopFiltered = useMemo(() => {
    if (!addingStopQuery.trim()) return allRooms.slice(0, 6);
    const q = addingStopQuery.toLowerCase();
    return allRooms.filter(
      (r) =>
        r.room.name.toLowerCase().includes(q) ||
        r.room.code.toLowerCase().includes(q) ||
        (r.room.department && r.room.department.toLowerCase().includes(q))
    );
  }, [allRooms, addingStopQuery]);

  // Swap start & destination
  const handleSwap = () => {
    const prevStart = startRoomId;
    const prevTarget = targetRoomId;
    onSetStartRoom(prevTarget);
    onSetTargetRoom(prevStart);
  };

  const handleAddStop = (roomId: string) => {
    if (onSetIntermediateStops) {
      onSetIntermediateStops([...intermediateStopIds, roomId]);
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

      {/* Origin, Waypoints & Destination Bento Matrix */}
      <div className="p-3 bg-[#FFFFFF] border-b border-[#1A3C2B] flex flex-col gap-2 relative">
        {/* Origin Field */}
        <div className="relative">
          <label className="font-mono text-[9px] font-bold text-[#1A3C2B]/70 uppercase block mb-1 flex items-center justify-between">
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-[#1A3C2B] inline-block" />
              INDULÁSI PONT
            </span>
            {startRoomItem && (
              <span className="text-[9px] text-[#1A3C2B]/50">
                {startRoomItem.floor.shortCode} • {startRoomItem.room.code}
              </span>
            )}
          </label>

          <div className="flex items-center border border-[#1A3C2B] bg-[#F7F7F5] px-2 py-1.5 focus-within:ring-1 focus-within:ring-[#1A3C2B]">
            <Search className="w-3.5 h-3.5 text-[#1A3C2B]/50 mr-2 flex-shrink-0" />
            <input
              type="text"
              placeholder="Indulási helyiség kiválasztása..."
              value={isStartFocused ? startQuery : startRoomItem ? `${startRoomItem.room.code} - ${startRoomItem.room.name}` : ''}
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
              >
                ✕
              </button>
            )}
          </div>

          {/* Autocomplete Dropdown for Start */}
          {isStartFocused && (
            <div className="absolute top-full left-0 right-0 z-30 mt-1 bg-[#FFFFFF] border border-[#1A3C2B] shadow-lg max-h-48 overflow-y-auto">
              {startFiltered.map(({ room, floor }) => (
                <div
                  key={room.id}
                  onMouseDown={() => onSetStartRoom(room.id)}
                  className="p-2 border-b border-[#D0D0C7]/50 hover:bg-[#F0F5F2] cursor-pointer flex items-center justify-between"
                >
                  <div className="flex flex-col">
                    <span className="font-sans font-bold text-xs text-[#1A3C2B]">
                      {room.name}
                    </span>
                    <span className="font-mono text-[9px] text-[#1A3C2B]/60">
                      {floor.shortCode} • {room.department || room.category}
                    </span>
                  </div>
                  <span className="font-mono text-xs font-bold text-[#1A3C2B] px-1 bg-[#F7F7F5] border border-[#D0D0C7]">
                    {room.code}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Intermediate Stops List */}
        {intermediateStopIds.map((stopId, sIdx) => {
          const stopItem = allRooms.find((r) => r.room.id === stopId);
          if (!stopItem) return null;
          return (
            <div key={`${stopId}-${sIdx}`} className="p-2 bg-[#F0F5F2] border border-[#1A3C2B]/40 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <span className="font-mono text-[9px] font-bold px-1.5 py-0.5 bg-[#1A3C2B] text-white">
                  {sIdx + 1}. MEGÁLLÓ
                </span>
                <div className="flex flex-col min-w-0">
                  <span className="font-sans font-bold text-xs text-[#1A3C2B] truncate">{stopItem.room.name}</span>
                  <span className="font-mono text-[9px] text-[#1A3C2B]/70">{stopItem.floor.shortCode} • {stopItem.room.code}</span>
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

        {/* Swap Button */}
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
            title="Indulás és célállomás megcserélése"
          >
            <ArrowUpDown className="w-3.5 h-3.5 text-[#1A3C2B]" />
          </button>
        </div>

        {/* Add Stop Autocomplete Input */}
        {showAddStopDropdown && (
          <div className="p-2 bg-[#FFFFFF] border border-[#1A3C2B] flex flex-col gap-1.5">
            <span className="font-mono text-[9px] font-bold text-[#1A3C2B] uppercase">Köztes megálló keresése:</span>
            <input
              type="text"
              placeholder="Terem vagy labor neve / kódja..."
              value={addingStopQuery}
              onChange={(e) => setAddingStopQuery(e.target.value)}
              className="border border-[#1A3C2B] px-2 py-1 text-xs"
              autoFocus
            />
            <div className="max-h-32 overflow-y-auto flex flex-col gap-1">
              {stopFiltered.map(({ room, floor }) => (
                <div
                  key={room.id}
                  onClick={() => handleAddStop(room.id)}
                  className="p-1.5 border border-[#D0D0C7] hover:bg-[#F0F5F2] cursor-pointer flex items-center justify-between text-xs"
                >
                  <span className="font-medium truncate">{room.name}</span>
                  <span className="font-mono text-[9px] px-1 bg-[#F7F7F5]">{floor.shortCode} • {room.code}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Destination Field */}
        <div className="relative">
          <label className="font-mono text-[9px] font-bold text-[#1A3C2B]/70 uppercase block mb-1 flex items-center justify-between">
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-none bg-[#B45309] rotate-45 inline-block" />
              CÉLÁLLOMÁS
            </span>
            {targetRoomItem && (
              <span className="text-[9px] text-[#1A3C2B]/50">
                {targetRoomItem.floor.shortCode} • {targetRoomItem.room.code}
              </span>
            )}
          </label>

          <div className="flex items-center border border-[#1A3C2B] bg-[#F7F7F5] px-2 py-1.5 focus-within:ring-1 focus-within:ring-[#1A3C2B]">
            <Search className="w-3.5 h-3.5 text-[#1A3C2B]/50 mr-2 flex-shrink-0" />
            <input
              type="text"
              placeholder="Célállomás kiválasztása..."
              value={isTargetFocused ? targetQuery : targetRoomItem ? `${targetRoomItem.room.code} - ${targetRoomItem.room.name}` : ''}
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
              >
                ✕
              </button>
            )}
          </div>

          {/* Autocomplete Dropdown for Target */}
          {isTargetFocused && (
            <div className="absolute top-full left-0 right-0 z-30 mt-1 bg-[#FFFFFF] border border-[#1A3C2B] shadow-lg max-h-48 overflow-y-auto">
              {targetFiltered.map(({ room, floor }) => (
                <div
                  key={room.id}
                  onMouseDown={() => onSetTargetRoom(room.id)}
                  className="p-2 border-b border-[#D0D0C7]/50 hover:bg-[#F0F5F2] cursor-pointer flex items-center justify-between"
                >
                  <div className="flex flex-col">
                    <span className="font-sans font-bold text-xs text-[#1A3C2B]">
                      {room.name}
                    </span>
                    <span className="font-mono text-[9px] text-[#1A3C2B]/60">
                      {floor.shortCode} • {room.department || room.category}
                    </span>
                  </div>
                  <span className="font-mono text-xs font-bold text-[#1A3C2B] px-1 bg-[#F7F7F5] border border-[#D0D0C7]">
                    {room.code}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Quick POI Injection Buttons */}
        <div className="flex flex-wrap gap-1 pt-1 border-t border-[#1A3C2B]/20">
          <button
            onClick={() => onInjectNearestPOI && onInjectNearestPOI('restroom')}
            className="px-1.5 py-1 bg-white border border-[#1A3C2B]/30 hover:border-[#1A3C2B] font-mono text-[9px] flex items-center gap-1 text-[#1A3C2B]"
            title="Közeli mosdó beillesztése az útvonalba"
          >
            <span>🚻 + Közeli Mosdó</span>
          </button>
          <button
            onClick={() => onInjectNearestPOI && onInjectNearestPOI('coffee')}
            className="px-1.5 py-1 bg-white border border-[#1A3C2B]/30 hover:border-[#1A3C2B] font-mono text-[9px] flex items-center gap-1 text-[#1A3C2B]"
            title="Közeli kávézó / automata beillesztése"
          >
            <span>☕ + Kávézó</span>
          </button>
          <button
            onClick={() => onInjectNearestPOI && onInjectNearestPOI('aed')}
            className="px-1.5 py-1 bg-white border border-[#1A3C2B]/30 hover:border-[#1A3C2B] font-mono text-[9px] flex items-center gap-1 text-[#1A3C2B]"
            title="Közeli elsősegély / defibrillátor beillesztése"
          >
            <span>❤️ + Defibrillátor</span>
          </button>
        </div>

        {/* Accessibility & Route Preference Filters */}
        <div className="pt-2 border-t border-[#1A3C2B]/20 flex items-center justify-between text-xs font-mono">
          <label className="flex items-center gap-1.5 cursor-pointer text-[10px] text-[#1A3C2B] font-bold">
            <input
              type="checkbox"
              checked={routePreferences.accessibilityOnly}
              onChange={(e) =>
                onSetPreferences({
                  ...routePreferences,
                  accessibilityOnly: e.target.checked,
                })
              }
              className="accent-[#1A3C2B]"
            />
            <Accessibility className="w-3 h-3 text-[#1A3C2B]" />
            <span>AKADÁLYMENTES</span>
          </label>

          <label className="flex items-center gap-1.5 cursor-pointer text-[10px] text-[#1A3C2B] font-bold">
            <input
              type="checkbox"
              checked={routePreferences.prioritizeElevators}
              onChange={(e) =>
                onSetPreferences({
                  ...routePreferences,
                  prioritizeElevators: e.target.checked,
                })
              }
              className="accent-[#1A3C2B]"
            />
            <Layers className="w-3 h-3 text-[#1A3C2B]" />
            <span>LIFT ELŐNYBEN</span>
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
            <p className="font-sans text-xs max-w-xs">
              Válasszon ki egy indulási pontot és egy célállomást a fenti mezőkben, vagy kattintson közvetlenül a tervrajzra.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
