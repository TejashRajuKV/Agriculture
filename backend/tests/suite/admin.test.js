import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startTestApp } from './helpers.js';

let t;
let admin;
let ravi;
let manager;
before(async () => {
  t = await startTestApp();
  admin = await t.login('admin@agriloop.demo');
  ravi = await t.login('ravi@agriloop.demo');
  manager = await t.login('manager.karnataka@agriloop.demo');
});
after(async () => { await t.stop(); });

test('every admin endpoint is closed to everyone else', async () => {
  for (const path of ['/admin/overview', '/admin/attention', '/admin/centres', '/admin/fpos', '/admin/users', '/admin/audit']) {
    assert.equal((await t.api('GET', path, ravi)).status, 403, path);
    assert.equal((await t.api('GET', path, manager)).status, 403, path);
    assert.equal((await t.api('GET', path, null)).status, 401, path);
  }
  assert.equal((await t.api('POST', '/admin/staff', ravi, { name: 'x', email: 'x@y.z', phone: '9999999999', role: 'ADMIN' })).status, 403);
});

test('overview: real counts, 30-day series with no gaps', async () => {
  const { status, data } = await t.api('GET', '/admin/overview', admin);
  assert.equal(status, 200);
  assert.ok(data.users.total >= 60);
  assert.equal(data.users.byRole.PROCUREMENT_MANAGER, 2);
  assert.equal(data.charts.procuredKg.length, 30);
  assert.equal(data.charts.orders.length, 30);
  assert.ok(data.charts.bookings.every((d) => /^\d{4}-\d{2}-\d{2}$/.test(d.date)));
  assert.ok(data.payments.paid.count > 0 && data.payments.failed.count >= 1);
  assert.equal(data.marketplace.ordersByStatus.READY_FOR_PICKUP, 4);
  assert.equal(data.marketplace.openPools, 2);
  assert.equal(data.logistics.trips.PLANNED, undefined);
  assert.equal(data.fleet.vehicles.AVAILABLE, 3);
});

test('attention list flags the failed payment and is ordered by severity', async () => {
  const items = (await t.api('GET', '/admin/attention', admin)).data;
  assert.ok(items.some((i) => i.kind === 'PAYMENT_FAILED'));
  const rank = { HIGH: 0, MEDIUM: 1, LOW: 2 };
  assert.deepEqual(items.map((i) => rank[i.severity]), [...items.map((i) => rank[i.severity])].sort());
});

test('centres: capacity, queue, unpaid money and managers per centre', async () => {
  const list = (await t.api('GET', '/admin/centres', admin)).data;
  assert.equal(list.length, 3);
  const mandya = list.find((c) => c.code === 'M01');
  assert.equal(mandya.today.waiting, 7);
  assert.ok(mandya.avgProcessingMinutes > 0);
  assert.equal(mandya.managers.length, 1);
  assert.ok(mandya.utilizationPercent14 >= 0);
  assert.equal((await t.api('GET', '/admin/fpos', admin)).data.length, 2);
});

test('users: search, filter, suspend needs a reason, suspension really locks the account, restore works, audit records it', async () => {
  const found = (await t.api('GET', '/admin/users?search=gurmeet', admin)).data;
  assert.equal(found.total, 1);
  const u = found.users[0];
  assert.equal((await t.api('GET', '/admin/users?role=NOPE', admin)).status, 400);

  assert.equal((await t.api('POST', `/admin/users/${u.id}/suspend`, admin, { suspended: true })).status, 400, 'reason required');
  const target = await t.login('gurmeet@agriloop.demo');
  assert.equal((await t.api('GET', '/auth/me', target)).status, 200);

  assert.equal((await t.api('POST', `/admin/users/${u.id}/suspend`, admin, { suspended: true, reason: 'Duplicate account' })).status, 200);
  assert.equal((await t.api('GET', '/auth/me', target)).status, 403, 'existing token stops working');
  const login = await t.api('POST', '/auth/login', null, { email: 'gurmeet@agriloop.demo', password: 'AgriLoop@2026' });
  assert.equal(login.status, 403);
  assert.match(login.data.error, /suspended/);
  assert.equal((await t.api('GET', '/admin/users?suspended=true', admin)).data.total, 1);

  assert.equal((await t.api('POST', `/admin/users/${u.id}/suspend`, admin, { suspended: false })).status, 200);
  assert.equal((await t.api('GET', '/auth/me', target)).status, 200);

  const log = (await t.api('GET', '/admin/audit', admin)).data;
  assert.deepEqual(log.slice(0, 2).map((r) => r.action), ['USER_RESTORED', 'USER_SUSPENDED']);
  assert.equal(log[1].details.reason, 'Duplicate account');
});

test('admins protect themselves and each other', async () => {
  const me = (await t.api('GET', '/auth/me', admin)).data.user;
  assert.equal((await t.api('POST', `/admin/users/${me.id}/suspend`, admin, { suspended: true, reason: 'x' })).status, 403);
  assert.equal((await t.api('POST', '/admin/users/not-an-id/suspend', admin, { suspended: true, reason: 'x' })).status, 400);
});

test('staff accounts: created by admin with a one-time password, validated, usable, audited', async () => {
  const body = { name: 'New Manager', email: 'new.manager@agriloop.demo', phone: '9822222222', role: 'PROCUREMENT_MANAGER' };
  assert.equal((await t.api('POST', '/admin/staff', admin, { ...body, role: 'FARMER' })).status, 400, 'only staff roles');
  const ok = await t.api('POST', '/admin/staff', admin, body);
  assert.equal(ok.status, 201);
  assert.ok(ok.data.temporaryPassword.length >= 10);
  assert.equal((await t.api('POST', '/admin/staff', admin, body)).status, 409);
  const login = await t.api('POST', '/auth/login', null, { email: body.email, password: ok.data.temporaryPassword });
  assert.equal(login.status, 200);
  assert.ok(!JSON.stringify((await t.api('GET', '/admin/users?search=new.manager', admin)).data).includes(ok.data.temporaryPassword), 'never listed again');
  assert.equal((await t.api('GET', '/admin/audit', admin)).data[0].action, 'STAFF_CREATED');

  // a new manager has no centres until the admin assigns one; then they can run that centre
  const mgr = login.data.token;
  assert.equal((await t.api('GET', '/manager/overview', mgr)).status, 400);
  const centres = (await t.api('GET', '/admin/centres', admin)).data;
  const m02 = centres.find((c) => c.code === 'M02');
  assert.equal((await t.api('PUT', `/admin/users/${ok.data.user.id}/centres`, admin, { centerIds: [m02.id, m02.id] })).status, 400, 'duplicates refused');
  assert.equal((await t.api('PUT', `/admin/users/${ok.data.user.id}/centres`, admin, { centerIds: ['64b000000000000000000000'] })).status, 404);
  assert.equal((await t.api('PUT', `/admin/users/${ok.data.user.id}/centres`, admin, { centerIds: [m02.id] })).status, 200);
  assert.equal((await t.api('GET', '/manager/overview', mgr)).status, 200);
  assert.equal((await t.api('PUT', `/admin/users/${(await t.api('GET', '/auth/me', ravi)).data.user.id}/centres`, admin, { centerIds: [m02.id] })).status, 400, 'farmers are not assigned centres');
});
