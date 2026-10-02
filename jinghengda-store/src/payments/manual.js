'use strict';

// Default provider: no online payment is taken. Orders are created as "Unpaid" and the
// business contacts the customer with payment instructions (invoice, bank transfer, etc.).
// The admin marks the order "Paid" from the dashboard once payment is received.
module.exports = {
  name: 'manual',
  isConfigured: () => true,
  async startPayment() {
    return { type: 'none' };
  },
};
