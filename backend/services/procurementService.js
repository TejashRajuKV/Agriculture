import ProcurementCenter from '../models/ProcurementCenter.js';
import ProcurementSlot from '../models/ProcurementSlot.js';
import ProcurementBooking from '../models/ProcurementBooking.js';
import ProcurementRecord from '../models/ProcurementRecord.js';
import Payment from '../models/Payment.js';
import Crop from '../models/Crop.js';
import { Roles } from '../models/User.js';
import { canManageCenter } from '../middleware/auth.js';
import { badRequest, conflict, forbidden, notFound } from '../utils/httpError.js';
import * as v from '../utils/validate.js';
import { todayIST, nowMinutesIST, toMinutes, fromMinutes, daysBetween } from '../utils/dates.js';
import { distanceKm } from '../utils/geo.js';
import { nextDocumentNumber, nextToken } from './counterService.js';
import { notify } from './notificationService.js';
import { delayView } from './paymentDelays.js';

export const BOOKING_WINDOW_DAYS = 7; // today + next 6 days
const ACTIVE_QUEUE = ['WAITING', 'CALLED', 'PROCESSING'];
const HISTORY_SAMPLE = 20;

// ---------------------------------------------------------------------------
// Slots
// ---------------------------------------------------------------------------

// Per-slot capacity: how many farmers the counters can process in one slot,
// capped so the day never exceeds the centre's daily capacity.
export const slotCapacityFor = (center) => {
  const slots = Math.max(1, Math.floor((toMinutes(center.closingTime) - toMinutes(center.openingTime)) / center.slotMinutes));
  const byThroughput = Math.max(1, Math.floor((center.slotMinutes * center.counters) / center.avgProcessingMinutes));
  const byDailyCap = Math.max(1, Math.floor(center.dailyCapacity / slots));
  return Math.min(byThroughput, byDailyCap);
};

// Materialise the day's slots from the centre's configuration. Idempotent: the
// unique (center, date, startTime) index means repeated calls never duplicate.
export const ensureSlots = async (center, date) => {
  const open = toMinutes(center.openingTime);
  const close = toMinutes(center.closingTime);
  const capacity = slotCapacityFor(center);
  const ops = [];
  for (let t = open; t + center.slotMinutes <= close; t += center.slotMinutes) {
    ops.push({
      updateOne: {
        filter: { center: center._id, date, startTime: fromMinutes(t) },
        update: { $setOnInsert: { endTime: fromMinutes(t + center.slotMinutes), capacity, bookedCount: 0, status: 'OPEN' } },
        upsert: true
      }
    });
  }
  if (ops.length) await ProcurementSlot.bulkWrite(ops, { ordered: false });
};

const checkDateInWindow = (date) => {
  const today = todayIST();
  const diff = daysBetween(today, date);
  if (diff < 0) throw badRequest('That date is in the past');
  if (diff >= BOOKING_WINDOW_DAYS) throw badRequest(`Slots can be booked up to ${BOOKING_WINDOW_DAYS - 1} days ahead`);
};

const isSlotOver = (slot) => slot.date === todayIST() && toMinutes(slot.endTime) <= nowMinutesIST();

// ---------------------------------------------------------------------------
// Wait-time estimate (deterministic and explainable)
//   wait = people ahead × average minutes per farmer ÷ counters working
// average = mean of the last 20 completed procurements at this centre, or the
// centre's configured value until enough history exists.
// ---------------------------------------------------------------------------
export const averageProcessingMinutes = async (center) => {
  const recent = await ProcurementRecord.find({ center: center._id, processingMinutes: { $gt: 0 } })
    .sort({ completedAt: -1 })
    .limit(HISTORY_SAMPLE)
    .select('processingMinutes')
    .lean();
  if (recent.length >= 3) {
    const avg = recent.reduce((s, r) => s + r.processingMinutes, 0) / recent.length;
    return { minutes: Math.round(avg * 10) / 10, basis: `average of the last ${recent.length} farmers at this centre` };
  }
  return { minutes: center.avgProcessingMinutes, basis: "the centre's standard processing time" };
};

export const estimateWait = (peopleAhead, avgMinutes, counters) => Math.ceil((peopleAhead * avgMinutes) / Math.max(1, counters));

// ---------------------------------------------------------------------------
// Centres
// ---------------------------------------------------------------------------
const loadCenter = async (id) => {
  const center = await ProcurementCenter.findById(v.objectId(id, 'centre id')).populate('crops', 'name unit').populate('cropPrices.crop', 'name');
  if (!center) throw notFound('Procurement centre not found');
  return center;
};

// How long payments at this centre usually take, from its own last 20 paid payments (median, in hours)
export const typicalPayoutHours = async (centerId) => {
  const paid = await Payment.find({ center: centerId, status: 'PAID', paidAt: { $ne: null }, processingAt: { $ne: null } })
    .sort({ paidAt: -1 })
    .limit(20)
    .select('paidAt processingAt')
    .lean();
  if (paid.length < 3) return { hours: null, sample: paid.length };
  const hours = paid.map((p) => (new Date(p.paidAt) - new Date(p.processingAt)) / 3600000).sort((a, b) => a - b);
  const mid = Math.floor(hours.length / 2);
  const median = hours.length % 2 ? hours[mid] : (hours[mid - 1] + hours[mid]) / 2;
  return { hours: Math.round(median * 10) / 10, sample: paid.length };
};

const centerSummary = async (center, user) => {  const today = todayIST();
  await ensureSlots(center, today);

  const [queueCounts, serving, slotsToday, avg, payout] = await Promise.all([
    ProcurementBooking.aggregate([
      { $match: { center: center._id, date: today, status: { $ne: 'CANCELLED' } } },
      { $group: { _id: '$queue.status', n: { $sum: 1 } } }
    ]),
    ProcurementBooking.findOne({ center: center._id, date: today, 'queue.status': { $in: ['CALLED', 'PROCESSING'] } })
      .sort({ 'queue.calledAt': -1 })
      .select('tokenNumber')
      .lean(),
    ProcurementSlot.find({ center: center._id, date: today }).sort({ startTime: 1 }).lean(),
    averageProcessingMinutes(center),
    typicalPayoutHours(center._id)
  ]);

  const counts = Object.fromEntries(queueCounts.map((q) => [q._id, q.n]));
  const inQueue = (counts.WAITING || 0) + (counts.CALLED || 0) + (counts.PROCESSING || 0);
  const booked = slotsToday.reduce((s, x) => s + x.bookedCount, 0);
  const nextToday = slotsToday.find((s) => s.status === 'OPEN' && s.bookedCount < s.capacity && !isSlotOver(s));

  return {
    id: String(center._id),
    code: center.code,
    name: center.name,
    address: center.address,
    district: center.district,
    state: center.state,
    location: { lat: center.lat, lng: center.lng },
    distanceKm: (() => {
      const d = distanceKm(user?.location, { lat: center.lat, lng: center.lng });
      return d == null ? null : Math.round(d * 10) / 10;
    })(),
    openingTime: center.openingTime,
    closingTime: center.closingTime,
    status: center.status,
    crops: (center.crops || []).map((c) => ({ id: String(c._id), name: c.name, unit: c.unit })),
    // What the centre pays and the moisture it will accept, as set by the centre
    prices: (center.cropPrices || [])
      .filter((p) => p.crop)
      .map((p) => ({ cropId: String(p.crop._id), crop: p.crop.name, pricePerKg: p.pricePerKg, maxMoisturePct: p.maxMoisturePct ?? null })),
    pricesUpdatedAt: center.pricesUpdatedAt || null,
    typicalPayout: payout,
    today: {
      date: today,
      dailyCapacity: center.dailyCapacity,
      booked,
      remaining: Math.max(0, center.dailyCapacity - booked),
      inQueue,
      completed: counts.COMPLETED || 0,
      nowServing: serving?.tokenNumber || null,
      estimatedWaitMinutes: estimateWait(inQueue, avg.minutes, center.counters),
      nextAvailableSlot: nextToday ? { date: today, startTime: nextToday.startTime, endTime: nextToday.endTime } : null
    }
  };
};

export const listCenters = async (user, { search } = {}) => {
  const filter = {};
  if (search) {
    const q = String(search).trim().slice(0, 60).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    filter.$or = [{ name: new RegExp(q, 'i') }, { district: new RegExp(q, 'i') }, { state: new RegExp(q, 'i') }, { code: new RegExp(q, 'i') }];
  }
  const centers = await ProcurementCenter.find(filter).populate('crops', 'name unit').populate('cropPrices.crop', 'name');
  const summaries = await Promise.all(centers.map((c) => centerSummary(c, user)));
  // Nearest first when we know where the user is
  return summaries.sort((a, b) => (a.distanceKm ?? 1e9) - (b.distanceKm ?? 1e9) || a.name.localeCompare(b.name));
};

export const getCenter = async (id, user) => centerSummary(await loadCenter(id), user);

export const getSlots = async (centerId, dateParam) => {
  const center = await loadCenter(centerId);
  const date = dateParam ? v.isoDate(dateParam, 'date') : todayIST();
  checkDateInWindow(date);
  await ensureSlots(center, date);
  const [slots, avg] = await Promise.all([
    ProcurementSlot.find({ center: center._id, date }).sort({ startTime: 1 }).lean(),
    averageProcessingMinutes(center)
  ]);
  return {
    center: { id: String(center._id), name: center.name, code: center.code, status: center.status },
    date,
    bookingWindowDays: BOOKING_WINDOW_DAYS,
    averageProcessingMinutes: avg.minutes,
    averageBasis: avg.basis,
    counters: center.counters,
    slots: slots.map((s) => {
      const remaining = Math.max(0, s.capacity - s.bookedCount);
      const past = isSlotOver(s);
      return {
        id: String(s._id),
        startTime: s.startTime,
        endTime: s.endTime,
        capacity: s.capacity,
        booked: s.bookedCount,
        remaining,
        status: s.status,
        available: center.status === 'ACTIVE' && s.status === 'OPEN' && remaining > 0 && !past,
        past,
        // Expected wait inside this slot if everyone already booked arrives first
        estimatedWaitMinutes: estimateWait(s.bookedCount, avg.minutes, center.counters)
      };
    })
  };
};

// ---------------------------------------------------------------------------
// Bookings
// ---------------------------------------------------------------------------
export const createBooking = async (user, body = {}, { bookedBy } = {}) => {
  const slotId = v.objectId(body.slotId, 'slot id');
  const cropId = v.objectId(body.cropId, 'crop id');
  const estimatedQuantity = v.positiveNumber(body.estimatedQuantity, 'Expected quantity (kg)', { max: 100000 });

  const slot = await ProcurementSlot.findById(slotId);
  if (!slot) throw notFound('Slot not found');
  const center = await ProcurementCenter.findById(slot.center);
  if (!center || center.status !== 'ACTIVE') throw conflict('This procurement centre is not accepting bookings');
  checkDateInWindow(slot.date);
  if (slot.status !== 'OPEN') throw conflict('This slot is not open for booking');
  if (isSlotOver(slot)) throw conflict('This slot has already ended');
  if (toMinutes(slot.startTime) < toMinutes(center.openingTime) || toMinutes(slot.endTime) > toMinutes(center.closingTime)) {
    throw conflict('This slot is outside the centre’s operating hours');
  }

  const crop = await Crop.findById(cropId);
  if (!crop) throw notFound('Crop not found');
  if (center.crops?.length && !center.crops.some((c) => String(c) === cropId)) {
    throw badRequest(`${center.name} does not procure ${crop.name}`);
  }

  // Cheap early check (the unique index below is the real guarantee)
  if (await ProcurementBooking.exists({ farmer: user._id, center: center._id, date: slot.date, active: true })) {
    throw conflict('You already have a booking at this centre on this day');
  }

  // Atomically take a place in the slot; fails if the slot filled up meanwhile
  const reserved = await ProcurementSlot.findOneAndUpdate(
    { _id: slot._id, status: 'OPEN', $expr: { $lt: ['$bookedCount', '$capacity'] } },
    { $inc: { bookedCount: 1 } },
    { new: true }
  );
  if (!reserved) throw conflict('Sorry, this slot just filled up. Please pick another time.');

  try {
    const [{ seq, token }, bookingNumber] = await Promise.all([
      nextToken(center.code, slot.date),
      nextDocumentNumber('PR', Number(slot.date.slice(0, 4)))
    ]);
    const booking = await ProcurementBooking.create({
      bookingNumber,
      tokenNumber: token,
      tokenSeq: seq,
      farmer: user._id,
      center: center._id,
      slot: slot._id,
      date: slot.date,
      slotStart: slot.startTime,
      slotEnd: slot.endTime,
      crop: crop._id,
      estimatedQuantity,
      bookedBy,
      status: 'CONFIRMED'
    });

    notify({
      userId: user._id,
      type: 'BOOKING',
      title: `Slot booked · token ${token}`,
      message: `${center.name}, ${slot.date} at ${slot.startTime}. ${estimatedQuantity} kg ${crop.name}. Booking ${bookingNumber}.${bookedBy ? ' Booked for you by the centre.' : ''}`,
      referenceType: 'booking',
      referenceId: booking._id
    });
    return getBookingDetail(user, String(booking._id));
  } catch (err) {
    // Give the place back if the booking could not be written
    await ProcurementSlot.updateOne({ _id: slot._id, bookedCount: { $gt: 0 } }, { $inc: { bookedCount: -1 } });
    if (err?.code === 11000) throw conflict('You already have a booking at this centre on this day');
    throw err;
  }
};

const loadBookingFor = async (user, bookingId) => {
  const booking = await ProcurementBooking.findById(v.objectId(bookingId, 'booking id'))
    .populate('center')
    .populate('crop', 'name unit')
    .populate('farmer', 'name farmerCode phone');
  if (!booking) throw notFound('Booking not found');
  const isOwner = String(booking.farmer._id) === String(user._id);
  if (!isOwner && !canManageCenter(user, booking.center._id)) throw forbidden('This booking belongs to someone else');
  return booking;
};

export const queueView = async (booking) => {
  const center = booking.center;
  const [serving, ahead, waitingTotal, avg] = await Promise.all([
    ProcurementBooking.findOne({ center: center._id, date: booking.date, 'queue.status': { $in: ['CALLED', 'PROCESSING'] } })
      .sort({ 'queue.calledAt': -1 })
      .select('tokenNumber')
      .lean(),
    booking.queue.status === 'WAITING'
      ? ProcurementBooking.countDocuments({
          center: center._id,
          date: booking.date,
          tokenSeq: { $lt: booking.tokenSeq },
          'queue.status': { $in: ACTIVE_QUEUE }
        })
      : Promise.resolve(0),
    ProcurementBooking.countDocuments({ center: center._id, date: booking.date, 'queue.status': 'WAITING' }),
    averageProcessingMinutes(center)
  ]);

  const status = booking.queue.status;
  return {
    token: booking.tokenNumber,
    status,
    nowServing: serving?.tokenNumber || null,
    peopleAhead: status === 'WAITING' ? ahead : 0,
    waitingTotal,
    estimatedWaitMinutes: status === 'WAITING' ? estimateWait(ahead, avg.minutes, center.counters) : 0,
    calculation: {
      averageProcessingMinutes: avg.minutes,
      basis: avg.basis,
      counters: center.counters,
      formula: 'people ahead × average minutes per farmer ÷ counters'
    },
    isToday: booking.date === todayIST(),
    updatedAt: new Date().toISOString()
  };
};

// The decision label comes from the recorded quantities, so it stays correct after
// the record moves on to COMPLETED
const decisionLabel = (r) => {
  if (r.acceptedQuantity == null) return 'Quality decision';
  if (r.acceptedQuantity === 0) return 'Rejected';
  return r.acceptedQuantity < r.weighedQuantity ? 'Partially accepted' : 'Accepted';
};

const TIMELINE = (booking, record, payment) => {
  const r = record || {};
  const steps = [
    { key: 'BOOKED', label: 'Booking confirmed', at: booking.createdAt },
    { key: 'ARRIVED', label: 'Arrived at centre', at: booking.queue.joinedAt },
    { key: 'CALLED', label: 'Token called', at: booking.queue.calledAt },
    { key: 'WEIGHING', label: 'Weighing', at: r.startedAt },
    { key: 'QUALITY_CHECK', label: 'Quality check', at: r.weighedAt },
    { key: 'DECISION', label: decisionLabel(r), at: r.qualityCheckedAt },
    { key: 'PAYMENT_PROCESSING', label: 'Payment processing', at: payment?.processingAt },
    { key: 'PAID', label: 'Paid', at: payment?.paidAt }
  ];
  if (booking.status === 'CANCELLED') return [steps[0], { key: 'CANCELLED', label: 'Cancelled', at: booking.updatedAt, done: true }];
  if (booking.status === 'NO_SHOW') return [...steps.slice(0, 2), { key: 'NO_SHOW', label: 'Marked as no-show', at: booking.updatedAt, done: true }];
  // A rejected lot has nothing to pay
  const relevant = r.acceptedQuantity === 0 ? steps.slice(0, 6) : steps;
  return relevant.map((s) => ({ ...s, done: Boolean(s.at) }));
};

const paymentView = (p) =>
  p && {
    id: String(p._id),
    amount: p.amount,
    status: p.status,
    method: p.method,
    provider: p.provider,
    transactionRef: p.transactionRef || null,
    failureReason: p.failureReason || null,
    delay: delayView(p),
    paidAt: p.paidAt || null
  };

const recordView = (r) =>
  r && {
    id: String(r._id),
    status: r.status,
    declaredQuantity: r.declaredQuantity,
    weighedQuantity: r.weighedQuantity ?? null,
    acceptedQuantity: r.acceptedQuantity ?? null,
    rejectedQuantity: r.rejectedQuantity ?? null,
    qualityGrade: r.qualityGrade || null,
    qualityNotes: r.qualityNotes || '',
    pricePerKg: r.pricePerKg ?? null,
    totalAmount: r.totalAmount ?? null
  };

export const bookingView = (booking, record, payment) => ({
  id: String(booking._id),
  bookingNumber: booking.bookingNumber,
  token: booking.tokenNumber,
  status: booking.status,
  arrivalStatus: booking.arrivalStatus,
  queueStatus: booking.queue.status,
  date: booking.date,
  slot: { start: booking.slotStart, end: booking.slotEnd },
  center: { id: String(booking.center._id), name: booking.center.name, code: booking.center.code, district: booking.center.district },
  crop: { id: String(booking.crop._id), name: booking.crop.name },
  farmer: booking.farmer?.name ? { id: String(booking.farmer._id), name: booking.farmer.name, farmerCode: booking.farmer.farmerCode } : undefined,
  estimatedQuantity: booking.estimatedQuantity,
  procurement: recordView(record),
  payment: paymentView(payment),
  canCancel: ['BOOKED', 'CONFIRMED'].includes(booking.status) && ['NOT_JOINED', 'WAITING'].includes(booking.queue.status),
  canCheckIn: booking.status === 'CONFIRMED' && booking.queue.status === 'NOT_JOINED' && booking.date === todayIST()
});

export const getBookingDetail = async (user, bookingId) => {
  const booking = await loadBookingFor(user, bookingId);
  const record = await ProcurementRecord.findOne({ booking: booking._id }).lean();
  const payment = record ? await Payment.findOne({ procurement: record._id }).lean() : null;
  return {
    ...bookingView(booking, record, payment),
    queue: await queueView(booking),
    timeline: TIMELINE(booking, record, payment)
  };
};

export const getBookingQueue = async (user, bookingId) => queueView(await loadBookingFor(user, bookingId));

export const getBookingStatus = async (user, bookingId) => {
  const booking = await loadBookingFor(user, bookingId);
  const record = await ProcurementRecord.findOne({ booking: booking._id }).lean();
  const payment = record ? await Payment.findOne({ procurement: record._id }).lean() : null;
  return { bookingNumber: booking.bookingNumber, status: booking.status, procurement: recordView(record), payment: paymentView(payment), timeline: TIMELINE(booking, record, payment) };
};

export const listMyBookings = async (user) => {
  const bookings = await ProcurementBooking.find({ farmer: user._id })
    .sort({ date: -1, tokenSeq: -1 })
    .limit(50)
    .populate('center', 'name code district')
    .populate('crop', 'name unit');
  const records = await ProcurementRecord.find({ booking: { $in: bookings.map((b) => b._id) } }).lean();
  const payments = await Payment.find({ procurement: { $in: records.map((r) => r._id) } }).lean();
  const recByBooking = new Map(records.map((r) => [String(r.booking), r]));
  const payByRecord = new Map(payments.map((p) => [String(p.procurement), p]));
  return bookings.map((b) => {
    const r = recByBooking.get(String(b._id));
    return bookingView(b, r, r ? payByRecord.get(String(r._id)) : null);
  });
};

// All of a farmer's payments with the reason for any delay and how long this centre usually takes
export const listMyPayments = async (user) => {
  const payments = await Payment.find({ farmer: user._id })
    .sort({ createdAt: -1 })
    .limit(50)
    .populate('center', 'name state')
    .populate({ path: 'procurement', select: 'recordNumber booking crop acceptedQuantity date', populate: { path: 'crop', select: 'name' } })
    .lean();
  const centerIds = [...new Set(payments.map((p) => String(p.center?._id)))];
  const typical = new Map(await Promise.all(centerIds.map(async (id) => [id, await typicalPayoutHours(id)])));
  return payments.map((p) => ({
    id: String(p._id),
    recordNumber: p.procurement?.recordNumber,
    bookingId: p.procurement?.booking ? String(p.procurement.booking) : null,
    crop: p.procurement?.crop?.name,
    quantityKg: p.procurement?.acceptedQuantity,
    date: p.procurement?.date,
    center: p.center?.name,
    state: p.center?.state,
    amount: p.amount,
    status: p.status,
    method: p.method,
    provider: p.provider,
    transactionRef: p.transactionRef || null,
    startedAt: p.processingAt || p.createdAt,
    paidAt: p.paidAt || null,
    failureReason: p.failureReason || null,
    delay: delayView(p),
    typicalPayout: typical.get(String(p.center?._id)) || { hours: null, sample: 0 }
  }));
};
// Farmer (on arrival) or the centre's manager checks the farmer in -> joins the queue
export const checkIn = async (user, bookingId) => {
  const booking = await loadBookingFor(user, bookingId);
  if (booking.date !== todayIST()) throw conflict('You can only join the queue on the day of your booking');
  const updated = await ProcurementBooking.findOneAndUpdate(
    { _id: booking._id, status: 'CONFIRMED', 'queue.status': 'NOT_JOINED' },
    { $set: { arrivalStatus: 'ARRIVED', 'queue.status': 'WAITING', 'queue.joinedAt': new Date() } },
    { new: true }
  );
  if (!updated) throw conflict('This booking has already joined the queue or is no longer active');
  return getBookingDetail(user, bookingId);
};

export const cancelBooking = async (user, bookingId) => {
  const booking = await loadBookingFor(user, bookingId);
  if (String(booking.farmer._id) !== String(user._id) && user.role !== Roles.ADMIN) throw forbidden('Only the farmer can cancel this booking');
  const updated = await ProcurementBooking.findOneAndUpdate(
    { _id: booking._id, status: { $in: ['BOOKED', 'CONFIRMED'] }, 'queue.status': { $in: ['NOT_JOINED', 'WAITING'] } },
    { $set: { status: 'CANCELLED', active: false, 'queue.status': 'SKIPPED' } },
    { new: true }
  );
  if (!updated) throw conflict('This booking can no longer be cancelled');
  await ProcurementSlot.updateOne({ _id: booking.slot, bookedCount: { $gt: 0 } }, { $inc: { bookedCount: -1 } });
  notify({
    userId: booking.farmer._id,
    type: 'BOOKING',
    title: `Booking ${booking.bookingNumber} cancelled`,
    message: `Your ${booking.slotStart} slot at ${booking.center.name} on ${booking.date} was cancelled.`,
    referenceType: 'booking',
    referenceId: booking._id
  });
  return getBookingDetail(user, bookingId);
};
