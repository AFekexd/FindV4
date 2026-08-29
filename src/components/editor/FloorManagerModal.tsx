import React, { useState } from 'react';
import type { Institution, Building, Floor } from '../../types';
import {
  Building as BuildingIcon,
  Plus,
  Trash2,
  Layers,
  MapPin,
  Globe,
  Check,
  Edit2,
  Save,
  X,
  ArrowUp,
  ArrowDown,
} from 'lucide-react';

interface FloorManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  institutions: Institution[];
  activeInstitutionId: string;
  activeBuildingId: string;
  activeFloorId: string;
  onSelectInstitution: (id: string) => void;
  onSelectBuilding: (id: string) => void;
  onSelectFloor: (id: string) => void;
  onUpdateInstitutions: (institutions: Institution[]) => void;
}

export const FloorManagerModal: React.FC<FloorManagerModalProps> = ({
  isOpen,
  onClose,
  institutions,
  activeInstitutionId,
  activeBuildingId,
  activeFloorId,
  onSelectInstitution,
  onSelectBuilding,
  onSelectFloor,
  onUpdateInstitutions,
}) => {
  const currentInst = institutions.find((i) => i.id === activeInstitutionId) || institutions[0];
  const currentBld = currentInst?.buildings.find((b) => b.id === activeBuildingId) || currentInst?.buildings[0];

  // Forms states for Adding
  const [newInstName, setNewInstName] = useState('');
  const [newInstCity, setNewInstCity] = useState('');
  const [newInstCountry, setNewInstCountry] = useState('');
  const [showAddInst, setShowAddInst] = useState(false);

  const [newBldName, setNewBldName] = useState('');
  const [newBldCode, setNewBldCode] = useState('');
  const [showAddBld, setShowAddBld] = useState(false);

  const [newFloorName, setNewFloorName] = useState('');
  const [newFloorLevel, setNewFloorLevel] = useState('3');
  const [newFloorShortCode, setNewFloorShortCode] = useState('L3');
  const [newFloorElevation, setNewFloorElevation] = useState('11.4');
  const [showAddFloor, setShowAddFloor] = useState(false);

  // States for In-Place Editing / Renaming
  const [editingInstId, setEditingInstId] = useState<string | null>(null);
  const [editInstName, setEditInstName] = useState('');
  const [editInstCity, setEditInstCity] = useState('');
  const [editInstCountry, setEditInstCountry] = useState('');

  const [editingBldId, setEditingBldId] = useState<string | null>(null);
  const [editBldName, setEditBldName] = useState('');
  const [editBldCode, setEditBldCode] = useState('');

  const [editingFloorId, setEditingFloorId] = useState<string | null>(null);
  const [editFloorName, setEditFloorName] = useState('');
  const [editFloorLevel, setEditFloorLevel] = useState('');
  const [editFloorShortCode, setEditFloorShortCode] = useState('');
  const [editFloorElevation, setEditFloorElevation] = useState('');

  if (!isOpen) return null;

  // Add Institution / City
  const handleAddInstitution = () => {
    if (!newInstName.trim() || !newInstCity.trim()) return;
    const newInst: Institution = {
      id: `inst-${Date.now()}`,
      name: newInstName,
      type: 'university',
      city: newInstCity,
      country: newInstCountry || 'Magyarország',
      address: `${newInstCity} Campus`,
      coordinates: { lat: 47.4979, lng: 19.0402 },
      description: 'Újonnan létrehozott campus létesítmény',
      buildings: [
        {
          id: `bld-${Date.now()}`,
          institutionId: `inst-${Date.now()}`,
          name: 'Főépület',
          code: 'FŐ-1',
          floors: [
            {
              id: `floor-${Date.now()}`,
              buildingId: `bld-${Date.now()}`,
              level: 0,
              name: 'Földszint (0. szint)',
              shortCode: 'FSZ',
              elevationMeters: 0.0,
              width: 1000,
              height: 720,
              rooms: [],
              walls: [],
              doors: [],
              transitConnectors: [],
              pois: [],
              navNodes: [],
              navEdges: [],
            },
          ],
        },
      ],
    };

    const updated = [...institutions, newInst];
    onUpdateInstitutions(updated);
    onSelectInstitution(newInst.id);
    onSelectBuilding(newInst.buildings[0].id);
    onSelectFloor(newInst.buildings[0].floors[0].id);
    setShowAddInst(false);
    setNewInstName('');
    setNewInstCity('');
    setNewInstCountry('');
  };

  // Save Edited Institution / City
  const handleSaveEditInstitution = (instId: string) => {
    const updated = institutions.map((inst) => {
      if (inst.id === instId) {
        return {
          ...inst,
          name: editInstName.trim() || inst.name,
          city: editInstCity.trim() || inst.city,
          country: editInstCountry.trim() || inst.country,
        };
      }
      return inst;
    });
    onUpdateInstitutions(updated);
    setEditingInstId(null);
  };

  // Delete Institution
  const handleDeleteInstitution = (instId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (institutions.length <= 1) {
      alert('Legalább egy intézménynek maradnia kell!');
      return;
    }
    if (confirm('Biztosan törölni szeretné ezt a campust és az összes épületét?')) {
      const remaining = institutions.filter((i) => i.id !== instId);
      onUpdateInstitutions(remaining);
      if (activeInstitutionId === instId) {
        onSelectInstitution(remaining[0].id);
        onSelectBuilding(remaining[0].buildings[0]?.id || '');
        onSelectFloor(remaining[0].buildings[0]?.floors[0]?.id || '');
      }
    }
  };

  // Add Building
  const handleAddBuilding = () => {
    if (!newBldName.trim() || !currentInst) return;
    const newBld: Building = {
      id: `bld-${Date.now()}`,
      institutionId: currentInst.id,
      name: newBldName,
      code: newBldCode || `ÉP-${currentInst.buildings.length + 1}`,
      floors: [
        {
          id: `floor-${Date.now()}`,
          buildingId: `bld-${Date.now()}`,
          level: 0,
          name: 'Földszint (0. szint)',
          shortCode: 'FSZ',
          elevationMeters: 0.0,
          width: 1000,
          height: 720,
          rooms: [],
          walls: [],
          doors: [],
          transitConnectors: [],
          pois: [],
          navNodes: [],
          navEdges: [],
        },
      ],
    };

    const updated = institutions.map((inst) => {
      if (inst.id === currentInst.id) {
        return { ...inst, buildings: [...inst.buildings, newBld] };
      }
      return inst;
    });

    onUpdateInstitutions(updated);
    onSelectBuilding(newBld.id);
    onSelectFloor(newBld.floors[0].id);
    setShowAddBld(false);
    setNewBldName('');
    setNewBldCode('');
  };

  // Save Edited Building
  const handleSaveEditBuilding = (bldId: string) => {
    const updated = institutions.map((inst) => {
      if (inst.id === currentInst?.id) {
        return {
          ...inst,
          buildings: inst.buildings.map((b) => {
            if (b.id === bldId) {
              return {
                ...b,
                name: editBldName.trim() || b.name,
                code: editBldCode.trim() || b.code,
              };
            }
            return b;
          }),
        };
      }
      return inst;
    });
    onUpdateInstitutions(updated);
    setEditingBldId(null);
  };

  // Delete Building
  const handleDeleteBuilding = (bldId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!currentInst || currentInst.buildings.length <= 1) {
      alert('Legalább egy épületnek maradnia kell az intézményben!');
      return;
    }
    if (confirm('Biztosan törölni szeretné ezt az épületet és szintjeit?')) {
      const updated = institutions.map((inst) => {
        if (inst.id === currentInst.id) {
          const remainingBlds = inst.buildings.filter((b) => b.id !== bldId);
          return { ...inst, buildings: remainingBlds };
        }
        return inst;
      });
      onUpdateInstitutions(updated);
      const targetInst = updated.find((i) => i.id === currentInst.id);
      if (targetInst && targetInst.buildings[0]) {
        onSelectBuilding(targetInst.buildings[0].id);
        onSelectFloor(targetInst.buildings[0].floors[0]?.id || '');
      }
    }
  };

  // Add Floor
  const handleAddFloor = () => {
    if (!newFloorName.trim() || !currentBld) return;
    const newFloor: Floor = {
      id: `floor-${Date.now()}`,
      buildingId: currentBld.id,
      level: parseInt(newFloorLevel) || 0,
      name: newFloorName,
      shortCode: newFloorShortCode || `${newFloorLevel}.SZ`,
      elevationMeters: parseFloat(newFloorElevation) || 0,
      width: 1000,
      height: 720,
      rooms: [],
      walls: [],
      doors: [],
      transitConnectors: [],
      pois: [],
      navNodes: [],
      navEdges: [],
    };

    const updated = institutions.map((inst) => {
      if (inst.id === currentInst?.id) {
        return {
          ...inst,
          buildings: inst.buildings.map((bld) => {
            if (bld.id === currentBld.id) {
              return { ...bld, floors: [...bld.floors, newFloor] };
            }
            return bld;
          }),
        };
      }
      return inst;
    });

    onUpdateInstitutions(updated);
    onSelectFloor(newFloor.id);
    setShowAddFloor(false);
    setNewFloorName('');
  };

  // Save Edited Floor
  const handleSaveEditFloor = (floorId: string) => {
    const updated = institutions.map((inst) => {
      if (inst.id === currentInst?.id) {
        return {
          ...inst,
          buildings: inst.buildings.map((bld) => {
            if (bld.id === currentBld?.id) {
              return {
                ...bld,
                floors: bld.floors.map((f) => {
                  if (f.id === floorId) {
                    return {
                      ...f,
                      name: editFloorName.trim() || f.name,
                      level: editFloorLevel.trim() !== '' ? (parseInt(editFloorLevel) || 0) : f.level,
                      shortCode: editFloorShortCode.trim() || f.shortCode,
                      elevationMeters: editFloorElevation.trim() !== '' ? (parseFloat(editFloorElevation) || 0) : f.elevationMeters,
                    };
                  }
                  return f;
                }),
              };
            }
            return bld;
          }),
        };
      }
      return inst;
    });
    onUpdateInstitutions(updated);
    setEditingFloorId(null);
  };

  // Delete Floor
  const handleDeleteFloor = (floorId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!currentBld || currentBld.floors.length <= 1) {
      alert('Legalább egy szintnek maradnia kell az épületben!');
      return;
    }
    if (confirm('Biztosan törölni szeretné ezt a szintet és minden alaprajzi elemét?')) {
      const updated = institutions.map((inst) => {
        if (inst.id === currentInst?.id) {
          return {
            ...inst,
            buildings: inst.buildings.map((bld) => {
              if (bld.id === currentBld.id) {
                return { ...bld, floors: bld.floors.filter((f) => f.id !== floorId) };
              }
              return bld;
            }),
          };
        }
        return inst;
      });
      onUpdateInstitutions(updated);
      const targetBld = updated.find((i) => i.id === currentInst?.id)?.buildings.find((b) => b.id === currentBld.id);
      if (targetBld && targetBld.floors[0]) {
        onSelectFloor(targetBld.floors[0].id);
      }
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#1A3C2B]/40 backdrop-blur-xs select-none">
      <div className="bg-[#F7F7F5] border-2 border-[#1A3C2B] w-full max-w-4xl max-h-[88vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="p-4 bg-[#1A3C2B] text-[#F7F7F5] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4" />
            <span className="font-mono text-xs font-bold uppercase tracking-wider">
              CAMPUS, VÁROS, ÉPÜLET & SZINTSZERKEZET KEZELŐ
            </span>
          </div>
          <button onClick={onClose} className="font-mono text-sm text-[#F7F7F5]/80 hover:text-white">
            ✕
          </button>
        </div>

        <div className="p-5 flex-1 overflow-y-auto flex flex-col gap-6">
          {/* Section 1: Institutions & Cities */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className="font-mono text-xs font-bold text-[#1A3C2B] uppercase">
                1. INTÉZMÉNYEK & VÁROSOK ({institutions.length})
              </span>
              <button
                onClick={() => setShowAddInst(!showAddInst)}
                className="px-2.5 py-1 bg-white border border-[#1A3C2B] text-[#1A3C2B] hover:bg-[#F0F5F2] font-mono text-[10px] flex items-center gap-1 font-bold"
              >
                <Plus className="w-3 h-3" />
                <span>ÚJ VÁROS / CAMPUS HOZZÁADÁSA</span>
              </button>
            </div>

            {/* Add Institution Form */}
            {showAddInst && (
              <div className="p-3 bg-white border border-[#1A3C2B] grid grid-cols-3 gap-2 animate-in fade-in duration-100">
                <input
                  type="text"
                  placeholder="Intézmény neve (pl. Debreceni Egyetem)"
                  value={newInstName}
                  onChange={(e) => setNewInstName(e.target.value)}
                  className="bg-[#F7F7F5] border border-[#D0D0C7] px-2 py-1 text-xs"
                />
                <input
                  type="text"
                  placeholder="Város (pl. Debrecen)"
                  value={newInstCity}
                  onChange={(e) => setNewInstCity(e.target.value)}
                  className="bg-[#F7F7F5] border border-[#D0D0C7] px-2 py-1 text-xs"
                />
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    placeholder="Ország (pl. Magyarország)"
                    value={newInstCountry}
                    onChange={(e) => setNewInstCountry(e.target.value)}
                    className="w-full bg-[#F7F7F5] border border-[#D0D0C7] px-2 py-1 text-xs"
                  />
                  <button
                    onClick={handleAddInstitution}
                    className="px-3 py-1 bg-[#1A3C2B] text-white text-xs font-bold font-mono"
                  >
                    MENTÉS
                  </button>
                </div>
              </div>
            )}

            {/* Institutions Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {institutions.map((inst) => {
                const isActive = inst.id === currentInst?.id;
                const isEditing = editingInstId === inst.id;

                if (isEditing) {
                  return (
                    <div key={inst.id} className="p-3 bg-white border-2 border-[#1A3C2B] flex flex-col gap-2">
                      <span className="font-mono text-[9px] font-bold text-[#1A3C2B] uppercase">CAMPUS SZERKESZTÉSE</span>
                      <input
                        type="text"
                        value={editInstName}
                        onChange={(e) => setEditInstName(e.target.value)}
                        placeholder="Intézmény neve"
                        className="border border-[#1A3C2B] px-2 py-1 text-xs"
                      />
                      <div className="grid grid-cols-2 gap-2">
                        <input
                          type="text"
                          value={editInstCity}
                          onChange={(e) => setEditInstCity(e.target.value)}
                          placeholder="Város"
                          className="border border-[#D0D0C7] px-2 py-1 text-xs"
                        />
                        <input
                          type="text"
                          value={editInstCountry}
                          onChange={(e) => setEditInstCountry(e.target.value)}
                          placeholder="Ország"
                          className="border border-[#D0D0C7] px-2 py-1 text-xs"
                        />
                      </div>
                      <div className="flex justify-end gap-1.5 pt-1">
                        <button
                          onClick={() => setEditingInstId(null)}
                          className="px-2 py-1 border border-[#D0D0C7] text-xs font-mono"
                        >
                          Mégse
                        </button>
                        <button
                          onClick={() => handleSaveEditInstitution(inst.id)}
                          className="px-3 py-1 bg-[#1A3C2B] text-white text-xs font-mono font-bold"
                        >
                          Mentés
                        </button>
                      </div>
                    </div>
                  );
                }

                return (
                  <div
                    key={inst.id}
                    onClick={() => {
                      onSelectInstitution(inst.id);
                      if (inst.buildings[0]) {
                        onSelectBuilding(inst.buildings[0].id);
                        if (inst.buildings[0].floors[0]) {
                          onSelectFloor(inst.buildings[0].floors[0].id);
                        }
                      }
                    }}
                    className={`p-3 border cursor-pointer transition-all flex flex-col justify-between ${
                      isActive
                        ? 'bg-[#1A3C2B] text-white border-[#1A3C2B]'
                        : 'bg-white text-[#1A3C2B] border-[#D0D0C7] hover:border-[#1A3C2B]'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <span className="font-bold text-xs">{inst.name}</span>
                        <span
                          className={`font-mono text-[10px] block mt-0.5 ${
                            isActive ? 'text-white/70' : 'text-[#1A3C2B]/60'
                          }`}
                        >
                          📍 {inst.city}, {inst.country} • {inst.buildings.length} épület
                        </span>
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditingInstId(inst.id);
                            setEditInstName(inst.name);
                            setEditInstCity(inst.city);
                            setEditInstCountry(inst.country);
                          }}
                          className={`p-1 border text-[10px] ${
                            isActive
                              ? 'border-white/40 text-white hover:bg-white/20'
                              : 'border-[#1A3C2B]/30 text-[#1A3C2B] hover:bg-[#F0F5F2]'
                          }`}
                          title="Átnevezés / Szerkesztés"
                        >
                          <Edit2 className="w-3 h-3" />
                        </button>
                        <button
                          onClick={(e) => handleDeleteInstitution(inst.id, e)}
                          className={`p-1 border text-[10px] ${
                            isActive
                              ? 'border-white/40 text-white hover:bg-red-900/60'
                              : 'border-red-300 text-red-700 hover:bg-red-50'
                          }`}
                          title="Campus törlése"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Section 2: Buildings */}
          {currentInst && (
            <div className="flex flex-col gap-2 border-t border-[#1A3C2B]/20 pt-4">
              <div className="flex items-center justify-between">
                <span className="font-mono text-xs font-bold text-[#1A3C2B] uppercase">
                  2. ÉPÜLETEK // {currentInst.name.toUpperCase()} ({currentInst.buildings.length})
                </span>
                <button
                  onClick={() => setShowAddBld(!showAddBld)}
                  className="px-2.5 py-1 bg-white border border-[#1A3C2B] text-[#1A3C2B] hover:bg-[#F0F5F2] font-mono text-[10px] flex items-center gap-1 font-bold"
                >
                  <Plus className="w-3 h-3" />
                  <span>ÚJ ÉPÜLET HOZZÁADÁSA</span>
                </button>
              </div>

              {/* Add Building Form */}
              {showAddBld && (
                <div className="p-3 bg-white border border-[#1A3C2B] grid grid-cols-3 gap-2">
                  <input
                    type="text"
                    placeholder="Épület megnevezése (pl. Kémiai Pavilon)"
                    value={newBldName}
                    onChange={(e) => setNewBldName(e.target.value)}
                    className="bg-[#F7F7F5] border border-[#D0D0C7] px-2 py-1 text-xs col-span-2"
                  />
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      placeholder="Kód (pl. KÉM-A)"
                      value={newBldCode}
                      onChange={(e) => setNewBldCode(e.target.value)}
                      className="w-full bg-[#F7F7F5] border border-[#D0D0C7] px-2 py-1 text-xs"
                    />
                    <button
                      onClick={handleAddBuilding}
                      className="px-3 py-1 bg-[#1A3C2B] text-white text-xs font-bold font-mono"
                    >
                      MENTÉS
                    </button>
                  </div>
                </div>
              )}

              {/* Buildings Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {currentInst.buildings.map((bld) => {
                  const isActive = bld.id === currentBld?.id;
                  const isEditing = editingBldId === bld.id;

                  if (isEditing) {
                    return (
                      <div key={bld.id} className="p-3 bg-white border-2 border-[#1A3C2B] flex flex-col gap-2">
                        <span className="font-mono text-[9px] font-bold text-[#1A3C2B] uppercase">ÉPÜLET SZERKESZTÉSE</span>
                        <input
                          type="text"
                          value={editBldName}
                          onChange={(e) => setEditBldName(e.target.value)}
                          placeholder="Épület neve"
                          className="border border-[#1A3C2B] px-2 py-1 text-xs"
                        />
                        <input
                          type="text"
                          value={editBldCode}
                          onChange={(e) => setEditBldCode(e.target.value)}
                          placeholder="Kód"
                          className="border border-[#D0D0C7] px-2 py-1 text-xs"
                        />
                        <div className="flex justify-end gap-1.5 pt-1">
                          <button
                            onClick={() => setEditingBldId(null)}
                            className="px-2 py-1 border border-[#D0D0C7] text-xs font-mono"
                          >
                            Mégse
                          </button>
                          <button
                            onClick={() => handleSaveEditBuilding(bld.id)}
                            className="px-3 py-1 bg-[#1A3C2B] text-white text-xs font-mono font-bold"
                          >
                            Mentés
                          </button>
                        </div>
                      </div>
                    );
                  }

                  return (
                    <div
                      key={bld.id}
                      onClick={() => {
                        onSelectBuilding(bld.id);
                        if (bld.floors[0]) onSelectFloor(bld.floors[0].id);
                      }}
                      className={`p-3 border cursor-pointer transition-all flex flex-col justify-between ${
                        isActive
                          ? 'bg-[#1A3C2B] text-white border-[#1A3C2B]'
                          : 'bg-white text-[#1A3C2B] border-[#D0D0C7] hover:border-[#1A3C2B]'
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <span className="font-bold text-xs">{bld.name}</span>
                          <span
                            className={`font-mono text-[10px] block mt-0.5 ${
                              isActive ? 'text-white/70' : 'text-[#1A3C2B]/60'
                            }`}
                          >
                            KÓD: {bld.code} • {bld.floors.length} szint
                          </span>
                        </div>
                        <div className="flex items-center gap-1">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setEditingBldId(bld.id);
                              setEditBldName(bld.name);
                              setEditBldCode(bld.code);
                            }}
                            className={`p-1 border text-[10px] ${
                              isActive
                                ? 'border-white/40 text-white hover:bg-white/20'
                                : 'border-[#1A3C2B]/30 text-[#1A3C2B] hover:bg-[#F0F5F2]'
                            }`}
                            title="Átnevezés"
                          >
                            <Edit2 className="w-3 h-3" />
                          </button>
                          <button
                            onClick={(e) => handleDeleteBuilding(bld.id, e)}
                            className={`p-1 border text-[10px] ${
                              isActive
                                ? 'border-white/40 text-white hover:bg-red-900/60'
                                : 'border-red-300 text-red-700 hover:bg-red-50'
                            }`}
                            title="Épület törlése"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Section 3: Floors */}
          {currentBld && (
            <div className="flex flex-col gap-2 border-t border-[#1A3C2B]/20 pt-4">
              <div className="flex items-center justify-between">
                <span className="font-mono text-xs font-bold text-[#1A3C2B] uppercase">
                  3. SZINTEK // {currentBld.name.toUpperCase()} ({currentBld.floors.length})
                </span>
                <button
                  onClick={() => setShowAddFloor(!showAddFloor)}
                  className="px-2.5 py-1 bg-white border border-[#1A3C2B] text-[#1A3C2B] hover:bg-[#F0F5F2] font-mono text-[10px] flex items-center gap-1 font-bold"
                >
                  <Plus className="w-3 h-3" />
                  <span>ÚJ SZINT HOZZÁADÁSA</span>
                </button>
              </div>

              {/* Add Floor Form */}
              {showAddFloor && (
                <div className="p-3 bg-white border border-[#1A3C2B] grid grid-cols-4 gap-2">
                  <input
                    type="text"
                    placeholder="Szint megnevezése"
                    value={newFloorName}
                    onChange={(e) => setNewFloorName(e.target.value)}
                    className="bg-[#F7F7F5] border border-[#D0D0C7] px-2 py-1 text-xs col-span-2"
                  />
                  <input
                    type="text"
                    placeholder="Szint száma (pl. 3)"
                    value={newFloorLevel}
                    onChange={(e) => setNewFloorLevel(e.target.value)}
                    className="bg-[#F7F7F5] border border-[#D0D0C7] px-2 py-1 text-xs"
                  />
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      placeholder="Magasság (m)"
                      value={newFloorElevation}
                      onChange={(e) => setNewFloorElevation(e.target.value)}
                      className="w-full bg-[#F7F7F5] border border-[#D0D0C7] px-2 py-1 text-xs"
                    />
                    <button
                      onClick={handleAddFloor}
                      className="px-3 py-1 bg-[#1A3C2B] text-white text-xs font-bold font-mono"
                    >
                      MENTÉS
                    </button>
                  </div>
                </div>
              )}

              {/* Floors Grid */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                {[...currentBld.floors]
                  .sort((a, b) => {
                    const elevA = a.elevationMeters ?? a.level ?? 0;
                    const elevB = b.elevationMeters ?? b.level ?? 0;
                    if (elevB !== elevA) return elevB - elevA;
                    return (b.level ?? 0) - (a.level ?? 0);
                  })
                  .map((floor) => {
                  const isActive = floor.id === activeFloorId;
                  const isEditing = editingFloorId === floor.id;

                  if (isEditing) {
                    return (
                      <div key={floor.id} className="p-2.5 bg-white border-2 border-[#1A3C2B] flex flex-col gap-1.5">
                        <span className="font-mono text-[9px] font-bold text-[#1A3C2B] uppercase">SZINT SZERKESZTÉSE</span>
                        <input
                          type="text"
                          value={editFloorName}
                          onChange={(e) => setEditFloorName(e.target.value)}
                          placeholder="Szint neve"
                          className="border border-[#1A3C2B] px-1.5 py-0.5 text-xs"
                        />
                        <div className="grid grid-cols-3 gap-1">
                          <input
                            type="text"
                            value={editFloorLevel}
                            onChange={(e) => setEditFloorLevel(e.target.value)}
                            placeholder="Szint #"
                            className="border border-[#D0D0C7] px-1.5 py-0.5 text-xs"
                            title="Szint sorszáma"
                          />
                          <input
                            type="text"
                            value={editFloorShortCode}
                            onChange={(e) => setEditFloorShortCode(e.target.value)}
                            placeholder="Rövid kód"
                            className="border border-[#D0D0C7] px-1.5 py-0.5 text-xs"
                          />
                          <input
                            type="text"
                            value={editFloorElevation}
                            onChange={(e) => setEditFloorElevation(e.target.value)}
                            placeholder="Magasság (m)"
                            className="border border-[#D0D0C7] px-1.5 py-0.5 text-xs"
                          />
                        </div>
                        <div className="flex justify-end gap-1 pt-1">
                          <button
                            onClick={() => setEditingFloorId(null)}
                            className="px-2 py-0.5 border border-[#D0D0C7] text-xs font-mono"
                          >
                            Mégse
                          </button>
                          <button
                            onClick={() => handleSaveEditFloor(floor.id)}
                            className="px-2.5 py-0.5 bg-[#1A3C2B] text-white text-xs font-mono font-bold"
                          >
                            Mentés
                          </button>
                        </div>
                      </div>
                    );
                  }

                  return (
                    <div
                      key={floor.id}
                      onClick={() => onSelectFloor(floor.id)}
                      className={`p-2.5 border cursor-pointer transition-all flex flex-col justify-between ${
                        isActive
                          ? 'bg-[#1A3C2B] text-white border-[#1A3C2B]'
                          : 'bg-white text-[#1A3C2B] border-[#D0D0C7] hover:border-[#1A3C2B]'
                      }`}
                    >
                      <div>
                        <div className="flex items-center justify-between">
                          <span className="font-mono text-xs font-bold px-1 bg-[#1A3C2B]/20">{floor.shortCode}</span>
                          <div className="flex items-center gap-1">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setEditingFloorId(floor.id);
                                setEditFloorName(floor.name);
                                setEditFloorLevel(floor.level.toString());
                                setEditFloorShortCode(floor.shortCode);
                                setEditFloorElevation(floor.elevationMeters.toString());
                              }}
                              className={`p-0.5 border text-[9px] ${
                                isActive ? 'border-white/40 text-white hover:bg-white/20' : 'border-[#1A3C2B]/30 text-[#1A3C2B]'
                              }`}
                              title="Szint átnevezése"
                            >
                              <Edit2 className="w-2.5 h-2.5" />
                            </button>
                            <button
                              onClick={(e) => handleDeleteFloor(floor.id, e)}
                              className={`p-0.5 border text-[9px] ${
                                isActive ? 'border-white/40 text-white hover:bg-red-900/60' : 'border-red-300 text-red-700'
                              }`}
                              title="Szint törlése"
                            >
                              <Trash2 className="w-2.5 h-2.5" />
                            </button>
                          </div>
                        </div>
                        <span className="font-sans font-bold text-xs block truncate mt-1">
                          {floor.name}
                        </span>
                      </div>
                      <span
                        className={`font-mono text-[9px] block mt-1 ${
                          isActive ? 'text-white/70' : 'text-[#1A3C2B]/60'
                        }`}
                      >
                        +{floor.elevationMeters.toFixed(1)}m • {floor.rooms.length} terem
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-3 bg-[#FFFFFF] border-t border-[#1A3C2B] flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-[#1A3C2B] text-white hover:bg-[#2A533E] font-mono text-xs font-bold"
          >
            MENTÉS & BEZÁRÁS
          </button>
        </div>
      </div>
    </div>
  );
};
