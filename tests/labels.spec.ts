// What `npm test` cannot reach on the "Créer les étiquettes" page: the sheet
// really being cut into pages, and the style panel really repainting it.
// `label-layout.ts` and `label-theme.ts` already own the arithmetic; these tests
// only check that what they compute reaches the paper.

import { expect, test, type Page } from '@playwright/test';

const CLASS_LIST = ['Léa', 'Noé', 'Camille', 'Youssef', 'Jade', 'Gabin'];

async function generate(page: Page, copies: number): Promise<void> {
  await page.locator('#names').fill(CLASS_LIST.join('\n'));
  await page.locator('#copies').fill(String(copies));
  await page.getByRole('button', { name: 'Générer les étiquettes' }).click();
  await expect(page.locator('.label-card').first()).toBeVisible();
}

test.beforeEach(async ({ page }) => {
  await page.goto('labels.html');
  await page.evaluate(() => {
    localStorage.clear();
  });
  await page.goto('labels.html');
});

test('cuts the sheet into pages instead of letting the printer do it', async ({ page }) => {
  await generate(page, 12);

  const perPage = await page.locator('.sheet-page').first().locator('.label-card').count();
  const pages = await page.locator('.sheet-page').count();
  const cards = await page.locator('.label-card').count();

  expect(cards).toBe(CLASS_LIST.length * 12);
  expect(pages).toBeGreaterThan(1);
  // Every page but the last is full, and no page overflows.
  const counts = await page.$$eval('.sheet-page', (nodes) =>
    nodes.map((node) => node.querySelectorAll('.label-card').length),
  );
  expect(counts.slice(0, -1).every((count) => count === perPage)).toBe(true);
  expect(Math.max(...counts)).toBe(perPage);
  expect(counts.reduce((total, count) => total + count, 0)).toBe(cards);
});

test('repaints the sheet as the style changes, with no second click', async ({ page }) => {
  await generate(page, 2);

  const inks = () =>
    page.$$eval('.label-card', (cards) =>
      cards.map((card) => (card as HTMLElement).style.getPropertyValue('--ink').trim()),
    );

  const rainbow = await inks();
  expect(new Set(rainbow).size).toBeGreaterThan(1);

  await page.locator('#palette').selectOption('plain');
  const plain = await inks();
  expect(new Set(plain).size).toBe(1);
  expect(plain).not.toEqual(rainbow);

  // A first name keeps its colour from one sheet to the next.
  await page.locator('#palette').selectOption('rainbow');
  expect(await inks()).toEqual(rainbow);
});

test('darkens a colour too pale for the decoder', async ({ page }) => {
  await generate(page, 1);
  await page.locator('#palette').selectOption('single');
  await expect(page.locator('#colour')).toBeVisible();

  await page.locator('#colour').evaluate((field: HTMLInputElement) => {
    field.value = '#ffe600';
    field.dispatchEvent(new Event('input', { bubbles: true }));
  });

  // Canary yellow must not reach the paper: zxing thresholds on brightness.
  const inks = await page.$$eval('.label-card', (cards) =>
    cards.map((card) => (card as HTMLElement).style.getPropertyValue('--ink').trim()),
  );
  const ink = inks[0] ?? '';
  expect(ink).not.toBe('#ffe600');

  const brightness = await page.evaluate((colour) => {
    const [, r, g, b] = /^#(..)(..)(..)$/.exec(colour) ?? [];
    if (!r || !g || !b) return 1;
    const channel = (hex: string) => Number.parseInt(hex, 16) / 255;
    return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
  }, ink);
  expect(brightness).toBeLessThan(0.4);
});

test('keeps the class list and the style from one session to the next', async ({ page }) => {
  await generate(page, 3);
  await page.locator('#size').selectOption('large');
  await page.locator('#mascots').selectOption('space');

  await page.goto('labels.html');

  await expect(page.locator('#names')).toHaveValue(CLASS_LIST.join('\n'));
  await expect(page.locator('#size')).toHaveValue('large');
  await expect(page.locator('#mascots')).toHaveValue('space');
  // The list is shared with the photo page, which reads the same key.
  expect(await page.evaluate(() => localStorage.getItem('qr-school.names'))).toBe(
    CLASS_LIST.join('\n'),
  );
});
