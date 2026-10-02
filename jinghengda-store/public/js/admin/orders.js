(function () {
  'use strict';
  const { api, escapeHtml, money, date, renderLayout, pill } = window.Admin;
  renderLayout('orders');

  const root = document.getElementById('orders-root');
  const search = document.getElementById('search');
  const statusFilter = document.getElementById('status-filter');
  const params = new URLSearchParams(location.search);
  let timer;

  async function load() {
    const qs = new URLSearchParams();
    if (statusFilter.value) qs.set('status', statusFilter.value);
    if (search.value.trim()) qs.set('q', search.value.trim());
    const { orders, statuses } = await api(`/orders?${qs}`);
    if (statusFilter.options.length === 1) {
      statusFilter.insertAdjacentHTML('beforeend', statuses.map((s) => `<option value="${s}">${s}</option>`).join(''));
      if (params.get('status')) {
        statusFilter.value = params.get('status');
        return load();
      }
    }
    root.innerHTML = orders.length ? `
      <table class="data">
        <thead><tr><th>Order</th><th>Date</th><th>Customer</th><th>Ship to</th><th>Items</th><th>Payment</th><th>Status</th><th class="num">Total</th></tr></thead>
        <tbody>${orders.map((o) => `
          <tr class="clickable" data-href="/admin/order.html?id=${o.id}">
            <td><a href="/admin/order.html?id=${o.id}"><strong>${escapeHtml(o.orderNumber)}</strong></a></td>
            <td>${date(o.createdAt)}</td>
            <td>${escapeHtml(o.customer.name)}<br><small class="muted">${escapeHtml(o.customer.email)}</small></td>
            <td>${escapeHtml(o.shipping.city)}, ${escapeHtml(o.shipping.country)}</td>
            <td>${o.itemCount}</td>
            <td>${pill(o.paymentStatus)}</td>
            <td>${pill(o.status)}</td>
            <td class="num">${money(o.totalCents)}</td>
          </tr>`).join('')}</tbody>
      </table>` : '<div class="panel-body muted">No orders match.</div>';
  }

  root.addEventListener('click', (e) => {
    const row = e.target.closest('tr[data-href]');
    if (row && !e.target.closest('a')) location.href = row.dataset.href;
  });
  statusFilter.addEventListener('change', load);
  search.addEventListener('input', () => { clearTimeout(timer); timer = setTimeout(load, 250); });
  load().catch((err) => { root.innerHTML = `<div class="panel-body notice notice-error">${escapeHtml(err.message)}</div>`; });
})();
