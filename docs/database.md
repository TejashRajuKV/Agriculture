# Database (MongoDB, database `agriloop`)

| Collection | Key fields | Important indexes |
|---|---|---|
| users | name, email, passwordHash (never returned), role, location {label, lat, lng}, buyerType, farmerCode, fpo, centerIds, walletBalance, carbonPoints | email unique, farmerCode unique |
| fpos | name, registrationNumber, admin, members[{farmer, joinedAt}] | registrationNumber unique |
| crops | name, category, unit, agmarknetName | name unique |
| procurementcenters | code (M01), name, district, state, lat/lng, opening/closingTime, slotMinutes, counters, avgProcessingMinutes, dailyCapacity, crops, cropPrices[{crop, pricePerKg}], managers | code unique |
| procurementslots | center, date (YYYY-MM-DD IST), startTime, endTime, capacity, bookedCount, status | (center, date, startTime) unique |
| procurementbookings | bookingNumber (PR-YYYY-NNNNN), tokenNumber (M01-MMDD-NNN), tokenSeq, farmer, center, slot, date, crop, estimatedQuantity, status, active, arrivalStatus, queue {status, joinedAt, calledAt, startedAt, completedAt} | (farmer, center, date) unique where active; (center, date, tokenSeq) unique |
| procurementrecords | recordNumber, booking, date, declared/weighed/accepted/rejectedQuantity, qualityGrade, pricePerKg, totalAmount, status, stage timestamps, processingMinutes | booking unique; (center, completedAt) |
| payments | procurement, farmer, center, amount, provider, status, transactionRef, processingAt, paidAt | procurement unique |
| notifications | user, title, message, type, referenceType, referenceId, isRead | (user, createdAt) |
| listings | kind PRODUCE/RESIDUE, seller, sellerType, crop, title, quantityAvailable, quantityListed, unit, pricePerUnit, minOrderQuantity, harvestDate, qualityGrade, location, status, analysis (residue), bids[], acceptedBid | (kind, status, createdAt), seller |
| orders | orderNumber (OD-YYYY-NNNNN), buyer, seller, listing, item snapshot, quantity, unitPrice, subtotal, totalAmount, status, paymentStatus, deliveryStatus, history[] | buyer, seller |
| counters | _id (e.g. `token:M01:2026-09-28`), seq | — |
| cropprices | existing market-price model (empty unless imported; CSV fallback used) | — |

Seed: `npm run seed` (backend) drops and rebuilds **only** `agriloop` / `agriloop_test`.
