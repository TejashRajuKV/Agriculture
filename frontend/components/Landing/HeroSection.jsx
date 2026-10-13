import React, { useLayoutEffect, useRef } from 'react';
import gsap from 'gsap';

export const HeroSection = ({ onLearnMore }) => {
  const heroRef = useRef(null);
  const titleRef = useRef(null);
  const subtitleRef = useRef(null);
  const statsRef = useRef(null);
  const btnRef = useRef(null);

  useLayoutEffect(() => {
    const ctx = gsap.context(() => {
      const tl = gsap.timeline({ defaults: { ease: 'power3.out', duration: 1 } });

      tl.from(titleRef.current, {
        y: 50,
        opacity: 0,
        duration: 1.2
      })
      .from(subtitleRef.current, {
        y: 30,
        opacity: 0,
        duration: 1
      }, '-=0.8')
      .from(statsRef.current.children, {
        y: 30,
        opacity: 0,
        stagger: 0.1,
        duration: 0.8
      }, '-=0.6')
      .from(btnRef.current, {
        scale: 0.9,
        opacity: 0,
        duration: 0.8
      }, '-=0.6');

    }, heroRef);

    return () => ctx.revert();
  }, []);

  return (
    <section className="gh-hero" id="home" ref={heroRef}>
      <div className="gh-hero-content">
        <h1 ref={titleRef}>
          Transform Waste <span className="highlight">into Wealth</span><br />
          for 146M Farmers
        </h1>
        <p ref={subtitleRef}>
          AgriLoop is the AI-powered platform turning ₹1.2 lakh crore crop residue into sustainable income. 
          Stop burning, start earning <strong style={{ color: 'var(--fluent-brand)' }}>₹7,000+ per acre</strong>.
        </p>
        
        <div className="hero-stats" ref={statsRef}>
          <div className="stat-item">
            <span className="stat-number">₹50,000 Cr</span>
            <span className="stat-label">Market Opportunity</span>
          </div>
          <div className="stat-item">
            <span className="stat-number">146M</span>
            <span className="stat-label">Farmers Served</span>
          </div>
          <div className="stat-item">
            <span className="stat-number">95%+</span>
            <span className="stat-label">AI Accuracy</span>
          </div>
        </div>

        <button className="gh-hero-btn" onClick={onLearnMore} ref={btnRef}>
          Start Your Journey
        </button>
      </div>
    </section>
  );
};
