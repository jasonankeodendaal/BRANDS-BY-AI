import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

// Register Service Worker for PWA with an auto-update strategy
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').then(registration => {
      console.log('ServiceWorker registration successful with scope: ', registration.scope);

      // This logic handles automatic updates.
      registration.onupdatefound = () => {
        const installingWorker = registration.installing;
        if (installingWorker) {
          installingWorker.onstatechange = () => {
            if (installingWorker.state === 'installed') {
              if (navigator.serviceWorker.controller) {
                // At this point, the old content is still being served.
                // A new service worker is waiting to take over.
                console.log('New content is available and will be used when all tabs for this page are closed. Forcing update...');
                // We can force the new service worker to take control.
                // The oncontrollerchange event will then trigger a page reload.
              } else {
                // At this point, everything has been precached.
                // It's the perfect time to display a "Content is cached for offline use." message.
                console.log('Content is cached for offline use.');
              }
            }
          };
        }
      };
    });

    // This event fires when the service worker controlling this page changes.
    // We reload the page to make sure we get the latest assets.
    navigator.serviceWorker.oncontrollerchange = () => {
      console.log('Controller changed. Reloading the page.');
      window.location.reload();
    };
  });
}


const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
