import type { Crawler } from '@/lib/crawlers/types';
import type { RawEntity, NormalizedEntity } from '@/lib/types';
import { normalizeName } from '@/lib/matching/normalize';

// ─── Constants ────────────────────────────────────────────────────────────────

const EU_XML_URL =
  'https://webgate.ec.europa.eu/fsd/fsf/public/files/xmlFullSanctionsList_1_1/content?token=dG9rZW4tMjAxNw';

// ─── XML regex helpers ────────────────────────────────────────────────────────

function extractAttrFromTag(xml: string, tag: string, attr: string): string {
  const re = new RegExp(`<${tag}[^>]*\\s${attr}="([^"]*)"`, 'i');
  const match = xml.match(re);
  return match ? match[1].trim() : '';
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

function splitBySelfClosingTag(xml: string, tag: string): string[] {
  // Matches both self-closing <tag .../> and paired <tag ...>...</tag>
  const reSelfClose = new RegExp(`<${tag}[^>]*/?>`, 'gi');
  const results: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = reSelfClose.exec(xml)) !== null) {
    results.push(m[0]);
  }
  return results;
}

// ─── Raw data shape ───────────────────────────────────────────────────────────

interface EuRawData {
  classificationCode: string;
  wholeName: string;
  aliases: string[];
  citizenship: string;
  birthdate: string;
  programme: string;
}

// ─── Entry parser ─────────────────────────────────────────────────────────────

function parseSanctionEntity(xml: string): { logicalId: string; data: EuRawData } {
  // logicalId from the opening tag attribute
  const logicalId = extractAttrFromTag(xml, 'sanctionEntity', 'logicalId');

  // classificationCode from <subjectType classificationCode="P"/>
  const classificationCode = extractAttrFromTag(xml, 'subjectType', 'classificationCode');

  // All nameAlias wholeName values — first one is primary name
  const nameAliasTags = splitBySelfClosingTag(xml, 'nameAlias');
  const allNames = nameAliasTags
    .map((tag) => extractAttrFromTag(tag, 'nameAlias', 'wholeName'))
    .filter(Boolean);

  const wholeName = allNames[0] ?? '';
  const aliases = allNames.slice(1);

  // citizenship countryIso2Code
  const citizenship = extractAttrFromTag(xml, 'citizenship', 'countryIso2Code');

  // birthdate attribute on <birthdate> tag
  const birthdate = extractAttrFromTag(xml, 'birthdate', 'birthdate');

  // programme attribute on <regulation> tag
  const programme = extractAttrFromTag(xml, 'regulation', 'programme');

  return {
    logicalId,
    data: { classificationCode, wholeName, aliases, citizenship, birthdate, programme },
  };
}

// ─── EuSanctionsCrawler ───────────────────────────────────────────────────────

export class EuSanctionsCrawler implements Crawler {
  readonly name = 'EU Financial Sanctions';
  readonly sourceId = 'eu';

  async fetch(): Promise<RawEntity[]> {
    const response = await fetch(EU_XML_URL);
    if (!response.ok) {
      throw new Error(`EU Sanctions fetch failed: HTTP ${response.status}`);
    }

    const xml = await response.text();
    const entityBlocks = splitByTag(xml, 'sanctionEntity');

    return entityBlocks.map((block) => {
      const { logicalId, data } = parseSanctionEntity(block);
      return {
        rawId: logicalId,
        source: this.sourceId,
        rawData: data as unknown as Record<string, unknown>,
      };
    });
  }

  normalize(raw: RawEntity[]): NormalizedEntity[] {
    return raw.map((entity) => {
      const d = entity.rawData as unknown as EuRawData;

      const isPerson = d.classificationCode === 'P';
      const fullName = d.wholeName;
      const normalizedName = normalizeName(fullName);
      const aliases = (d.aliases ?? []).filter(Boolean);
      const nationality = d.citizenship ? [d.citizenship] : [];

      const normalized: NormalizedEntity = {
        type: isPerson ? 'person' : 'company',
        fullName,
        aliases,
        normalizedName,
        nationality,
        riskLevel: 'HIGH',
        sourceId: entity.rawId,
        source: this.sourceId,
        relationships: [],
      };

      if (d.birthdate) {
        normalized.dateOfBirth = d.birthdate;
      }

      return normalized;
    });
  }
}
