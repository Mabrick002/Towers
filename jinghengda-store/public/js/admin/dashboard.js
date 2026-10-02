(function () {
  'use strict';
  const { api, escapeHtml, money, date, renderLayout, pill } = window.Admin;
  renderLayout('dashboard');
  const root = document.getElementById('dash-root');

  api('/stats').then((s) => {
    const open = s.ordersByStatus.Pending + s.ordersByStatus.Processing;
    root.innerHTML = `
      <div class="stats">
        <div class="stat"><div class="label">Revenue</div><div class="value">${money(s.revenueCents)}</div><div class="sub">Excludes cancelled orders</div></div>
        <div class="stat"><div class="label">Orders</div><div class="value">${s.totalOrders}</div><div class="sub">${s.ordersByStatus.Completed} completed</div></div>
        <div class="stat"><div class="label">Needs action</div><div class="value">${open}</div><div class="sub">${s.ordersByStatus.Pending} pending · ${s.ordersByStatus.Processing} processing</div></div>
        <div class="stat"><div class="label">Products</div><div class="value">${s.productCount}</div><div class="sub">${s.outOfStockCount} out of stock</div></div>
      </div>
      <div class="panels-2">
        <section class="panel">
          <div class="panel-head"><h2>Recent orders</h2><a class="btn btn-ghost btn-sm" href="/admin/orders.html">All orders</a></div>
          <div class="table-wrap">
            ${s.recentOrders.length ? `<table class="data">
              <thead><tr><th>Order</th><th>Customer</th><th>Status</th><th class="num">Total</th></tr></thead>
              <tbody>${s.recentOrders.map((o) => `
                <tr class="clickable" data-href="/admin/order.html?id=${o.id}">
                  <td><a href="/admin/order.html?id=${o.id}"><strong>${escapeHtml(o.orderNumber)}</strong></a><br><small class="muted">${date(o.createdAt)}</small></td>
                  <td>${escapeHtml(o.customer.name)}<br><small class="muted">${o.itemCount} item${o.itemCount === 1 ? '' : 's'}</small></td>
                  <td>${pill(o.status)}</td>
                  <td class="num">${money(o.totalCents)}</td>
                </tr>`).join('')}</tbody></table>`
              : '<div class="panel-body muted">No orders yet. New orders appear here as soon as customers check out.</div>'}
          </div>
        </section>
        <section class="panel">
          <div class="panel-head"><h2>Low stock</h2><a class="btn btn-ghost btn-sm" href="/admin/products.html">Inventory</a></div>
          <div class="panel-body">
            ${s.lowStock.length ? `<table class="data"><tbody>${s.lowStock.map((l) => `
              <tr><td><a href="/admin/product-edit.html?id=${l.id}">${escapeHtml(l.name)}</a><br><small class="muted">${escapeHtml(l.label)}</small></td>
              <td class="num">${pill(`${l.stock} left`, 'low')}</td></tr>`).join('')}</tbody></table>`
              : '<p class="muted">All in-stock sizes have more than 5 units.</p>'}
          </div>
        </section>
      </div>`;
  }).catch((err) => { root.innerHTML = `<div class="notice notice-error">${escapeHtml(err.message)}</div>`; });

  root.addEventListener('click', (e) => {
    const row = e.target.closest('tr[data-href]');
    if (row && !e.target.closest('a')) location.href = row.dataset.href;
  });
})();
