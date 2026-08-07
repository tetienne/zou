import { describe, expect, it } from 'vitest';
import { findFreeFileName, planFileNames, type PhotoEntry } from './filing';

const lea = (date: string): PhotoEntry => ({ firstName: 'Léa', date, ext: 'jpg' });
const noe = (date: string): PhotoEntry => ({ firstName: 'Noé', date, ext: 'jpg' });
const nameless = (date: string): PhotoEntry => ({ firstName: '', date, ext: 'jpg' });

const DAY = '2026-06-14';
const NEXT_DAY = '2026-06-15';

describe('planFileNames', () => {
  it('numbers per first name and per day', () => {
    const plans = planFileNames([lea(DAY), lea(DAY), noe(DAY), lea(NEXT_DAY)], 'name_date_num');
    expect(plans.map((plan) => plan?.fileName)).toEqual([
      'Léa_2026-06-14_01.jpg',
      'Léa_2026-06-14_02.jpg',
      'Noé_2026-06-14_01.jpg',
      'Léa_2026-06-15_01.jpg',
    ]);
  });

  it('carries the counter over between days when the name has no date', () => {
    const plans = planFileNames([lea(DAY), lea(NEXT_DAY)], 'name_num');
    expect(plans.map((plan) => plan?.fileName)).toEqual(['Léa_01.jpg', 'Léa_02.jpg']);
  });

  it('skips entries without a first name', () => {
    const plans = planFileNames([lea(DAY), nameless(DAY), lea(DAY)], 'name_date_num');
    expect(plans[1]).toBeNull();
    expect(plans[2]?.index).toBe(2);
  });
});

describe('findFreeFileName', () => {
  const disk = (names: string[]) => (name: string) => Promise.resolve(names.includes(name));

  it('keeps the planned number when the slot is free', async () => {
    const result = await findFreeFileName('name_date_num', lea(DAY), 1, disk([]));
    expect(result).toEqual({ index: 1, fileName: 'Léa_2026-06-14_01.jpg' });
  });

  it('moves forward while the file already exists', async () => {
    const taken = ['Léa_2026-06-14_01.jpg', 'Léa_2026-06-14_02.jpg'];
    const result = await findFreeFileName('name_date_num', lea(DAY), 1, disk(taken));
    expect(result).toEqual({ index: 3, fileName: 'Léa_2026-06-14_03.jpg' });
  });

  it('stops instead of looping forever', async () => {
    const result = await findFreeFileName('name_date_num', lea(DAY), 1, () =>
      Promise.resolve(true),
    );
    expect(result.index).toBe(999);
  });
});

describe('filing the same photos a second time', () => {
  it('overwrites nothing and continues the numbering', async () => {
    const disk = new Set<string>();
    const exists = (name: string) => Promise.resolve(disk.has(name));
    const entries = [lea(DAY), lea(DAY)];

    for (let pass = 0; pass < 2; pass++) {
      const plans = planFileNames(entries, 'name_date_num');
      for (const [index, entry] of entries.entries()) {
        const start = plans[index]?.index ?? 1;
        const { fileName } = await findFreeFileName('name_date_num', entry, start, exists);
        disk.add(fileName);
      }
    }

    expect([...disk].sort()).toEqual([
      'Léa_2026-06-14_01.jpg',
      'Léa_2026-06-14_02.jpg',
      'Léa_2026-06-14_03.jpg',
      'Léa_2026-06-14_04.jpg',
    ]);
  });
});
