import React from 'react';
import './Landing.css';
import { FarmlandTheme } from '../Common/FarmlandTheme';
import { HeroSection } from './HeroSection';
import { ServicesSection } from './ServicesSection';
import { BlogSection } from './BlogSection';
import { NewsletterSection } from './NewsletterSection';
import { Footer } from './Footer';
import { Sprout } from 'lucide-react';

export const LandingPage = ({ onGetStarted }) => {
  // debug marker to confirm LandingPage renders
  if (typeof window !== 'undefined') console.log('LandingPage: rendered (with-farmland)');
  return (
    <div className="gh-container with-farmland">
      <FarmlandTheme userRole="farmer" season="spring" />
      <div className="landing-debug-badge">Farmland Theme Active</div>
      <header className="gh-header">
        <div className="gh-logo">
          <Sprout size={32} color="#16a34a" />
          <span>AgriLoop</span>
          <span className="logo-subtitle">किसान का साथी</span>
        </div>
        <nav className="gh-nav">
          <a href="#home">Home</a>
          <a href="#about">About Us</a>
          <a href="#services">Our Services</a>
          <a href="#blog">Blog</a>
          <a href="#contact">Contact</a>
          <button className="gh-btn-primary" onClick={onGetStarted}>Get Started</button>
        </nav>
      </header>

      <HeroSection onLearnMore={onGetStarted} />
      <ServicesSection />
      <BlogSection />
      <NewsletterSection />
      <Footer />
    </div>
  );
};
