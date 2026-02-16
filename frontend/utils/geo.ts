export type LatLng = { lat: number; lng: number };

export const CITY_FALLBACK_COORDS: Record<string, LatLng> = {
  ljubljana: { lat: 46.0569, lng: 14.5058 },
  maribor: { lat: 46.5547, lng: 15.6459 },
  celje: { lat: 46.2397, lng: 15.2677 },
  kranj: { lat: 46.2389, lng: 14.3555 },
  koper: { lat: 45.5481, lng: 13.7301 },
  "novo mesto": { lat: 45.8011, lng: 15.1691 },
  ptuj: { lat: 46.4203, lng: 15.8697 },
  "murska sobota": { lat: 46.6611, lng: 16.1664 },
  slovenia: { lat: 46.1512, lng: 14.9955 },
};

export function normalizeCityKey(city?: string | null): string {
  return (city ?? "").trim().toLowerCase().replace(/\s+/g, " ");
}

export function coordsForCity(city?: string | null): LatLng | null {
  const key = normalizeCityKey(city);
  return key && CITY_FALLBACK_COORDS[key] ? CITY_FALLBACK_COORDS[key] : null;
}

function toFiniteNumber(value: unknown): number {
  if (typeof value === "number") return Number.isFinite(value) ? value : NaN;
  if (typeof value === "string") {
    const parsed = parseFloat(value);
    return Number.isFinite(parsed) ? parsed : NaN;
  }
  return NaN;
}

export function resolveEventCoords(event: { city?: string | null; lat?: unknown; lng?: unknown }): LatLng | null {
  const lat = toFiniteNumber(event.lat);
  const lng = toFiniteNumber(event.lng);
  if (Number.isFinite(lat) && Number.isFinite(lng)) return { lat, lng };

  const cityCoords = coordsForCity(event.city);
  if (cityCoords) return cityCoords;

  return null;
}
