import { normalizeName } from '@/lib/matching/normalize';

describe('normalizeName', () => {
  it('lowercases ASCII names', () => {
    expect(normalizeName('JOHN DOE')).toBe('john doe');
  });

  it('strips diacritics', () => {
    expect(normalizeName('José García')).toBe('jose garcia');
  });

  it('transliterates Cyrillic to Latin', () => {
    expect(normalizeName('Владимир Путин')).toBe('vladimir putin');
  });

  it('transliterates Arabic to only [a-z\\s]+ characters', () => {
    const result = normalizeName('عبد الله');
    expect(result).toMatch(/^[a-z\s]+$/);
  });

  it('removes Dr. honorific', () => {
    expect(normalizeName('Dr. John Smith')).toBe('john smith');
  });

  it('removes Mr. honorific', () => {
    expect(normalizeName('Mr. James Bond')).toBe('james bond');
  });

  it('removes Haj honorific', () => {
    expect(normalizeName('Haj Ali Hassan')).toBe('ali hassan');
  });

  it('removes Sir honorific', () => {
    expect(normalizeName('Sir Richard Branson')).toBe('richard branson');
  });

  it('removes Sheikh honorific', () => {
    expect(normalizeName('Sheikh Mohammed')).toBe('mohammed');
  });

  it('collapses multiple spaces', () => {
    expect(normalizeName('John   Doe')).toBe('john doe');
  });

  it('trims leading and trailing spaces', () => {
    expect(normalizeName('  John Doe  ')).toBe('john doe');
  });

  it('returns empty string for empty input', () => {
    expect(normalizeName('')).toBe('');
  });

  it('strips mixed diacritics', () => {
    expect(normalizeName('Müller François')).toBe('muller francois');
  });
});
