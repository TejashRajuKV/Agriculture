import React, { useLayoutEffect, useRef } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

const SERVICES = [
  {
    title: 'Smart Farming',
    desc: 'Leverage AI and IoT solutions to maximize crop yield and minimize resource wastage.',
    img: 'https://images.unsplash.com/photo-1625246333195-78d9c38ad449?auto=format&fit=crop&q=80&w=800'
  },
  {
    title: 'Waste Management',
    desc: 'Turn agricultural waste into profitable bio-products through our marketplace.',
    img: 'https://images.unsplash.com/photo-1615811361523-6bd03c7799a4?auto=format&fit=crop&q=80&w=800'
  },
  {
    title: 'Expert Consulting',
    desc: 'Connect with top agricultural experts for personalized advice and strategies.',
    img: 'https://images.unsplash.com/photo-1464226184884-fa280b87c399?auto=format&fit=crop&q=80&w=800'
  }
];

export const ServicesSection = () => {
  const sectionRef = useRef(null);
  const titleRef = useRef(null);
  const cardsRef = useRef([]);

  useLayoutEffect(() => {
    const ctx = gsap.context(() => {
      // Title Animation
      gsap.from(titleRef.current, {
        scrollTrigger: {
          trigger: sectionRef.current,
          start: 'top 80%',
        },
        y: 30,
        opacity: 0,
        duration: 0.8,
        ease: 'power2.out'
      });

      // Cards Animation
      gsap.from(cardsRef.current, {
        scrollTrigger: {
          trigger: sectionRef.current,
          start: 'top 70%',
        },
        y: 50,
        opacity: 0,
        stagger: 0.2,
        duration: 0.8,
        ease: 'power2.out'
      });

    }, sectionRef);

    return () => ctx.revert();
  }, []);

  return (
    <section className="gh-services" id="services" ref={sectionRef}>
      <h2 className="gh-section-title" ref={titleRef}>Our Services</h2>
      <div className="gh-cards-grid">
        {SERVICES.map((s, i) => (
          <div className="gh-card" key={i} ref={el => cardsRef.current[i] = el}>
            <div className="gh-card-img" style={{ backgroundImage: `url(${s.img})` }}></div>
            <div className="gh-card-content">
              <h3>{s.title}</h3>
              <p>{s.desc}</p>
              <button className="fluent-btn fluent-btn-secondary" style={{ width: '100%', marginTop: 'auto' }}>
                Learn More
              </button>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
};
