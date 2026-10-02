/* Home page: product grid with filters, sorting and quick add. */
(function () {
  'use strict';
  const { api, cart, toast, productCard, escapeHtml } = window.JH;

  const state = { products: [], style: '', gender: '', availability: '', sort: 'featured' };
  const grid = document.getElementById('product-grid');
  const count = document.getElementById('result-count');
  const styleFilters = document.getElementById('style-filters');

  function filtered() {
    let list = state.products.filter((p) =>
      (!state.style || p.style === state.style)
      && (!state.gender || p.gender === state.gender)
      && (!state.availability || p.available));
    const sorters = {
      featured: () => 0,
      'price-asc': (a, b) => a.minPriceCents - b.minPriceCents,
      'price-desc': (a, b) => b.minPriceCents - a.minPriceCents,
      name: (a, b) => a.name.localeCompare(b.name),
    };
    list = [...list].sort(sorters[state.sort]);
    // Available products always come before sold-out ones.
    return list.sort((a, b) => Number(b.available) - Number(a.available));
  }

  function render() {
    const list = filtered();
    count.textContent = `${list.length} ${list.length === 1 ? 'fragrance' : 'fragrances'}`;
    grid.setAttribute('aria-busy', 'false');
    grid.innerHTML = list.length
      ? list.map(productCard).join('')
      : `<div class="empty span-all"><h2>No fragrances match</h2><p>Try a different family or clear your filters.</p>
         <button class="btn btn-outline" type="button" data-clear-filters>Clear filters</button></div>`;
  }

  function renderStyleChips() {
    const styles = [...new Set(state.products.map((p) => p.style).filter(Boolean))].sort();
    styleFilters.innerHTML = ['', ...styles].map((s) =>
      `<button class="chip" type="button" data-style="${escapeHtml(s)}" aria-pressed="${state.style === s}">${escapeHtml(s || 'All')}</button>`
    ).join('');
  }

  styleFilters.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-style]');
    if (!btn) return;
    state.style = btn.dataset.style;
    renderStyleChips();
    render();
  });
  document.getElementById('gender-filter').addEventListener('change', (e) => { state.gender = e.target.value; render(); });
  document.getElementById('availability-filter').addEventListener('change', (e) => { state.availability = e.target.value; render(); });
  document.getElementById('sort').addEventListener('change', (e) => { state.sort = e.target.value; render(); });

  grid.addEventListener('click', (e) => {
    if (e.target.closest('[data-clear-filters]')) {
      Object.assign(state, { style: '', gender: '', availability: '' });
      document.getElementById('gender-filter').value = '';
      document.getElementById('availability-filter').value = '';
      renderStyleChips();
      render();
      return;
    }
    const btn = e.target.closest('[data-quick-add]');
    if (!btn || btn.disabled) return;
    const { added } = cart.add(Number(btn.dataset.quickAdd), 1, Number(btn.dataset.max));
    if (added) toast(`${btn.dataset.name} (${btn.dataset.label}) added to your bag.`, { action: { href: '/cart.html', label: 'View bag' } });
    else toast('You already have the maximum available quantity in your bag.', { type: 'error' });
  });

  // Footer "For her / For him" links pre-select the gender filter.
  document.addEventListener('click', (e) => {
    const link = e.target.closest('[data-filter-link]');
    if (!link) return;
    state.gender = link.dataset.filterLink;
    document.getElementById('gender-filter').value = state.gender;
    render();
  });

  api('/products')
    .then(({ products }) => {
      state.products = products;
      renderStyleChips();
      render();
    })
    .catch(() => {
      grid.setAttribute('aria-busy', 'false');
      grid.innerHTML = '<div class="empty span-all"><h2>We could not load the collection</h2><p>Please refresh the page.</p></div>';
    });
})();
