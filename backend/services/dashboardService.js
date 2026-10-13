import ProcurementBooking from '../models/ProcurementBooking.js';
import ProcurementRecord from '../models/ProcurementRecord.js';
import Payment from '../models/Payment.js';
import Listing from '../models/Listing.js';
import Order from '../models/Order.js';
import { Roles } from '../models/User.js';
import { todayIST } from '../utils/dates.js';
import { getUserNotifications } from './notificationService.js';
import { queueView, bookingView } from './procurementService.js';
import { orderView } from './orderService.js';

const round2 = (n) => Math.round(n * 100) / 100;
const OPEN_ORDER = ['PENDING', 'CONFIRMED', 'PROCESSING', 'READY_FOR_PICKUP', 'PICKED_UP', 'IN_TRANSIT'];

// Last `n` calendar months as [{ key: '2026-09', label: 'Sep' }], oldest first
const lastMonths = (n = 6) => {
  const [y, m] = todayIST().split('-').map(Number);
  return Array.from({ length: n }, (_, i) => {
    const d = new Date(Date.UTC(y, m - 1 - (n - 1 - i), 1));
    return { key: d.toISOString().slice(0, 7), label: d.toLocaleDateString('en-IN', { month: 'short', timeZone: 'UTC' }) };
  });
};

// Sum amounts per month from { month: 'YYYY-MM', amount } rows
const monthlySeries = (rows, fields) => {
  const months = lastMonths();
  return months.map(({ key, label }) => {
    const point = { month: key, label };
    for (const f of fields) point[f] = round2(rows.filter((r) => r.month === key && r.field === f).reduce((s, r) => s + r.amount, 0));
    return point;
  });
};

const farmerSummary = async (user) => {
  const today = todayIST();
  const [upcoming, todays, records, payments, listings, sellerOrders, residueSold] = await Promise.all([
    ProcurementBooking.find({ farmer: user._id, active: true, date: { $gte: today } })
      .sort({ date: 1, slotStart: 1 })
      .limit(3)
      .populate('center')
      .populate('crop', 'name unit'),
    ProcurementBooking.findOne({ farmer: user._id, date: today, 'queue.status': { $in: ['WAITING', 'CALLED', 'PROCESSING'] } }).populate('center'),
    ProcurementRecord.find({ farmer: user._id, status: 'COMPLETED' }).sort({ completedAt: -1 }).limit(5).populate('crop', 'name').populate('center', 'name').lean(),
    Payment.find({ farmer: user._id }).lean(),
    Listing.find({ seller: user._id, kind: 'PRODUCE', status: { $in: ['ACTIVE', 'SOLD_OUT', 'DRAFT'] } }).populate('crop', 'name').lean(),
    Order.find({ seller: user._id }).sort({ createdAt: -1 }).limit(50),
    Listing.find({ seller: user._id, kind: 'RESIDUE' }).lean()
  ]);

  const paid = payments.filter((p) => p.status === 'PAID');
  const pending = payments.filter((p) => ['PENDING', 'PROCESSING'].includes(p.status));
  const delivered = sellerOrders.filter((o) => o.status === 'DELIVERED');
  const residueRevenue = residueSold
    .filter((l) => l.status === 'SOLD_OUT' && l.acceptedBid)
    .reduce((s, l) => {
      const bid = l.bids.find((b) => String(b._id) === String(l.acceptedBid));
      return s + (bid ? bid.pricePerTon * l.quantityListed : 0);
    }, 0);

  const since = `${lastMonths()[0].key}-01`;
  const [procuredByMonth, soldOrders] = await Promise.all([
    ProcurementRecord.find({ farmer: user._id, status: 'COMPLETED', date: { $gte: since } }).select('date totalAmount acceptedQuantity').lean(),
    Order.find({ seller: user._id, status: 'DELIVERED', updatedAt: { $gte: new Date(`${since}T00:00:00Z`) } }).select('updatedAt totalAmount').lean()
  ]);
  // Residue sales count towards "marketplace" in the chart, the same as in the Revenue tile
  const residueSales = residueSold
    .filter((l) => l.status === 'SOLD_OUT' && l.acceptedBid && l.completedAt)
    .map((l) => {
      const bid = l.bids.find((b) => String(b._id) === String(l.acceptedBid));
      return { month: new Date(l.completedAt).toISOString().slice(0, 7), field: 'marketplace', amount: bid ? bid.pricePerTon * l.quantityListed : 0 };
    });
  const trend = monthlySeries(
    [
      ...procuredByMonth.map((r) => ({ month: r.date.slice(0, 7), field: 'procurement', amount: r.totalAmount || 0 })),
      ...soldOrders.map((o) => ({ month: o.updatedAt.toISOString().slice(0, 7), field: 'marketplace', amount: o.totalAmount })),
      ...residueSales
    ],
    ['procurement', 'marketplace']
  );

  return {
    trend,
    procurement: {
      upcoming: upcoming.map((b) => bookingView(b, null, null)),
      currentQueue: todays ? { bookingId: String(todays._id), center: todays.center.name, ...(await queueView(todays)) } : null,
      history: records.map((r) => ({
        recordNumber: r.recordNumber,
        bookingId: String(r.booking),
        crop: r.crop?.name,
        center: r.center?.name,
        date: r.date,
        acceptedQuantity: r.acceptedQuantity,
        qualityGrade: r.qualityGrade,
        totalAmount: r.totalAmount
      })),
      payments: {
        paidCount: paid.length,
        paidAmount: round2(paid.reduce((s, p) => s + p.amount, 0)),
        pendingCount: pending.length,
        pendingAmount: round2(pending.reduce((s, p) => s + p.amount, 0)),
        failedCount: payments.filter((p) => p.status === 'FAILED').length
      }
    },
    marketplace: {
      activeListings: listings.filter((l) => l.status === 'ACTIVE').length,
      inventory: listings
        .filter((l) => l.status === 'ACTIVE')
        .map((l) => ({ id: String(l._id), title: l.title, quantityAvailable: l.quantityAvailable, quantityListed: l.quantityListed, unit: l.unit, pricePerUnit: l.pricePerUnit })),
      openOrders: sellerOrders.filter((o) => OPEN_ORDER.includes(o.status)).length,
      newOrders: sellerOrders.filter((o) => o.status === 'PENDING').length,
      revenue: round2(delivered.reduce((s, o) => s + o.totalAmount, 0) + residueRevenue),
      recentOrders: sellerOrders.slice(0, 5).map((o) => orderView(o, user)),
      residueListings: residueSold.filter((l) => ['ACTIVE', 'RESERVED'].includes(l.status)).length
    }
  };
};

const buyerSummary = async (user) => {
  const orders = await Order.find({ buyer: user._id }).sort({ createdAt: -1 }).limit(100);
  const bidsOn = await Listing.find({ kind: 'RESIDUE', 'bids.buyer': user._id }).select('title status bids acceptedBid quantityListed').lean();
  const trend = monthlySeries(
    orders.filter((o) => o.status === 'DELIVERED').map((o) => ({ month: o.updatedAt.toISOString().slice(0, 7), field: 'spent', amount: o.totalAmount })),
    ['spent']
  );
  return {
    trend,
    orders: {
      active: orders.filter((o) => ['CONFIRMED', 'PROCESSING', 'READY_FOR_PICKUP', 'PICKED_UP', 'IN_TRANSIT'].includes(o.status)).length,
      pending: orders.filter((o) => o.status === 'PENDING').length,
      delivered: orders.filter((o) => o.status === 'DELIVERED').length,
      cancelled: orders.filter((o) => o.status === 'CANCELLED').length,
      spent: round2(orders.filter((o) => o.status === 'DELIVERED').reduce((s, o) => s + o.totalAmount, 0)),
      recent: orders.slice(0, 6).map((o) => orderView(o, user)),
      inDelivery: orders.filter((o) => ['READY_FOR_PICKUP', 'PICKED_UP', 'IN_TRANSIT'].includes(o.status)).map((o) => orderView(o, user))
    },
    residueBids: {
      open: bidsOn.filter((l) => l.status === 'ACTIVE').length,
      won: bidsOn.filter((l) => l.acceptedBid && l.bids.some((b) => String(b._id) === String(l.acceptedBid) && String(b.buyer) === String(user._id))).length
    }
  };
};

const householdSummary = async (user) => {
  const mine = await Listing.find({ kind: 'HOUSEHOLD', seller: user._id }).lean();
  const collected = mine.filter((l) => l.status === 'SOLD_OUT');
  return {
    waste: {
      submitted: mine.filter((l) => l.status !== 'CANCELLED').length,
      collected: collected.length,
      collectedKg: round2(collected.reduce((s, l) => s + l.quantityListed, 0)),
      degradableKg: round2(collected.filter((l) => l.degradability === 'DEGRADABLE').reduce((s, l) => s + l.quantityListed, 0))
    }
  };
};

const biogasSummary = async (user) => {
  const [open, mine] = await Promise.all([
    Listing.countDocuments({ kind: 'HOUSEHOLD', status: 'ACTIVE', degradability: 'DEGRADABLE' }),
    Listing.find({ kind: 'HOUSEHOLD', collectedBy: user._id }).lean()
  ]);
  return {
    waste: {
      openPickups: open,
      toCollect: mine.filter((l) => l.status === 'RESERVED').length,
      collected: mine.filter((l) => l.status === 'SOLD_OUT').length,
      collectedKg: round2(mine.filter((l) => l.status === 'SOLD_OUT').reduce((s, l) => s + l.quantityListed, 0))
    }
  };
};

export const getDashboard = async (user) => {
  const base = {
    user: user.toPublic(),
    notifications: await getUserNotifications(user._id, { limit: 5 })
  };
  if ([Roles.FARMER, Roles.FPO].includes(user.role)) return { ...base, ...(await farmerSummary(user)) };
  if (user.role === Roles.BUYER) return { ...base, ...(await buyerSummary(user)) };
  if (user.role === Roles.HOUSEHOLD) return { ...base, ...(await householdSummary(user)) };
  if (user.role === Roles.BIOGAS) return { ...base, ...(await biogasSummary(user)) };
  return base;
};
