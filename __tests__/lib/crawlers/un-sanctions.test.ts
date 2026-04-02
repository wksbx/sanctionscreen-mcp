import { describe, it, expect, vi, beforeEach } from 'vitest';
import { UnSanctionsCrawler } from '@/lib/crawlers/un-sanctions';

// ─── Sample UN XML ────────────────────────────────────────────────────────────

const SAMPLE_XML = `<?xml version="1.0" encoding="UTF-8"?>
<CONSOLIDATED_LIST>
  <INDIVIDUALS>
    <INDIVIDUAL>
      <DATAID>123456</DATAID>
      <FIRST_NAME>JOHN</FIRST_NAME>
      <SECOND_NAME>WILLIAM</SECOND_NAME>
      <LISTED_ON>2010-01-15</LISTED_ON>
      <NATIONALITY>
        <VALUE>Afghan</VALUE>
      </NATIONALITY>
      <LIST_TYPE>
        <VALUE>Al-Qaida Sanctions List</VALUE>
      </LIST_TYPE>
      <INDIVIDUAL_DATE_OF_BIRTH>
        <DATE>1970-03-22</DATE>
      </INDIVIDUAL_DATE_OF_BIRTH>
      <INDIVIDUAL_ALIAS>
        <ALIAS_NAME>JOHNNY WILL</ALIAS_NAME>
      </INDIVIDUAL_ALIAS>
      <INDIVIDUAL_ALIAS>
        <ALIAS_NAME>J.W. DOE</ALIAS_NAME>
      </INDIVIDUAL_ALIAS>
    </INDIVIDUAL>
  </INDIVIDUALS>
  <ENTITIES>
    <ENTITY>
      <DATAID>789012</DATAID>
      <FIRST_NAME>ACME GLOBAL CORPORATION</FIRST_NAME>
      <LISTED_ON>2015-06-01</LISTED_ON>
      <LIST_TYPE>
        <VALUE>Al-Qaida Sanctions List</VALUE>
      </LIST_TYPE>
      <ENTITY_ALIAS>
        <ALIAS_NAME>ACME CORP</ALIAS_NAME>
      </ENTITY_ALIAS>
    </ENTITY>
  </ENTITIES>
</CONSOLIDATED_LIST>`;

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('UnSanctionsCrawler', () => {
  let crawler: UnSanctionsCrawler;

  beforeEach(() => {
    crawler = new UnSanctionsCrawler();
    vi.restoreAllMocks();
  });

  // ─── Identity ───────────────────────────────────────────────────────────────

  it('has correct name', () => {
    expect(crawler.name).toBe('UN Consolidated Sanctions');
  });

  it('has correct sourceId', () => {
    expect(crawler.sourceId).toBe('un');
  });

  // ─── fetch() ────────────────────────────────────────────────────────────────

  describe('fetch()', () => {
    it('parses XML and returns 2 raw entities', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: true,
        text: async () => SAMPLE_XML,
      }));

      const results = await crawler.fetch();

      expect(results).toHaveLength(2);
    });

    it('sets source to "un" for all entities', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: true,
        text: async () => SAMPLE_XML,
      }));

      const results = await crawler.fetch();

      expect(results[0].source).toBe('un');
      expect(results[1].source).toBe('un');
    });

    it('sets rawId from DATAID', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: true,
        text: async () => SAMPLE_XML,
      }));

      const results = await crawler.fetch();

      expect(results[0].rawId).toBe('123456');
      expect(results[1].rawId).toBe('789012');
    });

    it('marks INDIVIDUAL entries as entityType "individual"', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: true,
        text: async () => SAMPLE_XML,
      }));

      const results = await crawler.fetch();
      expect(results[0].rawData['entityType']).toBe('individual');
    });

    it('marks ENTITY entries as entityType "entity"', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: true,
        text: async () => SAMPLE_XML,
      }));

      const results = await crawler.fetch();
      expect(results[1].rawData['entityType']).toBe('entity');
    });

    it('extracts firstName, secondName for individual', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: true,
        text: async () => SAMPLE_XML,
      }));

      const results = await crawler.fetch();
      const individual = results[0];

      expect(individual.rawData['firstName']).toBe('JOHN');
      expect(individual.rawData['secondName']).toBe('WILLIAM');
    });

    it('extracts nationality, listType, dateOfBirth for individual', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: true,
        text: async () => SAMPLE_XML,
      }));

      const results = await crawler.fetch();
      const individual = results[0];

      expect(individual.rawData['nationality']).toBe('Afghan');
      expect(individual.rawData['listType']).toBe('Al-Qaida Sanctions List');
      expect(individual.rawData['dateOfBirth']).toBe('1970-03-22');
    });

    it('extracts aliases for individual', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: true,
        text: async () => SAMPLE_XML,
      }));

      const results = await crawler.fetch();
      const individual = results[0];

      expect(individual.rawData['aliases']).toEqual(['JOHNNY WILL', 'J.W. DOE']);
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
    it('maps individual entityType to type "person"', () => {
      const raw = [
        {
          rawId: '123456',
          source: 'un',
          rawData: {
            entityType: 'individual',
            firstName: 'JOHN',
            secondName: 'WILLIAM',
            listedOn: '2010-01-15',
            nationality: 'Afghan',
            listType: 'Al-Qaida Sanctions List',
            dateOfBirth: '1970-03-22',
            aliases: ['JOHNNY WILL'],
          },
        },
      ];

      const normalized = crawler.normalize(raw);

      expect(normalized[0].type).toBe('person');
    });

    it('maps entity entityType to type "company"', () => {
      const raw = [
        {
          rawId: '789012',
          source: 'un',
          rawData: {
            entityType: 'entity',
            firstName: 'ACME GLOBAL CORPORATION',
            secondName: '',
            listedOn: '2015-06-01',
            nationality: '',
            listType: 'Al-Qaida Sanctions List',
            dateOfBirth: '',
            aliases: ['ACME CORP'],
          },
        },
      ];

      const normalized = crawler.normalize(raw);

      expect(normalized[0].type).toBe('company');
    });

    it('builds fullName as "firstName secondName" for person', () => {
      const raw = [
        {
          rawId: '123456',
          source: 'un',
          rawData: {
            entityType: 'individual',
            firstName: 'JOHN',
            secondName: 'WILLIAM',
            listedOn: '',
            nationality: '',
            listType: '',
            dateOfBirth: '',
            aliases: [],
          },
        },
      ];

      const normalized = crawler.normalize(raw);

      expect(normalized[0].fullName).toBe('JOHN WILLIAM');
    });

    it('builds fullName from firstName only for company', () => {
      const raw = [
        {
          rawId: '789012',
          source: 'un',
          rawData: {
            entityType: 'entity',
            firstName: 'ACME GLOBAL CORPORATION',
            secondName: '',
            listedOn: '',
            nationality: '',
            listType: '',
            dateOfBirth: '',
            aliases: [],
          },
        },
      ];

      const normalized = crawler.normalize(raw);

      expect(normalized[0].fullName).toBe('ACME GLOBAL CORPORATION');
    });

    it('produces a normalizedName via normalizeName()', () => {
      const raw = [
        {
          rawId: '123456',
          source: 'un',
          rawData: {
            entityType: 'individual',
            firstName: 'JOHN',
            secondName: 'WILLIAM',
            listedOn: '',
            nationality: '',
            listType: '',
            dateOfBirth: '',
            aliases: [],
          },
        },
      ];

      const normalized = crawler.normalize(raw);

      expect(normalized[0].normalizedName).toBe('john william');
    });

    it('sets source to "un"', () => {
      const raw = [
        {
          rawId: '123456',
          source: 'un',
          rawData: {
            entityType: 'individual',
            firstName: 'JOHN',
            secondName: '',
            listedOn: '',
            nationality: '',
            listType: '',
            dateOfBirth: '',
            aliases: [],
          },
        },
      ];

      const normalized = crawler.normalize(raw);

      expect(normalized[0].source).toBe('un');
    });

    it('preserves aliases', () => {
      const raw = [
        {
          rawId: '123456',
          source: 'un',
          rawData: {
            entityType: 'individual',
            firstName: 'JOHN',
            secondName: '',
            listedOn: '',
            nationality: '',
            listType: '',
            dateOfBirth: '',
            aliases: ['JOHNNY WILL', 'J.W. DOE'],
          },
        },
      ];

      const normalized = crawler.normalize(raw);

      expect(normalized[0].aliases).toContain('JOHNNY WILL');
      expect(normalized[0].aliases).toContain('J.W. DOE');
    });

    it('sets dateOfBirth when present', () => {
      const raw = [
        {
          rawId: '123456',
          source: 'un',
          rawData: {
            entityType: 'individual',
            firstName: 'JOHN',
            secondName: '',
            listedOn: '',
            nationality: '',
            listType: '',
            dateOfBirth: '1970-03-22',
            aliases: [],
          },
        },
      ];

      const normalized = crawler.normalize(raw);

      expect(normalized[0].dateOfBirth).toBe('1970-03-22');
    });

    it('omits dateOfBirth when absent', () => {
      const raw = [
        {
          rawId: '789012',
          source: 'un',
          rawData: {
            entityType: 'entity',
            firstName: 'ACME CORP',
            secondName: '',
            listedOn: '',
            nationality: '',
            listType: '',
            dateOfBirth: '',
            aliases: [],
          },
        },
      ];

      const normalized = crawler.normalize(raw);

      expect(normalized[0].dateOfBirth).toBeUndefined();
    });
  });
});
