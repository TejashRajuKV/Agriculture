import { Machine, MachineBooking, MachineTypes, RateUnits } from '../models/Machine.js';
import { Roles } from '../models/User.js';
import { badRequest, conflict, forbidden, notFound } from '../utils/httpError.js';
import * as v from '../utils/validate.js';
import { todayIST, addDays } from '../utils/dates.js';
import { notify } from './notificationService.js';

const inr = (n) => `₹${Math.round(n).toLocaleString('en-IN')}`;
const people = [Roles.FARMER, Roles.FPO];
const UNIT_TEXT = { PER_HOUR: 'hour', PER_ACRE: 'acre', PER_DAY: 'day' };
const WINDOW_DAYS = 30;
const same = (a, b) => String(a?._id || a) === String(b?._id || b);

const machineView = (m, user) => ({
  id: String(m._id),
  name: m.name,
  type: m.type,
  rate: m.rate,
  rateUnit: m.rateUnit,
  district: m.district,
  state: m.state,
  description: m.description || '',
  active: m.active,
  owner: { id: String(m.owner), name: m.ownerName },
  mine: Boolean(user && same(m.owner, user._id))
});

const bookingView = (b, user) => ({
  id: String(b._id),
  machineId: String(b.machine),
  machineName: b.machineName,
  date: b.date,
  quantity: b.quantity,
  rate: b.rate,
  rateUnit: b.rateUnit,
  estimatedTotal: b.estimatedTotal,
  note: b.note || '',
  status: b.status,
  renter: { id: String(b.renter), name: b.renterName },
  owner: String(b.owner),
  role: same(b.owner, user._id) ? 'OWNER' : 'RENTER'
});

const parts = (user) => String(user.location?.label || '').split(',').map((s) => s.trim()).filter(Boolean);

export const listMachines = async (user, q = {}) => {
  const filter = {};
  if (q.mine === 'true') filter.owner = user._id;
  else filter.active = true;
  if (q.type) filter.type = v.oneOf(q.type, 'Type', MachineTypes);
  if (q.state) filter.state = String(q.state);
  if (q.district) filter.district = String(q.district);
  const rows = await Machine.find(filter).sort({ createdAt: -1 }).limit(100);
  return rows.map((m) => machineView(m, user));
};

export const createMachine = async (user, body = {}) => {
  if (!people.includes(user.role)) throw forbidden('Only farmers and FPOs can list machines');
  const loc = parts(user);
  const m = await Machine.create({
    owner: user._id,
    ownerName: user.name,
    name: v.requiredString(body.name, 'Machine name', { max: 80 }),
    type: v.oneOf(body.type, 'Type', MachineTypes),
    rate: v.number(body.rate, 'Rate (₹)', { min: 0, max: 100000 }),
    rateUnit: v.oneOf(body.rateUnit, 'Rate unit', RateUnits),
    district: v.requiredString(body.district || loc[0], 'District', { max: 60 }),
    state: v.requiredString(body.state || (loc.length > 1 ? loc.at(-1) : ''), 'State', { max: 60 }),
    description: v.optionalString(body.description, 'Description', { max: 300 })
  });
  return machineView(m, user);
};

export const updateMachine = async (user, id, body = {}) => {
  const m = await Machine.findById(v.objectId(id, 'machine id'));
  if (!m) throw notFound('Machine not found');
  if (!same(m.owner, user._id)) throw forbidden('Only the owner can change this machine');
  if (body.rate !== undefined) m.rate = v.number(body.rate, 'Rate (₹)', { min: 0, max: 100000 });
  if (body.active !== undefined) m.active = Boolean(body.active);
  if (body.description !== undefined) m.description = v.optionalString(body.description, 'Description', { max: 300 });
  await m.save();
  return machineView(m, user);
};

// Dates already taken, so the renter can see what is free
export const availability = async (user, id) => {
  const m = await Machine.findById(v.objectId(id, 'machine id'));
  if (!m) throw notFound('Machine not found');
  const today = todayIST();
  const booked = await MachineBooking.find({ machine: m._id, status: 'ACCEPTED', date: { $gte: today, $lte: addDays(today, WINDOW_DAYS) } }).select('date');
  return { machineId: String(m._id), windowDays: WINDOW_DAYS, bookedDates: booked.map((b) => b.date).sort() };
};

export const requestBooking = async (user, id, body = {}) => {
  if (!people.includes(user.role)) throw forbidden('Only farmers and FPOs can rent machines');
  const m = await Machine.findById(v.objectId(id, 'machine id'));
  if (!m || !m.active) throw notFound('Machine not found or not available');
  if (same(m.owner, user._id)) throw badRequest('This is your own machine');
  const date = v.isoDate(body.date, 'Date');
  const today = todayIST();
  if (date < today || date > addDays(today, WINDOW_DAYS)) throw badRequest(`Pick a date in the next ${WINDOW_DAYS} days`);
  const quantity = v.number(body.quantity, `Number of ${UNIT_TEXT[m.rateUnit]}s`, { min: 0.5, max: 1000 });
  if (await MachineBooking.exists({ machine: m._id, date, status: 'ACCEPTED' })) throw conflict('This machine is already booked on that day. Pick another day.');
  if (await MachineBooking.exists({ machine: m._id, renter: user._id, date, status: { $in: ['REQUESTED', 'ACCEPTED'] } })) throw conflict('You already asked for this machine on that day');

  const b = await MachineBooking.create({
    machine: m._id, owner: m.owner, renter: user._id, renterName: user.name, machineName: m.name,
    date, quantity, rate: m.rate, rateUnit: m.rateUnit, estimatedTotal: Math.round(m.rate * quantity),
    note: v.optionalString(body.note, 'Note', { max: 200 })
  });
  notify({
    userId: m.owner, type: 'BOOKING',
    title: `Rental request · ${m.name}`,
    message: `${user.name} wants it on ${date} for ${quantity} ${UNIT_TEXT[m.rateUnit]}(s), about ${inr(b.estimatedTotal)}.`,
    referenceType: 'machine-booking', referenceId: b._id
  });
  return bookingView(b, user);
};

export const listBookings = async (user, q = {}) => {
  const filter = q.as === 'owner' ? { owner: user._id } : { renter: user._id };
  const rows = await MachineBooking.find(filter).sort({ date: -1 }).limit(100);
  return rows.map((b) => bookingView(b, user));
};

const loadBooking = async (id) => {
  const b = await MachineBooking.findById(v.objectId(id, 'booking id'));
  if (!b) throw notFound('Booking not found');
  return b;
};

export const acceptBooking = async (user, id) => {
  const b = await loadBooking(id);
  if (!same(b.owner, user._id)) throw forbidden('Only the owner can accept');
  if (b.date < todayIST()) throw conflict('That day has already passed');
  let updated;
  try {
    updated = await MachineBooking.findOneAndUpdate({ _id: b._id, status: 'REQUESTED' }, { $set: { status: 'ACCEPTED' } }, { new: true });
  } catch (err) {
    // The unique index stops two renters getting the same machine on the same day
    if (err?.code === 11000) throw conflict('You already accepted another renter for that day');
    throw err;
  }
  if (!updated) throw conflict('This request can no longer be accepted');
  notify({ userId: b.renter, type: 'BOOKING', title: `Machine confirmed · ${b.machineName}`, message: `${b.date}. Total about ${inr(b.estimatedTotal)}, paid directly to ${user.name}.`, referenceType: 'machine-booking', referenceId: b._id });
  return bookingView(updated, user);
};

export const declineBooking = async (user, id) => {
  const b = await loadBooking(id);
  if (!same(b.owner, user._id)) throw forbidden('Only the owner can decline');
  const updated = await MachineBooking.findOneAndUpdate({ _id: b._id, status: 'REQUESTED' }, { $set: { status: 'DECLINED' } }, { new: true });
  if (!updated) throw conflict('This request can no longer be declined');
  notify({ userId: b.renter, type: 'BOOKING', title: `Machine not available · ${b.machineName}`, message: `${user.name} could not give it on ${b.date}. Try another day or machine.`, referenceType: 'machine-booking', referenceId: b._id });
  return bookingView(updated, user);
};

export const cancelBooking = async (user, id) => {
  const b = await loadBooking(id);
  const isRenter = same(b.renter, user._id);
  if (!isRenter && !same(b.owner, user._id)) throw forbidden('Not your booking');
  const updated = await MachineBooking.findOneAndUpdate({ _id: b._id, status: { $in: ['REQUESTED', 'ACCEPTED'] } }, { $set: { status: 'CANCELLED' } }, { new: true });
  if (!updated) throw conflict('This booking can no longer be cancelled');
  notify({ userId: isRenter ? b.owner : b.renter, type: 'BOOKING', title: `Booking cancelled · ${b.machineName}`, message: `${user.name} cancelled the ${b.date} booking.`, referenceType: 'machine-booking', referenceId: b._id });
  return bookingView(updated, user);
};

export const completeBooking = async (user, id) => {
  const b = await loadBooking(id);
  if (!same(b.owner, user._id)) throw forbidden('Only the owner can mark the job done');
  if (b.date > todayIST()) throw conflict('The job day has not come yet');
  const updated = await MachineBooking.findOneAndUpdate({ _id: b._id, status: 'ACCEPTED' }, { $set: { status: 'COMPLETED' } }, { new: true });
  if (!updated) throw conflict('Only a confirmed booking can be completed');
  return bookingView(updated, user);
};
