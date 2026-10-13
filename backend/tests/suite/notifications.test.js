import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startTestApp, tomorrow } from './helpers.js';
import { MockSmsAdapter } from '../../services/notifications/adapters.js';

let t;
before(async () => { t = await startTestApp(); });
after(async () => { await t.stop(); });

test('booking and queue events create stored notifications the user can read', async () => {
  const lakshmi = await t.login('lakshmi@agriloop.demo');
  const centers = (await t.api('GET', '/procurement-centers', lakshmi)).data;
  const m02 = centers.find((c) => c.code === 'M02');
  const slot = (await t.api('GET', `/procurement-centers/${m02.id}/slots?date=${tomorrow()}`, lakshmi)).data.slots.find((s) => s.available);
  const onion = m02.crops.find((c) => c.name === 'Onion');
  const booking = await t.api('POST', '/procurement/bookings', lakshmi, { slotId: slot.id, cropId: onion.id, estimatedQuantity: 300 });
  assert.equal(booking.status, 201);

  // notifications are written asynchronously right after the action
  await new Promise((r) => setTimeout(r, 200));
  const list = (await t.api('GET', '/notifications', lakshmi)).data;
  const n = list.items.find((i) => i.title.includes(booking.data.token));
  assert.ok(n, 'booking notification stored');
  assert.equal(n.isRead, false);
  assert.ok(list.unread >= 1);

  assert.equal((await t.api('PATCH', `/notifications/${n.id}/read`, lakshmi)).status, 200);
  const suresh = await t.login('suresh@agriloop.demo');
  assert.equal((await t.api('PATCH', `/notifications/${n.id}/read`, suresh)).status, 404, "can't touch someone else's notification");
  await t.api('PATCH', '/notifications/read-all', lakshmi);
  assert.equal((await t.api('GET', '/notifications', lakshmi)).data.unread, 0);
});

test('calling a farmer notifies them', async () => {
  const manager = await t.login('manager.karnataka@agriloop.demo');
  const ov = (await t.api('GET', '/manager/overview', manager)).data;
  const next = ov.queue.next[0];
  await t.api('POST', `/manager/queue/${next.bookingId}/call`, manager);
  await new Promise((r) => setTimeout(r, 200));
  const farmer = await t.login('farmer40@agriloop.demo');
  const items = (await t.api('GET', '/notifications', farmer)).data.items;
  assert.ok(items.some((i) => i.type === 'QUEUE_UPDATE' && i.title.includes(next.token)));
});

test('mock SMS adapter logs instead of sending and needs no API key', async () => {
  const lines = [];
  const sms = new MockSmsAdapter({ log: (l) => lines.push(l) });
  await sms.send({ phone: '9800000001', title: 'Hello', message: 'Test' });
  assert.equal(await sms.send({ title: 'no phone', message: 'x' }), null);
  assert.equal(lines.length, 1);
  assert.match(lines[0], /9800000001/);
});
