import type { Crawler } from '@/lib/crawlers/types';
import type { DataSource } from '@/lib/types';
import { JsonApiCrawler } from './json-adapter';
import { CsvCrawler } from './csv-adapter';
import { XmlFeedCrawler } from './xml-adapter';
import { NdjsonCrawler } from './ndjson-adapter';

import { OfacCrawler } from '@/lib/crawlers/ofac';
import { UnSanctionsCrawler } from '@/lib/crawlers/un-sanctions';
import { EuSanctionsCrawler } from '@/lib/crawlers/eu-sanctions';
import { UkHmtCrawler } from '@/lib/crawlers/uk-hmt';
import { OpenSanctionsCrawler } from '@/lib/crawlers/opensanctions';
import { EveryPoliticianCrawler } from '@/lib/crawlers/everypolitician';
import { WikidataCrawler } from '@/lib/crawlers/wikidata';

// ── Built-in crawler class map ───────────────────────────────────────────────

const BUILTIN_MAP: Record<string, new () => Crawler> = {
  ofac: OfacCrawler,
  un: UnSanctionsCrawler,
  eu: EuSanctionsCrawler,
  'uk-hmt': UkHmtCrawler,
  opensanctions: OpenSanctionsCrawler,
  everypolitician: EveryPoliticianCrawler,
  wikidata: WikidataCrawler,
};

// ── Factory ──────────────────────────────────────────────────────────────────

export function createCrawlerFromConfig(config: DataSource): Crawler {
  switch (config.type) {
    case 'builtin': {
      const key = config.builtinKey ?? config.sourceId;
      const CrawlerClass = BUILTIN_MAP[key];
      if (!CrawlerClass) {
        throw new Error(`Unknown built-in crawler key: ${key}`);
      }
      return new CrawlerClass();
    }
    case 'json':
      return new JsonApiCrawler(config);
    case 'csv':
      return new CsvCrawler(config);
    case 'xml':
      return new XmlFeedCrawler(config);
    case 'ndjson':
      return new NdjsonCrawler(config);
    default:
      throw new Error(`Unknown data source type: ${config.type}`);
  }
}
