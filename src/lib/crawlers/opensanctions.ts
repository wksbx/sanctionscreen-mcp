import type { Crawler } from '@/lib/crawlers/types';
import type { RawEntity, NormalizedEntity } from '@/lib/types';
import { normalizeName } from '@/lib/matching/normalize';

// ─── Constants ────────────────────────────────────────────────────────────────

const OPENSANCTIONS_URL =
  'https://data.opensanctions.org/datasets/latest/default/entities.ftm.json';

const ALLOWED_SCHEMAS = new Set(['Person', 'Company', 'Organization', 'LegalEntity']);

// ─── Raw data shape ───────────────────────────────────────────────────────────

interface OpenSanctionsProperties {
  name?: string[];
  alias?: string[];
  birthDate?: string[];
  nationality?: string[];
  position?: string[];
  topics?: string[];
  [key: string]: unknown;
}

interface OpenSanctionsRawData {
  schema: string;
  properties: OpenSanctionsProperties;
}

// ─── OpenSanctionsCrawler ─────────────────────────────────────────────────────

export class OpenSanctionsCrawler implements Crawler {
  readonly name = 'OpenSanctions';
  readonly sourceId = 'opensanctions';

  async fetch(): Promise<RawEntity[]> {
    const response = await fetch(OPENSANCTIONS_URL);
    if (!response.ok) {
      throw new Error(`OpenSanctions fetch failed: HTTP ${response.status}`);
    }

    const text = await response.text();
    const lines = text.split('\n').filter((line) => line.trim().length > 0);

    const entities: RawEntity[] = [];

    for (const line of lines) {
      let parsed: { id: string; schema: string; properties: OpenSanctionsProperties };
      try {
        parsed = JSON.parse(line);
      } catch {
        continue;
      }

      if (!ALLOWED_SCHEMAS.has(parsed.schema)) continue;

      entities.push({
        rawId: parsed.id,
        source: this.sourceId,
        rawData: {
          schema: parsed.schema,
          properties: parsed.properties,
        } as unknown as Record<string, unknown>,
      });
    }

    return entities;
  }

  normalize(raw: RawEntity[]): NormalizedEntity[] {
    return raw.map((entity) => {
      const d = entity.rawData as unknown as OpenSanctionsRawData;
      const props = d.properties ?? {};

      const isPerson = d.schema === 'Person';
      const fullName = props.name?.[0] ?? '';
      const normalizedName = normalizeName(fullName);
      const aliases = props.alias ?? [];
      const dob = props.birthDate?.[0];
      const nationality = props.nationality ?? [];
      const pepRole = props.position?.[0];
      const topics: string[] = (props.topics as string[] | undefined) ?? [];
      const riskLevel: 'HIGH' | 'MEDIUM' = topics.includes('sanction') ? 'HIGH' : 'MEDIUM';

      const normalized: NormalizedEntity = {
        type: isPerson ? 'person' : 'company',
        fullName,
        aliases,
        normalizedName,
        nationality,
        riskLevel,
        sourceId: entity.rawId,
        source: this.sourceId,
        relationships: [],
      };

      if (dob !== undefined) {
        normalized.dateOfBirth = dob;
      }

      if (pepRole !== undefined) {
        normalized.pepRole = pepRole;
      }

      return normalized;
    });
  }
}
