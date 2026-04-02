import crypto from 'crypto';
import { getDriver } from '@/lib/neo4j/client';
import {
  buildUpsertPersonQuery,
  buildUpsertCompanyQuery,
  buildCrawlRunQuery,
} from '@/lib/neo4j/queries';
import { generateEntityId } from '@/lib/crawlers/normalizer';
import type { Crawler, CrawlerResult } from '@/lib/crawlers/types';
import type { NormalizedEntity, CrawlRun, Person, Company } from '@/lib/types';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function nowIso(): string {
  return new Date().toISOString();
}

function makeCrawlRunId(source: string, startedAt: string): string {
  return crypto
    .createHash('sha256')
    .update(`${source}|${startedAt}`)
    .digest('hex')
    .slice(0, 16);
}

// ─── Entity → DB model converters ────────────────────────────────────────────

function toPersonModel(entity: NormalizedEntity, source: string): Person {
  return {
    id: generateEntityId(entity.normalizedName, entity.dateOfBirth, source),
    fullName: entity.fullName,
    aliases: entity.aliases,
    normalizedName: entity.normalizedName,
    dateOfBirth: entity.dateOfBirth ?? '',
    nationality: entity.nationality ?? [],
    pepRole: entity.pepRole ?? '',
    pepCountry: entity.pepCountry ?? '',
    sanctionsList: [],
    riskLevel: entity.riskLevel,
    sourceIds: [entity.sourceId],
    lastUpdated: nowIso(),
  };
}

function toCompanyModel(entity: NormalizedEntity, source: string): Company {
  return {
    id: generateEntityId(entity.normalizedName, undefined, source),
    name: entity.fullName,
    normalizedName: entity.normalizedName,
    jurisdiction: entity.jurisdiction ?? '',
    registrationNumber: entity.registrationNumber ?? '',
    sanctionsList: [],
    sourceIds: [entity.sourceId],
    lastUpdated: nowIso(),
  };
}

// ─── runCrawlerPipeline ───────────────────────────────────────────────────────

/**
 * Orchestrates a single crawler:
 *   1. Record startedAt
 *   2. fetch → normalize → upsert each entity to Neo4j
 *   3. Record a successful CrawlRun node
 *   4. On any error: record a failed CrawlRun node and return errors in result
 */
export async function runCrawlerPipeline(crawler: Crawler): Promise<CrawlerResult> {
  const startedAt = nowIso();
  const driver = getDriver();
  const session = driver.session();

  let entities: NormalizedEntity[] = [];
  const errors: string[] = [];

  try {
    // ── Step 1: fetch & normalize ────────────────────────────────────────────
    const raw = await crawler.fetch();
    entities = crawler.normalize(raw);

    // ── Step 2: upsert each entity ───────────────────────────────────────────
    for (const entity of entities) {
      if (entity.type === 'person') {
        const person = toPersonModel(entity, crawler.sourceId);
        const { cypher, params } = buildUpsertPersonQuery(person);
        await session.run(cypher, params);
      } else {
        const company = toCompanyModel(entity, crawler.sourceId);
        const { cypher, params } = buildUpsertCompanyQuery(company);
        await session.run(cypher, params);
      }
    }

    // ── Step 3: record successful CrawlRun ───────────────────────────────────
    const crawlRun: CrawlRun = {
      id: makeCrawlRunId(crawler.sourceId, startedAt),
      source: crawler.sourceId,
      date: todayIso(),
      status: 'success',
      recordCount: entities.length,
      startedAt,
      completedAt: nowIso(),
    };
    const { cypher, params } = buildCrawlRunQuery(crawlRun);
    await session.run(cypher, params);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    errors.push(message);

    // ── Step 4: record failed CrawlRun ───────────────────────────────────────
    try {
      const crawlRun: CrawlRun = {
        id: makeCrawlRunId(crawler.sourceId, startedAt),
        source: crawler.sourceId,
        date: todayIso(),
        status: 'failed',
        recordCount: 0,
        startedAt,
        completedAt: nowIso(),
        error: message,
      };
      const { cypher, params } = buildCrawlRunQuery(crawlRun);
      await session.run(cypher, params);
    } catch {
      // best-effort — ignore secondary failure
    }
  } finally {
    await session.close();
  }

  return {
    source: crawler.sourceId,
    entities,
    recordCount: entities.length,
    errors,
  };
}
