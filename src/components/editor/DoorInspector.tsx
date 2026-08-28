import React from 'react';
import type { Door, DoorType } from '../../types';
import { DOOR_NAMES_HU } from '../../types';
import { Trash2, DoorOpen, ShieldAlert, Accessibility, KeyRound } from 'lucide-react';

interface DoorInspectorProps {
  door: Door;
  onUpdate: (updated: Door) => void;
  onDelete: (doorId: string) => void;
  onClose: () => void;
}

export const DoorInspector: React.FC<DoorInspectorProps> = ({
  door,
  onUpdate,
  onDelete,
  onClose,
}) => {
  const handleFieldChange = (field: keyof Door, value: any) => {
    onUpdate({ ...door, [field]: value });
  };

  const handleTypeSelect = (type: DoorType) => {
    const isSpecial = type === 'entrance' || type === 'fire_exit' || type === 'accessible_entrance' || type === 'exit';
    const defaultName = DOOR_NAMES_HU[type] || 'Ajtó';
    onUpdate({
      ...door,
      type,
      name: !door.name || door.name === 'Ajtó' ? defaultName : door.name,
      isExterior: isSpecial ? true : door.isExterior,
    });
  };

  return (
    <div className="bg-[#F7F7F5] border border-[#1A3C2B] p-3 flex flex-col gap-3 font-mono text-xs select-none">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-[#1A3C2B]/20 pb-1.5">
        <div className="flex items-center gap-1.5 text-[#1A3C2B] font-bold uppercase">
          <DoorOpen className="w-4 h-4 text-[#1A3C2B]" />
          <span>AJTÓ & BEJÁRAT TULAJDONSÁGOK</span>
        </div>
        <button onClick={onClose} className="text-[#1A3C2B]/60 hover:text-[#1A3C2B] text-sm px-1 cursor-pointer">
          ✕
        </button>
      </div>

      {/* Name Input */}
      <div>
        <label className="text-[9px] uppercase font-bold text-[#1A3C2B]/70 block mb-0.5">
          AJTÓ MEGNEVEZÉSE / NÉV
        </label>
        <input
          type="text"
          value={door.name || ''}
          onChange={(e) => handleFieldChange('name', e.target.value)}
          placeholder="pl. Főbejárat, Déli Vészkijárat, A101 Ajtó..."
          className="w-full bg-white border border-[#1A3C2B] px-2 py-1 text-xs text-[#1A3C2B] font-sans font-bold"
        />
      </div>

      {/* Quick Type Presets */}
      <div>
        <label className="text-[9px] uppercase font-bold text-[#1A3C2B]/70 block mb-1">
          BEJÁRAT & AJTÓ TÍPUSA
        </label>
        <div className="grid grid-cols-2 gap-1">
          <button
            type="button"
            onClick={() => handleTypeSelect('entrance')}
            className={`px-2 py-1 border text-left flex items-center gap-1.5 text-[10px] font-bold transition-colors cursor-pointer ${
              door.type === 'entrance'
                ? 'bg-[#047857] text-white border-[#047857]'
                : 'bg-white border-[#1A3C2B]/30 hover:bg-[#F0F5F2] text-[#1A3C2B]'
            }`}
          >
            <span>🚪</span>
            <span>FŐBEJÁRAT</span>
          </button>
          <button
            type="button"
            onClick={() => handleTypeSelect('fire_exit')}
            className={`px-2 py-1 border text-left flex items-center gap-1.5 text-[10px] font-bold transition-colors cursor-pointer ${
              door.type === 'fire_exit'
                ? 'bg-[#B91C1C] text-white border-[#B91C1C]'
                : 'bg-white border-[#1A3C2B]/30 hover:bg-[#F0F5F2] text-[#1A3C2B]'
            }`}
          >
            <ShieldAlert className="w-3.5 h-3.5" />
            <span>VÉSZKIJÁRAT</span>
          </button>
          <button
            type="button"
            onClick={() => handleTypeSelect('accessible_entrance')}
            className={`px-2 py-1 border text-left flex items-center gap-1.5 text-[10px] font-bold transition-colors cursor-pointer ${
              door.type === 'accessible_entrance'
                ? 'bg-[#0284C7] text-white border-[#0284C7]'
                : 'bg-white border-[#1A3C2B]/30 hover:bg-[#F0F5F2] text-[#1A3C2B]'
            }`}
          >
            <Accessibility className="w-3.5 h-3.5" />
            <span>AKADÁLYMENTES</span>
          </button>
          <button
            type="button"
            onClick={() => handleTypeSelect('exit')}
            className={`px-2 py-1 border text-left flex items-center gap-1.5 text-[10px] font-bold transition-colors cursor-pointer ${
              door.type === 'exit'
                ? 'bg-[#D97706] text-white border-[#D97706]'
                : 'bg-white border-[#1A3C2B]/30 hover:bg-[#F0F5F2] text-[#1A3C2B]'
            }`}
          >
            <span>🚪</span>
            <span>KIJÁRAT</span>
          </button>
          <button
            type="button"
            onClick={() => handleTypeSelect('single')}
            className={`px-2 py-1 border text-left flex items-center gap-1.5 text-[10px] font-bold transition-colors cursor-pointer ${
              door.type === 'single'
                ? 'bg-[#1A3C2B] text-white border-[#1A3C2B]'
                : 'bg-white border-[#1A3C2B]/30 hover:bg-[#F0F5F2] text-[#1A3C2B]'
            }`}
          >
            <span>🚪</span>
            <span>EGYSZÁRNYÚ</span>
          </button>
          <button
            type="button"
            onClick={() => handleTypeSelect('double')}
            className={`px-2 py-1 border text-left flex items-center gap-1.5 text-[10px] font-bold transition-colors cursor-pointer ${
              door.type === 'double'
                ? 'bg-[#1A3C2B] text-white border-[#1A3C2B]'
                : 'bg-white border-[#1A3C2B]/30 hover:bg-[#F0F5F2] text-[#1A3C2B]'
            }`}
          >
            <span>🚪🚪</span>
            <span>KÉTSZÁRNYÚ</span>
          </button>
          <button
            type="button"
            onClick={() => handleTypeSelect('sliding')}
            className={`px-2 py-1 border text-left flex items-center gap-1.5 text-[10px] font-bold transition-colors cursor-pointer ${
              door.type === 'sliding'
                ? 'bg-[#1A3C2B] text-white border-[#1A3C2B]'
                : 'bg-white border-[#1A3C2B]/30 hover:bg-[#F0F5F2] text-[#1A3C2B]'
            }`}
          >
            <span>🛗</span>
            <span>TOLÓAJTÓ</span>
          </button>
          <button
            type="button"
            onClick={() => handleTypeSelect('security')}
            className={`px-2 py-1 border text-left flex items-center gap-1.5 text-[10px] font-bold transition-colors cursor-pointer ${
              door.type === 'security'
                ? 'bg-[#7C3AED] text-white border-[#7C3AED]'
                : 'bg-white border-[#1A3C2B]/30 hover:bg-[#F0F5F2] text-[#1A3C2B]'
            }`}
          >
            <KeyRound className="w-3.5 h-3.5" />
            <span>BELÉPTETŐ</span>
          </button>
        </div>
      </div>

      {/* Exterior & Open Status Switches */}
      <div className="flex flex-col gap-1.5 pt-1 border-t border-[#1A3C2B]/20">
        <label className="flex items-center gap-2 cursor-pointer text-[11px] font-bold text-[#1A3C2B]">
          <input
            type="checkbox"
            checked={door.isExterior || false}
            onChange={(e) => handleFieldChange('isExterior', e.target.checked)}
            className="accent-[#1A3C2B]"
          />
          <span>Külső épületfal bejárat / kijárat</span>
        </label>
        <label className="flex items-center gap-2 cursor-pointer text-[11px] font-bold text-[#1A3C2B]">
          <input
            type="checkbox"
            checked={door.isOpen !== false}
            onChange={(e) => handleFieldChange('isOpen', e.target.checked)}
            className="accent-[#1A3C2B]"
          />
          <span>Ajtó alapértelmezetten nyitva</span>
        </label>
      </div>

      {/* Actions */}
      <div className="flex items-center justify-between border-t border-[#1A3C2B]/20 pt-2 mt-1">
        <button
          onClick={() => onDelete(door.id)}
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
