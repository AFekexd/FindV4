import type { Institution } from '../types';
import { DEFAULT_INSTITUTIONS } from '../data/sampleCampuses';

const STORAGE_KEY = 'POLLAKFIND_institutions_hu_v2';
const SELECTED_INSTITUTION_KEY = 'POLLAKFIND_active_institution_id_hu';
const SELECTED_BUILDING_KEY = 'POLLAKFIND_active_building_id_hu';
const SELECTED_FLOOR_KEY = 'POLLAKFIND_active_floor_id_hu';

export function loadInstitutions(): Institution[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch (err) {
    console.error('Nem sikerült betölteni az intézményeket a helyi tárolóból:', err);
  }
  // Save default data initially
  saveInstitutions(DEFAULT_INSTITUTIONS);
  return DEFAULT_INSTITUTIONS;
}

export function saveInstitutions(institutions: Institution[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(institutions));
  } catch (err) {
    console.error('Nem sikerült elmenteni az intézményeket a helyi tárolóba:', err);
  }
}

export function resetToDefaults(): Institution[] {
  saveInstitutions(DEFAULT_INSTITUTIONS);
  return DEFAULT_INSTITUTIONS;
}

export function exportInstitutionsJSON(institutions: Institution[]): void {
  const jsonStr = JSON.stringify(institutions, null, 2);
  const blob = new Blob([jsonStr], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `POLLAKFIND-cad-adatbazis-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

export function importInstitutionsFromJSON(
  file: File,
  onSuccess: (data: Institution[]) => void,
  onError: (err: string) => void
): void {
  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const text = e.target?.result as string;
      const parsed = JSON.parse(text);
      if (Array.isArray(parsed) && parsed.length > 0 && parsed[0].buildings) {
        saveInstitutions(parsed);
        onSuccess(parsed);
      } else {
        onError('Érvénytelen fájlformátum: Az importált JSON nem felel meg az intézményi adatmodellnek.');
      }
    } catch (err: any) {
      onError(`Hiba történt a JSON feldolgozásakor: ${err.message}`);
    }
  };
  reader.onerror = () => onError('A fájl olvasása sikertelen.');
  reader.readAsText(file);
}

export function getSavedActiveState(): {
  institutionId?: string;
  buildingId?: string;
  floorId?: string;
} {
  return {
    institutionId: localStorage.getItem(SELECTED_INSTITUTION_KEY) || undefined,
    buildingId: localStorage.getItem(SELECTED_BUILDING_KEY) || undefined,
    floorId: localStorage.getItem(SELECTED_FLOOR_KEY) || undefined,
  };
}

export function saveActiveState(
  institutionId: string,
  buildingId: string,
  floorId: string
): void {
  try {
    localStorage.setItem(SELECTED_INSTITUTION_KEY, institutionId);
    localStorage.setItem(SELECTED_BUILDING_KEY, buildingId);
    localStorage.setItem(SELECTED_FLOOR_KEY, floorId);
  } catch (e) {
    // Ignore storage quota errors
  }
}
