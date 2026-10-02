// Checks the main pages fit a phone screen without horizontal scrolling.
const { test, expect } = require('@playwright/test');

async function expectNoHorizontalScroll(page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(1);
}

test('storefront pages fit a phone screen', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('.card').first()).toBeVisible();
  await expectNoHorizontalScroll(page);

  await page.getByRole('button', { name: 'Open menu' }).click();
  await expect(page.locator('#main-nav')).toBeVisible();
  await page.locator('#main-nav').getByRole('link', { name: 'Collection' }).click();

  await page.goto('/product.html?slug=golden-ember');
  await expect(page.locator('h1')).toHaveText('Golden Ember');
  await expectNoHorizontalScroll(page);
  await page.click('#add-to-cart');

  await page.goto('/cart.html');
  await expect(page.locator('.cart-line')).toHaveCount(1);
  await expectNoHorizontalScroll(page);

  await page.goto('/checkout.html');
  await expect(page.locator('#place-order')).toBeVisible();
  await expectNoHorizontalScroll(page);

  await page.goto('/admin/login.html');
  await expectNoHorizontalScroll(page);
});
