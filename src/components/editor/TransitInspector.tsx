import React from 'react';
import type { TransitConnector, TransitType, Floor } from '../../types';
import { TRANSIT_NAMES_HU } from '../../types';
import { Trash2 } from 'lucide-react';

interface TransitInspectorProps {
  transit: TransitConnector;
  allFloors: Floor[];
  onUpdate: (updated: TransitConnector) => void;
  onDelete: (transitId: string) => void;
  onClose: () => void;
}

export const TransitInspector: React.FC<TransitInspectorProps> = ({
  transit,
  allFloors,
  onUpdate,
  onDelete,
  onClose,
}) => {
  const types: TransitType[] = ['elevator', 'stairs', 'escalator', 'ramp'];

  const handleFieldChange = (field: keyof TransitConnector, value: any) => {
    onUpdate({ ...transit, [field]: value });
  };

  return (
    <div className="bg-[#F7F7F5] border border-[#1A3C2B] p-3 flex flex-col gap-3 font-mono text-xs select-none">
      <div className="flex items-center justify-between border-b border-[#1A3C2B]/20 pb-1.5">
        <span className="font-bold text-[#1A3C2B] uppercase">VERTIKÁLIS LIFT / LÉPCSŐAKNA</span>
        <button onClick={onClose} className="text-[#1A3C2B]/60 hover:text-[#1A3C2B]">
          ✕
        </button>
      </div>

      <div>
        <label className="text-[9px] uppercase font-bold text-[#1A3C2B]/70 block mb-0.5">
          AKNA / KÖZLEKEDŐ MEGNEVEZÉSE
        </label>
        <input
          type="text"
          value={transit.name}
          onChange={(e) => handleFieldChange('name', e.target.value)}
          className="w-full bg-white border border-[#1A3C2B] px-1.5 py-1 text-xs text-[#1A3C2B]"
        />
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="text-[9px] uppercase font-bold text-[#1A3C2B]/70 block mb-0.5">
            KÖZLEKEDŐ TÍPUSA
          </label>
          <select
            value={transit.type}
            onChange={(e) => {
              const newType = e.target.value as TransitType;
              onUpdate({
                ...transit,
                type: newType,
                isAccessible: newType === 'elevator' || newType === 'ramp',
              });
            }}
            className="w-full bg-white border border-[#1A3C2B] px-1.5 py-1 text-xs text-[#1A3C2B]"
          >
            {types.map((t) => (
              <option key={t} value={t}>
                {TRANSIT_NAMES_HU[t] || t}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-[9px] uppercase font-bold text-[#1A3C2B]/70 block mb-0.5">
            KÖZÖS AKNA AZONOSÍTÓ
          </label>
          <input
            type="text"
            value={transit.transitGroupId}
            onChange={(e) => handleFieldChange('transitGroupId', e.target.value)}
            placeholder="pl. SHAFT-ELEV-1"
            className="w-full bg-white border border-[#1A3C2B] px-1.5 py-1 text-xs text-[#1A3C2B]"
          />
        </div>
      </div>

      <p className="text-[10px] text-[#1A3C2B]/70 bg-white p-2 border border-[#D0D0C7]">
        Megjegyzés: Az azonos <b>Akna Azonosítóval</b> rendelkező liftek és lépcsők automatikusan összekapcsolódnak a szintek közötti útvonaltervezéshez.
      </p>

      {/* Accessible Switch */}
      <label className="flex items-center gap-2 cursor-pointer bg-white border border-[#D0D0C7] p-2">
        <input
          type="checkbox"
          checked={transit.isAccessible}
          onChange={(e) => handleFieldChange('isAccessible', e.target.checked)}
          className="accent-[#1A3C2B]"
        />
        <span className="text-[10px] text-[#1A3C2B] font-bold">
          AKADÁLYMENTES (LIFT / RÁMPA)
        </span>
      </label>

      {/* Actions */}
      <div className="flex items-center justify-between border-t border-[#1A3C2B]/20 pt-2">
        <button
          onClick={() => onDelete(transit.id)}
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
