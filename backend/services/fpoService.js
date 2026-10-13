import Fpo from '../models/Fpo.js';
import User, { Roles } from '../models/User.js';
import ProcurementBooking from '../models/ProcurementBooking.js';
import ProcurementRecord from '../models/ProcurementRecord.js';
import Payment from '../models/Payment.js';
import Listing from '../models/Listing.js';
import { badRequest, conflict, forbidden, notFound } from '../utils/httpError.js';
import * as v from '../utils/validate.js';
import { todayIST, addDays } from '../utils/dates.js';
import { notify } from './notificationService.js';

const round1 = (n) => Math.round(n * 10) / 10;

const myFpo = async (user) => {
  if (user.role !== Roles.FPO && user.role !== Roles.ADMIN) throw forbidden('Only an FPO account can open this workspace');
  const fpo = user.fpo ? await Fpo.findById(user.fpo) : null;
  if (!fpo) throw notFound('No FPO is linked to this account');
  if (user.role === Roles.FPO && String(fpo.admin) !== String(user._id)) throw forbidden('You are not the administrator of this FPO');
  return fpo;
};

// One screen for the FPO's day: who is bringing what, who is waiting for money
export const overview = async (user) => {
  const fpo = await myFpo(user);
  const ids = fpo.members.map((m) => m.farmer);
  const today = todayIST();
  const since = addDays(today, -30);
  const weekEnd = addDays(today, 6);

  const [users, upcoming, procured, unpaid, listings, supply] = await Promise.all([
    User.find({ _id: { $in: ids } }).select('name phone farmerCode location'),
    ProcurementBooking.aggregate([
      { $match: { farmer: { $in: ids }, active: true, date: { $gte: today } } },
      { $group: { _id: '$farmer', bookings: { $sum: 1 }, kg: { $sum: '$estimatedQuantity' } } }
    ]),
    ProcurementRecord.aggregate([
      { $match: { farmer: { $in: ids }, date: { $gte: since }, acceptedQuantity: { $gt: 0 } } },
      { $group: { _id: '$farmer', kg: { $sum: '$acceptedQuantity' }, amount: { $sum: '$totalAmount' } } }
    ]),
    Payment.aggregate([
      { $match: { farmer: { $in: ids }, status: { $in: ['PENDING', 'PROCESSING', 'FAILED'] } } },
      { $group: { _id: '$farmer', count: { $sum: 1 }, amount: { $sum: '$amount' }, failed: { $sum: { $cond: [{ $eq: ['$status', 'FAILED'] }, 1, 0] } } } }
    ]),
    Listing.aggregate([
      { $match: { seller: { $in: ids }, kind: 'PRODUCE', status: 'ACTIVE' } },
      { $group: { _id: '$seller', listings: { $sum: 1 } } }
    ]),
    ProcurementBooking.aggregate([
      { $match: { farmer: { $in: ids }, active: true, date: { $gte: today, $lte: weekEnd } } },
      { $lookup: { from: 'crops', localField: 'crop', foreignField: '_id', as: 'c' } },
      { $unwind: '$c' },
      { $group: { _id: '$c.name', kg: { $sum: '$estimatedQuantity' }, farmers: { $addToSet: '$farmer' } } },
      { $sort: { kg: -1 } }
    ])
  ]);

  const by = (rows) => new Map(rows.map((r) => [String(r._id), r]));
  const up = by(upcoming);
  const pr = by(procured);
  const un = by(unpaid);
  const ls = by(listings);

  const members = users
    .map((u) => {
      const id = String(u._id);
      return {
        id,
        name: u.name,
        phone: u.phone,
        farmerCode: u.farmerCode || null,
        location: u.location?.label || '',
        upcomingBookings: up.get(id)?.bookings || 0,
        upcomingKg: round1(up.get(id)?.kg || 0),
        procuredKg30d: round1(pr.get(id)?.kg || 0),
        earned30d: Math.round(pr.get(id)?.amount || 0),
        unpaidCount: un.get(id)?.count || 0,
        unpaidAmount: Math.round(un.get(id)?.amount || 0),
        failedPayments: un.get(id)?.failed || 0,
        activeListings: ls.get(id)?.listings || 0
      };
    })
    .sort((a, b) => b.unpaidAmount - a.unpaidAmount || a.name.localeCompare(b.name));

  return {
    fpo: { id: String(fpo._id), name: fpo.name, registrationNumber: fpo.registrationNumber, location: fpo.location },
    totals: {
      members: members.length,
      upcomingKg: round1(members.reduce((s, m) => s + m.upcomingKg, 0)),
      procuredKg30d: round1(members.reduce((s, m) => s + m.procuredKg30d, 0)),
      earned30d: members.reduce((s, m) => s + m.earned30d, 0),
      unpaidAmount: members.reduce((s, m) => s + m.unpaidAmount, 0),
      membersWaitingForPayment: members.filter((m) => m.unpaidCount > 0).length
    },
    // What members have booked to bring over the next 7 days, by crop
    supplyNext7Days: supply.map((s) => ({ crop: s._id, kg: round1(s.kg), farmers: s.farmers.length })),
    members
  };
};

export const addMember = async (user, body = {}) => {
  const fpo = await myFpo(user);
  const code = body.farmerCode ? v.requiredString(body.farmerCode, 'Farmer code', { max: 20 }) : null;
  let farmer;
  if (code) farmer = await User.findOne({ farmerCode: code, role: Roles.FARMER });
  else {
    const phone = v.phone(body.phone).slice(-10);
    if (phone.length !== 10) throw badRequest('Enter the farmer code or a 10 digit mobile number');
    const found = await User.find({ phone: new RegExp(`${phone}$`), role: Roles.FARMER });
    if (found.length > 1) throw conflict('More than one farmer uses this number. Use the farmer code instead.');
    farmer = found[0];
  }
  if (!farmer) throw notFound('No farmer account found. Ask them to register first.');
  const updated = await Fpo.findOneAndUpdate(
    { _id: fpo._id, 'members.farmer': { $ne: farmer._id } },
    { $push: { members: { farmer: farmer._id } } },
    { new: true }
  );
  if (!updated) throw conflict('This farmer is already a member');
  if (!farmer.fpo) await User.updateOne({ _id: farmer._id }, { fpo: fpo._id });
  notify({ userId: farmer._id, type: 'SYSTEM', title: `You were added to ${fpo.name}`, message: 'Your FPO can now see your bookings, payments and listings to help you.', referenceType: 'fpo', referenceId: fpo._id });
  return { added: true, memberCount: updated.members.length };
};

export const removeMember = async (user, farmerId) => {
  const fpo = await myFpo(user);
  const id = v.objectId(farmerId, 'farmer id');
  const updated = await Fpo.findOneAndUpdate({ _id: fpo._id, 'members.farmer': id }, { $pull: { members: { farmer: id } } }, { new: true });
  if (!updated) throw notFound('This farmer is not a member');
  await User.updateOne({ _id: id, fpo: fpo._id }, { $unset: { fpo: 1 } });
  return { removed: true, memberCount: updated.members.length };
};
