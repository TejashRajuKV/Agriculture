// Great-circle distance in km between two { lat, lng } points (haversine)
export const distanceKm = (a, b) => {
  if (!a || !b || a.lat == null || a.lng == null || b.lat == null || b.lng == null) return null;
  const R = 6371;
  const rad = (d) => (d * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
};

// Best-effort place lookup with the free Open-Meteo geocoder (same one the Weather screen uses).
// Returns null on any failure - callers must work without coordinates.
export const geocodePlace = async (place) => {
  if (!place || process.env.DISABLE_GEOCODING === '1') return null;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 3000);
  try {
    const name = String(place).split(',')[0].trim();
    const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(name)}&count=5&language=en&format=json&countryCode=IN`;
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) return null;
    const { results = [] } = await res.json();
    const state = String(place).split(',')[1]?.trim().toLowerCase();
    const hit = results.find((r) => state && r.admin1?.toLowerCase() === state) || results[0];
    return hit ? { lat: hit.latitude, lng: hit.longitude } : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
};
