'use strict';

const { getDb, transaction } = require('../db');
const { ValidationError, str, int, priceToCents, slugify } = require('../lib/validate');

const GENDERS = ['For Her', 'For Him', 'Unisex'];

function hydrate(product, variants) {
  const vs = variants.map((v) => ({
    id: v.id,
    label: v.label,
    priceCents: v.price_cents,
    stock: v.stock,
    available: Boolean(product.in_stock) && v.stock > 0,
  }));
  const prices = vs.map((v) => v.priceCents);
  return {
    id: product.id,
    slug: product.slug,
    name: product.name,
    tagline: product.tagline,
    description: product.description,
    style: product.style,
    gender: product.gender,
    notes: { top: product.notes_top, heart: product.notes_heart, base: product.notes_base },
    imageUrl: product.image_url,
    inStock: Boolean(product.in_stock),
    featured: Boolean(product.featured),
    sortOrder: product.sort_order,
    totalStock: vs.reduce((sum, v) => sum + v.stock, 0),
    available: vs.some((v) => v.available),
    minPriceCents: prices.length ? Math.min(...prices) : 0,
    maxPriceCents: prices.length ? Math.max(...prices) : 0,
    variants: vs,
    createdAt: product.created_at,
    updatedAt: product.updated_at,
  };
}

function variantsFor(productIds) {
  if (!productIds.length) return new Map();
  const rows = getDb().prepare(
    `SELECT * FROM product_variants WHERE product_id IN (${productIds.map(() => '?').join(',')})
     ORDER BY sort_order, price_cents, id`
  ).all(...productIds);
  const map = new Map();
  for (const row of rows) {
    if (!map.has(row.product_id)) map.set(row.product_id, []);
    map.get(row.product_id).push(row);
  }
  return map;
}

function listProducts() {
  const products = getDb().prepare('SELECT * FROM products ORDER BY featured DESC, sort_order, name').all();
  const variants = variantsFor(products.map((p) => p.id));
  return products.map((p) => hydrate(p, variants.get(p.id) || []));
}

function getProduct({ id, slug }) {
  const db = getDb();
  const row = id !== undefined
    ? db.prepare('SELECT * FROM products WHERE id = ?').get(id)
    : db.prepare('SELECT * FROM products WHERE slug = ?').get(slug);
  if (!row) return null;
  return hydrate(row, variantsFor([row.id]).get(row.id) || []);
}

function parseProductInput(input) {
  const name = str(input.name, 'Name', { required: true, max: 120 });
  const gender = str(input.gender, 'Gender', { max: 20 }) || 'Unisex';
  if (!GENDERS.includes(gender)) throw new ValidationError(`Gender must be one of: ${GENDERS.join(', ')}.`);

  const variantsInput = Array.isArray(input.variants) ? input.variants : [];
  if (!variantsInput.length) throw new ValidationError('Add at least one size / option with a price.');
  if (variantsInput.length > 10) throw new ValidationError('A product can have at most 10 options.');
  const variants = variantsInput.map((v, i) => ({
    id: v.id ? int(v.id, 'Option id', { min: 1 }) : null,
    label: str(v.label, `Option ${i + 1} label`, { required: true, max: 40 }),
    priceCents: priceToCents(v.price, `Option ${i + 1} price`),
    stock: int(v.stock ?? 0, `Option ${i + 1} stock`, { min: 0, max: 1_000_000 }),
    sortOrder: i,
  }));

  const imageUrl = str(input.imageUrl, 'Image URL', { max: 500 });
  if (imageUrl && !/^(https:\/\/|\/)/.test(imageUrl)) {
    throw new ValidationError('Image URL must start with https:// or be an uploaded image.');
  }

  return {
    name,
    slug: slugify(str(input.slug, 'Slug', { max: 120 }) || name),
    tagline: str(input.tagline, 'Tagline', { max: 160 }),
    description: str(input.description, 'Description', { max: 4000 }),
    style: str(input.style, 'Style', { max: 40 }),
    gender,
    notesTop: str(input.notes?.top, 'Top notes', { max: 200 }),
    notesHeart: str(input.notes?.heart, 'Heart notes', { max: 200 }),
    notesBase: str(input.notes?.base, 'Base notes', { max: 200 }),
    imageUrl,
    inStock: input.inStock === undefined ? true : Boolean(input.inStock),
    featured: Boolean(input.featured),
    sortOrder: input.sortOrder === undefined || input.sortOrder === '' ? 0 : int(input.sortOrder, 'Sort order', { min: 0, max: 9999 }),
    variants,
  };
}

function uniqueSlug(db, base, excludeId) {
  let slug = base;
  for (let i = 2; db.prepare('SELECT id FROM products WHERE slug = ? AND id IS NOT ?').get(slug, excludeId ?? null); i++) {
    slug = `${base}-${i}`;
  }
  return slug;
}

function saveVariants(db, productId, variants) {
  const existingIds = new Set(
    db.prepare('SELECT id FROM product_variants WHERE product_id = ?').all(productId).map((r) => r.id)
  );
  const keep = new Set();
  for (const v of variants) {
    if (v.id && existingIds.has(v.id)) {
      db.prepare('UPDATE product_variants SET label = ?, price_cents = ?, stock = ?, sort_order = ? WHERE id = ?')
        .run(v.label, v.priceCents, v.stock, v.sortOrder, v.id);
      keep.add(v.id);
    } else {
      db.prepare('INSERT INTO product_variants (product_id, label, price_cents, stock, sort_order) VALUES (?, ?, ?, ?, ?)')
        .run(productId, v.label, v.priceCents, v.stock, v.sortOrder);
    }
  }
  for (const id of existingIds) {
    if (!keep.has(id)) db.prepare('DELETE FROM product_variants WHERE id = ?').run(id);
  }
}

function createProduct(input) {
  const p = parseProductInput(input);
  const id = transaction((db) => {
    const result = db.prepare(`
      INSERT INTO products (slug, name, tagline, description, style, gender, notes_top, notes_heart, notes_base,
                            image_url, in_stock, featured, sort_order)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(uniqueSlug(db, p.slug), p.name, p.tagline, p.description, p.style, p.gender, p.notesTop, p.notesHeart,
      p.notesBase, p.imageUrl, p.inStock ? 1 : 0, p.featured ? 1 : 0, p.sortOrder);
    const productId = Number(result.lastInsertRowid);
    saveVariants(db, productId, p.variants);
    return productId;
  });
  return getProduct({ id });
}

function updateProduct(id, input) {
  const p = parseProductInput(input);
  transaction((db) => {
    if (!db.prepare('SELECT id FROM products WHERE id = ?').get(id)) {
      throw Object.assign(new Error('Product not found.'), { status: 404 });
    }
    db.prepare(`
      UPDATE products SET slug = ?, name = ?, tagline = ?, description = ?, style = ?, gender = ?, notes_top = ?,
        notes_heart = ?, notes_base = ?, image_url = ?, in_stock = ?, featured = ?, sort_order = ?,
        updated_at = datetime('now')
      WHERE id = ?
    `).run(uniqueSlug(db, p.slug, id), p.name, p.tagline, p.description, p.style, p.gender, p.notesTop, p.notesHeart,
      p.notesBase, p.imageUrl, p.inStock ? 1 : 0, p.featured ? 1 : 0, p.sortOrder, id);
    saveVariants(db, id, p.variants);
  });
  return getProduct({ id });
}

function setProductInStock(id, inStock) {
  const result = getDb().prepare("UPDATE products SET in_stock = ?, updated_at = datetime('now') WHERE id = ?")
    .run(inStock ? 1 : 0, id);
  if (!result.changes) throw Object.assign(new Error('Product not found.'), { status: 404 });
  return getProduct({ id });
}

function deleteProduct(id) {
  const result = getDb().prepare('DELETE FROM products WHERE id = ?').run(id);
  if (!result.changes) throw Object.assign(new Error('Product not found.'), { status: 404 });
}

module.exports = {
  GENDERS,
  listProducts,
  getProduct,
  createProduct,
  updateProduct,
  setProductInStock,
  deleteProduct,
};
