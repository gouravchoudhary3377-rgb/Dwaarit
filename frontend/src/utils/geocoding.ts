/**
 * Nominatim (OpenStreetMap) — free reverse + forward geocoding.
 * Policy: https://operations.osmfoundation.org/policies/nominatim/
 *   - Identify with a User-Agent (added on native; browsers manage this themselves)
 *   - Max 1 request per second (we debounce on caller side)
 *   - No heavy bulk usage
 */
import { Platform } from 'react-native';

const NOMINATIM_BASE = 'https://nominatim.openstreetmap.org';
const USER_AGENT = 'Flynkit/1.0 (grocery delivery app)';

export type NominatimAddress = {
  house_number?: string;
  road?: string;
  neighbourhood?: string;
  suburb?: string;
  village?: string;
  town?: string;
  city?: string;
  state_district?: string;
  state?: string;
  postcode?: string;
  country?: string;
  country_code?: string;
};

export type GeocodeResult = {
  displayName: string;
  lat: number;
  lng: number;
  line1: string;
  line2: string;
  city: string;
  pincode: string;
  state?: string;
  country?: string;
};

function pickCity(a: NominatimAddress): string {
  return a.city || a.town || a.village || a.suburb || a.state_district || '';
}

function buildLine1(a: NominatimAddress): string {
  const parts = [a.house_number, a.road, a.neighbourhood].filter(Boolean);
  return parts.join(', ');
}

function buildLine2(a: NominatimAddress): string {
  const parts = [a.suburb, a.state].filter(Boolean);
  return parts.join(', ');
}

function buildHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    Accept: 'application/json',
    'Accept-Language': 'en',
  };
  // Browsers reject custom User-Agent; only set on native.
  if (Platform.OS !== 'web') {
    headers['User-Agent'] = USER_AGENT;
  }
  return headers;
}

function normalize(raw: any): GeocodeResult {
  const a: NominatimAddress = raw.address || {};
  const line1 = buildLine1(a) || (raw.display_name?.split(',')[0] ?? '');
  return {
    displayName: raw.display_name ?? '',
    lat: parseFloat(raw.lat),
    lng: parseFloat(raw.lon),
    line1,
    line2: buildLine2(a),
    city: pickCity(a),
    pincode: a.postcode ?? '',
    state: a.state,
    country: a.country,
  };
}

export async function reverseGeocode(lat: number, lng: number): Promise<GeocodeResult> {
  const url = `${NOMINATIM_BASE}/reverse?format=jsonv2&lat=${lat}&lon=${lng}&addressdetails=1`;
  const res = await fetch(url, { headers: buildHeaders() });
  if (!res.ok) throw new Error(`Reverse geocode failed (${res.status})`);
  const data = await res.json();
  return normalize(data);
}

export async function searchAddresses(query: string, limit = 6): Promise<GeocodeResult[]> {
  const q = query.trim();
  if (q.length < 3) return [];
  const url = `${NOMINATIM_BASE}/search?format=jsonv2&q=${encodeURIComponent(
    q,
  )}&addressdetails=1&limit=${limit}`;
  const res = await fetch(url, { headers: buildHeaders() });
  if (!res.ok) throw new Error(`Search failed (${res.status})`);
  const data = (await res.json()) as any[];
  return data.map(normalize);
}
