import { distanceKm } from '../utils/geo.js';

// Route planning for one vehicle carrying several orders. Pure functions: no database, no network,
// the same input always gives the same route, so it is easy to test and explain.
//
// Every order has a pickup stop (at the seller) and a drop stop (at the buyer). A route is valid when
//   1. each pickup comes before its own drop, and
//   2. the load on board never goes above the vehicle's capacity.
// Method: build a route by always driving to the nearest stop that is still allowed, then try to
// shorten it by reversing sections (2-opt) and moving single stops (or-opt) while it stays valid.
// With at most a handful of orders this is fast and near-optimal, but it is a heuristic, not a proof of
// the shortest route. Distances are straight-line distances times a road factor, so they are estimates.

export const ROAD_FACTOR = 1.3;
export const AVG_SPEED_KMH = 35;
export const STOP_MINUTES = 15; // loading or unloading
export const MAX_ORDERS = 6;

const leg = (a, b) => {
  const d = distanceKm(a, b);
  return d == null ? Infinity : d * ROAD_FACTOR;
};

// stops: [{ orderId, type: 'PICKUP'|'DROP', lat, lng, kg }]
export const isValidSequence = (seq, capacityKg) => {
  const picked = new Set();
  let load = 0;
  for (const s of seq) {
    if (s.type === 'PICKUP') {
      load += s.kg;
      if (load > capacityKg + 1e-9) return false;
      picked.add(s.orderId);
    } else {
      if (!picked.has(s.orderId)) return false;
      load -= s.kg;
    }
  }
  return true;
};

export const routeLength = (start, seq, { returnToStart = false } = {}) => {
  let total = 0;
  let at = start;
  for (const s of seq) {
    total += leg(at, s);
    at = s;
  }
  if (returnToStart) total += leg(at, start);
  return total;
};

const toStops = (orders) =>
  orders.flatMap((o) => [
    { orderId: o.id, type: 'PICKUP', lat: o.pickup.lat, lng: o.pickup.lng, kg: o.kg, label: o.pickup.label },
    { orderId: o.id, type: 'DROP', lat: o.drop.lat, lng: o.drop.lng, kg: o.kg, label: o.drop.label }
  ]);

// The order a dispatcher would get by doing each order one after another: the "before" for savings
export const naiveSequence = (orders) => toStops(orders);

const nearestFirst = (start, stops, capacityKg) => {
  const remaining = [...stops];
  const seq = [];
  const picked = new Set();
  let load = 0;
  let at = start;
  while (remaining.length) {
    let best = -1;
    let bestD = Infinity;
    remaining.forEach((s, i) => {
      const allowed = s.type === 'PICKUP' ? load + s.kg <= capacityKg + 1e-9 : picked.has(s.orderId);
      if (!allowed) return;
      const d = leg(at, s);
      // Tie-break on original position so the result never depends on iteration quirks
      if (d < bestD - 1e-9) {
        best = i;
        bestD = d;
      }
    });
    if (best === -1) return null; // cannot happen when every order fits the vehicle on its own
    const [s] = remaining.splice(best, 1);
    seq.push(s);
    at = s;
    if (s.type === 'PICKUP') {
      load += s.kg;
      picked.add(s.orderId);
    } else load -= s.kg;
  }
  return seq;
};

const improve = (start, seq, capacityKg) => {
  let best = seq;
  let bestLen = routeLength(start, best);
  let improved = true;
  let rounds = 0;
  while (improved && rounds < 50) {
    improved = false;
    rounds += 1;
    // 2-opt: reverse a section
    for (let i = 0; i < best.length - 1; i++) {
      for (let j = i + 1; j < best.length; j++) {
        const cand = [...best.slice(0, i), ...best.slice(i, j + 1).reverse(), ...best.slice(j + 1)];
        if (!isValidSequence(cand, capacityKg)) continue;
        const len = routeLength(start, cand);
        if (len < bestLen - 1e-9) {
          best = cand;
          bestLen = len;
          improved = true;
        }
      }
    }
    // or-opt: move one stop somewhere else
    for (let i = 0; i < best.length; i++) {
      for (let j = 0; j < best.length; j++) {
        if (i === j) continue;
        const without = best.filter((_, k) => k !== i);
        const cand = [...without.slice(0, j), best[i], ...without.slice(j)];
        if (!isValidSequence(cand, capacityKg)) continue;
        const len = routeLength(start, cand);
        if (len < bestLen - 1e-9) {
          best = cand;
          bestLen = len;
          improved = true;
        }
      }
    }
  }
  return best;
};

// start: { lat, lng }, orders: [{ id, kg, pickup:{lat,lng,label}, drop:{lat,lng,label} }]
export const planRoute = ({ start, orders, capacityKg }) => {
  if (!orders.length) return { ok: false, reason: 'NO_ORDERS' };
  if (orders.length > MAX_ORDERS) return { ok: false, reason: 'TOO_MANY_ORDERS' };
  const tooBig = orders.find((o) => o.kg > capacityKg);
  if (tooBig) return { ok: false, reason: 'ORDER_EXCEEDS_CAPACITY', orderId: tooBig.id };
  const missing = orders.find((o) => [o.pickup, o.drop].some((p) => p?.lat == null || p?.lng == null));
  if (missing) return { ok: false, reason: 'MISSING_COORDINATES', orderId: missing.id };

  const stops = toStops(orders);
  const first = nearestFirst(start, stops, capacityKg);
  if (!first) return { ok: false, reason: 'NO_VALID_ROUTE' };
  const seq = improve(start, first, capacityKg);

  const naive = naiveSequence(orders);
  const naiveFeasible = isValidSequence(naive, capacityKg); // one-by-one is always valid when each order fits
  const totalKm = routeLength(start, seq);
  const naiveKm = naiveFeasible ? routeLength(start, naive) : null;

  let at = start;
  let minutes = 0;
  let load = 0;
  let peak = 0;
  const out = seq.map((s, i) => {
    const km = leg(at, s);
    minutes += (km / AVG_SPEED_KMH) * 60;
    const etaMinutes = Math.round(minutes);
    minutes += STOP_MINUTES;
    load += s.type === 'PICKUP' ? s.kg : -s.kg;
    peak = Math.max(peak, load);
    at = s;
    return { sequence: i + 1, orderId: s.orderId, type: s.type, label: s.label, lat: s.lat, lng: s.lng, kg: s.kg, legKm: Math.round(km * 10) / 10, etaMinutes, loadAfterKg: Math.round(load * 10) / 10 };
  });

  return {
    ok: true,
    stops: out,
    totalKm: Math.round(totalKm * 10) / 10,
    naiveKm: naiveKm == null ? null : Math.round(naiveKm * 10) / 10,
    savedKm: naiveKm == null ? null : Math.max(0, Math.round((naiveKm - totalKm) * 10) / 10),
    durationMinutes: Math.round(minutes - STOP_MINUTES),
    peakLoadKg: Math.round(peak * 10) / 10,
    assumptions: `Straight-line distance x ${ROAD_FACTOR} for roads, ${AVG_SPEED_KMH} km/h average, ${STOP_MINUTES} min per stop. Estimates only.`
  };
};
