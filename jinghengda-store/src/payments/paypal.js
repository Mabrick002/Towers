'use strict';

/**
 * PayPal placeholder.
 *
 * To enable PayPal later:
 *   1. Create a REST app at https://developer.paypal.com/dashboard/applications
 *   2. Put the credentials in .env:
 *        PAYMENT_PROVIDER=paypal
 *        PAYPAL_CLIENT_ID=...
 *        PAYPAL_CLIENT_SECRET=...
 *        PAYPAL_MODE=live            (or sandbox while testing)
 *   3. Implement startPayment() below with the Orders v2 API:
 *        POST /v2/checkout/orders  (intent CAPTURE, amount = order.totalCents / 100)
 *      and return { type: 'redirect', url: <the "payer-action"/"approve" link> }.
 *   4. Add a capture/webhook route that marks the order Paid (see the Stripe webhook in
 *      src/routes/payments.js for the pattern).
 *
 * Until step 3 is done, choosing PayPal stops checkout with a clear error rather than
 * pretending a payment happened.
 */
const config = require('../config');

module.exports = {
  name: 'paypal',
  implemented: false,
  isConfigured: () => Boolean(config.payments.paypal.clientId && config.payments.paypal.clientSecret),
  async startPayment() {
    throw new Error('PayPal checkout is not implemented yet. See src/payments/paypal.js.');
  },
};
