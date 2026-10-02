/* Cart page: live pricing from the server, quantity changes, removal. */
(function () {
  'use strict';
  const { api, cart, money, escapeHtml } = window.JH;
  const root = document.getElementById('cart-root');

  function emptyState() {
    root.innerHTML = `<div class="empty"><h2>Your bag is empty</h2><p>Discover a fragrance that feels like you.</p>
      <a class="btn btn-gold" href="/#collection">Explore the collection</a></div>`;
  }

  function lineHtml(line, problem) {
    const max = Math.max(line.maxQuantity, 0);
    return `
      <div class="cart-line ${problem ? 'has-problem' : ''}" data-line="${line.variantId}">
        <a href="/product.html?slug=${encodeURIComponent(line.slug)}"><img src="${escapeHtml(line.imageUrl || '/images/placeholder.svg')}" alt=""></a>
        <div>
          <h3><a href="/product.html?slug=${encodeURIComponent(line.slug)}">${escapeHtml(line.name)}</a></h3>
          <div class="meta">${escapeHtml(line.variantLabel)} · ${money(line.unitPriceCents)} each</div>
          <div class="line-actions">
            ${line.available || max > 0 ? `
            <div class="qty qty-sm">
              <button type="button" data-step="-1" aria-label="Decrease quantity of ${escapeHtml(line.name)}" ${line.quantity <= 1 ? 'disabled' : ''}>−</button>
              <input type="number" min="1" max="${max}" value="${line.quantity}" data-qty-input aria-label="Quantity of ${escapeHtml(line.name)}">
              <button type="button" data-step="1" aria-label="Increase quantity of ${escapeHtml(line.name)}" ${line.quantity >= max ? 'disabled' : ''}>+</button>
            </div>` : ''}
            <button type="button" class="link-btn" data-remove>Remove</button>
          </div>
          ${problem ? `<div class="problem" role="alert">${escapeHtml(problem.message)}${max > 0 ? '' : ' Please remove it to continue.'}</div>` : ''}
        </div>
        <div class="line-total">${line.available ? money(line.lineTotalCents) : '—'}</div>
      </div>`;
  }

  async function render() {
    const items = cart.items();
    if (!items.length) return emptyState();

    let quote;
    try {
      quote = await api('/cart/quote', { method: 'POST', body: { items } });
    } catch (err) {
      root.innerHTML = `<div class="notice notice-error">${escapeHtml(err.message)}</div>`;
      return;
    }

    // Drop lines for products that were deleted from the catalogue.
    const known = new Set(quote.lines.map((l) => l.variantId));
    if (items.some((i) => !known.has(i.variantId))) {
      items.filter((i) => !known.has(i.variantId)).forEach((i) => cart.remove(i.variantId));
      return; // cart:change triggers a re-render
    }

    const problems = new Map(quote.problems.map((p) => [p.variantId, p]));
    const remainingForFree = Math.max(0, quote.freeShippingThresholdCents - quote.subtotalCents);
    const progress = Math.min(100, Math.round((quote.subtotalCents / quote.freeShippingThresholdCents) * 100));

    root.innerHTML = `
      <div class="layout-2">
        <section aria-label="Items in your bag">
          ${problems.size ? '<div class="notice notice-error" role="alert">Some items in your bag need attention before checkout.</div>' : ''}
          ${quote.lines.map((l) => lineHtml(l, problems.get(l.variantId))).join('')}
          <p><a class="link-btn" href="/#collection">← Continue shopping</a></p>
        </section>
        <aside class="summary" aria-label="Order summary">
          <h2>Summary</h2>
          ${remainingForFree > 0
            ? `<p class="ship-progress">You're ${money(remainingForFree)} away from free shipping.</p>`
            : '<p class="ship-progress">You qualify for free shipping.</p>'}
          <div class="bar"><span id="ship-bar"></span></div>
          <div class="summary-row"><span>Subtotal</span><span id="subtotal">${money(quote.subtotalCents)}</span></div>
          <div class="summary-row"><span>Shipping</span><span>${quote.shippingCents ? money(quote.shippingCents) : 'Free'}</span></div>
          <div class="summary-row total"><span>Total</span><span id="total">${money(quote.totalCents)}</span></div>
          <a class="btn btn-gold btn-block ${problems.size ? 'is-disabled' : ''}" id="checkout-btn"
             href="${problems.size ? '#' : '/checkout.html'}" ${problems.size ? 'aria-disabled="true"' : ''}>Proceed to checkout</a>
          <p class="fine">Taxes, if applicable, are confirmed with your order.</p>
        </aside>
      </div>`;
    document.getElementById('ship-bar').style.width = `${progress}%`;
    if (problems.size) {
      document.getElementById('checkout-btn').addEventListener('click', (e) => e.preventDefault());
    }
  }

  root.addEventListener('click', (e) => {
    const line = e.target.closest('[data-line]');
    if (!line) return;
    const variantId = Number(line.dataset.line);
    if (e.target.closest('[data-remove]')) {
      cart.remove(variantId);
      return;
    }
    const step = e.target.closest('[data-step]');
    if (step && !step.disabled) {
      const current = cart.items().find((i) => i.variantId === variantId)?.quantity || 0;
      cart.set(variantId, current + Number(step.dataset.step));
    }
  });

  root.addEventListener('change', (e) => {
    if (!e.target.matches('[data-qty-input]')) return;
    const line = e.target.closest('[data-line]');
    const max = Number(e.target.max) || 1;
    const value = Math.max(1, Math.min(max, Math.floor(Number(e.target.value)) || 1));
    cart.set(Number(line.dataset.line), value);
  });

  document.addEventListener('cart:change', render);
  render();
})();
