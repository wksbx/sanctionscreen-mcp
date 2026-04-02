import { z } from 'zod';
import type { Crawler } from '@/lib/crawlers/types';
import type { RawEntity, NormalizedEntity, DataSource } from '@/lib/types';
import { normalizeName } from '@/lib/matching/normalize';
import { safeFetch, readSizedText } from '@/lib/crawlers/safe-fetch';
import { validateExternalUrl } from '@/lib/security/validate-url';

// ── Field mapping shape for JSON sources ─────────────────────────────────────

const JsonFieldMappingSchema = z.object({
  entityPath: z.string(),
  idField: z.string(),
  nameField: z.string(),
  typeField: z.string().optional(),
  typePersonValue: z.string().optional(),
  aliasesField: z.string().optional(),
  dobField: z.string().optional(),
  nationalityField: z.string().optional(),
  roleField: z.string().optional(),
});

export type JsonFieldMapping = z.infer<typeof JsonFieldMappingSchema>;

// ── Helper: resolve a dot-separated path on an object ────────────────────────

function getByPath(obj: unknown, path: string): unknown {
  let current = obj;
  for (const key of path.split('.')) {
    if (current == null || typeof current !== 'object') return undefined;
    current = (current as Record<string, unknown>)[key];
  }
  return current;
}

// ── JsonApiCrawler ───────────────────────────────────────────────────────────

export class JsonApiCrawler implements Crawler {
  readonly name: string;
  readonly sourceId: string;
  private config: DataSource;
  private mapping: JsonFieldMapping;

  constructor(config: DataSource) {
    this.config = config;
    this.name = config.name;
    this.sourceId = config.sourceId;
    this.mapping = JsonFieldMappingSchema.parse(JSON.parse(config.fieldMapping || '{}'));
  }

  async fetch(): Promise<RawEntity[]> {
    validateExternalUrl(this.config.url);
    const response = await safeFetch(this.config.url);
    const text = await readSizedText(response, this.config.url);
    const json = JSON.parse(text);
    const items = getByPath(json, this.mapping.entityPath);

    if (!Array.isArray(items)) {
      throw new Error(`entityPath "${this.mapping.entityPath}" did not resolve to an array`);
    }

    return items.map((item: Record<string, unknown>, i: number) => ({
      rawId: String(getByPath(item, this.mapping.idField) ?? i),
      source: this.sourceId,
      rawData: item,
    }));
  }

  normalize(raw: RawEntity[]): NormalizedEntity[] {
    const m = this.mapping;
    return raw.map((entity) => {
      const d = entity.rawData;
      const fullName = String(getByPath(d, m.nameField) ?? '');
      const normalizedName = normalizeName(fullName);

      const rawAliases = m.aliasesField ? getByPath(d, m.aliasesField) : undefined;
      const aliases = Array.isArray(rawAliases) ? rawAliases.map(String) : [];

      const rawType = m.typeField ? String(getByPath(d, m.typeField) ?? '') : '';
      const isPerson = m.typePersonValue ? rawType === m.typePersonValue : true;

      const rawNationality = m.nationalityField ? getByPath(d, m.nationalityField) : undefined;
      const nationality = Array.isArray(rawNationality)
        ? rawNationality.map(String)
        : rawNationality
          ? [String(rawNationality)]
          : [];

      const dob = m.dobField ? String(getByPath(d, m.dobField) ?? '') || undefined : undefined;
      const pepRole = m.roleField ? String(getByPath(d, m.roleField) ?? '') || undefined : undefined;

      return {
        type: isPerson ? 'person' : 'company',
        fullName,
        aliases,
        normalizedName,
        nationality,
        riskLevel: this.config.riskLevel ?? 'HIGH',
        sourceId: entity.rawId,
        source: this.sourceId,
        relationships: [],
        ...(dob && { dateOfBirth: dob }),
        ...(pepRole && { pepRole }),
      } as NormalizedEntity;
    });
  }
}
