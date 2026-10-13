import React, { useState, useEffect, useRef, useCallback } from 'react';
import { api, setUnauthorizedHandler } from './utils/apiClient.js';
import { currentUser, logout } from './utils/authService.js';
import { BurnVsSellScreen } from './screens/BurnVsSellScreen.jsx';
import { MainLoginScreen } from './screens/MainLoginScreen.jsx';
import { NatureAuthScreen } from './screens/NatureAuthScreen.jsx';
import { Scanner } from './components/ScanWaste/Scanner.jsx';
import { DashboardScreen } from './screens/DashboardScreen.jsx';
import { FarmingGuideScreen } from './screens/FarmingGuideScreen.jsx';
import { MarketplaceScreen } from './screens/MarketplaceScreen.jsx';
import { ScanResultListingScreen } from './screens/ScanResultListingScreen.jsx';
import { HouseholdScreen } from './screens/HouseholdScreen.jsx';
import { BiogasMarketplaceScreen } from './screens/BiogasMarketplaceScreen.jsx';
import { LearningHubScreen } from './screens/LearningHubScreen.jsx';
import { AboutScreen } from './screens/AboutScreen.jsx';
import { WeatherScreen } from './screens/WeatherScreen.jsx';
import { AdminScreen } from './screens/AdminScreen.jsx';
import { LogisticsScreen } from './screens/LogisticsScreen.jsx';
import { FpoScreen } from './screens/FpoScreen.jsx';
import { MachinesScreen } from './screens/MachinesScreen.jsx';
import { SchemesScreen } from './screens/SchemesScreen.jsx';
import { MarketPricesScreen } from './screens/MarketPricesScreen.jsx';
import { ProcurementScreen } from './screens/ProcurementScreen.jsx';
import { ManagerProcurementScreen } from './screens/ManagerProcurementScreen.jsx';
import { OrdersScreen } from './screens/OrdersScreen.jsx';
import { NotificationBell } from './components/Notifications/NotificationBell.jsx';
import { ProfileDialog } from './components/Common/ProfileDialog.jsx';
import { LanguageProvider, LanguageSelect, useI18n } from './utils/i18n.jsx';
import { OfflineBanner } from './components/Common/OfflineBanner.jsx';
import { ToastProvider, useToast } from './components/Common/Toast.jsx';
import { LoadingState } from './components/Common/UI.jsx';
import {
  Plus, Home, ShoppingBag, Calculator, LogOut, Sprout, Flame, BookOpen, CloudRain, TrendingUp, Scale,
  Warehouse, Package, ClipboardList, Info, ChevronDown, MoreHorizontal, Truck, Users, Landmark, ShieldCheck
} from 'lucide-react';
import { TargetCursor } from './components/Common/TargetCursor.jsx';
import { EnhancedScrollWrapper } from './components/Common/EnhancedScroll.jsx';
import { FarmlandTheme } from './components/Common/FarmlandTheme.jsx';
import './GlobalStyles.css';
import './MainApp.css';
import './components/Common/GSAPAnimations.css';
import './FarmerUIStyles.css';

// Every tab the app knows about
const TABS = {
  dashboard: { label: 'Dashboard', icon: Home },
  procurement: { label: 'Procurement', icon: Warehouse },
  desk: { label: 'Procurement desk', icon: ClipboardList },
  marketplace: { label: 'Marketplace', icon: ShoppingBag },
  orders: { label: 'Orders', icon: Package },
  fpo: { label: 'My FPO', icon: Users },
  logistics: { label: 'Logistics', icon: Truck },
  admin: { label: 'Admin', icon: ShieldCheck },
  machines: { label: 'Machines', icon: Truck },
  schemes: { label: 'Schemes', icon: Landmark },
  weather: { label: 'Weather', icon: CloudRain },
  market: { label: 'Market prices', icon: TrendingUp },
  burnvssell: { label: 'Burn vs Sell', icon: Scale },
  planner: { label: 'Planner', icon: Calculator },
  learning: { label: 'Learning', icon: BookOpen },
  household: { label: 'Submit Waste', icon: Home },
  biogas: { label: 'Biogas', icon: Flame },
  soon: { label: 'My workspace', icon: Truck },
  about: { label: 'About', icon: Info }
};

// Primary tabs sit in the header; the rest go under "More" so the header never overflows
const NAV = {
  FARMER: { primary: ['dashboard', 'procurement', 'marketplace', 'orders'], more: ['machines', 'schemes', 'weather', 'market', 'burnvssell', 'planner', 'learning', 'about'] },
  FPO: { primary: ['dashboard', 'fpo', 'procurement', 'marketplace'], more: ['orders', 'machines', 'schemes', 'weather', 'market', 'burnvssell', 'planner', 'learning', 'about'] },
  BUYER: { primary: ['dashboard', 'marketplace', 'orders'], more: ['market', 'about'] },
  PROCUREMENT_MANAGER: { primary: ['desk'], more: ['market', 'weather', 'about'] },
  MARKET: { primary: ['market', 'weather', 'marketplace'], more: ['about'] },
  LEARNER: { primary: ['learning'], more: ['about'] },
  HOUSEHOLD: { primary: ['household'], more: ['about'] },
  BIOGAS: { primary: ['biogas'], more: ['about'] },
  LOGISTICS_OPERATOR: { primary: ['logistics'], more: ['market', 'about'] },
  ADMIN: { primary: ['admin'], more: ['market', 'about'] }
};
const navFor = (role) => NAV[role] || { primary: [], more: ['about'] };
const SELLERS = ['FARMER', 'FPO'];

function AppShell() {
  const toast = useToast();
  const { t } = useI18n();
  const tabLabel = (key) => t(`nav.${key}`) === `nav.${key}` ? TABS[key].label : t(`nav.${key}`);
  const [user, setUser] = useState(null);
  const [restoring, setRestoring] = useState(true);
  const [authRole, setAuthRole] = useState(null); // role card chosen on the landing page
  const [activeTab, setActiveTab] = useState('dashboard');
  const [deepLink, setDeepLink] = useState({}); // { bookingId } | { orderId } for the active tab
  const [marketKind, setMarketKind] = useState('PRODUCE');
  const [showScanner, setShowScanner] = useState(false);
  const [scanResult, setScanResult] = useState(null);
  const [showProfile, setShowProfile] = useState(false);
  const [currentSeason, setCurrentSeason] = useState('spring');

  const goHome = useCallback((u) => setActiveTab(navFor(u.role).primary[0] || 'about'), []);

  const signOut = useCallback((message) => {
    logout();
    setUser(null);
    setAuthRole(null);
    if (message) toast.info(message);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Restore the session from the saved token
  useEffect(() => {
    setUnauthorizedHandler(() => signOut('Your session expired. Please log in again.'));
    currentUser().then((u) => {
      if (u) {
        setUser(u);
        goHome(u);
      }
      setRestoring(false);
    });
    const month = new Date().getMonth();
    setCurrentSeason(['winter', 'winter', 'spring', 'spring', 'spring', 'summer', 'summer', 'summer', 'autumn', 'autumn', 'autumn', 'winter'][month]);
  }, [goHome, signOut]);

  // Keep header points/wallet fresh when switching tabs
  useEffect(() => {
    if (!user) return;
    currentUser().then((u) => u && setUser(u));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  const navigate = useCallback((tab, link = {}) => {
    setDeepLink(link);
    if (link.kind) setMarketKind(link.kind);
    setActiveTab(tab);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  const openReference = ({ type, id }) => {
    if (type === 'booking') navigate(user.role === 'PROCUREMENT_MANAGER' ? 'desk' : 'procurement', { bookingId: id });
    else if (type === 'order') navigate('orders', { orderId: id });
    else if (type === 'listing') navigate('marketplace', { kind: 'RESIDUE' });
    else if (type === 'machine-booking') navigate('machines');
    else if (type === 'scheme') navigate('schemes');
    else if (type === 'pool') navigate('marketplace', { kind: 'POOLS' });
    else if (type === 'fpo') navigate(user.role === 'FPO' ? 'fpo' : 'dashboard');
    else if (type === 'waste') navigate(user.role === 'BIOGAS' ? 'biogas' : 'household');
  };

  const handleAuthComplete = (u) => {
    setUser(u);
    setAuthRole(null);
    goHome(u);
    toast.success(`Welcome, ${u.name.split(' ')[0]}!`);
  };

  const handleScanComplete = (image, analysis) => {
    setShowScanner(false);
    setScanResult({ image, analysis });
  };

  // Residue lots are saved on the server so buyers anywhere can bid
  const confirmListing = async ({ analysis, quantity } = {}) => {
    if (!scanResult) return;
    try {
      await api('/marketplace/listings', {
        method: 'POST',
        body: { kind: 'RESIDUE', image: scanResult.image, analysis: analysis || scanResult.analysis, quantity: quantity || 1 }
      });
      setScanResult(null);
      toast.success('Your crop residue is listed. Buyers can now bid.');
      navigate('marketplace', { kind: 'RESIDUE' });
    } catch (err) {
      toast.error(err.message);
    }
  };

  if (restoring) return <div className="app-restoring"><LoadingState text="Opening AgriLoop…" /></div>;
  if (!user && authRole) return <NatureAuthScreen role={authRole} onAuthComplete={handleAuthComplete} onBack={() => setAuthRole(null)} />;
  if (!user) return <MainLoginScreen onLogin={(role) => setAuthRole(role)} />;

  const nav = navFor(user.role);
  const canSell = SELLERS.includes(user.role);
  const tab = [...nav.primary, ...nav.more].includes(activeTab) ? activeTab : nav.primary[0] || 'about';

  return (
    <div className="app-container">
      <FarmlandTheme userRole={user.role} season={currentSeason} />
      <header className="app-header">
        <div className="header-content">
          <div className="header-inner">
            <div className="logo-section" onClick={() => navigate(nav.primary[0] || 'about')}>
              <div className="logo-icon"><Sprout size={24} /></div>
              <div>
                <h1 className="logo-title">AgriLoop</h1>
                <p className="logo-subtitle">किसान का साथी</p>
              </div>
            </div>

            <nav className="main-nav" aria-label="Main">
              {nav.primary.map((key) => {
                const { icon: Icon } = TABS[key];
                const label = tabLabel(key);
                return (
                  <button key={key} onClick={() => navigate(key)} className={`nav-button ${tab === key ? 'nav-button-active' : ''}`} aria-current={tab === key ? 'page' : undefined}>
                    <Icon size={18} /> {label}
                  </button>
                );
              })}
              {nav.more.length > 0 && <MoreMenu items={nav.more} active={tab} onPick={navigate} tabLabel={tabLabel} moreLabel={t('nav.more')} />}
            </nav>

            <div className="user-section">
              <div className="carbon-points">
                <div className="carbon-indicator"></div>
                <span className="carbon-text">{user.carbonPoints.toLocaleString('en-IN')} pts</span>
              </div>
              <LanguageSelect />
              <NotificationBell onOpen={openReference} />
              <div className="user-info">
                <p className="user-name">{user.name}</p>
                <p className="user-role">{user.role.replace(/_/g, ' ').toLowerCase()}</p>
              </div>
              <button type="button" className="user-avatar user-avatar-btn" onClick={() => setShowProfile(true)} title="My profile" aria-label="My profile">{user.name.charAt(0)}</button>
              <button onClick={() => signOut()} className="logout-button" title="Log out" aria-label="Log out">
                <LogOut size={20} />
              </button>
            </div>
          </div>
        </div>
      </header>

      <EnhancedScrollWrapper className="main-wrapper">
        <main className="main-content">
          {tab === 'dashboard' && <DashboardScreen user={user} onNavigate={navigate} onScanRequest={() => setShowScanner(true)} />}
          {tab === 'procurement' && <ProcurementScreen user={user} initialBookingId={deepLink.bookingId} onBookingOpened={() => setDeepLink({})} />}
          {tab === 'desk' && <ManagerProcurementScreen />}
          {tab === 'marketplace' && (
            <MarketplaceScreen key={marketKind} user={user} initialKind={marketKind} onScanRequest={() => setShowScanner(true)} onOrdersRequest={() => navigate('orders')} />
          )}
          {tab === 'fpo' && <FpoScreen />}
          {tab === 'logistics' && <LogisticsScreen />}
          {tab === 'admin' && <AdminScreen />}
          {tab === 'machines' && <MachinesScreen user={user} />}
          {tab === 'schemes' && <SchemesScreen />}
          {tab === 'orders' && <OrdersScreen user={user} highlightId={deepLink.orderId} />}
          {tab === 'burnvssell' && <BurnVsSellScreen onScanRequest={() => setShowScanner(true)} />}
          {tab === 'planner' && (
            <div className="planner-wrapper">
              <FarmingGuideScreen />
            </div>
          )}
          {tab === 'weather' && <WeatherScreen user={user} />}
          {tab === 'market' && <MarketPricesScreen user={user} />}
          {tab === 'household' && <HouseholdScreen user={user} />}
          {tab === 'biogas' && <BiogasMarketplaceScreen />}
          {tab === 'learning' && <LearningHubScreen />}
          {tab === 'about' && <AboutScreen />}
          {tab === 'soon' && <ComingSoon role={user.role} />}
        </main>
      </EnhancedScrollWrapper>

      {canSell && (
        <div className="fab-container">
          <button onClick={() => setShowScanner(true)} className="scan-button">
            <span className="fab-text">Scan Waste</span>
            <span className="fab-icon"><Plus size={24} strokeWidth={3} /></span>
          </button>
        </div>
      )}

      {showProfile && <ProfileDialog user={user} onClose={() => setShowProfile(false)} onSaved={(u) => { setUser(u); setShowProfile(false); }} />}
      {showScanner && <Scanner onScanComplete={handleScanComplete} onCancel={() => setShowScanner(false)} />}
      {scanResult && <ScanResultListingScreen scanResult={scanResult} onCancel={() => setScanResult(null)} onConfirm={confirmListing} />}
    </div>
  );
}

// Secondary tabs in a small dropdown
// The nav scrolls sideways on small screens (overflow), so the menu is placed with
// fixed coordinates from its button instead of being clipped inside the nav.
const MoreMenu = ({ items, active, onPick, tabLabel, moreLabel }) => {
  const [pos, setPos] = useState(null); // null = closed
  const ref = useRef(null);
  const btnRef = useRef(null);
  const activeInMenu = items.includes(active);
  const open = Boolean(pos);

  const toggle = () => {
    if (open) return setPos(null);
    const r = btnRef.current.getBoundingClientRect();
    setPos({ top: r.bottom + 6, left: Math.max(8, Math.min(r.left, window.innerWidth - 228)) });
  };

  useEffect(() => {
    if (!open) return undefined;
    const close = () => setPos(null);
    const onDoc = (e) => !ref.current?.contains(e.target) && close();
    const onKey = (e) => e.key === 'Escape' && close();
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    window.addEventListener('resize', close);
    window.addEventListener('scroll', close, true);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
      window.removeEventListener('resize', close);
      window.removeEventListener('scroll', close, true);
    };
  }, [open]);

  return (
    <div className="nav-more" ref={ref}>
      <button
        ref={btnRef}
        type="button"
        className={`nav-button ${activeInMenu ? 'nav-button-active' : ''}`}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={toggle}
      >
        <MoreHorizontal size={18} /> {activeInMenu ? tabLabel(active) : moreLabel} <ChevronDown size={14} />
      </button>
      {open && (
        <div className="nav-more-menu" role="menu" style={{ top: pos.top, left: pos.left }}>
          {items.map((key) => {
            const { icon: Icon } = TABS[key];
            const label = tabLabel(key);
            return (
              <button
                key={key}
                type="button"
                role="menuitem"
                className={`nav-more-item ${active === key ? 'active' : ''}`}
                onClick={() => {
                  setPos(null);
                  onPick(key);
                }}
              >
                <Icon size={16} /> {label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};

const ComingSoon = ({ role }) => (
  <div className="coming-soon">
    <Truck size={40} />
    <h1>{role === 'ADMIN' ? 'Admin dashboard' : 'Logistics workspace'} is on the way</h1>
    <p>
      {role === 'ADMIN'
        ? 'Platform-wide analytics and management arrive in a later milestone. Market prices are available from the menu.'
        : 'Vehicle assignment, deliveries and route optimisation arrive in the next milestone.'}
    </p>
  </div>
);

function MainApp() {
  return (
    <LanguageProvider>
    <ToastProvider>
      <OfflineBanner />
      <TargetCursor spinDuration={4} hideDefaultCursor={true} parallaxOn={true} />
      <AppShell />
    </ToastProvider>
    </LanguageProvider>
  );
}

export default MainApp;
