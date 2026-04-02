import { getDriver } from '@/lib/neo4j/client';
import { buildFuzzySearchQuery } from '@/lib/neo4j/queries';
import { normalizeName } from './normalize';

// ── RawCandidate ──────────────────────────────────────────────────────────────

export interface RawCandidate {
  entityId: string;
  fullName: string;
  normalizedName: string;
  entityType: 'person' | 'company';
  luceneScore: number;
  properties: Record<string, unknown>;
}

// ── retrieveCandidates ────────────────────────────────────────────────────────

/**
 * Fetches up to `limit` fuzzy-matched candidates from the Neo4j full-text index
 * for the given search term and entity type.
 *
 * This is a thin DB wrapper — unit tests should mock this module directly.
 */
export async function retrieveCandidates(
  searchTerm: string,
  entityType: 'person' | 'company',
  limit: number = 20,
): Promise<RawCandidate[]> {
  const normalized = normalizeName(searchTerm);
  const { cypher, params } = buildFuzzySearchQuery(normalized, entityType, limit);
  const driver = getDriver();
  const session = driver.session();

  try {
    const result = await session.run(cypher, params);
    return result.records.map((record) => {
      const node = record.get('node');
      const score = record.get('score');
      return {
        entityId: node.properties.id,
        fullName: node.properties.fullName || node.properties.name,
        normalizedName: node.properties.normalizedName,
        entityType,
        luceneScore: score,
        properties: node.properties,
      };
    });
  } finally {
    await session.close();
  }
}
