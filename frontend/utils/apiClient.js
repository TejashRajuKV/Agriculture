// Thin fetch wrapper for the AgriLoop API (reached through the Vite /api proxy).
// Adds the login token, turns error responses into readable ApiError messages,
// and signs the user out if the server says the token is no longer valid.

const TOKEN_KEY = 'agriloop_token';

export class ApiError extends Error {
  constructor(message, status, details) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

// localStorage can be unavailable (private mode, blocked storage) - never crash on it
export const getToken = () => {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
};

export const setToken = (token) => {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else {
      localStorage.removeItem(TOKEN_KEY);
      // Saved offline copies belong to the person who just left (shared phones)
      Object.keys(localStorage).filter((k) => k.startsWith('agriloop_cache:')).forEach((k) => localStorage.removeItem(k));
    }
  } catch {
    /* session will just not survive a reload */
  }
};

let onUnauthorized = null;
export const setUnauthorizedHandler = (fn) => {
  onUnauthorized = fn;
};

export const api = async (path, { method = 'GET', body, signal } = {}) => {
  const token = getToken();
  let res;
  try {
    res = await fetch(`/api${path}`, {
      method,
      signal,
      headers: {
        ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {})
      },
      body: body !== undefined ? JSON.stringify(body) : undefined
    });
  } catch (err) {
    if (err.name === 'AbortError') throw err;
    throw new ApiError('Cannot reach the AgriLoop server. Check your internet connection and try again.', 0);
  }

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    if (res.status === 401 && token && onUnauthorized) onUnauthorized();
    const detail = Array.isArray(data.details) ? ` (${data.details.join(', ')})` : '';
    throw new ApiError((data.error || 'Something went wrong. Please try again.') + detail, res.status, data.details);
  }
  return data;
};

// Query-string helper that drops empty values
export const qs = (params = {}) => {
  const entries = Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== '');
  return entries.length ? `?${new URLSearchParams(entries).toString()}` : '';
};
