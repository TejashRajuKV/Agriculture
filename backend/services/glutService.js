import ProcurementBooking from '../models/ProcurementBooking.js';
import ProcurementRecord from '../models/ProcurementRecord.js';
import ProcurementCenter from '../models/ProcurementCenter.js';
import { todayIST, addDays } from '../utils/dates.js';
import { escapeRegex } from '../utils/validate.js';

// "Glut" here means heavy arrivals: many farmers have booked to bring the same crop to the same centre
// on the same day, far above what that centre usually takes. It uses AgriLoop bookings only, so it
// shows crowding and long waits, not market prices. A price-based alert would need live mandi data.
const BASELINE_DAYS = 14;
const MIN_BASELINE_DAYS = 3; // a baseline from fewer days is noise
const WATCH_RATIO = 1.5;
const HIGH_RATIO = 2;
const MIN_KG = 500;
const WINDOW = 7;

const round = (n) => Math.round(n);

export const getGlutAlerts = async (user) => {
  const today = todayIST();
  const stateName = String(user.location?.label || '').split(',').map((s) => s.trim()).filter(Boolean).at(-1);
  const centerFilter = stateName ? { state: new RegExp(`^${escapeRegex(stateName)}$`, "i") } : {};
  const centers = await ProcurementCenter.find({ status: 'ACTIVE', ...centerFilter }).populate('crops', 'name');
  if (!centers.length) return { generatedFor: stateName || null, basis: 'AgriLoop bookings only', alerts: [] };
  const centerIds = centers.map((c) => c._id);

  const [history, booked] = await Promise.all([
    ProcurementRecord.aggregate([
      { $match: { center: { $in: centerIds }, date: { $gte: addDays(today, -BASELINE_DAYS), $lt: today }, acceptedQuantity: { $gt: 0 } } },
      { $group: { _id: { center: '$center', crop: '$crop', date: '$date' }, kg: { $sum: '$acceptedQuantity' } } },
      { $group: { _id: { center: '$_id.center', crop: '$_id.crop' }, days: { $sum: 1 }, totalKg: { $sum: '$kg' } } }
    ]),
    ProcurementBooking.aggregate([
      { $match: { center: { $in: centerIds }, active: true, date: { $gte: today, $lte: addDays(today, WINDOW - 1) } } },
      { $group: { _id: { center: '$center', crop: '$crop', date: '$date' }, kg: { $sum: '$estimatedQuantity' } } }
    ])
  ]);

  const key = (c, k) => `${c}:${k}`;
  const baseline = new Map(
    history.filter((h) => h.days >= MIN_BASELINE_DAYS).map((h) => [key(h._id.center, h._id.crop), h.totalKg / h.days])
  );
  const load = new Map(booked.map((b) => [`${key(b._id.center, b._id.crop)}:${b._id.date}`, b.kg]));
  const centerById = new Map(centers.map((c) => [String(c._id), c]));
  const cropName = new Map();
  centers.forEach((c) => c.crops.forEach((cr) => cropName.set(String(cr._id), cr.name)));

  const alerts = [];
  for (const b of booked) {
    const base = baseline.get(key(b._id.center, b._id.crop));
    if (!base || b.kg < MIN_KG) continue;
    const ratio = b.kg / base;
    if (ratio < WATCH_RATIO) continue;
    const centre = centerById.get(String(b._id.center));
    const cid = String(b._id.center);
    const crop = String(b._id.crop);

    // Quieter days at the same centre, and the same day at other centres that buy this crop
    const lighterDays = Array.from({ length: WINDOW }, (_, i) => addDays(today, i))
      .filter((d) => d !== b._id.date)
      .map((d) => ({ date: d, ratio: (load.get(`${key(cid, crop)}:${d}`) || 0) / base }))
      .filter((d) => d.ratio < 1)
      .sort((a, c) => a.ratio - c.ratio)
      .slice(0, 2)
      .map((d) => d.date);
    const otherCentres = centers
      .filter((c) => String(c._id) !== cid && c.crops.some((cr) => String(cr._id) === crop))
      .map((c) => {
        const ob = baseline.get(key(c._id, crop));
        const kg = load.get(`${key(c._id, crop)}:${b._id.date}`) || 0;
        return { name: c.name, district: c.district, ratio: ob ? kg / ob : null };
      })
      .filter((c) => c.ratio !== null && c.ratio < 1)
      .sort((a, c) => a.ratio - c.ratio)
      .slice(0, 2)
      .map((c) => ({ name: c.name, district: c.district }));

    alerts.push({
      severity: ratio >= HIGH_RATIO ? 'HIGH' : 'WATCH',
      crop: cropName.get(crop) || 'Crop',
      cropId: crop,
      centerId: cid,
      centerName: centre.name,
      date: b._id.date,
      bookedKg: round(b.kg),
      usualDailyKg: round(base),
      ratio: Math.round(ratio * 10) / 10,
      lighterDays,
      otherCentres
    });
  }
  alerts.sort((a, b) => b.ratio - a.ratio || (a.date < b.date ? -1 : 1));
  return { generatedFor: stateName || null, basis: 'AgriLoop bookings only', usualBasis: `average per day over the last ${BASELINE_DAYS} days`, alerts: alerts.slice(0, 10) };
};
