import React, { useState, useEffect, useRef } from 'react';
import type { Zone, ZoneType } from '../../types';
import { ZONE_TYPES, ZONE_TYPE_NAMES_HU, ZONE_TYPE_COLORS } from '../../types';
import {
  Trash2,
  Layers,
  Ruler,
  Maximize2,
  Minimize2,
  Scissors,
  Copy,
  LandPlot,
  Palette,
} from 'lucide-react';
import {
  polygonAreaInSquareMeters,
  polygonPerimeterInMeters,
  getPolygonEdges,
  insertVertexInPolygon,
} from '../../utils/geometry';

interface ZoneInspectorProps {
  zone: Zone;
  onUpdate: (updated: Zone) => void;
  onDelete: (zoneId: string) => void;
  onDuplicate?: (zone: Zone) => void;
  onClose: () => void;
  initialIsModal?: boolean;
}

export const ZoneInspector: React.FC<ZoneInspectorProps> = ({
  zone,
  onUpdate,
  onDelete,
  onDuplicate,
  onClose,
  initialIsModal = false,
}) => {
  const [isModal, setIsModal] = useState<boolean>(initialIsModal);
  const [isConfirmingDelete, setIsConfirmingDelete] = useState<boolean>(false);
  const [formData, setFormData] = useState<Zone>(zone);
  const updateTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setFormData(zone);
  }, [zone]);

  const area = polygonAreaInSquareMeters(formData.polygon);
  const perimeter = polygonPerimeterInMeters(formData.polygon);
  const edges = getPolygonEdges(formData.polygon);
  const currentPalette = ZONE_TYPE_COLORS[formData.type] || ZONE_TYPE_COLORS.custom;

  const commitUpdate = (updated: Zone) => {
    if (updateTimeoutRef.current) clearTimeout(updateTimeoutRef.current);
    setFormData(updated);
    onUpdate(updated);
  };

  const handleFieldChange = (field: keyof Zone, value: any) => {
    const updated = { ...formData, [field]: value };
    setFormData(updated);

    if (updateTimeoutRef.current) clearTimeout(updateTimeoutRef.current);
    updateTimeoutRef.current = setTimeout(() => {
      onUpdate(updated);
    }, 300);
  };

  const handleBlur = () => {
    if (updateTimeoutRef.current) {
      clearTimeout(updateTimeoutRef.current);
      onUpdate(formData);
    }
  };

  const handleTagsChange = (tagsStr: string) => {
    const arr = tagsStr
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    const updated = { ...formData, tags: arr };
    setFormData(updated);

    if (updateTimeoutRef.current) clearTimeout(updateTimeoutRef.current);
    updateTimeoutRef.current = setTimeout(() => {
      onUpdate(updated);
    }, 300);
  };

  const handleSplitEdge = (edgeIdx: number) => {
    const newPolygon = insertVertexInPolygon(formData.polygon, edgeIdx);
    commitUpdate({ ...formData, polygon: newPolygon });
  };

  // Expanded Floating Popup Modal
  if (isModal) {
    return (
      <div
        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#1A3C2B]/50 backdrop-blur-xs select-none font-mono text-xs"
        onClick={(e) => {
          if (e.target === e.currentTarget) setIsModal(false);
        }}
      >
        <div className="bg-[#F7F7F5] border-2 border-[#1A3C2B] w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-150">
          {/* Modal Header */}
          <div className="p-3 bg-[#1A3C2B] text-[#F7F7F5] flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs px-2 py-0.5 bg-[#F7F7F5] text-[#1A3C2B] font-bold">
                {formData.code || 'ZÓNA'}
              </span>
              <span className="font-mono text-[11px] font-bold tracking-wider uppercase text-[#F7F7F5]">
                ÉPÍTÉSZETI ZÓNA & AULA ADATLAP
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setIsModal(false)}
                className="text-[#F7F7F5]/80 hover:text-white flex items-center gap-1 font-mono text-[10px] px-2 py-0.5 border border-[#F7F7F5]/30 hover:border-[#F7F7F5] transition-colors cursor-pointer"
                title="Visszatűzés az oldalsávba"
              >
                <Minimize2 className="w-3 h-3" />
                <span>OLDALSÁVBA</span>
              </button>
              <button
                onClick={onClose}
                className="text-[#F7F7F5]/80 hover:text-white font-mono text-sm px-1.5 cursor-pointer"
                title="Bezárás"
              >
                ✕
              </button>
            </div>
          </div>

          {/* Modal Body */}
          <div className="p-4 overflow-y-auto flex flex-col gap-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Left Column: Form Fields */}
              <div className="flex flex-col gap-3">
                <div className="grid grid-cols-3 gap-2">
                  <div className="col-span-1">
                    <label className="text-[9px] uppercase font-bold text-[#1A3C2B]/70 block mb-0.5">
                      KÓD
                    </label>
                    <input
                      type="text"
                      value={formData.code || ''}
                      onChange={(e) => handleFieldChange('code', e.target.value)}
                      onBlur={handleBlur}
                      placeholder="pl. Z-01"
                      className="w-full bg-white border border-[#1A3C2B] px-2 py-1 text-xs text-[#1A3C2B] font-bold"
                    />
                  </div>
                  <div className="col-span-2">
                    <label className="text-[9px] uppercase font-bold text-[#1A3C2B]/70 block mb-0.5">
                      ZÓNA MEGNEVEZÉSE
                    </label>
                    <input
                      type="text"
                      value={formData.name}
                      onChange={(e) => handleFieldChange('name', e.target.value)}
                      onBlur={handleBlur}
                      placeholder="pl. Központi Aula & Főcsarnok"
                      className="w-full bg-white border border-[#1A3C2B] px-2 py-1 text-xs text-[#1A3C2B] font-bold"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-[9px] uppercase font-bold text-[#1A3C2B]/70 block mb-0.5">
                    ZÓNA TÍPUSA
                  </label>
                  <select
                    value={formData.type}
                    onChange={(e) => commitUpdate({ ...formData, type: e.target.value as ZoneType })}
                    className="w-full bg-white border border-[#1A3C2B] px-2 py-1 text-xs text-[#1A3C2B]"
                  >
                    {ZONE_TYPES.map((zt) => (
                      <option key={zt} value={zt}>
                        {ZONE_TYPE_NAMES_HU[zt]}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-[9px] uppercase font-bold text-[#1A3C2B]/70 block mb-0.5">
                    LEÍRÁS / MEGJEGYZÉS
                  </label>
                  <textarea
                    rows={2}
                    value={formData.description || ''}
                    onChange={(e) => handleFieldChange('description', e.target.value)}
                    onBlur={handleBlur}
                    placeholder="pl. Tágas átrium pihenőszigetekkel és természetes fénytetővel"
                    className="w-full bg-white border border-[#1A3C2B] px-2 py-1 text-xs text-[#1A3C2B]"
                  />
                </div>

                <div>
                  <label className="text-[9px] uppercase font-bold text-[#1A3C2B]/70 block mb-0.5">
                    CÍMKÉK (VESSZŐVEL ELVÁLASZTVA)
                  </label>
                  <input
                    type="text"
                    value={(formData.tags || []).join(', ')}
                    onChange={(e) => handleTagsChange(e.target.value)}
                    onBlur={handleBlur}
                    placeholder="Aula, Wi-Fi, Rendezvénytér"
                    className="w-full bg-white border border-[#1A3C2B] px-2 py-1 text-xs text-[#1A3C2B]"
                  />
                </div>
              </div>

              {/* Right Column: Telemetry & Edges */}
              <div className="flex flex-col gap-3">
                {/* Telemetry Box */}
                <div className="bg-white border border-[#1A3C2B]/30 p-3 flex flex-col gap-2">
                  <span className="font-bold text-[10px] uppercase text-[#1A3C2B] border-b border-[#1A3C2B]/10 pb-1 flex items-center justify-between">
                    <span>📐 ZÓNA TELEMETRIA</span>
                    <span
                      className="px-1.5 py-0.2 text-[9px] font-bold rounded-xs"
                      style={{ backgroundColor: currentPalette.stroke, color: '#FFFFFF' }}
                    >
                      {ZONE_TYPE_NAMES_HU[formData.type]}
                    </span>
                  </span>
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-[#1A3C2B]/70">ALAPTERÜLET:</span>
                    <span className="font-bold text-[#1A3C2B] bg-[#F0F5F2] px-2 py-0.5 border border-[#1A3C2B]/20">
                      {area.toFixed(1)} m²
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-[#1A3C2B]/70">HATÁROLÓVONAL HOSSZA:</span>
                    <span className="font-bold text-[#1A3C2B]">{perimeter.toFixed(1)} m</span>
                  </div>
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-[#1A3C2B]/70">SAROKPONTOK:</span>
                    <span className="font-bold text-[#1A3C2B]">{formData.polygon.length} db sarokpont</span>
                  </div>
                </div>

                {/* Wall Segments / Edges */}
                <div className="flex flex-col gap-1.5 border border-[#1A3C2B]/20 p-2.5 bg-[#FAF9F6] flex-1">
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-bold text-[10px] uppercase text-[#1A3C2B] flex items-center gap-1">
                      <Ruler className="w-3 h-3" />
                      <span>HATÁROLÓ SZAKASZOK ({edges.length} DB)</span>
                    </span>
                    <span className="text-[9px] text-[#1A3C2B]/60">ÉLOSZTÁS: [+] GOMB</span>
                  </div>

                  <div className="max-h-40 overflow-y-auto flex flex-col gap-1.5 pr-0.5">
                    {edges.map((edge) => (
                      <div
                        key={edge.index}
                        className="flex items-center justify-between bg-white border border-[#D0D0C7] px-2.5 py-1 text-xs"
                      >
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-[10px] px-1.5 py-0.5 bg-[#1A3C2B]/10">
                            {edge.index + 1}. Él
                          </span>
                          <span className="font-bold text-[#1A3C2B]">{edge.lengthMeters.toFixed(2)} m</span>
                        </div>

                        <button
                          onClick={() => handleSplitEdge(edge.index)}
                          className="px-2 py-0.5 bg-[#F0F5F2] hover:bg-[#1A3C2B] hover:text-white border border-[#1A3C2B]/40 text-[9.5px] font-bold transition-colors flex items-center gap-1 cursor-pointer"
                          title="Falszakasz felezése és új sarokpont beszúrása"
                        >
                          <Scissors className="w-3 h-3" />
                          <span>MEGOSZTÁS</span>
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Modal Footer */}
          <div className="p-3 bg-white border-t border-[#1A3C2B]/20 flex items-center justify-between">
            <div className="flex items-center gap-2">
              {isConfirmingDelete ? (
                <div className="flex items-center gap-2 bg-red-50 border border-red-500 px-2.5 py-1 animate-in fade-in duration-100">
                  <span className="text-xs font-bold text-red-800">
                    Biztosan törölni kívánja a(z) <b>{formData.name || formData.code}</b> zónát?
                  </span>
                  <button
                    onClick={() => {
                      setIsConfirmingDelete(false);
                      onDelete(formData.id);
                    }}
                    className="px-2.5 py-1 bg-red-600 hover:bg-red-700 text-white text-xs font-bold transition-colors cursor-pointer shadow-xs"
                  >
                    IGEN, TÖRLÉS
                  </button>
                  <button
                    onClick={() => setIsConfirmingDelete(false)}
                    className="px-2 py-1 bg-white hover:bg-neutral-100 border border-neutral-300 text-neutral-700 text-xs font-bold transition-colors cursor-pointer"
                  >
                    MÉGSE
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setIsConfirmingDelete(true)}
                  className="px-3 py-1.5 bg-white hover:bg-red-50 border border-red-400 text-red-700 text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
                  title="Zóna törlése"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>TÖRLÉS</span>
                </button>
              )}

              {!isConfirmingDelete && onDuplicate && (
                <button
                  onClick={() => onDuplicate(formData)}
                  className="px-3 py-1.5 bg-[#F0F5F2] hover:bg-[#1A3C2B] hover:text-white border border-[#1A3C2B] text-[#1A3C2B] text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
                  title="Zóna duplikálása (Ctrl+D)"
                >
                  <Copy className="w-3.5 h-3.5" />
                  <span>MÁSOLÁS (Ctrl+D)</span>
                </button>
              )}
            </div>
            <button
              onClick={() => {
                handleBlur();
                onClose();
              }}
              className="px-5 py-1.5 bg-[#1A3C2B] text-white hover:bg-[#2A533E] text-xs font-bold shadow-xs cursor-pointer"
            >
              KÉSZ / MENTÉS
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Docked Sidebar View
  return (
    <div className="bg-[#F7F7F5] border border-[#1A3C2B] p-3 flex flex-col gap-3 font-mono text-xs select-none shadow-xs">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-[#1A3C2B]/20 pb-1.5">
        <div className="flex items-center gap-1.5">
          <LandPlot className="w-3.5 h-3.5 text-[#1A3C2B]" />
          <span className="font-bold text-[#1A3C2B] uppercase">ZÓNA / AULA TULAJDONSÁGOK</span>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setIsModal(true)}
            className="p-1 text-[#1A3C2B]/70 hover:text-[#1A3C2B] hover:bg-[#1A3C2B]/10 transition-colors cursor-pointer"
            title="Megnyitás lebegő popup ablakként (Pop-out)"
          >
            <Maximize2 className="w-3.5 h-3.5" />
          </button>
          <button onClick={() => { handleBlur(); onClose(); }} className="text-[#1A3C2B]/60 hover:text-[#1A3C2B] px-1 cursor-pointer">
            ✕
          </button>
        </div>
      </div>

      {/* Code & Name */}
      <div className="grid grid-cols-3 gap-2">
        <div className="col-span-1">
          <label className="text-[9px] uppercase font-bold text-[#1A3C2B]/70 block mb-0.5">
            KÓD
          </label>
          <input
            type="text"
            value={formData.code || ''}
            onChange={(e) => handleFieldChange('code', e.target.value)}
            onBlur={handleBlur}
            placeholder="Z-01"
            className="w-full bg-white border border-[#1A3C2B] px-1.5 py-1 text-xs text-[#1A3C2B] font-bold"
          />
        </div>
        <div className="col-span-2">
          <label className="text-[9px] uppercase font-bold text-[#1A3C2B]/70 block mb-0.5">
            ZÓNA MEGNEVEZÉSE
          </label>
          <input
            type="text"
            value={formData.name}
            onChange={(e) => handleFieldChange('name', e.target.value)}
            onBlur={handleBlur}
            className="w-full bg-white border border-[#1A3C2B] px-1.5 py-1 text-xs text-[#1A3C2B] font-bold"
          />
        </div>
      </div>

      {/* Zone Type */}
      <div>
        <label className="text-[9px] uppercase font-bold text-[#1A3C2B]/70 block mb-0.5">
          ZÓNA TÍPUSA
        </label>
        <select
          value={formData.type}
          onChange={(e) => commitUpdate({ ...formData, type: e.target.value as ZoneType })}
          className="w-full bg-white border border-[#1A3C2B] px-1.5 py-1 text-xs text-[#1A3C2B]"
        >
          {ZONE_TYPES.map((zt) => (
            <option key={zt} value={zt}>
              {ZONE_TYPE_NAMES_HU[zt]}
            </option>
          ))}
        </select>
      </div>

      {/* Telemetry Banner */}
      <div className="bg-white border border-[#1A3C2B]/30 p-2 flex flex-col gap-1.5">
        <div className="flex justify-between items-center text-[10px]">
          <span className="text-[#1A3C2B]/70">ALAPTERÜLET:</span>
          <span className="font-bold text-[#1A3C2B] bg-[#F0F5F2] px-1.5 py-0.2 border border-[#1A3C2B]/20">
            {area.toFixed(1)} m²
          </span>
        </div>
        <div className="flex justify-between items-center text-[10px]">
          <span className="text-[#1A3C2B]/70">HATÁROLÓVONAL:</span>
          <span className="font-bold text-[#1A3C2B]">{perimeter.toFixed(1)} m</span>
        </div>
        <div className="flex justify-between items-center text-[10px]">
          <span className="text-[#1A3C2B]/70">SAROKPONTOK:</span>
          <span className="font-bold text-[#1A3C2B]">{formData.polygon.length} db</span>
        </div>
      </div>

      {/* Wall Segments / Falszakaszok és Felosztás */}
      <div className="flex flex-col gap-1 border border-[#1A3C2B]/20 p-2 bg-[#FAF9F6]">
        <div className="flex items-center justify-between mb-1">
          <span className="font-bold text-[9px] uppercase text-[#1A3C2B] flex items-center gap-1">
            <Ruler className="w-3 h-3" />
            <span>HATÁROLÓ SZAKASZOK ({edges.length} DB)</span>
          </span>
          <span className="text-[8px] text-[#1A3C2B]/60">ÉLOSZTÁS: [+] GOMB</span>
        </div>

        <div className="max-h-28 overflow-y-auto flex flex-col gap-1 pr-0.5">
          {edges.map((edge) => (
            <div
              key={edge.index}
              className="flex items-center justify-between bg-white border border-[#D0D0C7] px-2 py-0.8 text-[10px]"
            >
              <div className="flex items-center gap-1.5">
                <span className="font-bold text-[9px] px-1 bg-[#1A3C2B]/10">
                  {edge.index + 1}. Él
                </span>
                <span className="font-bold text-[#1A3C2B]">{edge.lengthMeters.toFixed(2)} m</span>
              </div>

              <button
                onClick={() => handleSplitEdge(edge.index)}
                className="px-1.5 py-0.5 bg-[#F0F5F2] hover:bg-[#1A3C2B] hover:text-white border border-[#1A3C2B]/40 text-[9px] font-bold transition-colors flex items-center gap-1 cursor-pointer"
                title="Falszakasz felezése és új sarokpont beszúrása"
              >
                <Scissors className="w-2.5 h-2.5" />
                <span>MEGOSZTÁS</span>
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Description */}
      <div>
        <label className="text-[9px] uppercase font-bold text-[#1A3C2B]/70 block mb-0.5">
          LEÍRÁS
        </label>
        <input
          type="text"
          value={formData.description || ''}
          onChange={(e) => handleFieldChange('description', e.target.value)}
          onBlur={handleBlur}
          placeholder="pl. Központi átrium ülőbútorokkal"
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
          value={(formData.tags || []).join(', ')}
          onChange={(e) => handleTagsChange(e.target.value)}
          onBlur={handleBlur}
          placeholder="Aula, Kávézó, Pihenő"
          className="w-full bg-white border border-[#1A3C2B] px-1.5 py-1 text-xs text-[#1A3C2B]"
        />
      </div>

      {/* Actions */}
      <div className="flex items-center justify-between border-t border-[#1A3C2B]/20 pt-2">
        <div className="flex items-center gap-1.5">
          {isConfirmingDelete ? (
            <div className="flex items-center gap-1 bg-red-50 border border-red-500 p-1 animate-in fade-in duration-100">
              <span className="text-[8.5px] font-bold text-red-800">TÖRLI?</span>
              <button
                onClick={() => {
                  setIsConfirmingDelete(false);
                  onDelete(formData.id);
                }}
                className="px-1.5 py-0.5 bg-red-600 hover:bg-red-700 text-white text-[8.5px] font-bold transition-colors cursor-pointer"
              >
                IGEN
              </button>
              <button
                onClick={() => setIsConfirmingDelete(false)}
                className="px-1 py-0.5 bg-white hover:bg-neutral-100 border border-neutral-300 text-neutral-700 text-[8.5px] font-bold transition-colors cursor-pointer"
              >
                NEM
              </button>
            </div>
          ) : (
            <button
              onClick={() => setIsConfirmingDelete(true)}
              className="px-2 py-1 bg-white hover:bg-red-50 border border-red-400 text-red-700 text-[10px] flex items-center gap-1 transition-colors cursor-pointer"
              title="Zóna törlése"
            >
              <Trash2 className="w-3 h-3" />
              <span>TÖRLÉS</span>
            </button>
          )}

          {!isConfirmingDelete && onDuplicate && (
            <button
              onClick={() => onDuplicate(formData)}
              className="px-2 py-1 bg-[#F0F5F2] hover:bg-[#1A3C2B] hover:text-white border border-[#1A3C2B] text-[#1A3C2B] text-[10px] font-bold flex items-center gap-1 transition-colors cursor-pointer"
              title="Zóna duplikálása (Ctrl+D)"
            >
              <Copy className="w-3 h-3" />
              <span>MÁSOLÁS (Ctrl+D)</span>
            </button>
          )}
        </div>
        <button
          onClick={() => {
            handleBlur();
            onClose();
          }}
          className="px-3 py-1 bg-[#1A3C2B] text-white hover:bg-[#2A533E] text-[10px] font-bold cursor-pointer"
        >
          KÉSZ
        </button>
      </div>
    </div>
  );
};
