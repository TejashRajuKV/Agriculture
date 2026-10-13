// Procurement runs on Indian time. Dates are stored as 'YYYY-MM-DD' strings and
// times as 'HH:MM' so slot maths never depends on the server's timezone.

const TZ = 'Asia/Kolkata';

export const todayIST = (now = new Date()) => now.toLocaleDateString('en-CA', { timeZone: TZ });

export const nowMinutesIST = (now = new Date()) => {
  const [h, m] = now.toLocaleTimeString('en-GB', { timeZone: TZ, hour12: false }).split(':').map(Number);
  return h * 60 + m;
};

export const toMinutes = (hhmm) => {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
};

export const fromMinutes = (mins) =>
  `${String(Math.floor(mins / 60)).padStart(2, '0')}:${String(mins % 60).padStart(2, '0')}`;

export const addDays = (isoDate, days) => {
  const d = new Date(`${isoDate}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
};

export const daysBetween = (fromIso, toIso) =>
  Math.round((new Date(`${toIso}T00:00:00Z`) - new Date(`${fromIso}T00:00:00Z`)) / 86400000);
