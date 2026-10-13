import React, { useState, useRef, useEffect } from 'react';
import './EcologyCard.css';

export const EcologyCard = ({ 
  children, 
  variant = 'default', 
  glowColor = '#22c55e',
  interactive = true,
  growOnHover = true,
  className = ''
}) => {
  const [isHovered, setIsHovered] = useState(false);
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
  const cardRef = useRef(null);

  useEffect(() => {
    const handleMouseMove = (e) => {
      if (!cardRef.current) return;
      
      const rect = cardRef.current.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width) * 100;
      const y = ((e.clientY - rect.top) / rect.height) * 100;
      
      setMousePosition({ x, y });
    };

    if (interactive && isHovered) {
      document.addEventListener('mousemove', handleMouseMove);
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
    };
  }, [interactive, isHovered]);

  const getVariantClass = () => {
    const variants = {
      default: 'ecology-card-default',
      farmland: 'ecology-card-farmland',
      forest: 'ecology-card-forest',
      garden: 'ecology-card-garden',
      harvest: 'ecology-card-harvest',
      energy: 'ecology-card-energy'
    };
    return variants[variant] || variants.default;
  };

  return (
    <div
      ref={cardRef}
      className={`ecology-card ${getVariantClass()} ${interactive ? 'interactive' : ''} ${growOnHover ? 'grow-hover' : ''} ${className}`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{
        '--glow-color': glowColor,
        '--mouse-x': `${mousePosition.x}%`,
        '--mouse-y': `${mousePosition.y}%`
      }}
    >
      {/* Nature Background Pattern */}
      <div className="ecology-bg-pattern"></div>
      
      {/* Animated Glow Effect */}
      <div className="ecology-glow-effect"></div>
      
      {/* Growing Border */}
      <div className="ecology-border-grow"></div>
      
      {/* Floating Nature Elements */}
      <div className="ecology-floating-elements">
        <div className="floating-leaf leaf-1"></div>
        <div className="floating-leaf leaf-2"></div>
        <div className="floating-seed seed-1"></div>
      </div>
      
      {/* Mouse Follow Effect */}
      {interactive && isHovered && (
        <div 
          className="ecology-mouse-effect"
          style={{
            left: `${mousePosition.x}%`,
            top: `${mousePosition.y}%`
          }}
        />
      )}
      
      {/* Content */}
      <div className="ecology-card-content">
        {children}
      </div>
      
      {/* Ripple Effect on Click */}
      <div className="ecology-ripple-container"></div>
    </div>
  );
};