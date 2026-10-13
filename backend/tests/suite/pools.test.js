import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startTestApp } from './helpers.js';

let t;
let ravi;
let lakshmi;
let harpreet;
let gurmeet;
let hotel;
let retail;
let household;
before(async () => {
  t = await startTestApp();
  ravi = await t.login('ravi@agriloop.demo');
  lakshmi = await t.login('lakshmi@agriloop.demo');
  harpreet = await t.login('harpreet@agriloop.demo');
  gurmeet = await t.login('gurmeet@agriloop.demo');
  hotel = await t.login('buyer.hotel@agriloop.demo');
  retail = await t.login('buyer.retail@agriloop.demo');
  household = await t.login('household@agriloop.demo');
});
after(async () => { await t.stop(); });

const future = (days) => new Date(Date.now() + days * 86400000).toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
const list = async (token) => (await t.api('GET', '/pools', token)).data;

test('pools list shows progress toward the minimum and days left', async () => {
  const pools = await list(ravi);
  const kikkeri = pools.find((p) => p.name.startsWith('Kikkeri'));
  assert.equal(kikkeri.totalTonnes, 13.5);
  assert.equal(kikkeri.reachedMinimum, false);
  assert.equal(kikkeri.progressPercent, 68);
  assert.ok(kikkeri.daysLeft >= 11);
  assert.equal(kikkeri.members, undefined, 'non-members do not see member names');
});

test('joining: once only, validated, farmers only', async () => {
  const kikkeri = (await list(ravi)).find((p) => p.name.startsWith('Kikkeri'));
  assert.equal((await t.api('POST', `/pools/${kikkeri.id}/join`, ravi, { tonnes: 0 })).status, 400);
  const ok = await t.api('POST', `/pools/${kikkeri.id}/join`, ravi, { tonnes: 7 });
  assert.equal(ok.status, 200);
  assert.equal(ok.data.totalTonnes, 20.5);
  assert.equal(ok.data.reachedMinimum, true);
  assert.equal((await t.api('POST', `/pools/${kikkeri.id}/join`, ravi, { tonnes: 1 })).status, 409);
  assert.equal((await t.api('POST', `/pools/${kikkeri.id}/join`, household, { tonnes: 1 })).status, 403);
  const left = await t.api('POST', `/pools/${kikkeri.id}/leave`, ravi);
  assert.equal(left.data.totalTonnes, 13.5);
});

test('creating a pool validates the deadline and minimum', async () => {
  const body = { name: 'Test pool', residue: 'Paddy straw', minTonnes: 10, myTonnes: 2, deadline: future(10), district: 'Mandya', state: 'Karnataka' };
  assert.equal((await t.api('POST', '/pools', ravi, { ...body, deadline: '2020-01-01' })).status, 400);
  assert.equal((await t.api('POST', '/pools', ravi, { ...body, deadline: future(200) })).status, 400);
  assert.equal((await t.api('POST', '/pools', ravi, { ...body, minTonnes: 0 })).status, 400);
  assert.equal((await t.api('POST', '/pools', hotel, body)).status, 403);
  const ok = await t.api('POST', '/pools', ravi, body);
  assert.equal(ok.status, 201);
  assert.equal(ok.data.isCoordinator, true);
  assert.equal(ok.data.totalTonnes, 2);
});

test('bids need the minimum, stay private, and acceptance locks the pool', async () => {
  const dhuri = (await list(harpreet)).find((p) => p.name.startsWith('Dhuri'));
  assert.equal(dhuri.reachedMinimum, true);
  assert.equal(dhuri.bids.length, 1, 'coordinator sees the bid');

  // the other buyer cannot see FreshMart's price
  const hotelView = (await t.api('GET', `/pools/${dhuri.id}`, hotel)).data;
  assert.equal(hotelView.bids.length, 0);
  assert.equal((await t.api('POST', `/pools/${dhuri.id}/bids`, hotel, { pricePerTon: 2100, pickupDate: future(10) })).status, 201);
  assert.equal((await t.api('POST', `/pools/${dhuri.id}/bids`, hotel, { pricePerTon: 2200, pickupDate: future(10) })).status, 409, 'one open bid per buyer');

  // a bid below the minimum is refused
  const kikkeri = (await list(ravi)).find((p) => p.name.startsWith('Kikkeri'));
  assert.equal((await t.api('POST', `/pools/${kikkeri.id}/bids`, hotel, { pricePerTon: 2000, pickupDate: future(10) })).status, 409);

  // only the coordinator accepts
  const bids = (await t.api('GET', `/pools/${dhuri.id}`, harpreet)).data.bids;
  const hotelBid = bids.find((b) => b.buyerName === 'Hotel Annapoorna');
  assert.equal((await t.api('POST', `/pools/${dhuri.id}/bids/${hotelBid.id}/accept`, gurmeet)).status, 403);
  const accepted = await t.api('POST', `/pools/${dhuri.id}/bids/${hotelBid.id}/accept`, harpreet);
  assert.equal(accepted.status, 200);
  assert.equal(accepted.data.status, 'RESERVED');
  assert.equal(accepted.data.bids.find((b) => b.buyerName === 'FreshMart Retail').status, 'REJECTED');

  // locked: nobody joins or leaves
  assert.equal((await t.api('POST', `/pools/${dhuri.id}/leave`, gurmeet)).status, 409);
  assert.equal((await t.api('POST', `/pools/${dhuri.id}/bids`, retail, { pricePerTon: 3000, pickupDate: future(10) })).status, 409);
});

test('completion pays each member pro-rata from the buyer wallet', async () => {
  const me = async (token) => (await t.api('GET', '/auth/me', token)).data.user;
  const dhuri = (await list(harpreet)).find((p) => p.name.startsWith('Dhuri'));
  const before = { h: (await me(harpreet)).walletBalance, g: (await me(gurmeet)).walletBalance, b: (await me(hotel)).walletBalance };
  assert.equal((await t.api('POST', `/pools/${dhuri.id}/complete`, ravi)).status, 403);
  const done = await t.api('POST', `/pools/${dhuri.id}/complete`, harpreet);
  assert.equal(done.status, 200);
  assert.equal(done.data.status, 'COLLECTED');
  const after = { h: (await me(harpreet)).walletBalance, g: (await me(gurmeet)).walletBalance, b: (await me(hotel)).walletBalance };
  assert.equal(after.h - before.h, 18 * 2100);
  assert.equal(after.g - before.g, 14 * 2100);
  assert.equal(before.b - after.b, 32 * 2100);
  assert.equal((await t.api('POST', `/pools/${dhuri.id}/complete`, harpreet)).status, 409, 'cannot be paid twice');
});

test('coordinator can cancel an open pool, others cannot', async () => {
  const kikkeri = (await list(ravi)).find((p) => p.name.startsWith('Kikkeri'));
  assert.equal((await t.api('POST', `/pools/${kikkeri.id}/cancel`, ravi)).status, 403);
  assert.equal((await t.api('POST', `/pools/${kikkeri.id}/cancel`, lakshmi)).status, 200);
  assert.equal((await list(ravi)).some((p) => p.id === kikkeri.id), false);
});
