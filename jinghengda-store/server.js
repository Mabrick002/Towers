'use strict';

const path = require('node:path');
const express = require('express');
const config = require('./src/config');
const { getDb } = require('./src/db');
const auth = require('./src/lib/auth');
const { activeProvider } = require('./src/payments');
const { ensureSeedData } = require('./scripts/seed');

function createApp() {
  getDb();
  auth.ensureAdminAccount();
  ensureSeedData();
  activeProvider(); // fail fast if payment settings are incomplete

  const app = express();
  app.disable('x-powered-by');
  if (config.trustProxy) app.set('trust proxy', 1);

  app.use((_req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('Content-Security-Policy', [
      "default-src 'self'",
      "img-src 'self' https: data:",
      "style-src 'self' https://fonts.googleapis.com",
      "font-src 'self' https://fonts.gstatic.com",
      "script-src 'self'",
      "connect-src 'self'",
      "form-action 'self'",
      "frame-ancestors 'none'",
    ].join('; '));
    if (config.isProduction) res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    next();
  });

  app.use('/api/payments', require('./src/routes/payments'));
  app.use(express.json({ limit: '200kb' }));
  app.use(auth.attachAdmin);

  app.use('/api/admin', (_req, res, next) => {
    res.setHeader('Cache-Control', 'no-store');
    next();
  }, require('./src/routes/admin'));
  app.use('/api', require('./src/routes/store'));
  app.use('/api', (_req, res) => res.status(404).json({ error: 'Not found.' }));

  // Admin pages: anything other than the login page requires a session.
  app.use('/admin', (req, res, next) => {
    if (req.path === '/' || req.path === '/index.html') {
      return res.redirect(req.admin ? '/admin/dashboard.html' : '/admin/login.html');
    }
    const isPage = ['', '.html'].includes(path.extname(req.path));
    const isLogin = req.path === '/login.html' || req.path === '/login';
    if (isPage && !isLogin && !req.admin) return res.redirect('/admin/login.html');
    res.setHeader('Cache-Control', 'no-store');
    next();
  });

  app.use('/uploads', express.static(config.uploadDir, { maxAge: '7d', fallthrough: false }));
  app.use(express.static(path.join(__dirname, 'public'), { extensions: ['html'] }));

  app.use((_req, res) => res.status(404).sendFile(path.join(__dirname, 'public', '404.html')));

  // eslint-disable-next-line no-unused-vars
  app.use((err, _req, res, _next) => {
    const status = err.status || err.statusCode || (err.code === 'LIMIT_FILE_SIZE' ? 400 : 500);
    if (status >= 500) console.error(err);
    res.status(status).json({
      error: status >= 500 ? 'Something went wrong. Please try again.' : err.message,
      problems: err.problems,
    });
  });

  return app;
}

if (require.main === module) {
  const app = createApp();
  app.listen(config.port, () => {
    console.log(`Jinghengda store running at ${config.siteUrl}`);
    console.log(`Admin dashboard: ${config.siteUrl}/admin`);
    if (config.admin.usingDevPassword) {
      console.warn(`⚠  Using the development admin password for ${config.admin.email}.`
        + ' Set ADMIN_PASSWORD in .env before going live.');
    }
  });
}

module.exports = { createApp };
