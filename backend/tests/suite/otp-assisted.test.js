import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startTestApp } from './helpers.js';
import { lastSmsTo } from '../../services/smsService.js';

let t;
before(async () => { t = await startTestApp(); });
after(async () => { await t.stop(); });

const RAVI = '9800000001';

test('OTP login: code is texted, works once, wrong codes are limited', async () => {
  const req = await t.api('POST', '/auth/otp/request', null, { phone: RAVI });
  assert.equal(req.status, 200);
  assert.ok(!JSON.stringify(req.data).match(/\b\d{6}\b/), 'the code is never in the API response');
  const code = /(\d{6}) is your AgriLoop/.exec(lastSmsTo(RAVI).text)[1];

  assert.equal((await t.api('POST', '/auth/otp/verify', null, { phone: RAVI, code: code === '000000' ? '111111' : '000000' })).status, 401);
  const ok = await t.api('POST', '/auth/otp/verify', null, { phone: RAVI, code });
  assert.equal(ok.status, 200);
  assert.equal(ok.data.user.email, 'ravi@agriloop.demo');
  assert.ok(ok.data.token);
  assert.equal((await t.api('GET', '/auth/me', ok.data.token)).status, 200);
  assert.equal((await t.api('POST', '/auth/otp/verify', null, { phone: RAVI, code })).status, 401, 'single use');
});

test('OTP: unknown numbers get the same reply and no SMS; requests are rate limited; 5 bad tries burn the code', async () => {
  const unknown = await t.api('POST', '/auth/otp/request', null, { phone: '9000000000' });
  assert.equal(unknown.status, 200);
  assert.equal(lastSmsTo('9000000000'), null);

  const phone = '9800000002';
  for (let i = 0; i < 3; i++) assert.equal((await t.api('POST', '/auth/otp/request', null, { phone })).status, 200);
  assert.equal((await t.api('POST', '/auth/otp/request', null, { phone })).status, 429);

  const real = /(\d{6}) is your/.exec(lastSmsTo(phone).text)[1];
  const wrong = real === '123456' ? '654321' : '123456';
  for (let i = 0; i < 5; i++) await t.api('POST', '/auth/otp/verify', null, { phone, code: wrong });
  assert.equal((await t.api('POST', '/auth/otp/verify', null, { phone, code: real })).status, 401, 'locked after 5 wrong tries');
  assert.equal((await t.api('POST', '/auth/otp/verify', null, { phone, code: 'abc' })).status, 400);
});

test('assisted booking: manager books for a farmer by phone, only at their own centre', async () => {
  const manager = await t.login('manager.karnataka@agriloop.demo');
  const managerPb = await t.login('manager.punjab@agriloop.demo');
  const farmer = await t.login('farmer49@agriloop.demo');
  await t.api('PATCH', '/auth/me', farmer, { phone: '9811111111' }); // seeded queue farmers have no phone
  const day = new Date(Date.now() + 5 * 86400000).toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' }); // a day the seed leaves empty
  const centers = (await t.api('GET', '/procurement-centers', farmer)).data;
  const mandya = centers.find((c) => c.code === 'M01');
  const tomato = mandya.crops.find((c) => c.name === 'Tomato');
  const slot = (await t.api('GET', `/procurement-centers/${mandya.id}/slots?date=${day}`, farmer)).data.slots.find((s) => s.available);
  const body = { phone: '9811111111', slotId: slot.id, cropId: tomato.id, estimatedQuantity: 300 };

  assert.equal((await t.api('POST', '/manager/assisted-booking', managerPb, body)).status, 403, 'other region');
  assert.equal((await t.api('POST', '/manager/assisted-booking', farmer, body)).status, 403, 'farmers cannot');
  assert.equal((await t.api('POST', '/manager/assisted-booking', manager, { ...body, phone: '9000000000' })).status, 404);

  const ok = await t.api('POST', '/manager/assisted-booking', manager, body);
  assert.equal(ok.status, 201, JSON.stringify(ok.data));
  assert.match(ok.data.token, /^M01-/);
  // It belongs to the farmer, who is told it was booked for them
  const mine = (await t.api('GET', '/procurement/bookings', farmer)).data;
  assert.ok(mine.some((b) => b.id === ok.data.id));
  const notes = (await t.api('GET', '/notifications', farmer)).data;
  assert.ok(JSON.stringify(notes).includes('Booked for you by the centre'));
  // same day twice is still refused
  assert.equal((await t.api('POST', '/manager/assisted-booking', manager, body)).status, 409);
});
