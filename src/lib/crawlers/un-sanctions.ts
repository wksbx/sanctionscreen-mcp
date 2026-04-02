import type { Crawler } from '@/lib/crawlers/types';
import type { RawEntity, NormalizedEntity } from '@/lib/types';
import { normalizeName } from '@/lib/matching/normalize';

// ─── Constants ────────────────────────────────────────────────────────────────

const UN_XML_URL =
  'https://scsanctions.un.org/resources/xml/en/consolidated.xml';

// ─── XML regex helpers ────────────────────────────────────────────────────────

function extractTag(xml: string, tag: string): string {
  const match = xml.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i'));
  return match ? match[1].trim() : '';
}

function extractAllTags(xml: string, tag: string): string[] {
  const re = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'gi');
  const results: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml)) !== null) {
    results.push(m[1].trim());
  }
  return results;
}

function splitByTag(xml: string, tag: string): string[] {
  const re = new RegExp(`<${tag}[^>]*>[\\s\\S]*?<\\/${tag}>`, 'gi');
  const results: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml)) !== null) {
    results.push(m[0]);
  }
  return results;
}

function extractAttr(xml: string, tag: string, attr: string): string {
  const re = new RegExp(`<${tag}[^>]*\\s${attr}="([^"]*)"`, 'i');
  const match = xml.match(re);
  return match ? match[1].trim() : '';
}

// ─── Raw data shape ───────────────────────────────────────────────────────────

interface UnRawData {
  entityType: 'individual' | 'entity';
  firstName: string;
  secondName: string;
  listedOn: string;
  nationality: string;
  listType: string;
  dateOfBirth: string;
  aliases: string[];
}

// ─── Entry parsers ────────────────────────────────────────────────────────────

function parseIndividual(xml: string): UnRawData {
  const firstName = extractTag(xml, 'FIRST_NAME');
  const secondName = extractTag(xml, 'SECOND_NAME');
  const listedOn = extractTag(xml, 'LISTED_ON');
  const nationality = extractTag(extractTag(xml, 'NATIONALITY'), 'VALUE');
  const listType = extractTag(extractTag(xml, 'LIST_TYPE'), 'VALUE');

  // DOB — pick DATE inside INDIVIDUAL_DATE_OF_BIRTH
  const dobBlock = extractTag(xml, 'INDIVIDUAL_DATE_OF_BIRTH');
  const dateOfBirth = dobBlock ? extractTag(dobBlock, 'DATE') : '';

  // Aliases from INDIVIDUAL_ALIAS > ALIAS_NAME
  const aliasBlocks = splitByTag(xml, 'INDIVIDUAL_ALIAS');
  const aliases = aliasBlocks
    .map((b) => extractTag(b, 'ALIAS_NAME'))
    .filter(Boolean);

  return { entityType: 'individual', firstName, secondName, listedOn, nationality, listType, dateOfBirth, aliases };
}

function parseEntity(xml: string): UnRawData {
  const firstName = extractTag(xml, 'FIRST_NAME');
  const listedOn = extractTag(xml, 'LISTED_ON');
  const listType = extractTag(extractTag(xml, 'LIST_TYPE'), 'VALUE');

  // Aliases from ENTITY_ALIAS > ALIAS_NAME
  const aliasBlocks = splitByTag(xml, 'ENTITY_ALIAS');
  const aliases = aliasBlocks
    .map((b) => extractTag(b, 'ALIAS_NAME'))
    .filter(Boolean);

  return { entityType: 'entity', firstName, secondName: '', listedOn, nationality: '', listType, dateOfBirth: '', aliases };
}

// ─── UnSanctionsCrawler ───────────────────────────────────────────────────────

export class UnSanctionsCrawler implements Crawler {
  readonly name = 'UN Consolidated Sanctions';
  readonly sourceId = 'un';

  async fetch(): Promise<RawEntity[]> {
    const response = await fetch(UN_XML_URL);
    if (!response.ok) {
      throw new Error(`UN Sanctions fetch failed: HTTP ${response.status}`);
    }

    const xml = await response.text();
    const results: RawEntity[] = [];

    // Parse INDIVIDUAL blocks
    const individualsBlock = extractTag(xml, 'INDIVIDUALS');
    if (individualsBlock) {
      const individualBlocks = splitByTag(individualsBlock, 'INDIVIDUAL');
      for (const block of individualBlocks) {
        const dataid = extractTag(block, 'DATAID');
        const rawData = parseIndividual(block) as unknown as Record<string, unknown>;
        results.push({ rawId: dataid, source: this.sourceId, rawData });
      }
    }

    // Parse ENTITY blocks
    const entitiesBlock = extractTag(xml, 'ENTITIES');
    if (entitiesBlock) {
      const entityBlocks = splitByTag(entitiesBlock, 'ENTITY');
      for (const block of entityBlocks) {
        const dataid = extractTag(block, 'DATAID');
        const rawData = parseEntity(block) as unknown as Record<string, unknown>;
        results.push({ rawId: dataid, source: this.sourceId, rawData });
      }
    }

    return results;
  }

  normalize(raw: RawEntity[]): NormalizedEntity[] {
    return raw.map((entity) => {
      const d = entity.rawData as unknown as UnRawData;

      const isIndividual = d.entityType === 'individual';

      const fullName = isIndividual && d.secondName
        ? `${d.firstName} ${d.secondName}`.trim()
        : d.firstName.trim();

      const normalizedName = normalizeName(fullName);

      const aliases = (d.aliases ?? []).filter(Boolean);

      const normalized: NormalizedEntity = {
        type: isIndividual ? 'person' : 'company',
        fullName,
        aliases,
        normalizedName,
        nationality: d.nationality ? [d.nationality] : [],
        riskLevel: 'HIGH',
        sourceId: entity.rawId,
        source: this.sourceId,
        relationships: [],
      };

      if (d.dateOfBirth) {
        normalized.dateOfBirth = d.dateOfBirth;
      }

      return normalized;
    });
  }
}

// suppress unused import warning for extractAllTags (kept for symmetry with ofac.ts pattern)
void (extractAllTags as unknown);
void (extractAttr as unknown);
