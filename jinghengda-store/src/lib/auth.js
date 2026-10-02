'use strict';

const crypto = require('node:crypto');
const { getDb } = require('../db');
const config = require('../config');

const SESSION_COOKIE = 'jh_admin';
const SESSION_TTL_HOURS = 12;
const SCRYPT_PARAMS = { N: 16384, r: 8, p: 1 };

function hashPassword(password) {
  const salt = crypto.randomBytes(16);
  const hash = crypto.scryptSync(password, salt, 64, SCRYPT_PARAMS);
  return `scrypt$${salt.toString('hex')}$${hash.toString('hex')}`;
}

function verifyPassword(password, stored) {
  const [scheme, saltHex, hashHex] = String(stored).split('$');
  if (scheme !== 'scrypt' || !saltHex || !hashHex) return false;
  const expected = Buffer.from(hashHex, 'hex');
  const actual = crypto.scryptSync(password, Buffer.from(saltHex, 'hex'), expected.length, SCRYPT_PARAMS);
  return crypto.timingSafeEqual(expected, actual);
}

const sha256 = (value) => crypto.createHash('sha256').update(value).digest('hex');

function createSession(adminId) {
  const token = crypto.randomBytes(32).toString('base64url');
  const expires = new Date(Date.now() + SESSION_TTL_HOURS * 3600 * 1000).toISOString();
  const db = getDb();
  db.prepare("DELETE FROM sessions WHERE expires_at < ?").run(new Date().toISOString());
  db.prepare('INSERT INTO sessions (token_hash, admin_id, expires_at) VALUES (?, ?, ?)').run(sha256(token), adminId, expires);
  return { token, maxAgeMs: SESSION_TTL_HOURS * 3600 * 1000 };
}

function destroySession(token) {
  if (token) getDb().prepare('DELETE FROM sessions WHERE token_hash = ?').run(sha256(token));
}

function findSessionAdmin(token) {
  if (!token) return null;
  return getDb().prepare(`
    SELECT a.id, a.email, a.name FROM sessions s
    JOIN admins a ON a.id = s.admin_id
    WHERE s.token_hash = ? AND s.expires_at > ?
  `).get(sha256(token), new Date().toISOString()) || null;
}

function parseCookies(header = '') {
  const out = {};
  for (const part of header.split(';')) {
    const idx = part.indexOf('=');
    if (idx > 0) out[part.slice(0, idx).trim()] = decodeURIComponent(part.slice(idx + 1).trim());
  }
  return out;
}

function sessionCookie(token, maxAgeMs) {
  const attrs = [`${SESSION_COOKIE}=${token}`, 'Path=/', 'HttpOnly', 'SameSite=Strict', `Max-Age=${Math.floor(maxAgeMs / 1000)}`];
  if (config.isProduction) attrs.push('Secure');
  return attrs.join('; ');
}

function attachAdmin(req, _res, next) {
  req.sessionToken = parseCookies(req.headers.cookie)[SESSION_COOKIE];
  req.admin = findSessionAdmin(req.sessionToken);
  next();
}

function requireAdminApi(req, res, next) {
  if (!req.admin) return res.status(401).json({ error: 'Please sign in.' });
  next();
}

// Blocks cross-site form posts against admin APIs (defence in depth on top of SameSite cookies).
function requireSameOrigin(req, res, next) {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
  const origin = req.headers.origin;
  if (origin && origin !== `${req.protocol}://${req.get('host')}`) {
    return res.status(403).json({ error: 'Cross-origin request blocked.' });
  }
  next();
}

// Simple in-memory login throttle: 8 failed attempts per IP per 15 minutes.
const failedLogins = new Map();
const WINDOW_MS = 15 * 60 * 1000;
const MAX_FAILURES = 8;

function loginThrottled(ip) {
  const entry = failedLogins.get(ip);
  if (!entry || Date.now() - entry.first > WINDOW_MS) return false;
  return entry.count >= MAX_FAILURES;
}
function recordLoginFailure(ip) {
  const entry = failedLogins.get(ip);
  if (!entry || Date.now() - entry.first > WINDOW_MS) failedLogins.set(ip, { first: Date.now(), count: 1 });
  else entry.count += 1;
}
function clearLoginFailures(ip) {
  failedLogins.delete(ip);
}

function ensureAdminAccount() {
  const db = getDb();
  const existing = db.prepare('SELECT id FROM admins WHERE email = ?').get(config.admin.email);
  if (!existing) {
    db.prepare('INSERT INTO admins (email, name, password_hash) VALUES (?, ?, ?)')
      .run(config.admin.email, config.admin.name, hashPassword(config.admin.password));
  }
}

module.exports = {
  SESSION_COOKIE,
  hashPassword,
  verifyPassword,
  createSession,
  destroySession,
  sessionCookie,
  attachAdmin,
  requireAdminApi,
  requireSameOrigin,
  loginThrottled,
  recordLoginFailure,
  clearLoginFailures,
  ensureAdminAccount,
};
