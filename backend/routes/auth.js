import express from 'express';
import { asyncHandler } from '../utils/httpError.js';
import { requireAuth } from '../middleware/auth.js';
import * as auth from '../services/authService.js';
import * as otp from '../services/otpService.js';
import { HttpError } from '../utils/httpError.js';
import { isBlocked, recordFailure, clearFailures, retryAfterSeconds } from '../utils/throttle.js';

const router = express.Router();

router.post('/register', asyncHandler(async (req, res) => res.status(201).json(await auth.register(req.body))));
// Too many wrong passwords for one email from one address: wait before trying again
router.post('/login', asyncHandler(async (req, res) => {
  const key = `login:${req.ip}:${String(req.body?.email || '').toLowerCase()}`;
  if (isBlocked(key)) {
    res.set('Retry-After', String(retryAfterSeconds(key)));
    throw new HttpError(429, 'Too many failed attempts. Please wait a few minutes and try again.');
  }
  try {
    const result = await auth.login(req.body);
    clearFailures(key);
    res.json(result);
  } catch (err) {
    if (err.status === 401) recordFailure(key);
    throw err;
  }
}));
router.post('/otp/request', asyncHandler(async (req, res) => res.json(await otp.requestOtp(req.body))));
router.post('/otp/verify', asyncHandler(async (req, res) => res.json(await otp.verifyOtp(req.body))));
router.get('/me', requireAuth, (req, res) => res.json({ user: req.user.toPublic() }));
router.patch('/me', requireAuth, asyncHandler(async (req, res) => res.json(await auth.updateProfile(req.user, req.body))));

export default router;
