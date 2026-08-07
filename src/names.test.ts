import { describe, expect, it } from 'vitest';
import {
  buildFileName,
  extension,
  extractFirstName,
  fileDate,
  isImage,
  isReadable,
  sanitiseForFileName,
} from './names';

describe('extractFirstName', () => {
  it('returns the first name as typed', () => {
    expect(extractFirstName('Léa')).toBe('Léa');
    expect(extractFirstName('  Marie-Claire \n')).toBe('Marie-Claire');
  });

  it('accepts an explicit prefix', () => {
    expect(extractFirstName('prenom: Noé')).toBe('Noé');
    expect(extractFirstName('élève=Youssef')).toBe('Youssef');
  });

  it('accepts a URL with a query parameter', () => {
    expect(extractFirstName('https://ex.fr/e?prenom=Marie%20Claire')).toBe('Marie Claire');
    expect(extractFirstName('https://ex.fr/e?a=1&nom=L%C3%A9a#x')).toBe('Léa');
  });

  it('does not blow up on invalid percent-encoding', () => {
    expect(extractFirstName('https://ex.fr/e?prenom=%E9')).toBe('%E9');
  });
});

describe('sanitiseForFileName', () => {
  it('keeps accents and inner hyphens', () => {
    expect(sanitiseForFileName('Léa')).toBe('Léa');
    expect(sanitiseForFileName('Marie-Claire')).toBe('Marie-Claire');
  });

  it('turns spaces into hyphens', () => {
    expect(sanitiseForFileName('Léa B')).toBe('Léa-B');
  });

  it('strips the characters Windows forbids', () => {
    expect(sanitiseForFileName('a/b:c*d?e"f<g>h|i\\j')).toBe('abcdefghij');
  });

  it('never returns an empty name', () => {
    expect(sanitiseForFileName('   ')).toBe('Sans-nom');
    expect(sanitiseForFileName('///')).toBe('Sans-nom');
    expect(sanitiseForFileName('...')).toBe('Sans-nom');
  });

  it('caps the length', () => {
    expect(sanitiseForFileName('a'.repeat(200))).toHaveLength(60);
  });
});

describe('buildFileName', () => {
  const args = ['Léa', '2026-06-14', 3, 'jpg'] as const;

  it('applies the three patterns', () => {
    expect(buildFileName('name_date_num', ...args)).toBe('Léa_2026-06-14_03.jpg');
    expect(buildFileName('name_num', ...args)).toBe('Léa_03.jpg');
    expect(buildFileName('date_name_num', ...args)).toBe('2026-06-14_Léa_03.jpg');
  });

  it('pads the number to two digits', () => {
    expect(buildFileName('name_num', 'Léa', '2026-06-14', 1, 'png')).toBe('Léa_01.png');
    expect(buildFileName('name_num', 'Léa', '2026-06-14', 100, 'png')).toBe('Léa_100.png');
  });
});

describe('extensions', () => {
  it('recognises readable images and HEIC files', () => {
    expect(extension('IMG_001.JPG')).toBe('jpg');
    expect(isReadable('a.jpg')).toBe(true);
    expect(isReadable('a.heic')).toBe(false);
    expect(isImage('a.heic')).toBe(true);
    expect(isImage('notes.txt')).toBe(false);
    expect(isImage('no-extension')).toBe(false);
  });
});

describe('fileDate', () => {
  it('formats as YYYY-MM-DD', () => {
    expect(fileDate(new Date(2026, 5, 14, 10, 30).getTime())).toBe('2026-06-14');
    expect(fileDate(new Date(2026, 0, 2).getTime())).toBe('2026-01-02');
  });
});
