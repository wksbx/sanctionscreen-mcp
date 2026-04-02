import crypto from 'crypto';
import type { NormalizedEntity } from '@/lib/types';

// ─── Risk level ordering ───────────────────────────────────────────────────────

const RISK_ORDER: Record<string, number> = {
  HIGH: 3,
  MEDIUM: 2,
  LOW: 1,
};

function higherRisk(
  a: NormalizedEntity['riskLevel'],
  b: NormalizedEntity['riskLevel'],
): NormalizedEntity['riskLevel'] {
  const scoreA = a ? RISK_ORDER[a] ?? 0 : 0;
  const scoreB = b ? RISK_ORDER[b] ?? 0 : 0;
  if (scoreA === 0 && scoreB === 0) return undefined;
  return scoreA >= scoreB ? a : b;
}

// ─── generateEntityId ─────────────────────────────────────────────────────────

/**
 * Returns the first 16 hex characters of the SHA-256 hash of
 * `"${normalizedName}|${dateOfBirth || 'unknown'}|${source}"`.
 * Deterministic: same inputs always produce the same output.
 */
export function generateEntityId(
  normalizedName: string,
  dateOfBirth: string | undefined,
  source: string,
): string {
  const input = `${normalizedName}|${dateOfBirth || 'unknown'}|${source}`;
  return crypto.createHash('sha256').update(input).digest('hex').slice(0, 16);
}

// ─── deduplicateEntities ──────────────────────────────────────────────────────

/**
 * Groups entities by composite key `"${normalizedName}|${dateOfBirth || 'unknown'}"`.
 * For each group with more than one entity, merges:
 *   - aliases     (Set union)
 *   - nationality (Set union)
 *   - relationships (concat)
 *   - riskLevel   (keep highest: HIGH > MEDIUM > LOW)
 */
export function deduplicateEntities(entities: NormalizedEntity[]): NormalizedEntity[] {
  const groups = new Map<string, NormalizedEntity[]>();

  for (const entity of entities) {
    const key = `${entity.normalizedName}|${entity.dateOfBirth || 'unknown'}`;
    const group = groups.get(key);
    if (group) {
      group.push(entity);
    } else {
      groups.set(key, [entity]);
    }
  }

  const merged: NormalizedEntity[] = [];

  for (const group of groups.values()) {
    if (group.length === 1) {
      merged.push(group[0]);
      continue;
    }

    // Merge all members into the first entity (used as base).
    const [base, ...rest] = group;

    const aliasSet = new Set<string>(base.aliases);
    const nationalitySet = new Set<string>(base.nationality ?? []);
    let relationships = [...base.relationships];
    let riskLevel = base.riskLevel;

    for (const entity of rest) {
      for (const alias of entity.aliases) {
        aliasSet.add(alias);
      }
      for (const nat of entity.nationality ?? []) {
        nationalitySet.add(nat);
      }
      relationships = relationships.concat(entity.relationships);
      riskLevel = higherRisk(riskLevel, entity.riskLevel);
    }

    merged.push({
      ...base,
      aliases: Array.from(aliasSet),
      nationality: Array.from(nationalitySet),
      relationships,
      riskLevel,
    });
  }

  return merged;
}
