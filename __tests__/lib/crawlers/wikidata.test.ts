import { describe, it, expect, vi, beforeEach } from 'vitest';
import { WikidataCrawler } from '@/lib/crawlers/wikidata';

// ─── Sample SPARQL response ───────────────────────────────────────────────────

const SPARQL_RESPONSE = {
  results: {
    bindings: [
      // Person 1 – appears twice (two positions), should be deduplicated
      {
        person: { type: 'uri', value: 'http://www.wikidata.org/entity/Q12345' },
        personLabel: { type: 'literal', value: 'Maria Garcia' },
        positionLabel: { type: 'literal', value: 'Prime Minister' },
        countryLabel: { type: 'literal', value: 'Spain' },
        countryCode: { type: 'literal', value: 'ES' },
        dob: { type: 'literal', value: '1965-08-14T00:00:00Z' },
      },
      {
        person: { type: 'uri', value: 'http://www.wikidata.org/entity/Q12345' },
        personLabel: { type: 'literal', value: 'Maria Garcia' },
        positionLabel: { type: 'literal', value: 'Minister of Finance' },
        countryLabel: { type: 'literal', value: 'Spain' },
        countryCode: { type: 'literal', value: 'ES' },
        dob: { type: 'literal', value: '1965-08-14T00:00:00Z' },
      },
      // Person 2 – single entry, no dob
      {
        person: { type: 'uri', value: 'http://www.wikidata.org/entity/Q99999' },
        personLabel: { type: 'literal', value: 'John Politician' },
        positionLabel: { type: 'literal', value: 'Member of Parliament' },
        countryLabel: { type: 'literal', value: 'United Kingdom' },
        countryCode: { type: 'literal', value: 'GB' },
      },
      // Entry with missing person URI (should be skipped)
      {
        personLabel: { type: 'literal', value: 'Unknown' },
        positionLabel: { type: 'literal', value: 'Some Position' },
      },
    ],
  },
};

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('WikidataCrawler', () => {
  let crawler: WikidataCrawler;

  beforeEach(() => {
    crawler = new WikidataCrawler();
    vi.restoreAllMocks();
  });

  // ─── Identity ──────────────────────────────────────────────────────────────

  it('has correct name', () => {
    expect(crawler.name).toBe('Wikidata PEPs');
  });

  it('has correct sourceId', () => {
    expect(crawler.sourceId).toBe('wikidata');
  });

  // ─── fetch() ──────────────────────────────────────────────────────────────

  describe('fetch()', () => {
    it('parses SPARQL response and deduplicates by QID', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: true,
        json: async () => SPARQL_RESPONSE,
      }));

      const results = await crawler.fetch();

      // Q12345 appears twice but deduplicated; Q99999 once; missing-URI entry skipped
      expect(results).toHaveLength(2);
    });

    it('sets source to "wikidata" on each entity', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: true,
        json: async () => SPARQL_RESPONSE,
      }));

      const results = await crawler.fetch();

      for (const r of results) {
        expect(r.source).toBe('wikidata');
      }
    });

    it('sets rawId to the extracted QID', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: true,
        json: async () => SPARQL_RESPONSE,
      }));

      const results = await crawler.fetch();
      const ids = results.map((r) => r.rawId);

      expect(ids).toContain('Q12345');
      expect(ids).toContain('Q99999');
    });

    it('accumulates multiple positions for the same QID', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: true,
        json: async () => SPARQL_RESPONSE,
      }));

      const results = await crawler.fetch();
      const maria = results.find((r) => r.rawId === 'Q12345')!;
      const positions = maria.rawData['positions'] as string[];

      expect(positions).toContain('Prime Minister');
      expect(positions).toContain('Minister of Finance');
    });

    it('stores personLabel, countryLabel, countryCode and dob in rawData', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: true,
        json: async () => SPARQL_RESPONSE,
      }));

      const results = await crawler.fetch();
      const maria = results.find((r) => r.rawId === 'Q12345')!;

      expect(maria.rawData['personLabel']).toBe('Maria Garcia');
      expect(maria.rawData['countryLabel']).toBe('Spain');
      expect(maria.rawData['countryCode']).toBe('ES');
      expect(maria.rawData['dob']).toBe('1965-08-14T00:00:00Z');
    });

    it('throws on HTTP failure', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: false,
        status: 503,
      }));

      await expect(crawler.fetch()).rejects.toThrow('503');
    });

    it('handles empty bindings array', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ results: { bindings: [] } }),
      }));

      const results = await crawler.fetch();
      expect(results).toHaveLength(0);
    });
  });

  // ─── normalize() ──────────────────────────────────────────────────────────

  describe('normalize()', () => {
    it('maps all entities to type "person"', () => {
      const raw = [
        {
          rawId: 'Q12345',
          source: 'wikidata',
          rawData: {
            qid: 'Q12345',
            personLabel: 'Maria Garcia',
            positions: ['Prime Minister'],
            countryLabel: 'Spain',
            countryCode: 'ES',
            dob: '1965-08-14T00:00:00Z',
          },
        },
      ];

      const normalized = crawler.normalize(raw);

      expect(normalized[0].type).toBe('person');
    });

    it('sets fullName from personLabel', () => {
      const raw = [
        {
          rawId: 'Q12345',
          source: 'wikidata',
          rawData: {
            qid: 'Q12345',
            personLabel: 'Maria Garcia',
            positions: [],
          },
        },
      ];

      const normalized = crawler.normalize(raw);

      expect(normalized[0].fullName).toBe('Maria Garcia');
    });

    it('produces a normalizedName via normalizeName()', () => {
      const raw = [
        {
          rawId: 'Q12345',
          source: 'wikidata',
          rawData: {
            qid: 'Q12345',
            personLabel: 'Maria Garcia',
            positions: [],
          },
        },
      ];

      const normalized = crawler.normalize(raw);

      expect(normalized[0].normalizedName).toBe('maria garcia');
    });

    it('sets pepRole from positions[0]', () => {
      const raw = [
        {
          rawId: 'Q12345',
          source: 'wikidata',
          rawData: {
            qid: 'Q12345',
            personLabel: 'Maria Garcia',
            positions: ['Prime Minister', 'Minister of Finance'],
          },
        },
      ];

      const normalized = crawler.normalize(raw);

      expect(normalized[0].pepRole).toBe('Prime Minister');
    });

    it('omits pepRole when positions is empty', () => {
      const raw = [
        {
          rawId: 'Q12345',
          source: 'wikidata',
          rawData: {
            qid: 'Q12345',
            personLabel: 'Maria Garcia',
            positions: [],
          },
        },
      ];

      const normalized = crawler.normalize(raw);

      expect(normalized[0].pepRole).toBeUndefined();
    });

    it('sets nationality from countryLabel', () => {
      const raw = [
        {
          rawId: 'Q12345',
          source: 'wikidata',
          rawData: {
            qid: 'Q12345',
            personLabel: 'Maria Garcia',
            positions: [],
            countryLabel: 'Spain',
          },
        },
      ];

      const normalized = crawler.normalize(raw);

      expect(normalized[0].nationality).toEqual(['Spain']);
    });

    it('sets empty nationality when countryLabel absent', () => {
      const raw = [
        {
          rawId: 'Q12345',
          source: 'wikidata',
          rawData: {
            qid: 'Q12345',
            personLabel: 'Maria Garcia',
            positions: [],
          },
        },
      ];

      const normalized = crawler.normalize(raw);

      expect(normalized[0].nationality).toEqual([]);
    });

    it('sets pepCountry from countryCode', () => {
      const raw = [
        {
          rawId: 'Q12345',
          source: 'wikidata',
          rawData: {
            qid: 'Q12345',
            personLabel: 'Maria Garcia',
            positions: [],
            countryCode: 'ES',
          },
        },
      ];

      const normalized = crawler.normalize(raw);

      expect(normalized[0].pepCountry).toBe('ES');
    });

    it('omits pepCountry when countryCode absent', () => {
      const raw = [
        {
          rawId: 'Q12345',
          source: 'wikidata',
          rawData: {
            qid: 'Q12345',
            personLabel: 'Maria Garcia',
            positions: [],
          },
        },
      ];

      const normalized = crawler.normalize(raw);

      expect(normalized[0].pepCountry).toBeUndefined();
    });

    it('sets dateOfBirth when dob present', () => {
      const raw = [
        {
          rawId: 'Q12345',
          source: 'wikidata',
          rawData: {
            qid: 'Q12345',
            personLabel: 'Maria Garcia',
            positions: [],
            dob: '1965-08-14T00:00:00Z',
          },
        },
      ];

      const normalized = crawler.normalize(raw);

      expect(normalized[0].dateOfBirth).toBe('1965-08-14T00:00:00Z');
    });

    it('omits dateOfBirth when dob absent', () => {
      const raw = [
        {
          rawId: 'Q99999',
          source: 'wikidata',
          rawData: {
            qid: 'Q99999',
            personLabel: 'John Politician',
            positions: ['Member of Parliament'],
            countryLabel: 'United Kingdom',
            countryCode: 'GB',
          },
        },
      ];

      const normalized = crawler.normalize(raw);

      expect(normalized[0].dateOfBirth).toBeUndefined();
    });

    it('sets riskLevel to "MEDIUM"', () => {
      const raw = [
        {
          rawId: 'Q12345',
          source: 'wikidata',
          rawData: {
            qid: 'Q12345',
            personLabel: 'Maria Garcia',
            positions: [],
          },
        },
      ];

      const normalized = crawler.normalize(raw);

      expect(normalized[0].riskLevel).toBe('MEDIUM');
    });

    it('sets source to "wikidata"', () => {
      const raw = [
        {
          rawId: 'Q12345',
          source: 'wikidata',
          rawData: {
            qid: 'Q12345',
            personLabel: 'Maria Garcia',
            positions: [],
          },
        },
      ];

      const normalized = crawler.normalize(raw);

      expect(normalized[0].source).toBe('wikidata');
    });

    it('sets aliases to empty array', () => {
      const raw = [
        {
          rawId: 'Q12345',
          source: 'wikidata',
          rawData: {
            qid: 'Q12345',
            personLabel: 'Maria Garcia',
            positions: [],
          },
        },
      ];

      const normalized = crawler.normalize(raw);

      expect(normalized[0].aliases).toEqual([]);
    });
  });
});
