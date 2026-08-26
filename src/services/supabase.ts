import { createClient } from '@supabase/supabase-js';
import type { Institution } from '../types';
import { DEFAULT_INSTITUTIONS } from '../data/sampleCampuses';

export const supabaseUrl =
  import.meta.env.VITE_SUPABASE_URL || 'https://njlhiiazxrmensdcuvuy.supabase.co';
export const supabaseAnonKey =
  import.meta.env.VITE_SUPABASE_ANON_KEY ||
  'sb_publishable_Ue1RR56r8fRJAc5aGh0a8w_OZkgVxmh';

// Create Supabase Client
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
});

export const SUPABASE_SQL_SCHEMA = `-- 1. Tábla létrehozása az intézményekhez és CAD alaprajzokhoz
create table if not exists public.institutions (
  id text primary key,
  name text not null,
  type text not null default 'school',
  city text not null,
  country text default 'Magyarország',
  address text default '',
  coordinates jsonb default '{"lat": 46.65, "lng": 20.25}'::jsonb,
  description text default '',
  buildings jsonb not null default '[]'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- 2. Row Level Security (RLS) bekapcsolása és jogosultságok
alter table public.institutions enable row level security;

-- Nyilvános olvasási jogosultság
create policy if not exists "Public Read Access"
  on public.institutions for select
  using (true);

-- Nyilvános mentési és módosítási jogosultság
create policy if not exists "Public Write Access"
  on public.institutions for all
  using (true)
  with check (true);
`;

export type SyncStatus = 'idle' | 'syncing' | 'synced' | 'error' | 'offline';

/**
 * Fetch all institutions from Supabase cloud database
 */
export async function fetchInstitutionsFromCloud(): Promise<Institution[] | null> {
  try {
    const { data, error } = await supabase
      .from('institutions')
      .select('*')
      .order('name');

    if (error) {
      console.warn('[Supabase] Nem sikerült lekérni a felhőből:', error.message);
      return null;
    }

    if (data && data.length > 0) {
      // Map rows to Institution objects
      const institutions: Institution[] = data.map((row) => ({
        id: row.id,
        name: row.name,
        type: row.type || 'school',
        city: row.city,
        country: row.country || 'Magyarország',
        address: row.address || '',
        coordinates: row.coordinates || { lat: 46.65, lng: 20.25 },
        description: row.description || '',
        buildings: Array.isArray(row.buildings) ? row.buildings : [],
      }));
      return institutions;
    }

    return null;
  } catch (err) {
    console.warn('[Supabase] Hálózati hiba a felhő lekérdezésekor:', err);
    return null;
  }
}

/**
 * Save institutions to Supabase cloud database (Upsert)
 */
export async function saveInstitutionsToCloud(
  institutions: Institution[]
): Promise<{ success: boolean; error?: string }> {
  try {
    const rows = institutions.map((inst) => ({
      id: inst.id,
      name: inst.name,
      type: inst.type,
      city: inst.city,
      country: inst.country,
      address: inst.address || '',
      coordinates: inst.coordinates,
      description: inst.description,
      buildings: inst.buildings,
      updated_at: new Date().toISOString(),
    }));

    const { error } = await supabase
      .from('institutions')
      .upsert(rows, { onConflict: 'id' });

    if (error) {
      console.error('[Supabase] Mentési hiba:', error);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (err: any) {
    console.error('[Supabase] Váratlan hiba mentéskor:', err);
    return { success: false, error: err.message || 'Hálózati hiba' };
  }
}

/**
 * Seed initial sample campuses to Supabase if database is empty
 */
export async function seedInitialCampusesToCloud(): Promise<boolean> {
  const result = await saveInstitutionsToCloud(DEFAULT_INSTITUTIONS);
  return result.success;
}

/**
 * Subscribe to realtime changes on institutions table
 */
export function subscribeToCloudChanges(onRemoteUpdate: (institutions: Institution[]) => void) {
  const channel = supabase
    .channel('public:institutions')
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'institutions' },
      async () => {
        const fresh = await fetchInstitutionsFromCloud();
        if (fresh && fresh.length > 0) {
          onRemoteUpdate(fresh);
        }
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}
