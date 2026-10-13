import React from 'react';

const POSTS = [
  {
    title: 'Sustainable Crop Rotation',
    date: 'April 12, 2023',
    img: 'https://images.unsplash.com/photo-1500937386664-56d1dfef3854?auto=format&fit=crop&q=80&w=800'
  },
  {
    title: 'Organic Pest Control',
    date: 'March 28, 2023',
    img: 'https://images.unsplash.com/photo-1574943320219-553eb213f72d?auto=format&fit=crop&q=80&w=800'
  },
  {
    title: 'Future of Agri-Tech',
    date: 'March 15, 2023',
    img: 'https://images.unsplash.com/photo-1530836369250-ef72a3f5cda8?auto=format&fit=crop&q=80&w=800'
  }
];

export const BlogSection = () => {
  return (
    <section className="gh-blog" id="blog">
      <h2 className="gh-section-title">Latest from Our Blog</h2>
      <div className="gh-blog-grid">
        {POSTS.map((p, i) => (
          <div className="gh-blog-card" key={i}>
            <div className="gh-blog-img" style={{ backgroundImage: `url(${p.img})` }}></div>
            <div className="gh-blog-content">
              <span className="gh-blog-date">{p.date}</span>
              <h3>{p.title}</h3>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
};
