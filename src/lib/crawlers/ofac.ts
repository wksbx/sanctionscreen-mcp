import type { Crawler } from '@/lib/crawlers/types';
import type { RawEntity, NormalizedEntity } from '@/lib/types';
import { normalizeName } from '@/lib/matching/normalize';

// ─── Constants ────────────────────────────────────────────────────────────────

const OFAC_SDN_URL =
  'https://sanctionslistservice.ofac.treas.gov/api/PublicationPreview/exports/SDN_ADVANCED.XML';

// ─── Month lookup for OFAC date strings (e.g. "01 Jan 1970") ─────────────────

const MONTH_MAP: Record<string, string> = {
  Jan: '01', Feb: '02', Mar: '03', Apr: '04',
  May: '05', Jun: '06', Jul: '07', Aug: '08',
  Sep: '09', Oct: '10', Nov: '11', Dec: '12',
};

// ─── XML regex helpers ────────────────────────────────────────────────────────

/**
 * Returns the trimmed text content of the first occurrence of <tag>...</tag>.
 * Returns '' when the tag is absent.
 */
function extractTag(xml: string, tag: string): string {
  const match = xml.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i'));
  return match ? match[1].trim() : '';
}

/**
 * Returns the trimmed text content of all occurrences of <tag>...</tag>.
 */
function extractAllTags(xml: string, tag: string): string[] {
  const re = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'gi');
  const results: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml)) !== null) {
    results.push(m[1].trim());
  }
  return results;
}

/**
 * Splits an XML string into an array of substrings, one per <tag>...</tag> block.
 */
function splitByTag(xml: string, tag: string): string[] {
  const re = new RegExp(`<${tag}[^>]*>[\\s\\S]*?<\\/${tag}>`, 'gi');
  const results: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml)) !== null) {
    results.push(m[0]);
  }
  return results;
}

// ─── Date parsing ─────────────────────────────────────────────────────────────

/**
 * Parses OFAC date strings such as "01 Jan 1970" into ISO "YYYY-MM-DD".
 * Returns undefined for unrecognised / empty strings.
 */
function parseOfacDate(raw: string): string | undefined {
  if (!raw) return undefined;
  // Pattern: DD Mon YYYY  (e.g. "01 Jan 1970")
  const m = raw.match(/^(\d{1,2})\s+([A-Za-z]{3})\s+(\d{4})$/);
  if (m) {
    const day = m[1].padStart(2, '0');
    const month = MONTH_MAP[m[2]] ?? MONTH_MAP[m[2].charAt(0).toUpperCase() + m[2].slice(1).toLowerCase()];
    const year = m[3];
    if (month) return `${year}-${month}-${day}`;
  }
  // Pattern: YYYY (year only)
  const yearOnly = raw.match(/^(\d{4})$/);
  if (yearOnly) return `${yearOnly[1]}-01-01`;
  return undefined;
}

// ─── AKA extraction ──────────────────────────────────────────────────────────

interface AkaEntry {
  firstName: string;
  lastName: string;
}

function extractAliases(entryXml: string): AkaEntry[] {
  const akaListMatch = entryXml.match(/<akaList[^>]*>([\s\S]*?)<\/akaList>/i);
  if (!akaListMatch) return [];

  return splitByTag(akaListMatch[1], 'aka').map((akaXml) => ({
    firstName: extractTag(akaXml, 'firstName'),
    lastName: extractTag(akaXml, 'lastName'),
  }));
}

// ─── Per-entry raw extraction ─────────────────────────────────────────────────

interface OfacRawData {
  sdnType: string;
  firstName: string;
  lastName: string;
  programs: string[];
  dateOfBirth: string;
  nationalities: string[];
  aliases: AkaEntry[];
}

function parseEntry(entryXml: string): OfacRawData {
  const uid = extractTag(entryXml, 'uid');
  const sdnType = extractTag(entryXml, 'sdnType');
  const firstName = extractTag(entryXml, 'firstName');
  const lastName = extractTag(entryXml, 'lastName');

  // Programs
  const programListMatch = entryXml.match(/<programList[^>]*>([\s\S]*?)<\/programList>/i);
  const programs = programListMatch
    ? extractAllTags(programListMatch[1], 'program')
    : [];

  // Date of birth — pick first dateOfBirth child of dateOfBirthList
  const dobListMatch = entryXml.match(/<dateOfBirthList[^>]*>([\s\S]*?)<\/dateOfBirthList>/i);
  let dateOfBirth = '';
  if (dobListMatch) {
    const firstItem = dobListMatch[1].match(/<dateOfBirthItem[^>]*>([\s\S]*?)<\/dateOfBirthItem>/i);
    if (firstItem) {
      dateOfBirth = extractTag(firstItem[1], 'dateOfBirth');
    }
  }

  // Nationalities
  const natListMatch = entryXml.match(/<nationalityList[^>]*>([\s\S]*?)<\/nationalityList>/i);
  const nationalities: string[] = [];
  if (natListMatch) {
    const items = splitByTag(natListMatch[1], 'nationality');
    for (const item of items) {
      const country = extractTag(item, 'country');
      if (country) nationalities.push(country);
    }
  }

  // Aliases
  const aliases = extractAliases(entryXml);

  void uid; // uid used as rawId at the call site
  return { sdnType, firstName, lastName, programs, dateOfBirth, nationalities, aliases };
}

// ─── OfacCrawler ─────────────────────────────────────────────────────────────

export class OfacCrawler implements Crawler {
  readonly name = 'OFAC SDN';
  readonly sourceId = 'ofac';

  async fetch(): Promise<RawEntity[]> {
    const response = await fetch(OFAC_SDN_URL);
    if (!response.ok) {
      throw new Error(
        `OFAC SDN fetch failed: HTTP ${response.status}`,
      );
    }

    const xml = await response.text();
    const entryBlocks = splitByTag(xml, 'sdnEntry');

    return entryBlocks.map((block) => {
      const uid = extractTag(block, 'uid');
      const rawData = parseEntry(block) as unknown as Record<string, unknown>;
      return {
        rawId: uid,
        source: this.sourceId,
        rawData,
      };
    });
  }

  normalize(raw: RawEntity[]): NormalizedEntity[] {
    return raw.map((entity) => {
      const d = entity.rawData as unknown as OfacRawData;

      const isIndividual = d.sdnType === 'Individual';

      // Full name
      const fullName = isIndividual && d.firstName
        ? `${d.firstName} ${d.lastName}`.trim()
        : d.lastName.trim();

      // Normalized name
      const normalizedName = normalizeName(fullName);

      // Aliases — build display strings, filter empty
      const aliases = (d.aliases ?? [])
        .map((a) =>
          a.firstName ? `${a.firstName} ${a.lastName}`.trim() : a.lastName.trim(),
        )
        .filter(Boolean);

      // Date of birth
      const dateOfBirth = parseOfacDate(d.dateOfBirth ?? '');

      // Nationality
      const nationality = d.nationalities ?? [];

      // sourceId: use entity's rawId
      const sourceId = entity.rawId;

      const normalized: NormalizedEntity = {
        type: isIndividual ? 'person' : 'company',
        fullName,
        aliases,
        normalizedName,
        nationality,
        riskLevel: 'HIGH',
        sourceId,
        source: this.sourceId,
        relationships: [],
      };

      if (dateOfBirth !== undefined) {
        normalized.dateOfBirth = dateOfBirth;
      }

      return normalized;
    });
  }
}
