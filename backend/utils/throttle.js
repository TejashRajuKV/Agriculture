// Remembers failed attempts per key (in this server's memory) so passwords cannot be guessed endlessly.
// One server process only; with several servers behind a balancer, move this to a shared store.
const WINDOW_MS = 15 * 60 * 1000;
const MAX_FAILURES = 8;
const failures = new Map(); // key -> [timestamps]

const recent = (key, now = Date.now()) => {
  const list = (failures.get(key) || []).filter((t) => now - t < WINDOW_MS);
  if (list.length) failures.set(key, list);
  else failures.delete(key);
  return list;
};

export const isBlocked = (key) => recent(key).length >= MAX_FAILURES;
export const retryAfterSeconds = (key) => {
  const list = recent(key);
  return list.length ? Math.max(1, Math.ceil((WINDOW_MS - (Date.now() - list[0])) / 1000)) : 0;
};
export const recordFailure = (key) => failures.set(key, [...recent(key), Date.now()]);
export const clearFailures = (key) => failures.delete(key);
export const resetAllThrottles = () => failures.clear();
