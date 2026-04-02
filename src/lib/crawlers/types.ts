import type { RawEntity, NormalizedEntity } from '@/lib/types';

export interface Crawler {
  name: string;
  sourceId: string;
  fetch(): Promise<RawEntity[]>;
  normalize(raw: RawEntity[]): NormalizedEntity[];
}

export interface CrawlerResult {
  source: string;
  entities: NormalizedEntity[];
  recordCount: number;
  errors: string[];
}
