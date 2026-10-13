import Counter from '../models/Counter.js';

// Atomic, gap-free-per-key sequence (single-document $inc works on a standalone MongoDB).
export const nextSequence = async (key) => {
  const doc = await Counter.findOneAndUpdate({ _id: key }, { $inc: { seq: 1 } }, { upsert: true, new: true });
  return doc.seq;
};

// PR-2026-00001, OD-2026-00001 ...
export const nextDocumentNumber = async (prefix, year = new Date().getFullYear()) => {
  const seq = await nextSequence(`${prefix}-${year}`);
  return `${prefix}-${year}-${String(seq).padStart(5, '0')}`;
};

// Token per centre per day: M01-0928-047
export const nextToken = async (centerCode, isoDate) => {
  const seq = await nextSequence(`token:${centerCode}:${isoDate}`);
  const mmdd = isoDate.slice(5, 7) + isoDate.slice(8, 10);
  return { seq, token: `${centerCode}-${mmdd}-${String(seq).padStart(3, '0')}` };
};
