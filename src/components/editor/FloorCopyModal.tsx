import React, { useState } from 'react';
import type { Building, Floor } from '../../types';
import { cloneFloorData, CloneFloorOptions } from '../../utils/floorClone';
import { Copy, Layers, CheckSquare, Square, AlertCircle, ArrowRight, X, ShieldAlert } from 'lucide-react';

interface FloorCopyModalProps {
  isOpen: boolean;
  onClose: () => void;
  building: Building;
  activeFloor: Floor;
  onApplyClonedData: (updatedFloor: Floor) => void;
}

export const FloorCopyModal: React.FC<FloorCopyModalProps> = ({
  isOpen,
  onClose,
  building,
  activeFloor,
  onApplyClonedData,
}) => {
  // Available other floors in building (default to first available non-current floor)
  const otherFloors = building.floors.filter((f) => f.id !== activeFloor.id);
  const [selectedSourceFloorId, setSelectedSourceFloorId] = useState<string>(
    otherFloors[0]?.id || (building.floors[0]?.id !== activeFloor.id ? building.floors[0]?.id : '') || ''
  );

  const [copyMode, setCopyMode] = useState<'overwrite' | 'merge'>('overwrite');

  // Granular selection flags
  const [options, setOptions] = useState<CloneFloorOptions>({
    copyRooms: true,
    copyZones: true,
    copyWalls: true,
    copyDoors: true,
    copyTransit: true,
    copyPois: true,
    copyNav: true,
    copyUnderlay: false,
  });

  if (!isOpen) return null;

  const sourceFloor = building.floors.find((f) => f.id === selectedSourceFloorId) || otherFloors[0];

  const toggleOption = (key: keyof CloneFloorOptions) => {
    setOptions((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleCopy = () => {
    if (!sourceFloor) return;

    const cloned = cloneFloorData(sourceFloor, activeFloor.id, options);

    let updatedFloor: Floor;
    if (copyMode === 'overwrite') {
      updatedFloor = {
        ...activeFloor,
        rooms: cloned.rooms,
        zones: cloned.zones,
        walls: cloned.walls,
        doors: cloned.doors,
        transitConnectors: cloned.transitConnectors,
        pois: cloned.pois,
        navNodes: cloned.navNodes,
        navEdges: cloned.navEdges,
        underlay: options.copyUnderlay && cloned.underlay ? cloned.underlay : activeFloor.underlay,
      };
    } else {
      // Merge mode: append cloned elements
      updatedFloor = {
        ...activeFloor,
        rooms: [...activeFloor.rooms, ...cloned.rooms],
        zones: [...(activeFloor.zones || []), ...cloned.zones],
        walls: [...activeFloor.walls, ...cloned.walls],
        doors: [...activeFloor.doors, ...cloned.doors],
        transitConnectors: [...activeFloor.transitConnectors, ...cloned.transitConnectors],
        pois: [...activeFloor.pois, ...cloned.pois],
        navNodes: [...activeFloor.navNodes, ...cloned.navNodes],
        navEdges: [...activeFloor.navEdges, ...cloned.navEdges],
        underlay: options.copyUnderlay && cloned.underlay ? cloned.underlay : activeFloor.underlay,
      };
    }

    onApplyClonedData(updatedFloor);
    onClose();
  };

  const currentElementsCount =
    activeFloor.rooms.length +
    activeFloor.walls.length +
    activeFloor.doors.length +
    activeFloor.transitConnectors.length +
    activeFloor.navNodes.length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#1A3C2B]/50 backdrop-blur-xs select-none">
      <div className="bg-[#F7F7F5] border-2 border-[#1A3C2B] w-full max-w-lg flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150 shadow-2xl">
        {/* Header */}
        <div className="p-3.5 bg-[#1A3C2B] text-[#F7F7F5] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Copy className="w-4 h-4 text-emerald-400" />
            <span className="font-mono text-xs font-bold uppercase tracking-wider">
              SZINT SZERKEZETÉNEK ÁTMÁSOLÁSA // CAD
            </span>
          </div>
          <button onClick={onClose} className="font-mono text-sm text-[#F7F7F5]/80 hover:text-white">
            ✕
          </button>
        </div>

        <div className="p-5 flex flex-col gap-4 font-mono text-xs text-[#1A3C2B]">
          {/* Target Info */}
          <div className="bg-white p-3 border border-[#1A3C2B]/30 flex items-center justify-between">
            <div className="flex flex-col">
              <span className="text-[9px] uppercase font-bold text-[#1A3C2B]/60">CÉL SZINT (JELENLEGI):</span>
              <span className="text-sm font-sans font-bold text-[#1A3C2B]">
                {activeFloor.name} <span className="font-mono text-xs text-[#047857]">({activeFloor.shortCode})</span>
              </span>
            </div>
            <span className="text-[10px] px-2 py-1 bg-[#F0F5F2] border border-[#D0D0C7] font-bold">
              +{activeFloor.elevationMeters.toFixed(1)}m • {currentElementsCount} meglévő elem
            </span>
          </div>

          {/* Source Floor Selector */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] uppercase font-bold text-[#1A3C2B]/80 flex items-center gap-1">
              <Layers className="w-3.5 h-3.5" />
              <span>1. VÁLASSZON FORRÁS SZINTET A MÁSOLÁSHOZ:</span>
            </label>
            <select
              value={selectedSourceFloorId}
              onChange={(e) => setSelectedSourceFloorId(e.target.value)}
              className="bg-white border-2 border-[#1A3C2B] px-3 py-2 text-xs font-bold focus:outline-none cursor-pointer"
            >
              {building.floors.map((f) => (
                <option key={f.id} value={f.id} disabled={f.id === activeFloor.id}>
                  {f.name} ({f.shortCode} • +{f.elevationMeters}m) {f.id === activeFloor.id ? '← JELENLEGI SZINT' : ''}
                </option>
              ))}
            </select>
          </div>

          {/* Source Floor Overview Summary */}
          {sourceFloor && (
            <div className="bg-[#F0F5F2] p-2.5 border border-[#D0D0C7] grid grid-cols-4 gap-2 text-[10.5px]">
              <div>
                <span className="text-[#1A3C2B]/60 text-[9px] block">SZOBÁK:</span>
                <span className="font-bold">{sourceFloor.rooms.length} db</span>
              </div>
              <div>
                <span className="text-[#1A3C2B]/60 text-[9px] block">FALAK:</span>
                <span className="font-bold">{sourceFloor.walls.length} db</span>
              </div>
              <div>
                <span className="text-[#1A3C2B]/60 text-[9px] block">AJTÓK:</span>
                <span className="font-bold">{sourceFloor.doors.length} db</span>
              </div>
              <div>
                <span className="text-[#1A3C2B]/60 text-[9px] block">LIFTEK/LÉPCSŐK:</span>
                <span className="font-bold">{sourceFloor.transitConnectors.length} db</span>
              </div>
            </div>
          )}

          {/* Granular Item Checkboxes */}
          <div className="flex flex-col gap-1.5">
            <span className="text-[10px] uppercase font-bold text-[#1A3C2B]/80">
              2. ÁTMÁSOLANDÓ ELEMEK KIVÁLASZTÁSA:
            </span>
            <div className="grid grid-cols-2 gap-1.5 bg-white p-2.5 border border-[#D0D0C7]">
              <label className="flex items-center gap-2 cursor-pointer text-[11px]">
                <input
                  type="checkbox"
                  checked={!!options.copyRooms}
                  onChange={() => toggleOption('copyRooms')}
                  className="accent-[#1A3C2B]"
                />
                <span>Szobák & Termek</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer text-[11px]">
                <input
                  type="checkbox"
                  checked={!!options.copyWalls}
                  onChange={() => toggleOption('copyWalls')}
                  className="accent-[#1A3C2B]"
                />
                <span>Falak & Határolók</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer text-[11px]">
                <input
                  type="checkbox"
                  checked={!!options.copyDoors}
                  onChange={() => toggleOption('copyDoors')}
                  className="accent-[#1A3C2B]"
                />
                <span>Ajtók</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer text-[11px]">
                <input
                  type="checkbox"
                  checked={!!options.copyTransit}
                  onChange={() => toggleOption('copyTransit')}
                  className="accent-[#1A3C2B]"
                />
                <span>Liftek & Lépcsők</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer text-[11px]">
                <input
                  type="checkbox"
                  checked={!!options.copyZones}
                  onChange={() => toggleOption('copyZones')}
                  className="accent-[#1A3C2B]"
                />
                <span>Zónák & Aulák</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer text-[11px]">
                <input
                  type="checkbox"
                  checked={!!options.copyPois}
                  onChange={() => toggleOption('copyPois')}
                  className="accent-[#1A3C2B]"
                />
                <span>Szolgáltatások (POI)</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer text-[11px]">
                <input
                  type="checkbox"
                  checked={!!options.copyNav}
                  onChange={() => toggleOption('copyNav')}
                  className="accent-[#1A3C2B]"
                />
                <span>Navigációs hálózat</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer text-[11px]">
                <input
                  type="checkbox"
                  checked={!!options.copyUnderlay}
                  onChange={() => toggleOption('copyUnderlay')}
                  className="accent-[#1A3C2B]"
                />
                <span>Tervrajz háttérkép</span>
              </label>
            </div>
          </div>

          {/* Copy Mode Choice */}
          <div className="flex flex-col gap-1.5">
            <span className="text-[10px] uppercase font-bold text-[#1A3C2B]/80">
              3. MÁSOLÁSI MÓD:
            </span>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setCopyMode('overwrite')}
                className={`p-2 border text-left flex flex-col gap-1 transition-all ${
                  copyMode === 'overwrite'
                    ? 'bg-[#1A3C2B] text-white border-[#1A3C2B]'
                    : 'bg-white text-[#1A3C2B] border-[#D0D0C7] hover:border-[#1A3C2B]'
                }`}
              >
                <span className="font-bold text-[11px]">TELJES FELÜLÍRÁS</span>
                <span className={`text-[9px] leading-tight ${copyMode === 'overwrite' ? 'text-white/80' : 'text-[#1A3C2B]/60'}`}>
                  Törli a jelenlegi elemeket és beilleszti a másolt alaprajzot (Ajánlott üres szinthez).
                </span>
              </button>

              <button
                type="button"
                onClick={() => setCopyMode('merge')}
                className={`p-2 border text-left flex flex-col gap-1 transition-all ${
                  copyMode === 'merge'
                    ? 'bg-[#1A3C2B] text-white border-[#1A3C2B]'
                    : 'bg-white text-[#1A3C2B] border-[#D0D0C7] hover:border-[#1A3C2B]'
                }`}
              >
                <span className="font-bold text-[11px]">ÖSSZEFÉSÜLÉS</span>
                <span className={`text-[9px] leading-tight ${copyMode === 'merge' ? 'text-white/80' : 'text-[#1A3C2B]/60'}`}>
                  Megtartja a jelenlegi elemeket és hozzáadja a másolt szintről érkezőket.
                </span>
              </button>
            </div>
          </div>

          {copyMode === 'overwrite' && currentElementsCount > 0 && (
            <div className="bg-amber-50 border border-amber-400 text-amber-900 p-2 text-[10px] flex items-center gap-1.5">
              <AlertCircle className="w-4 h-4 text-amber-700 flex-shrink-0" />
              <span>
                Figyelem: A cél szinten lévő <b>{currentElementsCount}</b> elem felülírásra kerül (a művelet a Ctrl+Z billentyűkombinációval visszavonható).
              </span>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex items-center justify-between border-t border-[#1A3C2B]/20 pt-3 mt-1">
            <button
              onClick={onClose}
              className="px-3 py-1.5 border border-[#D0D0C7] bg-white hover:bg-[#F0F5F2] font-mono text-xs"
            >
              MÉGSE
            </button>
            <button
              onClick={handleCopy}
              disabled={!sourceFloor}
              className="px-4 py-2 bg-[#1A3C2B] text-white hover:bg-[#2A533E] font-mono text-xs font-bold flex items-center gap-2 transition-colors disabled:opacity-50"
            >
              <Copy className="w-3.5 h-3.5" />
              <span>SZERKEZET ÁTMÁSOLÁSA</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
