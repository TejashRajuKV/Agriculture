import { useEffect, useRef } from 'react';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

// Agricultural GSAP Animation Hook - Optimized
export const useAgriAnimations = () => {
  useEffect(() => {
    // Reduce animations on mobile
    const isMobile = window.innerWidth < 768;
    if (isMobile) return;

    // Simple hero animations only
    gsap.set(['.hero-badge', '.hero-title', '.hero-description'], { opacity: 1 });
    
    const tl = gsap.timeline();
    tl.from('.hero-badge', { duration: 0.8, y: 20, ease: 'power2.out' })
      .from('.hero-title', { duration: 0.8, y: 30, ease: 'power2.out' }, '-=0.6')
      .from('.hero-description', { duration: 0.8, y: 20, ease: 'power2.out' }, '-=0.6');

    // Reduce particle animations
    gsap.to('.particle', {
      duration: 12,
      y: -50,
      ease: 'none',
      repeat: -1,
      stagger: 2
    });

    return () => {
      ScrollTrigger.getAll().forEach(trigger => trigger.kill());
    };
  }, []);
};

// Agricultural Hover Animations - Simplified
export const AgriHoverCard = ({ children, className = '' }) => {
  const cardRef = useRef();

  useEffect(() => {
    const card = cardRef.current;
    if (window.innerWidth < 768) return; // Skip on mobile
    
    const handleMouseEnter = () => {
      gsap.to(card, {
        duration: 0.3,
        y: -8,
        scale: 1.02,
        ease: 'power2.out'
      });
    };

    const handleMouseLeave = () => {
      gsap.to(card, {
        duration: 0.3,
        y: 0,
        scale: 1,
        ease: 'power2.out'
      });
    };

    card.addEventListener('mouseenter', handleMouseEnter);
    card.addEventListener('mouseleave', handleMouseLeave);

    return () => {
      card.removeEventListener('mouseenter', handleMouseEnter);
      card.removeEventListener('mouseleave', handleMouseLeave);
    };
  }, []);

  return (
    <div ref={cardRef} className={`agri-hover-card ${className}`}>
      {children}
    </div>
  );
};

// Floating Agricultural Elements - Reduced
export const FloatingElements = () => {
  const containerRef = useRef();

  useEffect(() => {
    if (window.innerWidth < 768) return; // Skip on mobile
    
    const container = containerRef.current;
    
    // Create only 5 floating leaves (reduced from 15)
    for (let i = 0; i < 5; i++) {
      const leaf = document.createElement('div');
      leaf.className = 'floating-leaf';
      leaf.style.left = Math.random() * 100 + '%';
      leaf.style.top = Math.random() * 100 + '%';
      container.appendChild(leaf);

      gsap.to(leaf, {
        duration: 15 + Math.random() * 5, // Slower animation
        y: -100,
        x: Math.random() * 50 - 25,
        rotation: 180,
        opacity: 0,
        ease: 'none',
        repeat: -1,
        delay: Math.random() * 10
      });
    }

    return () => {
      container.innerHTML = '';
    };
  }, []);

  return <div ref={containerRef} className="floating-elements" />;
};

// Text Animation Component - Simplified
export const AnimatedText = ({ children, className = '', delay = 0 }) => {
  const textRef = useRef();

  useEffect(() => {
    const text = textRef.current;
    
    // Simple fade in animation instead of complex char animation
    gsap.fromTo(text, {
      opacity: 0,
      y: 30
    }, {
      opacity: 1,
      y: 0,
      duration: 1,
      ease: 'power2.out',
      delay: delay
    });
  }, [delay]);

  return (
    <div ref={textRef} className={`animated-text ${className}`}>
      {children}
    </div>
  );
};