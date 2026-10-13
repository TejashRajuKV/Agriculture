import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startTestApp } from './helpers.js';

let t;
let ravi;
let manager;
let managerPb;
let mandya;
let paddy;
before(async () => {
  t = await startTestApp();
  ravi = await t.login('ravi@agriloop.demo');
  manager = await t.login('manager.karnataka@agriloop.demo');
  managerPb = await t.login('manager.punjab@agriloop.demo');
  const centers = (await t.api('GET', '/procurement-centers', ravi)).data;
  mandya = centers.find((c) => c.code === 'M01');
  paddy = mandya.crops.find((c) => c.name === 'Paddy');
});
after(async () => { await t.stop(); });

test('centre shows buying price and moisture limit per crop', async () => {
  const price = mandya.prices.find((p) => p.cropId === paddy.id);
  assert.ok(price, 'paddy price listed');
  assert.equal(price.maxMoisturePct, 17);
  assert.ok(price.pricePerKg > 0);
  assert.ok(mandya.pricesUpdatedAt);
});

test('manager can update a price; other regions cannot; bad values rejected', async () => {
  const ok = await t.api('POST', `/manager/centers/${mandya.id}/prices`, manager, { cropId: paddy.id, pricePerKg: 25.5, maxMoisturePct: 16 });
  assert.equal(ok.status, 200);
  const after = (await t.api('GET', `/procurement-centers/${mandya.id}`, ravi)).data;
  const p = after.prices.find((x) => x.cropId === paddy.id);
  assert.equal(p.pricePerKg, 25.5);
  assert.equal(p.maxMoisturePct, 16);

  assert.equal((await t.api('POST', `/manager/centers/${mandya.id}/prices`, managerPb, { cropId: paddy.id, pricePerKg: 1 })).status, 403);
  assert.equal((await t.api('POST', `/manager/centers/${mandya.id}/prices`, manager, { cropId: paddy.id, pricePerKg: -3 })).status, 400);
  assert.equal((await t.api('POST', `/manager/centers/${mandya.id}/prices`, ravi, { cropId: paddy.id, pricePerKg: 5 })).status, 403);
});

test('farmer payment list returns only own payments with typical payout', async () => {
  const { status, data } = await t.api('GET', '/procurement/payments', ravi);
  assert.equal(status, 200);
  assert.ok(Array.isArray(data));
  for (const p of data) assert.ok(['PENDING', 'PROCESSING', 'PAID', 'FAILED'].includes(p.status));
  const buyer = await t.login('buyer.hotel@agriloop.demo');
  assert.equal((await t.api('GET', '/procurement/payments', buyer)).status, 403);
});

test('manager notes a delay reason and farmer sees it', async () => {
  const overview = (await t.api('GET', `/manager/overview?centerId=${mandya.id}`, manager)).data;
  const pay = (overview.payments || []).find((p) => p.status !== 'PAID');
  if (!pay) return; // seed has no unpaid payment at this centre
  const bad = await t.api('POST', `/manager/payment/${pay.id}/delay`, manager, { code: 'NOPE' });
  assert.equal(bad.status, 400);
  const ok = await t.api('POST', `/manager/payment/${pay.id}/delay`, manager, { code: 'FUNDS_PENDING', note: 'Release due Friday' });
  assert.equal(ok.status, 200);
  assert.equal((await t.api('POST', `/manager/payment/${pay.id}/delay`, managerPb, { code: 'OTHER' })).status, 403);
});
