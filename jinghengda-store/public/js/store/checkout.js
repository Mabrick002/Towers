/* Checkout: validates the form, submits the order, then routes to confirmation or a payment page. */
(function () {
  'use strict';
  const { api, cart, money, escapeHtml } = window.JH;

  const form = document.getElementById('checkout-form');
  const alertBox = document.getElementById('form-alert');
  const submit = document.getElementById('place-order');
  const REQUIRED = ['name', 'email', 'phone', 'line1', 'city', 'postal', 'country'];

  function showAlert(message, type = 'error') {
    alertBox.innerHTML = message ? `<div class="notice notice-${type}" role="alert">${escapeHtml(message)}</div>` : '';
    if (message) alertBox.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  async function loadSummary() {
    const items = cart.items();
    if (!items.length) {
      form.hidden = true;
      document.getElementById('checkout-empty').hidden = false;
      return null;
    }
    form.hidden = false;
    const quote = await api('/cart/quote', { method: 'POST', body: { items } });
    document.getElementById('summary-lines').innerHTML = quote.lines.map((l) => `
      <div class="mini-line">
        <img src="${escapeHtml(l.imageUrl || '/images/placeholder.svg')}" alt="">
        <div class="grow">${escapeHtml(l.name)}<small>${escapeHtml(l.variantLabel)} × ${l.quantity}</small></div>
        <span>${l.available ? money(l.lineTotalCents) : 'Unavailable'}</span>
      </div>`).join('');
    document.getElementById('sum-subtotal').textContent = money(quote.subtotalCents);
    document.getElementById('sum-shipping').textContent = quote.shippingCents ? money(quote.shippingCents) : 'Free';
    document.getElementById('sum-total').textContent = money(quote.totalCents);
    if (quote.problems.length) {
      showAlert(`${quote.problems.map((p) => p.message).join(' ')} Please update your bag before placing the order.`);
      submit.disabled = true;
    } else {
      submit.disabled = false;
    }
    return quote;
  }

  function validate() {
    let firstInvalid = null;
    form.querySelectorAll('.field-error').forEach((el) => el.remove());
    for (const name of REQUIRED) {
      const input = form.elements[name];
      const value = input.value.trim();
      let message = '';
      if (!value) message = 'This field is required.';
      else if (name === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) message = 'Please enter a valid email address.';
      input.setAttribute('aria-invalid', message ? 'true' : 'false');
      if (message) {
        const err = document.createElement('div');
        err.className = 'field-error';
        err.textContent = message;
        input.insertAdjacentElement('afterend', err);
        firstInvalid = firstInvalid || input;
      }
    }
    if (firstInvalid) firstInvalid.focus();
    return !firstInvalid;
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    showAlert('');
    if (!validate()) return;

    const customer = Object.fromEntries(
      ['name', 'email', 'phone', 'line1', 'line2', 'city', 'state', 'postal', 'country', 'notes']
        .map((k) => [k, form.elements[k].value.trim()])
    );
    submit.disabled = true;
    submit.textContent = 'Placing order…';
    try {
      const result = await api('/orders', { method: 'POST', body: { customer, items: cart.items() } });
      cart.clear();
      if (result.payment.type === 'redirect' && result.payment.url) {
        location.href = result.payment.url;
        return;
      }
      const params = new URLSearchParams({ order: result.orderNumber, token: result.token });
      if (result.payment.type === 'error') params.set('payment', 'error');
      location.href = `/order-confirmation.html?${params}`;
    } catch (err) {
      showAlert(err.message);
      submit.textContent = 'Place order';
      await loadSummary().catch(() => {});
    }
  });

  api('/config').then((cfg) => {
    if (cfg.paymentProvider === 'stripe') {
      document.getElementById('payment-copy').innerHTML = '<strong>Card payment</strong><p>After placing your order you will be redirected to our secure payment partner, Stripe, to pay by card.</p>';
      submit.textContent = 'Continue to payment';
    }
  }).catch(() => {});

  loadSummary().catch((err) => showAlert(err.message));
})();
