import React, { useEffect, useState } from 'react';
import './FarmlandTheme.css';

export const FarmlandTheme = ({ userRole, season = 'spring' }) => {
  const [particles, setParticles] = useState([]);

  useEffect(() => {
    // Generate nature particles based on role and season
    const generateParticles = () => {
      const particleCount = 15;
      const newParticles = [];

      for (let i = 0; i < particleCount; i++) {
        newParticles.push({
          id: i,
          type: getParticleType(userRole, season),
          left: Math.random() * 100,
          top: Math.random() * 100,
          delay: Math.random() * 10,
          duration: 8 + Math.random() * 12
        });
      }
      setParticles(newParticles);
    };

    generateParticles();
  }, [userRole, season]);

  const getParticleType = (role, season) => {
    const types = {
      farmer: ['wheat', 'corn', 'leaf', 'seed'],
      buyer: ['leaf', 'flower', 'seed'],
      household: ['leaf', 'flower', 'butterfly'],
      biogas: ['leaf', 'energy', 'recycle'],
      default: ['leaf', 'flower', 'seed']
    };

    const seasonTypes = {
      spring: ['flower', 'leaf', 'butterfly'],
      summer: ['wheat', 'corn', 'sun'],
      autumn: ['leaf', 'seed', 'harvest'],
      winter: ['snow', 'branch', 'pine']
    };

    const roleTypes = types[role] || types.default;
    const seasonalTypes = seasonTypes[season];
    
    return [...roleTypes, ...seasonalTypes][Math.floor(Math.random() * (roleTypes.length + seasonalTypes.length))];
  };

  const getThemeClass = () => {
    const roleThemes = {
      farmer: 'farmland-primary',
      buyer: 'industrial-green',
      household: 'garden-theme',
      biogas: 'eco-energy',
      market: 'harvest-theme'
    };
    return roleThemes[userRole] || 'farmland-primary';
  };

  return (
    <div className={`farmland-theme ${getThemeClass()} season-${season}`}>
      {/* Animated Background Layers */}
      <div className="farmland-bg-layer layer-1">
        <div className="field-rows"></div>
      </div>
      
      <div className="farmland-bg-layer layer-2">
        <div className="crop-silhouettes"></div>
      </div>

      <div className="farmland-bg-layer layer-3">
        <div className="sky-gradient"></div>
      </div>

      {/* Floating Nature Particles */}
      <div className="nature-particles">
        {particles.map(particle => (
          <div
            key={particle.id}
            className={`nature-particle particle-${particle.type}`}
            style={{
              left: `${particle.left}%`,
              top: `${particle.top}%`,
              animationDelay: `${particle.delay}s`,
              animationDuration: `${particle.duration}s`
            }}
          />
        ))}
      </div>

      {/* Seasonal Weather Effects */}
      {season === 'spring' && <div className="spring-rain"></div>}
      {season === 'summer' && <div className="summer-heat"></div>}
      {season === 'autumn' && <div className="autumn-leaves"></div>}
      {season === 'winter' && <div className="winter-snow"></div>}

      {/* Growing Plants Animation */}
      <div className="growing-plants">
        <div className="plant plant-1"></div>
        <div className="plant plant-2"></div>
        <div className="plant plant-3"></div>
      </div>
    </div>
  );
};