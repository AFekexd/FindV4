import React, { useRef } from 'react';
import type { Institution, Building, Floor, AppMode } from '../../types';
import type { UserProfile } from '../../auth/keycloak';
import {
  Compass,
  Navigation,
  Edit3,
  Monitor,
  Search,
  Download,
  Upload,
  RotateCcw,
  Layers,
  Building2,
  MapPin,
  ChevronDown,
  Sparkles,
  Box,
  Printer,
  User,
  LogOut,
  LogIn,
  Lock,
  Cloud,
} from 'lucide-react';
import { exportInstitutionsJSON, importInstitutionsFromJSON } from '../../utils/storage';
import type { SyncStatus } from '../../services/supabase';

interface HeaderProps {
  institutions: Institution[];
  activeInstitution: Institution;
  activeBuilding: Building;
  activeFloor: Floor;
  appMode: AppMode;
  isAuthenticated: boolean;
  user: UserProfile | null;
  syncStatus?: SyncStatus;
  onLogin: () => void;
  onLogout: () => void;
  onRequireAuth: (actionTitle?: string) => void;
  onSelectInstitution: (id: string) => void;
  onSelectBuilding: (id: string) => void;
  onSelectFloor: (id: string) => void;
  onSetAppMode: (mode: AppMode) => void;
  onOpenDirectory: () => void;
  onOpenFloorManager: () => void;
  onOpenExportModal?: () => void;
  onOpenCloudModal?: () => void;
  onResetData: () => void;
  onDataImported: (data: Institution[]) => void;
}

export const Header: React.FC<HeaderProps> = ({
  institutions,
  activeInstitution,
  activeBuilding,
  activeFloor,
  appMode,
  isAuthenticated,
  user,
  syncStatus = 'synced',
  onLogin,
  onLogout,
  onRequireAuth,
  onSelectInstitution,
  onSelectBuilding,
  onSelectFloor,
  onSetAppMode,
  onOpenDirectory,
  onOpenFloorManager,
  onOpenExportModal,
  onOpenCloudModal,
  onResetData,
  onDataImported,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImportClick = () => {
    if (!isAuthenticated) {
      onRequireAuth('Adatbázis Importálása');
      return;
    }
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      importInstitutionsFromJSON(
        file,
        (data) => onDataImported(data),
        (err) => alert(err)
      );
    }
  };

  const handleStudioClick = () => {
    if (!isAuthenticated) {
      onRequireAuth('CAD Stúdió & Alaprajz Szerkesztés');
      return;
    }
    onSetAppMode('studio');
  };

  const handleFloorManagerClick = () => {
    if (!isAuthenticated) {
      onRequireAuth('Campus, Épület és Szintszerkezet Menedzser');
      return;
    }
    onOpenFloorManager();
  };

  return (
    <header className="bg-[#FFFFFF] border-b border-[#1A3C2B] select-none z-30">
      {/* Hidden File Input for Data Import */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".json"
        onChange={handleFileChange}
        className="hidden"
      />

      {/* Top Bento Header Bar */}
      <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between px-4 py-2.5 gap-3">
        {/* Brand & Project Identity */}
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-[#1A3C2B] text-[#F7F7F5] flex items-center justify-center border border-[#1A3C2B]">
            <Compass className="w-5 h-5 stroke-[1.8]" />
          </div>
          <div className="flex flex-col">
            <div className="flex items-center gap-2">
              <span className="font-mono text-sm font-black tracking-wider text-[#1A3C2B]">
                POLLAKFIND
              </span>
              <span className="font-mono text-[9px] px-1.5 py-0.2 bg-[#1A3C2B] text-white font-bold tracking-widest uppercase">
                CAD // V4
              </span>
            </div>
            <span className="font-mono text-[9px] text-[#1A3C2B]/70 tracking-tight">
              TÖBBSZINTES CAMPUS ALAPRAJZ & ÚTVONALTERVEZŐ
            </span>
          </div>
        </div>

        {/* Institution & Building Selectors */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Institution Picker */}
          <div className="flex items-center bg-[#F7F7F5] border border-[#1A3C2B] px-2 py-1">
            <MapPin className="w-3.5 h-3.5 text-[#1A3C2B] mr-1.5 flex-shrink-0" />
            <select
              value={activeInstitution.id}
              onChange={(e) => onSelectInstitution(e.target.value)}
              className="bg-transparent font-sans text-xs font-bold text-[#1A3C2B] focus:outline-none cursor-pointer pr-2"
            >
              {institutions.map((inst) => (
                <option key={inst.id} value={inst.id}>
                  {inst.name} ({inst.city})
                </option>
              ))}
            </select>
          </div>

          {/* Building Picker */}
          <div className="flex items-center bg-[#F7F7F5] border border-[#1A3C2B] px-2 py-1">
            <Building2 className="w-3.5 h-3.5 text-[#1A3C2B] mr-1.5 flex-shrink-0" />
            <select
              value={activeBuilding.id}
              onChange={(e) => onSelectBuilding(e.target.value)}
              className="bg-transparent font-sans text-xs font-bold text-[#1A3C2B] focus:outline-none cursor-pointer pr-2"
            >
              {activeInstitution.buildings.map((bld) => (
                <option key={bld.id} value={bld.id}>
                  {bld.name}
                </option>
              ))}
            </select>
          </div>

          {/* Floor Level Quick Pills */}
          <div className="flex items-center border border-[#1A3C2B] bg-[#F7F7F5] p-0.5">
            {activeBuilding.floors.map((floor) => {
              const isActive = floor.id === activeFloor.id;
              return (
                <button
                  key={floor.id}
                  onClick={() => onSelectFloor(floor.id)}
                  className={`px-2 py-1 font-mono text-[10px] font-bold transition-colors ${
                    isActive
                      ? 'bg-[#1A3C2B] text-[#F7F7F5]'
                      : 'text-[#1A3C2B] hover:bg-[#EFEFEA]'
                  }`}
                  title={`${floor.name} (+${floor.elevationMeters}m)`}
                >
                  {floor.shortCode}
                </button>
              );
            })}
          </div>

          {/* Hierarchy Manager Button */}
          <button
            onClick={handleFloorManagerClick}
            className="p-1.5 border border-[#1A3C2B] bg-[#F7F7F5] hover:bg-[#1A3C2B] hover:text-white transition-colors"
            title="Campusok, épületek és szintek kezelése / átnevezése (Bejelentkezéshez kötött)"
          >
            <Layers className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Mode Switcher & User Auth Strip */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Mode Switcher */}
          <div className="flex items-center border border-[#1A3C2B] bg-[#F7F7F5] p-0.5">
            <button
              onClick={() => onSetAppMode('wayfinder')}
              className={`px-2.5 py-1 font-mono text-xs font-bold flex items-center gap-1.5 transition-colors ${
                appMode === 'wayfinder'
                  ? 'bg-[#1A3C2B] text-[#F7F7F5]'
                  : 'text-[#1A3C2B] hover:bg-[#EFEFEA]'
              }`}
            >
              <Navigation className="w-3.5 h-3.5" />
              <span>ÚTVONAL</span>
            </button>

            <button
              onClick={handleStudioClick}
              className={`px-2.5 py-1 font-mono text-xs font-bold flex items-center gap-1.5 transition-colors ${
                appMode === 'studio'
                  ? 'bg-[#1A3C2B] text-[#F7F7F5]'
                  : 'text-[#1A3C2B] hover:bg-[#EFEFEA]'
              }`}
            >
              <Edit3 className="w-3.5 h-3.5" />
              <span>CAD STÚDIÓ</span>
              {!isAuthenticated && <Lock className="w-2.5 h-2.5 opacity-60 ml-0.5" />}
            </button>

            <button
              onClick={() => onSetAppMode('3d')}
              className={`px-2.5 py-1 font-mono text-xs font-bold flex items-center gap-1.5 transition-colors ${
                appMode === '3d'
                  ? 'bg-[#1A3C2B] text-[#F7F7F5]'
                  : 'text-[#1A3C2B] hover:bg-[#EFEFEA]'
              }`}
              title="3D izometrikus szint-halom és vertikális aknák nézete"
            >
              <Box className="w-3.5 h-3.5" />
              <span>3D NÉZET</span>
            </button>

            <button
              onClick={() => onSetAppMode('kiosk')}
              className={`px-2.5 py-1 font-mono text-xs font-bold flex items-center gap-1.5 transition-colors ${
                appMode === 'kiosk'
                  ? 'bg-[#1A3C2B] text-[#F7F7F5]'
                  : 'text-[#1A3C2B] hover:bg-[#EFEFEA]'
              }`}
              title="Aula érintőképernyős kioszk mód"
            >
              <Monitor className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">KIOSZK</span>
            </button>
          </div>

          {/* Directory Shortcut Button */}
          <button
            onClick={onOpenDirectory}
            className="px-2.5 py-1.5 border border-[#1A3C2B] bg-[#FFFFFF] hover:bg-[#1A3C2B] hover:text-[#F7F7F5] text-[#1A3C2B] font-mono text-xs font-bold flex items-center gap-1.5 transition-colors"
            title="Keresés a helyiség névtárban (⌘K)"
          >
            <Search className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">NÉVTÁR</span>
          </button>

          {/* Printable Sheet Export Button */}
          {onOpenExportModal && (
            <button
              onClick={onOpenExportModal}
              className="p-1.5 border border-[#1A3C2B] bg-white hover:bg-[#F0F5F2] text-[#1A3C2B] transition-colors"
              title="Tervlap nyomtatás és SVG export"
            >
              <Printer className="w-3.5 h-3.5" />
            </button>
          )}

          {/* Supabase Cloud Sync Button */}
          {onOpenCloudModal && (
            <button
              onClick={onOpenCloudModal}
              className="px-2 py-1 border border-[#1A3C2B] bg-white hover:bg-[#F0F5F2] text-[#1A3C2B] font-mono text-xs font-bold flex items-center gap-1.5 transition-colors shadow-xs"
              title="Supabase Felhő Adatbázis & Szinkronizálás"
            >
              <Cloud
                className={`w-3.5 h-3.5 ${
                  syncStatus === 'synced'
                    ? 'text-emerald-700'
                    : syncStatus === 'syncing'
                    ? 'text-amber-500 animate-spin'
                    : syncStatus === 'error'
                    ? 'text-red-600'
                    : 'text-[#1A3C2B]'
                }`}
              />
              <span className="hidden sm:inline">
                {syncStatus === 'syncing'
                  ? 'MENTÉS...'
                  : syncStatus === 'synced'
                  ? 'FELHŐBEN'
                  : syncStatus === 'error'
                  ? 'FELHŐ HIBA'
                  : 'SUPABASE'}
              </span>
            </button>
          )}

          {/* Keycloak Auth Badge / Button */}
          {isAuthenticated && user ? (
            <div className="flex items-center gap-1.5 bg-[#F7F7F5] border border-[#1A3C2B] px-2 py-1 font-mono text-xs">
              <div className="w-2 h-2 rounded-full bg-emerald-600 animate-pulse" />
              <span className="font-bold text-[11px] max-w-[100px] truncate" title={user.name}>
                {user.username}
              </span>
              <button
                onClick={onLogout}
                className="p-0.5 hover:text-red-700 ml-1 transition-colors"
                title="Kijelentkezés a Pollák SSO-ból"
              >
                <LogOut className="w-3 h-3" />
              </button>
            </div>
          ) : (
            <button
              onClick={onLogin}
              className="px-2.5 py-1.5 bg-[#1A3C2B] text-white hover:bg-[#2A533E] font-mono text-xs font-bold flex items-center gap-1.5 transition-colors"
              title="Bejelentkezés Pollák Keycloak fiókkal"
            >
              <LogIn className="w-3 h-3" />
              <span>BELÉPÉS</span>
            </button>
          )}

          {/* Export & Import Utilities */}
          <div className="flex items-center gap-1">
            <button
              onClick={() => exportInstitutionsJSON(institutions)}
              className="p-1.5 border border-[#1A3C2B] bg-white hover:bg-[#F0F5F2] text-[#1A3C2B] transition-colors"
              title="Adatbázis exportálása (JSON)"
            >
              <Download className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={handleImportClick}
              className="p-1.5 border border-[#1A3C2B] bg-white hover:bg-[#F0F5F2] text-[#1A3C2B] transition-colors"
              title="Adatbázis importálása (JSON)"
            >
              <Upload className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => {
                if (confirm('Visszaállítja az összes alaprajzot és szintet a beépített egyetemi sablonokra?')) {
                  onResetData();
                }
              }}
              className="p-1.5 border border-[#1A3C2B] bg-white hover:bg-[#F0F5F2] text-[#1A3C2B] transition-colors"
              title="Alapértelmezett campusok visszaállítása"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </header>
  );
};
