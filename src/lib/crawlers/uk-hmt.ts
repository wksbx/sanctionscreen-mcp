import type { Crawler } from '@/lib/crawlers/types';
import type { RawEntity, NormalizedEntity } from '@/lib/types';
import { normalizeName } from '@/lib/matching/normalize';

// ─── Constants ────────────────────────────────────────────────────────────────

const UK_HMT_CSV_URL =
  'https://assets.publishing.service.gov.uk/government/uploads/system/uploads/attachment_data/file/Consolidated_List_of_Financial_Sanctions_Targets_in_the_UK.csv';

// ─── CSV helpers ──────────────────────────────────────────────────────────────

/**
 * Splits a single CSV line respecting double-quoted fields.
 */
function parseCsvLine(line: string): string[] {
  const fields: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        // escaped quote
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === ',' && !inQuotes) {
      fields.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  fields.push(current);
  return fields;
}

/**
 * Parses DD/MM/YYYY date strings to YYYY-MM-DD.
 * Returns '' for empty or unrecognised input.
 */
function parseDmyDate(raw: string): string {
  if (!raw) return '';
  const m = raw.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!m) return '';
  return `${m[3]}-${m[2]}-${m[1]}`;
}

// ─── Raw data shape ───────────────────────────────────────────────────────────

interface UkHmtRawData {
  groupType: string;
  fullName: string;
  dob: string;
  nationality: string;
  country: string;
  regime: string;
}

// ─── Column indices (0-based) ─────────────────────────────────────────────────
// Group ID, Group Type, Name1, Name2, Name3, Name4, Name5, Name6, DOB, Nationality, Country, Regime
const COL_GROUP_ID = 0;
const COL_GROUP_TYPE = 1;
const COL_NAME1 = 2;
const COL_NAME2 = 3;
const COL_NAME3 = 4;
const COL_DOB = 8;
const COL_NATIONALITY = 9;
const COL_COUNTRY = 10;
const COL_REGIME = 11;

// ─── UkHmtCrawler ─────────────────────────────────────────────────────────────

export class UkHmtCrawler implements Crawler {
  readonly name = 'UK HMT Sanctions';
  readonly sourceId = 'uk-hmt';

  async fetch(): Promise<RawEntity[]> {
    const response = await fetch(UK_HMT_CSV_URL);
    if (!response.ok) {
      throw new Error(`UK HMT fetch failed: HTTP ${response.status}`);
    }

    const csv = await response.text();
    const lines = csv.split('\n').map((l) => l.trim()).filter(Boolean);

    // Skip header row
    const dataLines = lines.slice(1);

    return dataLines.map((line) => {
      const cols = parseCsvLine(line);

      const groupId = (cols[COL_GROUP_ID] ?? '').trim();
      const groupType = (cols[COL_GROUP_TYPE] ?? '').trim();
      const name1 = (cols[COL_NAME1] ?? '').trim();
      const name2 = (cols[COL_NAME2] ?? '').trim();
      const name3 = (cols[COL_NAME3] ?? '').trim();
      const rawDob = (cols[COL_DOB] ?? '').trim();
      const nationality = (cols[COL_NATIONALITY] ?? '').trim();
      const country = (cols[COL_COUNTRY] ?? '').trim();
      const regime = (cols[COL_REGIME] ?? '').trim();

      // Build fullName:
      // Individual: "Name2 Name3 Name1" (first [middle] last)
      // Entity: Name1
      let fullName: string;
      if (groupType === 'Individual') {
        fullName = [name2, name3, name1].filter(Boolean).join(' ');
      } else {
        fullName = name1;
      }

      const dob = parseDmyDate(rawDob);

      const rawData: UkHmtRawData = {
        groupType,
        fullName,
        dob,
        nationality,
        country,
        regime,
      };

      return {
        rawId: groupId,
        source: this.sourceId,
        rawData: rawData as unknown as Record<string, unknown>,
      };
    });
  }

  normalize(raw: RawEntity[]): NormalizedEntity[] {
    return raw.map((entity) => {
      const d = entity.rawData as unknown as UkHmtRawData;

      const isIndividual = d.groupType === 'Individual';
      const fullName = d.fullName;
      const normalizedName = normalizeName(fullName);
      const nationality = d.nationality ? [d.nationality] : [];

      const normalized: NormalizedEntity = {
        type: isIndividual ? 'person' : 'company',
        fullName,
        aliases: [],
        normalizedName,
        nationality,
        riskLevel: 'HIGH',
        sourceId: entity.rawId,
        source: this.sourceId,
        relationships: [],
      };

      if (d.dob) {
        normalized.dateOfBirth = d.dob;
      }

      return normalized;
    });
  }
}
