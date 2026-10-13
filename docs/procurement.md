# Procurement

## Farmer journey
1. **Find a centre**: nearest first (haversine from the farmer's location), live queue, today's remaining capacity, next free slot, wait if arriving now.
2. **Book a slot**: today + 6 days. Slots are generated from the centre's hours and slot length. Capacity per slot = min(slotMinutes × counters ÷ average minutes per farmer, dailyCapacity ÷ number of slots).
3. **Token**: generated on the server, `M01-0928-047` (centre code, month+day, sequence for that centre and day), plus booking number `PR-2026-00284`.
4. **I've arrived** (on the booking day) puts the farmer in the queue (`WAITING`).
5. **Queue tracker** refreshes every 5 s: now serving, people ahead, estimated wait.
6. **Timeline**: booked → arrived → called → weighing → quality check → accepted/partly/rejected → payment processing → paid. Every step has the real timestamp from the database.

## Wait-time estimate
`wait = people ahead × average minutes per farmer ÷ counters working`

The average is the mean processing time of the last 20 completed farmers at that centre, or the centre's configured value until there are at least 3. The formula and its inputs are shown to the farmer.

## Manager desk
Call next / call a specific token / no-show → start weighing → record weight → grade (A/B/C/reject), accepted kg, ₹/kg (defaults to the centre's price for that crop) → complete (creates the payment and starts it) → mark paid / failed / retry.

Guards: only `WAITING` can be called; at most `counters` farmers can be at the counters; steps cannot be skipped or repeated; accepted kg cannot exceed weighed kg; managers can only act on their own centres.

## Payments
`PENDING → PROCESSING → PAID | FAILED`, and `FAILED → PROCESSING` to retry. `services/paymentProvider.js` defines `initiate()` and `settle()`. The simulated provider is used now; a bank or UPI provider can replace it. When a payment is marked paid, the farmer's wallet is credited.

## Notifications
Slot booked or cancelled, "3rd in line" and "you're next", token called, weighing started, quality result, payment processing, paid or failed, no-show.
