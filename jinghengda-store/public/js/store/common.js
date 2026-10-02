/* Shared storefront helpers: API, cart storage, formatting, header/footer. */
(function () {
  'use strict';

  const CART_KEY = 'jh_cart_v1';
  const MAX_QTY = 20;

  const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[c]);

  const money = (cents) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format((cents || 0) / 100);

  async function api(path, options = {}) {
    const res = await fetch(`/api${path}`, {
      method: options.method || 'GET',
      headers: options.body ? { 'Content-Type': 'application/json' } : undefined,
      body: options.body ? JSON.stringify(options.body) : undefined,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const err = new Error(data.error || 'Something went wrong. Please try again.');
      err.status = res.status;
      err.problems = data.problems;
      throw err;
    }
    return data;
  }

  // ---- Cart (browser stores only variant ids + quantities; server prices everything) ----

  function readCart() {
    try {
      const items = JSON.parse(localStorage.getItem(CART_KEY) || '[]');
      return Array.isArray(items)
        ? items.filter((i) => Number.isInteger(i.variantId) && Number.isInteger(i.quantity) && i.quantity > 0)
        : [];
    } catch {
      return [];
    }
  }

  function writeCart(items) {
    try {
      localStorage.setItem(CART_KEY, JSON.stringify(items));
    } catch { /* storage unavailable: cart lives for this page only */ }
    renderCartCount();
    document.dispatchEvent(new CustomEvent('cart:change'));
  }

  const cart = {
    items: readCart,
    count: () => readCart().reduce((n, i) => n + i.quantity, 0),
    add(variantId, quantity, maxQuantity = MAX_QTY) {
      const items = readCart();
      const existing = items.find((i) => i.variantId === variantId);
      const limit = Math.min(maxQuantity, MAX_QTY);
      const current = existing ? existing.quantity : 0;
      const next = Math.min(current + quantity, limit);
      if (existing) existing.quantity = next;
      else items.push({ variantId, quantity: next });
      writeCart(items);
      return { added: next - current, capped: current + quantity > limit };
    },
    set(variantId, quantity) {
      const q = Math.max(0, Math.min(MAX_QTY, quantity));
      writeCart(readCart().map((i) => (i.variantId === variantId ? { ...i, quantity: q } : i)).filter((i) => i.quantity > 0));
    },
    remove(variantId) {
      writeCart(readCart().filter((i) => i.variantId !== variantId));
    },
    clear() {
      writeCart([]);
    },
  };

  // ---- Toasts ----

  function toast(message, { type = 'info', action } = {}) {
    let wrap = document.querySelector('.toast-wrap');
    if (!wrap) {
      wrap = document.createElement('div');
      wrap.className = 'toast-wrap';
      wrap.setAttribute('role', 'status');
      wrap.setAttribute('aria-live', 'polite');
      document.body.appendChild(wrap);
    }
    const el = document.createElement('div');
    el.className = `toast ${type === 'error' ? 'error' : ''}`;
    el.innerHTML = `<span>${escapeHtml(message)}</span>${action ? `<a href="${escapeHtml(action.href)}">${escapeHtml(action.label)}</a>` : ''}`;
    wrap.appendChild(el);
    setTimeout(() => el.remove(), 4200);
  }

  // ---- Layout ----

  const cartIcon = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" aria-hidden="true"><path d="M5 8h14l-1.2 11.2a2 2 0 0 1-2 1.8H8.2a2 2 0 0 1-2-1.8z"/><path d="M9 8V6a3 3 0 0 1 6 0v2"/></svg>';

  function renderHeader() {
    const host = document.getElementById('site-header');
    if (!host) return;
    const page = document.body.dataset.page;
    const current = (name) => (page === name ? ' aria-current="page"' : '');
    host.outerHTML = `
      <div class="announce">Complimentary shipping on orders over $150 · Gift wrapping on request</div>
      <header class="site-header">
        <div class="container">
          <a class="brand" href="/" aria-label="Jinghengda International Limited — home">
            <span class="brand-name">JINGHENGDA</span>
            <span class="brand-sub">INTERNATIONAL LIMITED</span>
          </a>
          <nav class="nav" id="main-nav" aria-label="Main">
            <a href="/"${current('home')}>Home</a>
            <a href="/#collection"${current('collection')}>Collection</a>
            <a href="/#about">About</a>
            <a href="/#contact">Contact</a>
          </nav>
          <div class="header-actions">
            <a class="cart-link" href="/cart.html" aria-label="Shopping bag"${current('cart')}>
              ${cartIcon}<span class="label">Bag</span><span class="cart-count" data-cart-count>0</span>
            </a>
            <button class="menu-toggle" type="button" aria-label="Open menu" aria-expanded="false" aria-controls="main-nav">
              <span></span><span></span><span></span>
            </button>
          </div>
        </div>
      </header>`;
    const toggle = document.querySelector('.menu-toggle');
    const nav = document.getElementById('main-nav');
    toggle.addEventListener('click', () => {
      const open = nav.classList.toggle('open');
      toggle.setAttribute('aria-expanded', String(open));
    });
    nav.addEventListener('click', (e) => {
      if (e.target.closest('a')) {
        nav.classList.remove('open');
        toggle.setAttribute('aria-expanded', 'false');
      }
    });
    renderCartCount();
  }

  function renderFooter() {
    const host = document.getElementById('site-footer');
    if (!host) return;
    host.outerHTML = `
      <footer class="site-footer" id="contact">
        <div class="container">
          <div class="footer-grid">
            <div>
              <a class="brand" href="/">
                <span class="brand-name">JINGHENGDA</span>
                <span class="brand-sub">INTERNATIONAL LIMITED</span>
              </a>
              <p class="footer-about">Fine fragrances, thoughtfully curated and carefully delivered.</p>
              <p class="footer-owner">Owner: <strong>Liu Zheng</strong></p>
            </div>
            <div>
              <h4>Shop</h4>
              <ul>
                <li><a href="/#collection">All fragrances</a></li>
                <li><a href="/#collection" data-filter-link="For Her">For her</a></li>
                <li><a href="/#collection" data-filter-link="For Him">For him</a></li>
                <li><a href="/#collection" data-filter-link="Unisex">Unisex</a></li>
              </ul>
            </div>
            <div>
              <h4>Customer care</h4>
              <ul>
                <li>Shipping &amp; delivery</li>
                <li>Returns &amp; exchanges</li>
                <li><a href="/cart.html">Your bag</a></li>
              </ul>
            </div>
            <div>
              <h4>Contact</h4>
              <ul>
                <li><a href="mailto:orders@jinghengdainternational.com">orders@jinghengdainternational.com</a></li>
                <li>jinghengdainternational.com</li>
              </ul>
            </div>
          </div>
          <div class="footer-bottom">
            <span>© 2026 Jinghengda International Limited. All rights reserved.</span>
            <span>Secure checkout · Prices in USD</span>
          </div>
        </div>
      </footer>`;
  }

  function renderCartCount() {
    const n = cart.count();
    document.querySelectorAll('[data-cart-count]').forEach((el) => { el.textContent = String(n); });
  }

  function stockBadge(product) {
    if (!product.available) return '<span class="stock stock-out">Out of stock</span>';
    if (product.variants.some((v) => v.lowStock) && product.variants.filter((v) => v.available).every((v) => v.lowStock)) {
      return '<span class="stock stock-low">Low stock</span>';
    }
    return '<span class="stock stock-in">In stock</span>';
  }

  function productCard(p) {
    const firstAvailable = p.variants.find((v) => v.available);
    const priceText = p.minPriceCents === p.maxPriceCents ? money(p.minPriceCents) : `<small>FROM</small>${money(p.minPriceCents)}`;
    return `
      <article class="card ${p.available ? '' : 'is-sold-out'}" data-product="${escapeHtml(p.slug)}">
        <a class="card-media" href="/product.html?slug=${encodeURIComponent(p.slug)}" aria-label="${escapeHtml(p.name)}">
          ${p.available ? (p.featured ? '<span class="badge">Signature</span>' : '') : '<span class="badge badge-soldout">Out of stock</span>'}
          <img src="${escapeHtml(p.imageUrl || '/images/placeholder.svg')}" alt="${escapeHtml(p.name)} bottle" loading="lazy">
        </a>
        <div class="card-body">
          <span class="card-meta">${escapeHtml([p.style, p.gender].filter(Boolean).join(' · '))}</span>
          <h3 class="card-title"><a href="/product.html?slug=${encodeURIComponent(p.slug)}">${escapeHtml(p.name)}</a></h3>
          <p class="card-desc">${escapeHtml(p.tagline || p.description)}</p>
          <div class="card-foot">
            <span class="price">${priceText}</span>
            ${stockBadge(p)}
          </div>
          ${p.available
            ? `<button class="btn btn-outline btn-block" type="button" data-quick-add="${firstAvailable.id}" data-max="${firstAvailable.maxQuantity}" data-name="${escapeHtml(p.name)}" data-label="${escapeHtml(firstAvailable.label)}">Add ${escapeHtml(firstAvailable.label)} to bag</button>`
            : '<button class="btn btn-sold-out btn-block" type="button" disabled aria-disabled="true">Out of stock</button>'}
        </div>
      </article>`;
  }

  document.addEventListener('DOMContentLoaded', () => {
    renderHeader();
    renderFooter();
  });
  window.addEventListener('storage', (e) => { if (e.key === CART_KEY) renderCartCount(); });

  window.JH = { api, cart, money, escapeHtml, toast, productCard, stockBadge, MAX_QTY };
})();
