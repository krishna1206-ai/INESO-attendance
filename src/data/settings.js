import { createPersistentList } from './store';

// Company settings set by the admin, stored on this device (see store.js).
// Currently just the office location used to check where attendance was filled in.
// Stored as a one-item list: [{ id: 'office', name, latitude, longitude, radius, updatedAt }]
const store = createPersistentList('ineos.settings.v1');

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
  const list = await store.get();
  return store.save([
    ...list.filter((s) => s.id !== 'office'),
    {
      id: 'office',
      name: (name ?? '').trim() || 'Office',
      latitude: lat,
      longitude: lng,
      radius: Math.round(r),
      updatedAt: new Date().toISOString(),
    },
  ]);
}

// { office, loading }. office is null until the admin sets it.
export function useOffice() {
  const { items, loading } = store.useList();
  return { office: items.find((s) => s.id === 'office') ?? null, loading };
}
