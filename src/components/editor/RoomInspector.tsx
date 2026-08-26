import React from 'react';
import type { Room, RoomCategory } from '../../types';
import { ROOM_CATEGORY_NAMES_HU } from '../../types';
import {
  Trash2,
  Check,
  Save,
  Layers,
  Ruler,
  Maximize2,
  PlusCircle,
  Scissors,
  HelpCircle,
} from 'lucide-react';
import {
  polygonAreaInSquareMeters,
  polygonPerimeterInMeters,
  getPolygonEdges,
  insertVertexInPolygon,
} from '../../utils/geometry';

interface RoomInspectorProps {
  room: Room;
  onUpdate: (updated: Room) => void;
  onDelete: (roomId: string) => void;
  onClose: () => void;
}

export const RoomInspector: React.FC<RoomInspectorProps> = ({
  room,
  onUpdate,
  onDelete,
  onClose,
}) => {
  const categories: RoomCategory[] = [
    'classroom',
    'laboratory',
    'auditorium',
    'office',
    'library',
    'cafeteria',
    'restroom',
    'lounge',
    'clinic',
    'utility',
    'entrance',
  ];

  const area = polygonAreaInSquareMeters(room.polygon);
  const perimeter = polygonPerimeterInMeters(room.polygon);
  const edges = getPolygonEdges(room.polygon);

  const handleFieldChange = (field: keyof Room, value: any) => {
    onUpdate({ ...room, [field]: value });
  };

  const handleTagsChange = (tagsStr: string) => {
    const arr = tagsStr
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    onUpdate({ ...room, tags: arr });
  };

  const handleSplitEdge = (edgeIdx: number) => {
    const newPolygon = insertVertexInPolygon(room.polygon, edgeIdx);
    onUpdate({ ...room, polygon: newPolygon });
  };

  return (
    <div className="bg-[#F7F7F5] border border-[#1A3C2B] p-3 flex flex-col gap-3 font-mono text-xs select-none shadow-xs">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-[#1A3C2B]/20 pb-1.5">
        <div className="flex items-center gap-1.5">
          <Layers className="w-3.5 h-3.5 text-[#1A3C2B]" />
          <span className="font-bold text-[#1A3C2B] uppercase">HELYISÉG TULAJDONSÁGOK</span>
        </div>
        <button onClick={onClose} className="text-[#1A3C2B]/60 hover:text-[#1A3C2B]">
          ✕
        </button>
      </div>

      {/* Code & Name */}
      <div className="grid grid-cols-3 gap-2">
        <div className="col-span-1">
          <label className="text-[9px] uppercase font-bold text-[#1A3C2B]/70 block mb-0.5">
            KÓD
          </label>
          <input
            type="text"
            value={room.code}
            onChange={(e) => handleFieldChange('code', e.target.value)}
            className="w-full bg-white border border-[#1A3C2B] px-1.5 py-1 text-xs text-[#1A3C2B] font-bold"
          />
        </div>
        <div className="col-span-2">
          <label className="text-[9px] uppercase font-bold text-[#1A3C2B]/70 block mb-0.5">
            HELYISÉG MEGNEVEZÉSE
          </label>
          <input
            type="text"
            value={room.name}
            onChange={(e) => handleFieldChange('name', e.target.value)}
            className="w-full bg-white border border-[#1A3C2B] px-1.5 py-1 text-xs text-[#1A3C2B]"
          />
        </div>
      </div>

      {/* Geometry Telemetry Banner (Alapterület, Kerület, Sarokpontok) */}
      <div className="bg-white border border-[#1A3C2B]/30 p-2 flex flex-col gap-1.5">
        <div className="flex justify-between items-center text-[10px]">
          <span className="text-[#1A3C2B]/70">ALAPTERÜLET:</span>
          <span className="font-bold text-[#1A3C2B] bg-[#F0F5F2] px-1.5 py-0.2 border border-[#1A3C2B]/20">
            {area.toFixed(1)} m²
          </span>
        </div>
        <div className="flex justify-between items-center text-[10px]">
          <span className="text-[#1A3C2B]/70">FALAK ÖSSZHOSSZA:</span>
          <span className="font-bold text-[#1A3C2B]">{perimeter.toFixed(1)} m</span>
        </div>
        <div className="flex justify-between items-center text-[10px]">
          <span className="text-[#1A3C2B]/70">GEOMETRIA:</span>
          <span className="font-bold text-[#1A3C2B]">
            {room.polygon.length} sarokpont ({room.polygon.length === 4 ? 'Téglalap' : room.polygon.length === 6 ? 'L-alakú / Bővített' : 'Egyedi sokszög'})
          </span>
        </div>
      </div>

      {/* Wall Segments / Falszakaszok és Felosztás */}
      <div className="flex flex-col gap-1 border border-[#1A3C2B]/20 p-2 bg-[#FAF9F6]">
        <div className="flex items-center justify-between mb-1">
          <span className="font-bold text-[9px] uppercase text-[#1A3C2B] flex items-center gap-1">
            <Ruler className="w-3 h-3" />
            <span>FALSZAKASZOK ({edges.length} DB)</span>
          </span>
          <span className="text-[8px] text-[#1A3C2B]/60">ÉLOSZTÁS: [+] GOMB</span>
        </div>

        <div className="max-h-32 overflow-y-auto flex flex-col gap-1 pr-0.5">
          {edges.map((edge) => (
            <div
              key={edge.index}
              className="flex items-center justify-between bg-white border border-[#D0D0C7] px-2 py-1 text-[10px]"
            >
              <div className="flex items-center gap-1.5">
                <span className="font-bold text-[9px] px-1 bg-[#1A3C2B]/10">
                  {edge.index + 1}. Fal
                </span>
                <span className="font-bold text-[#1A3C2B]">{edge.lengthMeters.toFixed(2)} m</span>
              </div>

              <button
                onClick={() => handleSplitEdge(edge.index)}
                className="px-1.5 py-0.5 bg-[#F0F5F2] hover:bg-[#1A3C2B] hover:text-white border border-[#1A3C2B]/40 text-[9px] font-bold transition-colors flex items-center gap-1"
                title="Falszakasz felezése és új sarokpont beszúrása"
              >
                <Scissors className="w-2.5 h-2.5" />
                <span>MEGOSZTÁS</span>
              </button>
            </div>
          ))}
        </div>

        <div className="text-[8.5px] text-[#1A3C2B]/70 mt-1 leading-tight border-t border-[#1A3C2B]/10 pt-1">
          💡 <i>Tipp: A rajzvásznon a kijelölt terem falainak közepén lévő <b>[+]</b> pontot közvetlenül húzva is létrehozhat új sarkot!</i>
        </div>
      </div>

      {/* Category & Capacity */}
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="text-[9px] uppercase font-bold text-[#1A3C2B]/70 block mb-0.5">
            KATEGÓRIA
          </label>
          <select
            value={room.category}
            onChange={(e) => handleFieldChange('category', e.target.value as RoomCategory)}
            className="w-full bg-white border border-[#1A3C2B] px-1.5 py-1 text-xs text-[#1A3C2B]"
          >
            {categories.map((c) => (
              <option key={c} value={c}>
                {ROOM_CATEGORY_NAMES_HU[c] || c}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-[9px] uppercase font-bold text-[#1A3C2B]/70 block mb-0.5">
            FÉRŐHELY (FŐ)
          </label>
          <input
            type="number"
            value={room.capacity || ''}
            onChange={(e) => handleFieldChange('capacity', parseInt(e.target.value) || 0)}
            className="w-full bg-white border border-[#1A3C2B] px-1.5 py-1 text-xs text-[#1A3C2B]"
          />
        </div>
      </div>

      {/* Department & Occupant */}
      <div>
        <label className="text-[9px] uppercase font-bold text-[#1A3C2B]/70 block mb-0.5">
          TANSZÉK / SZERVEZETI EGYSÉG
        </label>
        <input
          type="text"
          value={room.department || ''}
          onChange={(e) => handleFieldChange('department', e.target.value)}
          placeholder="pl. Villamosmérnöki Tanszék"
          className="w-full bg-white border border-[#1A3C2B] px-1.5 py-1 text-xs text-[#1A3C2B]"
        />
      </div>

      <div>
        <label className="text-[9px] uppercase font-bold text-[#1A3C2B]/70 block mb-0.5">
          FELELŐS / OKTATÓ
        </label>
        <input
          type="text"
          value={room.occupant || ''}
          onChange={(e) => handleFieldChange('occupant', e.target.value)}
          placeholder="pl. Dr. Kiss László"
          className="w-full bg-white border border-[#1A3C2B] px-1.5 py-1 text-xs text-[#1A3C2B]"
        />
      </div>

      {/* Tags */}
      <div>
        <label className="text-[9px] uppercase font-bold text-[#1A3C2B]/70 block mb-0.5">
          CÍMKÉK (VESSZŐVEL ELVÁLASZTVA)
        </label>
        <input
          type="text"
          value={room.tags.join(', ')}
          onChange={(e) => handleTagsChange(e.target.value)}
          placeholder="Akadálymentes, Projektor, Labor"
          className="w-full bg-white border border-[#1A3C2B] px-1.5 py-1 text-xs text-[#1A3C2B]"
        />
      </div>

      {/* Restricted Switch */}
      <label className="flex items-center gap-2 cursor-pointer bg-white border border-[#D0D0C7] p-2">
        <input
          type="checkbox"
          checked={!!room.isRestricted}
          onChange={(e) => handleFieldChange('isRestricted', e.target.checked)}
          className="accent-[#1A3C2B]"
        />
        <span className="text-[10px] text-[#1A3C2B] font-bold">
          BIZTONSÁGI ZÁRT ZÓNA (SÁROZOTT JELÖLÉSSEL)
        </span>
      </label>

      {/* Actions */}
      <div className="flex items-center justify-between border-t border-[#1A3C2B]/20 pt-2">
        <button
          onClick={() => onDelete(room.id)}
          className="px-2 py-1 bg-white hover:bg-red-50 border border-red-400 text-red-700 text-[10px] flex items-center gap-1"
        >
          <Trash2 className="w-3 h-3" />
          <span>TÖRLÉS</span>
        </button>
        <button
          onClick={onClose}
          className="px-3 py-1 bg-[#1A3C2B] text-white hover:bg-[#2A533E] text-[10px] font-bold"
        >
          KÉSZ
        </button>
      </div>
    </div>
  );
};
