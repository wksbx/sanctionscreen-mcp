import {
  levenshteinSimilarity,
  jaroWinklerSimilarity,
  doubleMetaphone,
  metaphoneSimilarity,
  tokenSetRatio,
} from '@/lib/matching/algorithms';

describe('levenshteinSimilarity', () => {
  it('returns 1.0 for identical strings', () => {
    expect(levenshteinSimilarity('hello', 'hello')).toBe(1.0);
  });

  it('returns 0 for completely different strings of same length', () => {
    expect(levenshteinSimilarity('abc', 'xyz')).toBe(0);
  });

  it('returns > 0.8 for strings differing by one character', () => {
    expect(levenshteinSimilarity('vladimir', 'vladimr')).toBeGreaterThan(0.8);
  });

  it('returns 1.0 for two empty strings', () => {
    expect(levenshteinSimilarity('', '')).toBe(1.0);
  });

  it('returns 0 when one string is empty', () => {
    expect(levenshteinSimilarity('abc', '')).toBe(0);
  });
});

describe('jaroWinklerSimilarity', () => {
  it('returns 1.0 for identical strings', () => {
    expect(jaroWinklerSimilarity('john', 'john')).toBe(1.0);
  });

  it('rewards matching prefixes (johnson/johnsen vs ohnson/ohnsen)', () => {
    const withPrefix = jaroWinklerSimilarity('johnson', 'johnsen');
    const withoutPrefix = jaroWinklerSimilarity('ohnson', 'ohnsen');
    expect(withPrefix).toBeGreaterThan(withoutPrefix);
  });

  it('returns > 0.8 for transposed characters', () => {
    expect(jaroWinklerSimilarity('putin', 'puint')).toBeGreaterThan(0.8);
  });
});

describe('doubleMetaphone', () => {
  it('returns same primary code for smith and smyth', () => {
    const [smithPrimary] = doubleMetaphone('smith');
    const [smythPrimary] = doubleMetaphone('smyth');
    expect(smithPrimary).toBe(smythPrimary);
  });

  it('returns different primary codes for john and mary', () => {
    const [johnPrimary] = doubleMetaphone('john');
    const [maryPrimary] = doubleMetaphone('mary');
    expect(johnPrimary).not.toBe(maryPrimary);
  });

  it('returns a tuple of two strings', () => {
    const result = doubleMetaphone('test');
    expect(Array.isArray(result)).toBe(true);
    expect(result).toHaveLength(2);
    expect(typeof result[0]).toBe('string');
    expect(typeof result[1]).toBe('string');
  });

  it('returns codes of max 4 characters', () => {
    const [primary, secondary] = doubleMetaphone('complicated');
    expect(primary.length).toBeLessThanOrEqual(4);
    expect(secondary.length).toBeLessThanOrEqual(4);
  });
});

describe('metaphoneSimilarity', () => {
  it('returns 1.0 for phonetically equivalent names (smith/smyth)', () => {
    expect(metaphoneSimilarity('smith', 'smyth')).toBe(1.0);
  });

  it('returns 0 for phonetically unrelated names', () => {
    expect(metaphoneSimilarity('john', 'mary')).toBe(0);
  });

  it('returns > 0 for alternate spellings of same name (muhammad/mohammed)', () => {
    expect(metaphoneSimilarity('muhammad', 'mohammed')).toBeGreaterThan(0);
  });
});

describe('tokenSetRatio', () => {
  it('returns 1.0 for same tokens in different order', () => {
    expect(tokenSetRatio('john doe', 'doe john')).toBe(1.0);
  });

  it('returns > 0.6 for a subset of tokens present', () => {
    expect(tokenSetRatio('vladimir putin', 'vladimir vladimirovich putin')).toBeGreaterThan(0.6);
  });

  it('returns 0 for completely disjoint token sets', () => {
    expect(tokenSetRatio('abc def', 'xyz uvw')).toBe(0);
  });
});
