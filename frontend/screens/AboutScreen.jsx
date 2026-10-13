import React from 'react';
import { Sprout, Globe2, Recycle } from 'lucide-react';
import './AboutScreen.css';

export const AboutScreen = () => {
  return (
    <div className="about-container">
      <div className="about-header">
        <h1 className="about-title">
          <Sprout size={32} />
          About AgriLoop 2.0
        </h1>
        <p className="about-subtitle">
          AgriLoop 2.0 is a digital platform that converts agricultural and household waste
          into new value by connecting farmers, households, and bio-energy buyers.
        </p>
      </div>

      <div className="about-grid">
        <div className="about-card">
          <div className="about-icon about-icon-green">
            <Recycle size={22} />
          </div>
          <h2 className="about-card-title">Why AgriLoop?</h2>
          <p className="about-card-text">
            Crop residue burning and unmanaged organic waste create serious air pollution
            and climate impact. AgriLoop helps turn that waste into income and clean energy
            instead of smoke.
          </p>
        </div>

        <div className="about-card">
          <div className="about-icon about-icon-emerald">
            <Globe2 size={22} />
          </div>
          <h2 className="about-card-title">Who is it for?</h2>
          <p className="about-card-text">
            Farmers, households, and biogas / biofuel plants. Farmers and households can
            list their waste, while buyers can discover quality-assured feedstock nearby.
          </p>
        </div>

        <div className="about-card">
          <div className="about-icon about-icon-lime">
            <Sprout size={22} />
          </div>
          <h2 className="about-card-title">What can you do?</h2>
          <ul className="about-list">
            <li>Scan waste and create instant marketplace listings</li>
            <li>Track carbon points and rewards for green actions</li>
            <li>Access learning content for climate-smart farming</li>
          </ul>
        </div>
      </div>

      <div className="about-vision">
        <h2 className="about-vision-title">Vision</h2>
        <p className="about-vision-text">
          Our vision is to build a circular bioeconomy where every kilogram of agricultural
          or household organic waste is traceable, fairly priced, and converted into
          productive value—benefiting farmers, rural communities, and the climate.
        </p>
      </div>
    </div>
  );
};