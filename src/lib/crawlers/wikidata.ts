import type { Crawler } from '@/lib/crawlers/types';
import type { RawEntity, NormalizedEntity } from '@/lib/types';
import { normalizeName } from '@/lib/matching/normalize';

// ─── Constants ────────────────────────────────────────────────────────────────

const WIKIDATA_SPARQL_URL = 'https://query.wikidata.org/sparql';

const SPARQL_QUERY = `
SELECT ?person ?personLabel ?positionLabel ?countryLabel ?countryCode ?dob WHERE {
  ?person wdt:P39 ?position .
  OPTIONAL { ?position wdt:P17 ?country . }
  OPTIONAL { ?country wdt:P297 ?countryCode . }
  OPTIONAL { ?person wdt:P569 ?dob . }
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en" . }
}
`.trim();

// ─── SPARQL response shapes ───────────────────────────────────────────────────

interface SparqlValue {
  type: string;
  value: string;
}

interface SparqlBinding {
  person?: SparqlValue;
  personLabel?: SparqlValue;
  positionLabel?: SparqlValue;
  countryLabel?: SparqlValue;
  countryCode?: SparqlValue;
  dob?: SparqlValue;
}

interface SparqlResponse {
  results: {
    bindings: SparqlBinding[];
  };
}

interface WikidataRawData {
  qid: string;
  personLabel: string;
  positions: string[];
  countryLabel?: string;
  countryCode?: string;
  dob?: string;
}

// ─── WikidataCrawler ──────────────────────────────────────────────────────────

export class WikidataCrawler implements Crawler {
  readonly name = 'Wikidata PEPs';
  readonly sourceId = 'wikidata';

  async fetch(): Promise<RawEntity[]> {
    const url = new URL(WIKIDATA_SPARQL_URL);
    url.searchParams.set('query', SPARQL_QUERY);
    url.searchParams.set('format', 'json');

    const response = await fetch(url.toString(), {
      headers: { Accept: 'application/sparql-results+json' },
    });

    if (!response.ok) {
      throw new Error(`Wikidata fetch failed: HTTP ${response.status}`);
    }

    const data: SparqlResponse = await response.json();
    const bindings = data.results?.bindings ?? [];

    // Deduplicate by QID; accumulate positions
    const byQid = new Map<string, WikidataRawData>();

    for (const binding of bindings) {
      const personUri = binding.person?.value ?? '';
      // Extract QID from URI like http://www.wikidata.org/entity/Q12345
      const qidMatch = personUri.match(/\/entity\/(Q\d+)$/);
      if (!qidMatch) continue;
      const qid = qidMatch[1];

      const personLabel = binding.personLabel?.value ?? '';
      const positionLabel = binding.positionLabel?.value;
      const countryLabel = binding.countryLabel?.value;
      const countryCode = binding.countryCode?.value;
      const dob = binding.dob?.value;

      if (byQid.has(qid)) {
        const existing = byQid.get(qid)!;
        if (positionLabel && !existing.positions.includes(positionLabel)) {
          existing.positions.push(positionLabel);
        }
        // Fill in optional fields if not yet set
        if (!existing.countryLabel && countryLabel) existing.countryLabel = countryLabel;
        if (!existing.countryCode && countryCode) existing.countryCode = countryCode;
        if (!existing.dob && dob) existing.dob = dob;
      } else {
        byQid.set(qid, {
          qid,
          personLabel,
          positions: positionLabel ? [positionLabel] : [],
          countryLabel,
          countryCode,
          dob,
        });
      }
    }

    return Array.from(byQid.values()).map((entry) => ({
      rawId: entry.qid,
      source: this.sourceId,
      rawData: entry as unknown as Record<string, unknown>,
    }));
  }

  normalize(raw: RawEntity[]): NormalizedEntity[] {
    return raw.map((entity) => {
      const d = entity.rawData as unknown as WikidataRawData;

      const fullName = d.personLabel ?? '';
      const normalizedName = normalizeName(fullName);
      const pepRole = d.positions?.[0];
      const nationality = d.countryLabel ? [d.countryLabel] : [];

      const normalized: NormalizedEntity = {
        type: 'person',
        fullName,
        aliases: [],
        normalizedName,
        nationality,
        riskLevel: 'MEDIUM',
        sourceId: entity.rawId,
        source: this.sourceId,
        relationships: [],
      };

      if (d.dob !== undefined) {
        normalized.dateOfBirth = d.dob;
      }

      if (pepRole !== undefined) {
        normalized.pepRole = pepRole;
      }

      if (d.countryCode !== undefined) {
        normalized.pepCountry = d.countryCode;
      }

      return normalized;
    });
  }
}
