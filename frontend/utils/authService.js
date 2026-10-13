import { api, setToken, getToken } from './apiClient.js';

// Server-backed accounts (replaces the old localStorage user store in database.js)
export const login = async (email, password) => {
  const { user, token } = await api('/auth/login', { method: 'POST', body: { email, password } });
  setToken(token);
  return user;
};

// Phone + SMS code login, for people who do not use email
export const requestOtp = (phone) => api('/auth/otp/request', { method: 'POST', body: { phone } });
export const verifyOtp = async (phone, code) => {
  const { user, token } = await api('/auth/otp/verify', { method: 'POST', body: { phone, code } });
  setToken(token);
  return user;
};

export const register = async (details) => {
  const { user, token } = await api('/auth/register', { method: 'POST', body: details });
  setToken(token);
  return user;
};

// Restore the session on page load; null if not logged in or the token expired
export const currentUser = async () => {
  if (!getToken()) return null;
  try {
    return (await api('/auth/me')).user;
  } catch {
    setToken(null);
    return null;
  }
};

export const logout = () => setToken(null);
