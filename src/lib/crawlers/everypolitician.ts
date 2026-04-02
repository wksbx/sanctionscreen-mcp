import type { Crawler } from '@/lib/crawlers/types';
import type { RawEntity, NormalizedEntity } from '@/lib/types';
import { normalizeName } from '@/lib/matching/normalize';

// ─── Constants ────────────────────────────────────────────────────────────────

const EVERYPOLITICIAN_URL = 'https://everypolitician.org/countries.json';

// ─── Popolo format shapes ─────────────────────────────────────────────────────

interface PopoloPerson {
  id: string;
  name: string;
  other_names?: Array<{ name: string }>;
  birth_date?: string;
  national_identity?: string;
}

interface PopoloMembership {
  person_id: string;
  role?: string;
}

interface PopoloData {
  persons?: PopoloPerson[];
  memberships?: PopoloMembership[];
}

interface EveryPoliticianRawData {
  name: string;
  other_names: string[];
  birth_date?: string;
  national_identity?: string;
  role?: string;
}

// ─── EveryPoliticianCrawler ───────────────────────────────────────────────────

export class EveryPoliticianCrawler implements Crawler {
  readonly name = 'EveryPolitician';
  readonly sourceId = 'everypolitician';

  async fetch(): Promise<RawEntity[]> {
    const response = await fetch(EVERYPOLITICIAN_URL);
    if (!response.ok) {
      throw new Error(`EveryPolitician fetch failed: HTTP ${response.status}`);
    }

    const data: PopoloData = await response.json();

    const persons = data.persons ?? [];
    const memberships = data.memberships ?? [];

    // Build role map: person_id → first role found
    const roleMap = new Map<string, string>();
    for (const membership of memberships) {
      if (membership.person_id && membership.role && !roleMap.has(membership.person_id)) {
        roleMap.set(membership.person_id, membership.role);
      }
    }

    return persons.map((person) => {
      const otherNames = (person.other_names ?? []).map((n) => n.name).filter(Boolean);

      return {
        rawId: person.id,
        source: this.sourceId,
        rawData: {
          name: person.name,
          other_names: otherNames,
          birth_date: person.birth_date,
          national_identity: person.national_identity,
          role: roleMap.get(person.id),
        } as unknown as Record<string, unknown>,
      };
    });
  }

  normalize(raw: RawEntity[]): NormalizedEntity[] {
    return raw.map((entity) => {
      const d = entity.rawData as unknown as EveryPoliticianRawData;

      const fullName = d.name ?? '';
      const normalizedName = normalizeName(fullName);
      const aliases = d.other_names ?? [];
      const nationality = d.national_identity ? [d.national_identity] : [];

      const normalized: NormalizedEntity = {
        type: 'person',
        fullName,
        aliases,
        normalizedName,
        nationality,
        riskLevel: 'MEDIUM',
        sourceId: entity.rawId,
        source: this.sourceId,
        relationships: [],
      };

      if (d.birth_date !== undefined) {
        normalized.dateOfBirth = d.birth_date;
      }

      if (d.role !== undefined) {
        normalized.pepRole = d.role;
      }

      return normalized;
    });
  }
}
