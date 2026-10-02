'use strict';

const express = require('express');
const { getDb } = require('../db');
const stripe = require('../payments/stripe');

const router = express.Router();

// Stripe needs the exact raw body to verify the signature, so this route parses text itself.
router.post('/stripe/webhook', express.text({ type: 'application/json', limit: '1mb' }), (req, res) => {
  if (!stripe.isConfigured()) return res.status(404).end();
  if (!stripe.verifyWebhook(req.body, req.headers['stripe-signature'])) {
    return res.status(400).json({ error: 'Invalid signature.' });
  }
  const event = JSON.parse(req.body);
  if (event.type === 'checkout.session.completed' && event.data?.object?.payment_status === 'paid') {
    const session = event.data.object;
    getDb().prepare(`
      UPDATE orders SET payment_status = 'Paid', payment_reference = ?, updated_at = datetime('now')
      WHERE id = ? AND order_number = ?
    `).run(String(session.payment_intent || session.id), Number(session.metadata?.order_id), String(session.metadata?.order_number));
  }
  res.json({ received: true });
});

module.exports = router;
