import type { Crawler } from '@/lib/crawlers/types';
import type { RawEntity, NormalizedEntity, DataSource } from '@/lib/types';
import { normalizeName } from '@/lib/matching/normalize';
import { safeFetch, readSizedText } from '@/lib/crawlers/safe-fetch';
import { validateExternalUrl } from '@/lib/security/validate-url';

// ── Field mapping shape for XML sources ──────────────────────────────────────

export interface XmlFieldMapping {
  entityTag: string;
  idAttr?: string;
  nameTag: string;
  nameAttr?: string;
  typeTag?: string;
  typeAttr?: string;
  typePersonValue?: string;
  aliasTag?: string;
  aliasAttr?: string;
  dobTag?: string;
  dobAttr?: string;
  nationalityTag?: string;
  nationalityAttr?: string;
}

// ── XML helpers ──────────────────────────────────────────────────────────────

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

function extractTagContent(xml: string, tag: string): string {
  const re = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i');
  const match = xml.match(re);
  return match ? match[1].trim() : '';
}

function extractAllAttrs(xml: string, tag: string, attr: string): string[] {
  const re = new RegExp(`<${tag}[^>]*\\s${attr}="([^"]*)"`, 'gi');
  const results: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml)) !== null) {
    if (m[1].trim()) results.push(m[1].trim());
  }
  return results;
}

// ── XmlFeedCrawler ───────────────────────────────────────────────────────────

export class XmlFeedCrawler implements Crawler {
  readonly name: string;
  readonly sourceId: string;
  private config: DataSource;
  private mapping: XmlFieldMapping;

  constructor(config: DataSource) {
    this.config = config;
    this.name = config.name;
    this.sourceId = config.sourceId;
    this.mapping = JSON.parse(config.fieldMapping || '{}') as XmlFieldMapping;
  }

  async fetch(): Promise<RawEntity[]> {
    validateExternalUrl(this.config.url);
    const response = await safeFetch(this.config.url);
    const xml = await readSizedText(response, this.config.url);
    const blocks = splitByTag(xml, this.mapping.entityTag);

    return blocks.map((block, i) => {
      const rawId = this.mapping.idAttr
        ? extractAttr(block, this.mapping.entityTag, this.mapping.idAttr) || String(i)
        : String(i);

      return { rawId, source: this.sourceId, rawData: { _xml: block } };
    });
  }

  normalize(raw: RawEntity[]): NormalizedEntity[] {
    const m = this.mapping;
    return raw.map((entity) => {
      const xml = entity.rawData._xml as string;

      // Name
      const fullName = m.nameAttr
        ? extractAttr(xml, m.nameTag, m.nameAttr)
        : extractTagContent(xml, m.nameTag);
      const normalizedName = normalizeName(fullName);

      // Aliases
      const aliases = m.aliasTag
        ? m.aliasAttr
          ? extractAllAttrs(xml, m.aliasTag, m.aliasAttr).filter((a) => a !== fullName)
          : []
        : [];

      // Type
      let isPerson = true;
      if (m.typeTag && m.typeAttr && m.typePersonValue) {
        const typeVal = extractAttr(xml, m.typeTag, m.typeAttr);
        isPerson = typeVal === m.typePersonValue;
      }

      // Nationality
      const nationality = m.nationalityTag && m.nationalityAttr
        ? extractAllAttrs(xml, m.nationalityTag, m.nationalityAttr)
        : [];

      // DOB
      const dob = m.dobTag
        ? m.dobAttr
          ? extractAttr(xml, m.dobTag, m.dobAttr)
          : extractTagContent(xml, m.dobTag)
        : undefined;

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
