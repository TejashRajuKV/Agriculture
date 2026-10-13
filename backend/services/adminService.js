import crypto from 'crypto';
import User, { Roles } from '../models/User.js';
import ProcurementCenter from '../models/ProcurementCenter.js';
import ProcurementBooking from '../models/ProcurementBooking.js';
import ProcurementRecord from '../models/ProcurementRecord.js';
import Payment from '../models/Payment.js';
import Order from '../models/Order.js';
import Listing from '../models/Listing.js';
import ResiduePool from '../models/ResiduePool.js';
import Fpo from '../models/Fpo.js';
import AuditLog from '../models/AuditLog.js';
import { Delivery, Vehicle } from '../models/Logistics.js';
import { Machine } from '../models/Machine.js';
import { badRequest, conflict, forbidden, notFound } from '../utils/httpError.js';
import * as v from '../utils/validate.js';
import { todayIST, addDays } from '../utils/dates.js';
import { hashPassword } from './authService.js';

const TZ = 'Asia/Kolkata';
const round1 = (n) => Math.round(n * 10) / 10;
const HOURS = 3600000;
const STAFF_ROLES = [Roles.PROCUREMENT_MANAGER, Roles.LOGISTICS_OPERATOR, Roles.ADMIN];

const audit = (actor, action, target, details) =>
  AuditLog.create({ actor: actor._id, actorName: actor.name, action, target, details });

const dayKey = (field) => ({ $dateToString: { format: '%Y-%m-%d', date: field, timezone: TZ } });
// Fill days with no activity so charts have no gaps
const series = (rows, from, days, pick) => {
  const map = new Map(rows.map((r) => [r._id, r]));
  return Array.from({ length: days }, (_, i) => {
    const date = addDays(from, i);
    return { date, ...pick(map.get(date)) };
  });
};

// ---------------------------------------------------------------------------
// Overview
// ---------------------------------------------------------------------------
export const overview = async () => {
  const today = todayIST();
  const from30 = addDays(today, -29);
  const since30 = new Date(Date.now() - 30 * 24 * HOURS);

  const [roles, signups, bookings, intake, payments, orderStats, ordersDaily, listings, pools, machines, trips] = await Promise.all([
    User.aggregate([{ $group: { _id: '$role', n: { $sum: 1 }, suspended: { $sum: { $cond: ['$disabled', 1, 0] } } } }]),
    User.aggregate([{ $match: { createdAt: { $gte: since30 } } }, { $group: { _id: dayKey('$createdAt'), n: { $sum: 1 } } }]),
    ProcurementBooking.aggregate([
      { $match: { date: { $gte: from30, $lte: today } } },
      { $group: { _id: '$date', booked: { $sum: 1 }, completed: { $sum: { $cond: [{ $eq: ['$status', 'COMPLETED'] }, 1, 0] } }, noShow: { $sum: { $cond: [{ $eq: ['$queue.status', 'SKIPPED'] }, 1, 0] } } } }
    ]),
    ProcurementRecord.aggregate([
      { $match: { date: { $gte: from30, $lte: today }, acceptedQuantity: { $gt: 0 } } },
      { $group: { _id: '$date', kg: { $sum: '$acceptedQuantity' }, value: { $sum: '$totalAmount' } } }
    ]),
    Payment.aggregate([{ $group: { _id: '$status', n: { $sum: 1 }, amount: { $sum: '$amount' } } }]),
    Order.aggregate([{ $group: { _id: '$status', n: { $sum: 1 }, amount: { $sum: '$totalAmount' } } }]),
    Order.aggregate([
      { $match: { createdAt: { $gte: since30 }, status: { $ne: 'CANCELLED' } } },
      { $group: { _id: dayKey('$createdAt'), orders: { $sum: 1 }, gmv: { $sum: '$totalAmount' } } }
    ]),
    Listing.aggregate([{ $match: { status: 'ACTIVE' } }, { $group: { _id: '$kind', n: { $sum: 1 } } }]),
    ResiduePool.aggregate([{ $group: { _id: '$status', n: { $sum: 1 } } }]),
    Machine.countDocuments({ active: true }),
    Delivery.aggregate([{ $group: { _id: '$status', n: { $sum: 1 } } }])
  ]);

  const by = (rows, key = '_id') => Object.fromEntries(rows.map((r) => [r[key], r]));
  const pay = by(payments);
  const ord = by(orderStats);
  const bookingTotals = bookings.reduce((s, b) => ({ booked: s.booked + b.booked, completed: s.completed + b.completed, noShow: s.noShow + b.noShow }), { booked: 0, completed: 0, noShow: 0 });

  return {
    asOf: new Date().toISOString(),
    users: {
      total: roles.reduce((s, r) => s + r.n, 0),
      suspended: roles.reduce((s, r) => s + r.suspended, 0),
      byRole: Object.fromEntries(roles.map((r) => [r._id, r.n])),
      newLast30Days: signups.reduce((s, r) => s + r.n, 0)
    },
    procurement: {
      last30Days: {
        bookings: bookingTotals.booked,
        completed: bookingTotals.completed,
        noShows: bookingTotals.noShow,
        noShowRatePercent: bookingTotals.booked ? round1((bookingTotals.noShow / bookingTotals.booked) * 100) : 0,
        procuredKg: Math.round(intake.reduce((s, r) => s + r.kg, 0)),
        procuredValue: Math.round(intake.reduce((s, r) => s + r.value, 0))
      }
    },
    payments: {
      pending: { count: (pay.PENDING?.n || 0) + (pay.PROCESSING?.n || 0), amount: Math.round((pay.PENDING?.amount || 0) + (pay.PROCESSING?.amount || 0)) },
      failed: { count: pay.FAILED?.n || 0, amount: Math.round(pay.FAILED?.amount || 0) },
      paid: { count: pay.PAID?.n || 0, amount: Math.round(pay.PAID?.amount || 0) }
    },
    marketplace: {
      activeProduce: by(listings).PRODUCE?.n || 0,
      activeResidue: by(listings).RESIDUE?.n || 0,
      openPools: by(pools).OPEN?.n || 0,
      machinesListed: machines,
      ordersByStatus: Object.fromEntries(orderStats.map((r) => [r._id, r.n])),
      gmv30Days: Math.round(ordersDaily.reduce((s, r) => s + r.gmv, 0)),
      delivered: { count: ord.DELIVERED?.n || 0, amount: Math.round(ord.DELIVERED?.amount || 0) }
    },
    logistics: { trips: Object.fromEntries(trips.map((r) => [r._id, r.n])) },
    charts: {
      procuredKg: series(intake, from30, 30, (r) => ({ kg: Math.round(r?.kg || 0) })),
      bookings: series(bookings, from30, 30, (r) => ({ booked: r?.booked || 0, completed: r?.completed || 0 })),
      orders: series(ordersDaily, from30, 30, (r) => ({ orders: r?.orders || 0, gmv: Math.round(r?.gmv || 0) })),
      signups: series(signups, from30, 30, (r) => ({ n: r?.n || 0 }))
    }
  };
};

// ---------------------------------------------------------------------------
// Things that need a person to look at them
// ---------------------------------------------------------------------------
export const attention = async () => {
  const now = Date.now();
  const today = todayIST();
  const items = [];

  const [stuck, failed, ready, openPools, queues] = await Promise.all([
    Payment.find({ status: { $in: ['PENDING', 'PROCESSING'] }, $or: [{ processingAt: { $lt: new Date(now - 48 * HOURS) } }, { processingAt: null, createdAt: { $lt: new Date(now - 48 * HOURS) } }] }).populate('center', 'name').limit(50),
    Payment.find({ status: 'FAILED' }).populate('center', 'name').limit(50),
    Order.find({ status: 'READY_FOR_PICKUP', 'delivery.trip': null, updatedAt: { $lt: new Date(now - 24 * HOURS) } }).select('orderNumber updatedAt').limit(50),
    ResiduePool.find({ status: 'OPEN', deadline: { $lt: today } }).select('name deadline').limit(50),
    ProcurementBooking.aggregate([
      { $match: { date: today, 'queue.status': 'WAITING' } },
      { $group: { _id: '$center', waiting: { $sum: 1 } } },
      { $match: { waiting: { $gte: 30 } } }
    ])
  ]);

  const byCentre = (rows) => {
    const m = new Map();
    rows.forEach((p) => m.set(p.center?.name || 'Unknown centre', (m.get(p.center?.name || 'Unknown centre') || 0) + 1));
    return [...m.entries()];
  };
  for (const [name, n] of byCentre(stuck)) items.push({ severity: 'HIGH', kind: 'PAYMENT_STUCK', text: `${n} payment${n === 1 ? '' : 's'} at ${name} not settled after 48 hours` });
  for (const [name, n] of byCentre(failed)) items.push({ severity: 'MEDIUM', kind: 'PAYMENT_FAILED', text: `${n} failed payment${n === 1 ? '' : 's'} at ${name}` });
  if (ready.length) items.push({ severity: 'MEDIUM', kind: 'ORDER_WAITING', text: `${ready.length} order${ready.length === 1 ? ' has' : 's have'} waited over 24 hours for a delivery vehicle (${ready.slice(0, 3).map((o) => o.orderNumber).join(', ')}${ready.length > 3 ? '…' : ''})` });
  if (openPools.length) items.push({ severity: 'LOW', kind: 'POOL_EXPIRED', text: `${openPools.length} village pool${openPools.length === 1 ? ' is' : 's are'} past the join deadline and still open (${openPools.slice(0, 3).map((p) => p.name).join(', ')})` });
  if (queues.length) {
    const centers = await ProcurementCenter.find({ _id: { $in: queues.map((q) => q._id) } }).select('name');
    for (const q of queues) items.push({ severity: 'MEDIUM', kind: 'LONG_QUEUE', text: `${centers.find((c) => String(c._id) === String(q._id))?.name}: ${q.waiting} farmers waiting in the queue today` });
  }
  const order = { HIGH: 0, MEDIUM: 1, LOW: 2 };
  return items.sort((a, b) => order[a.severity] - order[b.severity]);
};

// ---------------------------------------------------------------------------
// Centre capacity and health
// ---------------------------------------------------------------------------
export const centres = async () => {
  const today = todayIST();
  const from14 = addDays(today, -13);
  const list = await ProcurementCenter.find().sort({ name: 1 });
  const ids = list.map((c) => c._id);

  const [daily, queue, pays, managers, recs] = await Promise.all([
    ProcurementBooking.aggregate([{ $match: { center: { $in: ids }, date: { $gte: from14, $lte: today }, status: { $ne: 'CANCELLED' } } }, { $group: { _id: { c: '$center', d: '$date' }, booked: { $sum: 1 }, done: { $sum: { $cond: [{ $eq: ['$status', 'COMPLETED'] }, 1, 0] } } } }]),
    ProcurementBooking.aggregate([{ $match: { center: { $in: ids }, date: today } }, { $group: { _id: '$center', waiting: { $sum: { $cond: [{ $eq: ['$queue.status', 'WAITING'] }, 1, 0] } }, booked: { $sum: 1 } } }]),
    Payment.aggregate([{ $match: { center: { $in: ids }, status: { $ne: 'PAID' } } }, { $group: { _id: { c: '$center', s: '$status' }, n: { $sum: 1 }, amount: { $sum: '$amount' }, oldest: { $min: '$createdAt' } } }]),
    User.find({ role: Roles.PROCUREMENT_MANAGER, centerIds: { $in: ids } }).select('name email centerIds disabled'),
    ProcurementRecord.aggregate([{ $match: { center: { $in: ids }, processingMinutes: { $gt: 0 } } }, { $sort: { completedAt: -1 } }, { $group: { _id: '$center', minutes: { $push: '$processingMinutes' } } }])
  ]);

  return list.map((c) => {
    const mine = daily.filter((d) => String(d._id.c) === String(c._id));
    const booked14 = mine.reduce((s, d) => s + d.booked, 0);
    const done14 = mine.reduce((s, d) => s + d.done, 0);
    const q = queue.find((x) => String(x._id) === String(c._id));
    const unpaid = pays.filter((p) => String(p._id.c) === String(c._id));
    const mins = (recs.find((r) => String(r._id) === String(c._id))?.minutes || []).slice(0, 20);
    const oldest = unpaid.reduce((o, p) => (!o || p.oldest < o ? p.oldest : o), null);
    return {
      id: String(c._id),
      code: c.code,
      name: c.name,
      district: c.district,
      state: c.state,
      status: c.status,
      counters: c.counters,
      dailyCapacity: c.dailyCapacity,
      avgBookedPerDay14: round1(booked14 / 14),
      utilizationPercent14: c.dailyCapacity ? round1((booked14 / 14 / c.dailyCapacity) * 100) : null,
      completionRatePercent14: booked14 ? round1((done14 / booked14) * 100) : null,
      today: { booked: q?.booked || 0, waiting: q?.waiting || 0 },
      avgProcessingMinutes: mins.length ? round1(mins.reduce((s, m) => s + m, 0) / mins.length) : null,
      unpaid: {
        count: unpaid.reduce((s, p) => s + p.n, 0),
        failed: unpaid.find((p) => p._id.s === 'FAILED')?.n || 0,
        amount: Math.round(unpaid.reduce((s, p) => s + p.amount, 0)),
        oldestHours: oldest ? Math.round((Date.now() - new Date(oldest).getTime()) / HOURS) : null
      },
      managers: managers.filter((m) => m.centerIds.some((id) => String(id) === String(c._id))).map((m) => ({ id: String(m._id), name: m.name, email: m.email, suspended: m.disabled }))
    };
  });
};

export const fpos = async () => {
  const rows = await Fpo.find().sort({ name: 1 });
  const ids = rows.flatMap((f) => f.members.map((m) => m.farmer));
  const unpaid = await Payment.aggregate([{ $match: { farmer: { $in: ids }, status: { $ne: 'PAID' } } }, { $group: { _id: '$farmer', amount: { $sum: '$amount' } } }]);
  const owed = new Map(unpaid.map((u) => [String(u._id), u.amount]));
  return rows.map((f) => ({
    id: String(f._id),
    name: f.name,
    registrationNumber: f.registrationNumber,
    location: f.location,
    contactPerson: f.contactPerson,
    members: f.members.length,
    unpaidToMembers: Math.round(f.members.reduce((s, m) => s + (owed.get(String(m.farmer)) || 0), 0))
  }));
};

// ---------------------------------------------------------------------------
// People
// ---------------------------------------------------------------------------
const userRow = (u) => ({
  id: String(u._id),
  name: u.name,
  email: u.email,
  phone: u.phone,
  role: u.role,
  location: u.location?.label || '',
  farmerCode: u.farmerCode || null,
  suspended: Boolean(u.disabled),
  centerIds: (u.centerIds || []).map(String),
  createdAt: u.createdAt
});

export const listUsers = async (q = {}) => {
  const filter = {};
  if (q.role) filter.role = v.oneOf(q.role, 'Role', Object.values(Roles));
  if (q.suspended === 'true') filter.disabled = true;
  if (q.search) {
    const rx = new RegExp(String(q.search).trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    filter.$or = [{ name: rx }, { email: rx }, { phone: rx }, { farmerCode: rx }];
  }
  const page = Math.max(1, Number(q.page) || 1);
  const limit = 25;
  const [rows, total] = await Promise.all([User.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit), User.countDocuments(filter)]);
  return { total, page, pages: Math.max(1, Math.ceil(total / limit)), users: rows.map(userRow) };
};

export const setSuspended = async (admin, id, body = {}) => {
  const user = await User.findById(v.objectId(id, 'user id'));
  if (!user) throw notFound('User not found');
  if (String(user._id) === String(admin._id)) throw forbidden('You cannot suspend your own account');
  if (user.role === Roles.ADMIN) throw forbidden('Admin accounts cannot be suspended here');
  const suspend = Boolean(body.suspended);
  const reason = v.optionalString(body.reason, 'Reason', { max: 200 });
  if (suspend && !reason) throw badRequest('Give a reason so the action can be reviewed later');
  user.disabled = suspend;
  await user.save();
  await audit(admin, suspend ? 'USER_SUSPENDED' : 'USER_RESTORED', `${user.name} <${user.email}>`, { reason });
  return userRow(user);
};

export const assignCentres = async (admin, id, body = {}) => {
  const user = await User.findById(v.objectId(id, 'user id'));
  if (!user) throw notFound('User not found');
  if (user.role !== Roles.PROCUREMENT_MANAGER) throw badRequest('Only procurement managers are assigned to centres');
  const ids = (Array.isArray(body.centerIds) ? body.centerIds : []).map((c) => v.objectId(c, 'centre id'));
  if (ids.length !== new Set(ids).size) throw badRequest('A centre is listed twice');
  const found = await ProcurementCenter.countDocuments({ _id: { $in: ids } });
  if (found !== ids.length) throw notFound('One of the centres does not exist');
  const before = (user.centerIds || []).map(String);
  user.centerIds = ids;
  await user.save();
  await audit(admin, 'CENTRES_ASSIGNED', `${user.name} <${user.email}>`, { before, after: ids });
  return userRow(user);
};

// Staff accounts cannot self-register. The temporary password is shown once, to the admin only.
export const createStaff = async (admin, body = {}) => {
  const role = v.oneOf(body.role, 'Role', STAFF_ROLES);
  const email = v.email(body.email);
  if (await User.exists({ email })) throw conflict('An account with this email already exists');
  const temporaryPassword = `Agri-${crypto.randomBytes(6).toString('base64url')}`;
  const user = await User.create({
    name: v.requiredString(body.name, 'Name', { min: 2, max: 80 }),
    email,
    phone: v.phone(body.phone),
    role,
    passwordHash: await hashPassword(temporaryPassword),
    location: { label: v.optionalString(body.location, 'Location', { max: 120 }) || '' }
  });
  await audit(admin, 'STAFF_CREATED', `${user.name} <${user.email}>`, { role });
  return { user: userRow(user), temporaryPassword, note: 'Share this password privately. It is not shown again.' };
};

export const auditLog = async (q = {}) => {
  const rows = await AuditLog.find().sort({ createdAt: -1 }).limit(Math.min(Number(q.limit) || 50, 200));
  return rows.map((r) => ({ id: String(r._id), at: r.createdAt, actor: r.actorName, action: r.action, target: r.target, details: r.details }));
};

export const fleetSummary = async () => ({
  vehicles: Object.fromEntries((await Vehicle.aggregate([{ $group: { _id: '$status', n: { $sum: 1 } } }])).map((r) => [r._id, r.n]))
});
