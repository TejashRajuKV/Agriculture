import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startTestApp, tomorrow } from './helpers.js';

let t;
let ravi;
let manager;
let mandya;
let tomato;
before(async () => {
  t = await startTestApp();
  ravi = await t.login('ravi@agriloop.demo');
  manager = await t.login('manager.karnataka@agriloop.demo');
  const centers = (await t.api('GET', '/procurement-centers', ravi)).data;
  mandya = centers.find((c) => c.code === 'M01');
  tomato = mandya.crops.find((c) => c.name === 'Tomato');
});
after(async () => { await t.stop(); });

const slotsFor = async (date, token = ravi) => (await t.api('GET', `/procurement-centers/${mandya.id}/slots?date=${date}`, token)).data.slots;

test('centres list shows queue state from the database', async () => {
  assert.equal(mandya.today.nowServing.slice(-3), '039');
  assert.equal(mandya.today.inQueue, 8); // 039 processing + 040-046 waiting
});

test('booking creates a server-side token and booking number', async () => {
  const slot = (await slotsFor(tomorrow())).find((s) => s.available);
  const { status, data } = await t.api('POST', '/procurement/bookings', ravi, { slotId: slot.id, cropId: tomato.id, estimatedQuantity: 500 });
  assert.equal(status, 201);
  assert.match(data.token, /^M01-\d{4}-\d{3}$/);
  assert.match(data.bookingNumber, /^PR-\d{4}-\d{5}$/);
  assert.equal(data.queueStatus, 'NOT_JOINED');

  // same farmer, same centre, same day -> rejected
  const other = (await slotsFor(tomorrow())).find((s) => s.available && s.id !== slot.id);
  const dup = await t.api('POST', '/procurement/bookings', ravi, { slotId: other.id, cropId: tomato.id, estimatedQuantity: 100 });
  assert.equal(dup.status, 409);

  // can't join the queue before the booking day
  const early = await t.api('POST', `/procurement/bookings/${data.id}/check-in`, ravi);
  assert.equal(early.status, 409);
});

test('concurrent bookings never overbook a slot and tokens stay unique', async () => {
  const slot = (await slotsFor(tomorrow())).filter((s) => s.available && s.booked === 0).at(-1);
  const emails = Array.from({ length: slot.capacity + 4 }, (_, i) => `farmer${String(i + 1).padStart(2, '0')}@agriloop.demo`);
  const tokens = await Promise.all(emails.map((e) => t.login(e)));
  const results = await Promise.all(tokens.map((tk) => t.api('POST', '/procurement/bookings', tk, { slotId: slot.id, cropId: tomato.id, estimatedQuantity: 200 })));
  const ok = results.filter((r) => r.status === 201);
  assert.equal(ok.length, slot.capacity, 'exactly capacity bookings succeed');
  assert.ok(results.filter((r) => r.status !== 201).every((r) => r.status === 409));
  assert.equal(new Set(ok.map((r) => r.data.token)).size, ok.length, 'tokens are unique');
  const after = (await slotsFor(tomorrow())).find((s) => s.id === slot.id);
  assert.equal(after.booked, slot.capacity);
  assert.equal(after.available, false);
});

test('invalid dates and quantities are rejected', async () => {
  assert.equal((await t.api('GET', `/procurement-centers/${mandya.id}/slots?date=2020-01-01`, ravi)).status, 400);
  assert.equal((await t.api('GET', `/procurement-centers/${mandya.id}/slots?date=2099-01-01`, ravi)).status, 400);
  assert.equal((await t.api('GET', `/procurement-centers/${mandya.id}/slots?date=2026-02-31`, ravi)).status, 400);
  const slot = (await slotsFor(tomorrow(), await t.login('lakshmi@agriloop.demo')))[0];
  const lakshmi = await t.login('suresh@agriloop.demo');
  assert.equal((await t.api('POST', '/procurement/bookings', lakshmi, { slotId: slot.id, cropId: tomato.id, estimatedQuantity: -5 })).status, 400);
  assert.equal((await t.api('POST', '/procurement/bookings', lakshmi, { slotId: 'not-an-id', cropId: tomato.id, estimatedQuantity: 5 })).status, 400);
});

test('queue position and wait come from the database', async () => {
  const f40 = await t.login('farmer40@agriloop.demo');
  const [mine] = (await t.api('GET', '/procurement/bookings', f40)).data.filter((b) => b.center.code === 'M01' && b.queueStatus === 'WAITING');
  const q = (await t.api('GET', `/procurement/bookings/${mine.id}/queue`, f40)).data;
  assert.equal(q.token.slice(-3), '040');
  assert.equal(q.nowServing.slice(-3), '039');
  assert.equal(q.peopleAhead, 1);
  assert.equal(q.estimatedWaitMinutes, Math.ceil((1 * q.calculation.averageProcessingMinutes) / q.calculation.counters));
});

test('manager pipeline enforces the order of steps and computes the amount', async () => {
  const ov = (await t.api('GET', '/manager/overview', manager)).data;
  const next = ov.queue.next[0];
  assert.equal(next.token.slice(-3), '040');

  // can't start before calling, can't weigh before starting
  assert.equal((await t.api('POST', `/manager/procurement/${next.bookingId}/start`, manager)).status, 409);
  assert.equal((await t.api('POST', `/manager/queue/${next.bookingId}/call`, manager)).status, 200);
  assert.equal((await t.api('POST', `/manager/procurement/${next.bookingId}/quality`, manager, { qualityGrade: 'A', acceptedQuantity: 10 })).status, 409);
  assert.equal((await t.api('POST', `/manager/procurement/${next.bookingId}/start`, manager)).status, 200);
  assert.equal((await t.api('POST', `/manager/procurement/${next.bookingId}/weight`, manager, { weighedQuantity: 500 })).status, 200);
  // accepted more than weighed -> 400
  assert.equal((await t.api('POST', `/manager/procurement/${next.bookingId}/quality`, manager, { qualityGrade: 'A', acceptedQuantity: 600, pricePerKg: 24 })).status, 400);
  const q = await t.api('POST', `/manager/procurement/${next.bookingId}/quality`, manager, { qualityGrade: 'A', acceptedQuantity: 472, pricePerKg: 24 });
  assert.equal(q.data.procurement.totalAmount, 11328);
  assert.equal(q.data.procurement.status, 'PARTIALLY_ACCEPTED');
  const done = await t.api('POST', `/manager/procurement/${next.bookingId}/complete`, manager);
  assert.equal(done.data.payment.status, 'PROCESSING');
  assert.equal((await t.api('POST', `/manager/procurement/${next.bookingId}/complete`, manager)).status, 409, 'cannot complete twice');

  // payment: farmer can't mark paid, other centre's manager can't, own manager can
  const f40 = await t.login('farmer40@agriloop.demo');
  assert.equal((await t.api('POST', `/manager/payment/${done.data.payment.id}/update`, f40, { status: 'PAID' })).status, 403);
  const punjab = await t.login('manager.punjab@agriloop.demo');
  assert.equal((await t.api('POST', `/manager/payment/${done.data.payment.id}/update`, punjab, { status: 'PAID' })).status, 403);
  const before = (await t.api('GET', '/auth/me', f40)).data.user.walletBalance;
  const paid = await t.api('POST', `/manager/payment/${done.data.payment.id}/update`, manager, { status: 'PAID' });
  assert.equal(paid.data.status, 'PAID');
  assert.equal((await t.api('GET', '/auth/me', f40)).data.user.walletBalance, before + 11328);
  assert.equal((await t.api('POST', `/manager/payment/${done.data.payment.id}/update`, manager, { status: 'PAID' })).status, 409, 'paid once only');

  // the farmer sees it all on their timeline
  const status = (await t.api('GET', `/procurement/bookings/${next.bookingId}/status`, f40)).data;
  assert.ok(status.timeline.every((s) => s.done));
  assert.ok(status.timeline.some((s) => s.label === 'Partially accepted'));
});

test('authorisation: farmers, buyers and other managers are kept out', async () => {
  const buyer = await t.login('buyer.hotel@agriloop.demo');
  assert.equal((await t.api('GET', '/manager/overview', ravi)).status, 403);
  assert.equal((await t.api('GET', '/manager/overview', buyer)).status, 403);
  assert.equal((await t.api('POST', '/procurement/bookings', buyer, {})).status, 403);

  const ov = (await t.api('GET', '/manager/overview', manager)).data;
  const someoneElse = ov.queue.next[0].bookingId;
  assert.equal((await t.api('GET', `/procurement/bookings/${someoneElse}`, ravi)).status, 403, "farmer can't read another farmer's booking");
  assert.equal((await t.api('POST', `/manager/procurement/${someoneElse}/start`, buyer)).status, 403, "buyer can't touch procurement");

  const punjab = await t.login('manager.punjab@agriloop.demo');
  assert.equal((await t.api('GET', `/manager/overview?centerId=${mandya.id}`, punjab)).status, 403);
  assert.equal((await t.api('POST', `/manager/queue/${someoneElse}/call`, punjab)).status, 403);
});
