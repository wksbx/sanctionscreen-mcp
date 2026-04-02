import type { Crawler } from '@/lib/crawlers/types';
import type { RawEntity, NormalizedEntity, DataSource } from '@/lib/types';
import { normalizeName } from '@/lib/matching/normalize';
import { safeFetch, readSizedText } from '@/lib/crawlers/safe-fetch';
import { validateExternalUrl } from '@/lib/security/validate-url';

// ── Field mapping shape for NDJSON sources ───────────────────────────────────

export interface NdjsonFieldMapping {
  idField: string;
  nameField: string;
  typeField?: string;
  typePersonValue?: string;
  aliasesField?: string;
  dobField?: string;
  nationalityField?: string;
  roleField?: string;
  filterField?: string;
  filterValues?: string[];
}

// ── Helper: resolve a dot-separated path on an object ────────────────────────

function getByPath(obj: unknown, path: string): unknown {
  let current = obj;
  for (const key of path.split('.')) {
    if (current == null || typeof current !== 'object') return undefined;
    current = (current as Record<string, unknown>)[key];
  }
  return current;
}

function asStringArray(val: unknown): string[] {
  if (Array.isArray(val)) return val.map(String);
  if (typeof val === 'string' && val) return [val];
  return [];
}

// ── NdjsonCrawler ────────────────────────────────────────────────────────────

export class NdjsonCrawler implements Crawler {
  readonly name: string;
  readonly sourceId: string;
  private config: DataSource;
  private mapping: NdjsonFieldMapping;

  constructor(config: DataSource) {
    this.config = config;
    this.name = config.name;
    this.sourceId = config.sourceId;
    this.mapping = JSON.parse(config.fieldMapping || '{}') as NdjsonFieldMapping;
  }

  async fetch(): Promise<RawEntity[]> {
    validateExternalUrl(this.config.url);
    const response = await safeFetch(this.config.url);
    const text = await readSizedText(response, this.config.url);
    const lines = text.split('\n').filter((l) => l.trim());
    const entities: RawEntity[] = [];
    const m = this.mapping;

    for (const line of lines) {
      let parsed: Record<string, unknown>;
      try {
        parsed = JSON.parse(line);
      } catch {
        continue;
      }

      // Optional filter (e.g. only include schema=Person)
      if (m.filterField && m.filterValues?.length) {
        const val = String(getByPath(parsed, m.filterField) ?? '');
        if (!m.filterValues.includes(val)) continue;
      }

      const rawId = String(getByPath(parsed, m.idField) ?? '');
      if (!rawId) continue;

      entities.push({ rawId, source: this.sourceId, rawData: parsed });
    }

    return entities;
  }

  normalize(raw: RawEntity[]): NormalizedEntity[] {
    const m = this.mapping;
    return raw.map((entity) => {
      const d = entity.rawData;

      const nameVal = getByPath(d, m.nameField);
      const fullName = Array.isArray(nameVal) ? nameVal[0] ?? '' : String(nameVal ?? '');
      const normalizedName = normalizeName(fullName);

      const aliasesRaw = m.aliasesField ? getByPath(d, m.aliasesField) : undefined;
      const aliases = asStringArray(aliasesRaw).filter((a) => a !== fullName);

      let isPerson = true;
      if (m.typeField && m.typePersonValue) {
        const typeVal = String(getByPath(d, m.typeField) ?? '');
        isPerson = typeVal === m.typePersonValue;
      }

      const nationalityRaw = m.nationalityField ? getByPath(d, m.nationalityField) : undefined;
      const nationality = asStringArray(nationalityRaw);

      const dobRaw = m.dobField ? getByPath(d, m.dobField) : undefined;
      const dob = Array.isArray(dobRaw) ? dobRaw[0] : dobRaw;
      const dobStr = dob ? String(dob) : undefined;

      const roleRaw = m.roleField ? getByPath(d, m.roleField) : undefined;
      const pepRole = Array.isArray(roleRaw) ? roleRaw[0] : roleRaw;
      const pepRoleStr = pepRole ? String(pepRole) : undefined;

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
        ...(dobStr && { dateOfBirth: dobStr }),
        ...(pepRoleStr && { pepRole: pepRoleStr }),
      } as NormalizedEntity;
    });
  }
}
