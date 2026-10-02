(function () {
  'use strict';
  const { api, escapeHtml, renderLayout, toast } = window.Admin;
  renderLayout('products');

  const root = document.getElementById('edit-root');
  const id = Number(new URLSearchParams(location.search).get('id')) || null;
  const STYLES = ['Woody', 'Amber', 'Floral', 'Fresh', 'Powdery', 'Citrus', 'Gourmand', 'Aromatic'];

  const blank = {
    name: '', tagline: '', description: '', style: '', gender: 'Unisex', imageUrl: '',
    notes: { top: '', heart: '', base: '' }, inStock: true, featured: false, sortOrder: 0,
    variants: [{ label: '50 ml', priceCents: 0, stock: 0 }],
  };

  const variantRow = (v = {}) => `
    <tr data-variant-row data-variant-id="${v.id || ''}">
      <td><input class="input" name="v-label" value="${escapeHtml(v.label || '')}" placeholder="e.g. 50 ml" aria-label="Option label" required maxlength="40"></td>
      <td><input class="input" name="v-price" type="number" min="0" step="0.01" value="${v.priceCents !== undefined ? (v.priceCents / 100).toFixed(2) : ''}" aria-label="Price (USD)" required></td>
      <td><input class="input" name="v-stock" type="number" min="0" step="1" value="${v.stock ?? 0}" aria-label="Units in stock" required></td>
      <td><button class="btn btn-danger btn-sm" type="button" data-remove-variant aria-label="Remove option">✕</button></td>
    </tr>`;

  function render(p) {
    const isNew = !p.id;
    document.title = `${isNew ? 'Add product' : `Edit ${p.name}`} — Jinghengda Admin`;
    root.innerHTML = `
      <div class="admin-top">
        <div>
          <a class="link-btn" href="/admin/products.html">← All products</a>
          <h1>${isNew ? 'Add product' : escapeHtml(p.name)}</h1>
        </div>
        ${isNew ? '' : `<div class="actions"><a class="btn btn-ghost" href="/product.html?slug=${encodeURIComponent(p.slug)}" target="_blank" rel="noopener">View in store ↗</a></div>`}
      </div>
      <div id="form-alert"></div>
      <form id="product-form" novalidate>
        <div class="panels-2">
          <div>
            <section class="panel">
              <div class="panel-head"><h2>Details</h2></div>
              <div class="panel-body form-grid">
                <div class="field full"><label for="name">Product name *</label>
                  <input class="input" id="name" name="name" value="${escapeHtml(p.name)}" required maxlength="120"></div>
                <div class="field full"><label for="tagline">Short tagline</label>
                  <input class="input" id="tagline" name="tagline" value="${escapeHtml(p.tagline)}" maxlength="160" placeholder="Shown on product cards"></div>
                <div class="field full"><label for="description">Description</label>
                  <textarea class="input" id="description" name="description" rows="5" maxlength="4000">${escapeHtml(p.description)}</textarea></div>
                <div class="field"><label for="style">Style / family</label>
                  <input class="input" id="style" name="style" list="style-list" value="${escapeHtml(p.style)}" maxlength="40" placeholder="e.g. Woody">
                  <datalist id="style-list">${STYLES.map((s) => `<option value="${s}">`).join('')}</datalist></div>
                <div class="field"><label for="gender">For</label>
                  <select class="input" id="gender" name="gender">
                    ${['Unisex', 'For Her', 'For Him'].map((g) => `<option ${g === p.gender ? 'selected' : ''}>${g}</option>`).join('')}
                  </select></div>
                <div class="field"><label for="notes-top">Top notes</label>
                  <input class="input" id="notes-top" name="notesTop" value="${escapeHtml(p.notes.top)}" maxlength="200"></div>
                <div class="field"><label for="notes-heart">Heart notes</label>
                  <input class="input" id="notes-heart" name="notesHeart" value="${escapeHtml(p.notes.heart)}" maxlength="200"></div>
                <div class="field full"><label for="notes-base">Base notes</label>
                  <input class="input" id="notes-base" name="notesBase" value="${escapeHtml(p.notes.base)}" maxlength="200"></div>
              </div>
            </section>

            <section class="panel">
              <div class="panel-head"><h2>Sizes, prices &amp; inventory</h2>
                <button class="btn btn-outline btn-sm" type="button" id="add-variant">+ Add option</button></div>
              <div class="panel-body">
                <table class="variant-table">
                  <thead><tr><th>Option</th><th>Price (USD)</th><th>Units in stock</th><th></th></tr></thead>
                  <tbody id="variants">${p.variants.map(variantRow).join('')}</tbody>
                </table>
                <p class="help">Customers can only buy options with stock above 0. Orders reduce stock automatically.</p>
              </div>
            </section>
          </div>

          <div>
            <section class="panel">
              <div class="panel-head"><h2>Availability</h2></div>
              <div class="panel-body">
                <label class="switch">
                  <input type="checkbox" id="in-stock" ${p.inStock ? 'checked' : ''}>
                  <span class="track"></span><span id="in-stock-label">${p.inStock ? 'In stock — available to buy' : 'Out of stock — cannot be purchased'}</span>
                </label>
                <p class="help">Switch off to show “Out of stock” in the store and block purchases, regardless of unit counts.</p>
                <label class="check"><input type="checkbox" id="featured" ${p.featured ? 'checked' : ''}> Feature on the home page</label>
                <div class="field"><label for="sort-order">Display order</label>
                  <input class="input" id="sort-order" type="number" min="0" max="9999" value="${p.sortOrder}"></div>
              </div>
            </section>
            <section class="panel">
              <div class="panel-head"><h2>Image</h2></div>
              <div class="panel-body">
                <img class="image-preview" id="image-preview" src="${escapeHtml(p.imageUrl || '/images/placeholder.svg')}" alt="Product image preview">
                <div class="field"><label for="image-file">Upload image (JPG, PNG, WEBP · max 5 MB)</label>
                  <input class="input" id="image-file" type="file" accept="image/jpeg,image/png,image/webp"></div>
                <div class="field"><label for="image-url">…or image URL</label>
                  <input class="input" id="image-url" name="imageUrl" value="${escapeHtml(p.imageUrl)}" placeholder="https://…"></div>
              </div>
            </section>
          </div>
        </div>
        <div class="sticky-actions">
          ${isNew ? '' : '<button class="btn btn-danger" type="button" id="delete-product">Delete product</button>'}
          <a class="btn btn-ghost" href="/admin/products.html">Cancel</a>
          <button class="btn btn-gold" type="submit" id="save-product">${isNew ? 'Create product' : 'Save changes'}</button>
        </div>
      </form>`;
  }

  function collect() {
    const f = document.getElementById('product-form');
    const val = (sel) => f.querySelector(sel).value;
    return {
      name: val('#name'),
      tagline: val('#tagline'),
      description: val('#description'),
      style: val('#style'),
      gender: val('#gender'),
      notes: { top: val('#notes-top'), heart: val('#notes-heart'), base: val('#notes-base') },
      imageUrl: val('#image-url'),
      inStock: f.querySelector('#in-stock').checked,
      featured: f.querySelector('#featured').checked,
      sortOrder: val('#sort-order'),
      variants: [...f.querySelectorAll('[data-variant-row]')].map((row) => ({
        id: row.dataset.variantId ? Number(row.dataset.variantId) : undefined,
        label: row.querySelector('[name="v-label"]').value,
        price: row.querySelector('[name="v-price"]').value,
        stock: row.querySelector('[name="v-stock"]').value,
      })),
    };
  }

  function showError(message) {
    const box = document.getElementById('form-alert');
    box.innerHTML = message ? `<div class="notice notice-error" role="alert">${escapeHtml(message)}</div>` : '';
    if (message) box.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  root.addEventListener('click', async (e) => {
    if (e.target.id === 'add-variant') {
      document.getElementById('variants').insertAdjacentHTML('beforeend', variantRow({ stock: 0 }));
    }
    if (e.target.closest('[data-remove-variant]')) {
      const rows = document.querySelectorAll('[data-variant-row]');
      if (rows.length === 1) return toast('A product needs at least one option.', 'error');
      e.target.closest('tr').remove();
    }
    if (e.target.id === 'delete-product') {
      if (!confirm('Delete this product? It will be removed from the store. Past orders keep their details.')) return;
      await api(`/products/${id}`, { method: 'DELETE' });
      location.href = '/admin/products.html';
    }
  });

  root.addEventListener('change', async (e) => {
    if (e.target.id === 'in-stock') {
      document.getElementById('in-stock-label').textContent = e.target.checked
        ? 'In stock — available to buy' : 'Out of stock — cannot be purchased';
    }
    if (e.target.id === 'image-url') {
      document.getElementById('image-preview').src = e.target.value || '/images/placeholder.svg';
    }
    if (e.target.id === 'image-file' && e.target.files[0]) {
      const body = new FormData();
      body.append('image', e.target.files[0]);
      try {
        const { url } = await api('/uploads', { method: 'POST', body });
        document.getElementById('image-url').value = url;
        document.getElementById('image-preview').src = url;
        toast('Image uploaded. Save to apply it.');
      } catch (err) {
        toast(err.message, 'error');
      }
      e.target.value = '';
    }
  });

  root.addEventListener('submit', async (e) => {
    e.preventDefault();
    showError('');
    const btn = document.getElementById('save-product');
    btn.disabled = true;
    try {
      const body = collect();
      const { product } = id
        ? await api(`/products/${id}`, { method: 'PUT', body })
        : await api('/products', { method: 'POST', body });
      if (id) {
        toast('Product saved.');
        render(product);
      } else {
        location.href = `/admin/product-edit.html?id=${product.id}&created=1`;
      }
    } catch (err) {
      showError(err.message);
      btn.disabled = false;
    }
  });

  if (id) {
    api(`/products/${id}`)
      .then(({ product }) => {
        render(product);
        if (new URLSearchParams(location.search).get('created')) toast('Product created.');
      })
      .catch((err) => { root.innerHTML = `<div class="notice notice-error">${escapeHtml(err.message)}</div>`; });
  } else {
    render(blank);
  }
})();
