import { test, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { startTestApp } from './helpers.js';
import { clearMandiCache } from '../../services/mandiService.js';

let t;
let ravi;
const realFetch = globalThis.fetch;
before(async () => {
  t = await startTestApp();
  ravi = await t.login('ravi@agriloop.demo');
});
after(async () => {
  globalThis.fetch = realFetch;
  delete process.env.DATA_GOV_API_KEY;
  await t.stop();
});
beforeEach(() => clearMandiCache());

// Only the data.gov.in call is faked; the test's own requests to the app still go through
const fakeUpstream = (handler) => {
  globalThis.fetch = (url, opts) => (String(url).includes('api.data.gov.in') ? handler(String(url)) : realFetch(url, opts));
};
const json = (body, status = 200) => Promise.resolve(new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } }));

test('without a key the API says live prices are off instead of inventing numbers', async () => {
  delete process.env.DATA_GOV_API_KEY;
  const status = await t.api('GET', '/mandi/status', ravi);
  assert.equal(status.data.configured, false);
  const { data } = await t.api('GET', '/mandi/prices?commodity=Tomato&state=Karnataka', ravi);
  assert.equal(data.live, false);
  assert.equal(data.reason, 'NO_KEY');
  assert.deepEqual(data.records, []);
});

test('with a key it returns only the latest day, normalised, and caches', async () => {
  process.env.DATA_GOV_API_KEY = 'test-key';
  let calls = 0;
  let seenUrl = '';
  fakeUpstream((url) => {
    calls += 1;
    seenUrl = url;
    return json({
      records: [
        { state: 'Karnataka', district: 'Mandya', market: 'Mandya', commodity: 'Tomato', variety: 'Local', arrival_date: '12/10/2026', min_price: '1800', max_price: '2600', modal_price: '2200' },
        { state: 'Karnataka', district: 'Mysuru', market: 'Mysore', commodity: 'Tomato', variety: 'Local', arrival_date: '12/10/2026', min_price: '1700', max_price: '2500', modal_price: '2100' },
        { state: 'Karnataka', district: 'Mandya', market: 'Mandya', commodity: 'Tomato', variety: 'Local', arrival_date: '09/10/2026', min_price: '900', max_price: '1000', modal_price: '950' },
        { state: 'Karnataka', district: 'Mandya', market: 'Bad', commodity: 'Tomato', arrival_date: '12/10/2026', modal_price: 'NA' }
      ]
    });
  });
  const first = await t.api('GET', '/mandi/prices?commodity=Tomato&state=Karnataka', ravi);
  assert.equal(first.data.live, true);
  assert.equal(first.data.latestDate, '2026-10-12');
  assert.equal(first.data.records.length, 2, 'older day and unparseable rows are dropped');
  assert.equal(first.data.records[0].modalPerQuintal, 2200);
  assert.match(seenUrl, /filters%5Bcommodity%5D=Tomato/);
  assert.ok(!JSON.stringify(first.data).includes('test-key'), 'the key is never sent to the browser');

  const second = await t.api('GET', '/mandi/prices?commodity=Tomato&state=Karnataka', ravi);
  assert.equal(second.data.cached, true);
  assert.equal(calls, 1);
});

test('upstream failures and odd responses degrade to unavailable', async () => {
  process.env.DATA_GOV_API_KEY = 'test-key';
  fakeUpstream(() => json({ message: 'rate limited' }, 429));
  assert.equal((await t.api('GET', '/mandi/prices?commodity=Onion', ravi)).data.reason, 'HTTP_429');
  fakeUpstream(() => json({ unexpected: true }));
  assert.equal((await t.api('GET', '/mandi/prices?commodity=Onion', ravi)).data.reason, 'UNEXPECTED_RESPONSE');
  fakeUpstream(() => Promise.reject(new Error('offline')));
  assert.equal((await t.api('GET', '/mandi/prices?commodity=Onion', ravi)).data.reason, 'NETWORK');
  assert.equal((await t.api('GET', '/mandi/prices', ravi)).status, 400, 'a crop is required');
});
