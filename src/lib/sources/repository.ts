import crypto from 'crypto';
import { getDriver } from '@/lib/neo4j/client';
import {
  buildUpsertDataSourceQuery,
  buildGetAllDataSourcesQuery,
  buildGetEnabledDataSourcesQuery,
  buildGetDataSourceByIdQuery,
  buildGetDataSourceBySourceIdQuery,
  buildUpdateDataSourceQuery,
  buildDeleteDataSourceQuery,
} from '@/lib/neo4j/queries';
import type { DataSource, DataSourceCreate, DataSourceUpdate } from '@/lib/types';

// ── Helpers ──────────────────────────────────────────────────────────────────

function nodeToDataSource(node: Record<string, unknown>): DataSource {
  return {
    id: node.id as string,
    sourceId: node.sourceId as string,
    name: node.name as string,
    type: node.type as DataSource['type'],
    enabled: node.enabled as boolean,
    url: node.url as string,
    riskLevel: (node.riskLevel as DataSource['riskLevel']) ?? 'HIGH',
    fieldMapping: (node.fieldMapping as string) || undefined,
    builtinKey: (node.builtinKey as string) || undefined,
    createdAt: node.createdAt as string,
    updatedAt: node.updatedAt as string,
  };
}

// ── CRUD ─────────────────────────────────────────────────────────────────────

export async function getAllSources(): Promise<DataSource[]> {
  const driver = getDriver();
  const session = driver.session();
  try {
    const { cypher, params } = buildGetAllDataSourcesQuery();
    const result = await session.run(cypher, params);
    return result.records.map((r) => nodeToDataSource(r.get('d').properties));
  } finally {
    await session.close();
  }
}

export async function getEnabledSources(): Promise<DataSource[]> {
  const driver = getDriver();
  const session = driver.session();
  try {
    const { cypher, params } = buildGetEnabledDataSourcesQuery();
    const result = await session.run(cypher, params);
    return result.records.map((r) => nodeToDataSource(r.get('d').properties));
  } finally {
    await session.close();
  }
}

export async function getSourceById(id: string): Promise<DataSource | null> {
  const driver = getDriver();
  const session = driver.session();
  try {
    const { cypher, params } = buildGetDataSourceByIdQuery(id);
    const result = await session.run(cypher, params);
    if (result.records.length === 0) return null;
    return nodeToDataSource(result.records[0].get('d').properties);
  } finally {
    await session.close();
  }
}

export async function getSourceBySourceId(sourceId: string): Promise<DataSource | null> {
  const driver = getDriver();
  const session = driver.session();
  try {
    const { cypher, params } = buildGetDataSourceBySourceIdQuery(sourceId);
    const result = await session.run(cypher, params);
    if (result.records.length === 0) return null;
    return nodeToDataSource(result.records[0].get('d').properties);
  } finally {
    await session.close();
  }
}

export async function createSource(input: DataSourceCreate): Promise<DataSource> {
  const now = new Date().toISOString();
  const source: DataSource = {
    id: crypto.randomUUID(),
    sourceId: input.sourceId,
    name: input.name,
    type: input.type,
    enabled: input.enabled ?? false,
    url: input.url,
    riskLevel: input.riskLevel ?? 'HIGH',
    fieldMapping: input.fieldMapping,
    builtinKey: input.builtinKey,
    createdAt: now,
    updatedAt: now,
  };

  const driver = getDriver();
  const session = driver.session();
  try {
    const { cypher, params } = buildUpsertDataSourceQuery(source);
    await session.run(cypher, params);
    return source;
  } finally {
    await session.close();
  }
}

export async function updateSource(id: string, updates: DataSourceUpdate): Promise<DataSource | null> {
  const driver = getDriver();
  const session = driver.session();
  try {
    const { cypher, params } = buildUpdateDataSourceQuery(id, updates);
    const result = await session.run(cypher, params);
    if (result.records.length === 0) return null;
    return nodeToDataSource(result.records[0].get('d').properties);
  } finally {
    await session.close();
  }
}

export async function deleteSource(id: string): Promise<void> {
  const driver = getDriver();
  const session = driver.session();
  try {
    const { cypher, params } = buildDeleteDataSourceQuery(id);
    await session.run(cypher, params);
  } finally {
    await session.close();
  }
}
