import React, { useEffect, useState } from 'react';
import { Sprout, Leaf, TrendingUp, Zap, Globe, Users, Flame, Home, BookOpen, Check, ArrowRight } from 'lucide-react';
import { UserRole } from '../../utils/types.js';
import './Landing3D.css';

const RealisticLeaf = ({ size, colorStart = "#10b981", colorEnd = "#047857" }) => (
  <div style={{
    width: size,
    height: size,
    background: `linear-gradient(135deg, ${colorStart} 0%, ${colorEnd} 100%)`,
    borderTopLeftRadius: '100%',
    borderBottomRightRadius: '100%',
    borderTopRightRadius: '5%',
    borderBottomLeftRadius: '5%',
    boxShadow: 'inset 2px 2px 5px rgba(255,255,255,0.4), 2px 4px 8px rgba(0,0,0,0.15)',
    position: 'relative',
    transform: 'rotate(-45deg)' /* Points upwards normally */
  }}>
    {/* Center Vein */}
    <div style={{
      position: 'absolute',
      top: '0',
      left: '0',
      width: '141%',
      height: '1px',
      background: 'rgba(255,255,255,0.35)',
      transformOrigin: 'top left',
      transform: 'rotate(45deg)'
    }} />
  </div>
);

export const Landing3D = ({ onGetStarted }) => {
  // Real, aggregate numbers from the platform (hidden if the server is not reachable)
  const [stats, setStats] = useState(null);
  useEffect(() => {
    fetch('/api/public/stats')
      .then((r) => (r.ok ? r.json() : null))
      .then(setStats)
      .catch(() => {});
  }, []);
  const scrollToRoles = () => {
    document.getElementById('roles-section').scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <div className="landing-3d">
      
      {/* Header */}
      <header className="prem-header">
        <div className="prem-logo">
          <Sprout size={24} />
          AgriLoop
        </div>
        <nav className="prem-nav">
          <a href="#features">How it Works</a>
          <a href="#roles-section">Choose your role</a>
        </nav>
        <div className="prem-header-actions">
          <button className="prem-login-link" onClick={() => onGetStarted('LOGIN')}>
            Log in
          </button>
          <button className="btn-primary-pill" onClick={scrollToRoles}>
            Get Started
          </button>
        </div>
      </header>

      {/* Hero Section */}
      <section className="prem-hero">
        {/* Falling Leaves Background */}
        <div className="falling-leaf" style={{ left: '5%', '--sway': '40px', '--rot': '360deg', '--duration': '12s', '--delay': '0s' }}><RealisticLeaf size="28px" /></div>
        <div className="falling-leaf" style={{ left: '15%', '--sway': '-30px', '--rot': '-240deg', '--duration': '15s', '--delay': '4s' }}><RealisticLeaf size="18px" colorStart="#f59e0b" colorEnd="#d97706" /></div>
        <div className="falling-leaf" style={{ left: '8%', '--sway': '20px', '--rot': '180deg', '--duration': '10s', '--delay': '8s' }}><RealisticLeaf size="22px" /></div>
        
        <div className="falling-leaf" style={{ right: '5%', '--sway': '-50px', '--rot': '250deg', '--duration': '14s', '--delay': '2s' }}><RealisticLeaf size="32px" colorStart="#10b981" colorEnd="#065f46" /></div>
        <div className="falling-leaf" style={{ right: '12%', '--sway': '35px', '--rot': '-360deg', '--duration': '17s', '--delay': '6s' }}><RealisticLeaf size="20px" colorStart="#fcd34d" colorEnd="#d97706" /></div>
        <div className="falling-leaf" style={{ right: '8%', '--sway': '-15px', '--rot': '120deg', '--duration': '11s', '--delay': '1s' }}><RealisticLeaf size="26px" /></div>

        <h1>Turn Agricultural Waste Into Valuable Assets</h1>
        <p>Join the premier marketplace connecting farmers with green energy buyers. Trade biomass securely, earn carbon credits, and build a sustainable future.</p>
        
        <button 
          className="btn-primary-pill"
          onClick={() => {
            document.getElementById('roles-section').scrollIntoView({ behavior: 'smooth' });
          }}
        >
          Start Farming <ArrowRight size={18} />
        </button>
        
        {/* Landscape Image and Floating Card */}
        <div className="prem-landscape-container">
          <img src="/front_ui_image.png" alt="Beautiful Farm Landscape" className="prem-landscape-image" />
          
          {stats && (
            <div className="prem-floating-card">
              <div className="prem-stat">
                <div className="prem-stat-val">{stats.farmers.toLocaleString('en-IN')}</div>
                <div className="prem-stat-label"><Users size={16} /> Farmers on AgriLoop</div>
              </div>
              <div className="prem-stat">
                <div className="prem-stat-val">{stats.procurementCenters}</div>
                <div className="prem-stat-label"><Globe size={16} /> Procurement centres</div>
              </div>
              <div className="prem-stat">
                <div className="prem-stat-val">{stats.tonnesProcured.toLocaleString('en-IN')} t</div>
                <div className="prem-stat-label"><TrendingUp size={16} /> Procured so far</div>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="prem-features">
        <div className="prem-features-layout">
          <div className="prem-features-image-container">
            <img src="/feature_farm.png" alt="Eco-friendly farming" />
          </div>
          
          <div className="prem-features-content">
            <h2 className="prem-section-title">Why Choose AgriLoop?</h2>
            <p className="prem-features-subtitle">Sustainable farming and direct market access made incredibly simple.</p>
            
            <div className="prem-features-grid">
              <div className="prem-feature-card">
                <div className="prem-feature-header">
                  <div className="prem-feature-icon"><Sprout size={20} /></div>
                  <h3 className="prem-feature-title">AI Analysis</h3>
                </div>
                <p className="prem-feature-desc">Scan your crop residue on your phone to identify it and see a typical price range. The photo never leaves your device.</p>
              </div>

              <div className="prem-feature-card">
                <div className="prem-feature-header">
                  <div className="prem-feature-icon"><TrendingUp size={20} /></div>
                  <h3 className="prem-feature-title">Market Linkage</h3>
                </div>
                <p className="prem-feature-desc">Sell directly to restaurants, retailers and processors, with mandi prices as a reference. AgriLoop charges no commission.</p>
              </div>

              <div className="prem-feature-card">
                <div className="prem-feature-header">
                  <div className="prem-feature-icon"><Leaf size={20} /></div>
                  <h3 className="prem-feature-title">Sustainability</h3>
                </div>
                <p className="prem-feature-desc">Earn carbon points when you sell crop residue instead of burning it. Redeeming points is coming soon.</p>
              </div>

              <div className="prem-feature-card">
                <div className="prem-feature-header">
                  <div className="prem-feature-icon"><Zap size={20} /></div>
                  <h3 className="prem-feature-title">Payment Tracking</h3>
                </div>
                <p className="prem-feature-desc">Book a procurement slot, track your queue token and follow your lot from weighing to payment, step by step.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Role Selection Section */}
      <section id="roles-section" className="prem-roles">
        <h2 className="prem-section-title">Select Your Role</h2>
        
        <div className="prem-roles-grid">
          {[
            { id: UserRole.FARMER, title: 'Farmer', image: '/role_farmer.png', description: 'Sell crop residue and earn sustainable income', btn: 'Start as Farmer' },
            { id: UserRole.BUYER, title: 'Buyer', image: '/role_buyer.png', description: 'Buy produce and biomass directly from farmers', btn: 'Join as Buyer' },
            { id: 'FPO', title: 'Farmer Group (FPO)', image: '/feature_farm.png', description: 'Sell aggregated produce from member farmers in bulk', btn: 'Join as FPO' },
            { id: 'STAFF', title: 'Procurement Centre', image: '/feature_tractor.png', description: 'Staff login: queues, weighing, quality and payments', btn: 'Staff Login' },
            { id: UserRole.BIOGAS, title: 'Biogas Plant', image: '/role_biogas.png', description: 'Procure organic waste for energy', btn: 'Register Plant' },
            { id: UserRole.HOUSEHOLD, title: 'Household', image: '/role_household.png', description: 'Submit waste and earn rewards', btn: 'Join Household' },
            { id: UserRole.LEARNER, title: 'Learner', image: '/role_learner.png', description: 'Access farming education & AI advisory', btn: 'Start Learning' },
            { id: 'MARKET', title: 'Market', image: '/role_market.png', description: 'Live crop prices & market trends', btn: 'View Markets' },
            { id: UserRole.FARMER, title: 'Weather', image: '/role_weather.png', description: 'Climate alerts & farming advisories', btn: 'Check Weather' },
            { id: UserRole.FARMER, title: 'Farm Planner', image: '/role_planner.png', description: 'Calculate yield & estimated revenue', btn: 'Plan Farm' },
            { id: UserRole.LEARNER, title: 'Fertilizer Guide', image: '/role_guide.png', description: 'Compare natural vs chemical fertilizers', btn: 'View Guide' }
          ].map((role, idx) => (
            <div 
              key={idx}
              className="prem-role-card"
              onClick={() => onGetStarted(role.id)}
            >
              <div className="prem-role-image-wrapper">
                <img src={role.image} alt={role.title} />
              </div>
              <h3 className="prem-role-title">{role.title}</h3>
              <p className="prem-role-desc">{role.description}</p>
              
              <button className="prem-btn-solid">
                {role.btn}
              </button>
            </div>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className="prem-footer">
        <div className="prem-footer-top">
          
          <div className="prem-footer-brand">
            <div className="prem-logo">
              <Sprout size={24} />
              AgriLoop
            </div>
            <p>AgriLoop makes sustainable farming simple, with no hidden fees—just an easy path to turning agricultural waste into wealth. Ready to make the first move?</p>
            <button className="btn-primary-pill" onClick={scrollToRoles}>Get started today</button>
          </div>

          <div className="prem-footer-links">
            <h4>Explore</h4>
            <ul>
              <li><a href="#roles-section">Choose your role</a></li>
              <li><a href="#features">How it works</a></li>
            </ul>
          </div>

          <div className="prem-footer-links">
            <h4>Free farmer helplines</h4>
            <ul>
              <li>Kisan Call Centre: <a href="tel:18001801551">1800-180-1551</a></li>
              <li>Ask your nearest Krishi Vigyan Kendra (KVK)</li>
            </ul>
          </div>

        </div>

        <div className="prem-footer-middle">
          <div className="prem-footer-copy">&copy; 2026 AgriLoop</div>
        </div>
        <div className="prem-footer-bottom-image">
          <img src="/footer_landscape_hd.webp" alt="Beautiful Farm Landscape Footer" />
        </div>
      </footer>

    </div>
  );
};
