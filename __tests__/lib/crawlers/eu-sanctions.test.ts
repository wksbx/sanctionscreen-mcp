import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EuSanctionsCrawler } from '@/lib/crawlers/eu-sanctions';

// ─── Sample EU XML ────────────────────────────────────────────────────────────

const SAMPLE_XML = `<?xml version="1.0" encoding="UTF-8"?>
<export>
  <sanctionEntity logicalId="EU-111" designationDate="2012-03-01">
    <nameAlias wholeName="IVAN PETROV" strong="true"/>
    <nameAlias wholeName="I. PETROV"/>
    <subjectType classificationCode="P"/>
    <citizenship countryIso2Code="RU"/>
    <birthdate birthdate="1965-07-14"/>
    <regulation programme="UKRAINE"/>
  </sanctionEntity>
  <sanctionEntity logicalId="EU-222" designationDate="2018-09-15">
    <nameAlias wholeName="GLOBAL OIL COMPANY LTD" strong="true"/>
    <subjectType classificationCode="E"/>
    <regulation programme="IRAN"/>
  </sanctionEntity>
</export>`;

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('EuSanctionsCrawler', () => {
  let crawler: EuSanctionsCrawler;

  beforeEach(() => {
    crawler = new EuSanctionsCrawler();
    vi.restoreAllMocks();
  });

  // ─── Identity ───────────────────────────────────────────────────────────────

  it('has correct name', () => {
    expect(crawler.name).toBe('EU Financial Sanctions');
  });

  it('has correct sourceId', () => {
    expect(crawler.sourceId).toBe('eu');
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

    it('sets source to "eu" for all entities', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: true,
        text: async () => SAMPLE_XML,
      }));

      const results = await crawler.fetch();

      expect(results[0].source).toBe('eu');
      expect(results[1].source).toBe('eu');
    });

    it('sets rawId from logicalId attribute', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: true,
        text: async () => SAMPLE_XML,
      }));

      const results = await crawler.fetch();

      expect(results[0].rawId).toBe('EU-111');
      expect(results[1].rawId).toBe('EU-222');
    });

    it('extracts person classificationCode "P"', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: true,
        text: async () => SAMPLE_XML,
      }));

      const results = await crawler.fetch();
      expect(results[0].rawData['classificationCode']).toBe('P');
    });

    it('extracts entity classificationCode "E"', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: true,
        text: async () => SAMPLE_XML,
      }));

      const results = await crawler.fetch();
      expect(results[1].rawData['classificationCode']).toBe('E');
    });

    it('extracts wholeName from first nameAlias', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: true,
        text: async () => SAMPLE_XML,
      }));

      const results = await crawler.fetch();
      expect(results[0].rawData['wholeName']).toBe('IVAN PETROV');
    });

    it('extracts all alias names', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: true,
        text: async () => SAMPLE_XML,
      }));

      const results = await crawler.fetch();
      expect(results[0].rawData['aliases']).toContain('I. PETROV');
    });

    it('extracts citizenship countryIso2Code', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: true,
        text: async () => SAMPLE_XML,
      }));

      const results = await crawler.fetch();
      expect(results[0].rawData['citizenship']).toBe('RU');
    });

    it('extracts birthdate', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: true,
        text: async () => SAMPLE_XML,
      }));

      const results = await crawler.fetch();
      expect(results[0].rawData['birthdate']).toBe('1965-07-14');
    });

    it('extracts programme', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: true,
        text: async () => SAMPLE_XML,
      }));

      const results = await crawler.fetch();
      expect(results[0].rawData['programme']).toBe('UKRAINE');
      expect(results[1].rawData['programme']).toBe('IRAN');
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
    it('maps classificationCode "P" to type "person"', () => {
      const raw = [
        {
          rawId: 'EU-111',
          source: 'eu',
          rawData: {
            classificationCode: 'P',
            wholeName: 'IVAN PETROV',
            aliases: ['I. PETROV'],
            citizenship: 'RU',
            birthdate: '1965-07-14',
            programme: 'UKRAINE',
          },
        },
      ];

      const normalized = crawler.normalize(raw);

      expect(normalized[0].type).toBe('person');
    });

    it('maps classificationCode "E" to type "company"', () => {
      const raw = [
        {
          rawId: 'EU-222',
          source: 'eu',
          rawData: {
            classificationCode: 'E',
            wholeName: 'GLOBAL OIL COMPANY LTD',
            aliases: [],
            citizenship: '',
            birthdate: '',
            programme: 'IRAN',
          },
        },
      ];

      const normalized = crawler.normalize(raw);

      expect(normalized[0].type).toBe('company');
    });

    it('uses wholeName as fullName', () => {
      const raw = [
        {
          rawId: 'EU-111',
          source: 'eu',
          rawData: {
            classificationCode: 'P',
            wholeName: 'IVAN PETROV',
            aliases: [],
            citizenship: '',
            birthdate: '',
            programme: '',
          },
        },
      ];

      const normalized = crawler.normalize(raw);

      expect(normalized[0].fullName).toBe('IVAN PETROV');
    });

    it('produces normalizedName via normalizeName()', () => {
      const raw = [
        {
          rawId: 'EU-111',
          source: 'eu',
          rawData: {
            classificationCode: 'P',
            wholeName: 'IVAN PETROV',
            aliases: [],
            citizenship: '',
            birthdate: '',
            programme: '',
          },
        },
      ];

      const normalized = crawler.normalize(raw);

      expect(normalized[0].normalizedName).toBe('ivan petrov');
    });

    it('sets source to "eu"', () => {
      const raw = [
        {
          rawId: 'EU-111',
          source: 'eu',
          rawData: {
            classificationCode: 'P',
            wholeName: 'IVAN PETROV',
            aliases: [],
            citizenship: '',
            birthdate: '',
            programme: '',
          },
        },
      ];

      const normalized = crawler.normalize(raw);

      expect(normalized[0].source).toBe('eu');
    });

    it('sets dateOfBirth when birthdate is present', () => {
      const raw = [
        {
          rawId: 'EU-111',
          source: 'eu',
          rawData: {
            classificationCode: 'P',
            wholeName: 'IVAN PETROV',
            aliases: [],
            citizenship: '',
            birthdate: '1965-07-14',
            programme: '',
          },
        },
      ];

      const normalized = crawler.normalize(raw);

      expect(normalized[0].dateOfBirth).toBe('1965-07-14');
    });

    it('omits dateOfBirth when absent', () => {
      const raw = [
        {
          rawId: 'EU-222',
          source: 'eu',
          rawData: {
            classificationCode: 'E',
            wholeName: 'GLOBAL OIL COMPANY LTD',
            aliases: [],
            citizenship: '',
            birthdate: '',
            programme: '',
          },
        },
      ];

      const normalized = crawler.normalize(raw);

      expect(normalized[0].dateOfBirth).toBeUndefined();
    });

    it('maps citizenship to nationality array', () => {
      const raw = [
        {
          rawId: 'EU-111',
          source: 'eu',
          rawData: {
            classificationCode: 'P',
            wholeName: 'IVAN PETROV',
            aliases: [],
            citizenship: 'RU',
            birthdate: '',
            programme: '',
          },
        },
      ];

      const normalized = crawler.normalize(raw);

      expect(normalized[0].nationality).toEqual(['RU']);
    });

    it('sets empty nationality array when no citizenship', () => {
      const raw = [
        {
          rawId: 'EU-222',
          source: 'eu',
          rawData: {
            classificationCode: 'E',
            wholeName: 'GLOBAL OIL COMPANY LTD',
            aliases: [],
            citizenship: '',
            birthdate: '',
            programme: '',
          },
        },
      ];

      const normalized = crawler.normalize(raw);

      expect(normalized[0].nationality).toEqual([]);
    });
  });
});
