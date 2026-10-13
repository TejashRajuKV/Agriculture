import { badRequest } from '../utils/httpError.js';

// Live daily mandi prices from the Government of India open-data API (AGMARKNET feed on data.gov.in).
// Needs a free key in DATA_GOV_API_KEY. Without one this service says so plainly and the app keeps
// using the bundled CSV. The field names below follow the published resource but have not been
// checked against a live key from this project, so treat a changed response as "unavailable", not as zero.
const RESOURCE_ID = '9ef84268-d588-465a-a308-a864a43d0070';
const BASE_URL = `https://api.data.gov.in/resource/${RESOURCE_ID}`;
const CACHE_MS = 30 * 60 * 1000;
const TIMEOUT_MS = 8000;

const cache = new Map();
export const clearMandiCache = () => cache.clear();

export const isConfigured = () => Boolean(process.env.DATA_GOV_API_KEY);

const num = (x) => {
  const n = Number(x);
  return Number.isFinite(n) ? n : null;
};

// 'dd/MM/yyyy' -> 'YYYY-MM-DD'
const isoDate = (s) => {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(String(s || ''));
  return m ? `${m[3]}-${m[2]}-${m[1]}` : null;
};

export const normalizeRecord = (r) => ({
  state: r.state,
  district: r.district,
  market: r.market,
  commodity: r.commodity,
  variety: r.variety || null,
  date: isoDate(r.arrival_date),
  minPerQuintal: num(r.min_price),
  maxPerQuintal: num(r.max_price),
  modalPerQuintal: num(r.modal_price)
});

export const status = () => ({
  configured: isConfigured(),
  source: 'data.gov.in (AGMARKNET)',
  message: isConfigured() ? 'Live prices enabled' : 'Live mandi prices are off. Add a free DATA_GOV_API_KEY to the server .env to enable them.'
});

export const getMandiPrices = async ({ state, district, commodity } = {}) => {
  if (!isConfigured()) return { live: false, reason: 'NO_KEY', ...status(), records: [] };
  if (!commodity) throw badRequest('Choose a crop');
  const key = JSON.stringify([state, district, commodity]);
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_MS) return { ...hit.value, cached: true };

  const url = new URL(BASE_URL);
  url.searchParams.set('api-key', process.env.DATA_GOV_API_KEY);
  url.searchParams.set('format', 'json');
  url.searchParams.set('limit', '100');
  url.searchParams.set('filters[commodity]', commodity);
  if (state) url.searchParams.set('filters[state.keyword]', state);
  if (district) url.searchParams.set('filters[district]', district);

  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS) });
    if (!res.ok) return { live: false, reason: `HTTP_${res.status}`, ...status(), records: [] };
    const json = await res.json();
    if (!Array.isArray(json.records)) return { live: false, reason: 'UNEXPECTED_RESPONSE', ...status(), records: [] };
    const records = json.records.map(normalizeRecord).filter((r) => r.modalPerQuintal != null && r.date);
    records.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
    const latest = records[0]?.date || null;
    const value = {
      live: true,
      ...status(),
      fetchedAt: new Date().toISOString(),
      latestDate: latest,
      // Only the freshest day: older rows would mix stale and current prices
      records: records.filter((r) => r.date === latest)
    };
    cache.set(key, { at: Date.now(), value });
    return value;
  } catch {
    return { live: false, reason: 'NETWORK', ...status(), records: [] };
  }
};
