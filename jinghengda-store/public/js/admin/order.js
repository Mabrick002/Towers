(function () {
  'use strict';
  const { api, escapeHtml, money, date, renderLayout, toast, pill } = window.Admin;
  renderLayout('orders');

  const root = document.getElementById('order-root');
  const id = Number(new URLSearchParams(location.search).get('id'));

  function render({ order: o, statuses, paymentStatuses }) {
    const s = o.shipping;
    const locked = o.status === 'Cancelled';
    root.innerHTML = `
      <div class="admin-top">
        <div>
          <a class="link-btn" href="/admin/orders.html">← All orders</a>
          <h1>${escapeHtml(o.orderNumber)}</h1>
          <span class="muted">Placed ${date(o.createdAt)} · Updated ${date(o.updatedAt)}</span>
        </div>
        <div class="actions">${pill(o.status)} ${pill(o.paymentStatus)}</div>
      </div>

      <div class="panels-2">
        <div>
          <section class="panel">
            <div class="panel-head"><h2>Items ordered</h2><span class="muted">${o.itemCount} item${o.itemCount === 1 ? '' : 's'}</span></div>
            <div class="table-wrap">
              <table class="data" id="order-items">
                <thead><tr><th>Product</th><th>Option</th><th class="num">Unit price</th><th class="num">Qty</th><th class="num">Line total</th></tr></thead>
                <tbody>${o.items.map((i) => `
                  <tr>
                    <td><div class="prod-cell"><img src="${escapeHtml(i.imageUrl || '/images/placeholder.svg')}" alt=""><strong>${escapeHtml(i.name)}</strong></div></td>
                    <td>${escapeHtml(i.variantLabel)}</td>
                    <td class="num">${money(i.unitPriceCents)}</td>
                    <td class="num">${i.quantity}</td>
                    <td class="num">${money(i.lineTotalCents)}</td>
                  </tr>`).join('')}</tbody>
              </table>
            </div>
            <div class="panel-body">
              <div class="totals">
                <div class="summary-row"><span>Subtotal</span><span>${money(o.subtotalCents)}</span></div>
                <div class="summary-row"><span>Shipping</span><span>${o.shippingCents ? money(o.shippingCents) : 'Free'}</span></div>
                <div class="summary-row total"><span>Order total</span><span id="order-total">${money(o.totalCents)}</span></div>
              </div>
            </div>
          </section>

          <section class="panel">
            <div class="panel-head"><h2>Customer</h2></div>
            <div class="panel-body">
              <dl class="kv">
                <dt>Name</dt><dd id="customer-name">${escapeHtml(o.customer.name)}</dd>
                <dt>Email</dt><dd><a href="mailto:${escapeHtml(o.customer.email)}">${escapeHtml(o.customer.email)}</a></dd>
                <dt>Phone</dt><dd><a href="tel:${escapeHtml(o.customer.phone)}">${escapeHtml(o.customer.phone)}</a></dd>
                <dt>Ship to</dt>
                <dd class="address">${escapeHtml(s.line1)}${s.line2 ? `<br>${escapeHtml(s.line2)}` : ''}<br>
                  ${escapeHtml([s.city, s.state, s.postal].filter(Boolean).join(', '))}<br>${escapeHtml(s.country)}</dd>
                <dt>Customer notes</dt><dd>${o.customerNotes ? escapeHtml(o.customerNotes) : '<span class="muted">None</span>'}</dd>
                <dt>Payment</dt><dd>${escapeHtml(o.paymentProvider)}${o.paymentReference ? ` · ${escapeHtml(o.paymentReference)}` : ''}</dd>
              </dl>
            </div>
          </section>
        </div>

        <section class="panel">
          <div class="panel-head"><h2>Update order</h2></div>
          <form class="panel-body" id="status-form">
            ${locked ? '<div class="notice notice-warn">This order was cancelled and its items were returned to inventory.</div>' : ''}
            <div class="field">
              <label for="status">Order status</label>
              <select class="input" id="status" ${locked ? 'disabled' : ''}>
                ${statuses.map((st) => `<option ${st === o.status ? 'selected' : ''}>${st}</option>`).join('')}
              </select>
              <p class="help">Cancelling an order returns its items to inventory.</p>
            </div>
            <div class="field">
              <label for="payment-status">Payment status</label>
              <select class="input" id="payment-status">
                ${paymentStatuses.map((st) => `<option ${st === o.paymentStatus ? 'selected' : ''}>${st}</option>`).join('')}
              </select>
            </div>
            <div class="field">
              <label for="admin-notes">Internal notes</label>
              <textarea class="input" id="admin-notes" rows="4" placeholder="Tracking number, payment details… (not shown to the customer)">${escapeHtml(o.adminNotes)}</textarea>
            </div>
            <button class="btn btn-gold btn-block" type="submit" id="save-order">Save changes</button>
          </form>
        </section>
      </div>`;
  }

  async function load() {
    render(await api(`/orders/${id}`));
  }

  root.addEventListener('submit', async (e) => {
    if (e.target.id !== 'status-form') return;
    e.preventDefault();
    const status = document.getElementById('status').value;
    if (status === 'Cancelled' && !confirm('Cancel this order? Its items will be returned to inventory. This cannot be undone.')) return;
    const btn = document.getElementById('save-order');
    btn.disabled = true;
    try {
      await api(`/orders/${id}`, {
        method: 'PATCH',
        body: {
          status,
          paymentStatus: document.getElementById('payment-status').value,
          adminNotes: document.getElementById('admin-notes').value,
        },
      });
      toast('Order updated.');
      await load();
    } catch (err) {
      toast(err.message, 'error');
      btn.disabled = false;
    }
  });

  if (!id) {
    root.innerHTML = '<div class="notice notice-error">Missing order id.</div>';
  } else {
    load().catch((err) => { root.innerHTML = `<div class="notice notice-error">${escapeHtml(err.message)}</div>`; });
  }
})();
