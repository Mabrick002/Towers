'use strict';

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const express = require('express');
const multer = require('multer');
const config = require('../config');
const { getDb } = require('../db');
const auth = require('../lib/auth');
const products = require('../services/products');
const orders = require('../services/orders');

const router = express.Router();
router.use(auth.requireSameOrigin);

const IMAGE_TYPES = { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp' };
fs.mkdirSync(config.uploadDir, { recursive: true });
const upload = multer({
  storage: multer.diskStorage({
    destination: config.uploadDir,
    filename: (_req, file, cb) => cb(null, `${Date.now()}-${crypto.randomBytes(6).toString('hex')}${IMAGE_TYPES[file.mimetype]}`),
  }),
  limits: { fileSize: 5 * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, cb) => {
    if (IMAGE_TYPES[file.mimetype]) cb(null, true);
    else cb(Object.assign(new Error('Only JPG, PNG or WEBP images are allowed.'), { status: 400 }));
  },
});

const idParam = (req) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id < 1) throw Object.assign(new Error('Invalid id.'), { status: 400 });
  return id;
};

// ---- Authentication -------------------------------------------------------

router.post('/login', (req, res) => {
  const ip = req.ip;
  if (auth.loginThrottled(ip)) {
    return res.status(429).json({ error: 'Too many failed attempts. Please wait 15 minutes and try again.' });
  }
  const email = String(req.body?.email || '').trim().toLowerCase();
  const password = String(req.body?.password || '');
  const admin = getDb().prepare('SELECT * FROM admins WHERE email = ?').get(email);
  if (!admin || !auth.verifyPassword(password, admin.password_hash)) {
    auth.recordLoginFailure(ip);
    return res.status(401).json({ error: 'Incorrect email or password.' });
  }
  auth.clearLoginFailures(ip);
  const { token, maxAgeMs } = auth.createSession(admin.id);
  res.setHeader('Set-Cookie', auth.sessionCookie(token, maxAgeMs));
  res.json({ admin: { email: admin.email, name: admin.name } });
});

router.post('/logout', (req, res) => {
  auth.destroySession(req.sessionToken);
  res.setHeader('Set-Cookie', auth.sessionCookie('', 0));
  res.json({ ok: true });
});

router.use(auth.requireAdminApi);

router.get('/me', (req, res) => res.json({ admin: req.admin }));

router.post('/password', (req, res) => {
  const current = String(req.body?.currentPassword || '');
  const next = String(req.body?.newPassword || '');
  const admin = getDb().prepare('SELECT * FROM admins WHERE id = ?').get(req.admin.id);
  if (!auth.verifyPassword(current, admin.password_hash)) return res.status(400).json({ error: 'Current password is incorrect.' });
  if (next.length < 10) return res.status(400).json({ error: 'New password must be at least 10 characters.' });
  getDb().prepare('UPDATE admins SET password_hash = ? WHERE id = ?').run(auth.hashPassword(next), admin.id);
  getDb().prepare('DELETE FROM sessions WHERE admin_id = ?').run(admin.id);
  const { token, maxAgeMs } = auth.createSession(admin.id);
  res.setHeader('Set-Cookie', auth.sessionCookie(token, maxAgeMs));
  res.json({ ok: true });
});

// ---- Dashboard ------------------------------------------------------------

router.get('/stats', (_req, res) => res.json(orders.dashboardStats()));

// ---- Products -------------------------------------------------------------

router.get('/products', (_req, res) => res.json({ products: products.listProducts(), genders: products.GENDERS }));

router.get('/products/:id', (req, res) => {
  const product = products.getProduct({ id: idParam(req) });
  if (!product) return res.status(404).json({ error: 'Product not found.' });
  res.json({ product });
});

router.post('/products', (req, res) => res.status(201).json({ product: products.createProduct(req.body || {}) }));

router.put('/products/:id', (req, res) => res.json({ product: products.updateProduct(idParam(req), req.body || {}) }));

router.patch('/products/:id/stock', (req, res) => {
  res.json({ product: products.setProductInStock(idParam(req), Boolean(req.body?.inStock)) });
});

router.delete('/products/:id', (req, res) => {
  products.deleteProduct(idParam(req));
  res.json({ ok: true });
});

router.post('/uploads', upload.single('image'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Choose an image to upload.' });
  res.status(201).json({ url: `/uploads/${req.file.filename}` });
});

// ---- Orders ---------------------------------------------------------------

router.get('/orders', (req, res) => {
  res.json({ orders: orders.listOrders({ status: req.query.status, q: req.query.q }), statuses: orders.ORDER_STATUSES });
});

router.get('/orders/:id', (req, res) => {
  const order = orders.getOrder(idParam(req));
  if (!order) return res.status(404).json({ error: 'Order not found.' });
  res.json({ order, statuses: orders.ORDER_STATUSES, paymentStatuses: orders.PAYMENT_STATUSES });
});

router.patch('/orders/:id', (req, res) => res.json({ order: orders.updateOrder(idParam(req), req.body || {}) }));

module.exports = router;
