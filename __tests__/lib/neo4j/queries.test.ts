import { describe, it, expect } from 'vitest';
import {
  buildUpsertPersonQuery,
  buildUpsertCompanyQuery,
  buildFuzzySearchQuery,
  buildEntityDetailQuery,
  buildEntityNetworkQuery,
  buildDataStatusQuery,
  buildCrawlRunQuery,
} from '@/lib/neo4j/queries';
import type { Person, Company, CrawlRun } from '@/lib/types';

// ── Fixtures ──────────────────────────────────────────────────────────────────

const samplePerson: Person = {
  id: 'person-1',
  fullName: 'John Doe',
  aliases: ['J. Doe'],
  normalizedName: 'john doe',
  dateOfBirth: '1970-01-01',
  nationality: ['US'],
  pepRole: 'Minister',
  pepCountry: 'US',
  sanctionsList: ['SDN'],
  riskLevel: 'HIGH',
  sourceIds: ['source-1'],
  lastUpdated: '2024-01-01T00:00:00.000Z',
};

const sampleCompany: Company = {
  id: 'company-1',
  name: 'Acme Corp',
  normalizedName: 'acme corp',
  jurisdiction: 'US',
  registrationNumber: 'REG-001',
  sanctionsList: ['SDN'],
  sourceIds: ['source-1'],
  lastUpdated: '2024-01-01T00:00:00.000Z',
};

const sampleCrawlRun: CrawlRun = {
  id: 'run-1',
  source: 'OFAC',
  date: '2024-01-01',
  status: 'success',
  recordCount: 100,
  startedAt: '2024-01-01T00:00:00.000Z',
  completedAt: '2024-01-01T01:00:00.000Z',
};

// ── buildUpsertPersonQuery ────────────────────────────────────────────────────

describe('buildUpsertPersonQuery', () => {
  it('returns an object with cypher and params', () => {
    const result = buildUpsertPersonQuery(samplePerson);
    expect(result).toHaveProperty('cypher');
    expect(result).toHaveProperty('params');
  });

  it('cypher contains MERGE on Person', () => {
    const { cypher } = buildUpsertPersonQuery(samplePerson);
    expect(cypher).toContain('MERGE');
    expect(cypher).toContain('Person');
    expect(cypher).toContain('SET');
  });

  it('cypher contains datetime() for lastUpdated', () => {
    const { cypher } = buildUpsertPersonQuery(samplePerson);
    expect(cypher).toContain('datetime');
    expect(cypher).toContain('lastUpdated');
  });

  it('params contains all Person fields', () => {
    const { params } = buildUpsertPersonQuery(samplePerson);
    expect(params.id).toBe('person-1');
    expect(params.fullName).toBe('John Doe');
    expect(params.aliases).toEqual(['J. Doe']);
    expect(params.normalizedName).toBe('john doe');
    expect(params.dateOfBirth).toBe('1970-01-01');
    expect(params.nationality).toEqual(['US']);
    expect(params.pepRole).toBe('Minister');
    expect(params.pepCountry).toBe('US');
    expect(params.sanctionsList).toEqual(['SDN']);
    expect(params.riskLevel).toBe('HIGH');
    expect(params.sourceIds).toEqual(['source-1']);
    expect(params.lastUpdated).toBe('2024-01-01T00:00:00.000Z');
  });

  it('cypher merges on person id param', () => {
    const { cypher } = buildUpsertPersonQuery(samplePerson);
    expect(cypher).toContain('id:');
  });
});

// ── buildUpsertCompanyQuery ───────────────────────────────────────────────────

describe('buildUpsertCompanyQuery', () => {
  it('returns an object with cypher and params', () => {
    const result = buildUpsertCompanyQuery(sampleCompany);
    expect(result).toHaveProperty('cypher');
    expect(result).toHaveProperty('params');
  });

  it('cypher contains MERGE on Company', () => {
    const { cypher } = buildUpsertCompanyQuery(sampleCompany);
    expect(cypher).toContain('MERGE');
    expect(cypher).toContain('Company');
    expect(cypher).toContain('SET');
  });

  it('cypher contains datetime() for lastUpdated', () => {
    const { cypher } = buildUpsertCompanyQuery(sampleCompany);
    expect(cypher).toContain('datetime');
    expect(cypher).toContain('lastUpdated');
  });

  it('params contains all Company fields', () => {
    const { params } = buildUpsertCompanyQuery(sampleCompany);
    expect(params.id).toBe('company-1');
    expect(params.name).toBe('Acme Corp');
    expect(params.normalizedName).toBe('acme corp');
    expect(params.jurisdiction).toBe('US');
    expect(params.registrationNumber).toBe('REG-001');
    expect(params.sanctionsList).toEqual(['SDN']);
    expect(params.sourceIds).toEqual(['source-1']);
    expect(params.lastUpdated).toBe('2024-01-01T00:00:00.000Z');
  });
});

// ── buildFuzzySearchQuery ─────────────────────────────────────────────────────

describe('buildFuzzySearchQuery', () => {
  it('returns an object with cypher and params', () => {
    const result = buildFuzzySearchQuery('john doe', 'person', 10);
    expect(result).toHaveProperty('cypher');
    expect(result).toHaveProperty('params');
  });

  it('cypher uses db.index.fulltext.queryNodes', () => {
    const { cypher } = buildFuzzySearchQuery('john doe', 'person', 10);
    expect(cypher).toContain('db.index.fulltext.queryNodes');
  });

  it('uses personNames index for person entity type', () => {
    const { cypher } = buildFuzzySearchQuery('john doe', 'person', 10);
    expect(cypher).toContain('personNames');
    expect(cypher).not.toContain('companyNames');
  });

  it('uses companyNames index for company entity type', () => {
    const { cypher } = buildFuzzySearchQuery('acme corp', 'company', 10);
    expect(cypher).toContain('companyNames');
    expect(cypher).not.toContain('personNames');
  });

  it('appends ~ to each word for fuzzy matching', () => {
    const { params } = buildFuzzySearchQuery('john doe', 'person', 10);
    expect(params.searchTerm).toContain('~');
    // Each word should have a ~ appended
    const term = params.searchTerm as string;
    expect(term).toContain('john~');
    expect(term).toContain('doe~');
  });

  it('single word also gets ~ appended', () => {
    const { params } = buildFuzzySearchQuery('acme', 'company', 5);
    expect(params.searchTerm).toBe('acme~');
  });

  it('cypher contains ORDER BY score DESC', () => {
    const { cypher } = buildFuzzySearchQuery('john', 'person', 10);
    expect(cypher).toContain('ORDER BY');
    expect(cypher).toContain('score');
    expect(cypher).toContain('DESC');
  });

  it('cypher contains LIMIT with interpolated value', () => {
    const { cypher } = buildFuzzySearchQuery('john', 'person', 15);
    expect(cypher).toContain('LIMIT 15');
  });

  it('cypher truncates non-integer limit', () => {
    const { cypher } = buildFuzzySearchQuery('john', 'person', 15.7);
    expect(cypher).toContain('LIMIT 15');
  });
});

// ── buildEntityDetailQuery ────────────────────────────────────────────────────

describe('buildEntityDetailQuery', () => {
  it('returns an object with cypher and params', () => {
    const result = buildEntityDetailQuery('entity-1');
    expect(result).toHaveProperty('cypher');
    expect(result).toHaveProperty('params');
  });

  it('cypher MATCHes entity by id', () => {
    const { cypher } = buildEntityDetailQuery('entity-1');
    expect(cypher).toContain('MATCH');
    expect(cypher).toContain('id');
  });

  it('cypher contains OPTIONAL MATCH for relationships', () => {
    const { cypher } = buildEntityDetailQuery('entity-1');
    expect(cypher).toContain('OPTIONAL MATCH');
  });

  it('cypher contains LISTED_ON sanctions', () => {
    const { cypher } = buildEntityDetailQuery('entity-1');
    expect(cypher).toContain('LISTED_ON');
  });

  it('cypher contains NATIONAL_OF country', () => {
    const { cypher } = buildEntityDetailQuery('entity-1');
    expect(cypher).toContain('NATIONAL_OF');
  });

  it('cypher contains RETURN', () => {
    const { cypher } = buildEntityDetailQuery('entity-1');
    expect(cypher).toContain('RETURN');
  });

  it('params contains entityId', () => {
    const { params } = buildEntityDetailQuery('entity-1');
    expect(params.entityId).toBe('entity-1');
  });
});

// ── buildEntityNetworkQuery ───────────────────────────────────────────────────

describe('buildEntityNetworkQuery', () => {
  it('returns an object with cypher and params', () => {
    const result = buildEntityNetworkQuery('entity-1', 2);
    expect(result).toHaveProperty('cypher');
    expect(result).toHaveProperty('params');
  });

  it('cypher contains variable-length path pattern', () => {
    const { cypher } = buildEntityNetworkQuery('entity-1', 2);
    expect(cypher).toMatch(/\*1\.\.\d/);
  });

  it('depth is used in the path pattern', () => {
    const { cypher } = buildEntityNetworkQuery('entity-1', 2);
    expect(cypher).toContain('*1..2');
  });

  it('caps depth at 4', () => {
    const { cypher } = buildEntityNetworkQuery('entity-1', 10);
    expect(cypher).toContain('*1..4');
    expect(cypher).not.toContain('*1..10');
    expect(cypher).not.toContain('*1..5');
  });

  it('depth of exactly 4 is not capped', () => {
    const { cypher } = buildEntityNetworkQuery('entity-1', 4);
    expect(cypher).toContain('*1..4');
  });

  it('depth of 3 is preserved', () => {
    const { cypher } = buildEntityNetworkQuery('entity-1', 3);
    expect(cypher).toContain('*1..3');
  });

  it('cypher contains RETURN with node info', () => {
    const { cypher } = buildEntityNetworkQuery('entity-1', 2);
    expect(cypher).toContain('RETURN');
  });

  it('params contains entityId', () => {
    const { params } = buildEntityNetworkQuery('entity-1', 2);
    expect(params.entityId).toBe('entity-1');
  });
});

// ── buildDataStatusQuery ──────────────────────────────────────────────────────

describe('buildDataStatusQuery', () => {
  it('returns an object with cypher and params', () => {
    const result = buildDataStatusQuery();
    expect(result).toHaveProperty('cypher');
    expect(result).toHaveProperty('params');
  });

  it('cypher MATCHes CrawlRun nodes', () => {
    const { cypher } = buildDataStatusQuery();
    expect(cypher).toContain('CrawlRun');
    expect(cypher).toContain('MATCH');
  });

  it('cypher groups by source', () => {
    const { cypher } = buildDataStatusQuery();
    expect(cypher).toContain('source');
  });

  it('cypher orders by source', () => {
    const { cypher } = buildDataStatusQuery();
    expect(cypher).toContain('ORDER BY');
    expect(cypher).toContain('source');
  });

  it('cypher returns latest per source', () => {
    const { cypher } = buildDataStatusQuery();
    // Should use max() or similar aggregation, or collect and order
    expect(cypher).toContain('RETURN');
  });

  it('params is an empty object', () => {
    const { params } = buildDataStatusQuery();
    expect(params).toEqual({});
  });
});

// ── buildCrawlRunQuery ────────────────────────────────────────────────────────

describe('buildCrawlRunQuery', () => {
  it('returns an object with cypher and params', () => {
    const result = buildCrawlRunQuery(sampleCrawlRun);
    expect(result).toHaveProperty('cypher');
    expect(result).toHaveProperty('params');
  });

  it('cypher contains MERGE on CrawlRun', () => {
    const { cypher } = buildCrawlRunQuery(sampleCrawlRun);
    expect(cypher).toContain('MERGE');
    expect(cypher).toContain('CrawlRun');
    expect(cypher).toContain('SET');
  });

  it('params contains all CrawlRun fields', () => {
    const { params } = buildCrawlRunQuery(sampleCrawlRun);
    expect(params.id).toBe('run-1');
    expect(params.source).toBe('OFAC');
    expect(params.date).toBe('2024-01-01');
    expect(params.status).toBe('success');
    expect(params.recordCount).toBe(100);
    expect(params.startedAt).toBe('2024-01-01T00:00:00.000Z');
    expect(params.completedAt).toBe('2024-01-01T01:00:00.000Z');
  });

  it('cypher merges on crawl run id', () => {
    const { cypher } = buildCrawlRunQuery(sampleCrawlRun);
    expect(cypher).toContain('id:');
  });

  it('handles optional fields being undefined', () => {
    const runWithoutOptionals: CrawlRun = {
      id: 'run-2',
      source: 'UN',
      date: '2024-02-01',
      status: 'running',
      recordCount: 0,
      startedAt: '2024-02-01T00:00:00.000Z',
    };
    const result = buildCrawlRunQuery(runWithoutOptionals);
    expect(result.params.completedAt).toBeUndefined();
    expect(result.params.error).toBeUndefined();
  });
});
