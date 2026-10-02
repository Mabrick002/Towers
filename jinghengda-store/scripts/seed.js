'use strict';

const fs = require('node:fs');
const config = require('../src/config');
const { getDb, closeDb } = require('../src/db');
const products = require('../src/services/products');
const { slugify } = require('../src/lib/validate');
const samples = require('./sample-products');

// Inserts the demo catalogue the first time the store starts with an empty database.
function ensureSeedData() {
  const { n } = getDb().prepare('SELECT COUNT(*) AS n FROM products').get();
  if (n > 0) return false;
  samples.forEach((s, i) => {
    products.createProduct({
      ...s,
      imageUrl: `/images/products/${slugify(s.name)}.svg`,
      sortOrder: i,
    });
  });
  return true;
}

if (require.main === module) {
  if (process.argv.includes('--reset')) {
    for (const suffix of ['', '-wal', '-shm']) fs.rmSync(config.dbFile + suffix, { force: true });
    console.log('Database reset.');
  }
  require('../src/lib/auth').ensureAdminAccount();
  console.log(ensureSeedData() ? `Seeded ${samples.length} sample products.` : 'Products already exist; nothing seeded.');
  closeDb();
}

module.exports = { ensureSeedData };
