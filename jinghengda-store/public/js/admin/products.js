(function () {
  'use strict';
  const { api, escapeHtml, money, renderLayout, toast, stockPill } = window.Admin;
  renderLayout('products');
  const root = document.getElementById('products-root');

  async function load() {
    const { products } = await api('/products');
    root.innerHTML = products.length ? `
      <table class="data">
        <thead><tr><th>Product</th><th>Style</th><th>Price</th><th>Inventory</th><th>Availability</th><th class="num">Actions</th></tr></thead>
        <tbody>${products.map((p) => `
          <tr data-product-id="${p.id}" data-name="${escapeHtml(p.name)}">
            <td><div class="prod-cell">
              <img src="${escapeHtml(p.imageUrl || '/images/placeholder.svg')}" alt="">
              <div><strong>${escapeHtml(p.name)}</strong><small>${p.variants.map((v) => `${escapeHtml(v.label)}: ${v.stock}`).join(' · ')}</small></div>
            </div></td>
            <td>${escapeHtml(p.style)}<br><small class="muted">${escapeHtml(p.gender)}</small></td>
            <td>${p.minPriceCents === p.maxPriceCents ? money(p.minPriceCents) : `${money(p.minPriceCents)} – ${money(p.maxPriceCents)}`}</td>
            <td>${stockPill(p)}</td>
            <td>
              <label class="switch">
                <input type="checkbox" data-stock-toggle ${p.inStock ? 'checked' : ''} aria-label="${escapeHtml(p.name)} in stock">
                <span class="track"></span><span>${p.inStock ? 'In stock' : 'Out of stock'}</span>
              </label>
            </td>
            <td class="num">
              <a class="btn btn-ghost btn-sm" href="/admin/product-edit.html?id=${p.id}">Edit</a>
              <button class="btn btn-danger btn-sm" type="button" data-delete>Delete</button>
            </td>
          </tr>`).join('')}</tbody>
      </table>` : '<div class="panel-body muted">No products yet. Click “Add product” to create your first one.</div>';
  }

  root.addEventListener('change', async (e) => {
    if (!e.target.matches('[data-stock-toggle]')) return;
    const row = e.target.closest('tr');
    const inStock = e.target.checked;
    try {
      await api(`/products/${row.dataset.productId}/stock`, { method: 'PATCH', body: { inStock } });
      toast(`${row.dataset.name} marked ${inStock ? 'in stock' : 'out of stock'}.`);
      await load();
    } catch (err) {
      e.target.checked = !inStock;
      toast(err.message, 'error');
    }
  });

  root.addEventListener('click', async (e) => {
    if (!e.target.closest('[data-delete]')) return;
    const row = e.target.closest('tr');
    if (!confirm(`Delete “${row.dataset.name}”? It will be removed from the store. Past orders keep their details.`)) return;
    try {
      await api(`/products/${row.dataset.productId}`, { method: 'DELETE' });
      toast(`${row.dataset.name} deleted.`);
      await load();
    } catch (err) {
      toast(err.message, 'error');
    }
  });

  load().catch((err) => { root.innerHTML = `<div class="panel-body notice notice-error">${escapeHtml(err.message)}</div>`; });
})();
