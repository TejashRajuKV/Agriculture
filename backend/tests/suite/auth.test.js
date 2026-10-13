import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startTestApp, PASSWORD } from './helpers.js';

let t;
before(async () => { t = await startTestApp(); });
after(async () => { await t.stop(); });

test('farmer, manager and buyer can log in and get their role from the server', async () => {
  for (const [email, role] of [
    ['ravi@agriloop.demo', 'FARMER'],
    ['manager.karnataka@agriloop.demo', 'PROCUREMENT_MANAGER'],
    ['buyer.hotel@agriloop.demo', 'BUYER']
  ]) {
    const { status, data } = await t.api('POST', '/auth/login', null, { email, password: PASSWORD });
    assert.equal(status, 200);
    assert.equal(data.user.role, role);
    assert.ok(data.token);
    assert.equal(data.user.passwordHash, undefined, 'password hash must never be returned');
  }
});

test('wrong password and unknown email get the same 401', async () => {
  const a = await t.api('POST', '/auth/login', null, { email: 'ravi@agriloop.demo', password: 'nope-nope' });
  const b = await t.api('POST', '/auth/login', null, { email: 'nobody@agriloop.demo', password: 'nope-nope' });
  assert.equal(a.status, 401);
  assert.equal(b.status, 401);
  assert.equal(a.data.error, b.data.error);
});

test('registration validates input and never allows staff roles', async () => {
  const bad = await t.api('POST', '/auth/register', null, { name: 'X', email: 'bad', password: '1', role: 'FARMER' });
  assert.equal(bad.status, 400);
  const staff = await t.api('POST', '/auth/register', null, { name: 'Sneaky', email: 'sneaky@x.in', password: 'longenough1', role: 'ADMIN' });
  assert.equal(staff.status, 400);
  const ok = await t.api('POST', '/auth/register', null, { name: 'New Farmer', email: 'new.farmer@x.in', password: 'longenough1', role: 'FARMER', location: 'Mandya, Karnataka' });
  assert.equal(ok.status, 201);
  assert.match(ok.data.user.farmerCode, /^FR-\d{5}$/);
  const dup = await t.api('POST', '/auth/register', null, { name: 'Again', email: 'new.farmer@x.in', password: 'longenough1', role: 'FARMER' });
  assert.equal(dup.status, 409);
});

test('protected routes reject missing and forged tokens', async () => {
  assert.equal((await t.api('GET', '/auth/me')).status, 401);
  const token = await t.login('ravi@agriloop.demo');
  const [payload, sig] = token.split('.');
  const forged = Buffer.from(JSON.stringify({ sub: '000000000000000000000000', exp: 9999999999 })).toString('base64url') + '.' + sig;
  assert.equal((await t.api('GET', '/auth/me', forged)).status, 401);
  assert.equal((await t.api('GET', '/auth/me', `${payload}.${sig}x`)).status, 401);
  assert.equal((await t.api('GET', '/auth/me', token)).status, 200);
});

test('repeated wrong passwords are throttled, and a correct login clears the count', async () => {
  const { resetAllThrottles } = await import('../../utils/throttle.js');
  resetAllThrottles();
  const body = (password) => ({ email: 'lakshmi@agriloop.demo', password });
  for (let i = 0; i < 8; i++) assert.equal((await t.api('POST', '/auth/login', null, body('wrong-password'))).status, 401);
  const blocked = await t.api('POST', '/auth/login', null, body('AgriLoop@2026'));
  assert.equal(blocked.status, 429, 'even the right password waits');
  assert.match(blocked.data.error, /Too many/);
  // a different email is not affected
  assert.equal((await t.api('POST', '/auth/login', null, { email: 'ravi@agriloop.demo', password: 'AgriLoop@2026' })).status, 200);
  resetAllThrottles();
  assert.equal((await t.api('POST', '/auth/login', null, body('AgriLoop@2026'))).status, 200);
});

test('responses carry basic security headers', async () => {
  const res = await fetch(`${t.base}/health`);
  assert.equal(res.headers.get('x-content-type-options'), 'nosniff');
  assert.equal(res.headers.get('x-frame-options'), 'DENY');
});
