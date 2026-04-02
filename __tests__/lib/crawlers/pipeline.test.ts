import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Crawler } from '@/lib/crawlers/types';
import type { RawEntity, NormalizedEntity } from '@/lib/types';

// ─── Mock @/lib/neo4j/client ──────────────────────────────────────────────────
// We mock getDriver() so the pipeline never touches a real Neo4j instance.

let mockSessionRun: ReturnType<typeof vi.fn>;
let mockSessionClose: ReturnType<typeof vi.fn>;
let mockSession: { run: ReturnType<typeof vi.fn>; close: ReturnType<typeof vi.fn> };

vi.mock('@/lib/neo4j/client', () => ({
  getDriver: () => ({
    session: () => mockSession,
  }),
  closeDriver: vi.fn(),
}));

// ─── Mock Crawler factory ─────────────────────────────────────────────────────

function makeMockCrawler(overrides: Partial<Crawler> = {}): Crawler {
  const rawEntities: RawEntity[] = [
    {
      rawId: 'raw-1',
      source: 'test-source',
      rawData: { foo: 'bar' },
    },
  ];

  const normalizedEntities: NormalizedEntity[] = [
    {
      type: 'person',
      fullName: 'Alice Test',
      aliases: [],
      normalizedName: 'alice test',
      dateOfBirth: '1980-01-01',
      nationality: ['US'],
      riskLevel: 'HIGH',
      sourceId: 'raw-1',
      source: 'test-source',
      relationships: [],
    },
  ];

  return {
    name: 'Test Crawler',
    sourceId: 'test-source',
    fetch: vi.fn().mockResolvedValue(rawEntities),
    normalize: vi.fn().mockReturnValue(normalizedEntities),
    ...overrides,
  };
}

// ─── Import pipeline ──────────────────────────────────────────────────────────

import { runCrawlerPipeline } from '@/lib/crawlers/pipeline';

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('runCrawlerPipeline', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mockSessionRun = vi.fn().mockResolvedValue({ records: [] });
    mockSessionClose = vi.fn().mockResolvedValue(undefined);
    mockSession = { run: mockSessionRun, close: mockSessionClose };
  });

  // ─── Successful pipeline ────────────────────────────────────────────────────

  it('calls fetch() on the crawler', async () => {
    const crawler = makeMockCrawler();

    await runCrawlerPipeline(crawler);

    expect(crawler.fetch).toHaveBeenCalledOnce();
  });

  it('calls normalize() with the raw entities returned by fetch()', async () => {
    const crawler = makeMockCrawler();

    await runCrawlerPipeline(crawler);

    expect(crawler.normalize).toHaveBeenCalledOnce();
    const callArg = (crawler.normalize as ReturnType<typeof vi.fn>).mock.calls[0][0] as RawEntity[];
    expect(callArg).toHaveLength(1);
    expect(callArg[0].rawId).toBe('raw-1');
  });

  it('returns a CrawlerResult with the correct source', async () => {
    const crawler = makeMockCrawler();

    const result = await runCrawlerPipeline(crawler);

    expect(result.source).toBe('test-source');
  });

  it('returns a CrawlerResult with recordCount matching normalized entity count', async () => {
    const crawler = makeMockCrawler();

    const result = await runCrawlerPipeline(crawler);

    expect(result.recordCount).toBe(1);
  });

  it('returns empty errors array on success', async () => {
    const crawler = makeMockCrawler();

    const result = await runCrawlerPipeline(crawler);

    expect(result.errors).toEqual([]);
  });

  it('returns the normalized entities in the result', async () => {
    const crawler = makeMockCrawler();

    const result = await runCrawlerPipeline(crawler);

    expect(result.entities).toHaveLength(1);
    expect(result.entities[0].fullName).toBe('Alice Test');
  });

  it('runs session.run() at least once (upserts + CrawlRun)', async () => {
    const crawler = makeMockCrawler();

    await runCrawlerPipeline(crawler);

    expect(mockSessionRun).toHaveBeenCalled();
  });

  it('closes the Neo4j session after a successful run', async () => {
    const crawler = makeMockCrawler();

    await runCrawlerPipeline(crawler);

    expect(mockSessionClose).toHaveBeenCalled();
  });

  // ─── Failed pipeline ────────────────────────────────────────────────────────

  it('does NOT throw when fetch() rejects', async () => {
    const crawler = makeMockCrawler({
      fetch: vi.fn().mockRejectedValue(new Error('Network failure')),
    });

    await expect(runCrawlerPipeline(crawler)).resolves.toBeDefined();
  });

  it('returns a non-empty errors array when fetch() rejects', async () => {
    const crawler = makeMockCrawler({
      fetch: vi.fn().mockRejectedValue(new Error('Network failure')),
    });

    const result = await runCrawlerPipeline(crawler);

    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errors[0]).toMatch(/Network failure/);
  });

  it('returns recordCount of 0 when fetch() fails', async () => {
    const crawler = makeMockCrawler({
      fetch: vi.fn().mockRejectedValue(new Error('Network failure')),
    });

    const result = await runCrawlerPipeline(crawler);

    expect(result.recordCount).toBe(0);
  });

  it('returns empty entities array when fetch() fails', async () => {
    const crawler = makeMockCrawler({
      fetch: vi.fn().mockRejectedValue(new Error('Network failure')),
    });

    const result = await runCrawlerPipeline(crawler);

    expect(result.entities).toEqual([]);
  });

  it('still records a failed CrawlRun in Neo4j when fetch() rejects', async () => {
    const crawler = makeMockCrawler({
      fetch: vi.fn().mockRejectedValue(new Error('Network failure')),
    });

    await runCrawlerPipeline(crawler);

    // session.run must be called at least once for the failed CrawlRun record
    expect(mockSessionRun).toHaveBeenCalled();
  });

  it('closes the Neo4j session even when fetch() rejects', async () => {
    const crawler = makeMockCrawler({
      fetch: vi.fn().mockRejectedValue(new Error('Network failure')),
    });

    await runCrawlerPipeline(crawler);

    expect(mockSessionClose).toHaveBeenCalled();
  });
});
