# Architecture

```
Browser (React 18 + Vite, port 3000)
  │  /api/*, /uploads/*  (Vite dev proxy)
  ▼
Express API (backend/app.js, port 5001)
  ├─ middleware/auth.js      requireAuth (token → user from DB), requireRole, canManageCenter
  ├─ routes/*.js             thin: parse request → call service → JSON
  ├─ services/*.js           all business rules
  └─ models/*.js             Mongoose schemas + indexes
  ▼
MongoDB (local Windows service, database "agriloop")
```

## Frontend
- No router: `MainApp.jsx` keeps `activeTab`; tabs per role are configured in `NAV` (primary tabs + a "More" menu).
- Data loading: `utils/apiClient.js` (adds the token, turns errors into readable messages, signs out on 401) and `utils/hooks.js` (`useApi` with optional polling, `useAction`).
- Shared UI: `components/Common/UI.jsx` (StatusBadge, Modal, Timeline, Empty/Loading/Error states, Stat) and `Toast.jsx`.
- On-device AI (no API keys): CLIP via Transformers.js in a Web Worker (`utils/localVision.js`, `utils/visionWorker.js`).

## Backend
| Concern | File |
|---|---|
| Accounts, password hashing (scrypt), signed tokens (HMAC) | `services/authService.js` |
| Atomic counters for tokens and document numbers | `services/counterService.js` |
| Procurement centres, slots, bookings, queue, wait estimate | `services/procurementService.js` |
| Manager desk: queue actions, weighing, quality, completion, payments | `services/managerService.js` |
| Payment provider interface (simulated) | `services/paymentProvider.js` |
| Notifications + adapters (in-app, mock SMS) | `services/notificationService.js`, `services/notifications/adapters.js` |
| Marketplace: produce listings, residue bids | `services/marketplaceService.js` |
| Orders + inventory | `services/orderService.js` |
| Dashboards | `services/dashboardService.js` |
| Mandi prices (AGMARKNET CSV fallback) | `services/agmarknetCsv.js` |

## Why no transactions
The local MongoDB runs standalone (not a replica set), so multi-document transactions are unavailable. Every race-sensitive step is instead a single atomic conditional update, backed by unique indexes:
- slot seats: `findOneAndUpdate({ bookedCount < capacity }, { $inc: 1 })`
- one active booking per farmer/centre/day: unique partial index
- tokens and numbers: `$inc` on a counter document
- stock: `findOneAndUpdate({ quantityAvailable ≥ qty }, { $inc: -qty })`
- every status change: `findOneAndUpdate({ status: <allowed from> })`

If a later step fails, the earlier one is compensated (seat or stock given back). Converting MongoDB to a single-node replica set would allow real transactions later.
