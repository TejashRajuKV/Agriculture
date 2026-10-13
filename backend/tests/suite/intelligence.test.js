import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startTestApp } from './helpers.js';
import { loadDemandModel, predictOne } from '../../services/intelligenceService.js';
import IntakeHistory from '../../models/IntakeHistory.js';

let t;
let ravi;
let manager;
let hotel;
let mandya;
let tomato;
before(async () => {
  t = await startTestApp();
  ravi = await t.login('ravi@agriloop.demo');
  manager = await t.login('manager.karnataka@agriloop.demo');
  hotel = await t.login('buyer.hotel@agriloop.demo');
  const centers = (await t.api('GET', '/procurement-centers', ravi)).data;
  mandya = centers.find((c) => c.code === 'M01');
  tomato = mandya.crops.find((c) => c.name === 'Tomato');
});
after(async () => { await t.stop(); });

test('server prediction matches the Python training code on its saved fixtures', () => {
  const model = loadDemandModel();
  assert.ok(model, 'ml/models/demand.json exists (run ml/demand_forecasting/train.py)');
  assert.ok(model.fixtures.length >= 6);
  for (const f of model.fixtures) {
    const got = predictOne(model, f.hist, f.origin, f.h);
    assert.ok(Math.abs(got - f.expected_kg) < 0.01, `h=${f.h}: ${got} vs ${f.expected_kg}`);
  }
});

test('model file reports honest accuracy against simple baselines and its data', () => {
  const m = loadDemandModel();
  assert.ok(m.metrics.model.mae_kg > 0);
  assert.ok(m.metrics.seasonal_naive && m.metrics.flat_28_day_mean);
  assert.equal(typeof m.metrics.modelBeatsBaseline, 'boolean');
  assert.ok(m.data.note.includes('simulated'));
});

test('demand forecast: 7 days with ranges, and it says the history is simulated', async () => {
  const { status, data } = await t.api('GET', `/intelligence/demand?centerId=${mandya.id}&cropId=${tomato.id}`, manager);
  assert.equal(status, 200);
  assert.equal(data.available, true);
  assert.equal(data.days.length, 7);
  for (const d of data.days) assert.ok(d.lowKg <= d.expectedKg && d.expectedKg <= d.highKg, JSON.stringify(d));
  assert.ok(data.dataBasis.simulatedDays > 0);
  assert.match(data.dataBasis.warning, /simulated/);
  assert.ok(data.accuracy.modelErrorPercent > 0);
  assert.equal((await t.api('GET', `/intelligence/demand?centerId=${mandya.id}&cropId=${tomato.id}`, hotel)).status, 403);
  assert.equal((await t.api('GET', '/intelligence/demand?centerId=bad&cropId=bad', manager)).status, 400);
});

test('real intake replaces a simulated day and shows up in the data basis', async () => {
  const yesterday = new Date(Date.now() - 86400000).toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
  const row = await IntakeHistory.findOne({ center: mandya.id, crop: tomato.id, date: yesterday });
  assert.equal(row.simulated, true);
  const { recordRealIntake } = await import('../../models/IntakeHistory.js');
  await recordRealIntake(row.center, row.crop, yesterday, 1234);
  const after = await IntakeHistory.findOne({ _id: row._id });
  assert.equal(after.simulated, false);
  assert.equal(after.kg, 1234);
  await recordRealIntake(row.center, row.crop, yesterday, 66); // a second lot the same day adds up
  assert.equal((await IntakeHistory.findOne({ _id: row._id })).kg, 1300);
  const f = (await t.api('GET', `/intelligence/demand?centerId=${mandya.id}&cropId=${tomato.id}`, manager)).data;
  assert.ok(f.dataBasis.realDays >= 1);
});

test('a series with too little history is refused instead of guessed', async () => {
  const centers = (await t.api('GET', '/procurement-centers', ravi)).data;
  const sangrur = centers.find((c) => c.code === 'S01');
  const wheat = sangrur.crops.find((c) => c.name === 'Wheat');
  await IntakeHistory.deleteMany({ center: sangrur.id, crop: wheat.id });
  const { data } = await t.api('GET', `/intelligence/demand?centerId=${sangrur.id}&cropId=${wheat.id}`, manager);
  assert.equal(data.available, false);
  assert.match(data.reason, /Not enough history/);
});

test('price guidance is a labelled formula built from market price, MSP and grade', async () => {
  const wheat = (await t.api('GET', '/crops', ravi)).data.find((c) => c.name === 'Wheat');
  const a = (await t.api('GET', `/intelligence/price-guidance?cropId=${wheat.id}&grade=A`, ravi)).data;
  const c = (await t.api('GET', `/intelligence/price-guidance?cropId=${wheat.id}&grade=C`, ravi)).data;
  assert.equal(a.available, true);
  assert.equal(a.method, 'formula');
  assert.match(a.notML, /not a machine-learning/);
  assert.ok(a.lowPerKg < a.suggestedPerKg && a.suggestedPerKg < a.highPerKg);
  assert.ok(c.suggestedPerKg < a.suggestedPerKg, 'lower grade, lower price');
  assert.ok(a.basis.some((b) => b.label.includes('MSP')));
  assert.ok(a.basis[0].asOf, 'says how old the market price is');
  assert.equal((await t.api('GET', `/intelligence/price-guidance?cropId=${wheat.id}`, hotel)).status, 403);
});
