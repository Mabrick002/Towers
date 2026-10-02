# Jinghengda International Limited — Fragrance Store

A complete online fragrance store with shopping cart, checkout, order management, inventory control and a secure admin dashboard.

**Owner:** Liu Zheng
**Planned domain:** jinghengdainternational.com

---

## What's included

**For customers**
- Browse the full collection, filter by fragrance family / gender / availability, and sort by price or name
- Product pages with size options, prices, scent notes, quantity selector and stock status
- Shopping bag with multiple products, quantity changes and removal; prices and stock are always re-checked by the server
- Simple checkout (contact + shipping details) and an order confirmation page with order number and receipt
- Clear **Out of stock** labels; out-of-stock products and sizes cannot be added to the bag or ordered
- Free-shipping progress bar ($12 flat shipping, free over $150, configurable)
- Responsive design for phones, tablets and desktops

**For the business (admin dashboard at `/admin`)**
- Secure sign-in (hashed passwords, HTTP-only session cookies, login rate-limiting)
- Dashboard: revenue, order counts, orders needing action, low-stock alerts
- Products: add, edit, delete; change names, descriptions, styles, notes, images (upload or URL), sizes and prices
- Inventory: set units in stock per size, and switch any product **In stock / Out of stock** with one click
- Orders: list and search all orders; open any order to see the customer's name, email, phone, shipping address, notes, every item with option, quantity, unit price, line total and order total
- Update order status (**Pending → Processing → Shipped → Completed**, or Cancelled, which returns items to inventory), payment status, and private internal notes

The 12 products that ship with the store are **original demo fragrances** so you can see how everything works. Replace them from the admin dashboard with your real catalogue.

---

## Running it locally

Requirements: **Node.js 22.5 or newer** (uses the built-in SQLite database, so there is nothing else to install).

```bash
cd jinghengda-store
npm install
cp .env.example .env        # then edit .env (at least ADMIN_PASSWORD)
npm start
```

- Store: http://localhost:3000
- Admin: http://localhost:3000/admin

If you start without a `.env`, the admin login is `admin@jinghengdainternational.com` / `ChangeMe-2026!` (development only, and the server prints a warning). In production (`NODE_ENV=production`) the server refuses to start until `ADMIN_PASSWORD` is set.

Useful commands:

| Command | What it does |
| --- | --- |
| `npm start` | Start the store |
| `npm run dev` | Start and auto-restart on code changes |
| `npm run reset-db` | **Delete all data** and reload the demo products |
| `npm test` | Run the automated browser tests (uses a separate test database) |
| `npm run set-password -- "new-password"` | Change the admin password |
| `npm run images` | Regenerate the demo bottle illustrations |

---

## Payments

Checkout is built so online payment can be switched on without changing the order system. Choose the provider with `PAYMENT_PROVIDER` in `.env`:

| Value | Behaviour |
| --- | --- |
| `manual` (default) | No payment is taken online. Orders are saved as **Unpaid** and the customer is told you will email payment instructions. Mark the order **Paid** in the admin when you receive payment. |
| `stripe` | After placing the order the customer is redirected to Stripe Checkout to pay by card. Stripe notifies the store and the order is marked **Paid** automatically. |
| `paypal` | Placeholder only — see `src/payments/paypal.js` for the steps to finish it. |

No payment is ever faked: if a provider isn't configured, the server tells you at start-up.

### Turning on Stripe — where the keys go

1. Create or sign in to a Stripe account → **Developers → API keys**.
2. In `.env` set:
   ```
   PAYMENT_PROVIDER=stripe
   STRIPE_SECRET_KEY=sk_live_...        # secret key — server only, never share it
   STRIPE_PUBLISHABLE_KEY=pk_live_...
   SITE_URL=https://jinghengdainternational.com
   ```
3. In Stripe → **Developers → Webhooks → Add endpoint**:
   - URL: `https://jinghengdainternational.com/api/payments/stripe/webhook`
   - Event: `checkout.session.completed`
   - Copy the signing secret into `.env` as `STRIPE_WEBHOOK_SECRET=whsec_...`
4. Restart the store. Test with Stripe's test keys (`sk_test_…`) and card `4242 4242 4242 4242` before going live.

The integration lives in `src/payments/stripe.js` and the webhook handler in `src/routes/payments.js`.

---

## Deploying to jinghengdainternational.com

The store is a single Node.js app that stores its data in one SQLite file. Any host that runs Node 22 and gives you a **persistent disk** will work: a small VPS (DigitalOcean, Hetzner, Lightsail), Render or Railway with a mounted volume, or Fly.io with a volume.

1. Copy the `jinghengda-store` folder to the server, run `npm ci --omit=dev`.
2. Create `.env` from `.env.example` with `NODE_ENV=production`, a strong `ADMIN_PASSWORD`, `SITE_URL=https://jinghengdainternational.com` and `TRUST_PROXY=true`.
3. Make sure `DATABASE_FILE` and `UPLOAD_DIR` point to the persistent disk.
4. Start it with a process manager, e.g. `pm2 start "npm start" --name jinghengda`, or use the included `Dockerfile`.
5. Put it behind HTTPS. With Nginx + Let's Encrypt, proxy `jinghengdainternational.com` and `www.` to `http://127.0.0.1:3000`. Managed hosts (Render, Railway, Fly) add HTTPS automatically when you attach the domain.
6. At your domain registrar, point the domain's DNS (`A` record, or `CNAME` for managed hosts) to the server as your host instructs.
7. Back up `data/store.db` and `uploads/` regularly; they hold all products, orders and images.

### Docker

```bash
docker build -t jinghengda-store .
docker run -d -p 3000:3000 --env-file .env -v jinghengda-data:/app/data -v jinghengda-uploads:/app/uploads jinghengda-store
```

---

## Project structure

```
jinghengda-store/
├── server.js                 # Express app: security headers, routes, admin page guard
├── src/
│   ├── config.js             # Settings loaded from .env
│   ├── db/index.js           # SQLite schema + transactions
│   ├── lib/auth.js           # Password hashing, sessions, login throttling
│   ├── lib/validate.js       # Input validation helpers
│   ├── services/products.js  # Catalogue + inventory logic
│   ├── services/orders.js    # Cart pricing, order creation (atomic stock reservation), status updates
│   ├── payments/             # manual / stripe / paypal providers
│   └── routes/               # store.js (public API), admin.js (admin API), payments.js (webhooks)
├── public/                   # Storefront + admin pages, CSS, JS, images
│   ├── index.html, product.html, cart.html, checkout.html, order-confirmation.html
│   └── admin/                # login, dashboard, orders, order, products, product-edit
├── scripts/                  # Demo data + image generator
└── tests/                    # Playwright end-to-end tests
```

---

## Security notes

- Admin passwords are hashed with scrypt; sessions are random tokens stored hashed, in `HttpOnly`, `SameSite=Strict` cookies (`Secure` in production) that expire after 12 hours.
- Admin APIs reject cross-origin requests, and logins are throttled after repeated failures.
- Prices, stock and totals are always calculated on the server; the browser only sends product option IDs and quantities.
- Stock is reserved inside a database transaction, so two customers cannot buy the last unit at the same time.
- A strict Content-Security-Policy blocks injected scripts; all user-supplied text is escaped before display.
- Uploaded images are limited to JPG/PNG/WEBP up to 5 MB.
- `ADMIN_PASSWORD` is only used to create the admin account on first start. To change the password later, run `npm run set-password -- "new-password"` on the server (this also signs out all sessions).

© 2026 Jinghengda International Limited. All rights reserved.
