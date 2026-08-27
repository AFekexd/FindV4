import React from 'react';
import type { PointOfInterest, POIType } from '../../types';
import { POI_NAMES_HU } from '../../types';
import { Trash2, MapPin } from 'lucide-react';

interface POIInspectorProps {
  poi: PointOfInterest;
  onUpdate: (updated: PointOfInterest) => void;
  onDelete: (poiId: string) => void;
  onClose: () => void;
}

export const POIInspector: React.FC<POIInspectorProps> = ({
  poi,
  onUpdate,
  onDelete,
  onClose,
}) => {
  const allTypes: { type: POIType; label: string; icon: string; category: string }[] = [
    { type: 'entrance', label: 'Főbejárat / Épületbejárat', icon: '🚪', category: 'Közlekedés & Ki/Bejárat' },
    { type: 'exit', label: 'Kijárat', icon: '🚪', category: 'Közlekedés & Ki/Bejárat' },
    { type: 'fire_exit', label: 'Vészkijárat / Menekülés', icon: '🚨', category: 'Közlekedés & Ki/Bejárat' },
    { type: 'accessible_entrance', label: 'Akadálymentes bejárat', icon: '♿', category: 'Közlekedés & Ki/Bejárat' },
    { type: 'reception', label: 'Porta / Információ', icon: 'ℹ️', category: 'Információ & Biztonság' },
    { type: 'first_aid', label: 'Elsősegély állomás', icon: '🩹', category: 'Információ & Biztonság' },
    { type: 'aed', label: 'Defibrillátor (AED)', icon: '❤️', category: 'Információ & Biztonság' },
    { type: 'restroom_accessible', label: 'Akadálymentes Mosdó', icon: '♿', category: 'Mosdók' },
    { type: 'restroom_all', label: 'Mosdó (Unisex)', icon: '🚻', category: 'Mosdók' },
    { type: 'restroom_men', label: 'Férfi Mosdó', icon: '🚹', category: 'Mosdók' },
    { type: 'restroom_women', label: 'Női Mosdó', icon: '🚺', category: 'Mosdók' },
    { type: 'coffee', label: 'Kávézó / Büfé', icon: '☕', category: 'Szolgáltatás' },
    { type: 'water', label: 'Ivókút / Vízautomata', icon: '🚰', category: 'Szolgáltatás' },
    { type: 'vending', label: 'Ital / Ételautomata', icon: '🍫', category: 'Szolgáltatás' },
    { type: 'printer', label: 'Nyomtató / Fénymásoló', icon: '🖨️', category: 'Szolgáltatás' },
  ];

  const handleFieldChange = (field: keyof PointOfInterest, value: any) => {
    onUpdate({ ...poi, [field]: value });
  };

  const handleQuickTypeSelect = (t: POIType) => {
    const defaultName = POI_NAMES_HU[t] || t;
    onUpdate({
      ...poi,
      type: t,
      name: poi.name === 'Új Szolgáltatás' || poi.name === 'Restroom Facility' || !poi.name ? defaultName : poi.name,
    });
  };

  return (
    <div className="bg-[#F7F7F5] border border-[#1A3C2B] p-3 flex flex-col gap-3 font-mono text-xs select-none">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-[#1A3C2B]/20 pb-1.5">
        <div className="flex items-center gap-1.5 text-[#1A3C2B] font-bold uppercase">
          <MapPin className="w-4 h-4 text-[#1A3C2B]" />
          <span>KI/BEJÁRAT & SZOLGÁLTATÁS</span>
        </div>
        <button onClick={onClose} className="text-[#1A3C2B]/60 hover:text-[#1A3C2B] text-sm px-1 cursor-pointer">
          ✕
        </button>
      </div>

      {/* Name Input */}
      <div>
        <label className="text-[9px] uppercase font-bold text-[#1A3C2B]/70 block mb-0.5">
          MEGNEVEZÉS / NÉV
        </label>
        <input
          type="text"
          value={poi.name}
          onChange={(e) => handleFieldChange('name', e.target.value)}
          placeholder="pl. Főbejárat, Nyugati Kijárat..."
          className="w-full bg-white border border-[#1A3C2B] px-2 py-1 text-xs text-[#1A3C2B] font-sans font-bold"
        />
      </div>

      {/* Quick Type Presets */}
      <div>
        <label className="text-[9px] uppercase font-bold text-[#1A3C2B]/70 block mb-1">
          GYORS TÍPUSVÁLASZTÁS
        </label>
        <div className="grid grid-cols-2 gap-1">
          <button
            type="button"
            onClick={() => handleQuickTypeSelect('entrance')}
            className={`px-2 py-1 border text-left flex items-center gap-1.5 text-[10px] font-bold transition-colors cursor-pointer ${
              poi.type === 'entrance'
                ? 'bg-[#047857] text-white border-[#047857]'
                : 'bg-white border-[#1A3C2B]/30 hover:bg-[#F0F5F2] text-[#1A3C2B]'
            }`}
          >
            <span>🚪</span>
            <span>FŐBEJÁRAT</span>
          </button>
          <button
            type="button"
            onClick={() => handleQuickTypeSelect('exit')}
            className={`px-2 py-1 border text-left flex items-center gap-1.5 text-[10px] font-bold transition-colors cursor-pointer ${
              poi.type === 'exit'
                ? 'bg-[#B91C1C] text-white border-[#B91C1C]'
                : 'bg-white border-[#1A3C2B]/30 hover:bg-[#F0F5F2] text-[#1A3C2B]'
            }`}
          >
            <span>🚪</span>
            <span>KIJÁRAT</span>
          </button>
          <button
            type="button"
            onClick={() => handleQuickTypeSelect('fire_exit')}
            className={`px-2 py-1 border text-left flex items-center gap-1.5 text-[10px] font-bold transition-colors cursor-pointer ${
              poi.type === 'fire_exit'
                ? 'bg-[#15803D] text-white border-[#15803D]'
                : 'bg-white border-[#1A3C2B]/30 hover:bg-[#F0F5F2] text-[#1A3C2B]'
            }`}
          >
            <span>🚨</span>
            <span>VÉSZKIJÁRAT</span>
          </button>
          <button
            type="button"
            onClick={() => handleQuickTypeSelect('accessible_entrance')}
            className={`px-2 py-1 border text-left flex items-center gap-1.5 text-[10px] font-bold transition-colors cursor-pointer ${
              poi.type === 'accessible_entrance'
                ? 'bg-[#0284C7] text-white border-[#0284C7]'
                : 'bg-white border-[#1A3C2B]/30 hover:bg-[#F0F5F2] text-[#1A3C2B]'
            }`}
          >
            <span>♿</span>
            <span>AKADÁLYMENTES</span>
          </button>
        </div>
      </div>

      {/* Full Type Dropdown */}
      <div>
        <label className="text-[9px] uppercase font-bold text-[#1A3C2B]/70 block mb-0.5">
          ÖSSZES KATEGÓRIA
        </label>
        <select
          value={poi.type}
          onChange={(e) => handleQuickTypeSelect(e.target.value as POIType)}
          className="w-full bg-white border border-[#1A3C2B] px-1.5 py-1 text-xs text-[#1A3C2B]"
        >
          {allTypes.map((t) => (
            <option key={t.type} value={t.type}>
              {t.icon} {t.label}
            </option>
          ))}
        </select>
      </div>

      {/* Description */}
      <div>
        <label className="text-[9px] uppercase font-bold text-[#1A3C2B]/70 block mb-0.5">
          LEÍRÁS / MEGJEGYZÉS
        </label>
        <textarea
          value={poi.description || ''}
          onChange={(e) => handleFieldChange('description', e.target.value)}
          placeholder="pl. Automata forgóajtó, nyitvatartás: 06:00 - 22:00..."
          rows={2}
          className="w-full bg-white border border-[#1A3C2B] px-1.5 py-1 text-xs text-[#1A3C2B] font-sans"
        />
      </div>

      {/* Actions */}
      <div className="flex items-center justify-between border-t border-[#1A3C2B]/20 pt-2 mt-1">
        <button
          onClick={() => onDelete(poi.id)}
          className="px-2 py-1 bg-white hover:bg-red-50 border border-red-400 text-red-700 text-[10px] flex items-center gap-1 font-bold cursor-pointer"
        >
          <Trash2 className="w-3 h-3" />
          <span>TÖRLÉS</span>
        </button>
        <button
          onClick={onClose}
          className="px-3 py-1 bg-[#1A3C2B] text-white hover:bg-[#2A533E] text-[10px] font-bold cursor-pointer"
        >
          KÉSZ
        </button>
      </div>
    </div>
  );
};
