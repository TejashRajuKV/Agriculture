import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import IntakeHistory from '../models/IntakeHistory.js';
import ProcurementCenter from '../models/ProcurementCenter.js';
import Crop from '../models/Crop.js';
import Order from '../models/Order.js';
import { notFound } from '../utils/httpError.js';
import * as v from '../utils/validate.js';
import { todayIST, addDays, daysBetween } from '../utils/dates.js';
import { csvMarket } from './agmarknetCsv.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MODEL_FILE = path.join(__dirname, '..', '..', 'ml', 'models', 'demand.json');

// ---------------------------------------------------------------------------
// Demand forecast. The model is trained offline (ml/demand_forecasting/train.py) and exported as plain
// numbers; this file applies them with the same feature recipe, so no Python runs on the server.
// ---------------------------------------------------------------------------
let modelCache;
export const loadDemandModel = () => {
  if (modelCache !== undefined) return modelCache;
  try {
    modelCache = JSON.parse(fs.readFileSync(MODEL_FILE, 'utf-8'));
  } catch {
    modelCache = null;
  }
  return modelCache;
};
export const resetModelCache = () => { modelCache = undefined; };

const dowOf = (iso) => new Date(`${iso}T00:00:00Z`).getUTCDay(); // Sunday = 0, as in train.py
const mean = (a) => a.reduce((s, x) => s + x, 0) / a.length;

// hist: the last `history` daily kg, ending on `origin`. Mirrors features() in train.py.
export const predictOne = (model, hist, origin, h) => {
  const scale = Math.max(mean(hist), 1);
  const row = Array(7).fill(0);
  row[dowOf(addDays(origin, h))] = 1;
  const x = [...row, h / model.horizon, mean(hist.slice(-7)) / scale, hist[h - 8 + hist.length] / scale];
  const ratio = model.intercept + x.reduce((s, xi, i) => s + xi * model.coef[i], 0);
  return Math.max(ratio * scale, 0);
};

export const demandForecast = async ({ centerId, cropId }) => {
  const center = await ProcurementCenter.findById(v.objectId(centerId, 'centre id')).select('name');
  if (!center) throw notFound('Centre not found');
  const crop = await Crop.findById(v.objectId(cropId, 'crop id')).select('name');
  if (!crop) throw notFound('Crop not found');

  const model = loadDemandModel();
  const today = todayIST();
  const origin = addDays(today, -1);
  const span = model?.history || 28;
  const from = addDays(origin, -(span - 1));
  const rows = await IntakeHistory.find({ center: center._id, crop: crop._id, date: { $gte: from, $lte: origin } });
  const byDate = new Map(rows.map((r) => [r.date, r]));
  const hist = Array.from({ length: span }, (_, i) => byDate.get(addDays(from, i))?.kg ?? 0);
  const simulatedDays = rows.filter((r) => r.simulated).length;
  const realDays = rows.length - simulatedDays;

  const base = { center: { id: String(center._id), name: center.name }, crop: { id: String(crop._id), name: crop.name }, asOf: origin };
  if (rows.length < span * 0.8) {
    return { ...base, available: false, reason: `Not enough history yet: ${rows.length} of the last ${span} days recorded.` };
  }
  if (!model) return { ...base, available: false, reason: 'The forecast model has not been trained yet. Run ml/demand_forecasting/train.py.' };

  // If training found the model no better than "same weekday last week", say so and use that
  const useModel = model.metrics.modelBeatsBaseline;
  const horizon = model.horizon;
  const days = Array.from({ length: horizon }, (_, i) => {
    const h = i + 1;
    const kg = useModel ? predictOne(model, hist, origin, h) : hist[h - 8 + hist.length];
    const date = addDays(origin, h);
    const lowK = useModel ? kg * (1 + model.interval.low) : kg * 0.8;
    const highK = useModel ? kg * (1 + model.interval.high) : kg * 1.2;
    return { date, expectedKg: Math.round(kg), lowKg: Math.round(Math.max(lowK, 0)), highKg: Math.round(highK) };
  });
  const usual = Math.round(mean(hist));
  return {
    ...base,
    available: true,
    method: useModel ? 'ridge-regression' : 'same-weekday-last-week',
    usualDailyKg: usual,
    days: days.map((d) => ({ ...d, vsUsual: usual ? Math.round((d.expectedKg / usual) * 100) / 100 : null })),
    accuracy: {
      testedOn: `the last ${model.metrics.testOrigins} forecast dates held back from training`,
      modelErrorPercent: Math.round(model.metrics.model.wape * 1000) / 10,
      simpleRuleErrorPercent: Math.round(model.metrics[model.metrics.bestBaseline].wape * 1000) / 10,
      simpleRule: model.metrics.bestBaseline === 'seasonal_naive' ? 'same weekday last week' : 'average of the last 28 days'
    },
    dataBasis: {
      realDays,
      simulatedDays,
      warning: simulatedDays > 0
        ? `${simulatedDays} of the last ${span} days of history are simulated placeholders, so these numbers show the method working, not a reliable forecast, until real procurement fills the history.`
        : null
    },
    trainedAt: model.trainedAt
  };
};

export const modelInfo = () => {
  const m = loadDemandModel();
  if (!m) return { trained: false };
  return { trained: true, trainedAt: m.trainedAt, metrics: m.metrics, data: m.data };
};

// ---------------------------------------------------------------------------
// Price guidance for a listing. This is a plain formula, not machine learning: the only real price
// history on hand is a few days of AGMARKNET data, far too little to train on. It shows its inputs.
// ---------------------------------------------------------------------------
export const GRADE_FACTOR = { A: 1.0, B: 0.92, C: 0.82, UNGRADED: 0.95 }; // assumptions, shown to the user
const RANGE = 0.08;
const STALE_DAYS = 14;
const median = (a) => { const s = [...a].sort((x, y) => x - y); const m = Math.floor(s.length / 2); return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };

export const priceGuidance = async ({ cropId, grade = 'UNGRADED' }) => {
  const crop = await Crop.findById(v.objectId(cropId, 'crop id'));
  if (!crop) throw notFound('Crop not found');
  const g = GRADE_FACTOR[grade] ? grade : 'UNGRADED';
  const ref = crop.agmarknetName ? csvMarket.getCrop(crop.agmarknetName) : null;

  const since = new Date(Date.now() - 30 * 86400000);
  const orders = await Order.find({ 'item.crop': crop._id, status: { $ne: 'CANCELLED' }, createdAt: { $gte: since } }).select('unitPrice item.unit');
  const perKgOrders = orders.filter((o) => o.item.unit === 'kg').map((o) => o.unitPrice);

  const out = { crop: { id: String(crop._id), name: crop.name }, grade: g, gradeFactor: GRADE_FACTOR[g], method: 'formula', notML: 'This is guidance from a formula, not a machine-learning forecast.' };
  if (!ref && !perKgOrders.length) return { ...out, available: false, reason: 'No market reference is available for this crop.' };

  const parts = [];
  let basePerKg;
  if (ref) {
    const ageDays = daysBetween(ref.asOf, todayIST());
    basePerKg = ref.price / 100;
    parts.push({ label: 'Market price (AGMARKNET, all-India average)', perKg: Math.round(basePerKg * 100) / 100, asOf: ref.asOf, ageDays, stale: ageDays > STALE_DAYS });
    if (ref.msp) parts.push({ label: 'Government MSP', perKg: Math.round((ref.msp / 100) * 100) / 100 });
  }
  if (perKgOrders.length >= 3) {
    const m = median(perKgOrders);
    parts.push({ label: `Median of ${perKgOrders.length} AgriLoop orders in the last 30 days`, perKg: Math.round(m * 100) / 100 });
    // With no market figure, recent AgriLoop sales are the only anchor
    if (basePerKg === undefined) basePerKg = m;
  }
  if (basePerKg === undefined) return { ...out, available: false, reason: 'Not enough recent prices for this crop.' };

  const centre = basePerKg * GRADE_FACTOR[g];
  return {
    ...out,
    available: true,
    suggestedPerKg: Math.round(centre * 100) / 100,
    lowPerKg: Math.round(centre * (1 - RANGE) * 100) / 100,
    highPerKg: Math.round(centre * (1 + RANGE) * 100) / 100,
    basis: parts,
    explanation: `Starting from the market price and scaling by a grade factor of ${GRADE_FACTOR[g]} (assumed: A 1.00, B 0.92, C 0.82), with a range of plus or minus ${RANGE * 100}%. Your local mandi price and your produce's freshness can differ, so treat it as a starting point.`,
    staleWarning: parts[0]?.stale ? `The market figure is ${parts[0].ageDays} days old.` : null
  };
};
