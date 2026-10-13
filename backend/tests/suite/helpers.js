// Shared test harness: fresh seeded "agriloop_test" database + the real app on a random port.
import mongoose from 'mongoose';

process.env.NODE_ENV = 'test';
process.env.AUTH_SECRET = process.env.TEST_AUTH_SECRET || 'test-secret-that-is-at-least-32-characters-long';
process.env.DISABLE_GEOCODING = '1';
const TEST_URI = process.env.TEST_MONGODB_URI || 'mongodb://127.0.0.1:27017/agriloop_test';

export const PASSWORD = 'AgriLoop@2026';

export const startTestApp = async () => {
  // Imported after env is set so services read the test configuration
  const { createApp } = await import('../../app.js');
  const { seed } = await import('../../scripts/seedAgriLoop.js');
  await mongoose.connect(TEST_URI);
  await seed({ log: () => {} });
  const server = createApp().listen(0);
  await new Promise((r) => server.once('listening', r));
  const base = `http://127.0.0.1:${server.address().port}/api`;

  const api = async (method, path, token, body) => {
    const res = await fetch(base + path, {
      method,
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: body === undefined ? undefined : JSON.stringify(body)
    });
    const data = await res.json().catch(() => ({}));
    return { status: res.status, data };
  };
  const login = async (email) => {
    const { status, data } = await api('POST', '/auth/login', null, { email, password: PASSWORD });
    if (status !== 200) throw new Error(`login ${email} failed: ${status} ${JSON.stringify(data)}`);
    return data.token;
  };
  const stop = async () => {
    await new Promise((r) => server.close(r));
    await mongoose.disconnect();
  };
  return { api, login, stop, base };
};

export const tomorrow = () => {
  const d = new Date(new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' }) + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
};
