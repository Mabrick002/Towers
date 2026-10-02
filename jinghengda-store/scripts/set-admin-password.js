'use strict';

// Usage: npm run set-password -- "new-password"   (uses ADMIN_EMAIL from .env)
const config = require('../src/config');
const { getDb, closeDb } = require('../src/db');
const { hashPassword, ensureAdminAccount } = require('../src/lib/auth');

const password = process.argv[2];
if (!password || password.length < 10) {
  console.error('Usage: npm run set-password -- "new-password"  (at least 10 characters)');
  process.exit(1);
}
ensureAdminAccount();
const db = getDb();
const admin = db.prepare('SELECT id FROM admins WHERE email = ?').get(config.admin.email);
db.prepare('UPDATE admins SET password_hash = ? WHERE id = ?').run(hashPassword(password), admin.id);
db.prepare('DELETE FROM sessions WHERE admin_id = ?').run(admin.id);
console.log(`Password updated for ${config.admin.email}. All existing sessions were signed out.`);
closeDb();
