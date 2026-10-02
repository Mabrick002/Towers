/* Product detail page: option (size) selection, quantity and add to bag. */
(function () {
  'use strict';
  const { api, cart, money, escapeHtml, toast, stockBadge } = window.JH;

  const root = document.getElementById('product-root');
  const slug = new URLSearchParams(location.search).get('slug');
  let product;
  let selected;
  let qty = 1;

  function notFound() {
    root.classList.remove('pdp');
    root.setAttribute('aria-busy', 'false');
    root.innerHTML = `<div class="empty"><h2>Fragrance not found</h2><p>It may have been removed from the collection.</p>
      <a class="btn btn-outline" href="/#collection">Back to the collection</a></div>`;
    document.getElementById('crumb-name').textContent = 'Not found';
  }

  // How many more of the selected option can go into the bag.
  function remainingFor(variant) {
    const inBag = cart.items().find((i) => i.variantId === variant.id)?.quantity || 0;
    return Math.max(0, variant.maxQuantity - inBag);
  }

  function render() {
    const soldOut = !product.available;
    const remaining = selected ? remainingFor(selected) : 0;
    qty = Math.max(1, Math.min(qty, remaining || 1));

    root.setAttribute('aria-busy', 'false');
    root.innerHTML = `
      <div class="pdp-media ${soldOut ? 'is-sold-out' : ''}">
        ${soldOut ? '<span class="badge badge-soldout">Out of stock</span>' : ''}
        <img src="${escapeHtml(product.imageUrl || '/images/placeholder.svg')}" alt="${escapeHtml(product.name)} bottle">
      </div>
      <div>
        <span class="eyebrow">${escapeHtml([product.style, product.gender].filter(Boolean).join(' · '))}</span>
        <h1>${escapeHtml(product.name)}</h1>
        ${product.tagline ? `<p class="tagline">${escapeHtml(product.tagline)}</p>` : ''}
        <div class="price-lg" id="price">${money(selected ? selected.priceCents : product.minPriceCents)}</div>
        <div>${stockBadge(product)}</div>
        <p class="desc">${escapeHtml(product.description)}</p>

        ${soldOut ? `<div class="notice notice-error" role="alert" id="sold-out-notice">
            <strong>Out of stock.</strong> This fragrance is currently unavailable and cannot be added to your bag. Please check back soon.
          </div>` : ''}

        <span class="option-label" id="size-label">Size</span>
        <div class="options" role="radiogroup" aria-labelledby="size-label">
          ${product.variants.map((v) => `
            <button type="button" class="option" role="radio" data-variant="${v.id}"
              aria-checked="${selected && selected.id === v.id}" ${v.available ? '' : 'disabled aria-disabled="true"'}>
              <strong>${escapeHtml(v.label)}</strong>
              <span>${v.available ? money(v.priceCents) : 'Sold out'}</span>
            </button>`).join('')}
        </div>

        ${selected && selected.lowStock ? `<p class="notice notice-warn">Only a few left in ${escapeHtml(selected.label)}.</p>` : ''}
        ${selected && remaining === 0 ? '<p class="notice notice-warn">You already have all available stock of this size in your bag.</p>' : ''}

        <span class="option-label">Quantity</span>
        <div class="buy-row">
          <div class="qty">
            <button type="button" data-qty="-1" aria-label="Decrease quantity" ${soldOut || qty <= 1 ? 'disabled' : ''}>−</button>
            <input type="number" id="qty" min="1" max="${remaining || 1}" value="${qty}" aria-label="Quantity" ${soldOut || !remaining ? 'disabled' : ''}>
            <button type="button" data-qty="1" aria-label="Increase quantity" ${soldOut || qty >= remaining ? 'disabled' : ''}>+</button>
          </div>
          ${soldOut
            ? '<button class="btn btn-sold-out" type="button" id="add-to-cart" disabled aria-disabled="true">Out of stock</button>'
            : `<button class="btn btn-gold" type="button" id="add-to-cart" ${remaining ? '' : 'disabled'}>Add to bag · ${money(selected.priceCents * qty)}</button>`}
        </div>

        <dl class="notes">
          ${product.notes.top ? `<div class="note-row"><dt>Top</dt><dd>${escapeHtml(product.notes.top)}</dd></div>` : ''}
          ${product.notes.heart ? `<div class="note-row"><dt>Heart</dt><dd>${escapeHtml(product.notes.heart)}</dd></div>` : ''}
          ${product.notes.base ? `<div class="note-row"><dt>Base</dt><dd>${escapeHtml(product.notes.base)}</dd></div>` : ''}
        </dl>
        <div class="assurances">
          <div>Tracked delivery<br>in 2–4 days</div>
          <div>Free shipping<br>over $150</div>
          <div>Secure<br>checkout</div>
        </div>
      </div>`;
  }

  root.addEventListener('click', (e) => {
    const option = e.target.closest('[data-variant]');
    if (option && !option.disabled) {
      selected = product.variants.find((v) => v.id === Number(option.dataset.variant));
      qty = 1;
      render();
      return;
    }
    const step = e.target.closest('[data-qty]');
    if (step && !step.disabled) {
      qty += Number(step.dataset.qty);
      render();
      return;
    }
    if (e.target.closest('#add-to-cart') && selected && product.available && selected.available) {
      const { added } = cart.add(selected.id, qty, selected.maxQuantity);
      if (added) {
        toast(`${added} × ${product.name} (${selected.label}) added to your bag.`, { action: { href: '/cart.html', label: 'View bag' } });
      } else {
        toast('No more of this size is available.', { type: 'error' });
      }
      qty = 1;
      render();
    }
  });

  root.addEventListener('change', (e) => {
    if (e.target.id === 'qty') {
      qty = Math.floor(Number(e.target.value)) || 1;
      render();
    }
  });

  if (!slug) return notFound();
  api(`/products/${encodeURIComponent(slug)}`)
    .then((data) => {
      product = data.product;
      selected = product.variants.find((v) => v.available) || null;
      document.title = `${product.name} — Jinghengda International Limited`;
      document.getElementById('crumb-name').textContent = product.name;
      render();
    })
    .catch(notFound);
})();
