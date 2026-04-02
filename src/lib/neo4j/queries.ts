import type { Person, Company, CrawlRun, DataSource, DataSourceUpdate } from '@/lib/types';

// ── Return type ───────────────────────────────────────────────────────────────

export interface QueryResult {
  cypher: string;
  params: Record<string, unknown>;
}

// ── buildUpsertPersonQuery ────────────────────────────────────────────────────

export function buildUpsertPersonQuery(person: Person): QueryResult {
  const cypher = `
MERGE (p:Person {id: $id})
SET
  p.fullName        = $fullName,
  p.aliases         = $aliases,
  p.normalizedName  = $normalizedName,
  p.dateOfBirth     = $dateOfBirth,
  p.nationality     = $nationality,
  p.pepRole         = $pepRole,
  p.pepCountry      = $pepCountry,
  p.sanctionsList   = $sanctionsList,
  p.riskLevel       = $riskLevel,
  p.sourceIds       = $sourceIds,
  p.lastUpdated     = datetime($lastUpdated)
`.trim();

  return {
    cypher,
    params: {
      id: person.id,
      fullName: person.fullName,
      aliases: person.aliases,
      normalizedName: person.normalizedName,
      dateOfBirth: person.dateOfBirth,
      nationality: person.nationality,
      pepRole: person.pepRole,
      pepCountry: person.pepCountry,
      sanctionsList: person.sanctionsList,
      riskLevel: person.riskLevel,
      sourceIds: person.sourceIds,
      lastUpdated: person.lastUpdated,
    },
  };
}

// ── buildUpsertCompanyQuery ───────────────────────────────────────────────────

export function buildUpsertCompanyQuery(company: Company): QueryResult {
  const cypher = `
MERGE (c:Company {id: $id})
SET
  c.name               = $name,
  c.normalizedName     = $normalizedName,
  c.jurisdiction       = $jurisdiction,
  c.registrationNumber = $registrationNumber,
  c.sanctionsList      = $sanctionsList,
  c.sourceIds          = $sourceIds,
  c.lastUpdated        = datetime($lastUpdated)
`.trim();

  return {
    cypher,
    params: {
      id: company.id,
      name: company.name,
      normalizedName: company.normalizedName,
      jurisdiction: company.jurisdiction,
      registrationNumber: company.registrationNumber,
      sanctionsList: company.sanctionsList,
      sourceIds: company.sourceIds,
      lastUpdated: company.lastUpdated,
    },
  };
}

// ── buildFuzzySearchQuery ─────────────────────────────────────────────────────

export function buildFuzzySearchQuery(
  searchTerm: string,
  entityType: 'person' | 'company',
  limit: number,
): QueryResult {
  const indexName = entityType === 'person' ? 'personNames' : 'companyNames';
  const fuzzyTerm = searchTerm
    .split(' ')
    .filter(Boolean)
    .map((word) => `${word}~`)
    .join(' ');

  const cypher = `
CALL db.index.fulltext.queryNodes('${indexName}', $searchTerm)
YIELD node, score
RETURN node, score
ORDER BY score DESC
LIMIT ${Math.trunc(limit)}
`.trim();

  return {
    cypher,
    params: {
      searchTerm: fuzzyTerm,
    },
  };
}

// ── buildEntityDetailQuery ────────────────────────────────────────────────────

export function buildEntityDetailQuery(entityId: string): QueryResult {
  const cypher = `
MATCH (entity {id: $entityId})
OPTIONAL MATCH (entity)-[outRel]->(outNode)
  WHERE NOT type(outRel) IN ['LISTED_ON', 'NATIONAL_OF']
OPTIONAL MATCH (inNode)-[inRel]->(entity)
OPTIONAL MATCH (entity)-[:LISTED_ON]->(sanction)
OPTIONAL MATCH (entity)-[:NATIONAL_OF]->(country)
RETURN
  entity,
  collect(DISTINCT {rel: outRel, node: outNode})   AS outgoing,
  collect(DISTINCT {rel: inRel,  node: inNode})    AS incoming,
  collect(DISTINCT sanction)                        AS sanctions,
  collect(DISTINCT country)                         AS countries
`.trim();

  return {
    cypher,
    params: { entityId },
  };
}

// ── buildEntityNetworkQuery ───────────────────────────────────────────────────

const MAX_NETWORK_DEPTH = 4;

export function buildEntityNetworkQuery(entityId: string, depth: number): QueryResult {
  const cappedDepth = Math.min(depth, MAX_NETWORK_DEPTH);

  const cypher = `
MATCH (root {id: $entityId})-[rel*1..${cappedDepth}]-(connected)
WHERE root <> connected
RETURN DISTINCT
  connected.id    AS id,
  connected.name  AS name,
  labels(connected) AS labels,
  [r IN rel | {type: type(r), props: properties(r)}] AS relationships
`.trim();

  return {
    cypher,
    params: { entityId },
  };
}

// ── buildDataStatusQuery ──────────────────────────────────────────────────────

export function buildDataStatusQuery(): QueryResult {
  const cypher = `
MATCH (r:CrawlRun)
WITH r.source AS source, max(r.date) AS latestDate
MATCH (latest:CrawlRun {source: source, date: latestDate})
RETURN source, latest
ORDER BY source
`.trim();

  return {
    cypher,
    params: {},
  };
}

// ── buildCrawlRunQuery ────────────────────────────────────────────────────────

export function buildCrawlRunQuery(run: CrawlRun): QueryResult {
  const cypher = `
MERGE (r:CrawlRun {id: $id})
SET
  r.source      = $source,
  r.date        = $date,
  r.status      = $status,
  r.recordCount = $recordCount,
  r.startedAt   = $startedAt,
  r.completedAt = $completedAt,
  r.error       = $error
`.trim();

  return {
    cypher,
    params: {
      id: run.id,
      source: run.source,
      date: run.date,
      status: run.status,
      recordCount: run.recordCount,
      startedAt: run.startedAt,
      completedAt: run.completedAt,
      error: run.error,
    },
  };
}

// ── DataSource queries ──────────────────────────────────────────────────────

export function buildUpsertDataSourceQuery(source: DataSource): QueryResult {
  const cypher = `
MERGE (d:DataSource {id: $id})
SET
  d.sourceId     = $sourceId,
  d.name         = $name,
  d.type         = $type,
  d.enabled      = $enabled,
  d.url          = $url,
  d.riskLevel    = $riskLevel,
  d.fieldMapping = $fieldMapping,
  d.builtinKey   = $builtinKey,
  d.createdAt    = $createdAt,
  d.updatedAt    = $updatedAt
`.trim();

  return {
    cypher,
    params: {
      id: source.id,
      sourceId: source.sourceId,
      name: source.name,
      type: source.type,
      enabled: source.enabled,
      url: source.url,
      riskLevel: source.riskLevel,
      fieldMapping: source.fieldMapping ?? '',
      builtinKey: source.builtinKey ?? '',
      createdAt: source.createdAt,
      updatedAt: source.updatedAt,
    },
  };
}

export function buildGetAllDataSourcesQuery(): QueryResult {
  return {
    cypher: 'MATCH (d:DataSource) RETURN d ORDER BY d.name',
    params: {},
  };
}

export function buildGetEnabledDataSourcesQuery(): QueryResult {
  return {
    cypher: 'MATCH (d:DataSource {enabled: true}) RETURN d ORDER BY d.name',
    params: {},
  };
}

export function buildGetDataSourceByIdQuery(id: string): QueryResult {
  return {
    cypher: 'MATCH (d:DataSource {id: $id}) RETURN d',
    params: { id },
  };
}

export function buildGetDataSourceBySourceIdQuery(sourceId: string): QueryResult {
  return {
    cypher: 'MATCH (d:DataSource {sourceId: $sourceId}) RETURN d',
    params: { sourceId },
  };
}

export function buildUpdateDataSourceQuery(id: string, updates: DataSourceUpdate): QueryResult {
  const setClauses: string[] = ['d.updatedAt = $updatedAt'];
  const params: Record<string, unknown> = { id, updatedAt: new Date().toISOString() };

  if (updates.name !== undefined) { setClauses.push('d.name = $name'); params.name = updates.name; }
  if (updates.enabled !== undefined) { setClauses.push('d.enabled = $enabled'); params.enabled = updates.enabled; }
  if (updates.url !== undefined) { setClauses.push('d.url = $url'); params.url = updates.url; }
  if (updates.riskLevel !== undefined) { setClauses.push('d.riskLevel = $riskLevel'); params.riskLevel = updates.riskLevel; }
  if (updates.fieldMapping !== undefined) { setClauses.push('d.fieldMapping = $fieldMapping'); params.fieldMapping = updates.fieldMapping; }

  const cypher = `MATCH (d:DataSource {id: $id}) SET ${setClauses.join(', ')} RETURN d`;

  return { cypher, params };
}

export function buildDeleteDataSourceQuery(id: string): QueryResult {
  return {
    cypher: 'MATCH (d:DataSource {id: $id}) DETACH DELETE d',
    params: { id },
  };
}
