import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@mantine/core/styles.css';
import { MantineProvider } from '@mantine/core';
import { theme } from './theme';
import App from './App';

/**
 * No caching on this site. On every load, drop anything a browser may still hold for it:
 * service workers, Cache Storage, and the saved colour scheme from older builds.
 */
function clearBrowserCaches() {
  try {
    navigator.serviceWorker
      ?.getRegistrations()
      .then((regs) => regs.forEach((r) => void r.unregister()))
      .catch(() => {});
    if ('caches' in window) {
      caches
        .keys()
        .then((keys) => keys.forEach((k) => void caches.delete(k)))
        .catch(() => {});
    }
    localStorage.removeItem('mantine-color-scheme-value');
  } catch {
    // Storage blocked (e.g. private mode): nothing to clear.
  }
}
clearBrowserCaches();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {/* Always light, whatever the system theme; there is no dark mode. */}
    <MantineProvider theme={theme} forceColorScheme="light">
      <App />
    </MantineProvider>
  </StrictMode>,
);
