'use strict';

/**
 * Stripe Checkout integration (hosted payment page).
 *
 * Required environment variables (.env):
 *   PAYMENT_PROVIDER=stripe
 *   STRIPE_SECRET_KEY=sk_live_...       (Dashboard → Developers → API keys)
 *   STRIPE_WEBHOOK_SECRET=whsec_...     (Dashboard → Developers → Webhooks → add endpoint
 *                                        https://YOUR-DOMAIN/api/payments/stripe/webhook,
 *                                        event: checkout.session.completed)
 *
 * Flow: the order is saved (Unpaid, stock reserved) → customer is redirected to Stripe →
 * Stripe calls the webhook → the order is marked Paid automatically.
 */
const crypto = require('node:crypto');
const config = require('../config');

const API = 'https://api.stripe.com/v1';

function isConfigured() {
  return Boolean(config.payments.stripe.secretKey && config.payments.stripe.webhookSecret);
}

// Stripe's API takes application/x-www-form-urlencoded with bracketed keys.
function encodeForm(obj, prefix, out = new URLSearchParams()) {
  for (const [key, value] of Object.entries(obj)) {
    const name = prefix ? `${prefix}[${key}]` : key;
    if (value === undefined || value === null) continue;
    if (typeof value === 'object') encodeForm(value, name, out);
    else out.append(name, String(value));
  }
  return out;
}

async function startPayment(order, { siteUrl }) {
  const lineItems = order.items.map((item) => ({
    quantity: item.quantity,
    price_data: {
      currency: config.store.currency.toLowerCase(),
      unit_amount: item.unitPriceCents,
      product_data: { name: `${item.name} — ${item.variantLabel}` },
    },
  }));
  if (order.shippingCents > 0) {
    lineItems.push({
      quantity: 1,
      price_data: {
        currency: config.store.currency.toLowerCase(),
        unit_amount: order.shippingCents,
        product_data: { name: 'Shipping' },
      },
    });
  }

  const confirmUrl = `${siteUrl}/order-confirmation.html?order=${encodeURIComponent(order.orderNumber)}`
    + `&token=${encodeURIComponent(order.publicToken)}`;
  const body = encodeForm({
    mode: 'payment',
    success_url: confirmUrl,
    cancel_url: `${confirmUrl}&payment=cancelled`,
    customer_email: order.customer.email,
    client_reference_id: order.orderNumber,
    metadata: { order_id: order.id, order_number: order.orderNumber },
    line_items: Object.fromEntries(lineItems.map((li, i) => [i, li])),
  });

  const res = await fetch(`${API}/checkout/sessions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.payments.stripe.secretKey}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`Stripe error: ${data.error?.message || res.status}`);
  return { type: 'redirect', url: data.url, reference: data.id };
}

// Verifies the Stripe-Signature header (https://docs.stripe.com/webhooks#verify-manually).
function verifyWebhook(rawBody, signatureHeader, toleranceSeconds = 300) {
  const parts = Object.fromEntries(
    String(signatureHeader || '').split(',').map((kv) => kv.split('=')).filter((kv) => kv.length === 2)
  );
  const timestamp = Number(parts.t);
  const signatures = String(signatureHeader || '').split(',')
    .filter((kv) => kv.startsWith('v1=')).map((kv) => kv.slice(3));
  if (!timestamp || !signatures.length) return false;
  if (Math.abs(Date.now() / 1000 - timestamp) > toleranceSeconds) return false;

  const expected = crypto.createHmac('sha256', config.payments.stripe.webhookSecret)
    .update(`${timestamp}.${rawBody}`).digest('hex');
  return signatures.some((sig) => sig.length === expected.length
    && crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected)));
}

module.exports = { name: 'stripe', isConfigured, startPayment, verifyWebhook };
