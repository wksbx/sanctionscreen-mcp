import type { Crawler } from '@/lib/crawlers/types';
import type { RawEntity, NormalizedEntity, DataSource } from '@/lib/types';
import { normalizeName } from '@/lib/matching/normalize';
import { safeFetch, readSizedText } from '@/lib/crawlers/safe-fetch';
import { validateExternalUrl } from '@/lib/security/validate-url';

// ── Field mapping shape for CSV sources ──────────────────────────────────────

export interface CsvFieldMapping {
  hasHeader: boolean;
  delimiter: string;
  idColumn: number;
  nameColumns: number[];
  typeColumn?: number;
  typePersonValue?: string;
  aliasColumns?: number[];
  dobColumn?: number;
  dobFormat?: string;
  nationalityColumn?: number;
}

// ── CSV line parser ──────────────────────────────────────────────────────────

function parseCsvLine(line: string, delimiter: string = ','): string[] {
  const fields: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === delimiter && !inQuotes) {
      fields.push(current.trim());
      current = '';
    } else {
      current += ch;
    }
  }
  fields.push(current.trim());
  return fields;
}

// ── Date format conversion ───────────────────────────────────────────────────

function convertDate(raw: string, format?: string): string {
  if (!raw || !format) return raw;
  if (format === 'DD/MM/YYYY') {
    const m = raw.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    return m ? `${m[3]}-${m[2]}-${m[1]}` : raw;
  }
  if (format === 'MM/DD/YYYY') {
    const m = raw.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    return m ? `${m[3]}-${m[1]}-${m[2]}` : raw;
  }
  return raw;
}

// ── CsvCrawler ───────────────────────────────────────────────────────────────

export class CsvCrawler implements Crawler {
  readonly name: string;
  readonly sourceId: string;
  private config: DataSource;
  private mapping: CsvFieldMapping;

  constructor(config: DataSource) {
    this.config = config;
    this.name = config.name;
    this.sourceId = config.sourceId;
    this.mapping = JSON.parse(config.fieldMapping || '{}') as CsvFieldMapping;
  }

  async fetch(): Promise<RawEntity[]> {
    validateExternalUrl(this.config.url);
    const response = await safeFetch(this.config.url);
    const text = await readSizedText(response, this.config.url);
    const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);

    const dataLines = this.mapping.hasHeader ? lines.slice(1) : lines;

    return dataLines.map((line, i) => {
      const cols = parseCsvLine(line, this.mapping.delimiter);
      const rawId = cols[this.mapping.idColumn] ?? String(i);

      const rawData: Record<string, unknown> = {};
      cols.forEach((val, idx) => { rawData[`col_${idx}`] = val; });
      rawData._cols = cols;

      return { rawId, source: this.sourceId, rawData };
    });
  }

  normalize(raw: RawEntity[]): NormalizedEntity[] {
    const m = this.mapping;
    return raw.map((entity) => {
      const cols = entity.rawData._cols as string[];

      const fullName = m.nameColumns
        .map((idx) => cols[idx] ?? '')
        .filter(Boolean)
        .join(' ');
      const normalizedName = normalizeName(fullName);

      const aliases = m.aliasColumns
        ? m.aliasColumns.map((idx) => cols[idx] ?? '').filter(Boolean)
        : [];

      const rawType = m.typeColumn !== undefined ? cols[m.typeColumn] ?? '' : '';
      const isPerson = m.typePersonValue ? rawType === m.typePersonValue : true;

      const nationality = m.nationalityColumn !== undefined && cols[m.nationalityColumn]
        ? [cols[m.nationalityColumn]]
        : [];

      const rawDob = m.dobColumn !== undefined ? cols[m.dobColumn] ?? '' : '';
      const dob = rawDob ? convertDate(rawDob, m.dobFormat) : undefined;

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
      } as NormalizedEntity;
    });
  }
}
