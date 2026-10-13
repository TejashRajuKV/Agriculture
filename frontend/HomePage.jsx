import React, { useMemo, useState } from 'react';
import ReactDOM from 'react-dom/client';
import MainApp from './MainApp.jsx';
import './ModernStyles.css';
import { Landing3D } from './components/Landing/Landing3D.jsx';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);

root.render(
  <React.StrictMode>
    <MainApp />
  </React.StrictMode>
);
// Offline shell (production builds only, so the dev server is never cached)
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('/sw.js').catch(() => {}));
}
