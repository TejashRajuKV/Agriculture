import SchemeReminder from '../models/SchemeReminder.js';
import { SCHEMES, appliesIn } from './schemeCatalog.js';
import { badRequest, conflict, notFound } from '../utils/httpError.js';
import * as v from '../utils/validate.js';
import { todayIST, addDays } from '../utils/dates.js';
import { notify } from './notificationService.js';

const MAX_ACTIVE = 10;
const stateOf = (user) => String(user.location?.label || '').split(',').map((s) => s.trim()).filter(Boolean).at(-1) || '';

// Next occurrence of a month/day from today, as YYYY-MM-DD
const nextOccurrence = (month, day, today = todayIST()) => {
  const year = Number(today.slice(0, 4));
  const pad = (n) => String(n).padStart(2, '0');
  const thisYear = `${year}-${pad(month)}-${pad(day)}`;
  return thisYear >= today ? thisYear : `${year + 1}-${pad(month)}-${pad(day)}`;
};

export const listSchemes = async (user) => {
  const state = stateOf(user);
  const mine = await SchemeReminder.find({ user: user._id, sentAt: null }).sort({ remindOn: 1 });
  return SCHEMES.map((s) => ({
    id: s.id,
    name: s.name,
    summary: s.summary,
    needs: s.needs,
    link: s.link,
    tip: s.tip,
    applies: appliesIn(s, state),
    notAvailableNote: appliesIn(s, state) ? null : `${state} does not take part in this scheme.`,
    // Typical dates are only suggestions for the reminder form
    suggestedDates: s.windows.map((w) => ({ label: w.label, date: nextOccurrence(w.month, w.day) })),
    reminders: mine.filter((r) => r.schemeId === s.id).map((r) => ({ id: String(r._id), remindOn: r.remindOn, note: r.note }))
  }));
};

export const addReminder = async (user, body = {}) => {
  const scheme = SCHEMES.find((s) => s.id === body.schemeId);
  if (!scheme) throw notFound('Scheme not found');
  const remindOn = v.isoDate(body.remindOn, 'Reminder date');
  const today = todayIST();
  if (remindOn < today) throw badRequest('Pick today or a later date');
  if (remindOn > addDays(today, 400)) throw badRequest('Pick a date within the next year');
  const note = v.optionalString(body.note, 'Note', { max: 140 });
  if ((await SchemeReminder.countDocuments({ user: user._id, sentAt: null })) >= MAX_ACTIVE) {
    throw conflict(`You can keep up to ${MAX_ACTIVE} reminders at a time. Delete one first.`);
  }
  const r = await SchemeReminder.create({ user: user._id, schemeId: scheme.id, remindOn, note });
  return { id: String(r._id), schemeId: r.schemeId, remindOn: r.remindOn, note: r.note };
};

export const deleteReminder = async (user, id) => {
  const res = await SchemeReminder.deleteOne({ _id: v.objectId(id, 'reminder id'), user: user._id, sentAt: null });
  if (!res.deletedCount) throw notFound('Reminder not found');
  return { deleted: true };
};

// Run by the server on a timer. Each reminder is claimed atomically so it is sent once, even with two servers.
export const deliverDueReminders = async (today = todayIST()) => {
  const due = await SchemeReminder.find({ sentAt: null, remindOn: { $lte: today } }).limit(500);
  let sent = 0;
  for (const r of due) {
    const claimed = await SchemeReminder.findOneAndUpdate({ _id: r._id, sentAt: null }, { $set: { sentAt: new Date() } });
    if (!claimed) continue;
    const scheme = SCHEMES.find((s) => s.id === r.schemeId);
    await notify({
      userId: r.user,
      type: 'SYSTEM',
      title: `Reminder · ${scheme?.name || 'Scheme'}`,
      message: `${r.note ? `${r.note}. ` : ''}${scheme?.tip || ''}${scheme?.link ? ` ${scheme.link}` : ''}`.trim(),
      referenceType: 'scheme',
      referenceId: r._id
    });
    sent += 1;
  }
  return { sent };
};
