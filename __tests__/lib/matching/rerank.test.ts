import { describe, it, expect } from 'vitest';
import { rerankCandidates } from '@/lib/matching/rerank';
import type { RawCandidate } from '@/lib/matching/candidates';
import { DEFAULT_MATCHING_CONFIG } from '@/lib/types';

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeCandidate(overrides: Partial<RawCandidate> & { fullName: string }): RawCandidate {
  return {
    entityId: overrides.entityId ?? 'id-1',
    fullName: overrides.fullName,
    normalizedName: overrides.normalizedName ?? overrides.fullName.toLowerCase(),
    entityType: overrides.entityType ?? 'person',
    luceneScore: overrides.luceneScore ?? 1.0,
    properties: overrides.properties ?? {},
  };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('rerankCandidates', () => {
  it('exact match ranks highest among candidates', async () => {
    const candidates: RawCandidate[] = [
      makeCandidate({ entityId: 'id-1', fullName: 'John Smith' }),
      makeCandidate({ entityId: 'id-2', fullName: 'Jane Doe' }),
      makeCandidate({ entityId: 'id-3', fullName: 'James Bond' }),
    ];

    const results = await rerankCandidates('John Smith', candidates, DEFAULT_MATCHING_CONFIG);

    expect(results.length).toBeGreaterThan(0);
    expect(results[0].entityId).toBe('id-1');
    expect(results[0].score).toBeGreaterThan(0.9);
  });

  it('returns results sorted descending by score', async () => {
    const candidates: RawCandidate[] = [
      makeCandidate({ entityId: 'id-1', fullName: 'Vladimir Putin' }),
      makeCandidate({ entityId: 'id-2', fullName: 'Vladimir Vladimirovich Putin' }),
      makeCandidate({ entityId: 'id-3', fullName: 'Bob Brown' }),
    ];

    const results = await rerankCandidates('Vladimir Putin', candidates, DEFAULT_MATCHING_CONFIG);

    for (let i = 1; i < results.length; i++) {
      expect(results[i - 1].score).toBeGreaterThanOrEqual(results[i].score);
    }
  });

  it('DOB boost increases score when dateOfBirth matches', async () => {
    // Use a name that is similar but not identical, so score < 1.0 before boost
    const candidate: RawCandidate = makeCandidate({
      entityId: 'id-1',
      fullName: 'Jon Smith',
      properties: { dateOfBirth: '1970-01-01' },
    });

    const withoutBoost = await rerankCandidates('John Smith', [candidate], DEFAULT_MATCHING_CONFIG);
    const withBoost = await rerankCandidates('John Smith', [candidate], DEFAULT_MATCHING_CONFIG, {
      dob: '1970-01-01',
    });

    expect(withBoost[0].score).toBeGreaterThan(withoutBoost[0].score);
  });

  it('nationality boost increases score when nationality matches', async () => {
    // Use a name that is similar but not identical, so score < 1.0 before boost
    const candidate: RawCandidate = makeCandidate({
      entityId: 'id-1',
      fullName: 'Jon Smith',
      properties: { nationality: ['GB', 'US'] },
    });

    const withoutBoost = await rerankCandidates('John Smith', [candidate], DEFAULT_MATCHING_CONFIG);
    const withBoost = await rerankCandidates('John Smith', [candidate], DEFAULT_MATCHING_CONFIG, {
      nationality: 'GB',
    });

    expect(withBoost[0].score).toBeGreaterThan(withoutBoost[0].score);
  });

  it('filters out results below minScore', async () => {
    const candidates: RawCandidate[] = [
      makeCandidate({ entityId: 'id-1', fullName: 'ZZZZZZ XXXXXX' }),
    ];

    const strictConfig = { ...DEFAULT_MATCHING_CONFIG, minScore: 0.9 };
    const results = await rerankCandidates('John Smith', candidates, strictConfig);

    expect(results).toHaveLength(0);
  });

  it('returns empty array when candidates list is empty', async () => {
    const results = await rerankCandidates('John Smith', [], DEFAULT_MATCHING_CONFIG);
    expect(results).toHaveLength(0);
  });

  it('caps score at 1.0 even with boosts applied', async () => {
    const candidate: RawCandidate = makeCandidate({
      entityId: 'id-1',
      fullName: 'John Smith',
      properties: {
        dateOfBirth: '1970-01-01',
        nationality: ['GB'],
      },
    });

    const results = await rerankCandidates('John Smith', [candidate], DEFAULT_MATCHING_CONFIG, {
      dob: '1970-01-01',
      nationality: 'GB',
    });

    expect(results[0].score).toBeLessThanOrEqual(1.0);
  });

  it('includes matchedField in each result', async () => {
    const candidate: RawCandidate = makeCandidate({
      entityId: 'id-1',
      fullName: 'John Smith',
    });

    const results = await rerankCandidates('John Smith', [candidate], DEFAULT_MATCHING_CONFIG);

    expect(results[0].matchedField).toBeDefined();
    expect(typeof results[0].matchedField).toBe('string');
    expect(results[0].matchedField.length).toBeGreaterThan(0);
  });

  it('result shape conforms to MatchResult fields', async () => {
    const candidate: RawCandidate = makeCandidate({
      entityId: 'id-42',
      fullName: 'Jane Doe',
      entityType: 'person',
      properties: {
        pepRole: 'Minister',
        sanctionsList: ['OFAC'],
        nationality: ['US'],
      },
    });

    const results = await rerankCandidates('Jane Doe', [candidate], DEFAULT_MATCHING_CONFIG);

    expect(results.length).toBeGreaterThan(0);
    const r = results[0];
    expect(r.entityId).toBe('id-42');
    expect(r.fullName).toBe('Jane Doe');
    expect(r.entityType).toBe('person');
    expect(typeof r.score).toBe('number');
    expect(typeof r.matchedField).toBe('string');
    expect(Array.isArray(r.sanctionsList)).toBe(true);
    expect(typeof r.linkedEntityCount).toBe('number');
  });
});
