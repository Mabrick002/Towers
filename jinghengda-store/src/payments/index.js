'use strict';

/**
 * Payment provider registry.
 *
 * Every provider exposes:
 *   name                       – stored on the order (orders.payment_provider)
 *   isConfigured()             – true when the API keys it needs are present
 *   startPayment(order, ctx)   – returns { type: 'none' } when no online payment is taken,
 *                                or { type: 'redirect', url } to send the customer to a hosted page
 *
 * Choose the provider with PAYMENT_PROVIDER in .env (manual | stripe | paypal).
 */
const config = require('../config');
const manual = require('./manual');
const stripe = require('./stripe');
const paypal = require('./paypal');

const providers = { manual, stripe, paypal };

function activeProvider() {
  const provider = providers[config.payments.provider];
  if (!provider) {
    throw new Error(`Unknown PAYMENT_PROVIDER "${config.payments.provider}". Use manual, stripe or paypal.`);
  }
  if (provider.implemented === false) {
    throw new Error(`PAYMENT_PROVIDER "${provider.name}" is not implemented yet. See src/payments/${provider.name}.js.`);
  }
  if (!provider.isConfigured()) {
    throw new Error(`PAYMENT_PROVIDER is "${provider.name}" but its API keys are missing. See README → Payments.`);
  }
  return provider;
}

module.exports = { activeProvider, providers };
