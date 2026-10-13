// Seeds the AgriLoop demo database (fictional people, realistic Indian agri data).
//   npm run seed
// Only ever touches a database named "agriloop" or "agriloop_test".
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import { fileURLToPath } from 'url';
import User from '../models/User.js';
import Fpo from '../models/Fpo.js';
import Crop from '../models/Crop.js';
import Counter from '../models/Counter.js';
import ResiduePool from '../models/ResiduePool.js';
import { Machine, MachineBooking } from '../models/Machine.js';
import IntakeHistory from '../models/IntakeHistory.js';
import { Vehicle } from '../models/Logistics.js';
import SchemeReminder from '../models/SchemeReminder.js';
import ProcurementCenter from '../models/ProcurementCenter.js';
import ProcurementSlot from '../models/ProcurementSlot.js';
import ProcurementBooking from '../models/ProcurementBooking.js';
import ProcurementRecord from '../models/ProcurementRecord.js';
import Payment from '../models/Payment.js';
import Notification from '../models/Notification.js';
import Listing from '../models/Listing.js';
import Order from '../models/Order.js';
import { hashPassword } from '../services/authService.js';
import { todayIST, addDays, toMinutes, fromMinutes } from '../utils/dates.js';
import { ensureSlots, slotCapacityFor } from '../services/procurementService.js';

dotenv.config();

export const DEMO_PASSWORD = 'AgriLoop@2026';
const ALLOWED_DBS = ['agriloop', 'agriloop_test'];

// Small deterministic PRNG so every seed run produces the same data
const rng = (() => {
  let s = 20260928;
  return () => ((s = (s * 1664525 + 1013904223) % 4294967296) / 4294967296);
})();
const pick = (arr) => arr[Math.floor(rng() * arr.length)];
const between = (a, b) => a + rng() * (b - a);
const round = (n, step = 1) => Math.round(n / step) * step;
const at = (date, hhmm) => new Date(`${date}T${hhmm}:00+05:30`);

const CROPS = [
  { name: 'Tomato', category: 'VEGETABLE', agmarknetName: 'Tomato' },
  { name: 'Onion', category: 'VEGETABLE', agmarknetName: 'Onion' },
  { name: 'Potato', category: 'VEGETABLE', agmarknetName: 'Potato' },
  { name: 'Paddy', category: 'CEREAL', agmarknetName: 'Paddy(Common)' },
  { name: 'Wheat', category: 'CEREAL', agmarknetName: 'Wheat' },
  { name: 'Maize', category: 'CEREAL', agmarknetName: 'Maize' },
  { name: 'Cotton', category: 'FIBRE', agmarknetName: 'Cotton' },
  { name: 'Mustard', category: 'OILSEED', agmarknetName: 'Mustard' },
  { name: 'Soyabean', category: 'OILSEED', agmarknetName: 'Soyabean' },
  { name: 'Groundnut', category: 'OILSEED', agmarknetName: 'Groundnut' }
];

const FIRST = ['Manjunath', 'Shivanna', 'Nagaraj', 'Basavaraj', 'Kavitha', 'Shobha', 'Ramesh', 'Mahadevappa', 'Girish', 'Pushpa', 'Chandrashekar', 'Savitha', 'Prakash', 'Renuka', 'Siddaraju', 'Bhagya', 'Venkatesh', 'Lokesh', 'Yashoda', 'Mallesh', 'Hemavathi', 'Thimmaiah', 'Rangaswamy', 'Jayamma'];
const LAST = ['Gowda', 'Shetty', 'Naik', 'Hegde', 'Patil', 'Swamy', 'Murthy', 'Reddy'];

const assertSafeDb = () => {
  const name = mongoose.connection.name;
  if (!ALLOWED_DBS.includes(name)) {
    throw new Error(`Refusing to seed database "${name}". Point MONGODB_URI at .../agriloop`);
  }
};

export const seed = async ({ log = console.log } = {}) => {
  assertSafeDb();
  await mongoose.connection.dropDatabase();
  await Promise.all(Object.values(mongoose.models).map((m) => m.init()));

  const today = todayIST();
  const passwordHash = await hashPassword(DEMO_PASSWORD);

  // --- Crops -----------------------------------------------------------------
  const crops = Object.fromEntries((await Crop.insertMany(CROPS.map((c) => ({ ...c, unit: 'kg' })))).map((c) => [c.name, c]));

  // --- Centres -----------------------------------------------------------------
  const centerDefs = [
    {
      code: 'M01', name: 'Mandya Central Procurement', address: 'APMC Yard, Bengaluru–Mysuru Road', district: 'Mandya', state: 'Karnataka',
      lat: 12.5218, lng: 76.8951, openingTime: '07:00', closingTime: '21:00', slotMinutes: 30, counters: 2, avgProcessingMinutes: 10, dailyCapacity: 168,
      crops: ['Tomato', 'Onion', 'Potato', 'Paddy', 'Maize'], prices: { Tomato: 24, Onion: 18, Potato: 14, Paddy: 23.69, Maize: 24 }
    },
    {
      code: 'M02', name: 'Mysuru APMC Procurement Yard', address: 'Bandipalya, Nanjangud Road', district: 'Mysuru', state: 'Karnataka',
      lat: 12.2744, lng: 76.6693, openingTime: '08:00', closingTime: '18:00', slotMinutes: 30, counters: 2, avgProcessingMinutes: 8, dailyCapacity: 140,
      crops: ['Tomato', 'Onion', 'Potato', 'Groundnut', 'Maize'], prices: { Tomato: 23, Onion: 17.5, Potato: 14, Groundnut: 61.5, Maize: 24 }
    },
    {
      code: 'S01', name: 'Sangrur Grain Procurement Centre', address: 'New Grain Market, Dhuri Road', district: 'Sangrur', state: 'Punjab',
      lat: 30.2458, lng: 75.8421, openingTime: '08:00', closingTime: '18:00', slotMinutes: 30, counters: 3, avgProcessingMinutes: 12, dailyCapacity: 150,
      crops: ['Wheat', 'Paddy', 'Mustard', 'Cotton'], prices: { Wheat: 24.25, Paddy: 23.69, Mustard: 59.5, Cotton: 77.1 }
    }
  ];

  // --- Users -------------------------------------------------------------------
  const mk = (u) => ({ passwordHash, walletBalance: 0, carbonPoints: 0, ...u });
  const loc = (label, lat, lng) => ({ label, lat, lng });

  const mainFarmers = await User.insertMany([
    mk({ name: 'Ravi Kumar', email: 'ravi@agriloop.demo', phone: '9800000001', role: 'FARMER', farmerCode: 'FR-00001', location: loc('Mandya, Karnataka', 12.5242, 76.8958) }),
    mk({ name: 'Lakshmi Devi', email: 'lakshmi@agriloop.demo', phone: '9800000002', role: 'FARMER', farmerCode: 'FR-00002', location: loc('Srirangapatna, Karnataka', 12.4224, 76.6830) }),
    mk({ name: 'Suresh Gowda', email: 'suresh@agriloop.demo', phone: '9800000003', role: 'FARMER', farmerCode: 'FR-00003', location: loc('Mysuru, Karnataka', 12.2958, 76.6394) }),
    mk({ name: 'Harpreet Singh', email: 'harpreet@agriloop.demo', phone: '9800000004', role: 'FARMER', farmerCode: 'FR-00004', location: loc('Sangrur, Punjab', 30.2458, 75.8421) }),
    mk({ name: 'Gurmeet Kaur', email: 'gurmeet@agriloop.demo', phone: '9800000005', role: 'FARMER', farmerCode: 'FR-00005', location: loc('Patiala, Punjab', 30.3398, 76.3869) })
  ]);
  const [ravi, lakshmi, suresh, harpreet, gurmeet] = mainFarmers;

  // Other (fictional) farmers who fill today's queue and the history
  const queueFarmers = await User.insertMany(
    Array.from({ length: 50 }, (_, i) =>
      mk({
        name: `${FIRST[i % FIRST.length]} ${LAST[(i * 7) % LAST.length]}`,
        email: `farmer${String(i + 1).padStart(2, '0')}@agriloop.demo`,
        role: 'FARMER',
        farmerCode: `FR-${String(i + 6).padStart(5, '0')}`,
        location: loc(pick(['Mandya, Karnataka', 'Maddur, Karnataka', 'Pandavapura, Karnataka', 'Mysuru, Karnataka']), between(12.3, 12.6), between(76.6, 77.0))
      })
    )
  );

  const [fpoUser1, fpoUser2, buyer1, buyer2, mgrKa, mgrPb, logistics, admin] = await User.insertMany([
    mk({ name: 'Anand Hegde', email: 'fpo.mandya@agriloop.demo', phone: '9800000011', role: 'FPO', location: loc('Mandya, Karnataka', 12.5218, 76.8951) }),
    mk({ name: 'Baldev Sandhu', email: 'fpo.malwa@agriloop.demo', phone: '9800000012', role: 'FPO', location: loc('Barnala, Punjab', 30.3819, 75.5468) }),
    mk({ name: 'Hotel Annapoorna', email: 'buyer.hotel@agriloop.demo', phone: '9800000021', role: 'BUYER', buyerType: 'RESTAURANT', walletBalance: 500000, location: loc('Bengaluru, Karnataka', 12.9716, 77.5946) }),
    mk({ name: 'FreshMart Retail', email: 'buyer.retail@agriloop.demo', phone: '9800000022', role: 'BUYER', buyerType: 'RETAILER', walletBalance: 800000, location: loc('Mysuru, Karnataka', 12.2958, 76.6394) }),
    mk({ name: 'Meena Rao', email: 'manager.karnataka@agriloop.demo', phone: '9800000031', role: 'PROCUREMENT_MANAGER', location: loc('Mandya, Karnataka', 12.5218, 76.8951) }),
    mk({ name: 'Jaswant Gill', email: 'manager.punjab@agriloop.demo', phone: '9800000032', role: 'PROCUREMENT_MANAGER', location: loc('Sangrur, Punjab', 30.2458, 75.8421) }),
    mk({ name: 'Karthik Transport', email: 'logistics@agriloop.demo', phone: '9800000041', role: 'LOGISTICS_OPERATOR', location: loc('Mandya, Karnataka', 12.5218, 76.8951) }),
    mk({ name: 'AgriLoop Admin', email: 'admin@agriloop.demo', role: 'ADMIN' })
  ]);

  const [household1, household2, biogas1] = await User.insertMany([
    mk({ name: 'Sunita Rao', email: 'household@agriloop.demo', phone: '9800000051', role: 'HOUSEHOLD', location: loc('Mysuru, Karnataka', 12.2958, 76.6394) }),
    mk({ name: 'Mohan Gowda', email: 'household2@agriloop.demo', phone: '9800000052', role: 'HOUSEHOLD', location: loc('Mandya, Karnataka', 12.5242, 76.8958) }),
    mk({ name: 'Cauvery Biogas Plant', email: 'biogas@agriloop.demo', phone: '9800000053', role: 'BIOGAS', walletBalance: 250000, location: loc('Mysuru, Karnataka', 12.2744, 76.6693) })
  ]);

  const fpos = await Fpo.insertMany([
    { name: 'Mandya Tomato Growers FPO', registrationNumber: 'FPO-KA-MDY-0142', contactPerson: 'Anand Hegde', phone: '9800000011', location: 'Mandya, Karnataka', admin: fpoUser1._id, members: [ravi, lakshmi, ...queueFarmers.slice(0, 8)].map((f) => ({ farmer: f._id })) },
    { name: 'Malwa Farmers Producer Company', registrationNumber: 'FPO-PB-BNL-0077', contactPerson: 'Baldev Sandhu', phone: '9800000012', location: 'Barnala, Punjab', admin: fpoUser2._id, members: [harpreet, gurmeet].map((f) => ({ farmer: f._id })) }
  ]);
  await User.updateOne({ _id: fpoUser1._id }, { fpo: fpos[0]._id });
  await User.updateOne({ _id: fpoUser2._id }, { fpo: fpos[1]._id });

  // Centres (with managers)
  const centers = {};
  for (const d of centerDefs) {
    const managers = d.state === 'Punjab' ? [mgrPb._id] : [mgrKa._id];
    centers[d.code] = await ProcurementCenter.create({
      ...d,
      crops: d.crops.map((n) => crops[n]._id),
      // Moisture limits: paddy 17% (FCI), wheat/maize 14% (confirm with the centre), mustard 8%
      cropPrices: Object.entries(d.prices).map(([n, p]) => ({ crop: crops[n]._id, pricePerKg: p, maxMoisturePct: { Paddy: 17, Wheat: 14, Maize: 14, Mustard: 8 }[n] ?? null })),
      pricesUpdatedAt: new Date(),
      managers
    });
  }
  await User.updateOne({ _id: mgrKa._id }, { centerIds: [centers.M01._id, centers.M02._id] });
  await User.updateOne({ _id: mgrPb._id }, { centerIds: [centers.S01._id] });

  // --- Procurement history + today's queue -------------------------------------
  const counters = new Map(); // counter key -> seq
  const bump = (key) => {
    const n = (counters.get(key) || 0) + 1;
    counters.set(key, n);
    return n;
  };
  const bookingNumber = (date) => {
    const y = date.slice(0, 4);
    return `PR-${y}-${String(bump(`PR-${y}`)).padStart(5, '0')}`;
  };

  const bookingsToInsert = [];
  const recordsToInsert = [];
  const paymentsToInsert = [];
  const slotUse = new Map(); // slotKey -> count
  // Processing times whose last-20 average is 10.5 min (drives the wait estimate)
  const PROC_TIMES = [9, 12, 10, 11, 10.5, 9.5, 11.5, 10, 11, 10.5];

  const addBooking = ({ center, farmer, date, seq, cropName, qty, queueStatus, recordStage, paymentStatus, slotStart }) => {
    const bookingId = new mongoose.Types.ObjectId();
    const mmdd = date.slice(5, 7) + date.slice(8, 10);
    const token = `${center.code}-${mmdd}-${String(seq).padStart(3, '0')}`;
    const start = slotStart;
    const end = fromMinutes(toMinutes(start) + center.slotMinutes);
    slotUse.set(`${center.code}|${date}|${start}`, (slotUse.get(`${center.code}|${date}|${start}`) || 0) + 1);
    const number = bookingNumber(date);
    // Today's queue happened earlier today (relative to now), so real calls made
    // during a demo are always the most recent; other days use their slot times.
    const joinedAt = date === today ? new Date(Date.now() - (60 - seq) * 6 * 60000) : at(date, start);
    const calledAt = new Date(joinedAt.getTime() + 20 * 60000);
    const done = queueStatus === 'COMPLETED';
    const procMin = PROC_TIMES[seq % PROC_TIMES.length];

    bookingsToInsert.push({
      _id: bookingId,
      bookingNumber: number,
      tokenNumber: token,
      tokenSeq: seq,
      farmer: farmer._id,
      center: center._id,
      date,
      slotStart: start,
      slotEnd: end,
      crop: crops[cropName]._id,
      estimatedQuantity: qty,
      status: done ? 'COMPLETED' : 'CONFIRMED',
      active: !done,
      arrivalStatus: queueStatus === 'NOT_JOINED' ? 'NOT_ARRIVED' : 'ARRIVED',
      queue: {
        status: queueStatus,
        joinedAt: queueStatus === 'NOT_JOINED' ? undefined : joinedAt,
        calledAt: ['CALLED', 'PROCESSING', 'COMPLETED'].includes(queueStatus) ? calledAt : undefined,
        startedAt: ['PROCESSING', 'COMPLETED'].includes(queueStatus) ? calledAt : undefined,
        completedAt: done ? new Date(calledAt.getTime() + procMin * 60000) : undefined
      },
      _slotKey: `${center.code}|${date}|${start}`,
      createdAt: new Date(joinedAt.getTime() - 2 * 86400000)
    });

    if (!recordStage) return;
    const price = center.cropPrices.find((p) => String(p.crop) === String(crops[cropName]._id))?.pricePerKg || 20;
    const weighed = round(qty * between(0.97, 1.02), 1);
    const accepted = round(weighed * between(0.9, 1), 1);
    const grade = accepted / weighed > 0.97 ? 'A' : 'B';
    const recordId = new mongoose.Types.ObjectId();
    const total = Math.round(accepted * price * 100) / 100;
    recordsToInsert.push({
      _id: recordId,
      recordNumber: number,
      booking: bookingId,
      farmer: farmer._id,
      center: center._id,
      crop: crops[cropName]._id,
      date,
      declaredQuantity: qty,
      ...(recordStage === 'WEIGHING'
        ? { status: 'WEIGHING', startedAt: calledAt }
        : {
            status: 'COMPLETED',
            weighedQuantity: weighed,
            acceptedQuantity: accepted,
            rejectedQuantity: round(weighed - accepted, 0.1),
            qualityGrade: grade,
            qualityNotes: grade === 'A' ? 'Uniform size, firm' : 'Some bruised/undersized produce removed',
            pricePerKg: price,
            totalAmount: total,
            startedAt: calledAt,
            weighedAt: new Date(calledAt.getTime() + 3 * 60000),
            qualityCheckedAt: new Date(calledAt.getTime() + (procMin - 2) * 60000),
            completedAt: new Date(calledAt.getTime() + procMin * 60000),
            processingMinutes: procMin
          }),
      handledBy: center.code === 'S01' ? mgrPb._id : mgrKa._id
    });
    if (recordStage === 'COMPLETED' && paymentStatus) {
      const completedAt = new Date(calledAt.getTime() + procMin * 60000);
      paymentsToInsert.push({
        procurement: recordId,
        farmer: farmer._id,
        center: center._id,
        amount: total,
        status: paymentStatus,
        provider: 'SIMULATED',
        transactionRef: `SIM-${String(recordId).slice(-6).toUpperCase()}`,
        processingAt: completedAt,
        paidAt: paymentStatus === 'PAID' ? new Date(completedAt.getTime() + 26 * 3600000) : undefined,
        failureReason: paymentStatus === 'FAILED' ? 'Bank account details mismatch' : undefined
      });
    }
  };

  const slotStarts = (center) => {
    const out = [];
    for (let t = toMinutes(center.openingTime); t + center.slotMinutes <= toMinutes(center.closingTime); t += center.slotMinutes) out.push(fromMinutes(t));
    return out;
  };

  // History: last 10 days, every centre
  for (const center of Object.values(centers)) {
    const starts = slotStarts(center);
    const cropNames = centerDefs.find((d) => d.code === center.code).crops;
    for (let d = 10; d >= 1; d--) {
      const date = addDays(today, -d);
      const perDay = 8;
      for (let i = 0; i < perDay; i++) {
        const farmer = center.code === 'S01' ? pick([harpreet, gurmeet, ...queueFarmers.slice(40, 50)]) : queueFarmers[(d * perDay + i) % 40];
        // one booking per farmer/centre/day
        if (bookingsToInsert.some((b) => b.date === date && String(b.center) === String(center._id) && String(b.farmer) === String(farmer._id))) continue;
        addBooking({
          center, farmer, date, seq: i + 1, cropName: pick(cropNames), qty: round(between(250, 900), 10),
          queueStatus: 'COMPLETED', recordStage: 'COMPLETED', paymentStatus: d > 2 ? 'PAID' : pick(['PAID', 'PROCESSING']),
          slotStart: starts[Math.min(starts.length - 1, Math.floor(i / 2))]
        });
      }
    }
  }

  // Ravi's own history: one paid, one still processing
  addBooking({ center: centers.M01, farmer: ravi, date: addDays(today, -6), seq: 90, cropName: 'Tomato', qty: 420, queueStatus: 'COMPLETED', recordStage: 'COMPLETED', paymentStatus: 'PAID', slotStart: '10:00' });
  addBooking({ center: centers.M02, farmer: ravi, date: addDays(today, -2), seq: 90, cropName: 'Onion', qty: 380, queueStatus: 'COMPLETED', recordStage: 'COMPLETED', paymentStatus: 'PROCESSING', slotStart: '09:00' });
  addBooking({ center: centers.S01, farmer: harpreet, date: addDays(today, -3), seq: 91, cropName: 'Wheat', qty: 2400, queueStatus: 'COMPLETED', recordStage: 'COMPLETED', paymentStatus: 'FAILED', slotStart: '11:00' });

  // Today at Mandya: tokens 1-38 done, 39 being weighed, 40-46 waiting -> the next booking is token 47
  const m01 = centers.M01;
  const mStarts = slotStarts(m01);
  const perSlot = slotCapacityFor(m01);
  for (let seq = 1; seq <= 46; seq++) {
    const status = seq <= 38 ? 'COMPLETED' : seq === 39 ? 'PROCESSING' : 'WAITING';
    addBooking({
      center: m01, farmer: queueFarmers[seq - 1], date: today, seq, cropName: pick(['Tomato', 'Tomato', 'Onion', 'Potato']), qty: round(between(200, 700), 10),
      queueStatus: status, recordStage: seq <= 38 ? 'COMPLETED' : seq === 39 ? 'WEIGHING' : null, paymentStatus: seq <= 30 ? 'PAID' : 'PROCESSING',
      slotStart: mStarts[Math.floor((seq - 1) / perSlot)]
    });
  }
  // A few upcoming bookings (tomorrow) so centres show booked capacity ahead
  const tomorrow = addDays(today, 1);
  [lakshmi, suresh, ...queueFarmers.slice(46, 50)].forEach((f, i) =>
    addBooking({ center: m01, farmer: f, date: tomorrow, seq: i + 1, cropName: pick(['Tomato', 'Onion']), qty: round(between(250, 600), 10), queueStatus: 'NOT_JOINED', recordStage: null, slotStart: mStarts[4 + i] })
  );
  // Sangrur today: small queue
  const sStarts = slotStarts(centers.S01);
  [...queueFarmers.slice(40, 46)].forEach((f, i) =>
    addBooking({ center: centers.S01, farmer: f, date: today, seq: i + 1, cropName: pick(['Wheat', 'Paddy']), qty: round(between(1500, 4000), 50), queueStatus: i < 3 ? 'COMPLETED' : 'WAITING', recordStage: i < 3 ? 'COMPLETED' : null, paymentStatus: 'PROCESSING', slotStart: sStarts[i] })
  );

  // Slots for the next 7 days, then apply the seeded bookings to them
  for (const center of Object.values(centers)) {
    for (let d = -10; d < 7; d++) await ensureSlots(center, addDays(today, d));
  }
  const slotDocs = await ProcurementSlot.find().lean();
  const slotByKey = new Map(slotDocs.map((s) => [`${Object.values(centers).find((c) => String(c._id) === String(s.center)).code}|${s.date}|${s.startTime}`, s]));
  for (const b of bookingsToInsert) {
    b.slot = slotByKey.get(b._slotKey)._id;
    delete b._slotKey;
  }
  await ProcurementSlot.bulkWrite(
    [...slotUse.entries()].map(([key, n]) => ({
      updateOne: { filter: { _id: slotByKey.get(key)._id }, update: { $set: { bookedCount: n, capacity: Math.max(n, slotByKey.get(key).capacity) } } }
    }))
  );
  await ProcurementBooking.insertMany(bookingsToInsert);
  await ProcurementRecord.insertMany(recordsToInsert);
  await Payment.insertMany(paymentsToInsert);

  // Wallets reflect money actually paid
  for (const p of paymentsToInsert.filter((x) => x.status === 'PAID')) {
    await User.updateOne({ _id: p.farmer }, { $inc: { walletBalance: p.amount } });
  }

  // Token counters so the next live booking continues the sequence
  const tokenMax = new Map();
  for (const b of bookingsToInsert) {
    const code = Object.values(centers).find((c) => String(c._id) === String(b.center)).code;
    const key = `token:${code}:${b.date}`;
    tokenMax.set(key, Math.max(tokenMax.get(key) || 0, b.tokenSeq));
  }
  await Counter.insertMany([
    ...[...tokenMax.entries()].map(([k, seq]) => ({ _id: k, seq })),
    ...[...counters.entries()].map(([k, seq]) => ({ _id: k, seq })),
    { _id: 'farmer-code', seq: 55 }
  ]);

  // --- Marketplace: produce --------------------------------------------------------
  const produce = [
    // seller, crop, qty, price, min, grade, location, daysAgoHarvested, description
    [lakshmi, 'Tomato', 800, 24, 50, 'A', 'Srirangapatna, Karnataka', 1, 'Hybrid tomatoes, firm and red, picked yesterday.'],
    [suresh, 'Tomato', 1200, 22, 100, 'B', 'Mysuru, Karnataka', 2, 'Mixed sizes, good for cooking and sauces.'],
    [fpoUser1, 'Tomato', 5000, 23, 500, 'A', 'Mandya, Karnataka', 1, 'Aggregated from 42 member farmers. Crated, ready for bulk dispatch.'],
    [suresh, 'Onion', 2000, 19, 100, 'A', 'Mysuru, Karnataka', 6, 'Medium red onions, dried and cured.'],
    [fpoUser1, 'Onion', 6000, 18, 500, 'B', 'Mandya, Karnataka', 8, 'Bulk onions for wholesalers and processors.'],
    [lakshmi, 'Potato', 900, 15, 50, 'B', 'Srirangapatna, Karnataka', 5, 'Table potatoes, washed.'],
    [queueFarmers[3], 'Potato', 1500, 14, 100, 'A', 'Maddur, Karnataka', 4, 'Uniform size, low moisture.'],
    [queueFarmers[5], 'Maize', 3000, 22, 200, 'A', 'Pandavapura, Karnataka', 12, 'Dried yellow maize, 12% moisture.'],
    [queueFarmers[9], 'Groundnut', 700, 63, 50, 'A', 'Mysuru, Karnataka', 15, 'Bold groundnut pods, sun dried.'],
    [queueFarmers[12], 'Paddy', 4000, 24, 500, 'B', 'Mandya, Karnataka', 20, 'Sona Masoori paddy.'],
    [harpreet, 'Wheat', 8000, 27, 500, 'A', 'Sangrur, Punjab', 30, 'HD-3086 wheat, cleaned and graded.'],
    [gurmeet, 'Wheat', 3500, 26, 250, 'B', 'Patiala, Punjab', 35, 'PBW-725, sound grain.'],
    [fpoUser2, 'Wheat', 20000, 26.5, 2000, 'A', 'Barnala, Punjab', 28, 'FPO aggregated lot, stored in warehouse, lab tested.'],
    [fpoUser2, 'Mustard', 5000, 60, 500, 'A', 'Barnala, Punjab', 40, 'Black mustard seed, 38% oil content.'],
    [harpreet, 'Mustard', 1200, 59, 100, 'B', 'Sangrur, Punjab', 45, 'Clean seed, bagged.'],
    [gurmeet, 'Cotton', 2500, 75, 500, 'A', 'Patiala, Punjab', 25, 'Long staple kapas.'],
    [fpoUser2, 'Paddy', 15000, 24.5, 2000, 'A', 'Barnala, Punjab', 10, 'PR-126 paddy, moisture below 17%.'],
    [queueFarmers[15], 'Soyabean', 1800, 48, 100, 'B', 'Mandya, Karnataka', 18, 'JS-335 soyabean.'],
    [queueFarmers[20], 'Tomato', 600, 25, 25, 'A', 'Maddur, Karnataka', 0, 'Picked this morning. Small lot for restaurants.'],
    [queueFarmers[22], 'Onion', 1000, 20, 50, 'A', 'Pandavapura, Karnataka', 9, 'Bangalore rose onions.'],
    [lakshmi, 'Maize', 1500, 21.5, 100, 'B', 'Srirangapatna, Karnataka', 14, 'Feed-grade maize.'],
    [queueFarmers[25], 'Groundnut', 400, 64, 25, 'A', 'Mysuru, Karnataka', 11, 'Hand-sorted pods.']
  ];
  const listings = await Listing.insertMany(
    produce.map(([seller, crop, qty, price, min, grade, place, ago, description], i) => ({
      kind: 'PRODUCE',
      seller: seller._id,
      sellerType: seller.role === 'FPO' ? 'FPO' : 'FARMER',
      sellerName: seller.role === 'FPO' ? fpos[seller === fpoUser1 ? 0 : 1].name : seller.name,
      fpo: seller.role === 'FPO' ? fpos[seller === fpoUser1 ? 0 : 1]._id : undefined,
      crop: crops[crop]._id,
      title: `${grade === 'A' ? 'Grade A ' : ''}${crop}`,
      description,
      quantityAvailable: qty,
      quantityListed: qty,
      unit: 'kg',
      pricePerUnit: price,
      minOrderQuantity: min,
      harvestDate: addDays(today, -ago),
      qualityGrade: grade,
      location: { label: place, ...(seller.location?.lat ? { lat: seller.location.lat, lng: seller.location.lng } : {}) },
      status: 'ACTIVE',
      createdAt: new Date(Date.now() - (ago + 1) * 86400000 + i * 60000)
    }))
  );

  // --- Orders (inventory kept consistent) ---------------------------------------------
  const orderPlan = [
    [buyer1, 0, 200, 'DELIVERED'], [buyer1, 18, 100, 'IN_TRANSIT'], [buyer1, 3, 300, 'READY_FOR_PICKUP'], [buyer1, 5, 150, 'PENDING'],
    [buyer2, 2, 1500, 'READY_FOR_PICKUP'], [buyer2, 4, 2000, 'READY_FOR_PICKUP'], [buyer2, 6, 400, 'DELIVERED'], [buyer2, 10, 2000, 'PENDING'],
    [buyer2, 12, 4000, 'CONFIRMED'], [buyer1, 19, 200, 'CANCELLED'], [buyer2, 7, 600, 'DELIVERED'], [buyer1, 1, 300, 'READY_FOR_PICKUP']
  ];
  const FLOW = ['PENDING', 'CONFIRMED', 'PROCESSING', 'READY_FOR_PICKUP', 'PICKED_UP', 'IN_TRANSIT', 'DELIVERED'];
  const DELIVERY = { READY_FOR_PICKUP: 'PICKUP_READY', PICKED_UP: 'PICKED_UP', IN_TRANSIT: 'IN_TRANSIT', DELIVERED: 'DELIVERED', CANCELLED: 'CANCELLED' };
  const orders = [];
  let odSeq = 0;
  for (const [i, [buyer, li, qty, status]] of orderPlan.entries()) {
    const l = listings[li];
    const subtotal = Math.round(qty * l.pricePerUnit * 100) / 100;
    const created = new Date(Date.now() - (orderPlan.length - i) * 7 * 3600000);
    const steps = status === 'CANCELLED' ? ['PENDING', 'CANCELLED'] : FLOW.slice(0, FLOW.indexOf(status) + 1);
    orders.push({
      orderNumber: `OD-${today.slice(0, 4)}-${String(++odSeq).padStart(5, '0')}`,
      buyer: buyer._id, buyerName: buyer.name, buyerType: buyer.buyerType,
      seller: l.seller, sellerName: l.sellerName, sellerType: l.sellerType,
      listing: l._id,
      item: { title: l.title, crop: l.crop, unit: l.unit, qualityGrade: l.qualityGrade, pickupLocation: l.location.label },
      quantity: qty, unitPrice: l.pricePerUnit, subtotal, deliveryFee: 0, totalAmount: subtotal,
      deliveryAddress: buyer === buyer1 ? 'Hotel Annapoorna, 12 MG Road, Bengaluru 560001' : 'FreshMart DC, Hebbal Industrial Area, Mysuru 570016',
      status, paymentStatus: status === 'DELIVERED' ? 'PAID' : 'PENDING', deliveryStatus: DELIVERY[status] || 'NOT_SCHEDULED',
      history: steps.map((s, k) => ({ status: s, at: new Date(created.getTime() + k * 3600000), by: k === 0 || s === 'DELIVERED' ? buyer._id : l.seller })),
      createdAt: created
    });
    if (status !== 'CANCELLED') {
      await Listing.updateOne({ _id: l._id }, { $inc: { quantityAvailable: -qty } });
    }
    if (status === 'DELIVERED') {
      await User.updateOne({ _id: buyer._id }, { $inc: { walletBalance: -subtotal } });
      await User.updateOne({ _id: l.seller }, { $inc: { walletBalance: subtotal } });
    }
  }
  await Order.insertMany(orders);
  await Listing.updateMany({ kind: 'PRODUCE', quantityAvailable: { $lte: 0 } }, { $set: { status: 'SOLD_OUT' } });
  await Counter.create({ _id: `OD-${today.slice(0, 4)}`, seq: odSeq });

  // --- Marketplace: crop residue (bidding) ----------------------------------------------
  await Listing.insertMany([
    {
      kind: 'RESIDUE', seller: harpreet._id, sellerType: 'FARMER', sellerName: harpreet.name,
      title: 'Wheat Straw', quantityAvailable: 12, quantityListed: 12, unit: 'ton', minOrderQuantity: 12,
      location: { label: 'Sangrur, Punjab', lat: 30.2458, lng: 75.8421 },
      analysis: { residueType: 'Wheat Straw', residueKey: 'wheat_straw', suggestedUses: ['Cattle fodder (bhusa)', 'Paper & board', 'Biomass pellets'], transportFeasibility: 'High', environmentalImpactScore: 8, pricePerTonMin: 4000, pricePerTonMax: 7000, estimatedPriceRange: '₹4,000 - ₹7,000', moistureContent: 'Dry (below ~15%)', co2Saved: 1460 },
      bids: [{ buyer: buyer2._id, buyerName: buyer2.name, pricePerTon: 4300, pickupDate: addDays(today, 3), message: 'Can collect with our own baler and truck.' }],
      status: 'ACTIVE'
    },
    {
      kind: 'RESIDUE', seller: gurmeet._id, sellerType: 'FARMER', sellerName: gurmeet.name,
      title: 'Paddy Straw', quantityAvailable: 8, quantityListed: 8, unit: 'ton', minOrderQuantity: 8,
      location: { label: 'Patiala, Punjab', lat: 30.3398, lng: 76.3869 },
      analysis: { residueType: 'Paddy Straw', residueKey: 'paddy_straw', suggestedUses: ['Biomass power / CBG plant', 'Mushroom cultivation', 'Cardboard & packaging'], transportFeasibility: 'Medium', environmentalImpactScore: 10, pricePerTonMin: 1500, pricePerTonMax: 2500, estimatedPriceRange: '₹1,500 - ₹2,500', moistureContent: 'Slightly damp (~15–25%)', co2Saved: 1460 },
      status: 'ACTIVE'
    }
  ]);

  // --- Household waste pickups (open, claimed, collected) -------------------------------------
  const wasteBase = (owner, kg, degradability, address, status, extra = {}) => ({
    kind: 'HOUSEHOLD', seller: owner._id, sellerType: 'HOUSEHOLD', sellerName: owner.name,
    title: degradability === 'DEGRADABLE' ? 'Degradable household waste' : 'Non-degradable household waste',
    quantityAvailable: status === 'SOLD_OUT' ? 0 : kg, quantityListed: kg, unit: 'kg', degradability,
    location: { label: address, lat: owner.location.lat, lng: owner.location.lng }, status, ...extra
  });
  await Listing.insertMany([
    wasteBase(household1, 6, 'DEGRADABLE', '14, Vijayanagar 2nd Stage, Mysuru', 'ACTIVE', { createdAt: new Date(Date.now() - 3600000) }),
    wasteBase(household2, 9.5, 'DEGRADABLE', '22, Hosahalli Road, Mandya', 'ACTIVE', { createdAt: new Date(Date.now() - 7200000) }),
    wasteBase(household1, 3, 'NON_DEGRADABLE', '14, Vijayanagar 2nd Stage, Mysuru', 'ACTIVE', { createdAt: new Date(Date.now() - 86400000) }),
    wasteBase(household2, 7, 'DEGRADABLE', '22, Hosahalli Road, Mandya', 'RESERVED', { collectedBy: biogas1._id, collectedByName: biogas1.name, claimedAt: new Date(Date.now() - 3 * 3600000), createdAt: new Date(Date.now() - 86400000 * 2) }),
    wasteBase(household1, 12, 'DEGRADABLE', '14, Vijayanagar 2nd Stage, Mysuru', 'SOLD_OUT', { collectedBy: biogas1._id, collectedByName: biogas1.name, claimedAt: new Date(Date.now() - 86400000 * 5), completedAt: new Date(Date.now() - 86400000 * 4), createdAt: new Date(Date.now() - 86400000 * 6) })
  ]);
  await User.updateOne({ _id: household1._id }, { $inc: { carbonPoints: 24 } }); // the collected 12 kg × 2 points

  // --- A few notifications so bells aren't empty -----------------------------------------
  const raviPaid = paymentsToInsert.find((p) => String(p.farmer) === String(ravi._id) && p.status === 'PAID');
  await Notification.insertMany([
    { user: ravi._id, type: 'PAYMENT_UPDATE', title: `Payment received · ₹${Math.round(raviPaid.amount).toLocaleString('en-IN')}`, message: 'Tomato procurement at Mandya Central was paid to your bank account.', isRead: true, createdAt: new Date(Date.now() - 5 * 86400000) },
    { user: ravi._id, type: 'PAYMENT_UPDATE', title: 'Payment processing', message: 'Onion procurement at Mysuru APMC is being paid. It usually takes 1–2 working days.', createdAt: new Date(Date.now() - 2 * 86400000) },
    { user: harpreet._id, type: 'BID_UPDATE', title: 'New bid on your Wheat Straw', message: 'FreshMart Retail offered ₹4,300/t, pickup in 3 days.' },
    { user: harpreet._id, type: 'PAYMENT_UPDATE', title: 'Payment failed', message: 'Wheat procurement: bank account details mismatch. The centre will retry.' }
  ]);

  // --- Village straw pools ---------------------------------------------------------------
  const inDays = (n) => new Date(Date.now() + n * 86400000).toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
  const pickupIn = inDays(14);
  await ResiduePool.insertMany([
    {
      name: 'Kikkeri paddy straw pool', residue: 'Paddy straw', village: 'Kikkeri', district: 'Mandya', state: 'Karnataka',
      minTonnes: 20, deadline: inDays(12), coordinator: lakshmi._id, coordinatorName: lakshmi.name,
      members: [{ farmer: lakshmi._id, name: lakshmi.name, tonnes: 6 }, { farmer: suresh._id, name: suresh.name, tonnes: 4.5 }, { farmer: queueFarmers[0]._id, name: queueFarmers[0].name, tonnes: 3 }]
    },
    {
      name: 'Dhuri wheat straw pool', residue: 'Wheat straw', village: 'Dhuri', district: 'Sangrur', state: 'Punjab',
      minTonnes: 30, deadline: inDays(5), coordinator: harpreet._id, coordinatorName: harpreet.name,
      members: [{ farmer: harpreet._id, name: harpreet.name, tonnes: 18 }, { farmer: gurmeet._id, name: gurmeet.name, tonnes: 14 }],
      bids: [{ buyer: buyer2._id, buyerName: buyer2.name, pricePerTon: 1900, pickupDate: pickupIn, message: 'Baler and trucks arranged. We collect from the field.' }]
    }
  ]);

  // --- Machine rental and a scheme reminder ------------------------------------------------
  const machines = await Machine.insertMany([
    { owner: lakshmi._id, ownerName: lakshmi.name, name: 'Mahindra 475 tractor with rotavator', type: 'TRACTOR', rate: 700, rateUnit: 'PER_HOUR', district: 'Mandya', state: 'Karnataka', description: 'Driver included. Diesel extra.' },
    { owner: suresh._id, ownerName: suresh.name, name: 'Round baler for paddy straw', type: 'BALER', rate: 1200, rateUnit: 'PER_ACRE', district: 'Mysuru', state: 'Karnataka', description: 'Works best on dry straw, after harvest.' },
    { owner: fpoUser2._id, ownerName: fpoUser2.name, name: 'Happy Seeder (FPO machine)', type: 'HAPPY_SEEDER', rate: 1500, rateUnit: 'PER_ACRE', district: 'Barnala', state: 'Punjab', description: 'Sows wheat straight into paddy stubble, so no burning is needed.' },
    { owner: harpreet._id, ownerName: harpreet.name, name: 'Combine harvester', type: 'COMBINE_HARVESTER', rate: 2800, rateUnit: 'PER_HOUR', district: 'Sangrur', state: 'Punjab', description: 'Wheat and paddy.' }
  ]);
  await MachineBooking.create({
    machine: machines[0]._id, owner: lakshmi._id, renter: ravi._id, renterName: ravi.name, machineName: machines[0].name,
    date: inDays(4), quantity: 6, rate: 700, rateUnit: 'PER_HOUR', estimatedTotal: 4200, note: 'Ploughing 3 acres', status: 'REQUESTED'
  });
  await SchemeReminder.create({ user: ravi._id, schemeId: 'pmfby', remindOn: inDays(20), note: 'Enrol the tomato crop' });

  // --- Vehicles for the logistics operator ----------------------------------------------------
  const base = { label: 'Mandya, Karnataka', lat: 12.5218, lng: 76.8951 };
  await Vehicle.insertMany([
    { operator: logistics._id, name: 'Tata Ace mini truck', plate: 'KA11A1234', type: 'MINI_TRUCK', capacityKg: 750, base },
    { operator: logistics._id, name: 'Eicher 14ft truck', plate: 'KA11B5678', type: 'TRUCK', capacityKg: 4000, base },
    { operator: logistics._id, name: 'Mahindra Bolero pickup', plate: 'KA11C9012', type: 'PICKUP', capacityKg: 1200, base }
  ]);

  // --- Intake history for the demand forecast ------------------------------------------------
  // 150 days of SIMULATED daily intake per centre and crop (weekly market-day pattern, a slow seasonal
  // swing, a little growth and noise). The demo procurement records are also made up, so none of this is
  // marked real; real days appear only when a manager completes a lot (recordRealIntake).
  const DOW = [0.6, 1.0, 0.9, 1.1, 1.0, 1.2, 1.4]; // Sunday..Saturday
  const BASE_KG = { Tomato: 2200, Onion: 1800, Potato: 1500, Paddy: 6000, Wheat: 5200, Maize: 2600, Groundnut: 1400, Mustard: 1100, Cotton: 1700 };
  const HIST_DAYS = 150;
  const intakeRows = [];
  for (const def of centerDefs) {
    const c = centers[def.code];
    for (const name of def.crops) {
      const base = (BASE_KG[name] || 1500) * (def.dailyCapacity / 150);
      const phase = between(0, 2 * Math.PI);
      for (let back = HIST_DAYS; back >= 1; back--) {
        const date = new Date(Date.now() - back * 86400000).toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
        const dow = new Date(`${date}T00:00:00Z`).getUTCDay();
        const season = 1 + 0.25 * Math.sin(phase + (2 * Math.PI * (HIST_DAYS - back)) / 120);
        const growth = 1 + 0.0008 * (HIST_DAYS - back);
        const noise = 1 + between(-0.12, 0.12);
        intakeRows.push({ center: c._id, crop: crops[name]._id, date, kg: Math.round(base * DOW[dow] * season * growth * noise), simulated: true });
      }
    }
  }
  await IntakeHistory.insertMany(intakeRows);

  const summary = {
    database: mongoose.connection.name,
    date: today,
    users: await User.countDocuments(),
    centers: await ProcurementCenter.countDocuments(),
    crops: await Crop.countDocuments(),
    bookings: await ProcurementBooking.countDocuments(),
    queueToday: `M01: ${await ProcurementBooking.countDocuments({ center: m01._id, date: today, 'queue.status': 'WAITING' })} waiting, now serving M01-${today.slice(5, 7)}${today.slice(8, 10)}-039`,
    procurementRecords: await ProcurementRecord.countDocuments(),
    payments: await Payment.countDocuments(),
    listings: await Listing.countDocuments(),
    orders: await Order.countDocuments()
  };
  log(summary);
  return summary;
};

// Run directly: node scripts/seedAgriLoop.js
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error('MONGODB_URI is not set');
  await mongoose.connect(uri);
  try {
    await seed();
    console.log(`\nDemo accounts (password for all: ${DEMO_PASSWORD}):`);
    console.log('  Farmer   ravi@agriloop.demo            Manager  manager.karnataka@agriloop.demo');
    console.log('  Buyer    buyer.hotel@agriloop.demo     Manager  manager.punjab@agriloop.demo');
    console.log('  FPO      fpo.mandya@agriloop.demo      Admin    admin@agriloop.demo');
    console.log('  Household household@agriloop.demo      Biogas   biogas@agriloop.demo');
  } finally {
    await mongoose.disconnect();
  }
}
