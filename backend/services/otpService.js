import crypto from 'crypto';
import OtpCode from '../models/OtpCode.js';
import User from '../models/User.js';
import { badRequest, forbidden, unauthorized, HttpError } from '../utils/httpError.js';
import * as v from '../utils/validate.js';
import { sendSms } from './smsService.js';
import { signToken } from './authService.js';

// Login with a phone number and a 6 digit SMS code, for farmers who do not type email addresses.
const TTL_MS = 5 * 60 * 1000;
const MAX_ATTEMPTS = 5;
const MAX_REQUESTS_PER_10_MIN = 3;

const hash = (phone, code) => crypto.createHmac('sha256', process.env.AUTH_SECRET || '').update(`${phone}:${code}`).digest('hex');
const tenDigits = (phone) => v.phone(phone).slice(-10);

// Same answer whether or not the number belongs to an account, so it cannot be used to look people up
export const requestOtp = async (body = {}) => {
  const phone = tenDigits(body.phone);
  if (phone.length !== 10) throw badRequest('Enter your 10 digit mobile number');

  const recent = await OtpCode.countDocuments({ phone, createdAt: { $gt: new Date(Date.now() - 10 * 60 * 1000) } });
  if (recent >= MAX_REQUESTS_PER_10_MIN) throw new HttpError(429, 'Too many codes requested. Please wait a few minutes.');

  const users = await User.find({ phone: new RegExp(`${phone}$`) }).select('_id');
  if (users.length === 1) {
    const code = String(crypto.randomInt(0, 1000000)).padStart(6, '0');
    await OtpCode.create({ phone, codeHash: hash(phone, code), expiresAt: new Date(Date.now() + TTL_MS) });
    await sendSms(phone, `${code} is your AgriLoop login code. It works for 5 minutes. Do not share it.`);
  }
  // A number on several accounts (shared phones) cannot be told apart safely, so no code is sent
  return { sent: true, message: 'If this number has an AgriLoop account, a 6 digit code was sent.', expiresInMinutes: 5 };
};

export const verifyOtp = async (body = {}) => {
  const phone = tenDigits(body.phone);
  const code = String(body.code || '').trim();
  if (!/^\d{6}$/.test(code)) throw badRequest('Enter the 6 digit code');

  const row = await OtpCode.findOne({ phone, usedAt: null, expiresAt: { $gt: new Date() } }).sort({ createdAt: -1 });
  if (!row || row.attempts >= MAX_ATTEMPTS) throw unauthorized('That code is wrong or has expired. Request a new one.');

  const ok = crypto.timingSafeEqual(Buffer.from(row.codeHash), Buffer.from(hash(phone, code)));
  if (!ok) {
    await OtpCode.updateOne({ _id: row._id }, { $inc: { attempts: 1 } });
    throw unauthorized('That code is wrong or has expired. Request a new one.');
  }
  // Single use: only the request that flips usedAt wins
  const used = await OtpCode.updateOne({ _id: row._id, usedAt: null }, { $set: { usedAt: new Date() } });
  if (!used.modifiedCount) throw unauthorized('That code was already used.');

  const users = await User.find({ phone: new RegExp(`${phone}$`) });
  if (users.length !== 1) throw unauthorized('That code is wrong or has expired. Request a new one.');
  if (users[0].disabled) throw forbidden('This account has been suspended. Please contact AgriLoop support.');
  return { user: users[0].toPublic(), token: signToken(users[0]) };
};
