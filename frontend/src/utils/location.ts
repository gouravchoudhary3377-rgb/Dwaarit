// Dwaarit location utilities — expo-location + OpenStreetMap Nominatim.
// Free (no API key). Adheres to <handle_permissions_contract>.

import * as Location from 'expo-location';
import { Linking, Platform } from 'react-native';

export type Coords = { latitude: number; longitude: number };

export type GeocodedAddress = {
  // Pretty short label for the home header (e.g. "Connaught Place")
  short: string;
  // Full one-line readable address
  full: string;
  // Structured parts (best-effort)
  city?: string;
  state?: string;
  postcode?: string;
  country?: string;
  line1?: string;
  line2?: string;
  // Source coords
  coords: Coords;
};

export type PermissionOutcome =
  | { status: 'granted'; coords: Coords }
  | { status: 'denied'; canAskAgain: boolean }
  | { status: 'unavailable'; reason?: string };

/**
 * Inspect current location permission WITHOUT prompting.
 */
export async function getLocationPermissionStatus() {
  try {
    return await Location.getForegroundPermissionsAsync();
  } catch (e) {
    return null;
  }
}

/**
 * Open the OS app settings so user can manually grant permission.
 */
export async function openAppSettings() {
  try {
    await Linking.openSettings();
  } catch {
    // no-op
  }
}

/**
 * Request foreground location once (contextual, after user intent).
 * Caller is responsible for showing rationale BEFORE calling this.
 */
export async function requestCurrentLocation(): Promise<PermissionOutcome> {
  try {
    const services = await Location.hasServicesEnabledAsync().catch(() => true);
    if (!services) {
      return { status: 'unavailable', reason: 'Location services are turned off on this device.' };
    }
    const perm = await Location.requestForegroundPermissionsAsync();
    if (perm.status !== 'granted') {
      return { status: 'denied', canAskAgain: perm.canAskAgain };
    }
    const pos = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Balanced,
    });
    return {
      status: 'granted',
      coords: { latitude: pos.coords.latitude, longitude: pos.coords.longitude },
    };
  } catch (e: any) {
    return { status: 'unavailable', reason: e?.message ?? 'Could not get location' };
  }
}

/* ----------------------------- Nominatim (free) ---------------------------- */

const NOMINATIM = 'https://nominatim.openstreetmap.org';
// Required by Nominatim usage policy — identify the app.
const UA = 'DwaaritGroceryApp/1.0 (support@dwaarit.app)';

async function nominatim<T>(path: string): Promise<T> {
  const res = await fetch(`${NOMINATIM}${path}`, {
    headers: {
      Accept: 'application/json',
      // RN does not always forward UA, but include where allowed.
      ...(Platform.OS === 'web' ? {} : { 'User-Agent': UA }),
      'Accept-Language': 'en',
    },
  });
  if (!res.ok) throw new Error(`Nominatim ${res.status}`);
  return res.json();
}

function shortLabelFor(addr: any): string {
  if (!addr) return 'Selected location';
  return (
    addr.neighbourhood ||
    addr.suburb ||
    addr.village ||
    addr.town ||
    addr.city_district ||
    addr.city ||
    addr.county ||
    addr.state ||
    'Selected location'
  );
}

function line1For(addr: any): string {
  const parts = [
    addr?.house_number,
    addr?.road,
    addr?.neighbourhood,
  ].filter(Boolean);
  return parts.join(', ');
}

function line2For(addr: any): string {
  const parts = [addr?.suburb, addr?.city_district].filter(Boolean);
  return parts.join(', ');
}

/**
 * Reverse geocode lat/lng → GeocodedAddress via Nominatim.
 */
export async function reverseGeocode(coords: Coords): Promise<GeocodedAddress> {
  const q = `/reverse?format=jsonv2&lat=${coords.latitude}&lon=${coords.longitude}&zoom=18&addressdetails=1`;
  try {
    const data: any = await nominatim(q);
    const a = data.address ?? {};
    return {
      short: shortLabelFor(a),
      full: data.display_name ?? 'Selected location',
      city: a.city || a.town || a.village || a.county,
      state: a.state,
      postcode: a.postcode,
      country: a.country,
      line1: line1For(a),
      line2: line2For(a),
      coords,
    };
  } catch (_e) {
    return {
      short: 'Selected location',
      full: `${coords.latitude.toFixed(4)}, ${coords.longitude.toFixed(4)}`,
      coords,
    };
  }
}

/**
 * Search free-text query → list of suggestions.
 */
export async function searchAddresses(query: string, limit = 8): Promise<GeocodedAddress[]> {
  const q = query.trim();
  if (!q) return [];
  const path = `/search?format=jsonv2&addressdetails=1&limit=${limit}&q=${encodeURIComponent(q)}`;
  try {
    const arr: any[] = await nominatim(path);
    return arr.map((d) => {
      const a = d.address ?? {};
      return {
        short: shortLabelFor(a) || d.display_name?.split(',')[0],
        full: d.display_name,
        city: a.city || a.town || a.village || a.county,
        state: a.state,
        postcode: a.postcode,
        country: a.country,
        line1: line1For(a) || d.display_name?.split(',')[0] || '',
        line2: line2For(a),
        coords: { latitude: Number(d.lat), longitude: Number(d.lon) },
      } as GeocodedAddress;
    });
  } catch (_e) {
    return [];
  }
}
