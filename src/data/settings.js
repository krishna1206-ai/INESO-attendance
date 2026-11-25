import { db, errorMessage } from '../lib/supabase';
import { invalidate, useRemote } from './remote';

// Company settings set by the admin, stored in Supabase (table `settings`).
// Currently just the office location used to check where attendance was filled in:
//   { id: 'office', name, latitude, longitude, radius, updatedAt }

export const DEFAULT_RADIUS = 200; // metres

const isLat = (n) => Number.isFinite(n) && n >= -90 && n <= 90;
const isLng = (n) => Number.isFinite(n) && n >= -180 && n <= 180;

// Returns an error message, or null when saved.
export async function saveOffice({ name, latitude, longitude, radius }) {
  const lat = Number(String(latitude).trim());
  const lng = Number(String(longitude).trim());
  const r = Number(String(radius).trim());
  if (String(latitude).trim() === '' || !isLat(lat)) return 'Latitude must be a number between -90 and 90.';
  if (String(longitude).trim() === '' || !isLng(lng)) return 'Longitude must be a number between -180 and 180.';
  if (!Number.isFinite(r) || r < 25 || r > 5000) return 'Radius must be between 25 and 5000 metres.';
  const { error } = await db().from('settings').upsert({
    id: 'office',
    name: (name ?? '').trim() || 'Office',
    latitude: lat,
    longitude: lng,
    radius: Math.round(r),
    updated_at: new Date().toISOString(),
  });
  if (error) return errorMessage(error);
  invalidate('settings');
  return null;
}

async function fetchOffice() {
  const { data, error } = await db()
    .from('settings')
    .select('id, name, latitude, longitude, radius, updated_at')
    .eq('id', 'office')
    .maybeSingle();
  if (error) throw error;
  return data
    ? { id: data.id, name: data.name, latitude: data.latitude, longitude: data.longitude, radius: data.radius, updatedAt: data.updated_at }
    : null;
}

// { office, loading }. office is null until the admin sets it.
export function useOffice() {
  const { data, loading } = useRemote('settings:office', fetchOffice, ['settings']);
  return { office: data ?? null, loading };
}
