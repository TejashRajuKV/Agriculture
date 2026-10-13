import Order from '../models/Order.js';
import Listing from '../models/Listing.js';
import User, { Roles } from '../models/User.js';
import { badRequest, conflict, forbidden, notFound } from '../utils/httpError.js';
import * as v from '../utils/validate.js';
import { nextDocumentNumber } from './counterService.js';
import { notify } from './notificationService.js';

const round2 = (n) => Math.round(n * 100) / 100;
const inr = (n) => `₹${Math.round(n).toLocaleString('en-IN')}`;
const OPEN_STATUSES = ['PENDING', 'CONFIRMED', 'PROCESSING', 'READY_FOR_PICKUP', 'PICKED_UP', 'IN_TRANSIT'];

// Who may move an order from one status to the next. The seller runs fulfilment
// (until the logistics module takes over delivery in a later milestone); the
// buyer can cancel early and confirm receipt.
const TRANSITIONS = {
  seller: {
    PENDING: ['CONFIRMED', 'CANCELLED'],
    CONFIRMED: ['PROCESSING', 'CANCELLED'],
    PROCESSING: ['READY_FOR_PICKUP'],
    READY_FOR_PICKUP: ['PICKED_UP'],
    PICKED_UP: ['IN_TRANSIT'],
    IN_TRANSIT: ['DELIVERED']
  },
  buyer: {
    PENDING: ['CANCELLED'],
    CONFIRMED: ['CANCELLED'],
    PICKED_UP: ['DELIVERED'],
    IN_TRANSIT: ['DELIVERED']
  }
};

const DELIVERY_STATUS = {
  READY_FOR_PICKUP: 'PICKUP_READY',
  PICKED_UP: 'PICKED_UP',
  IN_TRANSIT: 'IN_TRANSIT',
  DELIVERED: 'DELIVERED',
  CANCELLED: 'CANCELLED'
};

export const orderView = (o, user) => ({
  id: String(o._id),
  orderNumber: o.orderNumber,
  role: user && String(o.buyer?._id || o.buyer) === String(user._id) ? 'buyer' : 'seller',
  buyer: { id: String(o.buyer?._id || o.buyer), name: o.buyerName, type: o.buyerType || null },
  seller: { id: String(o.seller?._id || o.seller), name: o.sellerName, type: o.sellerType },
  listingId: String(o.listing?._id || o.listing),
  item: o.item,
  quantity: o.quantity,
  unitPrice: o.unitPrice,
  subtotal: o.subtotal,
  deliveryFee: o.deliveryFee,
  totalAmount: o.totalAmount,
  deliveryAddress: o.deliveryAddress || '',
  notes: o.notes || '',
  status: o.status,
  paymentStatus: o.paymentStatus,
  deliveryStatus: o.deliveryStatus,
  delivery: o.delivery?.trip ? { tripId: String(o.delivery.trip), number: o.delivery.number, plate: o.delivery.plate } : null,
  history: (o.history || []).map((h) => ({ status: h.status, at: h.at })),
  nextActions: user && !o.delivery?.trip ? allowedNext(o, user) : [], // a logistics trip moves the order while it is on one
  createdAt: o.createdAt,
  updatedAt: o.updatedAt
});

const partyOf = (order, user) => {
  if (String(order.buyer) === String(user._id)) return 'buyer';
  if (String(order.seller) === String(user._id)) return 'seller';
  return null;
};

const allowedNext = (order, user) => {
  const party = partyOf(order, user);
  return party ? TRANSITIONS[party][order.status] || [] : [];
};

export const createOrder = async (user, body = {}) => {
  if (user.role !== Roles.BUYER) throw forbidden('Only buyers can place orders');
  const listingId = v.objectId(body.listingId, 'listing id');
  const quantity = v.positiveNumber(body.quantity, 'Quantity', { max: 10000000 });
  const deliveryAddress = v.requiredString(body.deliveryAddress, 'Delivery address', { min: 5, max: 300 });
  const notes = v.optionalString(body.notes, 'Notes', { max: 300 });

  const listing = await Listing.findById(listingId).populate('crop', 'name');
  if (!listing || listing.kind !== 'PRODUCE') throw notFound('Listing not found');
  if (String(listing.seller) === String(user._id)) throw forbidden('You cannot order your own produce');
  if (listing.status !== 'ACTIVE') throw conflict('This listing is not available');
  // The minimum order applies unless the buyer takes everything that is left
  const minimum = Math.min(listing.minOrderQuantity || 0, listing.quantityAvailable);
  if (quantity < minimum) throw badRequest(`Minimum order is ${listing.minOrderQuantity} ${listing.unit}`);

  // Atomic stock check + decrement: only succeeds if enough stock remains right now
  const reserved = await Listing.findOneAndUpdate(
    { _id: listing._id, status: 'ACTIVE', quantityAvailable: { $gte: quantity } },
    { $inc: { quantityAvailable: -quantity } },
    { new: true }
  );
  if (!reserved) {
    const fresh = await Listing.findById(listing._id).select('quantityAvailable unit status');
    throw conflict(
      fresh?.status === 'ACTIVE'
        ? `Only ${fresh.quantityAvailable} ${fresh.unit} left. Please reduce the quantity.`
        : 'This listing just sold out'
    );
  }
  if (reserved.quantityAvailable <= 0) {
    await Listing.updateOne({ _id: listing._id, quantityAvailable: { $lte: 0 }, status: 'ACTIVE' }, { $set: { status: 'SOLD_OUT' } });
  }

  try {
    const subtotal = round2(quantity * listing.pricePerUnit);
    const order = await Order.create({
      orderNumber: await nextDocumentNumber('OD'),
      buyer: user._id,
      buyerName: user.name,
      buyerType: user.buyerType,
      seller: listing.seller,
      sellerName: listing.sellerName,
      sellerType: listing.sellerType,
      listing: listing._id,
      item: {
        title: listing.title,
        crop: listing.crop?._id,
        unit: listing.unit,
        qualityGrade: listing.qualityGrade,
        image: listing.image,
        pickupLocation: listing.location?.label
      },
      quantity,
      unitPrice: listing.pricePerUnit,
      subtotal,
      deliveryFee: 0,
      totalAmount: subtotal,
      deliveryAddress,
      notes,
      history: [{ status: 'PENDING', by: user._id }]
    });

    notify({
      userId: listing.seller,
      type: 'ORDER_UPDATE',
      title: `New order ${order.orderNumber}`,
      message: `${user.name} ordered ${quantity} ${listing.unit} ${listing.title} (${inr(subtotal)}). ${reserved.quantityAvailable} ${listing.unit} left.`,
      referenceType: 'order',
      referenceId: order._id
    });
    notify({
      userId: user._id,
      type: 'ORDER_UPDATE',
      title: `Order placed · ${order.orderNumber}`,
      message: `${quantity} ${listing.unit} ${listing.title} from ${listing.sellerName}, ${inr(subtotal)}. Waiting for the seller to confirm.`,
      referenceType: 'order',
      referenceId: order._id
    });
    return orderView(order, user);
  } catch (err) {
    await restock(listing._id, quantity); // give the stock back
    throw err;
  }
};

const restock = async (listingId, quantity) => {
  await Listing.updateOne({ _id: listingId }, { $inc: { quantityAvailable: quantity } });
  await Listing.updateOne({ _id: listingId, status: 'SOLD_OUT', quantityAvailable: { $gt: 0 } }, { $set: { status: 'ACTIVE' } });
};

export const listOrders = async (user, { as } = {}) => {
  const filter =
    as === 'seller' ? { seller: user._id } : as === 'buyer' ? { buyer: user._id } : { $or: [{ buyer: user._id }, { seller: user._id }] };
  const orders = await Order.find(filter).sort({ createdAt: -1 }).limit(100);
  return orders.map((o) => orderView(o, user));
};

const loadOrderFor = async (user, id) => {
  const order = await Order.findById(v.objectId(id, 'order id'));
  if (!order) throw notFound('Order not found');
  if (!partyOf(order, user) && user.role !== Roles.ADMIN) throw forbidden('This order belongs to someone else');
  return order;
};

export const getOrder = async (user, id) => orderView(await loadOrderFor(user, id), user);

export const updateOrderStatus = async (user, id, body = {}) => {
  const order = await loadOrderFor(user, id);
  const next = v.oneOf(body.status, 'Status', ['CONFIRMED', 'PROCESSING', 'READY_FOR_PICKUP', 'PICKED_UP', 'IN_TRANSIT', 'DELIVERED', 'CANCELLED']);
  const party = partyOf(order, user);
  // While a logistics trip carries the order, only the trip moves it (the buyer may still cancel before pickup is scheduled)
  if (order.delivery?.trip && next !== 'CANCELLED') throw conflict(`Delivery trip ${order.delivery.number} is handling this order`);
  if (order.delivery?.trip && next === 'CANCELLED') throw conflict(`Delivery trip ${order.delivery.number} is already scheduled for this order`);
  if (!party || !(TRANSITIONS[party][order.status] || []).includes(next)) {
    throw conflict(`You cannot move this order from ${order.status.replace(/_/g, ' ').toLowerCase()} to ${next.replace(/_/g, ' ').toLowerCase()}`);
  }

  // Pay on delivery: buyer's wallet is debited and the seller's credited
  if (next === 'DELIVERED') {
    const debited = await User.updateOne({ _id: order.buyer, walletBalance: { $gte: order.totalAmount } }, { $inc: { walletBalance: -order.totalAmount } });
    if (!debited.modifiedCount) throw conflict(`The buyer's wallet does not have ${inr(order.totalAmount)}`);
  }

  const updated = await Order.findOneAndUpdate(
    { _id: order._id, status: order.status },
    {
      $set: {
        status: next,
        ...(DELIVERY_STATUS[next] ? { deliveryStatus: DELIVERY_STATUS[next] } : {}),
        ...(next === 'DELIVERED' ? { paymentStatus: 'PAID' } : {})
      },
      $push: { history: { status: next, by: user._id } }
    },
    { new: true }
  );
  if (!updated) {
    if (next === 'DELIVERED') await User.updateOne({ _id: order.buyer }, { $inc: { walletBalance: order.totalAmount } });
    throw conflict('This order was just updated by someone else. Reload and try again.');
  }

  if (next === 'DELIVERED') await User.updateOne({ _id: order.seller }, { $inc: { walletBalance: order.totalAmount } });
  if (next === 'CANCELLED') await restock(order.listing, order.quantity);

  const otherParty = party === 'buyer' ? order.seller : order.buyer;
  notify({
    userId: otherParty,
    type: 'ORDER_UPDATE',
    title: `Order ${order.orderNumber}: ${next.replace(/_/g, ' ').toLowerCase()}`,
    message:
      next === 'CANCELLED'
        ? `${user.name} cancelled the order for ${order.quantity} ${order.item.unit} ${order.item.title}.`
        : next === 'DELIVERED'
          ? `${order.quantity} ${order.item.unit} ${order.item.title} delivered. ${inr(order.totalAmount)} paid.`
          : `${order.item.title}: ${user.name} moved the order to ${next.replace(/_/g, ' ').toLowerCase()}.`,
    referenceType: 'order',
    referenceId: order._id
  });
  return orderView(updated, user);
};

export const openOrderStatuses = OPEN_STATUSES;

// The logistics trip moves an order along; the party rules above do not apply, but the order of steps does.
const LOGISTICS_STEPS = { READY_FOR_PICKUP: 'PICKED_UP', PICKED_UP: 'IN_TRANSIT', IN_TRANSIT: 'DELIVERED' };

export const advanceByLogistics = async (actor, orderId, next) => {
  const order = await Order.findById(orderId);
  if (!order) throw notFound('Order not found');
  if (LOGISTICS_STEPS[order.status] !== next) throw conflict(`Order ${order.orderNumber} is ${order.status.replace(/_/g, ' ').toLowerCase()}, not ready for ${next.replace(/_/g, ' ').toLowerCase()}`);

  if (next === 'DELIVERED') {
    const debited = await User.updateOne({ _id: order.buyer, walletBalance: { $gte: order.totalAmount } }, { $inc: { walletBalance: -order.totalAmount } });
    if (!debited.modifiedCount) throw conflict(`The buyer's wallet does not have ${inr(order.totalAmount)} for ${order.orderNumber}`);
  }
  const updated = await Order.findOneAndUpdate(
    { _id: order._id, status: order.status },
    { $set: { status: next, deliveryStatus: DELIVERY_STATUS[next], ...(next === 'DELIVERED' ? { paymentStatus: 'PAID' } : {}) }, $push: { history: { status: next, by: actor._id } } },
    { new: true }
  );
  if (!updated) {
    if (next === 'DELIVERED') await User.updateOne({ _id: order.buyer }, { $inc: { walletBalance: order.totalAmount } });
    throw conflict('This order was just updated by someone else.');
  }
  if (next === 'DELIVERED') await User.updateOne({ _id: order.seller }, { $inc: { walletBalance: order.totalAmount } });

  const text = {
    PICKED_UP: `${order.item.title} was collected from ${order.sellerName}.`,
    IN_TRANSIT: `${order.item.title} is on its way to ${order.buyerName}.`,
    DELIVERED: `${order.quantity} ${order.item.unit} ${order.item.title} delivered. ${inr(order.totalAmount)} paid.`
  }[next];
  for (const userId of [order.buyer, order.seller]) {
    notify({ userId, type: 'DELIVERY_UPDATE', title: `Order ${order.orderNumber}: ${next.replace(/_/g, ' ').toLowerCase()}`, message: text, referenceType: 'order', referenceId: order._id });
  }
  return updated;
};
