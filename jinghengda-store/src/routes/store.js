'use strict';

const express = require('express');
const config = require('../config');
const products = require('../services/products');
const orders = require('../services/orders');
const { activeProvider } = require('../payments');

const router = express.Router();

// Public product shape: hides exact inventory counts from customers.
function publicProduct(p) {
  const { totalStock, sortOrder, createdAt, updatedAt, ...rest } = p;
  return {
    ...rest,
    variants: p.variants.map((v) => ({
      id: v.id,
      label: v.label,
      priceCents: v.priceCents,
      available: v.available,
      maxQuantity: v.available ? Math.min(v.stock, config.store.maxQuantityPerLine) : 0,
      lowStock: v.available && v.stock <= 5,
    })),
  };
}

router.get('/config', (_req, res) => {
  res.json({
    name: config.store.name,
    owner: config.store.owner,
    currency: config.store.currency,
    contactEmail: config.store.contactEmail,
    shippingFlatCents: config.store.shippingFlatCents,
    freeShippingThresholdCents: config.store.freeShippingThresholdCents,
    paymentProvider: config.payments.provider,
  });
});

router.get('/products', (_req, res) => {
  res.json({ products: products.listProducts().map(publicProduct) });
});

router.get('/products/:slug', (req, res) => {
  const product = products.getProduct({ slug: req.params.slug });
  if (!product) return res.status(404).json({ error: 'Product not found.' });
  res.json({ product: publicProduct(product) });
});

router.post('/cart/quote', (req, res) => {
  res.json(orders.quoteCart(req.body?.items));
});

router.post('/orders', async (req, res) => {
  const provider = activeProvider();
  const created = orders.createOrder({
    customer: req.body?.customer,
    items: req.body?.items,
    paymentProvider: provider.name,
  });
  const order = { ...orders.getOrder(created.id), publicToken: created.publicToken };

  let payment = { type: 'none' };
  try {
    payment = await provider.startPayment(order, { siteUrl: config.siteUrl });
  } catch (err) {
    console.error(`Payment start failed for ${order.orderNumber}:`, err.message);
    payment = { type: 'error', message: 'Your order was saved, but online payment could not be started. We will contact you with payment instructions.' };
  }

  res.status(201).json({
    orderNumber: created.orderNumber,
    token: created.publicToken,
    totalCents: created.totalCents,
    payment: { type: payment.type, url: payment.url, message: payment.message },
  });
});

router.get('/orders/:orderNumber', (req, res) => {
  const order = orders.getOrderForCustomer(req.params.orderNumber, req.query.token);
  if (!order) return res.status(404).json({ error: 'Order not found.' });
  res.json({ order });
});

module.exports = router;
