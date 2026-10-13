import React, { useRef, useLayoutEffect } from 'react';
import { gsap } from 'gsap';
import Lenis from 'lenis';
import './Scroll3DWrapper.css';

/**
 * Wrapper component that adds 3D scroll animations to any scrollable content
 * Uses GSAP and Lenis for smooth 3D transforms based on scroll position
 */
export const Scroll3DWrapper = ({
  children,
  className = '',
  enable3D = true,
  intensity = 0.4
}) => {
  const wrapperRef = useRef(null);
  const lenisRef = useRef(null);
  const rafRef = useRef(null);
  const elementsRef = useRef([]);

  useLayoutEffect(() => {
    if (!enable3D) return;

    // Setup Lenis for smooth scrolling on window
    const lenis = new Lenis({
      duration: 1.2,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      smoothWheel: true,
      touchMultiplier: 2,
      infinite: false,
      wheelMultiplier: 1,
      lerp: 0.1,
      syncTouch: true,
      syncTouchLerp: 0.075
    });

    lenisRef.current = lenis;

    // Find all sections/cards to animate
    const updateElements = () => {
      if (!wrapperRef.current) return;
      
      elementsRef.current = Array.from(
        wrapperRef.current.querySelectorAll('section, [class*="card"], [class*="Card"], [data-3d-scroll], .bg-white, .rounded-3xl, .rounded-2xl')
      ).filter((el, index, self) => {
        // Remove duplicates and only get direct children or important elements
        return self.indexOf(el) === index && 
               (el.offsetHeight > 50 || el.hasAttribute('data-3d-scroll'));
      });
      
      elementsRef.current.forEach((el) => {
        el.style.transformStyle = 'preserve-3d';
        el.style.willChange = 'transform';
        el.style.backfaceVisibility = 'hidden';
        el.style.WebkitBackfaceVisibility = 'hidden';
      });
    };

    // Initial update
    setTimeout(updateElements, 100);

    // Observer for dynamic content
    const observer = new MutationObserver(() => {
      setTimeout(updateElements, 50);
    });
    
    if (wrapperRef.current) {
      observer.observe(wrapperRef.current, {
        childList: true,
        subtree: true
      });
    }

    // Animation loop
    const animate = (time) => {
      lenis.raf(time);

      if (elementsRef.current.length > 0) {
        const scrollY = window.scrollY || lenis.scroll;
        const viewportHeight = window.innerHeight;
        const viewportCenter = scrollY + viewportHeight / 2;

        elementsRef.current.forEach((el) => {
          const rect = el.getBoundingClientRect();
          const elementTop = rect.top + scrollY;
          const elementCenter = elementTop + rect.height / 2;
          const distanceFromCenter = (elementCenter - viewportCenter) / viewportHeight;
          
          // Only animate elements in or near viewport
          const isInViewport = rect.top < viewportHeight && rect.bottom > 0;
          
          if (isInViewport || Math.abs(distanceFromCenter) < 2) {
            // Calculate 3D transforms based on position
            const rotateX = -distanceFromCenter * 8 * intensity;
            const rotateY = Math.sin(distanceFromCenter * Math.PI) * 3 * intensity;
            const translateZ = Math.abs(distanceFromCenter) < 1 
              ? Math.cos(distanceFromCenter * Math.PI / 2) * 80 * intensity 
              : 0;
            const opacity = Math.abs(distanceFromCenter) < 1.5 ? 1 : 0.7;

            // Apply transforms with GSAP
            gsap.to(el, {
              rotationX: rotateX,
              rotationY: rotateY,
              z: translateZ,
              opacity: opacity,
              transformPerspective: 1200,
              force3D: true,
              duration: 0.5,
              ease: 'power2.out'
            });
          } else {
            // Reset elements far from viewport
            gsap.to(el, {
              rotationX: 0,
              rotationY: 0,
              z: 0,
              opacity: 0.5,
              duration: 0.3
            });
          }
        });
      }

      rafRef.current = requestAnimationFrame(animate);
    };

    rafRef.current = requestAnimationFrame(animate);

    // Also handle window scroll for better compatibility
    const handleScroll = () => {
      // Scroll is handled by Lenis in the animation loop
    };

    window.addEventListener('scroll', handleScroll, { passive: true });

    return () => {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
      }
      if (lenisRef.current) {
        lenisRef.current.destroy();
      }
      observer.disconnect();
      window.removeEventListener('scroll', handleScroll);
    };
  }, [enable3D, intensity]);

  return (
    <div 
      ref={wrapperRef}
      className={`scroll-3d-wrapper ${className}`}
      style={{
        perspective: '1200px',
        perspectiveOrigin: 'center center',
        transformStyle: 'preserve-3d'
      }}
    >
      {children}
    </div>
  );
};