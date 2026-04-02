import { describe, it, expect, vi, beforeEach } from 'vitest';
import { OfacCrawler } from '@/lib/crawlers/ofac';

// ─── Sample OFAC XML ─────────────────────────────────────────────────────────

const SAMPLE_XML = `<?xml version="1.0" encoding="UTF-8"?>
<sdnList>
  <sdnEntry>
    <uid>12345</uid>
    <firstName>JOHN</firstName>
    <lastName>DOE</lastName>
    <sdnType>Individual</sdnType>
    <programList>
      <program>SDN</program>
      <program>IRAN</program>
    </programList>
    <akaList>
      <aka>
        <uid>99001</uid>
        <type>a.k.a.</type>
        <firstName>JOHNNY</firstName>
        <lastName>DOE</lastName>
      </aka>
      <aka>
        <uid>99002</uid>
        <type>a.k.a.</type>
        <firstName>J.</firstName>
        <lastName>DOE</lastName>
      </aka>
    </akaList>
    <dateOfBirthList>
      <dateOfBirthItem>
        <uid>77001</uid>
        <dateOfBirth>01 Jan 1970</dateOfBirth>
        <mainEntry>true</mainEntry>
      </dateOfBirthItem>
    </dateOfBirthList>
    <nationalityList>
      <nationality>
        <uid>88001</uid>
        <country>Iran</country>
        <mainEntry>true</mainEntry>
      </nationality>
    </nationalityList>
  </sdnEntry>
  <sdnEntry>
    <uid>67890</uid>
    <lastName>ACME CORPORATION</lastName>
    <sdnType>Entity</sdnType>
    <programList>
      <program>SDN</program>
    </programList>
    <akaList>
      <aka>
        <uid>99003</uid>
        <type>a.k.a.</type>
        <lastName>ACME CORP</lastName>
      </aka>
    </akaList>
  </sdnEntry>
</sdnList>`;

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('OfacCrawler', () => {
  let crawler: OfacCrawler;

  beforeEach(() => {
    crawler = new OfacCrawler();
    vi.restoreAllMocks();
  });

  // ─── Identity ───────────────────────────────────────────────────────────────

  it('has correct name', () => {
    expect(crawler.name).toBe('OFAC SDN');
  });

  it('has correct sourceId', () => {
    expect(crawler.sourceId).toBe('ofac');
  });

  // ─── fetch() ────────────────────────────────────────────────────────────────

  describe('fetch()', () => {
    it('parses XML and returns 2 raw entities with correct source', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: true,
        text: async () => SAMPLE_XML,
      }));

      const results = await crawler.fetch();

      expect(results).toHaveLength(2);
      expect(results[0].source).toBe('ofac');
      expect(results[1].source).toBe('ofac');
    });

    it('sets rawId from uid for each entry', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: true,
        text: async () => SAMPLE_XML,
      }));

      const results = await crawler.fetch();

      expect(results[0].rawId).toBe('12345');
      expect(results[1].rawId).toBe('67890');
    });

    it('extracts correct rawData fields for Individual entry', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: true,
        text: async () => SAMPLE_XML,
      }));

      const results = await crawler.fetch();
      const individual = results[0];

      expect(individual.rawData['sdnType']).toBe('Individual');
      expect(individual.rawData['firstName']).toBe('JOHN');
      expect(individual.rawData['lastName']).toBe('DOE');
      expect(individual.rawData['programs']).toEqual(['SDN', 'IRAN']);
      expect(individual.rawData['dateOfBirth']).toBe('01 Jan 1970');
      expect(individual.rawData['nationalities']).toEqual(['Iran']);
      expect(individual.rawData['aliases']).toEqual([
        { firstName: 'JOHNNY', lastName: 'DOE' },
        { firstName: 'J.', lastName: 'DOE' },
      ]);
    });

    it('extracts correct rawData fields for Entity entry', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: true,
        text: async () => SAMPLE_XML,
      }));

      const results = await crawler.fetch();
      const entity = results[1];

      expect(entity.rawData['sdnType']).toBe('Entity');
      expect(entity.rawData['lastName']).toBe('ACME CORPORATION');
      expect(entity.rawData['programs']).toEqual(['SDN']);
      expect(entity.rawData['aliases']).toEqual([{ firstName: '', lastName: 'ACME CORP' }]);
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
    it('maps Individual sdnType to type "person"', () => {
      const raw = [
        {
          rawId: '12345',
          source: 'ofac',
          rawData: {
            sdnType: 'Individual',
            firstName: 'JOHN',
            lastName: 'DOE',
            programs: ['SDN'],
            dateOfBirth: '01 Jan 1970',
            nationalities: ['Iran'],
            aliases: [{ firstName: 'JOHNNY', lastName: 'DOE' }],
          },
        },
      ];

      const normalized = crawler.normalize(raw);

      expect(normalized).toHaveLength(1);
      expect(normalized[0].type).toBe('person');
    });

    it('maps Entity sdnType to type "company"', () => {
      const raw = [
        {
          rawId: '67890',
          source: 'ofac',
          rawData: {
            sdnType: 'Entity',
            firstName: '',
            lastName: 'ACME CORPORATION',
            programs: ['SDN'],
            dateOfBirth: '',
            nationalities: [],
            aliases: [{ firstName: '', lastName: 'ACME CORP' }],
          },
        },
      ];

      const normalized = crawler.normalize(raw);

      expect(normalized).toHaveLength(1);
      expect(normalized[0].type).toBe('company');
    });

    it('builds fullName as "firstName lastName" for Individual', () => {
      const raw = [
        {
          rawId: '12345',
          source: 'ofac',
          rawData: {
            sdnType: 'Individual',
            firstName: 'JOHN',
            lastName: 'DOE',
            programs: [],
            dateOfBirth: '',
            nationalities: [],
            aliases: [],
          },
        },
      ];

      const normalized = crawler.normalize(raw);

      expect(normalized[0].fullName).toBe('JOHN DOE');
    });

    it('builds fullName as just lastName for Entity', () => {
      const raw = [
        {
          rawId: '67890',
          source: 'ofac',
          rawData: {
            sdnType: 'Entity',
            firstName: '',
            lastName: 'ACME CORPORATION',
            programs: [],
            dateOfBirth: '',
            nationalities: [],
            aliases: [],
          },
        },
      ];

      const normalized = crawler.normalize(raw);

      expect(normalized[0].fullName).toBe('ACME CORPORATION');
    });

    it('produces a normalizedName via normalizeName()', () => {
      const raw = [
        {
          rawId: '12345',
          source: 'ofac',
          rawData: {
            sdnType: 'Individual',
            firstName: 'JOHN',
            lastName: 'DOE',
            programs: [],
            dateOfBirth: '',
            nationalities: [],
            aliases: [],
          },
        },
      ];

      const normalized = crawler.normalize(raw);

      expect(normalized[0].normalizedName).toBe('john doe');
    });

    it('sets source to "ofac"', () => {
      const raw = [
        {
          rawId: '12345',
          source: 'ofac',
          rawData: {
            sdnType: 'Individual',
            firstName: 'JOHN',
            lastName: 'DOE',
            programs: [],
            dateOfBirth: '',
            nationalities: [],
            aliases: [],
          },
        },
      ];

      const normalized = crawler.normalize(raw);

      expect(normalized[0].source).toBe('ofac');
    });

    it('sets riskLevel to "HIGH"', () => {
      const raw = [
        {
          rawId: '12345',
          source: 'ofac',
          rawData: {
            sdnType: 'Individual',
            firstName: 'JOHN',
            lastName: 'DOE',
            programs: [],
            dateOfBirth: '',
            nationalities: [],
            aliases: [],
          },
        },
      ];

      const normalized = crawler.normalize(raw);

      expect(normalized[0].riskLevel).toBe('HIGH');
    });

    it('maps aliases correctly', () => {
      const raw = [
        {
          rawId: '12345',
          source: 'ofac',
          rawData: {
            sdnType: 'Individual',
            firstName: 'JOHN',
            lastName: 'DOE',
            programs: [],
            dateOfBirth: '',
            nationalities: [],
            aliases: [
              { firstName: 'JOHNNY', lastName: 'DOE' },
              { firstName: 'J.', lastName: 'DOE' },
            ],
          },
        },
      ];

      const normalized = crawler.normalize(raw);

      expect(normalized[0].aliases).toContain('JOHNNY DOE');
      expect(normalized[0].aliases).toContain('J. DOE');
    });

    it('parses dateOfBirth string into normalized date', () => {
      const raw = [
        {
          rawId: '12345',
          source: 'ofac',
          rawData: {
            sdnType: 'Individual',
            firstName: 'JOHN',
            lastName: 'DOE',
            programs: [],
            dateOfBirth: '01 Jan 1970',
            nationalities: [],
            aliases: [],
          },
        },
      ];

      const normalized = crawler.normalize(raw);

      expect(normalized[0].dateOfBirth).toBe('1970-01-01');
    });

    it('omits dateOfBirth when missing', () => {
      const raw = [
        {
          rawId: '67890',
          source: 'ofac',
          rawData: {
            sdnType: 'Entity',
            firstName: '',
            lastName: 'ACME CORPORATION',
            programs: [],
            dateOfBirth: '',
            nationalities: [],
            aliases: [],
          },
        },
      ];

      const normalized = crawler.normalize(raw);

      expect(normalized[0].dateOfBirth).toBeUndefined();
    });

    it('maps nationalities to nationality array', () => {
      const raw = [
        {
          rawId: '12345',
          source: 'ofac',
          rawData: {
            sdnType: 'Individual',
            firstName: 'JOHN',
            lastName: 'DOE',
            programs: [],
            dateOfBirth: '',
            nationalities: ['Iran', 'Syria'],
            aliases: [],
          },
        },
      ];

      const normalized = crawler.normalize(raw);

      expect(normalized[0].nationality).toEqual(['Iran', 'Syria']);
    });
  });
});
