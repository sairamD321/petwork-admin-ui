import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@mantine/core/styles.css';
import { MantineProvider, type MantineColorSchemeManager } from '@mantine/core';
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

/** Light/dark choice lives in memory only: it lasts until the page reloads and is never stored. */
function memoryColorSchemeManager(): MantineColorSchemeManager {
  let value: ReturnType<MantineColorSchemeManager['get']> | undefined;
  return {
    get: (defaultValue) => value ?? defaultValue,
    set: (next) => {
      value = next;
    },
    subscribe: () => {},
    unsubscribe: () => {},
    clear: () => {
      value = undefined;
    },
  };
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <MantineProvider theme={theme} defaultColorScheme="auto" colorSchemeManager={memoryColorSchemeManager()}>
      <App />
    </MantineProvider>
  </StrictMode>,
);
