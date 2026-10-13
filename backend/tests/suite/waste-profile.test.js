import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startTestApp } from './helpers.js';

let t;
let household;
let household2;
let biogas;
let ravi;
before(async () => {
  t = await startTestApp();
  [household, household2, biogas, ravi] = await Promise.all(
    ['household@agriloop.demo', 'household2@agriloop.demo', 'biogas@agriloop.demo', 'ravi@agriloop.demo'].map((e) => t.login(e))
  );
});
after(async () => { await t.stop(); });

const submit = (token, body = {}) =>
  t.api('POST', '/waste', token, { degradability: 'DEGRADABLE', quantityKg: 8, address: '14 Vijayanagar, Mysuru', ...body });

test('only households submit; input is validated', async () => {
  assert.equal((await submit(ravi)).status, 403);
  assert.equal((await submit(biogas)).status, 403);
  assert.equal((await submit(household, { quantityKg: 0 })).status, 400);
  assert.equal((await submit(household, { quantityKg: 5000 })).status, 400);
  assert.equal((await submit(household, { address: 'x' })).status, 400);
  assert.equal((await submit(household, { degradability: 'METAL' })).status, 400);
  const ok = await submit(household);
  assert.equal(ok.status, 201);
  assert.equal(ok.data.stage, 'OPEN');
});

test('waste requests never leak into the produce or residue marketplace', async () => {
  const produce = (await t.api('GET', '/marketplace/listings?kind=PRODUCE', ravi)).data;
  const residue = (await t.api('GET', '/marketplace/listings?kind=RESIDUE', ravi)).data;
  assert.ok([...produce, ...residue].every((l) => l.kind !== 'HOUSEHOLD'));
  assert.equal((await t.api('GET', '/marketplace/listings?kind=HOUSEHOLD', ravi)).status, 400);
});

test('privacy: households see only their own requests, plants see open + their own', async () => {
  const mine = (await t.api('GET', '/waste', household2)).data;
  assert.ok(mine.every((r) => r.isOwn));
  const plant = (await t.api('GET', '/waste', biogas)).data;
  assert.ok(plant.every((r) => r.stage === 'OPEN' || r.claimedByMe));
  assert.equal((await t.api('GET', '/waste', ravi)).status, 403);
});

test('claim: one plant wins, non-degradable refused, only the claimer can confirm, points awarded', async () => {
  const r = (await submit(household2, { quantityKg: 10, address: '22 Hosahalli Road, Mandya' })).data;
  const plain = (await submit(household2, { degradability: 'NON_DEGRADABLE', quantityKg: 2, address: '22 Hosahalli Road, Mandya' })).data;
  assert.equal((await t.api('POST', `/waste/${plain.id}/claim`, biogas)).status, 400, 'biogas cannot take plastics/metal');
  assert.equal((await t.api('POST', `/waste/${r.id}/claim`, household)).status, 403);

  const beforePoints = (await t.api('GET', '/auth/me', household2)).data.user.carbonPoints;
  assert.equal((await t.api('POST', `/waste/${r.id}/collected`, biogas)).status, 403, 'must claim first');
  const claim = await t.api('POST', `/waste/${r.id}/claim`, biogas);
  assert.equal(claim.status, 200);
  assert.equal(claim.data.stage, 'CLAIMED');
  assert.equal((await t.api('POST', `/waste/${r.id}/claim`, biogas)).status, 409, 'already taken');
  assert.equal((await t.api('POST', `/waste/${r.id}/cancel`, household2)).status, 409, 'cannot cancel once claimed');

  const done = await t.api('POST', `/waste/${r.id}/collected`, biogas);
  assert.equal(done.data.stage, 'COLLECTED');
  assert.equal(done.data.pointsEarned, 20);
  assert.equal((await t.api('GET', '/auth/me', household2)).data.user.carbonPoints, beforePoints + 20);
  assert.equal((await t.api('POST', `/waste/${r.id}/collected`, biogas)).status, 409, 'cannot collect twice');

  const dash = (await t.api('GET', '/dashboard', household2)).data;
  assert.ok(dash.waste.collectedKg >= 10);
});

test('profile update validates and re-locates; cannot change role or email', async () => {
  assert.equal((await t.api('PATCH', '/auth/me', ravi, { name: 'R' })).status, 400);
  assert.equal((await t.api('PATCH', '/auth/me', ravi, { phone: '123' })).status, 400);
  const res = await t.api('PATCH', '/auth/me', ravi, { name: 'Ravi K', phone: '98 0000 0001', location: 'Maddur, Karnataka', role: 'ADMIN', email: 'x@y.in' });
  assert.equal(res.status, 200);
  assert.equal(res.data.user.name, 'Ravi K');
  assert.equal(res.data.user.location, 'Maddur, Karnataka');
  assert.equal(res.data.user.role, 'FARMER', 'role must not be editable');
  assert.equal(res.data.user.email, 'ravi@agriloop.demo', 'email must not be editable');
  assert.equal((await t.api('PATCH', '/auth/me', null, { name: 'Nope' })).status, 401);
});

test('public stats are real aggregates with no personal data', async () => {
  const { status, data } = await t.api('GET', '/public/stats');
  assert.equal(status, 200);
  assert.ok(data.farmers >= 55);
  assert.equal(data.procurementCenters, 3);
  assert.ok(data.tonnesProcured > 0);
  assert.deepEqual(Object.keys(data).sort(), ['activeListings', 'farmers', 'lotsProcured', 'procurementCenters', 'tonnesProcured']);
});

test('residue sales appear in the farmer earnings trend', async () => {
  const harpreet = await t.login('harpreet@agriloop.demo');
  const buyer = await t.login('buyer.hotel@agriloop.demo');
  const lot = (await t.api('GET', '/marketplace/listings?kind=RESIDUE', buyer)).data.find((l) => l.title === 'Wheat Straw');
  const pickup = new Date(Date.now() + 864e5).toISOString().slice(0, 10);
  await t.api('POST', `/marketplace/listings/${lot.id}/bids`, buyer, { pricePerTon: 5000, pickupDate: pickup });
  const bid = (await t.api('GET', `/marketplace/listings/${lot.id}`, harpreet)).data.bids.find((b) => b.pricePerTon === 5000);
  await t.api('POST', `/marketplace/listings/${lot.id}/bids/${bid.id}/accept`, harpreet);
  await t.api('POST', `/marketplace/listings/${lot.id}/complete`, buyer);
  const dash = (await t.api('GET', '/dashboard', harpreet)).data;
  const thisMonth = dash.trend.at(-1);
  assert.ok(thisMonth.marketplace >= 60000, `expected ≥ ₹60,000 (5000 × 12 t) in this month's marketplace, got ${thisMonth.marketplace}`);
});
