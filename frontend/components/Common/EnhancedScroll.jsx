import { useEffect, useRef } from 'react';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

export const EnhancedScrollWrapper = ({ children, className = '' }) => {
  const wrapperRef = useRef();

  useEffect(() => {
    // Simple smooth scrolling
    document.documentElement.style.scrollBehavior = 'smooth';
    document.body.style.overflowX = 'hidden';
    
    // Minimal scroll animations
    gsap.utils.toArray('section').forEach((section) => {
      gsap.set(section, { opacity: 1, y: 0 });
    });

    return () => {
      ScrollTrigger.getAll().forEach(trigger => trigger.kill());
    };
  }, []);

  return (
    <div ref={wrapperRef} className={`enhanced-scroll-wrapper ${className}`}>
      {children}
    </div>
  );
};

// Agricultural Loading Animation
export const AgriLoader = ({ isLoading }) => {
  const loaderRef = useRef();

  useEffect(() => {
    if (isLoading) {
      const tl = gsap.timeline({ repeat: -1 });
      
      tl.to('.seed', {
        duration: 0.5,
        scale: 1.2,
        backgroundColor: '#22c55e',
        ease: 'power2.inOut'
      })
      .to('.seed', {
        duration: 0.5,
        scale: 1,
        backgroundColor: '#a16207',
        ease: 'power2.inOut'
      })
      .to('.sprout', {
        duration: 1,
        height: '20px',
        opacity: 1,
        ease: 'back.out(1.7)'
      }, '-=0.5')
      .to('.sprout', {
        duration: 0.5,
        height: '0px',
        opacity: 0,
        ease: 'power2.in'
      });
    }
  }, [isLoading]);

  if (!isLoading) return null;

  return (
    <div ref={loaderRef} className="agri-loader">
      <div className="seed"></div>
      <div className="sprout"></div>
      <p>Growing your experience...</p>
    </div>
  );
};