'use strict';

const crypto = require('node:crypto');
const config = require('../config');
const { getDb, transaction } = require('../db');
const { ValidationError, str, int, email } = require('../lib/validate');

const ORDER_STATUSES = ['Pending', 'Processing', 'Shipped', 'Completed', 'Cancelled'];
const PAYMENT_STATUSES = ['Unpaid', 'Paid', 'Refunded'];

function shippingFor(subtotalCents) {
  const { shippingFlatCents, freeShippingThresholdCents } = config.store;
  if (subtotalCents === 0) return 0;
  return subtotalCents >= freeShippingThresholdCents ? 0 : shippingFlatCents;
}

function normalizeItems(items) {
  if (!Array.isArray(items) || !items.length) throw new ValidationError('Your cart is empty.');
  if (items.length > 50) throw new ValidationError('Too many items in cart.');
  const merged = new Map();
  for (const item of items) {
    const variantId = int(item?.variantId, 'Product option', { min: 1 });
    const quantity = int(item?.quantity, 'Quantity', { min: 1, max: config.store.maxQuantityPerLine });
    merged.set(variantId, Math.min((merged.get(variantId) || 0) + quantity, config.store.maxQuantityPerLine));
  }
  return [...merged].map(([variantId, quantity]) => ({ variantId, quantity }));
}

const VARIANT_QUERY = `
  SELECT v.id AS variant_id, v.label, v.price_cents, v.stock,
         p.id AS product_id, p.name, p.slug, p.image_url, p.in_stock
  FROM product_variants v JOIN products p ON p.id = v.product_id
  WHERE v.id = ?`;

/**
 * Prices a cart against the live catalogue. The server is the source of truth for
 * prices and stock; the browser cart only stores variant ids and quantities.
 */
function quoteCart(items) {
  const db = getDb();
  const lines = [];
  const problems = [];
  for (const { variantId, quantity } of normalizeItems(items)) {
    const row = db.prepare(VARIANT_QUERY).get(variantId);
    if (!row) {
      problems.push({ variantId, message: 'This product is no longer available.' });
      continue;
    }
    let message = '';
    if (!row.in_stock || row.stock <= 0) message = `${row.name} (${row.label}) is out of stock.`;
    else if (row.stock < quantity) message = `Only ${row.stock} left of ${row.name} (${row.label}).`;
    if (message) problems.push({ variantId, message, available: row.in_stock ? row.stock : 0 });
    lines.push({
      variantId,
      productId: row.product_id,
      slug: row.slug,
      name: row.name,
      variantLabel: row.label,
      imageUrl: row.image_url,
      unitPriceCents: row.price_cents,
      quantity,
      lineTotalCents: row.price_cents * quantity,
      maxQuantity: Math.min(row.in_stock ? row.stock : 0, config.store.maxQuantityPerLine),
      available: !message,
    });
  }
  const subtotalCents = lines.reduce((sum, l) => sum + l.lineTotalCents, 0);
  const shippingCents = shippingFor(subtotalCents);
  return {
    lines,
    problems,
    subtotalCents,
    shippingCents,
    totalCents: subtotalCents + shippingCents,
    freeShippingThresholdCents: config.store.freeShippingThresholdCents,
  };
}

function parseCustomer(input = {}) {
  return {
    name: str(input.name, 'Full name', { required: true, max: 120 }),
    email: email(input.email),
    phone: str(input.phone, 'Phone', { required: true, max: 40 }),
    line1: str(input.line1, 'Address', { required: true, max: 200 }),
    line2: str(input.line2, 'Address line 2', { max: 200 }),
    city: str(input.city, 'City', { required: true, max: 100 }),
    state: str(input.state, 'State / Province', { max: 100 }),
    postal: str(input.postal, 'Postal code', { required: true, max: 20 }),
    country: str(input.country, 'Country', { required: true, max: 80 }),
    notes: str(input.notes, 'Order notes', { max: 1000 }),
  };
}

function generateOrderNumber(db) {
  const date = new Date().toISOString().slice(2, 10).replace(/-/g, '');
  for (;;) {
    const candidate = `JH-${date}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
    if (!db.prepare('SELECT 1 FROM orders WHERE order_number = ?').get(candidate)) return candidate;
  }
}

/**
 * Creates an order atomically: re-validates stock, decrements inventory and stores
 * snapshot copies of names/prices so later catalogue edits don't change past orders.
 */
function createOrder({ customer, items, paymentProvider }) {
  const c = parseCustomer(customer);
  const normalized = normalizeItems(items);

  return transaction((db) => {
    const quote = quoteCart(normalized);
    if (quote.problems.length) {
      const err = new ValidationError(quote.problems.map((p) => p.message).join(' '));
      err.problems = quote.problems;
      err.status = 409;
      throw err;
    }

    for (const line of quote.lines) {
      const result = db.prepare('UPDATE product_variants SET stock = stock - ? WHERE id = ? AND stock >= ?')
        .run(line.quantity, line.variantId, line.quantity);
      if (!result.changes) throw Object.assign(new ValidationError(`${line.name} just sold out.`), { status: 409 });
    }

    const orderNumber = generateOrderNumber(db);
    const publicToken = crypto.randomBytes(24).toString('base64url');
    const result = db.prepare(`
      INSERT INTO orders (order_number, public_token, payment_provider, customer_name, customer_email, customer_phone,
        ship_line1, ship_line2, ship_city, ship_state, ship_postal, ship_country, customer_notes,
        subtotal_cents, shipping_cents, total_cents)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(orderNumber, publicToken, paymentProvider, c.name, c.email, c.phone, c.line1, c.line2, c.city, c.state,
      c.postal, c.country, c.notes, quote.subtotalCents, quote.shippingCents, quote.totalCents);
    const orderId = Number(result.lastInsertRowid);

    const insertItem = db.prepare(`
      INSERT INTO order_items (order_id, product_id, variant_id, product_name, variant_label, image_url,
        unit_price_cents, quantity, line_total_cents)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    for (const l of quote.lines) {
      insertItem.run(orderId, l.productId, l.variantId, l.name, l.variantLabel, l.imageUrl, l.unitPriceCents,
        l.quantity, l.lineTotalCents);
    }
    return { id: orderId, orderNumber, publicToken, totalCents: quote.totalCents };
  });
}

function formatOrder(row, items) {
  return {
    id: row.id,
    orderNumber: row.order_number,
    status: row.status,
    paymentStatus: row.payment_status,
    paymentProvider: row.payment_provider,
    paymentReference: row.payment_reference,
    customer: {
      name: row.customer_name,
      email: row.customer_email,
      phone: row.customer_phone,
    },
    shipping: {
      line1: row.ship_line1,
      line2: row.ship_line2,
      city: row.ship_city,
      state: row.ship_state,
      postal: row.ship_postal,
      country: row.ship_country,
    },
    customerNotes: row.customer_notes,
    adminNotes: row.admin_notes,
    subtotalCents: row.subtotal_cents,
    shippingCents: row.shipping_cents,
    totalCents: row.total_cents,
    itemCount: items ? items.reduce((s, i) => s + i.quantity, 0) : row.item_count,
    items: items?.map((i) => ({
      productId: i.product_id,
      variantId: i.variant_id,
      name: i.product_name,
      variantLabel: i.variant_label,
      imageUrl: i.image_url,
      unitPriceCents: i.unit_price_cents,
      quantity: i.quantity,
      lineTotalCents: i.line_total_cents,
    })),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function itemsFor(orderId) {
  return getDb().prepare('SELECT * FROM order_items WHERE order_id = ? ORDER BY id').all(orderId);
}

function listOrders({ status, q } = {}) {
  const where = [];
  const params = [];
  if (status && ORDER_STATUSES.includes(status)) {
    where.push('o.status = ?');
    params.push(status);
  }
  if (q) {
    where.push('(o.order_number LIKE ? OR o.customer_name LIKE ? OR o.customer_email LIKE ?)');
    const like = `%${String(q).slice(0, 100)}%`;
    params.push(like, like, like);
  }
  const rows = getDb().prepare(`
    SELECT o.*, (SELECT COALESCE(SUM(quantity), 0) FROM order_items WHERE order_id = o.id) AS item_count
    FROM orders o ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
    ORDER BY o.created_at DESC, o.id DESC
  `).all(...params);
  return rows.map((r) => formatOrder(r));
}

function getOrder(id) {
  const row = getDb().prepare('SELECT * FROM orders WHERE id = ?').get(id);
  return row ? formatOrder(row, itemsFor(row.id)) : null;
}

// Customer-facing lookup: requires the unguessable token issued at checkout.
function getOrderForCustomer(orderNumber, token) {
  const row = getDb().prepare('SELECT * FROM orders WHERE order_number = ?').get(String(orderNumber || ''));
  if (!row || !token) return null;
  const a = Buffer.from(row.public_token);
  const b = Buffer.from(String(token));
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  const order = formatOrder(row, itemsFor(row.id));
  delete order.adminNotes;
  delete order.id;
  return order;
}

function updateOrder(id, input) {
  return transaction((db) => {
    const row = db.prepare('SELECT * FROM orders WHERE id = ?').get(id);
    if (!row) throw Object.assign(new Error('Order not found.'), { status: 404 });

    const status = input.status === undefined ? row.status : str(input.status, 'Status', { max: 20 });
    if (!ORDER_STATUSES.includes(status)) throw new ValidationError('Invalid order status.');
    if (row.status === 'Cancelled' && status !== 'Cancelled') {
      throw new ValidationError('Cancelled orders cannot be reopened. Ask the customer to place a new order.');
    }
    const paymentStatus = input.paymentStatus === undefined
      ? row.payment_status : str(input.paymentStatus, 'Payment status', { max: 20 });
    if (!PAYMENT_STATUSES.includes(paymentStatus)) throw new ValidationError('Invalid payment status.');
    const adminNotes = input.adminNotes === undefined ? row.admin_notes : str(input.adminNotes, 'Notes', { max: 2000 });

    // Cancelling returns the items to inventory.
    if (status === 'Cancelled' && row.status !== 'Cancelled') {
      for (const item of itemsFor(id)) {
        if (item.variant_id) {
          db.prepare('UPDATE product_variants SET stock = stock + ? WHERE id = ?').run(item.quantity, item.variant_id);
        }
      }
    }

    db.prepare(`UPDATE orders SET status = ?, payment_status = ?, admin_notes = ?, updated_at = datetime('now')
                WHERE id = ?`).run(status, paymentStatus, adminNotes, id);
    return getOrder(id);
  });
}

function dashboardStats() {
  const db = getDb();
  const byStatus = Object.fromEntries(ORDER_STATUSES.map((s) => [s, 0]));
  for (const r of db.prepare('SELECT status, COUNT(*) AS n FROM orders GROUP BY status').all()) byStatus[r.status] = r.n;
  const revenue = db.prepare("SELECT COALESCE(SUM(total_cents), 0) AS cents FROM orders WHERE status != 'Cancelled'").get();
  const products = db.prepare('SELECT COUNT(*) AS n FROM products').get();
  const outOfStock = db.prepare(`
    SELECT COUNT(*) AS n FROM products p
    WHERE p.in_stock = 0 OR NOT EXISTS (SELECT 1 FROM product_variants v WHERE v.product_id = p.id AND v.stock > 0)
  `).get();
  const lowStock = db.prepare(`
    SELECT p.id, p.name, v.label, v.stock FROM product_variants v JOIN products p ON p.id = v.product_id
    WHERE p.in_stock = 1 AND v.stock BETWEEN 1 AND 5 ORDER BY v.stock, p.name LIMIT 10
  `).all();
  return {
    ordersByStatus: byStatus,
    totalOrders: Object.values(byStatus).reduce((a, b) => a + b, 0),
    revenueCents: revenue.cents,
    productCount: products.n,
    outOfStockCount: outOfStock.n,
    lowStock,
    recentOrders: listOrders().slice(0, 5),
  };
}

module.exports = {
  ORDER_STATUSES,
  PAYMENT_STATUSES,
  quoteCart,
  createOrder,
  listOrders,
  getOrder,
  getOrderForCustomer,
  updateOrder,
  dashboardStats,
};
