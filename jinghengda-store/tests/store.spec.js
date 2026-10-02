// End-to-end tests for the storefront + admin dashboard.
// Run with: npm test   (starts a fresh test database automatically)
const { test, expect } = require('@playwright/test');

const ADMIN = { email: 'admin@jinghengdainternational.com', password: 'test-password-123' };

async function adminLogin(page) {
  await page.goto('/admin/login.html');
  await page.fill('#email', ADMIN.email);
  await page.fill('#password', ADMIN.password);
  await page.click('#login-btn');
  await expect(page).toHaveURL(/\/admin\/dashboard\.html$/);
}

async function addFromProductPage(page, slug, sizeLabel, quantity = 1) {
  await page.goto(`/product.html?slug=${slug}`);
  await page.getByRole('radio', { name: new RegExp(sizeLabel) }).click();
  for (let i = 1; i < quantity; i++) await page.getByRole('button', { name: 'Increase quantity' }).click();
  await expect(page.locator('#qty')).toHaveValue(String(quantity));
  await page.click('#add-to-cart');
  await expect(page.locator('.toast').last()).toContainText('added to your bag');
}

async function fillCheckout(page, customer) {
  for (const [field, value] of Object.entries(customer)) await page.fill(`#${field}`, value);
}

const CUSTOMER = {
  name: 'Mei Chen',
  email: 'mei.chen@example.com',
  phone: '+1 415 555 0134',
  line1: '88 Market Street',
  line2: 'Apt 12B',
  city: 'San Francisco',
  state: 'CA',
  postal: '94105',
  country: 'United States',
  notes: 'Please gift wrap.',
};

test.describe.configure({ mode: 'serial' });

test('customer flow: browse → cart → checkout → admin sees order and updates it', async ({ browser }) => {
  const customer = await (await browser.newContext()).newPage();

  // Browse
  await customer.goto('/');
  await expect(customer.locator('.card')).toHaveCount(12);
  await expect(customer.locator('.brand-name').first()).toHaveText('JINGHENGDA');
  await expect(customer.locator('footer')).toContainText('© 2026 Jinghengda International Limited. All rights reserved.');
  await expect(customer.locator('footer')).toContainText('Owner: Liu Zheng');

  // Filter by family
  await customer.getByRole('button', { name: 'Floral' }).click();
  await expect(customer.locator('.card')).toHaveCount(3);
  await customer.getByRole('button', { name: 'All', exact: true }).click();

  // Select a product from the grid → product page
  await customer.locator('.card', { hasText: 'Oud Nocturne' }).getByRole('link', { name: 'Oud Nocturne' }).first().click();
  await expect(customer.locator('h1')).toHaveText('Oud Nocturne');

  // Add multiple products with options + quantities
  await addFromProductPage(customer, 'oud-nocturne', '100 ml', 2); // 2 × $185
  await addFromProductPage(customer, 'jade-garden', '50 ml', 1); // 1 × $92
  await customer.goto('/');
  await customer.locator('.card', { hasText: 'Silk Peony' }).locator('[data-quick-add]').click(); // 30 ml $58
  await expect(customer.locator('[data-cart-count]')).toHaveText('4');

  // Cart: change quantity and remove
  await customer.goto('/cart.html');
  await expect(customer.locator('.cart-line')).toHaveCount(3);
  const peony = customer.locator('.cart-line', { hasText: 'Silk Peony' });
  await peony.getByRole('button', { name: /Increase quantity/ }).click();
  await expect(peony.locator('input')).toHaveValue('2');
  await expect(customer.locator('#subtotal')).toHaveText('$578.00');
  await peony.getByRole('button', { name: 'Remove' }).click();
  await expect(customer.locator('.cart-line')).toHaveCount(2);
  await expect(customer.locator('#total')).toHaveText('$462.00'); // free shipping over $150

  // Checkout
  await customer.click('#checkout-btn');
  await expect(customer).toHaveURL(/checkout\.html/);
  await customer.click('#place-order'); // empty form → validation
  await expect(customer.locator('.field-error').first()).toBeVisible();
  await fillCheckout(customer, CUSTOMER);
  await customer.click('#place-order');

  // Confirmation
  await expect(customer).toHaveURL(/order-confirmation\.html\?order=JH-/);
  await expect(customer.locator('h1')).toHaveText('Thank you, Mei.');
  const orderNumber = (await customer.locator('#order-number').textContent()).trim();
  await expect(customer.locator('.order-box')).toContainText('$462.00');
  await expect(customer.locator('[data-cart-count]')).toHaveText('0');

  // Admin sees the order with full details
  const admin = await (await browser.newContext()).newPage();
  await adminLogin(admin);
  await expect(admin.locator('#dash-root')).toContainText(orderNumber);
  await admin.goto('/admin/orders.html');
  await admin.getByRole('link', { name: orderNumber }).click();
  await expect(admin.locator('h1')).toHaveText(orderNumber);
  await expect(admin.locator('#customer-name')).toHaveText('Mei Chen');
  const panel = admin.locator('.admin-main');
  for (const text of ['mei.chen@example.com', '+1 415 555 0134', '88 Market Street', 'Apt 12B', 'San Francisco', '94105', 'Please gift wrap.']) {
    await expect(panel).toContainText(text);
  }
  const items = admin.locator('#order-items tbody tr');
  await expect(items).toHaveCount(2);
  await expect(items.filter({ hasText: 'Oud Nocturne' })).toContainText('100 ml');
  await expect(items.filter({ hasText: 'Oud Nocturne' })).toContainText('$370.00');
  await expect(items.filter({ hasText: 'Jade Garden' })).toContainText('$92.00');
  await expect(admin.locator('#order-total')).toHaveText('$462.00');

  // Admin updates order status: Pending → Processing → Shipped → Completed
  for (const status of ['Processing', 'Shipped', 'Completed']) {
    await admin.selectOption('#status', status);
    await admin.click('#save-order');
    await expect(admin.locator('.admin-top .pill').first()).toHaveText(status);
  }
  await admin.selectOption('#payment-status', 'Paid');
  await admin.fill('#admin-notes', 'Tracking: 1Z999');
  await admin.click('#save-order');
  await expect(admin.locator('.admin-top')).toContainText('Paid');
  await admin.reload();
  await expect(admin.locator('#admin-notes')).toHaveValue('Tracking: 1Z999');

  // Inventory was reduced by the order (Oud 100 ml: 9 → 7)
  await admin.goto('/admin/products.html');
  await expect(admin.locator('tr', { hasText: 'Oud Nocturne' })).toContainText('100 ml: 7');

  // Admin sets inventory quantities and edits product details
  await admin.locator('tr', { hasText: 'Jade Garden' }).getByRole('link', { name: 'Edit' }).click();
  const row50 = admin.locator('[data-variant-row]', { has: admin.locator('input[value="50 ml"]') });
  await row50.locator('[name="v-stock"]').fill('3');
  await row50.locator('[name="v-price"]').fill('95');
  await admin.fill('#tagline', 'Green tea leaves after spring rain — restocked.');
  await admin.click('#save-product');
  await expect(admin.locator('.toast')).toContainText('Product saved');
  await customer.goto('/product.html?slug=jade-garden');
  await customer.getByRole('radio', { name: /50 ml/ }).click();
  await expect(customer.locator('#price')).toHaveText('$95.00');
  await expect(customer.locator('.tagline')).toContainText('restocked');
  await expect(customer.locator('#qty')).toHaveAttribute('max', '3');
});

test('out-of-stock flow: admin marks product out of stock → customer cannot buy it', async ({ browser, request }) => {
  const customer = await (await browser.newContext()).newPage();

  // Customer puts Citrus Lumière in the bag while it is still available.
  await addFromProductPage(customer, 'citrus-lumiere', '50 ml', 1);

  // Admin marks it out of stock.
  const admin = await (await browser.newContext()).newPage();
  await adminLogin(admin);
  await admin.goto('/admin/products.html');
  const row = admin.locator('tr', { hasText: 'Citrus Lumière' });
  await row.locator('[data-stock-toggle]').uncheck({ force: true });
  await expect(admin.locator('.toast').last()).toContainText('marked out of stock');
  await expect(admin.locator('tr', { hasText: 'Citrus Lumière' })).toContainText('Out of stock');

  // Product grid shows Out of Stock and the button is disabled.
  await customer.goto('/');
  const card = customer.locator('.card', { hasText: 'Citrus Lumière' });
  await expect(card.locator('.badge-soldout')).toHaveText('Out of stock');
  await expect(card.getByRole('button', { name: 'Out of stock' })).toBeDisabled();

  // Product page: notice, options and add-to-bag disabled.
  await customer.goto('/product.html?slug=citrus-lumiere');
  await expect(customer.locator('#sold-out-notice')).toContainText('Out of stock');
  await expect(customer.locator('#add-to-cart')).toBeDisabled();
  for (const radio of await customer.getByRole('radio').all()) await expect(radio).toBeDisabled();

  // The item already in the bag is flagged and checkout is blocked.
  await customer.goto('/cart.html');
  await expect(customer.locator('.cart-line', { hasText: 'Citrus Lumière' })).toContainText('out of stock');
  await expect(customer.locator('#checkout-btn')).toHaveAttribute('aria-disabled', 'true');

  // The server also refuses the order even if the UI is bypassed.
  const { products } = await (await request.get('/api/products')).json();
  const citrus = products.find((p) => p.slug === 'citrus-lumiere');
  const res = await request.post('/api/orders', {
    data: { customer: CUSTOMER, items: [{ variantId: citrus.variants[1].id, quantity: 1 }] },
  });
  expect(res.status()).toBe(409);

  // The seeded "Amber Lantern" is out of stock from the start.
  await customer.goto('/');
  await expect(customer.locator('.card', { hasText: 'Amber Lantern' }).locator('.badge-soldout')).toBeVisible();

  // Admin puts Citrus back in stock → purchasable again.
  await admin.locator('tr', { hasText: 'Citrus Lumière' }).locator('[data-stock-toggle]').check({ force: true });
  await expect(admin.locator('tr', { hasText: 'Citrus Lumière' })).toContainText('In stock');
  await customer.goto('/product.html?slug=citrus-lumiere');
  await expect(customer.locator('#add-to-cart')).toBeEnabled();
});

test('server refuses orders for more units than are in stock', async ({ request }) => {
  const { products } = await (await request.get('/api/products')).json();
  const jade = products.find((p) => p.slug === 'jade-garden');
  const fifty = jade.variants.find((v) => v.label === '50 ml'); // stock set to 3 earlier
  const res = await request.post('/api/orders', {
    data: { customer: CUSTOMER, items: [{ variantId: fifty.id, quantity: 4 }] },
  });
  expect(res.status()).toBe(409);
  expect((await res.json()).error).toContain('Only 3 left');
});

test('admin: authentication, add product, delete product', async ({ browser, request }) => {
  const page = await (await browser.newContext()).newPage();

  // Protected pages and APIs require login.
  await page.goto('/admin/products.html');
  await expect(page).toHaveURL(/\/admin\/login\.html$/);
  expect((await request.get('/api/admin/orders')).status()).toBe(401);

  await page.fill('#email', ADMIN.email);
  await page.fill('#password', 'wrong-password');
  await page.click('#login-btn');
  await expect(page.locator('#login-error')).toContainText('Incorrect email or password');

  await adminLogin(page);

  // Add a new product
  await page.goto('/admin/product-edit.html');
  await page.fill('#name', 'Lotus Silk');
  await page.fill('#tagline', 'Water lotus and white tea.');
  await page.fill('#description', 'A calm, airy floral.');
  await page.fill('#style', 'Floral');
  await page.selectOption('#gender', 'For Her');
  const first = page.locator('[data-variant-row]').first();
  await first.locator('[name="v-label"]').fill('50 ml');
  await first.locator('[name="v-price"]').fill('88');
  await first.locator('[name="v-stock"]').fill('10');
  await page.click('#add-variant');
  const second = page.locator('[data-variant-row]').nth(1);
  await second.locator('[name="v-label"]').fill('100 ml');
  await second.locator('[name="v-price"]').fill('132');
  await second.locator('[name="v-stock"]').fill('4');
  await page.click('#save-product');
  await expect(page).toHaveURL(/product-edit\.html\?id=\d+&created=1/);

  const shopper = await (await browser.newContext()).newPage();
  await shopper.goto('/');
  await expect(shopper.locator('.card', { hasText: 'Lotus Silk' })).toContainText('$88.00');

  // Delete it
  await page.goto('/admin/products.html');
  page.once('dialog', (d) => d.accept());
  await page.locator('tr', { hasText: 'Lotus Silk' }).getByRole('button', { name: 'Delete' }).click();
  await expect(page.locator('tr', { hasText: 'Lotus Silk' })).toHaveCount(0);
  await shopper.reload();
  await expect(shopper.locator('.card', { hasText: 'Lotus Silk' })).toHaveCount(0);

  // Sign out ends the session
  await page.click('#logout');
  await expect(page).toHaveURL(/login\.html/);
  await page.goto('/admin/dashboard.html');
  await expect(page).toHaveURL(/login\.html/);
});
