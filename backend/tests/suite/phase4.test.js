import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startTestApp } from './helpers.js';
import { deliverDueReminders } from '../../services/schemeService.js';
import SchemeReminder from '../../models/SchemeReminder.js';

let t;
let ravi;
let lakshmi;
let suresh;
let fpo;
before(async () => {
  t = await startTestApp();
  ravi = await t.login('ravi@agriloop.demo');
  lakshmi = await t.login('lakshmi@agriloop.demo');
  suresh = await t.login('suresh@agriloop.demo');
  fpo = await t.login('fpo.mandya@agriloop.demo');
});
after(async () => { await t.stop(); });

const future = (days) => new Date(Date.now() + days * 86400000).toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });

// ---------------------------------------------------------------- FPO workspace
test('FPO workspace: only the FPO sees it, with real member numbers', async () => {
  assert.equal((await t.api('GET', '/fpo/overview', ravi)).status, 403);
  const { status, data } = await t.api('GET', '/fpo/overview', fpo);
  assert.equal(status, 200);
  assert.equal(data.fpo.name, 'Mandya Tomato Growers FPO');
  assert.equal(data.totals.members, 10);
  assert.equal(data.members.length, 10);
  assert.ok(data.members.every((m) => typeof m.unpaidAmount === 'number'));
  const raviRow = data.members.find((m) => m.name === 'Ravi Kumar');
  assert.ok(raviRow.unpaidCount >= 1, 'Ravi has an onion payment still processing');
  assert.equal(data.totals.membersWaitingForPayment, data.members.filter((m) => m.unpaidCount > 0).length);
});

test('FPO members: add by farmer code, no duplicates, remove', async () => {
  const before = (await t.api('GET', '/fpo/overview', fpo)).data.totals.members;
  assert.equal((await t.api('POST', '/fpo/members', fpo, { farmerCode: 'FR-00003' })).status, 201); // Suresh
  assert.equal((await t.api('POST', '/fpo/members', fpo, { farmerCode: 'FR-00003' })).status, 409);
  assert.equal((await t.api('POST', '/fpo/members', fpo, { farmerCode: 'FR-99999' })).status, 404);
  assert.equal((await t.api('POST', '/fpo/members', ravi, { farmerCode: 'FR-00004' })).status, 403);
  const data = (await t.api('GET', '/fpo/overview', fpo)).data;
  assert.equal(data.totals.members, before + 1);
  const suresh = data.members.find((m) => m.farmerCode === 'FR-00003');
  assert.equal((await t.api('DELETE', `/fpo/members/${suresh.id}`, fpo)).status, 200);
  assert.equal((await t.api('DELETE', `/fpo/members/${suresh.id}`, fpo)).status, 404);
});

// ---------------------------------------------------------------- Glut alerts
test('glut alerts flag a crop booked far above the centre\'s usual daily intake', async () => {
  const farmers = await Promise.all(Array.from({ length: 12 }, (_, i) => t.login(`farmer${String(30 + i)}@agriloop.demo`)));
  const centers = (await t.api('GET', '/procurement-centers', ravi)).data;
  const mandya = centers.find((c) => c.code === 'M01');
  const tomato = mandya.crops.find((c) => c.name === 'Tomato');
  const day = future(5);
  const slots = (await t.api('GET', `/procurement-centers/${mandya.id}/slots?date=${day}`, ravi)).data.slots.filter((s) => s.available);
  let booked = 0;
  for (let i = 0; i < farmers.length; i++) {
    const r = await t.api('POST', '/procurement/bookings', farmers[i], { slotId: slots[i % slots.length].id, cropId: tomato.id, estimatedQuantity: 2000 });
    if (r.status === 201) booked += 1;
  }
  assert.ok(booked >= 10, `bookings made (${booked})`);

  const { status, data } = await t.api('GET', '/alerts/glut', ravi);
  assert.equal(status, 200);
  assert.equal(data.basis, 'AgriLoop bookings only');
  const alert = data.alerts.find((a) => a.date === day && a.crop === 'Tomato' && a.centerName.startsWith('Mandya'));
  assert.ok(alert, JSON.stringify(data.alerts));
  assert.ok(alert.bookedKg >= 20000);
  assert.ok(alert.ratio >= 1.5);
  assert.ok(['WATCH', 'HIGH'].includes(alert.severity));
  assert.ok(Array.isArray(alert.lighterDays));
  // buyers do not get farm-side alerts
  assert.equal((await t.api('GET', '/alerts/glut', await t.login('buyer.hotel@agriloop.demo'))).status, 403);
});

// ---------------------------------------------------------------- Machine rental
test('machines: list, own listing rules, request, accept, one renter per day', async () => {
  const all = (await t.api('GET', '/machines?state=Karnataka', ravi)).data;
  const tractor = all.find((m) => m.type === 'TRACTOR');
  assert.ok(tractor);
  assert.equal((await t.api('POST', '/machines', await t.login('buyer.hotel@agriloop.demo'), { name: 'x', type: 'TRACTOR', rate: 1, rateUnit: 'PER_HOUR', district: 'a', state: 'b' })).status, 403);
  assert.equal((await t.api('POST', '/machines', suresh, { name: 'Bad', type: 'ROCKET', rate: 1, rateUnit: 'PER_HOUR', district: 'Mysuru', state: 'Karnataka' })).status, 400);

  const day = future(10);
  assert.equal((await t.api('POST', `/machines/${tractor.id}/book`, lakshmi, { date: day, quantity: 2 })).status, 400, 'own machine');
  assert.equal((await t.api('POST', `/machines/${tractor.id}/book`, suresh, { date: '2020-01-01', quantity: 2 })).status, 400);
  const a = await t.api('POST', `/machines/${tractor.id}/book`, suresh, { date: day, quantity: 3 });
  assert.equal(a.status, 201);
  assert.equal(a.data.estimatedTotal, 2100);
  const b = await t.api('POST', `/machines/${tractor.id}/book`, ravi, { date: day, quantity: 2 });
  assert.equal(b.status, 201, 'two requests can be pending');

  assert.equal((await t.api('POST', `/machines/bookings/${a.data.id}/accept`, ravi)).status, 403, 'only the owner accepts');
  assert.equal((await t.api('POST', `/machines/bookings/${a.data.id}/accept`, lakshmi)).status, 200);
  assert.equal((await t.api('POST', `/machines/bookings/${b.data.id}/accept`, lakshmi)).status, 409, 'day already taken');
  assert.ok((await t.api('GET', `/machines/${tractor.id}/availability`, ravi)).data.bookedDates.includes(day));
  assert.equal((await t.api('POST', `/machines/${tractor.id}/book`, ravi, { date: day, quantity: 1 })).status, 409);

  const owner = (await t.api('GET', '/machines/bookings?as=owner', lakshmi)).data;
  assert.ok(owner.some((x) => x.id === a.data.id && x.role === 'OWNER'));
  assert.equal((await t.api('POST', `/machines/bookings/${a.data.id}/complete`, lakshmi)).status, 409, 'cannot complete before the day');
  assert.equal((await t.api('POST', `/machines/bookings/${a.data.id}/cancel`, suresh)).status, 200);
  assert.equal((await t.api('POST', `/machines/bookings/${b.data.id}/decline`, lakshmi)).status, 200);
});

test('simultaneous accepts for the same day let only one renter win', async () => {
  const mine = (await t.api('GET', '/machines?mine=true', lakshmi)).data[0];
  const day = future(12);
  const r1 = await t.api('POST', `/machines/${mine.id}/book`, ravi, { date: day, quantity: 1 });
  const r2 = await t.api('POST', `/machines/${mine.id}/book`, suresh, { date: day, quantity: 1 });
  const results = await Promise.all([r1, r2].map((r) => t.api('POST', `/machines/bookings/${r.data.id}/accept`, lakshmi)));
  assert.deepEqual(results.map((r) => r.status).sort(), [200, 409]);
});

// ---------------------------------------------------------------- Scheme reminders
test('schemes: catalogue marks where a scheme does not apply, reminders validate and are private', async () => {
  const list = (await t.api('GET', '/schemes', ravi)).data;
  const pmfby = list.find((s) => s.id === 'pmfby');
  assert.equal(pmfby.applies, true, 'Karnataka takes part');
  assert.ok(pmfby.suggestedDates.length === 2);
  assert.ok(pmfby.reminders.some((r) => r.note === 'Enrol the tomato crop'), 'seeded reminder');

  const harpreet = await t.login('harpreet@agriloop.demo');
  assert.equal((await t.api('GET', '/schemes', harpreet)).data.find((s) => s.id === 'pmfby').applies, false, 'Punjab is not in PMFBY');

  assert.equal((await t.api('POST', '/schemes/reminders', ravi, { schemeId: 'nope', remindOn: future(3) })).status, 404);
  assert.equal((await t.api('POST', '/schemes/reminders', ravi, { schemeId: 'kcc', remindOn: '2020-01-01' })).status, 400);
  const ok = await t.api('POST', '/schemes/reminders', ravi, { schemeId: 'kcc', remindOn: future(3), note: 'Visit bank' });
  assert.equal(ok.status, 201);
  assert.equal((await t.api('DELETE', `/schemes/reminders/${ok.data.id}`, suresh)).status, 404, "not someone else's");
  assert.equal((await t.api('DELETE', `/schemes/reminders/${ok.data.id}`, ravi)).status, 200);
});

test('due reminders become notifications exactly once', async () => {
  const user = (await t.api('GET', '/auth/me', suresh)).data.user;
  await SchemeReminder.create({ user: user.id, schemeId: 'pm-kisan', remindOn: future(0), note: 'Check instalment' });
  const first = await deliverDueReminders();
  assert.ok(first.sent >= 1);
  assert.equal((await deliverDueReminders()).sent, 0, 'not sent twice');
  const notes = JSON.stringify((await t.api('GET', '/notifications', suresh)).data);
  assert.ok(notes.includes('Reminder · PM-KISAN') && notes.includes('Check instalment'));
});
