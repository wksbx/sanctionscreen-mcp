import { describe, it, expect } from 'vitest';
import { generateEntityId, deduplicateEntities } from '@/lib/crawlers/normalizer';
import type { NormalizedEntity } from '@/lib/types';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeEntity(overrides: Partial<NormalizedEntity>): NormalizedEntity {
  return {
    type: 'person',
    fullName: 'John Doe',
    normalizedName: 'john doe',
    aliases: [],
    nationality: [],
    relationships: [],
    sourceId: 'test-source-id',
    source: 'TEST',
    ...overrides,
  };
}

// ─── generateEntityId ─────────────────────────────────────────────────────────

describe('generateEntityId', () => {
  it('returns the same ID for the same inputs', () => {
    const id1 = generateEntityId('john doe', '1970-01-01', 'OFAC');
    const id2 = generateEntityId('john doe', '1970-01-01', 'OFAC');
    expect(id1).toBe(id2);
  });

  it('returns different IDs for different names', () => {
    const id1 = generateEntityId('john doe', '1970-01-01', 'OFAC');
    const id2 = generateEntityId('jane doe', '1970-01-01', 'OFAC');
    expect(id1).not.toBe(id2);
  });

  it('returns a truthy string when DOB is missing', () => {
    const id = generateEntityId('john doe', undefined, 'OFAC');
    expect(id).toBeTruthy();
    expect(typeof id).toBe('string');
  });

  it('returns exactly 16 hex characters', () => {
    const id = generateEntityId('john doe', '1970-01-01', 'OFAC');
    expect(id).toMatch(/^[0-9a-f]{16}$/);
  });
});

// ─── deduplicateEntities ──────────────────────────────────────────────────────

describe('deduplicateEntities', () => {
  it('merges two entities with the same name and DOB into one', () => {
    const entities: NormalizedEntity[] = [
      makeEntity({
        normalizedName: 'john doe',
        dateOfBirth: '1970-01-01',
        aliases: ['Johnny'],
        nationality: ['US'],
        riskLevel: 'LOW',
      }),
      makeEntity({
        normalizedName: 'john doe',
        dateOfBirth: '1970-01-01',
        aliases: ['J. Doe'],
        nationality: ['GB'],
        riskLevel: 'HIGH',
      }),
    ];

    const result = deduplicateEntities(entities);

    expect(result).toHaveLength(1);
    expect(result[0].aliases).toContain('Johnny');
    expect(result[0].aliases).toContain('J. Doe');
    expect(result[0].nationality).toContain('US');
    expect(result[0].nationality).toContain('GB');
    expect(result[0].riskLevel).toBe('HIGH');
  });

  it('keeps two entities with different names separate', () => {
    const entities: NormalizedEntity[] = [
      makeEntity({ normalizedName: 'john doe', dateOfBirth: '1970-01-01' }),
      makeEntity({ normalizedName: 'jane smith', dateOfBirth: '1980-06-15' }),
    ];

    const result = deduplicateEntities(entities);

    expect(result).toHaveLength(2);
  });

  it('merges relationships from duplicate entities', () => {
    const rel1 = { type: 'ASSOCIATE_OF' as const, targetName: 'Alice' };
    const rel2 = { type: 'FAMILY_OF' as const, targetName: 'Bob' };

    const entities: NormalizedEntity[] = [
      makeEntity({ normalizedName: 'john doe', dateOfBirth: '1970-01-01', relationships: [rel1] }),
      makeEntity({ normalizedName: 'john doe', dateOfBirth: '1970-01-01', relationships: [rel2] }),
    ];

    const result = deduplicateEntities(entities);

    expect(result).toHaveLength(1);
    expect(result[0].relationships).toHaveLength(2);
  });

  it('handles entities without a DOB (uses "unknown" key)', () => {
    const entities: NormalizedEntity[] = [
      makeEntity({ normalizedName: 'mystery person', dateOfBirth: undefined, aliases: ['MP'] }),
      makeEntity({ normalizedName: 'mystery person', dateOfBirth: undefined, aliases: ['M.P.'] }),
    ];

    const result = deduplicateEntities(entities);

    expect(result).toHaveLength(1);
    expect(result[0].aliases).toContain('MP');
    expect(result[0].aliases).toContain('M.P.');
  });

  it('keeps the highest risk level when merging (MEDIUM + HIGH → HIGH)', () => {
    const entities: NormalizedEntity[] = [
      makeEntity({ normalizedName: 'john doe', riskLevel: 'MEDIUM' }),
      makeEntity({ normalizedName: 'john doe', riskLevel: 'HIGH' }),
    ];

    const result = deduplicateEntities(entities);
    expect(result[0].riskLevel).toBe('HIGH');
  });

  it('keeps the highest risk level when merging (LOW + MEDIUM → MEDIUM)', () => {
    const entities: NormalizedEntity[] = [
      makeEntity({ normalizedName: 'john doe', riskLevel: 'LOW' }),
      makeEntity({ normalizedName: 'john doe', riskLevel: 'MEDIUM' }),
    ];

    const result = deduplicateEntities(entities);
    expect(result[0].riskLevel).toBe('MEDIUM');
  });
});
