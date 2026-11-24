import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import 'leaflet/dist/leaflet.css';
import {registerSW} from 'virtual:pwa-register';
import {isNativeCapacitorApk} from './services/appOriginService.ts';

// Register PWA service worker on web browsers (skip inside native Capacitor APK WebView)
if (!isNativeCapacitorApk()) {
  registerSW({
    immediate: true,
    onRegisteredSW(_swUrl, registration) {
      if (!registration) return;
      window.setInterval(() => {
        void registration.update().catch(() => {});
      }, 60 * 60 * 1000);
    },
  });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
