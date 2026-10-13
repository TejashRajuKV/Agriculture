import React from 'react';

export const NewsletterSection = () => {
  return (
    <section className="gh-newsletter">
      <h2>Join Our Newsletter</h2>
      <p>Stay updated with the latest news & tips.</p>
      
      <form className="gh-newsletter-form" onSubmit={(e) => e.preventDefault()}>
        <input type="email" placeholder="Enter your email..." className="gh-input" required />
        <button type="submit" className="gh-btn-sub">Subscribe</button>
      </form>
      
      {/* Decorative farm elements could be added here via CSS or SVG */}
    </section>
  );
};
