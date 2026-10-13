# Testing

```bash
cd backend
npm test
```

This uses Node's built-in test runner with no extra packages. Each file in `tests/suite/` starts the real Express app on a random port against a freshly seeded `agriloop_test` database, and calls it over HTTP.

| File | Covers |
|---|---|
| auth.test.js | login per role, same 401 for a wrong password or unknown email, validation, no self-registration as staff, forged or tampered tokens |
| procurement.test.js | queue state from the database, token and booking-number formats, double booking, concurrent bookings never overbook and tokens stay unique, invalid dates and quantities, queue position and wait, manager step order, ₹ amount (472 × 24 = 11,328), payment once only, wallet credit, cross-role and cross-centre authorisation |
| marketplace.test.js | listing validation and ownership, inventory decrease, simultaneous orders never oversell, sold out, minimum order, order status machine, pay on delivery, cancel restocks, private residue bids, accept locks the lot, money and carbon points |
| waste-profile.test.js | household waste flow (roles, validation, one plant wins, only the claimer confirms, points), waste never appears in the marketplace, profile editing (role and email stay fixed), public stats, residue sales in the earnings chart |
| notifications.test.js | stored booking and queue notifications, read and read-all, no access to others' notifications, mock SMS adapter |

Tests book tomorrow's slots, so they pass at any time of day. The older scripts in `tests/*.js` are manual checks from earlier versions; run them with `npm run test:legacy`.

## Phase 2 suites
- `prices-payments.test.js`: centre prices and moisture limits, manager-only edits, farmer payment list, delay reasons.
- `pools.test.js`: village straw pools (progress, join/leave, validation, private bids, locking, pro-rata payout, cancel).
- `mandi.test.js`: live mandi prices with `fetch` mocked (no key, normalisation, caching, upstream failure). The real data.gov.in API has not been called from this project.
- `otp-assisted.test.js`: phone-code login (single use, rate limit, lockout, no enumeration) and booking on a farmer's behalf.
- `phase4.test.js`: FPO workspace and membership, glut alerts, machine rental (including two simultaneous accepts), scheme catalogue and reminder delivery.
- `logistics.test.js`: route planner properties (precedence, capacity, determinism, never worse than one-by-one, refusals), vehicle rules, trip creation and claiming, running a trip with payment, cancel, tracking.
- `intelligence.test.js`: Node prediction matches the Python trainer's saved fixtures, honest accuracy fields, 7-day forecast shape, real intake replacing simulated days, refusal on thin history, price guidance.
- `admin.test.js`: every admin endpoint closed to others, overview and attention data, centre health, suspend/restore (token stops working), self-protection, staff creation and centre assignment, audit log.
- `auth.test.js` also covers login throttling (8 wrong passwords per email and address, then a wait) and the security headers.
