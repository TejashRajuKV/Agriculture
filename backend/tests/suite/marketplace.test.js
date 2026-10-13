import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startTestApp } from './helpers.js';

let t;
let ravi;
let lakshmi;
let hotel;
let retail;
let tomato;
before(async () => {
  t = await startTestApp();
  [ravi, lakshmi, hotel, retail] = await Promise.all(
    ['ravi@agriloop.demo', 'lakshmi@agriloop.demo', 'buyer.hotel@agriloop.demo', 'buyer.retail@agriloop.demo'].map((e) => t.login(e))
  );
  tomato = (await t.api('GET', '/crops')).data.find((c) => c.name === 'Tomato');
});
after(async () => { await t.stop(); });

const newListing = async (body = {}) =>
  (await t.api('POST', '/marketplace/listings', ravi, { cropId: tomato.id, quantity: 300, pricePerUnit: 25, minOrderQuantity: 20, qualityGrade: 'A', ...body })).data;

test('listing validation and ownership', async () => {
  const bad = [
    { quantity: 0 },
    { pricePerUnit: -1 },
    { minOrderQuantity: 400 },
    { harvestDate: '2099-01-01' },
    { cropId: 'nope' }
  ];
  for (const b of bad) {
    const r = await t.api('POST', '/marketplace/listings', ravi, { cropId: tomato.id, quantity: 300, pricePerUnit: 25, ...b });
    assert.equal(r.status, 400, JSON.stringify(b));
  }
  assert.equal((await t.api('POST', '/marketplace/listings', hotel, { cropId: tomato.id, quantity: 1, pricePerUnit: 1 })).status, 403);

  const l = await newListing();
  assert.equal(l.status, 'ACTIVE');
  assert.equal((await t.api('PATCH', `/marketplace/listings/${l.id}`, lakshmi, { pricePerUnit: 1 })).status, 403);
  assert.equal((await t.api('PATCH', `/marketplace/listings/${l.id}`, ravi, { quantityAvailable: -3 })).status, 400);
  const upd = await t.api('PATCH', `/marketplace/listings/${l.id}`, ravi, { pricePerUnit: 26 });
  assert.equal(upd.data.pricePerUnit, 26);
});

test('orders reduce inventory, and simultaneous orders cannot oversell', async () => {
  const l = await newListing();
  const o = await t.api('POST', '/orders', hotel, { listingId: l.id, quantity: 100, deliveryAddress: 'Hotel Annapoorna, Bengaluru' });
  assert.equal(o.status, 201);
  assert.equal(o.data.totalAmount, 2500);
  assert.equal((await t.api('GET', `/marketplace/listings/${l.id}`, hotel)).data.quantityAvailable, 200);

  const race = await Promise.all([
    t.api('POST', '/orders', hotel, { listingId: l.id, quantity: 150, deliveryAddress: 'Hotel Annapoorna, Bengaluru' }),
    t.api('POST', '/orders', retail, { listingId: l.id, quantity: 150, deliveryAddress: 'FreshMart DC, Mysuru' }),
    t.api('POST', '/orders', retail, { listingId: l.id, quantity: 150, deliveryAddress: 'FreshMart DC, Mysuru' })
  ]);
  assert.equal(race.filter((r) => r.status === 201).length, 1);
  const left = (await t.api('GET', `/marketplace/listings/${l.id}`, hotel)).data;
  assert.equal(left.quantityAvailable, 50);

  // take the rest -> SOLD_OUT; anything more is refused
  assert.equal((await t.api('POST', '/orders', retail, { listingId: l.id, quantity: 50, deliveryAddress: 'FreshMart DC, Mysuru' })).status, 201);
  const sold = (await t.api('GET', `/marketplace/listings/${l.id}`, hotel)).data;
  assert.equal(sold.quantityAvailable, 0);
  assert.equal(sold.status, 'SOLD_OUT');
  assert.equal((await t.api('POST', '/orders', hotel, { listingId: l.id, quantity: 1, deliveryAddress: 'Hotel Annapoorna, Bengaluru' })).status, 409);
});

test('order rules: minimum quantity, own listing, roles', async () => {
  const l = await newListing();
  assert.equal((await t.api('POST', '/orders', hotel, { listingId: l.id, quantity: 5, deliveryAddress: 'Hotel Annapoorna, Bengaluru' })).status, 400);
  assert.equal((await t.api('POST', '/orders', ravi, { listingId: l.id, quantity: 50, deliveryAddress: 'Somewhere far away' })).status, 403);
  assert.equal((await t.api('POST', '/orders', hotel, { listingId: l.id, quantity: 50 })).status, 400, 'address required');
});

test('order status machine, pay on delivery and cancellation restock', async () => {
  const l = await newListing();
  const o = (await t.api('POST', '/orders', hotel, { listingId: l.id, quantity: 100, deliveryAddress: 'Hotel Annapoorna, Bengaluru' })).data;
  assert.equal((await t.api('PATCH', `/orders/${o.id}/status`, hotel, { status: 'CONFIRMED' })).status, 409, 'buyer cannot confirm');
  assert.equal((await t.api('PATCH', `/orders/${o.id}/status`, ravi, { status: 'DELIVERED' })).status, 409, 'cannot skip steps');
  assert.equal((await t.api('GET', `/orders/${o.id}`, lakshmi)).status, 403, 'strangers cannot see orders');

  const raviBefore = (await t.api('GET', '/auth/me', ravi)).data.user.walletBalance;
  for (const s of ['CONFIRMED', 'PROCESSING', 'READY_FOR_PICKUP', 'PICKED_UP', 'IN_TRANSIT']) {
    assert.equal((await t.api('PATCH', `/orders/${o.id}/status`, ravi, { status: s })).status, 200, s);
  }
  const delivered = await t.api('PATCH', `/orders/${o.id}/status`, hotel, { status: 'DELIVERED' });
  assert.equal(delivered.data.paymentStatus, 'PAID');
  assert.equal((await t.api('GET', '/auth/me', ravi)).data.user.walletBalance, raviBefore + 2500);

  const c = (await t.api('POST', '/orders', retail, { listingId: l.id, quantity: 60, deliveryAddress: 'FreshMart DC, Mysuru' })).data;
  assert.equal((await t.api('GET', `/marketplace/listings/${l.id}`, retail)).data.quantityAvailable, 140);
  assert.equal((await t.api('PATCH', `/orders/${c.id}/status`, retail, { status: 'CANCELLED' })).status, 200);
  assert.equal((await t.api('GET', `/marketplace/listings/${l.id}`, retail)).data.quantityAvailable, 200);
});

test('residue bidding: private bids, accept locks the lot, completion moves money', async () => {
  const harpreet = await t.login('harpreet@agriloop.demo');
  const lot = (await t.api('GET', '/marketplace/listings?kind=RESIDUE', hotel)).data.find((l) => l.title === 'Wheat Straw');
  const pickup = new Date(Date.now() + 2 * 864e5).toISOString().slice(0, 10);
  assert.equal((await t.api('POST', `/marketplace/listings/${lot.id}/bids`, harpreet, { pricePerTon: 5000, pickupDate: pickup })).status, 403, 'seller cannot bid');
  assert.equal((await t.api('POST', `/marketplace/listings/${lot.id}/bids`, hotel, { pricePerTon: 4800, pickupDate: pickup })).status, 201);

  const buyerView = (await t.api('GET', `/marketplace/listings/${lot.id}`, retail)).data;
  assert.equal(buyerView.bids, undefined, "buyers don't see other buyers' bids");
  const sellerView = (await t.api('GET', `/marketplace/listings/${lot.id}`, harpreet)).data;
  assert.equal(sellerView.bids.length, 2);

  const win = sellerView.bids.find((b) => b.pricePerTon === 4800);
  assert.equal((await t.api('POST', `/marketplace/listings/${lot.id}/bids/${win.id}/accept`, hotel)).status, 403);
  assert.equal((await t.api('POST', `/marketplace/listings/${lot.id}/bids/${win.id}/accept`, harpreet)).status, 200);
  assert.equal((await t.api('POST', `/marketplace/listings/${lot.id}/bids`, retail, { pricePerTon: 9000, pickupDate: pickup })).status, 409);

  const before = (await t.api('GET', '/auth/me', harpreet)).data.user;
  assert.equal((await t.api('POST', `/marketplace/listings/${lot.id}/complete`, retail)).status, 403, 'losing bidder cannot complete');
  const done = await t.api('POST', `/marketplace/listings/${lot.id}/complete`, hotel);
  assert.equal(done.data.status, 'SOLD_OUT');
  const afterUser = (await t.api('GET', '/auth/me', harpreet)).data.user;
  assert.equal(afterUser.walletBalance, before.walletBalance + 4800 * 12);
  assert.equal(afterUser.carbonPoints, before.carbonPoints + Math.round((1460 * 12) / 10));
});
