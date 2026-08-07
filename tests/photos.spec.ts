// What `npm test` cannot reach on the "Ranger les photos" page: the pool of
// workers, and the two paths that actually touch the disk.

import { expect, test, type Page } from '@playwright/test';
import { useFakeFolders, writtenFiles, type PhotoSpec } from './fake-folders';

/**
 * The first photo is deliberately the slowest to decode — a large label — and
 * the folder holds more photos than there are workers. Anything that hands
 * results back in the order they finish, rather than the order of the folder,
 * gets caught here: Léa's numbering would follow the decoder instead of the
 * shelf.
 */
const FOLDER: PhotoSpec[] = [
  { name: 'photo-01.png', firstName: 'Léa', cell: 14 },
  { name: 'photo-02.png', firstName: 'Noé' },
  { name: 'photo-03.png', firstName: 'Camille' },
  { name: 'photo-04.png', firstName: 'Léa' },
  { name: 'photo-05.png', firstName: 'Youssef' },
  { name: 'photo-06.png', firstName: 'Jade' },
  { name: 'photo-07.png', firstName: null },
  { name: 'photo-08.heic', firstName: null, garbage: true },
];

/** One row of the gallery, read back the way the teacher sees it. */
interface Card {
  origin: string;
  firstName: string;
  planned: string;
  badge: string;
}

async function readGallery(page: Page): Promise<Card[]> {
  return page.$$eval('.photo-card', (cards) =>
    cards.map((card) => {
      const bottom = card.children[1];
      return {
        origin: bottom?.querySelector('p:last-of-type')?.textContent?.trim() ?? '',
        firstName: card.querySelector('input')?.value ?? '',
        planned: bottom?.querySelector('p:first-of-type')?.textContent?.trim() ?? '',
        badge: card.querySelector('.status-badge')?.textContent?.trim() ?? '',
      };
    }),
  );
}

async function scan(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Choisir le dossier des photos' }).click();
  await expect(page.getByText(/— 8 photos/)).toBeVisible();
  await page.getByRole('button', { name: 'Lire les étiquettes' }).click();
  await expect(page.getByText(/prénoms? reconnus? sur/)).toBeVisible({ timeout: 60_000 });
}

let failures: string[] = [];

test.beforeEach(async ({ page }) => {
  failures = [];
  page.on('pageerror', (error) => failures.push(error.message));
  await page.goto('photos.html');
  await page.evaluate(() => {
    localStorage.setItem('qr-school.names', 'Léa\nNoé\nCamille\nYoussef\nJade');
  });
});

// Fail loudly rather than leave a broken page looking merely quiet. Asserted
// here and not from `page.on('close')`, which fires once the verdict is sealed
// and would hang the failure on whichever test runs next.
test.afterEach(() => {
  expect(failures, 'the page threw').toEqual([]);
});

test('reads a folder in workers and keeps the order of the shelf', async ({ page }) => {
  await useFakeFolders(page, FOLDER);
  await page.goto('photos.html');
  await scan(page);

  await expect(page.getByText('6 prénoms reconnus sur 8 photos.')).toBeVisible();

  const cards = await readGallery(page);
  expect(cards).toHaveLength(8);

  // The two photos needing attention are pulled to the front; the rest keep the
  // order of the folder, which is what the numbering is built on.
  expect(cards.slice(2).map((card) => card.origin)).toEqual([
    'photo-01.png',
    'photo-02.png',
    'photo-03.png',
    'photo-04.png',
    'photo-05.png',
    'photo-06.png',
  ]);

  const lea = cards.filter((card) => card.firstName === 'Léa');
  expect(lea.map((card) => card.origin)).toEqual(['photo-01.png', 'photo-04.png']);
  // The slow photo is still Léa's first, even though it decoded last.
  expect(lea[0]?.planned).toMatch(/^Léa[\\/]Léa_\d{4}-\d{2}-\d{2}_01\.png$/);
  expect(lea[1]?.planned).toMatch(/^Léa[\\/]Léa_\d{4}-\d{2}-\d{2}_02\.png$/);
});

test('says which photos still need the teacher', async ({ page }) => {
  await useFakeFolders(page, FOLDER);
  await page.goto('photos.html');
  await scan(page);

  const cards = await readGallery(page);
  const byOrigin = new Map(cards.map((card) => [card.origin, card]));

  expect(byOrigin.get('photo-07.png')?.badge).toBe('QR non trouvé');
  expect(byOrigin.get('photo-08.heic')?.badge).toBe('Format HEIC, non lisible');
  expect(
    cards
      .slice(0, 2)
      .map((card) => card.origin)
      .sort(),
  ).toEqual(['photo-07.png', 'photo-08.heic']);
  await expect(page.getByText('2 photos n’ont pas encore de prénom.')).toBeVisible();

  // Naming one sends it back to the pack and drops the count.
  const orphan = page.locator('.photo-card').first().locator('input');
  await orphan.fill('Gabin');
  await orphan.press('Enter');
  await expect(page.getByText('1 photo n’a pas encore de prénom.')).toBeVisible();
});

test('files each photo under its own name, without overwriting', async ({ page }) => {
  // Léa already has a photo filed today, so hers must start at 02. The date is
  // read off the local calendar, like `dateStamp` does: `toISOString` would name
  // yesterday's file for the two hours the two disagree.
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  const today = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
  await useFakeFolders(page, FOLDER, [`Léa/Léa_${today}_01.png`]);
  await page.goto('photos.html');
  await scan(page);

  await page.getByRole('button', { name: 'Choisir le dossier de destination' }).click();
  await page.getByRole('button', { name: 'Copier les photos' }).click();
  await expect(page.getByText(/photos? copiées?\. Et zou/)).toBeVisible({ timeout: 60_000 });

  const written = await writtenFiles(page);
  expect(Object.keys(written).sort()).toEqual(
    [
      `Camille/Camille_${today}_01.png`,
      `Jade/Jade_${today}_01.png`,
      `Léa/Léa_${today}_02.png`,
      `Léa/Léa_${today}_03.png`,
      `Noé/Noé_${today}_01.png`,
      `Youssef/Youssef_${today}_01.png`,
    ].sort(),
  );
  // The photos with no first name are the two that stayed behind.
  await expect(page.getByText("6 photos copiées. Et zou, c'est rangé.")).toBeVisible();
});

test('reads the folder anyway when the browser has no workers', async ({ page }) => {
  await useFakeFolders(page, FOLDER);
  await page.addInitScript(() => {
    delete (window as unknown as { Worker?: unknown }).Worker;
  });
  await page.goto('photos.html');
  await scan(page);

  await expect(page.getByText('6 prénoms reconnus sur 8 photos.')).toBeVisible();
  const cards = await readGallery(page);
  expect(cards.filter((card) => card.firstName === 'Léa').map((card) => card.origin)).toEqual([
    'photo-01.png',
    'photo-04.png',
  ]);
});

test('rebuilds the gallery on a second scan', async ({ page }) => {
  await useFakeFolders(page, FOLDER);
  await page.goto('photos.html');
  await scan(page);
  await page.getByRole('button', { name: 'Lire les étiquettes' }).click();
  await expect(page.getByText(/prénoms? reconnus? sur/)).toBeVisible({ timeout: 60_000 });

  expect(await page.locator('.photo-card').count()).toBe(8);
  // The thumbnails of the first pass were released; the new ones must still show.
  const showing = await page.$$eval(
    '.photo-card img',
    (images) => images.filter((image) => (image as HTMLImageElement).naturalWidth > 0).length,
  );
  expect(showing).toBeGreaterThan(0);
});
