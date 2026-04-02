import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EveryPoliticianCrawler } from '@/lib/crawlers/everypolitician';

// ─── Sample Popolo data ───────────────────────────────────────────────────────

const SAMPLE_POPOLO = {
  persons: [
    {
      id: 'ep-person-001',
      name: 'Alice Johnson',
      other_names: [
        { name: 'A. Johnson' },
        { name: 'Ali Johnson' },
      ],
      birth_date: '1970-06-20',
      national_identity: 'GB',
    },
    {
      id: 'ep-person-002',
      name: 'Bob Williams',
      other_names: [],
      birth_date: '1965-11-03',
      national_identity: 'US',
    },
    {
      id: 'ep-person-003',
      name: 'Carol Martinez',
      // no other_names, no birth_date, no national_identity
    },
  ],
  memberships: [
    { person_id: 'ep-person-001', role: 'Member of Parliament' },
    { person_id: 'ep-person-001', role: 'Committee Chair' }, // second entry – should be ignored
    { person_id: 'ep-person-002', role: 'Senator' },
    // ep-person-003 has no membership
  ],
};

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('EveryPoliticianCrawler', () => {
  let crawler: EveryPoliticianCrawler;

  beforeEach(() => {
    crawler = new EveryPoliticianCrawler();
    vi.restoreAllMocks();
  });

  // ─── Identity ──────────────────────────────────────────────────────────────

  it('has correct name', () => {
    expect(crawler.name).toBe('EveryPolitician');
  });

  it('has correct sourceId', () => {
    expect(crawler.sourceId).toBe('everypolitician');
  });

  // ─── fetch() ──────────────────────────────────────────────────────────────

  describe('fetch()', () => {
    it('parses Popolo JSON and returns one raw entity per person', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: true,
        json: async () => SAMPLE_POPOLO,
      }));

      const results = await crawler.fetch();

      expect(results).toHaveLength(3);
    });

    it('sets source to "everypolitician" on each entity', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: true,
        json: async () => SAMPLE_POPOLO,
      }));

      const results = await crawler.fetch();

      for (const r of results) {
        expect(r.source).toBe('everypolitician');
      }
    });

    it('sets rawId from person.id', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: true,
        json: async () => SAMPLE_POPOLO,
      }));

      const results = await crawler.fetch();
      const ids = results.map((r) => r.rawId);

      expect(ids).toContain('ep-person-001');
      expect(ids).toContain('ep-person-002');
      expect(ids).toContain('ep-person-003');
    });

    it('stores name, other_names, birth_date, national_identity and role in rawData', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: true,
        json: async () => SAMPLE_POPOLO,
      }));

      const results = await crawler.fetch();
      const alice = results.find((r) => r.rawId === 'ep-person-001')!;

      expect(alice.rawData['name']).toBe('Alice Johnson');
      expect(alice.rawData['other_names']).toEqual(['A. Johnson', 'Ali Johnson']);
      expect(alice.rawData['birth_date']).toBe('1970-06-20');
      expect(alice.rawData['national_identity']).toBe('GB');
      expect(alice.rawData['role']).toBe('Member of Parliament');
    });

    it('uses only first membership role per person', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: true,
        json: async () => SAMPLE_POPOLO,
      }));

      const results = await crawler.fetch();
      const alice = results.find((r) => r.rawId === 'ep-person-001')!;

      expect(alice.rawData['role']).toBe('Member of Parliament');
    });

    it('leaves role undefined for person with no membership', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: true,
        json: async () => SAMPLE_POPOLO,
      }));

      const results = await crawler.fetch();
      const carol = results.find((r) => r.rawId === 'ep-person-003')!;

      expect(carol.rawData['role']).toBeUndefined();
    });

    it('throws on HTTP failure', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
      }));

      await expect(crawler.fetch()).rejects.toThrow('404');
    });

    it('handles empty persons and memberships arrays', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ persons: [], memberships: [] }),
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
          rawId: 'ep-person-001',
          source: 'everypolitician',
          rawData: {
            name: 'Alice Johnson',
            other_names: ['A. Johnson'],
            birth_date: '1970-06-20',
            national_identity: 'GB',
            role: 'Member of Parliament',
          },
        },
      ];

      const normalized = crawler.normalize(raw);

      expect(normalized[0].type).toBe('person');
    });

    it('sets fullName from rawData.name', () => {
      const raw = [
        {
          rawId: 'ep-person-001',
          source: 'everypolitician',
          rawData: {
            name: 'Alice Johnson',
            other_names: [],
          },
        },
      ];

      const normalized = crawler.normalize(raw);

      expect(normalized[0].fullName).toBe('Alice Johnson');
    });

    it('produces a normalizedName via normalizeName()', () => {
      const raw = [
        {
          rawId: 'ep-person-001',
          source: 'everypolitician',
          rawData: {
            name: 'Alice Johnson',
            other_names: [],
          },
        },
      ];

      const normalized = crawler.normalize(raw);

      expect(normalized[0].normalizedName).toBe('alice johnson');
    });

    it('sets aliases from rawData.other_names', () => {
      const raw = [
        {
          rawId: 'ep-person-001',
          source: 'everypolitician',
          rawData: {
            name: 'Alice Johnson',
            other_names: ['A. Johnson', 'Ali Johnson'],
          },
        },
      ];

      const normalized = crawler.normalize(raw);

      expect(normalized[0].aliases).toEqual(['A. Johnson', 'Ali Johnson']);
    });

    it('sets dateOfBirth when present', () => {
      const raw = [
        {
          rawId: 'ep-person-001',
          source: 'everypolitician',
          rawData: {
            name: 'Alice Johnson',
            other_names: [],
            birth_date: '1970-06-20',
          },
        },
      ];

      const normalized = crawler.normalize(raw);

      expect(normalized[0].dateOfBirth).toBe('1970-06-20');
    });

    it('omits dateOfBirth when not present', () => {
      const raw = [
        {
          rawId: 'ep-person-003',
          source: 'everypolitician',
          rawData: {
            name: 'Carol Martinez',
            other_names: [],
          },
        },
      ];

      const normalized = crawler.normalize(raw);

      expect(normalized[0].dateOfBirth).toBeUndefined();
    });

    it('sets nationality from national_identity wrapped in array', () => {
      const raw = [
        {
          rawId: 'ep-person-001',
          source: 'everypolitician',
          rawData: {
            name: 'Alice Johnson',
            other_names: [],
            national_identity: 'GB',
          },
        },
      ];

      const normalized = crawler.normalize(raw);

      expect(normalized[0].nationality).toEqual(['GB']);
    });

    it('sets empty nationality array when national_identity absent', () => {
      const raw = [
        {
          rawId: 'ep-person-003',
          source: 'everypolitician',
          rawData: {
            name: 'Carol Martinez',
            other_names: [],
          },
        },
      ];

      const normalized = crawler.normalize(raw);

      expect(normalized[0].nationality).toEqual([]);
    });

    it('sets pepRole from rawData.role', () => {
      const raw = [
        {
          rawId: 'ep-person-001',
          source: 'everypolitician',
          rawData: {
            name: 'Alice Johnson',
            other_names: [],
            role: 'Member of Parliament',
          },
        },
      ];

      const normalized = crawler.normalize(raw);

      expect(normalized[0].pepRole).toBe('Member of Parliament');
    });

    it('omits pepRole when role is undefined', () => {
      const raw = [
        {
          rawId: 'ep-person-003',
          source: 'everypolitician',
          rawData: {
            name: 'Carol Martinez',
            other_names: [],
          },
        },
      ];

      const normalized = crawler.normalize(raw);

      expect(normalized[0].pepRole).toBeUndefined();
    });

    it('sets riskLevel to "MEDIUM"', () => {
      const raw = [
        {
          rawId: 'ep-person-001',
          source: 'everypolitician',
          rawData: {
            name: 'Alice Johnson',
            other_names: [],
          },
        },
      ];

      const normalized = crawler.normalize(raw);

      expect(normalized[0].riskLevel).toBe('MEDIUM');
    });

    it('sets source to "everypolitician"', () => {
      const raw = [
        {
          rawId: 'ep-person-001',
          source: 'everypolitician',
          rawData: {
            name: 'Alice Johnson',
            other_names: [],
          },
        },
      ];

      const normalized = crawler.normalize(raw);

      expect(normalized[0].source).toBe('everypolitician');
    });
  });
});
