import { useCallback, useEffect, useRef, useState } from 'react';
import { getToken } from './apiClient.js';

// Offline copies of the last good answer, kept on this phone per signed-in user.
// Cleared on logout (see setToken). Storage can be unavailable, so every access is guarded.
const cacheName = (key) => `agriloop_cache:${(getToken() || 'anon').slice(-12)}:${key}`;
const readCache = (key) => {
  try {
    return JSON.parse(localStorage.getItem(cacheName(key)) || 'null');
  } catch {
    return null;
  }
};
const writeCache = (key, data) => {
  try {
    localStorage.setItem(cacheName(key), JSON.stringify({ at: Date.now(), data }));
  } catch { /* full or blocked: just no offline copy */ }
};

// Load data from the API with loading / error / reload handling.
// `pollMs` keeps it fresh (paused while the tab is hidden) - used for live queues.
// `cacheKey` keeps an offline copy: if the server cannot be reached, the saved answer is shown with `savedAt`.
export const useApi = (loader, deps = [], { pollMs, cacheKey } = {}) => {
  const [state, setState] = useState({ data: null, error: null, loading: true, savedAt: null });
  const loaderRef = useRef(loader);
  loaderRef.current = loader;

  const load = useCallback(async ({ quiet = false } = {}) => {
    if (!quiet) setState((s) => ({ ...s, loading: true, error: null }));
    try {
      const data = await loaderRef.current();
      if (cacheKey) writeCache(cacheKey, data);
      setState({ data, error: null, loading: false, savedAt: null });
      return data;
    } catch (error) {
      const saved = cacheKey && error?.status === 0 ? readCache(cacheKey) : null;
      if (saved) {
        setState({ data: saved.data, error: null, loading: false, savedAt: saved.at });
        return saved.data;
      }
      // Keep showing the last good data during a background refresh hiccup
      setState((s) => ({ ...s, data: quiet ? s.data : null, error: quiet && s.data ? s.error : error, loading: false }));
      return null;
    }
  }, []);

  useEffect(() => {
    load();
    if (!pollMs) return undefined;
    const id = setInterval(() => {
      if (!document.hidden) load({ quiet: true });
    }, pollMs);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  const setData = useCallback((updater) => setState((s) => ({ ...s, data: typeof updater === 'function' ? updater(s.data) : updater })), []);
  return { ...state, reload: load, setData };
};

// Run an action (button press) with a busy flag and error capture
export const useAction = () => {
  const [busy, setBusy] = useState(false);
  const run = useCallback(async (fn) => {
    setBusy(true);
    try {
      return await fn();
    } finally {
      setBusy(false);
    }
  }, []);
  return [busy, run];
};
