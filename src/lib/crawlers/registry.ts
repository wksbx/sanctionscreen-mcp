import type { Crawler } from './types';
import { getEnabledSources, getSourceBySourceId } from '@/lib/sources/repository';
import { createCrawlerFromConfig } from '@/lib/crawlers/adapters';

export async function getActiveCrawlers(): Promise<Crawler[]> {
  const sources = await getEnabledSources();
  return sources.map(createCrawlerFromConfig);
}

export async function getCrawlerBySourceId(sourceId: string): Promise<Crawler | undefined> {
  const source = await getSourceBySourceId(sourceId);
  if (!source || !source.enabled) return undefined;
  return createCrawlerFromConfig(source);
}

export async function getAllSourceIds(): Promise<string[]> {
  const sources = await getEnabledSources();
  return sources.map((s) => s.sourceId);
}
