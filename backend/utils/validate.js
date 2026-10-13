import mongoose from 'mongoose';
import { badRequest } from './httpError.js';

// Small dependency-free validators. Each returns the cleaned value or throws a 400.

export const objectId = (value, field = 'id') => {
  if (typeof value !== 'string' || !mongoose.isValidObjectId(value) || String(new mongoose.Types.ObjectId(value)) !== value) {
    throw badRequest(`Invalid ${field}`);
  }
  return value;
};

export const requiredString = (value, field, { min = 1, max = 200 } = {}) => {
  if (typeof value !== 'string') throw badRequest(`${field} is required`);
  const v = value.trim();
  if (v.length < min) throw badRequest(`${field} must be at least ${min} characters`);
  if (v.length > max) throw badRequest(`${field} must be at most ${max} characters`);
  return v;
};

export const optionalString = (value, field, { max = 500 } = {}) => {
  if (value === undefined || value === null || value === '') return '';
  if (typeof value !== 'string') throw badRequest(`${field} must be text`);
  const v = value.trim();
  if (v.length > max) throw badRequest(`${field} must be at most ${max} characters`);
  return v;
};

export const number = (value, field, { min = -Infinity, max = Infinity, integer = false } = {}) => {
  const n = typeof value === 'string' && value.trim() !== '' ? Number(value) : value;
  if (typeof n !== 'number' || !Number.isFinite(n)) throw badRequest(`${field} must be a number`);
  if (integer && !Number.isInteger(n)) throw badRequest(`${field} must be a whole number`);
  if (n < min) throw badRequest(`${field} must be at least ${min}`);
  if (n > max) throw badRequest(`${field} must be at most ${max}`);
  return n;
};

export const positiveNumber = (value, field, opts = {}) => {
  const n = number(value, field, opts);
  if (n <= 0) throw badRequest(`${field} must be greater than 0`);
  return n;
};

export const oneOf = (value, field, allowed) => {
  if (!allowed.includes(value)) throw badRequest(`${field} must be one of: ${allowed.join(', ')}`);
  return value;
};

export const isoDate = (value, field) => {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw badRequest(`${field} must be a date like 2026-09-28`);
  }
  const d = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== value) throw badRequest(`${field} is not a real date`);
  return value;
};

export const email = (value) => {
  const v = requiredString(value, 'Email', { max: 120 }).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) throw badRequest('Email is not valid');
  return v;
};

export const phone = (value) => {
  if (value === undefined || value === null || value === '') return '';
  const digits = String(value).replace(/\D/g, '');
  if (digits.length < 10 || digits.length > 12) throw badRequest('Phone number must have 10 digits');
  return digits;
};

// Makes user text safe to put inside a regular expression
export const escapeRegex = (text) => String(text).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
