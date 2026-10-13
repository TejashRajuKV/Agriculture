import React, { useState } from 'react';
import { UserRole } from '../utils/types.js';
import { Sprout, Briefcase, ScanLine, ArrowDown, CheckCircle2, FlaskConical, Leaf, X, BookOpen, Calculator, Home, Flame, CloudRain, AlertTriangle, Calendar, Droplets, BarChart3 } from 'lucide-react';
import { FarmingGuideScreen } from './FarmingGuideScreen.jsx';
import { EcologyCard } from '../components/Common/EcologyCard.jsx';
import Particles from '../components/Common/Particles.jsx';
import './LoginScreen.css';

const FERTILIZER_DATA = {
  NATURAL: [
    {
      name: 'Vermicompost',
      description: 'Nutrient-rich organic fertilizer produced by earthworms. Improves soil aeration.',
      suitableCrops: ['Tomatoes', 'Potatoes', 'Leafy Vegetables', 'Fruits'],
      icon: <Sprout className="fertilizer-icon-green" />
    },
    {
      name: 'Cow Dung Manure',
      description: 'Traditional organic manure rich in nitrogen and beneficial bacteria.',
      suitableCrops: ['Wheat', 'Rice (Paddy)', 'Sugarcane', 'General Gardening'],
      icon: <Leaf className="fertilizer-icon-green" />
    },
    {
      name: 'Neem Cake',
      description: 'Organic residue of neem oil production. Acts as fertilizer and pest repellent.',
      suitableCrops: ['Cotton', 'Turmeric', 'Chilli', 'Paddy'],
      icon: <CheckCircle2 className="fertilizer-icon-green" />
    },
    {
      name: 'Bone Meal',
      description: 'Slow-release fertilizer rich in phosphorus and calcium.',
      suitableCrops: ['Flowering Plants', 'Root Vegetables', 'Fruit Trees'],
      icon: <Leaf className="fertilizer-icon-green" />
    }
  ],
  CHEMICAL: [
    {
      name: 'Urea (Nitrogen)',
      description: 'Highly concentrated nitrogen fertilizer. Promotes rapid green leafy growth.',
      suitableCrops: ['Maize', 'Wheat', 'Rice', 'Spinach'],
      icon: <FlaskConical className="fertilizer-icon-blue" />
    },
    {
      name: 'DAP',
      description: 'Provides Phosphorus and Nitrogen. Crucial for root establishment.',
      suitableCrops: ['Wheat', 'Mustard', 'Pulses', 'Potato'],
      icon: <FlaskConical className="fertilizer-icon-blue" />
    },
    {
      name: 'MOP (Potash)',
      description: 'Provides Potassium. Improves disease resistance and grain quality.',
      suitableCrops: ['Coconut', 'Banana', 'Sugarcane', 'Vegetables'],
      icon: <FlaskConical className="fertilizer-icon-blue" />
    },
    {
      name: 'NPK 12:32:16',
      description: 'Balanced chemical fertilizer providing all three primary nutrients.',
      suitableCrops: ['Cotton', 'Groundnut', 'Vegetables'],
      icon: <FlaskConical className="fertilizer-icon-blue" />
    }
  ]
};

export const LoginScreen = ({ onLogin }) => {
  const [showFertilizerModal, setShowFertilizerModal] = useState(false);
  const [showPlannerModal, setShowPlannerModal] = useState(false);
  const [selectedFertType, setSelectedFertType] = useState(null);

  const handleFertilizerClose = () => {
    setShowFertilizerModal(false);
    setSelectedFertType(null);
  };

  return (
    <div className="login-screen">
      
      {/* NAVIGATION BAR */}
      <nav className="login-nav">
        <div className="nav-container">
          <div className="nav-content">
            <div className="nav-logo">
              <div className="nav-logo-icon">
                <Sprout size={24} />
              </div>
              <div>
                <h1 className="nav-logo-title">AgriLoop</h1>
                <p className="nav-logo-subtitle">Circular Economy</p>
              </div>
            </div>
            <div className="nav-links">
              <a href="#features" className="nav-link">Features</a>
              <a href="#roles" className="nav-link">Get Started</a>
              <button onClick={() => setShowFertilizerModal(true)} className="nav-link">Guide</button>
              <button onClick={() => setShowPlannerModal(true)} className="nav-button">
                Farm Planner
              </button>
            </div>
          </div>
        </div>
      </nav>
      
      {/* ANIMATED PARTICLES BACKGROUND */}
      <div className="particles-container">
        {[...Array(20)].map((_, i) => (
          <div 
            key={i}
            className="particle"
            style={{
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
              animationDelay: `${Math.random() * 6}s`,
              animationDuration: `${6 + Math.random() * 4}s`
            }}
          />
        ))}
      </div>
      
      {/* MODERN BACKGROUND */}
      <div className="background-overlay">
        <div className="background-gradient"></div>
        <Particles
          particleColors={['#22c55e', '#16a34a']}
          particleCount={50}
          particleSpread={3}
          speed={0.05}
          particleBaseSize={20}
          moveParticlesOnHover={true}
          alphaParticles={true}
          disableRotation={false}
        />
      </div>

      {/* MAIN CONTENT CONTAINER */}
      <div className="main-content">
        
        {/* 1. HERO SECTION */}
        <section className="hero-section">
             {/* Modern Hero Content */}
             <div className="hero-container">
                
                {/* Left Content */}
                <div className="hero-left">
                   <div className="hero-badge">
                     <div className="hero-badge-dot"></div>
                     <span className="hero-badge-text">AI-Powered Circular Economy</span>
                   </div>
                   
                   <h1 className="hero-title">
                     Transform <br/>
                     <span className="gradient-text">Waste</span> into <br/>
                     <span className="gradient-text">Wealth</span>
                   </h1>
                   
                   <p className="hero-description">
                     Connect farmers, buyers, and households in a sustainable marketplace powered by AI waste analysis and carbon tracking.
                   </p>
                   
                   <div className="hero-buttons">
                     <button onClick={() => onLogin(UserRole.FARMER)} className="hero-button-primary">
                       Start as Farmer
                     </button>
                     <button onClick={() => setShowPlannerModal(true)} className="hero-button-secondary">
                       Try Farm Planner
                     </button>
                   </div>
                   
                   {/* Stats */}
                   <div className="hero-stats">
                     <div className="hero-stat">
                       <div className="hero-stat-number">200+</div>
                       <div className="hero-stat-label">Active Farmers</div>
                     </div>
                     <div className="hero-stat">
                       <div className="hero-stat-number">₹50L+</div>
                       <div className="hero-stat-label">Revenue Generated</div>
                     </div>
                     <div className="hero-stat">
                       <div className="hero-stat-number">1000T</div>
                       <div className="hero-stat-label">CO₂ Saved</div>
                     </div>
                   </div>
                </div>
                
                {/* Right Visual */}
                <div className="hero-right">
                   {/* Floating Cards */}
                   <div className="hero-card">
                     <div className="hero-card-header">
                       <div className="hero-card-icon">
                         <ScanLine size={24} />
                       </div>
                       <div>
                         <div className="hero-card-title">AI Scanner</div>
                         <div className="hero-card-subtitle">Instant Analysis</div>
                       </div>
                     </div>
                   </div>
                   
                   <div className="hero-card hero-card-price">
                     <div className="hero-card-price-content">
                       <div className="hero-card-price-amount">₹3,500</div>
                       <div className="hero-card-price-label">Estimated Value</div>
                     </div>
                   </div>
                </div>
             </div>
             
             {/* Scroll Indicator */}
             <div className="scroll-indicator">
                <span className="scroll-text">Discover More</span>
                <div className="scroll-mouse">
                  <div className="scroll-dot"></div>
                </div>
             </div>
        </section>

        {/* 2. AI FEATURE SECTION */}
        <section id="features" className="features-section">
           <div className="features-container">
             <div className="features-grid">
                <div className="features-image">
                    <div className="features-image-glow"></div>
                    <div className="features-image-wrapper">
                      <img 
                          src="https://images.unsplash.com/photo-1530836369250-ef72a3f5cda8?auto=format&fit=crop&q=80&w=800" 
                          alt="AI Scanning" 
                          className="features-image-main"
                      />
                      <div className="features-image-shimmer"></div>
                    </div>
                </div>
                <div className="features-content">
                    <div className="features-badge">
                       <div className="features-badge-icon">
                         <ScanLine size={18} />
                       </div>
                       <span className="features-badge-text">AI Analyzer 2.0</span>
                    </div>
                    <h2 className="features-title">
                       Value from <br/><span className="gradient-text">Waste.</span>
                    </h2>
                    <p className="features-description">
                      Our Enhanced AI 2.0 doesn't just identify crops. It detects moisture, calculates purity, and visualizes the exact carbon offset of your harvest.
                    </p>
                    <ul className="features-list">
                      {['Instant ₹ Price Estimation', '3D Carbon Impact Visualizer', 'Moisture & Purity Detection'].map((item, i) => (
                          <li key={i} className="features-list-item">
                             <div className="features-list-icon">
                               <CheckCircle2 size={16} strokeWidth={3}/>
                             </div>
                             <span className="features-list-text">{item}</span>
                          </li>
                      ))}
                    </ul>
                </div>
             </div>
           </div>
        </section>

        {/* 2.5. WEATHER & CLIMATE PROBLEMS SECTION */}
        <section className="weather-section">
           <div className="weather-container">
             <div className="weather-grid">
                <div className="weather-content">
                    <div className="weather-badge">
                       <div className="weather-badge-icon">
                         <CloudRain size={18} />
                       </div>
                       <span className="weather-badge-text">Weather & Climate</span>
                    </div>
                    <h2 className="weather-title">
                       Unpredictable <br/><span className="weather-title-blue">Weather.</span>
                    </h2>
                    <p className="weather-description">
                      Climate change makes seasons unreliable. Sudden rainfall, droughts, and heat waves threaten your harvest. We help you stay ahead.
                    </p>
                    
                    {/* Problems Section */}
                    <div className="weather-problems">
                       <div className="weather-problems-header">
                          <AlertTriangle className="weather-problems-icon" size={20} />
                          <h3 className="weather-problems-title">Problems Farmers Face:</h3>
                       </div>
                       <ul className="weather-problems-list">
                          <li className="weather-problems-item">
                             <div className="weather-problems-item-icon">
                                <X size={14} strokeWidth={3} />
                             </div>
                             <span>Crop loss from extreme weather</span>
                          </li>
                          <li className="weather-problems-item">
                             <div className="weather-problems-item-icon">
                                <X size={14} strokeWidth={3} />
                             </div>
                             <span>Missed optimal sowing time</span>
                          </li>
                       </ul>
                    </div>

                    {/* Solutions Section */}
                    <div className="weather-solutions">
                       <div className="weather-solutions-header">
                          <CheckCircle2 className="weather-solutions-icon" size={20} />
                          <h3 className="weather-solutions-title">Website Can Solve:</h3>
                       </div>
                       <ul className="weather-solutions-list">
                          {[
                             { icon: <CloudRain size={18} />, text: 'Local weather alerts' },
                             { icon: <Calendar size={18} />, text: 'Sowing & harvesting date suggestions' },
                             { icon: <Droplets size={18} />, text: 'Rainfall-based advisories' }
                          ].map((item, i) => (
                              <li key={i} className="weather-solutions-item">
                                 <div className="weather-solutions-item-icon">
                                    {item.icon}
                                 </div>
                                 <span className="weather-solutions-item-text">{item.text}</span>
                              </li>
                          ))}
                       </ul>
                    </div>
                </div>
                <div className="weather-image">
                    <div className="weather-image-glow"></div>
                    <div className="weather-image-wrapper">
                      <img 
                          src="https://images.unsplash.com/photo-1593113598332-cd288d649433?auto=format&fit=crop&q=80&w=800" 
                          alt="Weather & Climate" 
                          className="weather-image-main"
                      />
                      <div className="weather-image-shimmer"></div>
                    </div>
                </div>
             </div>
           </div>
        </section>

        {/* 3. ROLE SELECTION */}
        <section id="roles" className="roles-section">
           <div className="roles-container">
                <div className="roles-header">
                   <div className="roles-header-content">
                     <h2 className="roles-title">Select Your Role</h2>
                     <div className="roles-title-underline"></div>
                   </div>
                   <p className="roles-subtitle">Enter the <span className="gradient-text">circular economy</span> ecosystem.</p>
                </div>

                <div className="roles-grid">
                   
                   {/* 1. FARMER */}
                   <EcologyCard variant="farmland" glowColor="#22c55e" className="role-card-ecology">
                     <button onClick={() => onLogin(UserRole.FARMER)} className="role-card-button">
                        <div className="role-card-icon role-card-icon-green">
                          <Sprout size={32} />
                        </div>
                        <h3 className="role-card-title gradient-text">Farmer</h3>
                        <p className="role-card-description">Scan waste, list crops, earn rewards.</p>
                     </button>
                   </EcologyCard>

                    {/* 2. BUYER */}
                   <EcologyCard variant="forest" glowColor="#3b82f6" className="role-card-ecology">
                     <button onClick={() => onLogin(UserRole.BUYER)} className="role-card-button">
                        <div className="role-card-icon role-card-icon-blue">
                          <Briefcase size={32} />
                        </div>
                        <h3 className="role-card-title gradient-text-blue">Buyer</h3>
                        <p className="role-card-description">Source biomass, track sustainable impact.</p>
                     </button>
                   </EcologyCard>

                   {/* 3. HOUSEHOLD */}
                   <EcologyCard variant="garden" glowColor="#f97316" className="role-card-ecology">
                     <button onClick={() => onLogin(UserRole.HOUSEHOLD)} className="role-card-button">
                        <div className="role-card-icon role-card-icon-orange">
                          <Home size={32} />
                        </div>
                        <h3 className="role-card-title role-card-title-orange">Household</h3>
                        <p className="role-card-description">Submit segregated waste for collection.</p>
                     </button>
                   </EcologyCard>

                   {/* 4. BIOGAS */}
                   <EcologyCard variant="energy" glowColor="#8b5cf6" className="role-card-ecology">
                     <button onClick={() => onLogin(UserRole.BIOGAS)} className="role-card-button">
                        <div className="role-card-icon role-card-icon-purple">
                          <Flame size={32} />
                        </div>
                        <h3 className="role-card-title role-card-title-purple">Biogas Co.</h3>
                        <p className="role-card-description">Procure organic waste for energy.</p>
                     </button>
                   </EcologyCard>

                    {/* 5. FARM PLANNER */}
                   <EcologyCard variant="harvest" glowColor="#14b8a6" className="role-card-ecology">
                     <button onClick={() => setShowPlannerModal(true)} className="role-card-button">
                        <div className="role-card-icon role-card-icon-teal">
                          <Calculator size={32} />
                        </div>
                        <h3 className="role-card-title role-card-title-teal">Farm Planner</h3>
                        <p className="role-card-description">Calculate yield & estimated revenue.</p>
                     </button>
                   </EcologyCard>

                   {/* 6. LEARNING HUB */}
                   <EcologyCard variant="forest" glowColor="#6366f1" className="role-card-ecology">
                     <button onClick={() => onLogin(UserRole.LEARNER)} className="role-card-button">
                        <div className="role-card-icon role-card-icon-indigo">
                          <BookOpen size={32} />
                        </div>
                        <h3 className="role-card-title role-card-title-indigo">Learning Hub</h3>
                        <p className="role-card-description">AI tips for Soil, Crop & Fertilizer.</p>
                     </button>
                   </EcologyCard>

                   {/* 7. MARKET */}
                   <EcologyCard variant="harvest" glowColor="#10b981" className="role-card-ecology">
                     <button onClick={() => onLogin('MARKET')} className="role-card-button">
                        <div className="role-card-icon role-card-icon-emerald">
                          <BarChart3 size={32} />
                        </div>
                        <h3 className="role-card-title role-card-title-emerald">Market</h3>
                        <p className="role-card-description">Live crop prices & market trends.</p>
                     </button>
                   </EcologyCard>

                   {/* 8. WEATHER */}
                   <EcologyCard variant="default" glowColor="#0ea5e9" className="role-card-ecology">
                     <button onClick={() => onLogin(UserRole.FARMER)} className="role-card-button">
                        <div className="role-card-icon role-card-icon-sky">
                          <CloudRain size={32} />
                        </div>
                        <h3 className="role-card-title role-card-title-sky">Weather</h3>
                        <p className="role-card-description">Climate alerts & farming advisories.</p>
                     </button>
                   </EcologyCard>

                   {/* 9. FERTILIZER GUIDE */}
                   <EcologyCard variant="farmland" glowColor="#f59e0b" className="role-card-ecology fertilizer-card-special">
                     <button onClick={() => setShowFertilizerModal(true)} className="role-card-button fertilizer-button">
                        <div className="fertilizer-card-content">
                           <div className="role-card-icon role-card-icon-amber">
                             <FlaskConical size={36} />
                           </div>
                           <div className="fertilizer-card-text">
                              <h3 className="fertilizer-card-title">Fertilizer Guide <span className="fertilizer-card-subtitle">(Public)</span></h3>
                              <p className="role-card-description">Compare Natural vs Chemical fertilizers and check crop suitability.</p>
                              <div className="fertilizer-card-tags">
                                <span className="fertilizer-tag fertilizer-tag-green">Natural</span>
                                <span className="fertilizer-tag fertilizer-tag-blue">Chemical</span>
                              </div>
                           </div>
                        </div>
                     </button>
                   </EcologyCard>

                </div>
           </div>
        </section>

      </div>

      {/* FERTILIZER MODAL */}
      {showFertilizerModal && (
        <div className="modal-overlay">
          <div className="modal-header">
             <h2 className="modal-title">Fertilizer Guide</h2>
             <button onClick={handleFertilizerClose} className="modal-close"><X size={24} /></button>
          </div>
          <div className="modal-content">
             {!selectedFertType ? (
               <div className="fertilizer-type-selection">
                  <h3 className="fertilizer-selection-title">Choose Fertilizer Type</h3>
                  <div className="fertilizer-type-grid">
                     <button onClick={() => setSelectedFertType('NATURAL')} className="fertilizer-type-card fertilizer-type-natural">
                        <Leaf size={32} />
                        <h4 className="fertilizer-type-title">Natural</h4>
                        <p className="fertilizer-type-description">Eco-friendly, sustainable.</p>
                     </button>
                     <button onClick={() => setSelectedFertType('CHEMICAL')} className="fertilizer-type-card fertilizer-type-chemical">
                        <FlaskConical size={32} />
                        <h4 className="fertilizer-type-title">Chemical</h4>
                        <p className="fertilizer-type-description">High yield, fast acting.</p>
                     </button>
                  </div>
               </div>
             ) : (
               <div>
                  <button onClick={() => setSelectedFertType(null)} className="back-button">← Back</button>
                  <div className="fertilizer-items-grid">
                     {FERTILIZER_DATA[selectedFertType].map((item, idx) => (
                        <div key={idx} className="fertilizer-item-card">
                           <div className="fertilizer-item-header">
                             <h4 className="fertilizer-item-title">{item.name}</h4>
                             {item.icon}
                           </div>
                           <p className="fertilizer-item-description">{item.description}</p>
                           <div className="fertilizer-item-crops">
                               {item.suitableCrops.map((c, i) => <span key={i} className="crop-tag">{c}</span>)}
                           </div>
                        </div>
                     ))}
                  </div>
               </div>
             )}
          </div>
        </div>
      )}

      {/* FARM PLANNER MODAL */}
      {showPlannerModal && (
        <div className="modal-overlay">
          <div className="modal-header">
              <h2 className="modal-title">Agricultural Planner</h2>
              <button onClick={() => setShowPlannerModal(false)} className="modal-close"><X size={24} /></button>
          </div>
          <div className="planner-modal-content">
              <FarmingGuideScreen />
          </div>
        </div>
      )}
    </div>
  );
};