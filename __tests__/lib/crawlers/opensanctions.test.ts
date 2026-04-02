import { describe, it, expect, vi, beforeEach } from 'vitest';
import { OpenSanctionsCrawler } from '@/lib/crawlers/opensanctions';

// ─── Sample JSONL data ────────────────────────────────────────────────────────

const PERSON_LINE = JSON.stringify({
  id: 'os-person-001',
  schema: 'Person',
  properties: {
    name: ['Jane Smith'],
    alias: ['J. Smith', 'Janet Smith'],
    birthDate: ['1985-03-15'],
    nationality: ['United States'],
    position: ['Senator'],
    topics: ['role.pep'],
  },
});

const COMPANY_LINE = JSON.stringify({
  id: 'os-company-002',
  schema: 'Company',
  properties: {
    name: ['Acme Holdings Ltd'],
    alias: ['Acme Holdings'],
    topics: ['sanction'],
  },
});

const ORG_LINE = JSON.stringify({
  id: 'os-org-003',
  schema: 'Organization',
  properties: {
    name: ['Global Watch NGO'],
    topics: [],
  },
});

const LEGAL_LINE = JSON.stringify({
  id: 'os-legal-004',
  schema: 'LegalEntity',
  properties: {
    name: ['Delta Corp'],
    topics: ['sanction'],
  },
});

// Should be filtered out (schema not in allowed list)
const VESSEL_LINE = JSON.stringify({
  id: 'os-vessel-005',
  schema: 'Vessel',
  properties: {
    name: ['MV Ghost'],
    topics: [],
  },
});

const SAMPLE_JSONL = [PERSON_LINE, COMPANY_LINE, ORG_LINE, LEGAL_LINE, VESSEL_LINE, ''].join('\n');

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('OpenSanctionsCrawler', () => {
  let crawler: OpenSanctionsCrawler;

  beforeEach(() => {
    crawler = new OpenSanctionsCrawler();
    vi.restoreAllMocks();
  });

  // ─── Identity ──────────────────────────────────────────────────────────────

  it('has correct name', () => {
    expect(crawler.name).toBe('OpenSanctions');
  });

  it('has correct sourceId', () => {
    expect(crawler.sourceId).toBe('opensanctions');
  });

  // ─── fetch() ──────────────────────────────────────────────────────────────

  describe('fetch()', () => {
    it('parses JSONL and returns only allowed-schema entities', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: true,
        text: async () => SAMPLE_JSONL,
      }));

      const results = await crawler.fetch();

      // Vessel is filtered out; 4 allowed entities remain
      expect(results).toHaveLength(4);
    });

    it('sets source to "opensanctions" on each entity', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: true,
        text: async () => SAMPLE_JSONL,
      }));

      const results = await crawler.fetch();

      for (const r of results) {
        expect(r.source).toBe('opensanctions');
      }
    });

    it('sets rawId from the JSON id field', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: true,
        text: async () => SAMPLE_JSONL,
      }));

      const results = await crawler.fetch();
      const ids = results.map((r) => r.rawId);

      expect(ids).toContain('os-person-001');
      expect(ids).toContain('os-company-002');
      expect(ids).not.toContain('os-vessel-005');
    });

    it('stores schema and properties in rawData', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: true,
        text: async () => SAMPLE_JSONL,
      }));

      const results = await crawler.fetch();
      const person = results.find((r) => r.rawId === 'os-person-001')!;

      expect(person.rawData['schema']).toBe('Person');
      const props = person.rawData['properties'] as Record<string, unknown>;
      expect(props['name']).toEqual(['Jane Smith']);
    });

    it('throws on HTTP failure', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
      }));

      await expect(crawler.fetch()).rejects.toThrow('500');
    });

    it('skips lines with invalid JSON gracefully', async () => {
      const badJsonl = `${PERSON_LINE}\nnot-valid-json\n${COMPANY_LINE}`;
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: true,
        text: async () => badJsonl,
      }));

      const results = await crawler.fetch();
      expect(results).toHaveLength(2);
    });
  });

  // ─── normalize() ──────────────────────────────────────────────────────────

  describe('normalize()', () => {
    it('maps Person schema to type "person"', () => {
      const raw = [
        {
          rawId: 'os-person-001',
          source: 'opensanctions',
          rawData: {
            schema: 'Person',
            properties: {
              name: ['Jane Smith'],
              alias: [],
              birthDate: ['1985-03-15'],
              nationality: ['United States'],
              position: ['Senator'],
              topics: [],
            },
          },
        },
      ];

      const normalized = crawler.normalize(raw);

      expect(normalized[0].type).toBe('person');
    });

    it('maps Company schema to type "company"', () => {
      const raw = [
        {
          rawId: 'os-company-002',
          source: 'opensanctions',
          rawData: {
            schema: 'Company',
            properties: {
              name: ['Acme Holdings Ltd'],
              alias: [],
              topics: ['sanction'],
            },
          },
        },
      ];

      const normalized = crawler.normalize(raw);

      expect(normalized[0].type).toBe('company');
    });

    it('maps Organization schema to type "company"', () => {
      const raw = [
        {
          rawId: 'os-org-003',
          source: 'opensanctions',
          rawData: {
            schema: 'Organization',
            properties: { name: ['Some Org'], topics: [] },
          },
        },
      ];

      const normalized = crawler.normalize(raw);

      expect(normalized[0].type).toBe('company');
    });

    it('sets fullName from properties.name[0]', () => {
      const raw = [
        {
          rawId: 'os-person-001',
          source: 'opensanctions',
          rawData: {
            schema: 'Person',
            properties: { name: ['Jane Smith'], topics: [] },
          },
        },
      ];

      const normalized = crawler.normalize(raw);

      expect(normalized[0].fullName).toBe('Jane Smith');
    });

    it('produces a normalizedName via normalizeName()', () => {
      const raw = [
        {
          rawId: 'os-person-001',
          source: 'opensanctions',
          rawData: {
            schema: 'Person',
            properties: { name: ['Jane Smith'], topics: [] },
          },
        },
      ];

      const normalized = crawler.normalize(raw);

      expect(normalized[0].normalizedName).toBe('jane smith');
    });

    it('sets aliases from properties.alias', () => {
      const raw = [
        {
          rawId: 'os-person-001',
          source: 'opensanctions',
          rawData: {
            schema: 'Person',
            properties: {
              name: ['Jane Smith'],
              alias: ['J. Smith', 'Janet Smith'],
              topics: [],
            },
          },
        },
      ];

      const normalized = crawler.normalize(raw);

      expect(normalized[0].aliases).toEqual(['J. Smith', 'Janet Smith']);
    });

    it('sets dateOfBirth from properties.birthDate[0]', () => {
      const raw = [
        {
          rawId: 'os-person-001',
          source: 'opensanctions',
          rawData: {
            schema: 'Person',
            properties: {
              name: ['Jane Smith'],
              birthDate: ['1985-03-15'],
              topics: [],
            },
          },
        },
      ];

      const normalized = crawler.normalize(raw);

      expect(normalized[0].dateOfBirth).toBe('1985-03-15');
    });

    it('omits dateOfBirth when not present', () => {
      const raw = [
        {
          rawId: 'os-person-001',
          source: 'opensanctions',
          rawData: {
            schema: 'Person',
            properties: { name: ['Jane Smith'], topics: [] },
          },
        },
      ];

      const normalized = crawler.normalize(raw);

      expect(normalized[0].dateOfBirth).toBeUndefined();
    });

    it('sets nationality from properties.nationality', () => {
      const raw = [
        {
          rawId: 'os-person-001',
          source: 'opensanctions',
          rawData: {
            schema: 'Person',
            properties: {
              name: ['Jane Smith'],
              nationality: ['United States'],
              topics: [],
            },
          },
        },
      ];

      const normalized = crawler.normalize(raw);

      expect(normalized[0].nationality).toEqual(['United States']);
    });

    it('sets pepRole from properties.position[0]', () => {
      const raw = [
        {
          rawId: 'os-person-001',
          source: 'opensanctions',
          rawData: {
            schema: 'Person',
            properties: {
              name: ['Jane Smith'],
              position: ['Senator'],
              topics: [],
            },
          },
        },
      ];

      const normalized = crawler.normalize(raw);

      expect(normalized[0].pepRole).toBe('Senator');
    });

    it('sets riskLevel to "HIGH" when topics includes "sanction"', () => {
      const raw = [
        {
          rawId: 'os-company-002',
          source: 'opensanctions',
          rawData: {
            schema: 'Company',
            properties: {
              name: ['Bad Corp'],
              topics: ['sanction', 'role.pep'],
            },
          },
        },
      ];

      const normalized = crawler.normalize(raw);

      expect(normalized[0].riskLevel).toBe('HIGH');
    });

    it('sets riskLevel to "MEDIUM" when topics does not include "sanction"', () => {
      const raw = [
        {
          rawId: 'os-person-001',
          source: 'opensanctions',
          rawData: {
            schema: 'Person',
            properties: {
              name: ['Jane Smith'],
              topics: ['role.pep'],
            },
          },
        },
      ];

      const normalized = crawler.normalize(raw);

      expect(normalized[0].riskLevel).toBe('MEDIUM');
    });

    it('sets source to "opensanctions"', () => {
      const raw = [
        {
          rawId: 'os-person-001',
          source: 'opensanctions',
          rawData: {
            schema: 'Person',
            properties: { name: ['Jane Smith'], topics: [] },
          },
        },
      ];

      const normalized = crawler.normalize(raw);

      expect(normalized[0].source).toBe('opensanctions');
    });
  });
});
