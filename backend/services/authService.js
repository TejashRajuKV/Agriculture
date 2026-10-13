import crypto from 'crypto';
import User, { Roles, SELF_REGISTER_ROLES, BuyerTypes } from '../models/User.js';
import { badRequest, conflict, forbidden, unauthorized } from '../utils/httpError.js';
import * as v from '../utils/validate.js';
import { geocodePlace } from '../utils/geo.js';
import { nextSequence } from './counterService.js';

// Passwords: scrypt with a per-user salt. Tokens: base64url(payload).HMAC-SHA256,
// signed with AUTH_SECRET - no external auth libraries needed.

const TOKEN_TTL_SECONDS = 7 * 24 * 3600;

const secret = () => {
  const s = process.env.AUTH_SECRET;
  if (!s || s.length < 32) throw new Error('AUTH_SECRET must be set (32+ characters) in backend/.env');
  return s;
};

export const hashPassword = (password) =>
  new Promise((resolve, reject) => {
    const salt = crypto.randomBytes(16);
    crypto.scrypt(password, salt, 64, (err, key) =>
      err ? reject(err) : resolve(`scrypt$${salt.toString('base64')}$${key.toString('base64')}`)
    );
  });

export const verifyPassword = (password, stored) =>
  new Promise((resolve) => {
    const [algo, saltB64, keyB64] = String(stored || '').split('$');
    if (algo !== 'scrypt' || !saltB64 || !keyB64) return resolve(false);
    const expected = Buffer.from(keyB64, 'base64');
    crypto.scrypt(password, Buffer.from(saltB64, 'base64'), expected.length, (err, key) =>
      resolve(!err && crypto.timingSafeEqual(key, expected))
    );
  });

const b64url = (buf) => Buffer.from(buf).toString('base64url');

export const signToken = (user) => {
  const payload = b64url(JSON.stringify({ sub: String(user._id), exp: Math.floor(Date.now() / 1000) + TOKEN_TTL_SECONDS }));
  const sig = crypto.createHmac('sha256', secret()).update(payload).digest('base64url');
  return `${payload}.${sig}`;
};

// Returns the user id, or null if the token is missing/forged/expired
export const verifyToken = (token) => {
  if (typeof token !== 'string' || !token.includes('.')) return null;
  const [payload, sig] = token.split('.');
  const expected = crypto.createHmac('sha256', secret()).update(payload).digest('base64url');
  const a = Buffer.from(sig || '');
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    const { sub, exp } = JSON.parse(Buffer.from(payload, 'base64url').toString());
    return exp > Date.now() / 1000 ? sub : null;
  } catch {
    return null;
  }
};

export const register = async (body = {}) => {
  const name = v.requiredString(body.name, 'Name', { min: 2, max: 80 });
  const email = v.email(body.email);
  const password = v.requiredString(body.password, 'Password', { min: 8, max: 128 });
  const phone = v.phone(body.phone);
  const role = v.oneOf(body.role, 'Role', SELF_REGISTER_ROLES);
  const locationLabel = v.optionalString(body.location, 'Location', { max: 120 });
  const buyerType = role === Roles.BUYER ? v.oneOf(body.buyerType || 'INDIVIDUAL', 'Buyer type', BuyerTypes) : undefined;

  if (await User.exists({ email })) throw conflict('An account with this email already exists. Please log in.');

  const coords = locationLabel ? await geocodePlace(locationLabel) : null;
  const user = await User.create({
    name,
    email,
    phone,
    role,
    buyerType,
    passwordHash: await hashPassword(password),
    location: { label: locationLabel, ...(coords || {}) },
    farmerCode: role === Roles.FARMER ? `FR-${String(await nextSequence('farmer-code')).padStart(5, '0')}` : undefined,
    walletBalance: role === Roles.BUYER ? 500000 : 0
  });
  return { user: user.toPublic(), token: signToken(user) };
};

// Name, phone and location can be changed; location is re-geocoded so centre distances stay right
export const updateProfile = async (user, body = {}) => {
  if (body.name !== undefined) user.name = v.requiredString(body.name, 'Name', { min: 2, max: 80 });
  if (body.phone !== undefined) user.phone = v.phone(body.phone);
  if (body.location !== undefined) {
    const label = v.optionalString(body.location, 'Location', { max: 120 });
    if (label !== user.location?.label) {
      const coords = label ? await geocodePlace(label) : null;
      user.location = { label, ...(coords || {}) };
      user.markModified('location');
    }
  }
  await user.save();
  return { user: user.toPublic(), locatedOnMap: user.location?.lat != null };
};

export const login = async (body = {}) => {
  const email = v.email(body.email);
  if (typeof body.password !== 'string' || !body.password) throw badRequest('Password is required');
  const user = await User.findOne({ email }).select('+passwordHash');
  // Same message for unknown email and wrong password
  if (!user || !(await verifyPassword(body.password, user.passwordHash))) throw unauthorized('Email or password is incorrect');
  if (user.disabled) throw forbidden('This account has been suspended. Please contact AgriLoop support.');
  return { user: user.toPublic(), token: signToken(user) };
};
