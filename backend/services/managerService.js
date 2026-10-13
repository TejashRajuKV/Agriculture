import ProcurementCenter from '../models/ProcurementCenter.js';
import ProcurementBooking from '../models/ProcurementBooking.js';
import ProcurementRecord from '../models/ProcurementRecord.js';
import ProcurementSlot from '../models/ProcurementSlot.js';
import Payment from '../models/Payment.js';
import User, { Roles } from '../models/User.js';
import { canManageCenter } from '../middleware/auth.js';
import { badRequest, conflict, forbidden, notFound } from '../utils/httpError.js';
import * as v from '../utils/validate.js';
import { todayIST } from '../utils/dates.js';
import { notify } from './notificationService.js';
import { recordRealIntake } from '../models/IntakeHistory.js';
import { paymentProvider } from './paymentProvider.js';
import { DELAY_REASONS, DELAY_CODES, delayView } from './paymentDelays.js';
import { averageProcessingMinutes, estimateWait, ensureSlots, getBookingDetail, createBooking } from './procurementService.js';

const round2 = (n) => Math.round(n * 100) / 100;
const inr = (n) => `₹${Math.round(n).toLocaleString('en-IN')}`;
// Be explicit while payments are simulated, so nobody mistakes a demo for a bank transfer
const demoTag = () => (paymentProvider.name === 'SIMULATED' ? ' (demo payment: no real money moved)' : '');

// ---------------------------------------------------------------------------
// Access helpers
// ---------------------------------------------------------------------------
const managedCenter = async (user, centerId) => {
  const id = centerId ? v.objectId(centerId, 'centre id') : user.centerIds?.[0] && String(user.centerIds[0]);
  if (!id) throw badRequest('No procurement centre is assigned to your account');
  if (!canManageCenter(user, id)) throw forbidden('You are not a manager of this centre');
  const center = await ProcurementCenter.findById(id).populate('cropPrices.crop', 'name');
  if (!center) throw notFound('Procurement centre not found');
  return center;
};

const managedBooking = async (user, bookingId) => {
  const booking = await ProcurementBooking.findById(v.objectId(bookingId, 'booking id'))
    .populate('center')
    .populate('crop', 'name')
    .populate('farmer', 'name phone');
  if (!booking) throw notFound('Booking not found');
  if (!canManageCenter(user, booking.center._id)) throw forbidden('You are not a manager of this centre');
  return booking;
};

// Queue-position alerts at two useful moments only - "3rd in line" and
// "you're next" - so farmers aren't flooded as the queue moves.
const ALERT_POSITIONS = [2, 0]; // index among waiting farmers
const notifyUpcoming = async (center, date) => {
  const waiting = await ProcurementBooking.find({ center: center._id, date, 'queue.status': 'WAITING' })
    .sort({ tokenSeq: 1 })
    .limit(3)
    .select('farmer tokenNumber tokenSeq lastNotifiedAhead');
  for (const [i, b] of waiting.entries()) {
    if (!ALERT_POSITIONS.includes(i)) continue;
    if (b.lastNotifiedAhead != null && b.lastNotifiedAhead <= i) continue; // already told this (or closer)
    await ProcurementBooking.updateOne({ _id: b._id }, { lastNotifiedAhead: i });
    notify({
      userId: b.farmer,
      type: 'QUEUE_UPDATE',
      title: i === 0 ? `You're next · ${b.tokenNumber}` : `3rd in line · ${b.tokenNumber}`,
      message: i === 0 ? `Please be ready near the weighing counter at ${center.name}.` : `Two farmers are ahead of you at ${center.name}. Please head to the counter area.`,
      referenceType: 'booking',
      referenceId: b._id
    });
  }
};

// ---------------------------------------------------------------------------
// Overview
// ---------------------------------------------------------------------------
export const listManagedCenters = async (user) => {
  const filter = user.role === Roles.ADMIN ? {} : { _id: { $in: user.centerIds || [] } };
  const centers = await ProcurementCenter.find(filter).select('name code district state').lean();
  return centers.map((c) => ({ id: String(c._id), name: c.name, code: c.code, district: c.district, state: c.state }));
};

export const overview = async (user, { centerId, date } = {}) => {
  const center = await managedCenter(user, centerId);
  const day = date ? v.isoDate(date, 'date') : todayIST();
  await ensureSlots(center, day);

  const [bookings, records, pendingPayments, slots, avg] = await Promise.all([
    ProcurementBooking.find({ center: center._id, date: day, status: { $ne: 'CANCELLED' } })
      .sort({ tokenSeq: 1 })
      .populate('farmer', 'name farmerCode phone')
      .populate('crop', 'name')
      .lean(),
    ProcurementRecord.find({ center: center._id, date: day }).lean(),
    Payment.find({ center: center._id, status: { $in: ['PENDING', 'PROCESSING', 'FAILED'] } })
      .sort({ createdAt: -1 })
      .limit(50)
      .populate('farmer', 'name')
      .populate({ path: 'procurement', select: 'recordNumber acceptedQuantity crop', populate: { path: 'crop', select: 'name' } })
      .lean(),
    ProcurementSlot.find({ center: center._id, date: day }).lean(),
    averageProcessingMinutes(center)
  ]);

  const recByBooking = new Map(records.map((r) => [String(r.booking), r]));
  const count = (status) => bookings.filter((b) => b.queue.status === status).length;
  const completed = records.filter((r) => r.status === 'COMPLETED');
  const booked = slots.reduce((s, x) => s + x.bookedCount, 0);
  const waitingList = bookings.filter((b) => b.queue.status === 'WAITING');
  const active = bookings.filter((b) => ['CALLED', 'PROCESSING'].includes(b.queue.status));
  const nowServing = [...active].sort((a, b) => new Date(b.queue.calledAt) - new Date(a.queue.calledAt))[0];

  const row = (b) => {
    const r = recByBooking.get(String(b._id));
    return {
      bookingId: String(b._id),
      bookingNumber: b.bookingNumber,
      token: b.tokenNumber,
      tokenSeq: b.tokenSeq,
      farmer: b.farmer?.name,
      farmerCode: b.farmer?.farmerCode,
      crop: b.crop?.name,
      cropId: b.crop?._id ? String(b.crop._id) : null,
      estimatedQuantity: b.estimatedQuantity,
      slot: `${b.slotStart}–${b.slotEnd}`,
      queueStatus: b.queue.status,
      arrivalStatus: b.arrivalStatus,
      calledAt: b.queue.calledAt || null,
      procurement: r
        ? {
            status: r.status,
            weighedQuantity: r.weighedQuantity ?? null,
            acceptedQuantity: r.acceptedQuantity ?? null,
            qualityGrade: r.qualityGrade || null,
            pricePerKg: r.pricePerKg ?? null,
            totalAmount: r.totalAmount ?? null
          }
        : null
    };
  };

  return {
    center: {
      id: String(center._id),
      name: center.name,
      code: center.code,
      counters: center.counters,
      dailyCapacity: center.dailyCapacity,
      openingTime: center.openingTime,
      closingTime: center.closingTime,
      cropPrices: (center.cropPrices || []).filter((p) => p.crop).map((p) => ({ cropId: String(p.crop._id), crop: p.crop.name, pricePerKg: p.pricePerKg, maxMoisturePct: p.maxMoisturePct ?? null }))
    },
    date: day,
    centers: await listManagedCenters(user),
    stats: {
      totalBookings: bookings.length,
      checkedIn: bookings.filter((b) => b.arrivalStatus === 'ARRIVED').length,
      notArrived: count('NOT_JOINED'),
      waiting: waitingList.length,
      processing: active.length,
      completed: count('COMPLETED'),
      skipped: count('SKIPPED'),
      quantityProcuredKg: round2(completed.reduce((s, r) => s + (r.acceptedQuantity || 0), 0)),
      procurementValue: round2(completed.reduce((s, r) => s + (r.totalAmount || 0), 0)),
      pendingPayments: pendingPayments.filter((p) => p.status !== 'FAILED').length,
      pendingPaymentAmount: round2(pendingPayments.filter((p) => p.status !== 'FAILED').reduce((s, p) => s + p.amount, 0)),
      averageProcessingMinutes: avg.minutes,
      averageBasis: avg.basis
    },
    utilization: {
      dailyCapacity: center.dailyCapacity,
      booked,
      processed: count('COMPLETED'),
      remaining: Math.max(0, center.dailyCapacity - booked),
      queueLength: waitingList.length + active.length,
      percent: round2((count('COMPLETED') / center.dailyCapacity) * 100),
      bookedPercent: round2((booked / center.dailyCapacity) * 100)
    },
    queue: {
      nowServing: nowServing ? nowServing.tokenNumber : null,
      next: waitingList.slice(0, 5).map(row),
      waitingCount: waitingList.length,
      estimatedClearMinutes: estimateWait(waitingList.length, avg.minutes, center.counters),
      countersBusy: active.length,
      counters: center.counters
    },
    active: active.map(row),
    bookings: bookings.map(row),
    payments: pendingPayments.map((p) => ({
      id: String(p._id),
      farmer: p.farmer?.name,
      recordNumber: p.procurement?.recordNumber,
      crop: p.procurement?.crop?.name,
      acceptedQuantity: p.procurement?.acceptedQuantity,
      amount: p.amount,
      status: p.status,
      transactionRef: p.transactionRef || null,
      failureReason: p.failureReason || null,
      delay: delayView(p)
    }))
  };
};

// ---------------------------------------------------------------------------
// Queue actions
// ---------------------------------------------------------------------------
export const checkInFarmer = async (user, bookingId) => {
  const booking = await managedBooking(user, bookingId);
  if (booking.date !== todayIST()) throw conflict('Farmers can only be checked in on the booking day');
  const updated = await ProcurementBooking.findOneAndUpdate(
    { _id: booking._id, status: 'CONFIRMED', 'queue.status': 'NOT_JOINED' },
    { $set: { arrivalStatus: 'ARRIVED', 'queue.status': 'WAITING', 'queue.joinedAt': new Date() } },
    { new: true }
  );
  if (!updated) throw conflict('This farmer is already in the queue or the booking is not active');
  return getBookingDetail(user, bookingId);
};

export const callBooking = async (user, bookingId) => {
  const booking = await managedBooking(user, bookingId);
  const busy = await ProcurementBooking.countDocuments({ center: booking.center._id, date: booking.date, 'queue.status': { $in: ['CALLED', 'PROCESSING'] } });
  if (busy >= booking.center.counters) {
    throw conflict(`All ${booking.center.counters} counter${booking.center.counters > 1 ? 's are' : ' is'} busy. Finish a farmer first.`);
  }
  const updated = await ProcurementBooking.findOneAndUpdate(
    { _id: booking._id, 'queue.status': 'WAITING' },
    { $set: { 'queue.status': 'CALLED', 'queue.calledAt': new Date() } },
    { new: true }
  );
  if (!updated) throw conflict('Only a waiting farmer can be called');

  notify({
    userId: booking.farmer._id,
    type: 'QUEUE_UPDATE',
    title: `Your token ${booking.tokenNumber} is called`,
    message: `Please come to the weighing counter at ${booking.center.name} now.`,
    referenceType: 'booking',
    referenceId: booking._id
  });
  await notifyUpcoming(booking.center, booking.date);
  return getBookingDetail(user, bookingId);
};

export const callNext = async (user, { centerId } = {}) => {
  const center = await managedCenter(user, centerId);
  const next = await ProcurementBooking.findOne({ center: center._id, date: todayIST(), 'queue.status': 'WAITING' }).sort({ tokenSeq: 1 });
  if (!next) throw conflict('Nobody is waiting in the queue');
  return callBooking(user, String(next._id));
};

export const skipBooking = async (user, bookingId) => {
  const booking = await managedBooking(user, bookingId);
  const updated = await ProcurementBooking.findOneAndUpdate(
    { _id: booking._id, 'queue.status': { $in: ['NOT_JOINED', 'WAITING', 'CALLED'] } },
    { $set: { 'queue.status': 'SKIPPED', status: 'NO_SHOW', active: false } },
    { new: true }
  );
  if (!updated) throw conflict('This farmer can no longer be skipped');
  notify({
    userId: booking.farmer._id,
    type: 'QUEUE_UPDATE',
    title: `Token ${booking.tokenNumber} marked as no-show`,
    message: `You were not present when called at ${booking.center.name}. Please book a new slot.`,
    referenceType: 'booking',
    referenceId: booking._id
  });
  await notifyUpcoming(booking.center, booking.date);
  return getBookingDetail(user, bookingId);
};

// ---------------------------------------------------------------------------
// Procurement pipeline: CALLED -> WEIGHING -> QUALITY_CHECK -> decision -> COMPLETED
// ---------------------------------------------------------------------------
export const startProcurement = async (user, bookingId) => {
  const booking = await managedBooking(user, bookingId);
  const updated = await ProcurementBooking.findOneAndUpdate(
    { _id: booking._id, 'queue.status': 'CALLED' },
    { $set: { 'queue.status': 'PROCESSING', 'queue.startedAt': new Date() } },
    { new: true }
  );
  if (!updated) throw conflict('Call the farmer before starting procurement');

  try {
    await ProcurementRecord.create({
      recordNumber: booking.bookingNumber,
      booking: booking._id,
      farmer: booking.farmer._id,
      center: booking.center._id,
      crop: booking.crop._id,
      date: booking.date,
      declaredQuantity: booking.estimatedQuantity,
      status: 'WEIGHING',
      startedAt: new Date(),
      handledBy: user._id
    });
  } catch (err) {
    await ProcurementBooking.updateOne({ _id: booking._id }, { $set: { 'queue.status': 'CALLED' }, $unset: { 'queue.startedAt': 1 } });
    if (err?.code === 11000) throw conflict('Procurement has already started for this booking');
    throw err;
  }

  notify({
    userId: booking.farmer._id,
    type: 'PROCUREMENT_UPDATE',
    title: `Weighing started · ${booking.tokenNumber}`,
    message: `Your ${booking.crop.name} is being weighed at ${booking.center.name}.`,
    referenceType: 'booking',
    referenceId: booking._id
  });
  return getBookingDetail(user, bookingId);
};

export const recordWeight = async (user, bookingId, body = {}) => {
  const booking = await managedBooking(user, bookingId);
  const weighedQuantity = v.positiveNumber(body.weighedQuantity, 'Weighed quantity (kg)', { max: 100000 });
  const record = await ProcurementRecord.findOneAndUpdate(
    { booking: booking._id, status: 'WEIGHING' },
    { $set: { weighedQuantity: round2(weighedQuantity), status: 'QUALITY_CHECK', weighedAt: new Date() } },
    { new: true }
  );
  if (!record) throw conflict('Weight can only be recorded while the lot is being weighed');
  return getBookingDetail(user, bookingId);
};

export const recordQuality = async (user, bookingId, body = {}) => {
  const booking = await managedBooking(user, bookingId);
  const record = await ProcurementRecord.findOne({ booking: booking._id });
  if (!record || record.status !== 'QUALITY_CHECK') throw conflict('Record the weight before the quality check');

  const qualityGrade = v.oneOf(body.qualityGrade, 'Quality grade', ['A', 'B', 'C', 'REJECT']);
  const acceptedQuantity =
    qualityGrade === 'REJECT' ? 0 : v.number(body.acceptedQuantity, 'Accepted quantity (kg)', { min: 0, max: record.weighedQuantity });
  const defaultPrice = booking.center.cropPrices?.find((p) => String(p.crop) === String(booking.crop._id))?.pricePerKg;
  const pricePerKg = v.number(body.pricePerKg ?? defaultPrice, 'Price per kg (₹)', { min: 0, max: 100000 });
  const qualityNotes = v.optionalString(body.qualityNotes, 'Quality notes', { max: 500 });

  const accepted = round2(acceptedQuantity);
  const status = accepted === 0 ? 'REJECTED' : accepted < record.weighedQuantity ? 'PARTIALLY_ACCEPTED' : 'ACCEPTED';
  const updated = await ProcurementRecord.findOneAndUpdate(
    { _id: record._id, status: 'QUALITY_CHECK' },
    {
      $set: {
        qualityGrade,
        qualityNotes,
        acceptedQuantity: accepted,
        rejectedQuantity: round2(record.weighedQuantity - accepted),
        pricePerKg,
        totalAmount: round2(accepted * pricePerKg),
        status,
        qualityCheckedAt: new Date()
      }
    },
    { new: true }
  );
  if (!updated) throw conflict('Quality has already been recorded for this lot');

  notify({
    userId: booking.farmer._id,
    type: 'PROCUREMENT_UPDATE',
    title: status === 'REJECTED' ? `Lot rejected · ${booking.tokenNumber}` : `Quality grade ${qualityGrade} · ${booking.tokenNumber}`,
    message:
      status === 'REJECTED'
        ? `Your ${booking.crop.name} did not pass the quality check. ${qualityNotes || ''}`.trim()
        : `${accepted} kg accepted of ${record.weighedQuantity} kg at ${inr(pricePerKg)}/kg = ${inr(updated.totalAmount)}.`,
    referenceType: 'booking',
    referenceId: booking._id
  });
  return getBookingDetail(user, bookingId);
};

export const completeProcurement = async (user, bookingId) => {
  const booking = await managedBooking(user, bookingId);
  const record = await ProcurementRecord.findOne({ booking: booking._id });
  if (!record) throw conflict('Procurement has not started');
  const completedAt = new Date();
  const processingMinutes = round2((completedAt - record.startedAt) / 60000);
  const done = await ProcurementRecord.findOneAndUpdate(
    { _id: record._id, status: { $in: ['ACCEPTED', 'PARTIALLY_ACCEPTED', 'REJECTED'] } },
    { $set: { status: 'COMPLETED', completedAt, processingMinutes } },
    { new: true }
  );
  if (!done) throw conflict('Record the quality decision before completing');

  await ProcurementBooking.updateOne(
    { _id: booking._id },
    { $set: { status: 'COMPLETED', active: false, 'queue.status': 'COMPLETED', 'queue.completedAt': completedAt } }
  );

  // Real intake feeds the demand forecast; a failure here must not undo the procurement
  recordRealIntake(done.center, done.crop, done.date, done.acceptedQuantity).catch((err) => console.error('Intake history failed:', err.message));

  if (done.totalAmount > 0) {
    const payment = await Payment.create({
      procurement: done._id,
      farmer: booking.farmer._id,
      center: booking.center._id,
      amount: done.totalAmount,
      provider: paymentProvider.name
    });
    const started = await paymentProvider.initiate({ id: String(payment._id), amount: payment.amount });
    await Payment.updateOne({ _id: payment._id, status: 'PENDING' }, { $set: { ...started, processingAt: new Date() } });
    notify({
      userId: booking.farmer._id,
      type: 'PAYMENT_UPDATE',
      title: `Payment processing · ${inr(done.totalAmount)}`,
      message: `Procurement ${done.recordNumber} completed: ${done.acceptedQuantity} kg ${booking.crop.name}. Ref ${started.transactionRef}.${demoTag()}`,
      referenceType: 'booking',
      referenceId: booking._id
    });
  } else {
    notify({
      userId: booking.farmer._id,
      type: 'PROCUREMENT_UPDATE',
      title: `Procurement ${done.recordNumber} closed`,
      message: 'No quantity was accepted, so there is no payment for this lot.',
      referenceType: 'booking',
      referenceId: booking._id
    });
  }
  await notifyUpcoming(booking.center, booking.date);
  return getBookingDetail(user, bookingId);
};

// ---------------------------------------------------------------------------
// Payments: PROCESSING -> PAID | FAILED, FAILED -> PROCESSING (retry)
// ---------------------------------------------------------------------------
export const updatePayment = async (user, paymentId, body = {}) => {
  const payment = await Payment.findById(v.objectId(paymentId, 'payment id')).populate({
    path: 'procurement',
    select: 'recordNumber booking crop acceptedQuantity',
    populate: { path: 'crop', select: 'name' }
  });
  if (!payment) throw notFound('Payment not found');
  if (!canManageCenter(user, payment.center)) throw forbidden('You are not a manager of this centre');
  const status = v.oneOf(body.status, 'Payment status', ['PAID', 'FAILED', 'PROCESSING']);
  const reason = v.optionalString(body.reason, 'Reason', { max: 200 });
  const code = body.code ? v.oneOf(body.code, 'Reason code', DELAY_CODES) : null;

  let changes;
  let from;
  if (status === 'PROCESSING') {
    from = ['FAILED', 'PENDING'];
    changes = { ...(await paymentProvider.initiate({ id: String(payment._id), amount: payment.amount })), processingAt: new Date(), failureReason: null };
  } else {
    from = ['PROCESSING'];
    changes = await paymentProvider.settle({ id: String(payment._id), transactionRef: payment.transactionRef }, { outcome: status, reason });
  }

  // A failure carries its reason code; any other move clears an old delay note
  const delayFields = status === 'FAILED' && code ? { delayCode: code, delayNote: reason || null, delayAt: new Date(), failureReason: reason || DELAY_REASONS[code].label } : null;
  const update = delayFields ? { $set: { ...changes, ...delayFields } } : { $set: changes, $unset: { delayCode: 1, delayNote: 1, delayAt: 1 } };
  const updated = await Payment.findOneAndUpdate({ _id: payment._id, status: { $in: from } }, update, { new: true });
  if (!updated) throw conflict(`A ${payment.status.toLowerCase()} payment cannot be marked as ${status.toLowerCase()}`);

  if (status === 'PAID') {
    await User.updateOne({ _id: payment.farmer }, { $inc: { walletBalance: payment.amount } });
  }
  notify({
    userId: payment.farmer,
    type: 'PAYMENT_UPDATE',
    title:
      status === 'PAID' ? `Payment received · ${inr(payment.amount)}` : status === 'FAILED' ? 'Payment failed' : `Payment retrying · ${inr(payment.amount)}`,
    message:
      status === 'PAID'
        ? `${payment.procurement?.recordNumber}: ${inr(payment.amount)} paid. Ref ${updated.transactionRef}.${demoTag()}`
        : status === 'FAILED'
          ? `${payment.procurement?.recordNumber}: ${updated.failureReason}.${code ? ` ${DELAY_REASONS[code].farmerAction}` : ' The centre will retry.'}`
          : `${payment.procurement?.recordNumber}: payment is being processed again.`,
    referenceType: 'booking',
    referenceId: payment.procurement?.booking
  });
  return {
    id: String(updated._id),
    status: updated.status,
    amount: updated.amount,
    transactionRef: updated.transactionRef,
    paidAt: updated.paidAt || null,
    failureReason: updated.failureReason || null
  };
};

// Tell the farmer why a payment is late and what (if anything) they need to do
export const noteDelay = async (user, paymentId, body = {}) => {
  const payment = await Payment.findById(v.objectId(paymentId, 'payment id')).populate({ path: 'procurement', select: 'recordNumber booking' });
  if (!payment) throw notFound('Payment not found');
  if (!canManageCenter(user, payment.center)) throw forbidden('You are not a manager of this centre');
  const code = v.oneOf(body.code, 'Reason', DELAY_CODES);
  const note = v.optionalString(body.note, 'Note', { max: 200 });
  const updated = await Payment.findOneAndUpdate(
    { _id: payment._id, status: { $in: ['PENDING', 'PROCESSING', 'FAILED'] } },
    { $set: { delayCode: code, delayNote: note || null, delayAt: new Date() } },
    { new: true }
  );
  if (!updated) throw conflict('Only a payment that has not been paid can have a delay noted');
  notify({
    userId: payment.farmer,
    type: 'PAYMENT_UPDATE',
    title: `Payment delayed · ${DELAY_REASONS[code].label}`,
    message: `${payment.procurement?.recordNumber}: ${DELAY_REASONS[code].farmerAction}${note ? ` (${note})` : ''}`,
    referenceType: 'booking',
    referenceId: payment.procurement?.booking
  });
  return { id: String(updated._id), status: updated.status, delayCode: code };
};

// ---------------------------------------------------------------------------
// What the centre pays and the moisture limit it applies, shown to farmers before they book
// ---------------------------------------------------------------------------
export const setCropPrice = async (user, centerId, body = {}) => {
  const center = await managedCenter(user, centerId);
  const cropId = v.objectId(body.cropId, 'crop id');
  if (!(center.crops || []).some((c) => String(c) === cropId)) throw badRequest('This centre does not buy that crop');
  const pricePerKg = v.number(body.pricePerKg, 'Price per kg (₹)', { min: 0, max: 100000 });
  const maxMoisturePct = body.maxMoisturePct === '' || body.maxMoisturePct == null ? null : v.number(body.maxMoisturePct, 'Moisture limit (%)', { min: 1, max: 60 });

  const existing = center.cropPrices.find((p) => String(p.crop?._id || p.crop) === cropId);
  if (existing) {
    await ProcurementCenter.updateOne(
      { _id: center._id, 'cropPrices.crop': cropId },
      { $set: { 'cropPrices.$.pricePerKg': pricePerKg, 'cropPrices.$.maxMoisturePct': maxMoisturePct, pricesUpdatedAt: new Date() } }
    );
  } else {
    await ProcurementCenter.updateOne({ _id: center._id }, { $push: { cropPrices: { crop: cropId, pricePerKg, maxMoisturePct } }, $set: { pricesUpdatedAt: new Date() } });
  }
  return { cropId, pricePerKg, maxMoisturePct };
};
// ---------------------------------------------------------------------------
// Assisted booking: a farmer phones or walks in; the desk books the slot for them
// ---------------------------------------------------------------------------
export const assistedBooking = async (user, body = {}) => {
  const slotId = v.objectId(body.slotId, 'slot id');
  const slot = await ProcurementSlot.findById(slotId);
  if (!slot) throw notFound('Slot not found');
  if (!canManageCenter(user, slot.center)) throw forbidden('You are not a manager of this centre');

  const phone = v.phone(body.phone).slice(-10);
  if (phone.length !== 10) throw badRequest("Enter the farmer's 10 digit mobile number");
  const matches = await User.find({ phone: new RegExp(`${phone}$`), role: { $in: [Roles.FARMER, Roles.FPO] } });
  if (!matches.length) throw notFound('No farmer account uses this number. Ask them to register first.');
  const farmer = body.farmerCode ? matches.find((m) => m.farmerCode === body.farmerCode) : matches.length === 1 ? matches[0] : null;
  if (!farmer) throw conflict('More than one farmer uses this number. Enter the farmer code to choose one.', { farmers: matches.map((m) => ({ name: m.name, farmerCode: m.farmerCode })) });

  return createBooking(farmer, body, { bookedBy: user._id });
};
