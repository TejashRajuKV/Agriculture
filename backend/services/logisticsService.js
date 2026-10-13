import mongoose from 'mongoose';
import Order from '../models/Order.js';
import Listing from '../models/Listing.js';
import User, { Roles } from '../models/User.js';
import { Vehicle, Delivery, VehicleTypes, VehicleStatus } from '../models/Logistics.js';
import { badRequest, conflict, forbidden, notFound } from '../utils/httpError.js';
import * as v from '../utils/validate.js';
import { todayIST, addDays } from '../utils/dates.js';
import { nextDocumentNumber } from './counterService.js';
import { notify } from './notificationService.js';
import { advanceByLogistics } from './orderService.js';
import { planRoute, MAX_ORDERS } from './routeService.js';

const KG_PER_UNIT = { kg: 1, quintal: 100, ton: 1000 };
const PLAN_WINDOW_DAYS = 14;
const same = (a, b) => String(a?._id || a) === String(b?._id || b);
const isAdmin = (u) => u.role === Roles.ADMIN;
const orderKg = (o) => o.quantity * (KG_PER_UNIT[o.item?.unit] || 1);

// ---------------------------------------------------------------------------
// Vehicles
// ---------------------------------------------------------------------------
const vehicleView = (x) => ({
  id: String(x._id), name: x.name, plate: x.plate, type: x.type, capacityKg: x.capacityKg, status: x.status, base: x.base
});

export const listVehicles = async (user) => {
  const rows = await Vehicle.find(isAdmin(user) ? {} : { operator: user._id }).sort({ name: 1 });
  return rows.map(vehicleView);
};

export const createVehicle = async (user, body = {}) => {
  const plate = v.requiredString(body.plate, 'Registration number', { min: 4, max: 15 }).toUpperCase();
  const lat = user.location?.lat;
  const lng = user.location?.lng;
  try {
    const x = await Vehicle.create({
      operator: user._id,
      name: v.requiredString(body.name, 'Vehicle name', { max: 60 }),
      plate,
      type: v.oneOf(body.type, 'Type', VehicleTypes),
      capacityKg: v.number(body.capacityKg, 'Capacity (kg)', { min: 50, max: 40000 }),
      base: { label: user.location?.label, lat, lng }
    });
    return vehicleView(x);
  } catch (err) {
    if (err?.code === 11000) throw conflict('A vehicle with this registration number already exists');
    throw err;
  }
};

export const setVehicleStatus = async (user, id, body = {}) => {
  const status = v.oneOf(body.status, 'Status', ['AVAILABLE', 'MAINTENANCE']);
  const x = await Vehicle.findOne({ _id: v.objectId(id, 'vehicle id'), ...(isAdmin(user) ? {} : { operator: user._id }) });
  if (!x) throw notFound('Vehicle not found');
  // A vehicle on a trip cannot be edited out from under it
  const updated = await Vehicle.findOneAndUpdate({ _id: x._id, status: { $ne: 'ON_ROUTE' } }, { $set: { status } }, { new: true });
  if (!updated) throw conflict('This vehicle is on a trip right now');
  return vehicleView(updated);
};

// ---------------------------------------------------------------------------
// Orders waiting for a vehicle
// ---------------------------------------------------------------------------
const pointOf = async (listing, seller) => {
  const loc = listing?.location?.lat != null ? listing.location : seller?.location;
  return loc?.lat != null ? { lat: loc.lat, lng: loc.lng, label: listing?.location?.label || seller?.location?.label || '' } : null;
};

const describe = async (orders) => {
  const listings = new Map((await Listing.find({ _id: { $in: orders.map((o) => o.listing) } }).select('location')).map((l) => [String(l._id), l]));
  const users = new Map((await User.find({ _id: { $in: orders.flatMap((o) => [o.seller, o.buyer]) } }).select('location')).map((u) => [String(u._id), u]));
  return Promise.all(
    orders.map(async (o) => {
      const pickup = await pointOf(listings.get(String(o.listing)), users.get(String(o.seller)));
      const dropLoc = users.get(String(o.buyer))?.location;
      const drop = dropLoc?.lat != null ? { lat: dropLoc.lat, lng: dropLoc.lng, label: o.deliveryAddress || dropLoc.label } : null;
      return { order: o, pickup, drop, kg: orderKg(o) };
    })
  );
};

export const listReadyOrders = async () => {
  const orders = await Order.find({ status: 'READY_FOR_PICKUP', 'delivery.trip': null }).sort({ createdAt: 1 }).limit(100);
  return (await describe(orders)).map(({ order: o, pickup, drop, kg }) => ({
    id: String(o._id),
    orderNumber: o.orderNumber,
    item: o.item.title,
    quantity: o.quantity,
    unit: o.item.unit,
    kg: Math.round(kg),
    seller: o.sellerName,
    buyer: o.buyerName,
    pickupLabel: pickup?.label || null,
    dropLabel: drop?.label || null,
    // Without a map position for both ends an order cannot be routed
    routable: Boolean(pickup && drop)
  }));
};

// ---------------------------------------------------------------------------
// Planning
// ---------------------------------------------------------------------------
const REASONS = {
  NO_ORDERS: 'Pick at least one order.',
  TOO_MANY_ORDERS: `A trip can carry at most ${MAX_ORDERS} orders.`,
  ORDER_EXCEEDS_CAPACITY: 'One order is heavier than this vehicle can carry.',
  MISSING_COORDINATES: 'An order has no map position for the seller or buyer. Ask them to set their location in their profile.',
  NO_VALID_ROUTE: 'No valid route was found for these orders.'
};

const loadPlanInput = async (user, body) => {
  const vehicle = await Vehicle.findOne({ _id: v.objectId(body.vehicleId, 'vehicle id'), ...(isAdmin(user) ? {} : { operator: user._id }) });
  if (!vehicle) throw notFound('Vehicle not found');
  const ids = [...new Set((Array.isArray(body.orderIds) ? body.orderIds : []).map((id) => v.objectId(id, 'order id')))];
  const orders = await Order.find({ _id: { $in: ids } });
  if (orders.length !== ids.length) throw notFound('One of the orders was not found');
  const bad = orders.find((o) => o.status !== 'READY_FOR_PICKUP' || o.delivery?.trip);
  if (bad) throw conflict(`${bad.orderNumber} is not waiting for pickup, or is already on a trip`);
  const described = await describe(orders);
  const start = vehicle.base?.lat != null ? vehicle.base : null;
  if (!start) throw badRequest('Set your location in your profile so the route has a starting point');
  const plan = planRoute({
    start,
    capacityKg: vehicle.capacityKg,
    orders: described.map((d) => ({ id: String(d.order._id), kg: d.kg, pickup: d.pickup || {}, drop: d.drop || {} }))
  });
  if (!plan.ok) throw badRequest(REASONS[plan.reason] || 'These orders cannot be planned', { reason: plan.reason, orderId: plan.orderId });
  return { vehicle, orders, plan, start };
};

// Preview only: nothing is saved
export const previewTrip = async (user, body = {}) => {
  const { vehicle, orders, plan } = await loadPlanInput(user, body);
  const byId = new Map(orders.map((o) => [String(o._id), o]));
  return { vehicle: vehicleView(vehicle), ...plan, stops: plan.stops.map((s) => ({ ...s, orderNumber: byId.get(s.orderId)?.orderNumber })) };
};

const deliveryView = (d) => ({
  id: String(d._id),
  number: d.number,
  date: d.date,
  status: d.status,
  vehicle: { id: String(d.vehicle), name: d.vehicleName, plate: d.plate },
  start: d.start,
  totalKm: d.totalKm,
  naiveKm: d.naiveKm,
  savedKm: d.savedKm,
  durationMinutes: d.durationMinutes,
  peakLoadKg: d.peakLoadKg,
  capacityKg: d.capacityKg,
  startedAt: d.startedAt,
  completedAt: d.completedAt,
  stops: d.stops.map((s) => ({
    sequence: s.sequence, orderId: String(s.order), orderNumber: s.orderNumber, type: s.type, label: s.label,
    lat: s.lat, lng: s.lng, kg: s.kg, legKm: s.legKm, etaMinutes: s.etaMinutes, loadAfterKg: s.loadAfterKg, status: s.status
  })),
  nextStop: d.status === 'IN_PROGRESS' ? d.stops.find((s) => s.status === 'PENDING')?.sequence ?? null : null
});

export const createTrip = async (user, body = {}) => {
  const date = v.isoDate(body.date, 'Date');
  const today = todayIST();
  if (date < today || date > addDays(today, PLAN_WINDOW_DAYS)) throw badRequest(`Pick a date in the next ${PLAN_WINDOW_DAYS} days`);
  // The route is always recomputed here; the browser never supplies stops
  const { vehicle, orders, plan, start } = await loadPlanInput(user, body);
  if (vehicle.status === 'MAINTENANCE') throw conflict('This vehicle is in maintenance');

  const tripId = new mongoose.Types.ObjectId();
  const number = await nextDocumentNumber('DL');

  // Claim every order atomically; if any was taken meanwhile, give the others back
  const claimed = [];
  for (const o of orders) {
    const got = await Order.findOneAndUpdate(
      { _id: o._id, status: 'READY_FOR_PICKUP', 'delivery.trip': null },
      { $set: { delivery: { trip: tripId, number, plate: vehicle.plate }, deliveryStatus: 'SCHEDULED' } },
      { new: true }
    );
    if (!got) {
      await Order.updateMany({ _id: { $in: claimed } }, { $set: { deliveryStatus: 'PICKUP_READY' }, $unset: { delivery: 1 } });
      throw conflict(`${o.orderNumber} was just taken by another trip. Please plan again.`);
    }
    claimed.push(o._id);
  }

  const byId = new Map(orders.map((o) => [String(o._id), o]));
  try {
    const trip = await Delivery.create({
      _id: tripId, number, operator: vehicle.operator, vehicle: vehicle._id, vehicleName: vehicle.name, plate: vehicle.plate, date,
      start: { label: start.label, lat: start.lat, lng: start.lng },
      stops: plan.stops.map((s) => ({ ...s, order: s.orderId, orderNumber: byId.get(s.orderId)?.orderNumber })),
      totalKm: plan.totalKm, naiveKm: plan.naiveKm, savedKm: plan.savedKm, durationMinutes: plan.durationMinutes, peakLoadKg: plan.peakLoadKg, capacityKg: vehicle.capacityKg
    });
    for (const o of orders) {
      notify({ userId: o.seller, type: 'DELIVERY_UPDATE', title: `Pickup scheduled · ${o.orderNumber}`, message: `${vehicle.plate} will collect ${o.item.title} on ${date}. Keep it ready.`, referenceType: 'order', referenceId: o._id });
      notify({ userId: o.buyer, type: 'DELIVERY_UPDATE', title: `Delivery scheduled · ${o.orderNumber}`, message: `${o.item.title} is planned for pickup on ${date} with ${vehicle.plate}.`, referenceType: 'order', referenceId: o._id });
    }
    return deliveryView(trip);
  } catch (err) {
    await Order.updateMany({ _id: { $in: claimed } }, { $set: { deliveryStatus: 'PICKUP_READY' }, $unset: { delivery: 1 } });
    throw err;
  }
};

// ---------------------------------------------------------------------------
// Running a trip
// ---------------------------------------------------------------------------
const loadTrip = async (user, id) => {
  const t = await Delivery.findById(v.objectId(id, 'delivery id'));
  if (!t) throw notFound('Delivery not found');
  if (!same(t.operator, user._id) && !isAdmin(user)) throw forbidden('This trip belongs to another operator');
  return t;
};

export const listTrips = async (user, q = {}) => {
  const filter = isAdmin(user) ? {} : { operator: user._id };
  if (q.status) filter.status = v.oneOf(q.status, 'Status', ['PLANNED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED']);
  const rows = await Delivery.find(filter).sort({ date: -1, createdAt: -1 }).limit(50);
  return rows.map(deliveryView);
};

export const getTrip = async (user, id) => deliveryView(await loadTrip(user, id));

export const startTrip = async (user, id) => {
  const t = await loadTrip(user, id);
  if (t.date > todayIST()) throw conflict('This trip is planned for a later day');
  const vehicle = await Vehicle.findOneAndUpdate({ _id: t.vehicle, status: 'AVAILABLE' }, { $set: { status: 'ON_ROUTE' } });
  if (!vehicle) throw conflict('The vehicle is not available (already on a trip, or in maintenance)');
  const updated = await Delivery.findOneAndUpdate({ _id: t._id, status: 'PLANNED' }, { $set: { status: 'IN_PROGRESS', startedAt: new Date() } }, { new: true });
  if (!updated) {
    await Vehicle.updateOne({ _id: t.vehicle, status: 'ON_ROUTE' }, { $set: { status: 'AVAILABLE' } });
    throw conflict('Only a planned trip can be started');
  }
  return deliveryView(updated);
};

export const completeStop = async (user, id, sequence) => {
  const t = await loadTrip(user, id);
  if (t.status !== 'IN_PROGRESS') throw conflict('Start the trip first');
  const seq = Number(sequence);
  const stop = t.stops.find((s) => s.sequence === seq);
  if (!stop) throw notFound('Stop not found');
  const firstPending = t.stops.find((s) => s.status === 'PENDING');
  if (!firstPending || firstPending.sequence !== seq) throw conflict(`Do stop ${firstPending?.sequence ?? ''} first. Stops are done in route order.`);

  // Move the order first: if the buyer cannot pay, the stop stays open and nothing is half done
  if (stop.type === 'PICKUP') {
    await advanceByLogistics(user, stop.order, 'PICKED_UP');
    await advanceByLogistics(user, stop.order, 'IN_TRANSIT');
  } else {
    await advanceByLogistics(user, stop.order, 'DELIVERED');
  }

  const last = t.stops.every((s) => s.sequence === seq || s.status === 'DONE');
  const updated = await Delivery.findOneAndUpdate(
    { _id: t._id, status: 'IN_PROGRESS', stops: { $elemMatch: { sequence: seq, status: 'PENDING' } } },
    { $set: { 'stops.$.status': 'DONE', 'stops.$.doneAt': new Date(), ...(last ? { status: 'COMPLETED', completedAt: new Date() } : {}) } },
    { new: true }
  );
  if (!updated) throw conflict('This stop was just completed by someone else');
  if (last) await Vehicle.updateOne({ _id: t.vehicle }, { $set: { status: 'AVAILABLE' } });
  return deliveryView(updated);
};

export const cancelTrip = async (user, id) => {
  const t = await loadTrip(user, id);
  const updated = await Delivery.findOneAndUpdate({ _id: t._id, status: 'PLANNED' }, { $set: { status: 'CANCELLED' } }, { new: true });
  if (!updated) throw conflict('Only a trip that has not started can be cancelled');
  const ids = [...new Set(t.stops.map((s) => s.order))];
  await Order.updateMany({ _id: { $in: ids }, 'delivery.trip': t._id }, { $set: { deliveryStatus: 'PICKUP_READY' }, $unset: { delivery: 1 } });
  return deliveryView(updated);
};

// ---------------------------------------------------------------------------
// What a buyer or seller sees about their order's delivery
// ---------------------------------------------------------------------------
export const trackOrder = async (user, orderId) => {
  const order = await Order.findById(v.objectId(orderId, 'order id'));
  if (!order) throw notFound('Order not found');
  if (!same(order.buyer, user._id) && !same(order.seller, user._id) && !isAdmin(user)) throw forbidden('This order belongs to someone else');
  if (!order.delivery?.trip) return { scheduled: false };
  const t = await Delivery.findById(order.delivery.trip);
  if (!t) return { scheduled: false };
  const mine = t.stops.filter((s) => same(s.order, order._id));
  const pickup = mine.find((s) => s.type === 'PICKUP');
  const drop = mine.find((s) => s.type === 'DROP');
  const next = t.stops.find((s) => s.status === 'PENDING');
  const target = pickup?.status === 'PENDING' ? pickup : drop;
  const stopsBefore = target && target.status === 'PENDING' ? t.stops.filter((s) => s.status === 'PENDING' && s.sequence < target.sequence).length : 0;
  return {
    scheduled: true,
    number: t.number,
    plate: t.plate,
    date: t.date,
    tripStatus: t.status,
    pickupDone: pickup?.status === 'DONE',
    deliveryDone: drop?.status === 'DONE',
    stopsBefore,
    // Planned minutes from departure; a guide, not a live position
    plannedEtaMinutes: target?.etaMinutes ?? null,
    nextStopIsYours: next ? same(next.order, order._id) : false
  };
};
