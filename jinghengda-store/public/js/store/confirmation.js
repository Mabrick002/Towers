/* Order confirmation: loads the order with its private token and shows a receipt. */
(function () {
  'use strict';
  const { api, money, escapeHtml } = window.JH;
  const root = document.getElementById('confirm-root');
  const params = new URLSearchParams(location.search);
  const orderNumber = params.get('order');
  const token = params.get('token');

  function fail() {
    root.innerHTML = `<div class="empty"><h2>Order not found</h2><p>Please check the link in your confirmation, or contact us at
      <a href="mailto:orders@jinghengdainternational.com">orders@jinghengdainternational.com</a>.</p>
      <a class="btn btn-outline" href="/">Return home</a></div>`;
  }

  function paymentNotice(order) {
    if (params.get('payment') === 'cancelled' && order.paymentStatus !== 'Paid') {
      return '<div class="notice notice-warn">Your payment was not completed. Your order is saved — we will contact you with payment options.</div>';
    }
    if (params.get('payment') === 'error') {
      return '<div class="notice notice-warn">Your order was saved, but online payment could not be started. We will email you payment instructions.</div>';
    }
    if (order.paymentStatus === 'Paid') return '<div class="notice notice-ok">Payment received — thank you.</div>';
    if (order.paymentProvider === 'manual') {
      return '<div class="notice notice-warn">No payment has been taken yet. We will email you secure payment instructions shortly; your order ships once payment is received.</div>';
    }
    return '';
  }

  if (!orderNumber || !token) return fail();

  api(`/orders/${encodeURIComponent(orderNumber)}?token=${encodeURIComponent(token)}`)
    .then(({ order }) => {
      const s = order.shipping;
      root.innerHTML = `
        <div class="confirm-icon"><svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg></div>
        <span class="eyebrow">Order confirmed</span>
        <h1>Thank you, ${escapeHtml(order.customer.name.split(' ')[0])}.</h1>
        <p class="lead">Your order has been received. A copy of these details is saved under order
          <strong>${escapeHtml(order.orderNumber)}</strong> — please keep it for your records.</p>
        ${paymentNotice(order)}
        <div class="order-box">
          <div class="order-box-head">
            <div><span>Order number</span><strong id="order-number">${escapeHtml(order.orderNumber)}</strong></div>
            <div><span>Status</span><strong>${escapeHtml(order.status)}</strong></div>
            <div><span>Total</span><strong>${money(order.totalCents)}</strong></div>
          </div>
          ${order.items.map((i) => `
            <div class="mini-line">
              <img src="${escapeHtml(i.imageUrl || '/images/placeholder.svg')}" alt="">
              <div class="grow">${escapeHtml(i.name)}<small>${escapeHtml(i.variantLabel)} × ${i.quantity} · ${money(i.unitPriceCents)} each</small></div>
              <span>${money(i.lineTotalCents)}</span>
            </div>`).join('')}
          <div class="summary-row"><span>Subtotal</span><span>${money(order.subtotalCents)}</span></div>
          <div class="summary-row"><span>Shipping</span><span>${order.shippingCents ? money(order.shippingCents) : 'Free'}</span></div>
          <div class="summary-row total"><span>Total</span><span>${money(order.totalCents)}</span></div>
          <div class="ship-to">
            <div>
              <h3>Shipping to</h3>
              ${escapeHtml(order.customer.name)}<br>${escapeHtml(s.line1)}${s.line2 ? `<br>${escapeHtml(s.line2)}` : ''}<br>
              ${escapeHtml([s.city, s.state, s.postal].filter(Boolean).join(', '))}<br>${escapeHtml(s.country)}
            </div>
            <div>
              <h3>Contact</h3>
              ${escapeHtml(order.customer.email)}<br>${escapeHtml(order.customer.phone)}
            </div>
          </div>
        </div>
        <a class="btn btn-gold" href="/#collection">Continue shopping</a>`;
    })
    .catch(fail);
})();
