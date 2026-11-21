import { Platform } from 'react-native';
import * as Location from 'expo-location';

const TIMEOUT_MS = 20000;

// Asks for permission (first time only) and reads the device's current position once.
// Resolves to { location } or { error } with a message the employee can act on.
// location: { latitude, longitude, accuracy (metres, may be null), mocked, capturedAt }
export async function getCurrentLocation() {
  // Browsers only allow location on secure pages (https:// or localhost).
  if (Platform.OS === 'web' && typeof window !== 'undefined' && window.isSecureContext === false) {
    return {
      error:
        'Location only works on a secure (https://) link. Please open the attendance site with https://.',
    };
  }
  try {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      return {
        error:
          'Location permission is needed to fill in attendance. Please allow location for this site/app and try again.',
      };
    }
    if (!(await Location.hasServicesEnabledAsync())) {
      return { error: 'Location is turned off on this device. Please turn it on and try again.' };
    }
    const position = await withTimeout(
      Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High }),
      TIMEOUT_MS
    );
    const { latitude, longitude, accuracy } = position.coords;
    return {
      location: {
        latitude,
        longitude,
        accuracy: accuracy == null ? null : Math.round(accuracy),
        mocked: Boolean(position.mocked),
        capturedAt: new Date(position.timestamp || Date.now()).toISOString(),
      },
    };
  } catch (e) {
    return {
      error:
        e?.message === 'timeout'
          ? 'Could not get your location in time. Move to an open area or check GPS, then try again.'
          : 'Could not get your location. Please check location settings and try again.',
    };
  }
}

function withTimeout(promise, ms) {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), ms)),
  ]);
}

// Great-circle distance in metres between two { latitude, longitude } points.
export function distanceMeters(a, b) {
  const R = 6371000;
  const rad = (d) => (d * Math.PI) / 180;
  const dLat = rad(b.latitude - a.latitude);
  const dLon = rad(b.longitude - a.longitude);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(a.latitude)) * Math.cos(rad(b.latitude)) * Math.sin(dLon / 2) ** 2;
  return Math.round(2 * R * Math.asin(Math.sqrt(h)));
}

export const formatDistance = (m) => (m < 1000 ? `${m} m` : `${(m / 1000).toFixed(m < 10000 ? 1 : 0)} km`);

export const mapUrl = ({ latitude, longitude }) =>
  `https://www.google.com/maps?q=${latitude.toFixed(6)},${longitude.toFixed(6)}`;

// Where was this location relative to the office?
// Returns { kind: 'office' | 'outside' | 'unknown' | 'none', distance?, label }.
// 'unknown' = no office location configured yet.
export function classifyLocation(location, office) {
  if (!location) return { kind: 'none', label: 'No location' };
  if (!office) return { kind: 'unknown', label: 'Office not set' };
  const distance = distanceMeters(location, office);
  // Allow for GPS error: a fix whose accuracy circle reaches the office radius counts as inside.
  const slack = Math.min(location.accuracy ?? 0, 100);
  if (distance <= office.radius + slack) return { kind: 'office', distance, label: 'At office' };
  return { kind: 'outside', distance, label: `Outside office · ${formatDistance(distance)}` };
}
