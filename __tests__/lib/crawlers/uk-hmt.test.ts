import { describe, it, expect, vi, beforeEach } from 'vitest';
import { UkHmtCrawler } from '@/lib/crawlers/uk-hmt';

// ─── Sample UK HMT CSV ────────────────────────────────────────────────────────
// Columns: Group ID, Group Type, Name1, Name2, Name3, Name4, Name5, Name6, DOB, Nationality, Country, Regime

const SAMPLE_CSV = `Group ID,Group Type,Name1,Name2,Name3,Name4,Name5,Name6,DOB,Nationality,Country,Regime
1001,Individual,DOE,JOHN,WILLIAM,,,,22/03/1970,British,GB,RUSSIA
1002,Entity,ACME GLOBAL CORPORATION,,,,,,,,,IRAN
1003,Individual,SMITH,JANE,,,,,15/07/1985,American,US,UKRAINE`;

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('UkHmtCrawler', () => {
  let crawler: UkHmtCrawler;

  beforeEach(() => {
    crawler = new UkHmtCrawler();
    vi.restoreAllMocks();
  });

  // ─── Identity ───────────────────────────────────────────────────────────────

  it('has correct name', () => {
    expect(crawler.name).toBe('UK HMT Sanctions');
  });

  it('has correct sourceId', () => {
    expect(crawler.sourceId).toBe('uk-hmt');
  });

  // ─── fetch() ────────────────────────────────────────────────────────────────

  describe('fetch()', () => {
    it('parses CSV and returns 3 raw entities', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: true,
        text: async () => SAMPLE_CSV,
      }));

      const results = await crawler.fetch();

      expect(results).toHaveLength(3);
    });

    it('sets source to "uk-hmt" for all entities', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: true,
        text: async () => SAMPLE_CSV,
      }));

      const results = await crawler.fetch();

      expect(results[0].source).toBe('uk-hmt');
      expect(results[1].source).toBe('uk-hmt');
      expect(results[2].source).toBe('uk-hmt');
    });

    it('sets rawId from Group ID', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: true,
        text: async () => SAMPLE_CSV,
      }));

      const results = await crawler.fetch();

      expect(results[0].rawId).toBe('1001');
      expect(results[1].rawId).toBe('1002');
      expect(results[2].rawId).toBe('1003');
    });

    it('sets groupType to "Individual" for first row', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: true,
        text: async () => SAMPLE_CSV,
      }));

      const results = await crawler.fetch();

      expect(results[0].rawData['groupType']).toBe('Individual');
    });

    it('sets groupType to "Entity" for second row', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: true,
        text: async () => SAMPLE_CSV,
      }));

      const results = await crawler.fetch();

      expect(results[1].rawData['groupType']).toBe('Entity');
    });

    it('builds fullName as "Name2 Name3 Name1" for Individual', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: true,
        text: async () => SAMPLE_CSV,
      }));

      const results = await crawler.fetch();

      // JOHN WILLIAM DOE (Name2=JOHN, Name3=WILLIAM, Name1=DOE)
      expect(results[0].rawData['fullName']).toBe('JOHN WILLIAM DOE');
    });

    it('builds fullName as Name1 for Entity', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: true,
        text: async () => SAMPLE_CSV,
      }));

      const results = await crawler.fetch();

      expect(results[1].rawData['fullName']).toBe('ACME GLOBAL CORPORATION');
    });

    it('parses DD/MM/YYYY date to YYYY-MM-DD for Individual', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: true,
        text: async () => SAMPLE_CSV,
      }));

      const results = await crawler.fetch();

      expect(results[0].rawData['dob']).toBe('1970-03-22');
    });

    it('leaves dob empty when not present', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: true,
        text: async () => SAMPLE_CSV,
      }));

      const results = await crawler.fetch();

      expect(results[1].rawData['dob']).toBe('');
    });

    it('extracts nationality and country', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: true,
        text: async () => SAMPLE_CSV,
      }));

      const results = await crawler.fetch();

      expect(results[0].rawData['nationality']).toBe('British');
      expect(results[0].rawData['country']).toBe('GB');
    });

    it('extracts regime', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: true,
        text: async () => SAMPLE_CSV,
      }));

      const results = await crawler.fetch();

      expect(results[0].rawData['regime']).toBe('RUSSIA');
      expect(results[1].rawData['regime']).toBe('IRAN');
    });

    it('throws on HTTP failure', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: false,
        status: 503,
      }));

      await expect(crawler.fetch()).rejects.toThrow('503');
    });
  });

  // ─── normalize() ────────────────────────────────────────────────────────────

  describe('normalize()', () => {
    it('maps Individual groupType to type "person"', () => {
      const raw = [
        {
          rawId: '1001',
          source: 'uk-hmt',
          rawData: {
            groupType: 'Individual',
            fullName: 'JOHN WILLIAM DOE',
            dob: '1970-03-22',
            nationality: 'British',
            country: 'GB',
            regime: 'RUSSIA',
          },
        },
      ];

      const normalized = crawler.normalize(raw);

      expect(normalized[0].type).toBe('person');
    });

    it('maps Entity groupType to type "company"', () => {
      const raw = [
        {
          rawId: '1002',
          source: 'uk-hmt',
          rawData: {
            groupType: 'Entity',
            fullName: 'ACME GLOBAL CORPORATION',
            dob: '',
            nationality: '',
            country: '',
            regime: 'IRAN',
          },
        },
      ];

      const normalized = crawler.normalize(raw);

      expect(normalized[0].type).toBe('company');
    });

    it('uses fullName from rawData', () => {
      const raw = [
        {
          rawId: '1001',
          source: 'uk-hmt',
          rawData: {
            groupType: 'Individual',
            fullName: 'JOHN WILLIAM DOE',
            dob: '',
            nationality: '',
            country: '',
            regime: '',
          },
        },
      ];

      const normalized = crawler.normalize(raw);

      expect(normalized[0].fullName).toBe('JOHN WILLIAM DOE');
    });

    it('produces normalizedName via normalizeName()', () => {
      const raw = [
        {
          rawId: '1001',
          source: 'uk-hmt',
          rawData: {
            groupType: 'Individual',
            fullName: 'JOHN WILLIAM DOE',
            dob: '',
            nationality: '',
            country: '',
            regime: '',
          },
        },
      ];

      const normalized = crawler.normalize(raw);

      expect(normalized[0].normalizedName).toBe('john william doe');
    });

    it('sets source to "uk-hmt"', () => {
      const raw = [
        {
          rawId: '1001',
          source: 'uk-hmt',
          rawData: {
            groupType: 'Individual',
            fullName: 'JOHN WILLIAM DOE',
            dob: '',
            nationality: '',
            country: '',
            regime: '',
          },
        },
      ];

      const normalized = crawler.normalize(raw);

      expect(normalized[0].source).toBe('uk-hmt');
    });

    it('sets dateOfBirth when dob is present', () => {
      const raw = [
        {
          rawId: '1001',
          source: 'uk-hmt',
          rawData: {
            groupType: 'Individual',
            fullName: 'JOHN DOE',
            dob: '1970-03-22',
            nationality: '',
            country: '',
            regime: '',
          },
        },
      ];

      const normalized = crawler.normalize(raw);

      expect(normalized[0].dateOfBirth).toBe('1970-03-22');
    });

    it('omits dateOfBirth when dob is absent', () => {
      const raw = [
        {
          rawId: '1002',
          source: 'uk-hmt',
          rawData: {
            groupType: 'Entity',
            fullName: 'ACME GLOBAL CORPORATION',
            dob: '',
            nationality: '',
            country: '',
            regime: '',
          },
        },
      ];

      const normalized = crawler.normalize(raw);

      expect(normalized[0].dateOfBirth).toBeUndefined();
    });

    it('maps nationality to nationality array', () => {
      const raw = [
        {
          rawId: '1001',
          source: 'uk-hmt',
          rawData: {
            groupType: 'Individual',
            fullName: 'JOHN DOE',
            dob: '',
            nationality: 'British',
            country: 'GB',
            regime: '',
          },
        },
      ];

      const normalized = crawler.normalize(raw);

      expect(normalized[0].nationality).toEqual(['British']);
    });

    it('sets empty nationality array when no nationality', () => {
      const raw = [
        {
          rawId: '1002',
          source: 'uk-hmt',
          rawData: {
            groupType: 'Entity',
            fullName: 'ACME GLOBAL CORPORATION',
            dob: '',
            nationality: '',
            country: '',
            regime: '',
          },
        },
      ];

      const normalized = crawler.normalize(raw);

      expect(normalized[0].nationality).toEqual([]);
    });
  });
});
