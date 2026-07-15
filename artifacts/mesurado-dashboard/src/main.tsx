import { createRoot } from 'react-dom/client';

import App from './App';

import './index.css';

createRoot(document.getElementById('root')!).render(<App />);

// Register the PWA service worker (installability signal for "Add to Home
// Screen" / install prompts). Skipped in dev to avoid caching interference
// with Vite's HMR.
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {
      // Installability is a progressive enhancement — never block the app.
    });
  });
}
