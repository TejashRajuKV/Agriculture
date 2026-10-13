import React, { useEffect, useRef, useState } from 'react';
import './TargetCursor.css';

export const TargetCursor = ({
  hideDefaultCursor = true,
  parallaxOn = true,
}) => {
  const cursorRef = useRef(null);
  const outerRef = useRef(null);
  const [isVisible, setIsVisible] = useState(false);
  
  useEffect(() => {
    if (hideDefaultCursor) {
      document.body.style.cursor = 'none';
      const style = document.createElement('style');
      style.id = 'cursor-style';
      style.innerHTML = `
        *, *::before, *::after { cursor: none !important; }
        input, textarea, select { cursor: text !important; }
      `;
      document.head.appendChild(style);
    }

    return () => {
      if (hideDefaultCursor) {
        document.body.style.cursor = 'auto';
        const style = document.getElementById('cursor-style');
        if (style) style.remove();
      }
    };
  }, [hideDefaultCursor]);

  useEffect(() => {
    let requestRef;
    let mouseX = window.innerWidth / 2;
    let mouseY = window.innerHeight / 2;
    let outerX = window.innerWidth / 2;
    let outerY = window.innerHeight / 2;

    const onMouseMove = (e) => {
      mouseX = e.clientX;
      mouseY = e.clientY;
      setIsVisible(true);
      
      if (cursorRef.current) {
        cursorRef.current.style.left = `${mouseX}px`;
        cursorRef.current.style.top = `${mouseY}px`;
      }
    };

    const onMouseLeave = () => {
      setIsVisible(false);
    };

    const animate = () => {
      if (parallaxOn) {
        outerX += (mouseX - outerX) * 0.15;
        outerY += (mouseY - outerY) * 0.15;
      } else {
        outerX = mouseX;
        outerY = mouseY;
      }

      if (outerRef.current) {
        outerRef.current.style.left = `${outerX}px`;
        outerRef.current.style.top = `${outerY}px`;
      }

      requestRef = requestAnimationFrame(animate);
    };

    const handleMouseOver = (e) => {
      const target = e.target;
      const isInteractive = target.closest('.cursor-target') || 
                            target.tagName === 'BUTTON' || 
                            target.tagName === 'A' || 
                            target.tagName === 'INPUT' ||
                            target.tagName === 'TEXTAREA' ||
                            target.closest('button') ||
                            target.closest('a') ||
                            target.closest('[role="button"]');

      if (isInteractive && outerRef.current && cursorRef.current) {
        outerRef.current.style.transform = 'translate(-50%, -50%) scale(1.6)';
        outerRef.current.style.backgroundColor = 'rgba(15, 97, 75, 0.12)';
        outerRef.current.style.borderColor = 'rgba(15, 97, 75, 0.5)';
        cursorRef.current.style.transform = 'translate(-50%, -50%) scale(0.3)';
      } else if (outerRef.current && cursorRef.current) {
        outerRef.current.style.transform = 'translate(-50%, -50%) scale(1)';
        outerRef.current.style.backgroundColor = 'rgba(15, 97, 75, 0.05)';
        outerRef.current.style.borderColor = 'rgba(15, 97, 75, 0.25)';
        cursorRef.current.style.transform = 'translate(-50%, -50%) scale(1)';
      }
    };

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseleave', onMouseLeave);
    document.addEventListener('mouseover', handleMouseOver);
    requestRef = requestAnimationFrame(animate);

    return () => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseleave', onMouseLeave);
      document.removeEventListener('mouseover', handleMouseOver);
      cancelAnimationFrame(requestRef);
    };
  }, [parallaxOn]);

  return (
    <div style={{ pointerEvents: 'none', zIndex: 99999, position: 'fixed', top: 0, left: 0, width: '100%', height: '100%' }}>
      <div 
        ref={cursorRef} 
        className="cursor-inner"
        style={{ opacity: isVisible ? 1 : 0 }}
      />
      <div 
        ref={outerRef} 
        className="cursor-outer"
        style={{ opacity: isVisible ? 1 : 0 }}
      />
    </div>
  );
};