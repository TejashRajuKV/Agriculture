import React from 'react';
import { Facebook, Twitter, Instagram, Youtube } from 'lucide-react';

export const Footer = () => {
  return (
    <footer className="gh-footer">
      <div className="gh-footer-links">
        <a href="#privacy">Privacy Policy</a>
        <span>|</span>
        <a href="#terms">Terms & Conditions</a>
      </div>
      
      <div className="gh-footer-social" style={{ display: 'flex', justifyContent: 'center', gap: '1rem', marginBottom: '1rem' }}>
        <a href="#"><Facebook size={20} /></a>
        <a href="#"><Twitter size={20} /></a>
        <a href="#"><Instagram size={20} /></a>
        <a href="#"><Youtube size={20} /></a>
      </div>
      
      <p>&copy; {new Date().getFullYear()} GreenHarvest. All rights reserved.</p>
    </footer>
  );
};
