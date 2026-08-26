import React, { useState } from 'react';
import type { Floor, FloorUnderlay } from '../../types';
import { Image as ImageIcon, Sliders, Lock, Unlock, Eye, EyeOff, Trash2, Upload, Check } from 'lucide-react';

interface UnderlayManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  floor: Floor;
  onUpdateFloor: (updated: Floor) => void;
}

export const UnderlayManagerModal: React.FC<UnderlayManagerModalProps> = ({
  isOpen,
  onClose,
  floor,
  onUpdateFloor,
}) => {
  if (!isOpen) return null;

  const currentUnderlay: FloorUnderlay = floor.underlay || {
    url: '',
    name: '',
    opacity: 0.5,
    scale: 1,
    offsetX: 0,
    offsetY: 0,
    rotation: 0,
    visible: true,
    locked: false,
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;
      const updated: FloorUnderlay = {
        ...currentUnderlay,
        url: dataUrl,
        name: file.name,
        visible: true,
      };
      onUpdateFloor({ ...floor, underlay: updated });
    };
    reader.readAsDataURL(file);
  };

  const handleUpdate = (fields: Partial<FloorUnderlay>) => {
    const updated: FloorUnderlay = {
      ...currentUnderlay,
      ...fields,
    };
    onUpdateFloor({ ...floor, underlay: updated });
  };

  const handleRemove = () => {
    onUpdateFloor({ ...floor, underlay: undefined });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#1A3C2B]/40 backdrop-blur-xs select-none">
      <div className="bg-[#F7F7F5] border-2 border-[#1A3C2B] w-full max-w-lg flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="p-3 bg-[#1A3C2B] text-[#F7F7F5] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ImageIcon className="w-4 h-4" />
            <span className="font-mono text-xs font-bold uppercase tracking-wider">
              HÁTTÉR ALAPRAJZ KÉP / TERVRAJZ RÁRAJZOLÁS
            </span>
          </div>
          <button onClick={onClose} className="font-mono text-sm text-[#F7F7F5]/80 hover:text-white">
            ✕
          </button>
        </div>

        <div className="p-4 flex flex-col gap-4 font-mono text-xs text-[#1A3C2B]">
          {/* Upload Box */}
          <div className="border-2 border-dashed border-[#1A3C2B]/40 p-4 bg-white flex flex-col items-center justify-center text-center gap-2">
            <Upload className="w-6 h-6 text-[#1A3C2B]/60" />
            <div>
              <span className="font-bold block">Építészeti Alaprajz Kép Feltöltése</span>
              <span className="text-[10px] text-[#1A3C2B]/60">Támogatott formátumok: PNG, JPG, SVG, WebP</span>
            </div>
            <label className="cursor-pointer px-3 py-1.5 bg-[#1A3C2B] text-white hover:bg-[#2A533E] font-bold text-[11px] mt-1">
              FÁJL KIVÁLASZTÁSA
              <input
                type="file"
                accept="image/*"
                onChange={handleFileUpload}
                className="hidden"
              />
            </label>
            {currentUnderlay.url && (
              <span className="text-[9px] text-emerald-700 font-bold mt-1">
                ✓ Betöltve: {currentUnderlay.name || 'Alaprajz háttérkép'}
              </span>
            )}
          </div>

          {currentUnderlay.url && (
            <div className="flex flex-col gap-3 bg-white p-3 border border-[#D0D0C7]">
              {/* Opacity Slider */}
              <div className="flex flex-col gap-1">
                <div className="flex justify-between text-[10px] font-bold">
                  <span>ÁTLÁTSZÓSÁG (OPACITY):</span>
                  <span>{Math.round(currentUnderlay.opacity * 100)}%</span>
                </div>
                <input
                  type="range"
                  min="0.05"
                  max="1"
                  step="0.05"
                  value={currentUnderlay.opacity}
                  onChange={(e) => handleUpdate({ opacity: parseFloat(e.target.value) })}
                  className="accent-[#1A3C2B]"
                />
              </div>

              {/* Scale Slider */}
              <div className="flex flex-col gap-1">
                <div className="flex justify-between text-[10px] font-bold">
                  <span>MÉRETARÁNY / NAGYÍTÁS (SCALE):</span>
                  <span>{currentUnderlay.scale.toFixed(2)}x</span>
                </div>
                <input
                  type="range"
                  min="0.2"
                  max="3"
                  step="0.05"
                  value={currentUnderlay.scale}
                  onChange={(e) => handleUpdate({ scale: parseFloat(e.target.value) })}
                  className="accent-[#1A3C2B]"
                />
              </div>

              {/* Offset X / Y */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[9px] font-bold block mb-0.5">ELTOLÁS X (px):</label>
                  <input
                    type="number"
                    value={currentUnderlay.offsetX}
                    onChange={(e) => handleUpdate({ offsetX: parseInt(e.target.value) || 0 })}
                    className="w-full border border-[#1A3C2B] px-1.5 py-0.5 text-xs"
                  />
                </div>
                <div>
                  <label className="text-[9px] font-bold block mb-0.5">ELTOLÁS Y (px):</label>
                  <input
                    type="number"
                    value={currentUnderlay.offsetY}
                    onChange={(e) => handleUpdate({ offsetY: parseInt(e.target.value) || 0 })}
                    className="w-full border border-[#1A3C2B] px-1.5 py-0.5 text-xs"
                  />
                </div>
              </div>

              {/* Visibility and Lock toggles */}
              <div className="flex items-center justify-between pt-1 border-t border-[#D0D0C7]">
                <button
                  onClick={() => handleUpdate({ visible: !currentUnderlay.visible })}
                  className="px-2 py-1 border border-[#1A3C2B] hover:bg-[#F0F5F2] flex items-center gap-1 text-[10px] font-bold"
                >
                  {currentUnderlay.visible ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
                  <span>{currentUnderlay.visible ? 'LÁTHATÓ' : 'ELREJTVE'}</span>
                </button>

                <button
                  onClick={() => handleUpdate({ locked: !currentUnderlay.locked })}
                  className="px-2 py-1 border border-[#1A3C2B] hover:bg-[#F0F5F2] flex items-center gap-1 text-[10px] font-bold"
                >
                  {currentUnderlay.locked ? <Lock className="w-3 h-3" /> : <Unlock className="w-3 h-3" />}
                  <span>{currentUnderlay.locked ? 'ZÁROLVA' : 'FELOLDVA'}</span>
                </button>

                <button
                  onClick={handleRemove}
                  className="px-2 py-1 border border-red-300 text-red-700 hover:bg-red-50 flex items-center gap-1 text-[10px]"
                >
                  <Trash2 className="w-3 h-3" />
                  <span>ELTÁVOLÍTÁS</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-3 bg-white border-t border-[#1A3C2B] flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-1 bg-[#1A3C2B] text-white hover:bg-[#2A533E] font-bold text-xs"
          >
            KÉSZ
          </button>
        </div>
      </div>
    </div>
  );
};
