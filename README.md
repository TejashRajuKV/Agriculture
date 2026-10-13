# AgriLoop - Frontend/Backend Structure

## 📁 Project Organization

The project is now organized into two main directories: **frontend** and **backend**.

```
AGRILOOP-1/
├── frontend/           # React Frontend Application
└── backend/            # Node.js Backend Server
```

## 🎨 Frontend (`/frontend/`)

Contains all React components, screens, styles, and frontend assets.

### 📂 Frontend Structure (what each file/folder does)
```
frontend/
├── index.html                 # Vite root HTML shell
├── HomePage.jsx               # React entry; shows Landing3D by default, or MainApp when landing is skipped
├── MainApp.jsx                # Authenticated app shell (header/nav, role-based tabs, overlays)
├── MainApp.css                # Layout + header/nav/FAB styling (glass/pills)
├── GlobalStyles.css           # Design tokens (palette, radii, shadows), typography, buttons/inputs, glass cards
├── ModernStyles.css           # Utility animations (float/pulse/shimmer), gradients, card hover, scrollbars, 3D helpers
├── FarmerUIStyles.css         # Extra farmer-themed tweaks (lightweight)
│
├── components/
│   ├── Common/                # Shared UI/FX
│   │   ├── Button.jsx/.css           # Reusable button styles
│   │   ├── TargetCursor.jsx/.css     # Custom cursor with effects
│   │   ├── Scroll3DWrapper.jsx/.css  # Lenis + GSAP 3D scroll/tilt wrapper
│   │   ├── EnhancedScroll.jsx        # Smooth scroll setup + loader
│   │   ├── FarmlandTheme.jsx/.css    # Animated background (fields, particles, seasonal effects)
│   │   ├── GSAPAnimations.jsx/.css   # Hooks/components for GSAP hero/hover/floating elements
│   │   ├── EcologyCard.jsx/.css      # Styled ecology/farming info cards
│   │   └── Particles/CropAnimations/FarmSimulationUI # Additional visual/animation helpers
│   │
│   ├── Landing/               # Landing page experience
│   │   ├── Landing3D.jsx/.css       # Current 3D hero with canvas particles, stats, role grid, CTAs
│   │   ├── LandingPage.jsx/.css     # Older/alternative landing variant
│   │   ├── HeroSection.jsx          # Hero content slice (used by older landing)
│   │   ├── ServicesSection.jsx      # Services showcase
│   │   ├── BlogSection.jsx          # Blog/insights cards
│   │   ├── NewsletterSection.jsx    # Email capture section
│   │   └── Footer.jsx               # Landing footer
│   │
│   └── ScanWaste/
│       └── Scanner.jsx        # Waste scanning UI flow
│
├── screens/                   # Role- and feature-specific screens rendered inside MainApp
│   ├── DashboardScreen.jsx/.css
│   ├── MarketplaceScreen.jsx/.css
│   ├── MarketPricesScreen.jsx/.css
│   ├── WeatherScreen.jsx/.css
│   ├── FarmingGuideScreen.jsx/.css
│   ├── LearningHubScreen.jsx/.css
│   ├── HouseholdScreen.jsx/.css
│   ├── BiogasMarketplaceScreen.jsx/.css
│   ├── GeoMapScreen.jsx/.css
│   ├── ThemeDemo.css
│   ├── LoginScreen.jsx/.css
│   ├── MainLoginScreen.jsx
│   └── AboutScreen.jsx/.css
│
├── config/                    # Frontend service configs (e.g., cropMarketService)
├── docs/                      # Frontend documentation
├── public/                    # Static assets (nature-assets, etc.)
├── package.json               # Frontend dependencies/scripts
└── vite.config.js             # Vite configuration
```

### 🚀 Frontend Commands
```bash
cd frontend
npm install          # Install dependencies
npm run dev         # Start development server (port 3000)
npm run build       # Build for production
npm run preview     # Preview production build
```

## ⚙️ Backend (`/backend/`)

Contains all server-side code, APIs, database models, and backend services.

### 📂 Structure
```
backend/
├── models/           # Database models
│   └── CropPrice.js
├── services/         # Business logic services
│   ├── cropMarketService.js
│   ├── geminiService.js
│   └── trendService.js
├── routes/           # API routes
│   └── market.js
├── utils/            # Utility functions
│   ├── database.js
│   ├── types.js
│   └── ai/          # AI-related utilities
├── config/           # Database configuration
│   └── db.js
├── jobs/             # Background jobs
│   └── priceUpdater.js
├── tests/            # Backend tests
├── scripts/          # Utility scripts
├── data/             # Data files
├── config-files/     # Configuration files
├── MainServer.js     # Main Express server
├── BasicServer.js    # Simple server setup
├── ApiRoutes.js      # API route definitions
└── package.json      # Backend dependencies
```

### 🚀 Backend Commands
```bash
cd backend
npm install          # Install dependencies
npm start           # Start production server (port 5000)
npm run dev         # Start development server with nodemon
npm run simple      # Start basic server
npm test            # Run tests
```

## 🔧 Development Setup

### 1. Install Dependencies
```bash
# Frontend
cd frontend
npm install

# Backend
cd backend
npm install
```

### 2. Database and environment
AgriLoop uses **MongoDB running locally** (Windows service on port 27017, no Docker needed) in its own `agriloop` database.

```bash
cd backend
cp .env.example .env      # then set AUTH_SECRET to a long random string
npm run seed              # creates demo data (only ever touches the "agriloop" database)
```

`backend/.env` keys: `MONGODB_URI`, `PORT` (5001), `AUTH_SECRET` (32+ chars, signs login tokens), `CLIENT_ORIGIN`.

### 3. Start Development Servers
```bash
# Terminal 1 - Backend (port 5001)
cd backend
npm run dev

# Terminal 2 - Frontend (port 3000)
cd frontend
npm run dev
```

### 4. Run the tests
```bash
cd backend
npm test        # 74 API tests against a separate "agriloop_test" database
```

## 📡 API Communication

- **Frontend**: Runs on `http://localhost:3000`
- **Backend**: Runs on `http://localhost:5001`
- **Proxy**: Frontend proxies `/api/*` and `/uploads/*` to the backend

## 🌾 Procurement & Marketplace platform (Milestone 1)

AgriLoop now connects farmers to **procurement centres** and directly to **buyers**:

| Area | What works |
|---|---|
| Accounts | Real login with passwords (scrypt) and signed tokens; roles are checked on the server |
| Procurement | Find centres (distance, live queue, capacity), book a slot, server-generated token (e.g. `M01-0928-047`), check in, live queue tracker (people ahead, estimated wait), status timeline |
| Manager desk | Today's stats and centre utilisation, call next / call / no-show, weigh, grade, accept/partly accept/reject, complete, settle payments |
| Payments | `PENDING → PROCESSING → PAID / FAILED`, simulated provider behind a swappable interface |
| Notifications | Stored in-app notifications + bell; mock SMS adapter logs instead of sending |
| Marketplace | One marketplace, two kinds: **Fresh produce** (fixed price → orders → inventory, no overselling) and **Crop residue** (on-device scan → bids → accept → pickup) |
| Orders | Buyer/seller status flow with pay-on-delivery, cancellation restocks |
| Household waste | Households request a pickup; a biogas plant accepts and confirms collection; the household earns carbon points for degradable waste |
| Dashboards | Farmer and buyer dashboards built only from database figures |

**Demo accounts** (password `AgriLoop@2026`, created by `npm run seed`):

| Role | Email |
|---|---|
| Farmer (Ravi) | `ravi@agriloop.demo` |
| Buyer (restaurant) | `buyer.hotel@agriloop.demo` |
| Buyer (retailer) | `buyer.retail@agriloop.demo` |
| FPO | `fpo.mandya@agriloop.demo` |
| Procurement manager (Mandya, Mysuru) | `manager.karnataka@agriloop.demo` |
| Procurement manager (Sangrur) | `manager.punjab@agriloop.demo` |
| Household | `household@agriloop.demo` |
| Biogas plant | `biogas@agriloop.demo` |

The seed puts a live queue at Mandya for **today**: token 039 is being weighed and 040–046 are waiting, so Ravi's next booking gets token 047 with 8 people ahead. Re-run `npm run seed` on the day you demo.

More detail: [architecture](docs/architecture.md) · [database](docs/database.md) · [procurement](docs/procurement.md) · [marketplace](docs/marketplace.md) · [API](docs/api.md) · [testing](docs/testing.md)

**Next milestones:** logistics (vehicles, deliveries, route optimisation), demand forecasting and price estimation (local scikit-learn models), admin dashboard.

## 🗂️ Key Files

### Frontend Entry Points
- `HomePage.jsx` - Main React entry point
- `MainApp.jsx` - Core application component
- `components/Landing/LandingPage.jsx` - Landing page

### Backend Entry Points
- `MainServer.js` - Connects to MongoDB and starts the API
- `app.js` - Builds the Express app (routes, auth, error handling); used by the tests too
- `scripts/seedAgriLoop.js` - Demo data (`npm run seed`)
- `BasicServer.js`, `ApiRoutes.js` - Older experiments, not used by the app

### Configuration
- `frontend/vite.config.js` - Frontend build configuration
- `backend/config/db.js` - Database configuration
- `frontend/package.json` - Frontend dependencies
- `backend/package.json` - Backend dependencies

## 🚀 Deployment

### Frontend (Static Build)
```bash
cd frontend
npm run build
# Deploy 'dist' folder to static hosting
```

### Backend (Node.js Server)
```bash
cd backend
npm start
# Deploy to Node.js hosting service
```

## 📝 Benefits of This Structure

✅ **Clear Separation**: Frontend and backend are completely separated
✅ **Independent Development**: Teams can work on frontend/backend independently
✅ **Easy Deployment**: Each part can be deployed separately
✅ **Scalable**: Easy to scale frontend and backend independently
✅ **Technology Flexibility**: Can use different technologies for each part
✅ **Better Organization**: Logical grouping of related files

This structure follows modern full-stack development best practices! 🎉