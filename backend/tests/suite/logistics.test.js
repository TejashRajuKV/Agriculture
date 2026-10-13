import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startTestApp } from './helpers.js';
import { planRoute, isValidSequence, naiveSequence, routeLength } from '../../services/routeService.js';

// ------------------------------------------------------------------ route planner (pure)
const START = { lat: 12.5, lng: 76.9 };
const mk = (id, kg, p, d) => ({ id, kg, pickup: { lat: p[0], lng: p[1], label: `P${id}` }, drop: { lat: d[0], lng: d[1], label: `D${id}` } });
const ORDERS = [
  mk('a', 400, [12.52, 76.89], [12.97, 77.59]), // Mandya -> Bengaluru
  mk('b', 300, [12.30, 76.64], [12.30, 76.64]), // Mysuru -> Mysuru
  mk('c', 200, [12.53, 76.88], [12.98, 77.60]), // Mandya -> Bengaluru
  mk('d', 250, [12.29, 76.65], [12.96, 77.58])
];

test('route: every pickup precedes its drop and load never exceeds capacity', () => {
  const plan = planRoute({ start: START, orders: ORDERS, capacityKg: 700 });
  assert.equal(plan.ok, true);
  assert.equal(plan.stops.length, 8);
  assert.ok(isValidSequence(plan.stops.map((s) => ({ orderId: s.orderId, type: s.type, kg: s.kg })), 700));
  assert.ok(plan.peakLoadKg <= 700);
  assert.deepEqual(plan.stops.map((s) => s.sequence), [1, 2, 3, 4, 5, 6, 7, 8]);
});

test('route: never longer than doing orders one by one, and the same input gives the same route', () => {
  const a = planRoute({ start: START, orders: ORDERS, capacityKg: 4000 });
  const b = planRoute({ start: START, orders: ORDERS, capacityKg: 4000 });
  assert.deepEqual(a, b);
  assert.ok(a.totalKm <= a.naiveKm, `${a.totalKm} <= ${a.naiveKm}`);
  assert.equal(a.savedKm, Math.round((a.naiveKm - a.totalKm) * 10) / 10);
  // With room for everything, batching the Mandya pickups saves real distance
  assert.ok(a.savedKm > 0);
  const naive = routeLength(START, naiveSequence(ORDERS.map((o) => ({ ...o }))));
  assert.ok(Math.abs(naive - a.naiveKm) < 0.2);
});

test('route: tight capacity forces drops before later pickups (still valid)', () => {
  const plan = planRoute({ start: START, orders: ORDERS, capacityKg: 400 });
  assert.equal(plan.ok, true);
  assert.ok(plan.peakLoadKg <= 400);
});

test('route: refuses impossible or incomplete input', () => {
  assert.equal(planRoute({ start: START, orders: [], capacityKg: 100 }).reason, 'NO_ORDERS');
  assert.equal(planRoute({ start: START, orders: [mk('x', 900, [12, 76], [13, 77])], capacityKg: 500 }).reason, 'ORDER_EXCEEDS_CAPACITY');
  assert.equal(planRoute({ start: START, orders: [{ id: 'y', kg: 10, pickup: { lat: 12, lng: 76 }, drop: {} }], capacityKg: 500 }).reason, 'MISSING_COORDINATES');
  assert.equal(planRoute({ start: START, orders: Array.from({ length: 7 }, (_, i) => mk(String(i), 10, [12, 76], [13, 77])), capacityKg: 5000 }).reason, 'TOO_MANY_ORDERS');
});

// ------------------------------------------------------------------ API
let t;
let op;
let ravi;
let hotel;
before(async () => {
  t = await startTestApp();
  op = await t.login('logistics@agriloop.demo');
  ravi = await t.login('ravi@agriloop.demo');
  hotel = await t.login('buyer.hotel@agriloop.demo');
});
after(async () => { await t.stop(); });

const today = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });

test('only a logistics operator can use the logistics API', async () => {
  assert.equal((await t.api('GET', '/logistics/vehicles', ravi)).status, 403);
  assert.equal((await t.api('GET', '/logistics/orders', hotel)).status, 403);
  assert.equal((await t.api('GET', '/logistics/vehicles', op)).data.length, 3);
});

test('vehicle rules: unique plate, valid type and capacity', async () => {
  const v = { name: 'New van', plate: 'ka99z0001', type: 'PICKUP', capacityKg: 900 };
  assert.equal((await t.api('POST', '/logistics/vehicles', op, v)).status, 201);
  assert.equal((await t.api('POST', '/logistics/vehicles', op, v)).status, 409);
  assert.equal((await t.api('POST', '/logistics/vehicles', op, { ...v, plate: 'KA99Z0002', type: 'ROCKET' })).status, 400);
  assert.equal((await t.api('POST', '/logistics/vehicles', op, { ...v, plate: 'KA99Z0003', capacityKg: 5 })).status, 400);
});

let tripId;
test('plan preview then create: route is computed by the server and orders are claimed once', async () => {
  const ready = (await t.api('GET', '/logistics/orders', op)).data;
  assert.equal(ready.length, 4);
  assert.ok(ready.every((o) => o.routable));
  const vehicles = (await t.api('GET', '/logistics/vehicles', op)).data;
  const truck = vehicles.find((x) => x.type === 'TRUCK');
  const body = { vehicleId: truck.id, date: today(), orderIds: ready.map((o) => o.id) };

  const preview = await t.api('POST', '/logistics/plan', op, body);
  assert.equal(preview.status, 200);
  assert.equal(preview.data.stops.length, 8);
  assert.ok(preview.data.totalKm <= preview.data.naiveKm);
  assert.equal((await t.api('GET', '/logistics/orders', op)).data.length, 4, 'a preview claims nothing');

  const small = vehicles.find((x) => x.capacityKg === 750);
  assert.equal((await t.api('POST', '/logistics/plan', op, { ...body, vehicleId: small.id, orderIds: [ready.find((o) => o.kg === 2000)?.id || ready[0].id] })).status, 400, 'heavier than the vehicle');
  assert.equal((await t.api('POST', '/logistics/deliveries', op, { ...body, date: '2020-01-01' })).status, 400);

  const created = await t.api('POST', '/logistics/deliveries', op, body);
  assert.equal(created.status, 201);
  assert.match(created.data.number, /^DL-\d{4}-\d{5}$/);
  tripId = created.data.id;
  assert.equal((await t.api('GET', '/logistics/orders', op)).data.length, 0, 'orders are now on the trip');
  assert.equal((await t.api('POST', '/logistics/deliveries', op, body)).status, 409, 'cannot plan the same orders twice');

  // buyer and seller are told, and the order shows the trip
  const orders = (await t.api('GET', '/orders?as=buyer', hotel)).data;
  const onTrip = orders.find((o) => o.delivery);
  assert.equal(onTrip.deliveryStatus, 'SCHEDULED');
  assert.equal(onTrip.delivery.number, created.data.number);
  // while on a trip, the buyer cannot cancel and the seller cannot move it by hand
  assert.equal((await t.api('PATCH', `/orders/${onTrip.id}/status`, hotel, { status: 'CANCELLED' })).status, 409);
});

test('running the trip: stops in order, orders advance, buyers pay on delivery, vehicle freed at the end', async () => {
  const before = (await t.api('GET', '/auth/me', hotel)).data.user.walletBalance;
  assert.equal((await t.api('POST', `/logistics/deliveries/${tripId}/stops/1/complete`, op)).status, 409, 'not started');
  assert.equal((await t.api('POST', `/logistics/deliveries/${tripId}/start`, ravi)).status, 403);
  const started = await t.api('POST', `/logistics/deliveries/${tripId}/start`, op);
  assert.equal(started.status, 200);
  assert.equal(started.data.nextStop, 1);
  const veh = (await t.api('GET', '/logistics/vehicles', op)).data.find((x) => x.type === 'TRUCK');
  assert.equal(veh.status, 'ON_ROUTE');
  assert.equal((await t.api('POST', `/logistics/deliveries/${tripId}/start`, op)).status, 409);
  assert.equal((await t.api('POST', `/logistics/deliveries/${tripId}/cancel`, op)).status, 409, 'cannot cancel a running trip');

  assert.equal((await t.api('POST', `/logistics/deliveries/${tripId}/stops/3/complete`, op)).status, 409, 'must follow the route order');
  let trip = started.data;
  for (let seq = 1; seq <= trip.stops.length; seq++) {
    const r = await t.api('POST', `/logistics/deliveries/${tripId}/stops/${seq}/complete`, op);
    assert.equal(r.status, 200, JSON.stringify(r.data));
    if (seq === 1) {
      // first stop is a pickup: that order is now in transit and trackable
      const o = (await t.api('GET', `/logistics/deliveries/${tripId}`, op)).data.stops[0];
      const buyer = (await t.api('GET', `/orders/${o.orderId}`, hotel)).status === 200 ? hotel : await t.login('buyer.retail@agriloop.demo');
      assert.equal((await t.api('GET', `/orders/${o.orderId}`, buyer)).data.status, 'IN_TRANSIT');
    }
    trip = r.data;
  }
  assert.equal(trip.status, 'COMPLETED');
  assert.equal((await t.api('GET', '/logistics/vehicles', op)).data.find((x) => x.type === 'TRUCK').status, 'AVAILABLE');

  const orders = (await t.api('GET', '/orders?as=buyer', hotel)).data.filter((o) => o.delivery?.tripId === tripId);
  assert.ok(orders.every((o) => o.status === 'DELIVERED' && o.paymentStatus === 'PAID'));
  const after = (await t.api('GET', '/auth/me', hotel)).data.user.walletBalance;
  assert.equal(before - after, orders.reduce((s, o) => s + o.totalAmount, 0));
});

// Put a fresh order in READY_FOR_PICKUP the normal way: buyer orders, seller confirms, processes, marks ready
const SELLER_LOGINS = { 'Ravi Kumar': 'ravi@agriloop.demo', 'Lakshmi Devi': 'lakshmi@agriloop.demo', 'Anand Hegde': 'fpo.mandya@agriloop.demo' };
const readyOrder = async (kg) => {
  const listings = (await t.api('GET', '/marketplace/listings?kind=PRODUCE', hotel)).data;
  const listing = listings.find((l) => SELLER_LOGINS[l.seller.name] && l.quantityAvailable >= kg && l.unit === 'kg');
  assert.ok(listing, 'a produce listing from a known seller');
  const seller = await t.login(SELLER_LOGINS[listing.seller.name]);
  const order = (await t.api('POST', '/orders', hotel, { listingId: listing.id, quantity: kg, deliveryAddress: 'Hotel Annapoorna, 12 MG Road, Bengaluru' })).data;
  for (const status of ['CONFIRMED', 'PROCESSING', 'READY_FOR_PICKUP']) assert.equal((await t.api('PATCH', `/orders/${order.id}/status`, seller, { status })).status, 200);
  return order;
};

test('cancelling a planned trip releases its orders; buyer tracking shows the trip and stops ahead', async () => {
  const order = await readyOrder(50);
  const veh = (await t.api('GET', '/logistics/vehicles', op)).data.find((x) => x.type === 'MINI_TRUCK');
  const trip = (await t.api('POST', '/logistics/deliveries', op, { vehicleId: veh.id, date: today(), orderIds: [order.id] })).data;

  const track = (await t.api('GET', `/orders/${order.id}/tracking`, hotel)).data;
  assert.equal(track.scheduled, true);
  assert.equal(track.number, trip.number);
  assert.equal(track.stopsBefore, 0);
  assert.equal(track.pickupDone, false);
  assert.equal((await t.api('GET', `/orders/${order.id}/tracking`, await t.login('buyer.retail@agriloop.demo'))).status, 403, 'other buyers cannot track it');

  // another operator-less user cannot touch the trip; the owner can cancel it
  assert.equal((await t.api('POST', `/logistics/deliveries/${trip.id}/cancel`, ravi)).status, 403);
  assert.equal((await t.api('POST', `/logistics/deliveries/${trip.id}/cancel`, op)).status, 200);
  assert.equal((await t.api('GET', `/orders/${order.id}/tracking`, hotel)).data.scheduled, false);
  assert.equal((await t.api('GET', '/logistics/orders', op)).data.length, 1, 'order is waiting for a vehicle again');
});

test('mid-trip tracking: after the pickup the buyer sees pickup done', async () => {
  const [ready] = (await t.api('GET', '/logistics/orders', op)).data;
  const veh = (await t.api('GET', '/logistics/vehicles', op)).data.find((x) => x.type === 'MINI_TRUCK');
  const trip = (await t.api('POST', '/logistics/deliveries', op, { vehicleId: veh.id, date: today(), orderIds: [ready.id] })).data;
  await t.api('POST', `/logistics/deliveries/${trip.id}/start`, op);
  assert.equal((await t.api('POST', `/logistics/deliveries/${trip.id}/stops/1/complete`, op)).status, 200);
  const track = (await t.api('GET', `/orders/${ready.id}/tracking`, hotel)).data;
  assert.equal(track.pickupDone, true);
  assert.equal(track.deliveryDone, false);
  assert.equal(track.nextStopIsYours, true);
  assert.equal((await t.api('GET', `/orders/${ready.id}`, hotel)).data.status, 'IN_TRANSIT');
  assert.equal((await t.api('POST', `/logistics/deliveries/${trip.id}/stops/2/complete`, op)).data.status, 'COMPLETED');
});
