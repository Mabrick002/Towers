/* Shared admin helpers: authenticated API calls, layout, formatting. */
(function () {
  'use strict';

  const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[c]);
  const money = (cents) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format((cents || 0) / 100);
  const date = (iso) => {
    const d = new Date(`${iso.replace(' ', 'T')}${iso.endsWith('Z') ? '' : 'Z'}`);
    return d.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
  };

  async function api(path, options = {}) {
    const isForm = options.body instanceof FormData;
    const res = await fetch(`/api/admin${path}`, {
      method: options.method || 'GET',
      credentials: 'same-origin',
      headers: options.body && !isForm ? { 'Content-Type': 'application/json' } : undefined,
      body: options.body ? (isForm ? options.body : JSON.stringify(options.body)) : undefined,
    });
    if (res.status === 401 && !options.allow401) {
      location.href = '/admin/login.html';
      throw new Error('Signed out');
    }
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw Object.assign(new Error(data.error || 'Request failed.'), { status: res.status });
    return data;
  }

  const icons = {
    dashboard: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="3" width="7" height="9"/><rect x="14" y="3" width="7" height="5"/><rect x="14" y="12" width="7" height="9"/><rect x="3" y="16" width="7" height="5"/></svg>',
    products: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M9 3h6v3H9z"/><path d="M7 6h10l1 4v9a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2v-9z"/></svg>',
    orders: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M6 3h12v18l-3-2-3 2-3-2-3 2z"/><path d="M9 8h6M9 12h6"/></svg>',
    store: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M4 9l1.5-5h13L20 9"/><path d="M4 9h16v11H4z"/><path d="M9 20v-6h6v6"/></svg>',
  };

  function renderLayout(active) {
    const shell = document.querySelector('[data-admin-shell]');
    if (!shell) return;
    const content = shell.innerHTML;
    const link = (href, key, label) =>
      `<a href="${href}" ${active === key ? 'aria-current="page"' : ''}>${icons[key]}${label}</a>`;
    shell.className = 'admin-shell';
    shell.innerHTML = `
      <aside class="sidebar" id="sidebar">
        <div>
          <a class="brand" href="/admin/dashboard.html">
            <span class="brand-name">JINGHENGDA</span>
            <span class="brand-sub">INTERNATIONAL LIMITED</span>
          </a>
          <div class="admin-tag">Store admin</div>
        </div>
        <nav class="side-nav" aria-label="Admin">
          ${link('/admin/dashboard.html', 'dashboard', 'Dashboard')}
          ${link('/admin/orders.html', 'orders', 'Orders')}
          ${link('/admin/products.html', 'products', 'Products')}
          <a href="/" target="_blank" rel="noopener">${icons.store}View store ↗</a>
        </nav>
        <div class="side-foot">
          Signed in as<strong id="admin-name">…</strong>
          <span id="admin-email"></span><br>
          <button class="link-btn" type="button" id="logout">Sign out</button>
        </div>
      </aside>
      <div>
        <div class="mobile-bar">
          <a class="brand" href="/admin/dashboard.html"><span class="brand-name">JINGHENGDA</span></a>
          <button class="menu-toggle" type="button" id="side-toggle" aria-label="Menu" aria-controls="sidebar" aria-expanded="false"><span></span><span></span><span></span></button>
        </div>
        <main class="admin-main">${content}</main>
      </div>`;

    document.getElementById('logout').addEventListener('click', async () => {
      await fetch('/api/admin/logout', { method: 'POST', credentials: 'same-origin' });
      location.href = '/admin/login.html';
    });
    const toggle = document.getElementById('side-toggle');
    toggle.addEventListener('click', () => {
      const open = document.getElementById('sidebar').classList.toggle('open');
      toggle.setAttribute('aria-expanded', String(open));
    });
    api('/me').then(({ admin }) => {
      document.getElementById('admin-name').textContent = admin.name;
      document.getElementById('admin-email').textContent = admin.email;
    }).catch(() => {});
  }

  function toast(message, type = 'info') {
    let wrap = document.querySelector('.toast-wrap');
    if (!wrap) {
      wrap = document.createElement('div');
      wrap.className = 'toast-wrap';
      wrap.setAttribute('role', 'status');
      document.body.appendChild(wrap);
    }
    const el = document.createElement('div');
    el.className = `toast ${type === 'error' ? 'error' : ''}`;
    el.textContent = message;
    wrap.appendChild(el);
    setTimeout(() => el.remove(), 3800);
  }

  const pill = (value, cls = value) => `<span class="pill pill-${escapeHtml(cls)}">${escapeHtml(value)}</span>`;

  function stockPill(p) {
    if (!p.inStock) return pill('Out of stock', 'out');
    if (p.totalStock === 0) return pill('Sold out (0 units)', 'out');
    if (p.variants.some((v) => v.stock > 0 && v.stock <= 5)) return pill(`Low · ${p.totalStock} units`, 'low');
    return pill(`In stock · ${p.totalStock} units`, 'in');
  }

  window.Admin = { api, escapeHtml, money, date, renderLayout, toast, pill, stockPill };
})();
