import React, { useState } from 'react';
import {
  Cloud,
  CloudCheck,
  CloudAlert,
  Database,
  RefreshCw,
  Copy,
  Check,
  UploadCloud,
  DownloadCloud,
  Layers,
  Sparkles,
  X,
  ExternalLink,
} from 'lucide-react';
import {
  supabaseUrl,
  SUPABASE_SQL_SCHEMA,
  SyncStatus,
  saveInstitutionsToCloud,
  fetchInstitutionsFromCloud,
  seedInitialCampusesToCloud,
} from '../../services/supabase';
import type { Institution } from '../../types';

interface CloudSyncModalProps {
  isOpen: boolean;
  onClose: () => void;
  institutions: Institution[];
  syncStatus: SyncStatus;
  onUpdateInstitutions: (data: Institution[]) => void;
  onSetSyncStatus: (status: SyncStatus) => void;
}

export const CloudSyncModal: React.FC<CloudSyncModalProps> = ({
  isOpen,
  onClose,
  institutions,
  syncStatus,
  onUpdateInstitutions,
  onSetSyncStatus,
}) => {
  const [copiedSql, setCopiedSql] = useState(false);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  if (!isOpen) return null;

  const handleCopySql = () => {
    navigator.clipboard.writeText(SUPABASE_SQL_SCHEMA);
    setCopiedSql(true);
    setTimeout(() => setCopiedSql(false), 2500);
  };

  const handlePushToCloud = async () => {
    setIsLoading(true);
    setActionMessage('Adatok feltöltése a Supabase adatbázisba...');
    onSetSyncStatus('syncing');

    const res = await saveInstitutionsToCloud(institutions);
    setIsLoading(false);

    if (res.success) {
      onSetSyncStatus('synced');
      setActionMessage('✓ Az összes intézmény és tervrajz sikeresen elmentve a Supabase felhőbe!');
    } else {
      onSetSyncStatus('error');
      setActionMessage(`✗ Hiba a mentéskor: ${res.error}. Ha a tábla még nem létezik, futtassa le az alábbi SQL sémát a Supabase SQL Editorban!`);
    }
  };

  const handlePullFromCloud = async () => {
    setIsLoading(true);
    setActionMessage('Legfrissebb adatok letöltése a felhőből...');
    onSetSyncStatus('syncing');

    const fresh = await fetchInstitutionsFromCloud();
    setIsLoading(false);

    if (fresh && fresh.length > 0) {
      onUpdateInstitutions(fresh);
      onSetSyncStatus('synced');
      setActionMessage(`✓ Sikeres letöltés: ${fresh.length} db intézmény betöltve a felhőből!`);
    } else {
      onSetSyncStatus('error');
      setActionMessage('✗ Nem találhatók adatok a felhőben vagy hiba történt a lekérdezéskor.');
    }
  };

  const handleSeedDefaults = async () => {
    setIsLoading(true);
    setActionMessage('Alapértelmezett egyetemi/iskolai adatok feltöltése...');
    onSetSyncStatus('syncing');

    const ok = await seedInitialCampusesToCloud();
    setIsLoading(false);

    if (ok) {
      onSetSyncStatus('synced');
      setActionMessage('✓ Pollák & BME mintaintézmények sikeresen inicializálva a felhőben!');
      const fresh = await fetchInstitutionsFromCloud();
      if (fresh) onUpdateInstitutions(fresh);
    } else {
      onSetSyncStatus('error');
      setActionMessage('✗ Nem sikerült az adatok inicializálása. Ellenőrizze a tábla jogosultságait!');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#1A3C2B]/40 backdrop-blur-xs select-none">
      <div className="bg-[#F7F7F5] border-2 border-[#1A3C2B] w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl font-sans text-[#1A3C2B] animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="p-3.5 bg-[#1A3C2B] text-[#F7F7F5] flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-2">
            <Database className="w-5 h-5 text-emerald-400" />
            <span className="font-bold text-sm tracking-wide">SUPABASE FELHŐ ADATBÁZIS</span>
          </div>
          <button onClick={onClose} className="text-[#F7F7F5]/80 hover:text-white font-mono text-sm px-1.5">
            ✕
          </button>
        </div>

        {/* Body */}
        <div className="p-5 flex-1 overflow-y-auto flex flex-col gap-4 font-mono text-xs">
          {/* Connection Status Box */}
          <div className="bg-white border border-[#1A3C2B] p-3 flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-[10px] uppercase font-bold text-[#1A3C2B]/70">PROJEKT URL:</span>
                <span className="font-bold text-xs text-[#1A3C2B]">{supabaseUrl}</span>
              </div>
              <div className="flex items-center gap-1.5 px-2 py-0.5 border text-[10px] font-bold bg-[#F0F5F2] text-[#1A3C2B]">
                <span
                  className={`w-2 h-2 rounded-full ${
                    syncStatus === 'synced'
                      ? 'bg-emerald-600 animate-pulse'
                      : syncStatus === 'syncing'
                      ? 'bg-amber-500 animate-spin'
                      : syncStatus === 'error'
                      ? 'bg-red-600'
                      : 'bg-emerald-600'
                  }`}
                />
                <span>
                  {syncStatus === 'synced'
                    ? 'SZINKRONIZÁLVA'
                    : syncStatus === 'syncing'
                    ? 'SZINKRONIZÁLÁS...'
                    : syncStatus === 'error'
                    ? 'SZÜKSÉGES SÉMA'
                    : 'KAPCSOLÓDVA'}
                </span>
              </div>
            </div>

            <div className="flex items-center justify-between text-[11px] text-[#1A3C2B]/80 pt-1 border-t border-[#1A3C2B]/10">
              <span>Helyi adatállomány: <b>{institutions.length} db intézmény</b></span>
              <span>
                Összes épület: <b>{institutions.reduce((acc, i) => acc + i.buildings.length, 0)} db</b>
              </span>
            </div>
          </div>

          {/* Action Notification Message */}
          {actionMessage && (
            <div className={`p-3 border text-xs font-mono flex items-start gap-2 ${
              actionMessage.startsWith('✓')
                ? 'bg-emerald-50 border-emerald-600 text-emerald-900'
                : actionMessage.startsWith('✗')
                ? 'bg-red-50 border-red-600 text-red-900'
                : 'bg-amber-50 border-amber-600 text-amber-900'
            }`}>
              <span className="font-bold flex-1">{actionMessage}</span>
              <button onClick={() => setActionMessage(null)} className="opacity-60 hover:opacity-100">✕</button>
            </div>
          )}

          {/* Action Buttons */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <button
              onClick={handlePushToCloud}
              disabled={isLoading}
              className="p-2.5 bg-[#1A3C2B] text-white hover:bg-[#2A533E] disabled:opacity-50 font-mono text-xs font-bold flex flex-col items-center justify-center gap-1 text-center shadow-xs"
            >
              <UploadCloud className="w-4 h-4" />
              <span>MENTÉS FELHŐBE</span>
              <span className="text-[9px] font-normal opacity-75">Helyi adatok feltöltése</span>
            </button>

            <button
              onClick={handlePullFromCloud}
              disabled={isLoading}
              className="p-2.5 bg-white border border-[#1A3C2B] hover:bg-[#F0F5F2] disabled:opacity-50 font-mono text-xs font-bold flex flex-col items-center justify-center gap-1 text-center text-[#1A3C2B]"
            >
              <DownloadCloud className="w-4 h-4" />
              <span>FRISSÍTÉS FELHŐBŐL</span>
              <span className="text-[9px] font-normal text-[#1A3C2B]/70">Letöltés a Supabase-ről</span>
            </button>

            <button
              onClick={handleSeedDefaults}
              disabled={isLoading}
              className="p-2.5 bg-white border border-[#1A3C2B] hover:bg-[#F0F5F2] disabled:opacity-50 font-mono text-xs font-bold flex flex-col items-center justify-center gap-1 text-center text-[#1A3C2B]"
            >
              <Sparkles className="w-4 h-4 text-emerald-700" />
              <span>MINTA ADATOK (SEED)</span>
              <span className="text-[9px] font-normal text-[#1A3C2B]/70">Pollák & BME feltöltése</span>
            </button>
          </div>

  
        </div>

        {/* Footer */}
        <div className="p-3 bg-[#EFEFEA] border-t border-[#1A3C2B]/20 flex items-center justify-between text-xs">
          <span className="text-[10px] text-[#1A3C2B]/70 font-mono">
            Automatikus felhő szinkronizálás aktív
          </span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-[#1A3C2B] text-white hover:bg-[#2A533E] font-mono text-xs font-bold"
          >
            BEZÁRÁS
          </button>
        </div>
      </div>
    </div>
  );
};
