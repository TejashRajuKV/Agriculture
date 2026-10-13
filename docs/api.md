# API (base `/api`)

All endpoints except auth, crops, health and market prices need `Authorization: Bearer <token>`. Errors are returned as `{ "error": "message", "details"?: [...] }` with status 400, 401, 403, 404 or 409.

## Auth
| Method | Path | Notes |
|---|---|---|
| POST | /auth/register | name, email, password (8+), role (FARMER, FPO, BUYER, HOUSEHOLD, BIOGAS, LEARNER, MARKET), phone, location, buyerType |
| POST | /auth/login | email, password → { user, token } |
| GET | /auth/me | current user |
| PATCH | /auth/me | change name, phone, location (re-located on the map). Role and email cannot be changed |

## Procurement
| Method | Path | Who |
|---|---|---|
| GET | /procurement-centers?search= | any signed-in user |
| GET | /procurement-centers/:id | any signed-in user |
| GET | /procurement-centers/:id/slots?date=YYYY-MM-DD | any signed-in user |
| POST | /procurement/bookings `{ slotId, cropId, estimatedQuantity }` | farmer, FPO |
| GET | /procurement/bookings | farmer, FPO (own bookings) |
| GET | /procurement/bookings/:id, /:id/queue, /:id/status | owner or that centre's manager |
| POST | /procurement/bookings/:id/check-in, /:id/cancel | owner |

## Manager (PROCUREMENT_MANAGER, own centres only)
| Method | Path |
|---|---|
| GET | /manager/centers, /manager/overview?centerId=&date=, /manager/queue |
| POST | /manager/queue/call-next `{ centerId }` |
| POST | /manager/queue/:bookingId/check-in, /call, /skip |
| POST | /manager/procurement/:bookingId/start, /weight `{ weighedQuantity }`, /quality `{ qualityGrade, acceptedQuantity, pricePerKg, qualityNotes }`, /complete |
| POST | /manager/payment/:paymentId/update `{ status: PAID or FAILED or PROCESSING, reason }` |

## Notifications
`GET /notifications`, `PATCH /notifications/:id/read`, `PATCH /notifications/read-all`

## Marketplace and orders
| Method | Path | Who |
|---|---|---|
| GET | /crops | public |
| GET | /marketplace/listings?kind=&search=&cropId=&quality=&sellerType=&sort=&mine=1&mybids=1 | signed in |
| GET | /marketplace/listings/:id | signed in (includes seller contact) |
| POST | /marketplace/listings (kind PRODUCE or RESIDUE) | farmer, FPO |
| PATCH, DELETE | /marketplace/listings/:id | owner |
| POST | /marketplace/listings/:id/bids, DELETE …/bids/mine | buyer |
| POST | /marketplace/listings/:id/bids/:bidId/accept, /reject | owner |
| POST | /marketplace/listings/:id/complete | owner or winning buyer |
| POST | /orders `{ listingId, quantity, deliveryAddress, notes }` | buyer |
| GET | /orders?as=buyer or seller, /orders/:id | parties |
| PATCH | /orders/:id/status `{ status }` | parties, allowed transitions only |

## Household waste and biogas plants
| Method | Path | Who |
|---|---|---|
| POST | /waste `{ degradability, quantityKg, address, image? }` | household |
| GET | /waste | household: own requests; biogas plant: open requests and the ones it claimed |
| POST | /waste/:id/cancel | household (only while still open) |
| POST | /waste/:id/claim | biogas plant (degradable waste only; one plant wins) |
| POST | /waste/:id/collected | the plant that claimed it; the household earns 2 carbon points per kg of degradable waste |

## Centre prices and payment delays
| Method | Path | Who |
|---|---|---|
| GET | /procurement-centers, /:id | `prices[]` (crop, pricePerKg, maxMoisturePct), `pricesUpdatedAt`, `typicalPayout` (median hours of the last 20 paid lots; null under 3) |
| GET | /procurement/payments | farmer/FPO: own payments with status, delay reason and what to do about it |
| POST | /manager/centers/:centerId/prices `{ cropId, pricePerKg, maxMoisturePct? }` | manager of that centre |
| POST | /manager/payment/:paymentId/delay `{ code, note? }` | manager; codes: BANK_DETAILS_MISMATCH, ACCOUNT_NOT_LINKED, FUNDS_PENDING, RECORD_VERIFICATION, BANK_TECHNICAL, OTHER; notifies the farmer |

## Village straw pools
| Method | Path | Who |
|---|---|---|
| GET | /pools?state&district&status | any signed-in user (member names only for members and the coordinator; bid prices only for the coordinator and the bidder) |
| POST | /pools `{ name, residue, minTonnes, myTonnes, deadline, district?, state?, village? }` | farmer/FPO; deadline at most 60 days out |
| POST | /pools/:id/join `{ tonnes }`, /leave | farmer/FPO, only while OPEN |
| POST | /pools/:id/bids `{ pricePerTon, pickupDate }`, DELETE /pools/:id/bids/mine | buyer/biogas plant, only once the minimum is reached, one open bid each |
| POST | /pools/:id/bids/:bidId/accept | coordinator; locks the member list |
| POST | /pools/:id/complete | coordinator or accepted buyer; buyer wallet pays each member pro-rata, 20 carbon points per tonne |
| POST | /pools/:id/cancel | coordinator |

## Live mandi prices
`GET /mandi/status`, `GET /mandi/prices?commodity=&state=&district=` return today's district prices from data.gov.in when `DATA_GOV_API_KEY` is set. Without a key the response is `{ live: false, reason: "NO_KEY" }`; nothing is invented. Results are cached for 30 minutes. The response field names follow the published resource and are not yet verified against a live key.

## Phone login and assisted booking
| Method | Path | Who |
|---|---|---|
| POST | /auth/otp/request `{ phone }` | anyone. Same reply whether or not the number has an account. Max 3 codes per 10 min per number. |
| POST | /auth/otp/verify `{ phone, code }` | anyone. Code is 6 digits, valid 5 min, single use, locked after 5 wrong tries. Returns `{ user, token }`. A number shared by several accounts never gets a code; those people use email login. |
| POST | /manager/assisted-booking `{ phone, slotId, cropId, estimatedQuantity, farmerCode? }` | manager of the slot's centre; books for the farmer (shared numbers need `farmerCode`), who is notified |

SMS goes through `services/smsService.js`, which only has a mock (logs the text). A real gateway replaces `deliver` there.

## FPO workspace, glut alerts, machines, schemes
| Method | Path | Who |
|---|---|---|
| GET | /fpo/overview | the FPO administrator: totals, 7-day supply by crop, per-member upcoming kg, 30-day procurement, unpaid money, listings |
| POST | /fpo/members `{ farmerCode }` or `{ phone }`, DELETE /fpo/members/:farmerId | FPO administrator |
| GET | /alerts/glut | farmer, FPO, manager. Crops booked at a centre at 1.5x or more of its 14-day daily average (WATCH) or 2x (HIGH), with quieter days and other centres. Uses AgriLoop bookings only; needs 3 days of history and 500 kg booked. |
| GET/POST | /machines (`?type&state&district&mine=true`) | any signed-in user lists; farmer/FPO create |
| PATCH | /machines/:id `{ rate?, active?, description? }` | owner |
| GET | /machines/:id/availability, POST /machines/:id/book `{ date, quantity, note? }` | farmer/FPO, not on their own machine, within 30 days |
| GET | /machines/bookings?as=renter\|owner | parties |
| POST | /machines/bookings/:id/accept, /decline, /cancel, /complete | owner (cancel: either party). A machine can have only one accepted renter per day (unique index). Rent is paid directly, not through AgriLoop. |
| GET | /schemes | catalogue with `applies` for the user's state, typical dates, own reminders |
| POST | /schemes/reminders `{ schemeId, remindOn, note? }`, DELETE /schemes/reminders/:id | own reminders, max 10 open. The server sends due reminders as notifications (checked hourly). |

## Logistics (role LOGISTICS_OPERATOR)
| Method | Path | Notes |
|---|---|---|
| GET/POST | /logistics/vehicles, PATCH /logistics/vehicles/:id `{ status: AVAILABLE\|MAINTENANCE }` | plate is unique; trips start from the operator's profile location |
| GET | /logistics/orders | orders in READY_FOR_PICKUP not on a trip; `routable` is false when the seller or buyer has no map position |
| POST | /logistics/plan `{ vehicleId, date, orderIds }` | preview only: stops, km, time, peak load, km saved against one-order-at-a-time. Nothing is saved. |
| POST | /logistics/deliveries | creates the trip (DL-YYYY-NNNNN). The server recomputes the route, claims each order atomically, notifies seller and buyer. Max 6 orders, within 14 days. |
| GET | /logistics/deliveries, /:id | |
| POST | /logistics/deliveries/:id/start, /cancel (planned only), /stops/:sequence/complete | stops must be done in route order; a pickup moves the order to IN_TRANSIT, a drop delivers it and settles the buyer's wallet to the seller |
| GET | /orders/:id/tracking | buyer or seller: trip number, plate, stops before theirs, planned minutes. A plan, not live GPS. |

Route method (`services/routeService.js`): each pickup before its own drop, load never above capacity; nearest-allowed-stop construction, then 2-opt and or-opt improvement. Distances are straight-line x 1.3, 35 km/h, 15 min per stop, so everything is an estimate. A heuristic, not a proven shortest route. While an order is on a trip, buyers and sellers can no longer move it by hand.

## Intelligence
| Method | Path | Who |
|---|---|---|
| GET | /intelligence/demand?centerId&cropId | farmer, FPO, manager: expected kg per day for the next 7 days with a likely range, past error against a simple rule, and how much of the history is simulated. `available:false` with a reason when history is thin. |
| GET | /intelligence/model | manager, FPO: training date, held-out accuracy, data provenance |
| GET | /intelligence/price-guidance?cropId&grade | farmer, FPO: suggested range from market price, grade factor, MSP and recent AgriLoop orders. A formula, labelled as not ML. |

See `ml/README.md` for how the model is trained and its limits.

## Admin (role ADMIN only)
| Method | Path | Notes |
|---|---|---|
| GET | /admin/overview | users by role, 30-day procurement, payments, marketplace, trips and fleet, plus 30-day daily series |
| GET | /admin/attention | stuck (>48 h) and failed payments, orders waiting >24 h for a vehicle, pools past deadline, queues of 30+ |
| GET | /admin/centres, /admin/fpos | capacity use (14-day average), queue, unpaid money, assigned managers |
| GET | /admin/users?search&role&suspended&page | 25 per page |
| POST | /admin/users/:id/suspend `{ suspended, reason }` | a reason is required to suspend. Blocks login and every request at once. Admins cannot suspend themselves or other admins. |
| PUT | /admin/users/:id/centres `{ centerIds }` | procurement managers only |
| POST | /admin/staff `{ name, email, phone, role }` | role MANAGER, LOGISTICS or ADMIN. Returns a temporary password once. |
| GET | /admin/audit | append-only record of suspensions, restores, staff creation, centre assignments |

## Other
`GET /public/stats` (landing page numbers: farmers, centres, active listings, tonnes procured; no personal data) · `GET /dashboard` (role-aware summary) · `GET /health` · `GET /market/crops` · `GET /market/crop/:name`
