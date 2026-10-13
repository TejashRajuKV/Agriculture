import ResiduePool from '../models/ResiduePool.js';
import User, { Roles } from '../models/User.js';
import { badRequest, conflict, forbidden, notFound } from '../utils/httpError.js';
import * as v from '../utils/validate.js';
import { todayIST, addDays, daysBetween } from '../utils/dates.js';
import { notify } from './notificationService.js';

const inr = (n) => `₹${Math.round(n).toLocaleString('en-IN')}`;
const round1 = (n) => Math.round(n * 10) / 10;
const sum = (rows) => round1((rows || []).reduce((s, m) => s + m.tonnes, 0));
// Carbon points are an app reward: 20 per tonne of straw that is not burnt
export const POINTS_PER_TONNE = 20;
const MAX_DEADLINE_DAYS = 60;
const sellers = [Roles.FARMER, Roles.FPO];

const sameId = (a, b) => String(a?._id || a) === String(b?._id || b);

export const poolView = (p, user) => {
  const total = sum(p.members);
  const today = todayIST();
  const mine = user && p.members.find((m) => sameId(m.farmer, user._id));
  const daysLeft = daysBetween(today, p.deadline);
  const isCoordinator = Boolean(user && sameId(p.coordinator, user._id));
  const canSeeBids = isCoordinator || user?.role === Roles.ADMIN;
  const myBid = user && p.bids.find((b) => sameId(b.buyer, user._id) && b.status !== 'REJECTED');
  return {
    id: String(p._id),
    name: p.name,
    residue: p.residue,
    village: p.village,
    district: p.district,
    state: p.state,
    status: p.status,
    minTonnes: p.minTonnes,
    totalTonnes: total,
    progressPercent: Math.min(100, Math.round((total / p.minTonnes) * 100)),
    reachedMinimum: total >= p.minTonnes,
    deadline: p.deadline,
    daysLeft,
    deadlinePassed: daysLeft < 0,
    coordinator: { id: String(p.coordinator), name: p.coordinatorName },
    memberCount: p.members.length,
    members: isCoordinator || mine ? p.members.map((m) => ({ id: String(m.farmer), name: m.name, tonnes: m.tonnes })) : undefined,
    myTonnes: mine?.tonnes ?? null,
    isCoordinator,
    // Other buyers' prices stay private: the coordinator sees all, a buyer sees their own
    bidCount: p.bids.filter((b) => b.status !== 'REJECTED').length,
    bids: p.bids
      .filter((b) => canSeeBids || (user && sameId(b.buyer, user._id)))
      .map((b) => ({ id: String(b._id), buyerName: b.buyerName, pricePerTon: b.pricePerTon, pickupDate: b.pickupDate, message: b.message, status: b.status, mine: user ? sameId(b.buyer, user._id) : false })),
    myBidId: myBid ? String(myBid._id) : null,
    acceptedBid: p.acceptedBid ? String(p.acceptedBid) : null,
    createdAt: p.createdAt
  };
};

const load = async (id) => {
  const p = await ResiduePool.findById(v.objectId(id, 'pool id'));
  if (!p) throw notFound('Pool not found');
  return p;
};

export const listPools = async (user, q = {}) => {
  const filter = {};
  if (q.state) filter.state = String(q.state);
  if (q.district) filter.district = String(q.district);
  filter.status = q.status ? v.oneOf(q.status, 'Status', ['OPEN', 'RESERVED', 'COLLECTED', 'CANCELLED']) : { $in: ['OPEN', 'RESERVED', 'COLLECTED'] };
  const rows = await ResiduePool.find(filter).sort({ deadline: 1 }).limit(100);
  return rows.map((p) => poolView(p, user));
};

export const getPool = async (user, id) => poolView(await load(id), user);

export const createPool = async (user, body = {}) => {
  if (!sellers.includes(user.role)) throw forbidden('Only farmers and FPOs can start a pool');
  const name = v.requiredString(body.name, 'Pool name', { max: 80 });
  const residue = v.requiredString(body.residue, 'Residue', { max: 60 });
  const minTonnes = v.number(body.minTonnes, 'Minimum tonnes', { min: 1, max: 5000 });
  const myTonnes = v.number(body.myTonnes, 'Your tonnes', { min: 0.1, max: 5000 });
  const deadline = v.isoDate(body.deadline, 'Deadline');
  const today = todayIST();
  if (deadline < today) throw badRequest('The deadline cannot be in the past');
  if (deadline > addDays(today, MAX_DEADLINE_DAYS)) throw badRequest(`The deadline must be within ${MAX_DEADLINE_DAYS} days`);
  // Profiles store one label like "Mandya, Karnataka"; use it when the form leaves these blank
  const parts = String(user.location?.label || '').split(',').map((x) => x.trim()).filter(Boolean);
  const district = v.requiredString(body.district || parts[0], 'District', { max: 60 });
  const state = v.requiredString(body.state || (parts.length > 1 ? parts.at(-1) : ''), 'State', { max: 60 });
  const pool = await ResiduePool.create({
    name, residue, minTonnes, deadline, district, state,
    village: v.optionalString(body.village, 'Village', { max: 60 }),
    coordinator: user._id,
    coordinatorName: user.name,
    members: [{ farmer: user._id, name: user.name, tonnes: myTonnes }]
  });
  return poolView(pool, user);
};

export const joinPool = async (user, id, body = {}) => {
  if (!sellers.includes(user.role)) throw forbidden('Only farmers and FPOs can join a pool');
  const tonnes = v.number(body.tonnes, 'Tonnes', { min: 0.1, max: 5000 });
  const pool = await load(id);
  if (pool.deadline < todayIST()) throw conflict('The deadline for this pool has passed');
  const updated = await ResiduePool.findOneAndUpdate(
    { _id: pool._id, status: 'OPEN', 'members.farmer': { $ne: user._id } },
    { $push: { members: { farmer: user._id, name: user.name, tonnes } } },
    { new: true }
  );
  if (!updated) throw conflict('You are already in this pool, or it is no longer open');
  notify({
    userId: pool.coordinator, type: 'BID_UPDATE',
    title: `${user.name} joined ${pool.name}`,
    message: `${tonnes} t added. Pool is now at ${sum(updated.members)} of ${pool.minTonnes} t.`,
    referenceType: 'pool', referenceId: pool._id
  });
  return poolView(updated, user);
};

export const leavePool = async (user, id) => {
  const pool = await load(id);
  if (sameId(pool.coordinator, user._id)) throw badRequest('The coordinator cannot leave; cancel the pool instead');
  const updated = await ResiduePool.findOneAndUpdate(
    { _id: pool._id, status: 'OPEN', 'members.farmer': user._id },
    { $pull: { members: { farmer: user._id } } },
    { new: true }
  );
  if (!updated) throw conflict('You are not in this pool, or it is no longer open');
  return poolView(updated, user);
};

export const placeBid = async (user, id, body = {}) => {
  if (![Roles.BUYER, Roles.BIOGAS].includes(user.role)) throw forbidden('Only buyers and biogas plants can bid on a pool');
  const pricePerTon = v.number(body.pricePerTon, 'Price per ton (₹)', { min: 1, max: 100000 });
  const pickupDate = v.isoDate(body.pickupDate, 'Pickup date');
  if (pickupDate < todayIST()) throw badRequest('Pickup date cannot be in the past');
  const message = v.optionalString(body.message, 'Message', { max: 300 });
  const pool = await load(id);
  if (sum(pool.members) < pool.minTonnes) throw conflict(`This pool has not reached its ${pool.minTonnes} t minimum yet`);
  const updated = await ResiduePool.findOneAndUpdate(
    { _id: pool._id, status: 'OPEN', bids: { $not: { $elemMatch: { buyer: user._id, status: 'PENDING' } } } },
    { $push: { bids: { buyer: user._id, buyerName: user.name, pricePerTon, pickupDate, message } } },
    { new: true }
  );
  if (!updated) throw conflict('You already have a bid on this pool, or it is no longer open');
  notify({
    userId: pool.coordinator, type: 'BID_UPDATE',
    title: `New bid on ${pool.name}`,
    message: `${user.name} offers ${inr(pricePerTon)}/t for ${sum(pool.members)} t, pickup ${pickupDate}.`,
    referenceType: 'pool', referenceId: pool._id
  });
  return poolView(updated, user);
};

export const withdrawBid = async (user, id) => {
  const pool = await load(id);
  const updated = await ResiduePool.findOneAndUpdate(
    { _id: pool._id, status: 'OPEN' },
    { $pull: { bids: { buyer: user._id, status: 'PENDING' } } },
    { new: true }
  );
  if (!updated) throw conflict('This pool is no longer open');
  return poolView(updated, user);
};

export const acceptBid = async (user, id, bidId) => {
  const pool = await load(id);
  if (!sameId(pool.coordinator, user._id)) throw forbidden('Only the coordinator can accept a bid');
  const bid = pool.bids.id(v.objectId(bidId, 'bid id'));
  if (!bid) throw notFound('Bid not found');
  if (sum(pool.members) < pool.minTonnes) throw conflict('The pool has not reached its minimum yet');
  const updated = await ResiduePool.findOneAndUpdate(
    { _id: pool._id, status: 'OPEN', bids: { $elemMatch: { _id: bid._id, status: 'PENDING' } } },
    { $set: { status: 'RESERVED', acceptedBid: bid._id, 'bids.$[win].status': 'ACCEPTED', 'bids.$[other].status': 'REJECTED' } },
    { new: true, arrayFilters: [{ 'win._id': bid._id }, { 'other._id': { $ne: bid._id }, 'other.status': 'PENDING' }] }
  );
  if (!updated) throw conflict('This bid can no longer be accepted');
  // Joining and leaving need status OPEN, so members cannot change between the update above and this snapshot
  updated.lockedMembers = updated.members.map((m) => ({ farmer: m.farmer, name: m.name, tonnes: m.tonnes }));
  await updated.save();
  const total = sum(updated.lockedMembers);
  notify({
    userId: bid.buyer, type: 'BID_UPDATE',
    title: `Bid accepted · ${pool.name}`,
    message: `Collect ${total} t on ${bid.pickupDate} and pay ${inr(bid.pricePerTon * total)} after pickup.`,
    referenceType: 'pool', referenceId: pool._id
  });
  for (const m of updated.lockedMembers) {
    if (sameId(m.farmer, user._id)) continue;
    notify({
      userId: m.farmer, type: 'BID_UPDATE',
      title: `${pool.name} sold at ${inr(bid.pricePerTon)}/t`,
      message: `Pickup ${bid.pickupDate}. Your ${m.tonnes} t will earn about ${inr(bid.pricePerTon * m.tonnes)}. Keep the straw ready.`,
      referenceType: 'pool', referenceId: pool._id
    });
  }
  return poolView(updated, user);
};

// Pickup done: the buyer pays and each member is credited for their own tonnes
export const completePool = async (user, id) => {
  const pool = await load(id);
  const bid = pool.acceptedBid && pool.bids.id(pool.acceptedBid);
  if (pool.status !== 'RESERVED' || !bid) throw conflict('Accept a bid before completing the pool');
  const isBuyer = sameId(bid.buyer, user._id);
  if (!sameId(pool.coordinator, user._id) && !isBuyer && user.role !== Roles.ADMIN) throw forbidden('Only the coordinator or the buyer can complete this pool');

  const shares = pool.lockedMembers.map((m) => ({ farmer: m.farmer, tonnes: m.tonnes, amount: Math.round(bid.pricePerTon * m.tonnes) }));
  const total = shares.reduce((s, m) => s + m.amount, 0);
  const debited = await User.updateOne({ _id: bid.buyer, walletBalance: { $gte: total } }, { $inc: { walletBalance: -total } });
  if (!debited.modifiedCount) throw conflict(`The buyer's wallet does not have ${inr(total)}`);

  const done = await ResiduePool.findOneAndUpdate({ _id: pool._id, status: 'RESERVED' }, { $set: { status: 'COLLECTED', completedAt: new Date() } }, { new: true });
  if (!done) {
    await User.updateOne({ _id: bid.buyer }, { $inc: { walletBalance: total } }); // refund
    throw conflict('This pool was already completed');
  }
  for (const s of shares) {
    const points = Math.round(s.tonnes * POINTS_PER_TONNE);
    await User.updateOne({ _id: s.farmer }, { $inc: { walletBalance: s.amount, carbonPoints: points } });
    notify({
      userId: s.farmer, type: 'BID_UPDATE',
      title: `Pool paid · ${inr(s.amount)}`,
      message: `${pool.name}: ${s.tonnes} t at ${inr(bid.pricePerTon)}/t. +${points} carbon points.`,
      referenceType: 'pool', referenceId: pool._id
    });
  }
  return poolView(done, user);
};

export const cancelPool = async (user, id) => {
  const pool = await load(id);
  if (!sameId(pool.coordinator, user._id) && user.role !== Roles.ADMIN) throw forbidden('Only the coordinator can cancel this pool');
  const updated = await ResiduePool.findOneAndUpdate({ _id: pool._id, status: { $in: ['OPEN', 'RESERVED'] } }, { $set: { status: 'CANCELLED' } }, { new: true });
  if (!updated) throw conflict('This pool can no longer be cancelled');
  const people = new Set([...pool.members.map((m) => String(m.farmer)), ...pool.bids.map((b) => String(b.buyer))]);
  people.delete(String(user._id));
  for (const uid of people) {
    notify({ userId: uid, type: 'BID_UPDATE', title: `Pool cancelled · ${pool.name}`, message: 'The coordinator cancelled this pool.', referenceType: 'pool', referenceId: pool._id });
  }
  return poolView(updated, user);
};
