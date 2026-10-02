'use strict';

class ValidationError extends Error {
  constructor(message) {
    super(message);
    this.status = 400;
  }
}

function str(value, field, { required = false, max = 500 } = {}) {
  const v = value === undefined || value === null ? '' : String(value).trim();
  if (required && !v) throw new ValidationError(`${field} is required.`);
  if (v.length > max) throw new ValidationError(`${field} must be ${max} characters or fewer.`);
  return v;
}

function int(value, field, { min = 0, max = Number.MAX_SAFE_INTEGER } = {}) {
  const n = Number(value);
  if (!Number.isInteger(n) || n < min || n > max) {
    throw new ValidationError(`${field} must be a whole number between ${min} and ${max}.`);
  }
  return n;
}

// Accepts "129.50" style dollar amounts and returns integer cents.
function priceToCents(value, field) {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0 || n > 1_000_000) throw new ValidationError(`${field} must be a valid price.`);
  return Math.round(n * 100);
}

function email(value) {
  const v = str(value, 'Email', { required: true, max: 200 }).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) throw new ValidationError('Please enter a valid email address.');
  return v;
}

function slugify(text) {
  return String(text).toLowerCase().normalize('NFKD').replace(/[^\w\s-]/g, '')
    .trim().replace(/[\s_-]+/g, '-').replace(/^-+|-+$/g, '') || 'product';
}

module.exports = { ValidationError, str, int, priceToCents, email, slugify };
