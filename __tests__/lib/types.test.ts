import {
  PersonSchema,
  ScreenRequestSchema,
  BatchScreenRequestSchema,
  MatchResultSchema,
  CrawlRunSchema,
  NormalizedEntitySchema,
} from '@/lib/types';

// ─── PersonSchema ────────────────────────────────────────────────────────────

describe('PersonSchema', () => {
  const validPerson = {
    id: 'p-001',
    fullName: 'John Doe',
    aliases: ['Johnny Doe'],
    normalizedName: 'john doe',
    dateOfBirth: '1980-01-15',
    nationality: ['US'],
    pepRole: 'Minister of Finance',
    pepCountry: 'US',
    sanctionsList: ['OFAC-SDN'],
    riskLevel: 'HIGH' as const,
    sourceIds: ['src-1'],
    lastUpdated: '2024-01-01T00:00:00Z',
  };

  it('accepts a fully populated valid person', () => {
    const result = PersonSchema.safeParse(validPerson);
    expect(result.success).toBe(true);
  });

  it('accepts a person with only required fields', () => {
    const minimal = {
      id: 'p-002',
      fullName: 'Jane Smith',
      aliases: [],
      normalizedName: 'jane smith',
      nationality: [],
      sanctionsList: [],
      sourceIds: [],
      lastUpdated: '2024-01-01T00:00:00Z',
    };
    const result = PersonSchema.safeParse(minimal);
    expect(result.success).toBe(true);
  });

  it('accepts a person without riskLevel (optional)', () => {
    const { riskLevel, ...withoutRiskLevel } = validPerson;
    const result = PersonSchema.safeParse(withoutRiskLevel);
    expect(result.success).toBe(true);
  });

  it('accepts nationality as an array of country codes', () => {
    const result = PersonSchema.safeParse({ ...validPerson, nationality: ['US', 'GB'] });
    expect(result.success).toBe(true);
  });

  it('rejects nationality as a string', () => {
    const result = PersonSchema.safeParse({ ...validPerson, nationality: 'US' });
    expect(result.success).toBe(false);
  });

  it('allows optional fields to be undefined', () => {
    const person = { ...validPerson, dateOfBirth: undefined, pepRole: undefined, pepCountry: undefined, riskLevel: undefined };
    const result = PersonSchema.safeParse(person);
    expect(result.success).toBe(true);
  });

  it('rejects invalid riskLevel', () => {
    const result = PersonSchema.safeParse({ ...validPerson, riskLevel: 'CRITICAL' });
    expect(result.success).toBe(false);
  });

  it('rejects missing required fields', () => {
    const result = PersonSchema.safeParse({ id: 'p-001', fullName: 'Test' });
    expect(result.success).toBe(false);
  });

  it('accepts MEDIUM riskLevel', () => {
    const result = PersonSchema.safeParse({ ...validPerson, riskLevel: 'MEDIUM' });
    expect(result.success).toBe(true);
  });
});

// ─── ScreenRequestSchema ─────────────────────────────────────────────────────

describe('ScreenRequestSchema', () => {
  it('accepts a valid screen request with only name', () => {
    const result = ScreenRequestSchema.safeParse({ name: 'John Doe' });
    expect(result.success).toBe(true);
  });

  it('accepts a full screen request with all optional fields', () => {
    const result = ScreenRequestSchema.safeParse({
      name: 'John Doe',
      dob: '1980-01-15',
      nationality: 'US',
      threshold: 0.8,
    });
    expect(result.success).toBe(true);
  });

  it('accepts threshold = 0', () => {
    const result = ScreenRequestSchema.safeParse({ name: 'Test', threshold: 0 });
    expect(result.success).toBe(true);
  });

  it('accepts threshold = 1', () => {
    const result = ScreenRequestSchema.safeParse({ name: 'Test', threshold: 1 });
    expect(result.success).toBe(true);
  });

  it('rejects threshold > 1', () => {
    const result = ScreenRequestSchema.safeParse({ name: 'Test', threshold: 1.1 });
    expect(result.success).toBe(false);
  });

  it('rejects threshold < 0', () => {
    const result = ScreenRequestSchema.safeParse({ name: 'Test', threshold: -0.1 });
    expect(result.success).toBe(false);
  });

  it('rejects missing name', () => {
    const result = ScreenRequestSchema.safeParse({ threshold: 0.5 });
    expect(result.success).toBe(false);
  });
});

// ─── BatchScreenRequestSchema ────────────────────────────────────────────────

describe('BatchScreenRequestSchema', () => {
  const validEntity = { name: 'Acme Corp', type: 'company' as const };
  const validPersonEntity = { name: 'John Doe', type: 'person' as const, dob: '1980-01-15', nationality: 'US' };

  it('accepts a batch with a single entity', () => {
    const result = BatchScreenRequestSchema.safeParse({ entities: [validEntity] });
    expect(result.success).toBe(true);
  });

  it('accepts a batch with person and company entities', () => {
    const result = BatchScreenRequestSchema.safeParse({ entities: [validEntity, validPersonEntity] });
    expect(result.success).toBe(true);
  });

  it('accepts a batch with exactly 1000 entities', () => {
    const entities = Array.from({ length: 1000 }, (_, i) => ({ name: `Entity ${i}`, type: 'person' as const }));
    const result = BatchScreenRequestSchema.safeParse({ entities });
    expect(result.success).toBe(true);
  });

  it('rejects more than 1000 entities', () => {
    const entities = Array.from({ length: 1001 }, (_, i) => ({ name: `Entity ${i}`, type: 'person' as const }));
    const result = BatchScreenRequestSchema.safeParse({ entities });
    expect(result.success).toBe(false);
  });

  it('rejects an empty entities array', () => {
    const result = BatchScreenRequestSchema.safeParse({ entities: [] });
    expect(result.success).toBe(false);
  });

  it('rejects invalid entity type', () => {
    const result = BatchScreenRequestSchema.safeParse({ entities: [{ name: 'Test', type: 'organisation' }] });
    expect(result.success).toBe(false);
  });

  it('rejects missing entities field', () => {
    const result = BatchScreenRequestSchema.safeParse({});
    expect(result.success).toBe(false);
  });
});

// ─── MatchResultSchema ───────────────────────────────────────────────────────

describe('MatchResultSchema', () => {
  const validMatch = {
    entityId: 'e-001',
    fullName: 'John Doe',
    score: 0.95,
    matchedField: 'fullName',
    entityType: 'person' as const,
    pepRole: 'Minister',
    sanctionsList: ['OFAC'],
    nationality: ['US'],
    linkedEntityCount: 3,
  };

  it('accepts a fully populated valid match result', () => {
    const result = MatchResultSchema.safeParse(validMatch);
    expect(result.success).toBe(true);
  });

  it('accepts a match result without optional fields', () => {
    const minimal = {
      entityId: 'e-002',
      fullName: 'Jane Smith',
      score: 0.75,
      matchedField: 'alias',
      entityType: 'company' as const,
      sanctionsList: [],
      linkedEntityCount: 0,
    };
    const result = MatchResultSchema.safeParse(minimal);
    expect(result.success).toBe(true);
  });

  it('accepts score = 0', () => {
    const result = MatchResultSchema.safeParse({ ...validMatch, score: 0 });
    expect(result.success).toBe(true);
  });

  it('accepts score = 1', () => {
    const result = MatchResultSchema.safeParse({ ...validMatch, score: 1 });
    expect(result.success).toBe(true);
  });

  it('rejects score > 1', () => {
    const result = MatchResultSchema.safeParse({ ...validMatch, score: 1.01 });
    expect(result.success).toBe(false);
  });

  it('rejects score < 0', () => {
    const result = MatchResultSchema.safeParse({ ...validMatch, score: -0.01 });
    expect(result.success).toBe(false);
  });

  it('rejects invalid entityType', () => {
    const result = MatchResultSchema.safeParse({ ...validMatch, entityType: 'organisation' });
    expect(result.success).toBe(false);
  });

  it('accepts nationality as an array of country codes', () => {
    const result = MatchResultSchema.safeParse({ ...validMatch, nationality: ['US', 'CA'] });
    expect(result.success).toBe(true);
  });

  it('rejects nationality as a string', () => {
    const result = MatchResultSchema.safeParse({ ...validMatch, nationality: 'US' });
    expect(result.success).toBe(false);
  });
});

// ─── CrawlRunSchema ──────────────────────────────────────────────────────────

describe('CrawlRunSchema', () => {
  const validRun = {
    id: 'run-001',
    source: 'OFAC',
    date: '2024-01-01',
    status: 'success' as const,
    recordCount: 1500,
    startedAt: '2024-01-01T00:00:00Z',
    completedAt: '2024-01-01T01:00:00Z',
  };

  it('accepts a valid successful crawl run', () => {
    const result = CrawlRunSchema.safeParse(validRun);
    expect(result.success).toBe(true);
  });

  it('accepts a failed run with error message', () => {
    const result = CrawlRunSchema.safeParse({
      ...validRun,
      status: 'failed',
      error: 'Connection timeout',
      completedAt: undefined,
    });
    expect(result.success).toBe(true);
  });

  it('accepts a running status without completedAt', () => {
    const result = CrawlRunSchema.safeParse({
      ...validRun,
      status: 'running',
      completedAt: undefined,
    });
    expect(result.success).toBe(true);
  });

  it('rejects invalid status', () => {
    const result = CrawlRunSchema.safeParse({ ...validRun, status: 'pending' });
    expect(result.success).toBe(false);
  });

  it('rejects missing required fields', () => {
    const result = CrawlRunSchema.safeParse({ id: 'run-001' });
    expect(result.success).toBe(false);
  });
});

// ─── NormalizedEntitySchema ──────────────────────────────────────────────────

describe('NormalizedEntitySchema', () => {
  const validPerson = {
    type: 'person' as const,
    fullName: 'John Doe',
    aliases: ['Johnny'],
    normalizedName: 'john doe',
    dateOfBirth: '1980-01-15',
    nationality: ['US'],
    pepRole: 'Minister',
    pepCountry: 'US',
    riskLevel: 'HIGH' as const,
    sourceId: 'src-1',
    source: 'OFAC',
    relationships: [
      {
        type: 'FAMILY_OF' as const,
        targetName: 'Jane Doe',
        relation: 'spouse',
        context: 'married 2005',
        since: '2005-01-01',
        until: undefined,
        percentage: undefined,
      },
    ],
  };

  const validCompany = {
    type: 'company' as const,
    fullName: 'Acme Corp',
    aliases: ['Acme'],
    normalizedName: 'acme corp',
    jurisdiction: 'US',
    registrationNumber: 'US123456',
    riskLevel: 'MEDIUM' as const,
    sourceId: 'src-2',
    source: 'EU',
    relationships: [],
  };

  it('accepts a valid person entity', () => {
    const result = NormalizedEntitySchema.safeParse(validPerson);
    expect(result.success).toBe(true);
  });

  it('accepts a valid company entity', () => {
    const result = NormalizedEntitySchema.safeParse(validCompany);
    expect(result.success).toBe(true);
  });

  it('accepts a person with empty relationships', () => {
    const result = NormalizedEntitySchema.safeParse({ ...validPerson, relationships: [] });
    expect(result.success).toBe(true);
  });

  it('accepts a relationship with percentage for ownership', () => {
    const result = NormalizedEntitySchema.safeParse({
      ...validCompany,
      relationships: [{ type: 'BENEFICIAL_OWNER_OF', targetName: 'Parent Inc', percentage: 51.5 }],
    });
    expect(result.success).toBe(true);
  });

  it('rejects a relationship with an invalid type', () => {
    const result = NormalizedEntitySchema.safeParse({
      ...validCompany,
      relationships: [{ type: 'ownership', targetName: 'Parent Inc' }],
    });
    expect(result.success).toBe(false);
  });

  it('accepts nationality as an array in NormalizedEntitySchema', () => {
    const result = NormalizedEntitySchema.safeParse({ ...validPerson, nationality: ['US', 'GB'] });
    expect(result.success).toBe(true);
  });

  it('rejects nationality as a string in NormalizedEntitySchema', () => {
    const result = NormalizedEntitySchema.safeParse({ ...validPerson, nationality: 'US' });
    expect(result.success).toBe(false);
  });

  it('rejects invalid type', () => {
    const result = NormalizedEntitySchema.safeParse({ ...validPerson, type: 'organisation' });
    expect(result.success).toBe(false);
  });

  it('rejects missing sourceId', () => {
    const { sourceId, ...withoutSourceId } = validPerson;
    const result = NormalizedEntitySchema.safeParse(withoutSourceId);
    expect(result.success).toBe(false);
  });

  it('rejects missing source', () => {
    const { source, ...withoutSource } = validPerson;
    const result = NormalizedEntitySchema.safeParse(withoutSource);
    expect(result.success).toBe(false);
  });

  it('accepts a person with no optional fields', () => {
    const minimal = {
      type: 'person' as const,
      fullName: 'Minimal Person',
      aliases: [],
      normalizedName: 'minimal person',
      sourceId: 'src-1',
      source: 'OFAC',
      relationships: [],
    };
    const result = NormalizedEntitySchema.safeParse(minimal);
    expect(result.success).toBe(true);
  });
});
