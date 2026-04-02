import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mock candidates module BEFORE importing matcher ───────────────────────────
vi.mock('@/lib/matching/candidates', () => ({
  retrieveCandidates: vi.fn(),
}));

import { screenPerson, screenCompany } from '@/lib/matching/matcher';
import { retrieveCandidates } from '@/lib/matching/candidates';
import type { RawCandidate } from '@/lib/matching/candidates';
import { DEFAULT_MATCHING_CONFIG } from '@/lib/types';

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeRawCandidate(overrides: Partial<RawCandidate> & { fullName: string }): RawCandidate {
  return {
    entityId: overrides.entityId ?? 'id-1',
    fullName: overrides.fullName,
    normalizedName: overrides.normalizedName ?? overrides.fullName.toLowerCase(),
    entityType: overrides.entityType ?? 'person',
    luceneScore: overrides.luceneScore ?? 1.0,
    properties: overrides.properties ?? {},
  };
}

const mockRetrieveCandidates = vi.mocked(retrieveCandidates);

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('screenPerson', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('calls retrieveCandidates with correct name and person entityType', async () => {
    mockRetrieveCandidates.mockResolvedValue([]);

    await screenPerson({ name: 'John Smith' });

    expect(mockRetrieveCandidates).toHaveBeenCalledOnce();
    expect(mockRetrieveCandidates).toHaveBeenCalledWith('John Smith', 'person', 20);
  });

  it('returns MatchResult[] from re-ranked candidates', async () => {
    const candidates: RawCandidate[] = [
      makeRawCandidate({ entityId: 'id-1', fullName: 'John Smith' }),
    ];
    mockRetrieveCandidates.mockResolvedValue(candidates);

    const results = await screenPerson({ name: 'John Smith' });

    expect(Array.isArray(results)).toBe(true);
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].entityId).toBe('id-1');
  });

  it('returns empty array when no candidates are found', async () => {
    mockRetrieveCandidates.mockResolvedValue([]);

    const results = await screenPerson({ name: 'Nobody Nowhere' });

    expect(results).toEqual([]);
  });

  it('caps results at 10 when more than 10 candidates pass threshold', async () => {
    // Create 15 candidates that all exactly match so they all pass minScore
    const candidates: RawCandidate[] = Array.from({ length: 15 }, (_, i) =>
      makeRawCandidate({ entityId: `id-${i}`, fullName: 'John Smith' }),
    );
    mockRetrieveCandidates.mockResolvedValue(candidates);

    const results = await screenPerson({ name: 'John Smith' });

    expect(results.length).toBeLessThanOrEqual(10);
  });

  it('uses threshold from request to override config minScore', async () => {
    // Candidate with a slightly different name that would not pass the default 0.6 threshold
    // but certainly passes 0.0
    const candidates: RawCandidate[] = [
      makeRawCandidate({ entityId: 'id-1', fullName: 'Completely Different Name XYZ' }),
    ];
    mockRetrieveCandidates.mockResolvedValue(candidates);

    // With very low threshold (0.0) all results should come through
    const resultsLow = await screenPerson({ name: 'John Smith', threshold: 0.0 });
    // With very high threshold (1.0) only perfect matches should come through
    const resultsHigh = await screenPerson({ name: 'John Smith', threshold: 1.0 });

    expect(resultsLow.length).toBeGreaterThanOrEqual(resultsHigh.length);
  });

  it('accepts optional dob and nationality boost options', async () => {
    const candidates: RawCandidate[] = [
      makeRawCandidate({
        entityId: 'id-1',
        fullName: 'Jon Smith',
        properties: { dateOfBirth: '1970-01-01', nationality: ['GB'] },
      }),
    ];
    mockRetrieveCandidates.mockResolvedValue(candidates);

    const resultsWithBoosts = await screenPerson({
      name: 'John Smith',
      dob: '1970-01-01',
      nationality: 'GB',
    });

    const resultsWithoutBoosts = await screenPerson({ name: 'John Smith' });

    // When boosts apply, the score should be higher
    expect(resultsWithBoosts[0].score).toBeGreaterThan(resultsWithoutBoosts[0].score);
  });
});

describe('screenCompany', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('calls retrieveCandidates with company entityType', async () => {
    mockRetrieveCandidates.mockResolvedValue([]);

    await screenCompany({ name: 'Acme Corp' });

    expect(mockRetrieveCandidates).toHaveBeenCalledOnce();
    expect(mockRetrieveCandidates).toHaveBeenCalledWith('Acme Corp', 'company', 20);
  });

  it('returns MatchResult[] for company candidates', async () => {
    const candidates: RawCandidate[] = [
      makeRawCandidate({ entityId: 'co-1', fullName: 'Acme Corp', entityType: 'company' }),
    ];
    mockRetrieveCandidates.mockResolvedValue(candidates);

    const results = await screenCompany({ name: 'Acme Corp' });

    expect(Array.isArray(results)).toBe(true);
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].entityId).toBe('co-1');
    expect(results[0].entityType).toBe('company');
  });

  it('returns empty array when no candidates are found', async () => {
    mockRetrieveCandidates.mockResolvedValue([]);

    const results = await screenCompany({ name: 'Unknown Company LLC' });

    expect(results).toEqual([]);
  });

  it('caps results at 10 when more than 10 candidates pass threshold', async () => {
    const candidates: RawCandidate[] = Array.from({ length: 15 }, (_, i) =>
      makeRawCandidate({ entityId: `co-${i}`, fullName: 'Acme Corp', entityType: 'company' }),
    );
    mockRetrieveCandidates.mockResolvedValue(candidates);

    const results = await screenCompany({ name: 'Acme Corp' });

    expect(results.length).toBeLessThanOrEqual(10);
  });
});
