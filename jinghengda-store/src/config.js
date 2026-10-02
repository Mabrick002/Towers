'use strict';

const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');

// Minimal .env loader so the project runs without extra dependencies.
function loadEnvFile(file) {
  if (!fs.existsSync(file)) return;
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (!match || process.env[match[1]] !== undefined) continue;
    process.env[match[1]] = match[2].replace(/^(['"])(.*)\1$/, '$2');
  }
}
loadEnvFile(path.join(ROOT, '.env'));

const env = process.env;
const isProduction = env.NODE_ENV === 'production';

const config = {
  root: ROOT,
  isProduction,
  port: Number(env.PORT) || 3000,
  siteUrl: env.SITE_URL || `http://localhost:${Number(env.PORT) || 3000}`,
  dbFile: path.resolve(ROOT, env.DATABASE_FILE || 'data/store.db'),
  uploadDir: path.resolve(ROOT, env.UPLOAD_DIR || 'uploads'),
  trustProxy: env.TRUST_PROXY === 'true',

  admin: {
    email: (env.ADMIN_EMAIL || 'admin@jinghengdainternational.com').toLowerCase(),
    password: env.ADMIN_PASSWORD || '',
    name: env.ADMIN_NAME || 'Liu Zheng',
  },

  store: {
    name: 'Jinghengda International Limited',
    owner: 'Liu Zheng',
    currency: 'USD',
    contactEmail: env.STORE_CONTACT_EMAIL || 'orders@jinghengdainternational.com',
    // Shipping rules, in cents.
    shippingFlatCents: Number(env.SHIPPING_FLAT_CENTS ?? 1200),
    freeShippingThresholdCents: Number(env.FREE_SHIPPING_THRESHOLD_CENTS ?? 15000),
    maxQuantityPerLine: 20,
  },

  payments: {
    // "manual" = order is placed unpaid and the business invoices the customer.
    provider: (env.PAYMENT_PROVIDER || 'manual').toLowerCase(),
    stripe: {
      secretKey: env.STRIPE_SECRET_KEY || '',
      publishableKey: env.STRIPE_PUBLISHABLE_KEY || '',
      webhookSecret: env.STRIPE_WEBHOOK_SECRET || '',
    },
    paypal: {
      clientId: env.PAYPAL_CLIENT_ID || '',
      clientSecret: env.PAYPAL_CLIENT_SECRET || '',
      mode: env.PAYPAL_MODE || 'sandbox',
    },
  },
};

if (isProduction && !config.admin.password) {
  throw new Error('ADMIN_PASSWORD must be set in production (see .env.example).');
}
if (!config.admin.password) {
  config.admin.password = 'ChangeMe-2026!';
  config.admin.usingDevPassword = true;
}

module.exports = config;
