import React from 'react';
import type { EditorTool } from '../../types';
import {
  MousePointer,
  Square,
  Minus,
  DoorOpen,
  Layers,
  MapPin,
  Route,
  Ruler,
  Trash2,
  Sparkles,
  Grid,
  Zap,
  Undo2,
  Redo2,
  Image as ImageIcon,
} from 'lucide-react';

interface EditorToolbarProps {
  activeTool: EditorTool;
  onSelectTool: (tool: EditorTool) => void;
  gridSnapSize: number;
  onSetGridSnapSize: (size: number) => void;
  onAutoGenerateNavMesh: () => void;
  onClearFloor: () => void;
  onUndo?: () => void;
  onRedo?: () => void;
  canUndo?: boolean;
  canRedo?: boolean;
  onOpenUnderlayModal?: () => void;
  hasUnderlay?: boolean;
  className?: string;
}

export const EditorToolbar: React.FC<EditorToolbarProps> = ({
  activeTool,
  onSelectTool,
  gridSnapSize,
  onSetGridSnapSize,
  onAutoGenerateNavMesh,
  onClearFloor,
  onUndo,
  onRedo,
  canUndo = false,
  canRedo = false,
  onOpenUnderlayModal,
  hasUnderlay = false,
  className = '',
}) => {
  const tools: { id: EditorTool; label: string; icon: React.ReactNode; shortcut: string }[] = [
    { id: 'select', label: 'Kijelölés / Mozgatás', icon: <MousePointer className="w-4 h-4" />, shortcut: 'V' },
    { id: 'room', label: 'Szoba / Terem rajzolás', icon: <Square className="w-4 h-4" />, shortcut: 'R' },
    { id: 'wall', label: 'Fal vonal rajzolás', icon: <Minus className="w-4 h-4" />, shortcut: 'W' },
    { id: 'door', label: 'Ajtó elhelyezése', icon: <DoorOpen className="w-4 h-4" />, shortcut: 'D' },
    { id: 'transit', label: 'Lift / Lépcsőakna', icon: <Layers className="w-4 h-4" />, shortcut: 'T' },
    { id: 'poi', label: 'Szolgáltatás (POI)', icon: <MapPin className="w-4 h-4" />, shortcut: 'P' },
    { id: 'nav_node', label: 'Navigációs útpont', icon: <Route className="w-4 h-4" />, shortcut: 'N' },
    { id: 'measure', label: 'Mérőszalag', icon: <Ruler className="w-4 h-4" />, shortcut: 'M' },
    { id: 'eraser', label: 'Radír / Törlés', icon: <Trash2 className="w-4 h-4" />, shortcut: 'X' },
  ];

  return (
    <div
      className={`bg-[#F7F7F5] border border-[#1A3C2B] p-2 flex flex-col gap-3 select-none ${className}`}
    >
      {/* Header with Undo / Redo */}
      <div className="border-b border-[#1A3C2B]/20 pb-1.5 flex items-center justify-between">
        <span className="font-mono text-[10px] font-bold text-[#1A3C2B] uppercase tracking-wider">
          CAD ESZKÖZTÁR
        </span>
        <div className="flex items-center gap-1">
          <button
            onClick={onUndo}
            disabled={!canUndo}
            className="p-1 border border-[#1A3C2B]/30 disabled:opacity-30 bg-white hover:bg-[#F0F5F2] text-[#1A3C2B]"
            title="Visszavonás (Ctrl+Z)"
          >
            <Undo2 className="w-3 h-3" />
          </button>
          <button
            onClick={onRedo}
            disabled={!canRedo}
            className="p-1 border border-[#1A3C2B]/30 disabled:opacity-30 bg-white hover:bg-[#F0F5F2] text-[#1A3C2B]"
            title="Újra (Ctrl+Y)"
          >
            <Redo2 className="w-3 h-3" />
          </button>
        </div>
      </div>

      {/* Primary Tools Grid */}
      <div className="grid grid-cols-1 gap-1">
        {tools.map((t) => {
          const isActive = activeTool === t.id;
          return (
            <button
              key={t.id}
              onClick={() => onSelectTool(t.id)}
              className={`px-2.5 py-1.5 border text-left flex items-center justify-between font-mono text-xs transition-colors ${
                isActive
                  ? 'bg-[#1A3C2B] text-[#F7F7F5] border-[#1A3C2B]'
                  : 'bg-white text-[#1A3C2B] border-[#D0D0C7] hover:border-[#1A3C2B] hover:bg-[#F0F5F2]'
              }`}
            >
              <div className="flex items-center gap-2">
                {t.icon}
                <span className="font-sans font-medium text-xs">{t.label}</span>
              </div>
              <span
                className={`text-[9px] px-1 border ${
                  isActive ? 'border-[#F7F7F5]/40 text-[#F7F7F5]' : 'border-[#1A3C2B]/30 text-[#1A3C2B]/60'
                }`}
              >
                {t.shortcut}
              </span>
            </button>
          );
        })}
      </div>

      {/* Blueprint Underlay Reference Button */}
      <div className="border-t border-[#1A3C2B]/20 pt-2">
        <button
          onClick={onOpenUnderlayModal}
          className={`w-full py-1.5 px-2 border font-mono text-[10.5px] font-bold flex items-center justify-between transition-colors ${
            hasUnderlay
              ? 'bg-[#E6F4EA] border-[#1A3C2B] text-[#1A3C2B]'
              : 'bg-white border-[#D0D0C7] hover:border-[#1A3C2B] text-[#1A3C2B]'
          }`}
          title="Építészeti tervrajz vagy kép importálása átrajzoláshoz"
        >
          <div className="flex items-center gap-1.5">
            <ImageIcon className="w-3.5 h-3.5 text-[#1A3C2B]" />
            <span>HÁTTÉRKÉP ÁTRAJZOLÁS</span>
          </div>
          {hasUnderlay && <span className="w-2 h-2 rounded-full bg-emerald-600" />}
        </button>
      </div>

      {/* Grid Snapping Settings */}
      <div className="border-t border-[#1A3C2B]/20 pt-2 flex flex-col gap-1.5">
        <span className="font-mono text-[9px] uppercase font-bold text-[#1A3C2B]/70">
          RÁCSILLESZTÉS LÉPÉSKÖZE
        </span>
        <div className="grid grid-cols-4 gap-1">
          {[0, 5, 10, 20].map((size) => (
            <button
              key={size}
              onClick={() => onSetGridSnapSize(size)}
              className={`py-1 text-center font-mono text-[10px] border transition-colors ${
                gridSnapSize === size
                  ? 'bg-[#1A3C2B] text-white border-[#1A3C2B]'
                  : 'bg-white text-[#1A3C2B] border-[#D0D0C7] hover:border-[#1A3C2B]'
              }`}
            >
              {size === 0 ? 'SZABAD' : `${size}px`}
            </button>
          ))}
        </div>
      </div>

      {/* Smart NavMesh Auto Generator */}
      <div className="border-t border-[#1A3C2B]/20 pt-2 flex flex-col gap-1.5">
        <button
          onClick={onAutoGenerateNavMesh}
          className="w-full py-2 bg-white hover:bg-[#F0F5F2] border border-[#1A3C2B] text-[#1A3C2B] font-mono text-[11px] font-bold flex items-center justify-center gap-1.5 transition-colors"
          title="Folyosói útpontok és szobakapcsolatok automatikus kiszámítása"
        >
          <Zap className="w-3.5 h-3.5 text-[#0E7490]" />
          <span>NAV HÁLÓ GENERÁLÁSA</span>
        </button>

        <button
          onClick={onClearFloor}
          className="w-full py-1.5 bg-white hover:bg-red-50 border border-red-300 text-red-700 font-mono text-[10px] flex items-center justify-center gap-1 transition-colors"
        >
          <Trash2 className="w-3 h-3" />
          <span>SZINT ALAPRAJZ TÖRLÉSE</span>
        </button>
      </div>
    </div>
  );
};
