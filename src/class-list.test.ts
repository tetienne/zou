import { describe, expect, it } from 'vitest';
import { splitNames, withoutDuplicates } from './class-list';

describe('splitNames', () => {
  it('reads one first name per line', () => {
    expect(splitNames('Léa\nNoé\nCamille')).toEqual(['Léa', 'Noé', 'Camille']);
  });

  it('trims each line and drops the blank ones', () => {
    expect(splitNames('  Léa  \n\n\t\nNoé\n  ')).toEqual(['Léa', 'Noé']);
  });

  it('returns nothing for an empty list', () => {
    expect(splitNames('')).toEqual([]);
    expect(splitNames('   \n  ')).toEqual([]);
  });

  it('keeps a first name carrying an initial', () => {
    expect(splitNames('Léa B\nLéa M')).toEqual(['Léa B', 'Léa M']);
  });
});

describe('withoutDuplicates', () => {
  it('keeps the first spelling met', () => {
    expect(withoutDuplicates(['Léa', 'LÉA', 'léa'])).toEqual(['Léa']);
  });

  it('preserves order', () => {
    expect(withoutDuplicates(['Noé', 'Léa', 'Noé', 'Camille'])).toEqual(['Noé', 'Léa', 'Camille']);
  });

  it('treats a missing accent as a different child', () => {
    // We cannot tell a typo from a genuinely different name, so both stay.
    expect(withoutDuplicates(['Léa', 'Lea'])).toEqual(['Léa', 'Lea']);
  });

  it('does not merge two children sharing a first name', () => {
    expect(withoutDuplicates(['Léa B', 'Léa M'])).toEqual(['Léa B', 'Léa M']);
  });
});
