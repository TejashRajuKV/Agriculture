import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Reads the AGMARKNET "Marketwise Price & Arrival" CSV export in backend/data
// so market prices work even when MongoDB is not configured.

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, '..', 'data');

// Minimal CSV line parser that handles quoted fields containing commas
const parseLine = (line) => {
  const out = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === ',' && !inQuotes) {
      out.push(cur);
      cur = '';
    } else {
      cur += ch;
    }
  }
  out.push(cur);
  return out.map((s) => s.trim());
};

const toNumber = (v) => {
  const n = parseFloat(String(v).replace(/,/g, ''));
  return Number.isFinite(n) ? n : null;
};

// "Price on 01 Jan, 2026" -> "2026-01-01"
const headerToIsoDate = (header) => {
  const m = header.match(/(\d{1,2}) ([A-Za-z]{3}),? (\d{4})/);
  if (!m) return null;
  const d = new Date(`${m[1]} ${m[2]} ${m[3]} UTC`);
  return Number.isNaN(d.getTime()) ? null : d.toISOString().split('T')[0];
};

let cache = null;

const findLatestCsv = () => {
  if (!fs.existsSync(DATA_DIR)) return null;
  const files = fs
    .readdirSync(DATA_DIR)
    .filter((f) => f.toLowerCase().endsWith('.csv'))
    .map((f) => ({ f, t: fs.statSync(path.join(DATA_DIR, f)).mtimeMs }))
    .sort((a, b) => b.t - a.t);
  return files.length ? path.join(DATA_DIR, files[0].f) : null;
};

const load = () => {
  if (cache) return cache;

  const file = findLatestCsv();
  if (!file) {
    cache = { source: null, crops: new Map() };
    return cache;
  }

  const lines = fs.readFileSync(file, 'utf-8').split(/\r?\n/).filter((l) => l.trim());
  const headerIdx = lines.findIndex((l) => l.startsWith('Commodity Group'));
  const header = parseLine(lines[headerIdx]);

  const priceCols = [];
  const arrivalCols = [];
  header.forEach((h, i) => {
    if (h.startsWith('Price on')) priceCols.push({ i, date: headerToIsoDate(h) });
    if (h.startsWith('Arrival on')) arrivalCols.push({ i, date: headerToIsoDate(h) });
  });
  const mspIdx = header.findIndex((h) => h.startsWith('MSP'));

  const crops = new Map();
  for (const line of lines.slice(headerIdx + 1)) {
    const cols = parseLine(line);
    const [group, commodity] = cols;
    if (!commodity) continue;

    // Oldest -> newest, skipping days with no trading ("-")
    const history = priceCols
      .map(({ i, date }) => ({ date, price: toNumber(cols[i]) }))
      .filter((p) => p.date && p.price !== null)
      .sort((a, b) => a.date.localeCompare(b.date));
    if (history.length === 0) continue;

    const arrivals = arrivalCols
      .map(({ i, date }) => ({ date, tonnes: toNumber(cols[i]) }))
      .filter((a) => a.date && a.tonnes !== null)
      .sort((a, b) => a.date.localeCompare(b.date));

    const price = history[history.length - 1].price;
    const previousPrice = history.length > 1 ? history[history.length - 2].price : price;
    const percentageChange = previousPrice ? ((price - previousPrice) / previousPrice) * 100 : 0;

    crops.set(commodity, {
      crop: commodity,
      group,
      price: Math.round(price),
      previousPrice: Math.round(previousPrice),
      percentageChange,
      trend: percentageChange > 2 ? 'UP' : percentageChange < -2 ? 'DOWN' : 'STABLE',
      msp: mspIdx >= 0 ? toNumber(cols[mspIdx]) : null,
      arrivalTonnes: arrivals.length ? arrivals[arrivals.length - 1].tonnes : null,
      asOf: history[history.length - 1].date,
      last7Days: history.map((p) => ({ date: p.date, price: Math.round(p.price) }))
    });
  }

  cache = { source: path.basename(file), crops };
  return cache;
};

export const csvMarket = {
  source: () => load().source,
  listCrops: () => Array.from(load().crops.keys()),
  getCrop: (name) => load().crops.get(name) || null
};
